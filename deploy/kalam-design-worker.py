#!/usr/bin/env python3
"""Durable image-render worker for Kalam Design Studio.

Jobs are first persisted by the gateway. This worker claims one queued job at a
time, produces an immutable image output, then records its result in the same
atomic project manifest. A crash never discards the input or a completed file.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import time
import traceback
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

import app
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageColor, ImageDraw, ImageFont, ImageFilter, ImageOps, features

AVALAI_API_KEY = os.environ.get("KALAM_AVALAI_API_KEY", "")
AVALAI_IMAGE_URL = "https://api.avalai.ir/v1/images/generations"
AVALAI_IMAGE_EDIT_URL = "https://api.avalai.ir/v1/images/edits"
AVALAI_CHAT_URL = "https://api.avalai.ir/v1/chat/completions"
# Gemini is the production default.  The environment override keeps model
# rollout reversible without another deployment.
# A short hard-news card is the only economical case where Lite has enough
# room to preserve Persian copy reliably.  Longer news and every non-news
# template use the full model.  Both names stay environment-configurable.
AVALAI_IMAGE_LITE_MODEL = os.environ.get("KALAM_IMAGE_MODEL_LITE", os.environ.get("KALAM_IMAGE_MODEL", "gemini-3.1-flash-lite-image"))
# Flare remains the production default for its faster generation path. It
# honors the requested social canvas natively when sent a valid custom raster.
AVALAI_IMAGE_FULL_MODEL = "gpt-image-2.5-flare"
POLL_SECONDS = 2
ASSET_DIR = Path("/opt/kalam-design-assets")
BRANDS = {
    "kalametaze": {"colour": "#b5121b", "logo": "kalametaze-on-dark.png", "logoLight": "kalametaze-on-light.png", "profile": "kalametaze-profile.jpg"},
    "golbahar": {"colour": "#50b9eb", "logo": "golbahar-on-dark.png", "logoLight": "golbahar-on-light.png", "profile": "golbahar-profile.jpg"},
    "chenaran": {"colour": "#198754", "logo": "chenaran-on-dark.png", "logoLight": "chenaran-on-light.png", "profile": "chenaran-profile.jpg"},
}
LANCZOS = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
RTL_TEXT = features.check("raqm")
TEXT_OPTIONS = {"direction": "rtl"} if RTL_TEXT else {}
FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def fa_number(value: int | str) -> str:
    return str(value).translate(FA_DIGITS)


COMPOSITION_DIRECTIONS = (
    "documentary wide composition with a strong sense of place and a calm clear focal point",
    "editorial close-to-medium composition focused on the main subject, with clean negative space",
    "layered local-context composition using an authentic foreground and restrained environmental depth",
    "minimal news-photo composition with a quiet background and one unmistakable visual story",
    "human-scale reportage composition that feels observed rather than staged, with balanced daylight",
)
TEMPLATE_DIRECTIONS = {
    "news_story": "One factual news story. Use an authentic scene directly connected to the headline; reserve uncluttered copy space and avoid generic newsroom imagery.",
    "news_post": "A 4:5 editorial news post. Build a single clear focal point with a compact, high-impact composition for a feed.",
    "photo_report": "A photographic report. Prioritise the real event, people or place over decorative objects; support a documentary multi-image feeling.",
    "video_placeholder": "A story cover for a forthcoming video. Leave one calm, intentional central area that can host a video frame without drawing a fake play button or any text.",
    "citizen_message": "A community/citizen report. Use a truthful local context and restrained, respectful composition rather than stock imagery.",
    "infographic": "An information-led visual background with clean contextual objects and generous orderly negative space; do not draw charts, numbers or text.",
    "poster": "A versatile, premium promotional poster with one unmistakable message, deliberate hierarchy, strong mobile readability and no generic advertising clichés.",
    "classifieds": "A dignified Iranian newspaper classified page with one to four strictly separated, balanced notices; every notice has its own compact icon, ruled boundary and readable contact line.",
    "morning_local": "A distinct, beautiful dawn scene recognisably appropriate to Golbahar or Chenaran: authentic northeastern Iranian light, seasonal local atmosphere, quiet depth, and a generous clean lower editorial area for prayer times and a short riddle. Never draw religious times, text or calendar marks.",
    "morning_kalam": "A fresh, elegant national morning visual with a timely Iranian sense of place, natural sunrise light, editorial depth and a generous clean lower area for calendar items and a riddle. Never draw dates, celebrations, flags, text or a calendar UI.",
    "market": "A premium restrained financial-editorial visual: gold texture, subtle exchange/market atmosphere, cinematic controlled light and ordered negative space for verified rates. Never draw currency labels, numbers, charts, trading screens, logos or fake price boards.",
    "night": "A calm night cultural visual suitable for a book, poem or music recommendation; elegant, not childish.",
    "home_tip": "A practical, believable home scene with one useful focal point and uncluttered space.",
    "visual_riddle": "A visually intriguing but simple scene that invites a short audience puzzle; do not include any written puzzle text.",
    "nature": "An authentic travel/nature scene with a strong sense of location and room for access information.",
    "poll_story": "A neutral, energetic public-question background with clear empty space; do not render poll choices, buttons or text.",
    "poll_post": "A feed-ready public-question background with a single focal point and intentional copy space; no poll UI or text.",
    "sport": "A credible premium sports-reportage setting with motion or genuine event context. Keep the approved Persian competition, team and result/program copy exact; never fabricate a scoreboard, crest, trophy, player, statistic or match.",
}


def peyda_font_path(weight: str) -> Path:
    """Use the intended editorial hierarchy, with safe fallbacks."""
    fonts = ASSET_DIR / "fonts"
    preferred = {
        "regular": fonts / "PeydaFaNum-Regular.ttf",
        "semibold": fonts / "PeydaFaNum-SemiBold.ttf",
        "bold": fonts / "PeydaFaNum-Bold.ttf",
    }[weight]
    if preferred.exists():
        return preferred
    return fonts / ("PeydaFaNum-Bold.ttf" if weight != "regular" else "PeydaFaNum-Regular.ttf")


def visual_direction(record: dict) -> str:
    """Choose a stable visual variation: retries keep a design coherent.

    The request ID distributes separate stories among compatible editorial
    compositions without making the brand system random or inconsistent.
    """
    digest = hashlib.sha256(record["requestId"].encode("utf-8")).digest()
    return COMPOSITION_DIRECTIONS[digest[0] % len(COMPOSITION_DIRECTIONS)]


def template_direction(record: dict) -> str:
    template = record.get("request", {}).get("format", {}).get("template", "")
    return TEMPLATE_DIRECTIONS.get(template, "Use a clean, truthful editorial composition that matches the selected social-media template.")


def prompt_layout_direction(record: dict) -> str:
    """Tell the image model precisely which area the renderer will occupy."""
    layout = resolved_layout(record)
    directions = {
        "full_photo": "Keep the primary subject in the upper half and reserve the lower 42 percent as calm, uncluttered photographic negative space for an editorial translucent copy layer.",
        "editorial_panel": "Keep the essential subject completely inside the upper 43 percent of the frame. The lower 57 percent will be covered by a solid newsroom text panel, so do not place faces, action, or important objects there.",
        "bottom_card": "Keep the essential subject completely in the upper 48 percent and leave the lower 52 percent visually quiet. A rounded translucent text card will cover that lower region.",
        "side_panel": "Place the complete visual subject, faces and action inside the LEFT 34 percent of the frame. The RIGHT 62 percent will be covered by a vertical text panel, so it must contain no important subject or detail.",
    }
    return directions[layout]


def resolved_layout(record: dict) -> str:
    format_ = record.get("request", {}).get("format", {})
    requested = format_.get("designLayout", format_.get("layoutMode", "auto"))
    if requested in {"full_photo", "editorial_panel", "bottom_card", "side_panel"}:
        return requested
    # Automatic mode is stable per project but deliberately rotates visual
    # hierarchy across separate stories.
    digest = hashlib.sha256(record["requestId"].encode("utf-8")).digest()
    return "full_photo" if digest[1] % 3 == 0 else "editorial_panel"


def resolved_headline_style(record: dict) -> str:
    requested = record.get("request", {}).get("format", {}).get("headlineStyle", "auto")
    if requested in {"bold", "accent", "compact"}:
        return requested
    digest = hashlib.sha256(record["requestId"].encode("utf-8")).digest()
    return ("bold", "accent", "compact")[digest[2] % 3]


def resolved_text_layout(record: dict) -> str:
    format_ = record.get("request", {}).get("format", {})
    requested = format_.get("designLayout") or format_.get("textLayout", "auto")
    if requested in {"standard", "bottom_card", "side_panel"}:
        return requested
    digest = hashlib.sha256(record["requestId"].encode("utf-8")).digest()
    return "standard" if requested in {"full_photo", "editorial_panel"} else ("standard", "bottom_card", "side_panel")[digest[3] % 3]


def resolved_surface_tone(record: dict) -> str:
    requested = record.get("request", {}).get("format", {}).get("surfaceTone", "auto")
    if requested in {"brand", "light", "dark"}:
        return requested
    digest = hashlib.sha256(record["requestId"].encode("utf-8")).digest()
    # Brand remains the most frequent look, with light and dark variations to
    # prevent a sequence of stories from becoming visually monotonous.
    return ("brand", "brand", "light", "dark")[digest[4] % 4]


def surface_colours(record: dict, brand: dict) -> tuple[tuple[int, int, int], str, str, str, int]:
    tone = resolved_surface_tone(record)
    brand_rgb = tuple(int(brand["colour"].lstrip("#")[offset:offset + 2], 16) for offset in (0, 2, 4))
    if tone == "light":
        return (248, 249, 250), "#17212b", "#455562", brand["colour"], 240
    if tone == "dark":
        return (20, 28, 37), "#ffffff", "#e3e7eb", brand["colour"], 220
    return brand_rgb, "#ffffff", "#f4f5f6", "#ffd25a" if record.get("request", {}).get("brand") == "kalametaze" else "#ffffff", 190


def uses_editorial_header(record: dict) -> bool:
    """Studio scenes carry identity inside the set, never as a social masthead."""
    request = record.get("request", {})
    format_ = request.get("format", {})
    return resolved_logo_behavior(record) == "system_header"


def resolved_logo_behavior(record: dict) -> str:
    format_ = record.get("request", {}).get("format", {})
    value = str(format_.get("logoBehavior", "")).strip()
    if value in {"system_header", "floating_profile", "none"}:
        return value
    # Preserve old projects: the historical Studio switch controlled only
    # the system masthead, while ordinary designs always had it.
    if format_.get("family") == "studio" or record.get("request", {}).get("image", {}).get("mode") == "studio":
        studio = format_.get("studio") if isinstance(format_.get("studio"), dict) else {}
        return "system_header" if bool(studio.get("headerEnabled", False)) else "floating_profile"
    return "system_header" if format_.get("template") != "sticker" else "none"


def brand_profile_path(brand_id: str) -> Path | None:
    brand = BRANDS.get(brand_id, BRANDS["kalametaze"])
    candidates = [
        ASSET_DIR / "profiles" / str(brand.get("profile", "")),
        ASSET_DIR / "profiles" / {"kalametaze": "red-white.jpg", "chenaran": "green.jpg", "golbahar": "blue.jpg"}.get(brand_id, ""),
    ]
    return next((candidate for candidate in candidates if candidate and candidate.is_file()), None)


def editorial_header_copy(record: dict) -> tuple[str, str]:
    """Return the two approved, deterministic masthead strings."""
    request = record.get("request", {})
    content = request.get("content", {})
    format_ = request.get("format", {})
    template = format_.get("template", "news_story")
    header_label = {
        "news_story": "خبر", "news_post": "خبر", "photo_report": "گزارش تصویری", "video_placeholder": "ویدیو",
        "citizen_message": "کلام مردم", "infographic": "اینفوگرافی", "poster": "پوستر", "classifieds": "نیازمندی‌ها", "morning_local": "صبح بخیر",
        "morning_kalam": "صبح بخیر", "market": "نبض بازار", "editorial_note": "یادداشت", "night": "شبانه", "home_tip": "خانه‌داری",
        "visual_riddle": "معما", "nature": "طبیعت‌گردی", "poll_story": "نظرسنجی", "poll_post": "نظرسنجی", "sport": "ورزش",
        "occasion_greeting": "مناسبت",
    }.get(template, "کلام تازه")
    if template == "occasion_greeting":
        header_label = "تبریک" if str(content.get("occasionTone", "")).strip() == "congratulation" else "تسلیت"
    if template in {"morning_local", "morning_kalam"}:
        greeting_emojis = ("☀️", "🌤️", "🌱", "✨", "🌅", "☕")
        request_seed = sum(str(record.get("requestId", "")).encode("utf-8"))
        header_label = f"صبح تازه‌تون بخیر {greeting_emojis[request_seed % len(greeting_emojis)]}"
    brand_title = {
        "kalametaze": "پایگاه خبری کلام تازه",
        "golbahar": "پایگاه خبری کلام تازه گلبهار",
        "chenaran": "پایگاه خبری کلام تازه چناران",
    }.get(request.get("brand", "kalametaze"), "پایگاه خبری کلام تازه")
    return header_label, brand_title


def render_prompt(record: dict) -> str:
    """Build one finished, AI-authored design — no post-generation renderer.

    Templates intentionally read like a creative director's production brief:
    stable identity and hierarchy first, then only the fields the editor filled.
    This keeps a series cohesive while allowing the image model to make the
    final visual decisions.
    """
    request = record["request"]
    content = request.get("content", {})
    additional_instructions = str(content.get("additionalInstructions", "")).strip()
    image_contract = request.get("image", {}) if isinstance(request.get("image"), dict) else {}
    image_mode_contract = str(image_contract.get("mode", "generate"))
    image_prompt = str(image_contract.get("prompt", "")).strip()
    image_reference_instructions = str(image_contract.get("referenceInstructions", "")).strip()
    design_presenter_ids = [str(item) for item in image_contract.get("presenterIds", []) if str(item)]
    format_ = request.get("format", {})
    brand = request.get("brand", "kalametaze")
    is_news = format_.get("family") == "news" or format_.get("baseFamily") == "news"
    is_studio_image = format_.get("family") == "studio" or image_mode_contract == "studio"
    is_post_canvas = format_.get("canvas") == "post_1080x1350"
    # The approved masthead itself stays at its current position. The model
    # needs coordinates in its own raster: Gemini returns provider-native
    # 928×1152 / 768×1376 rasters, while GPT Image 2 is explicitly asked for
    # 1024×1280 / 864×1536. Mixing one provider's coordinates with the other
    # can put Persian headlines under the deterministic masthead.
    # The masthead itself reaches roughly y=310 after its final transparent
    # asset is composited.  Leave a real buffer rather than merely clearing
    # the model's old 280px estimate, which let tall Persian glyphs land under
    # the official header on posts and, occasionally, stories.
    safe_top_pixels = 340
    safe_canvas_label = "۱۰۸۰×۱۳۵۰" if is_post_canvas else "۱۰۸۰×۱۹۲۰"
    is_gemini_image = selected_image_model(record).startswith("gemini-")
    if is_gemini_image:
        safe_top_provider_pixels = 292 if is_post_canvas else 244
        safe_provider_label = "۹۲۸×۱۱۵۲" if is_post_canvas else "۷۶۸×۱۳۷۶"
    else:
        safe_top_provider_pixels = 323 if is_post_canvas else 272
        safe_provider_label = "۱۰۲۴×۱۲۸۰" if is_post_canvas else "۸۶۴×۱۵۳۶"
    safe_top_percent = "۲۵٫۱۹٪" if is_post_canvas else "۱۷٫۷۱٪"
    readable_text_geometry = (
        f"قرارداد هندسی قطعی و مخصوص همین نسبت تصویر: در خروجی نهایی {safe_canvas_label}، ردیف‌های y=0..{fa_number(safe_top_pixels - 1)} "
        f"(بالای {safe_top_percent} تصویر) منطقهٔ ممنوعهٔ متن‌اند و bounding box هر نوشته باید y_min >= {fa_number(safe_top_pixels)} باشد. "
        f"تو عملاً روی بوم {safe_provider_label} رندر می‌کنی؛ بنابراین در همان تصویر واقعیِ خودت ردیف‌های "
        f"y=0..{fa_number(safe_top_provider_pixels - 1)} را کاملاً بدون نوشته نگه دار و bounding box کامل هر نوشته را فقط از "
        f"y >= {fa_number(safe_top_provider_pixels)} آغاز کن. این عددِ دوم مختصات عملیاتی توست. روتیتر، تیتر، زیرتیتر، منبع، "
        "تعامل، کپشن، عدد، آیدی، برچسب و تمام سایه/حاشیهٔ حروف همگی مشمول همین مرزند؛ حتی یک پیکسل متن از آن عبور نکند. "
        "این اندازه‌ها فقط دستور داخلیِ صفحه‌آرایی‌اند: هرگز عدد، خط، کادر، نوار، تغییر رنگ یا نشانه‌ای برای نمایش مرزِ ناحیهٔ امن در خود تصویر نکش."
    )
    provider_text_start = (
        f"در بوم واقعی {safe_provider_label}: بالاترین پیکسلِ هر نوشته y >= {fa_number(safe_top_provider_pixels)}؛ "
        f"در بوم نهایی {safe_canvas_label}: بالاترین پیکسلِ هر نوشته y >= {fa_number(safe_top_pixels)}."
    )
    news = format_.get("news") or {}
    citizen = format_.get("citizen") or {}
    studio = format_.get("studio") or {}
    foundation = (
        "یک تصویر استودیوییِ کامل و واقع‌گرایانه بساز؛ کیفیت چهره، نور، لنز، عمق صحنه و وفاداری به تصاویر مرجع اولویت مطلق است."
        if is_studio_image else
        app.image_base_prompt() if format_.get("family") == "news" else app.image_non_news_prompt()
    )
    template = format_.get("template", "news_story")
    header_label, brand_title = editorial_header_copy(record)
    brand_watermark = {
        "kalametaze": "@kalametaze.ir",
        "golbahar": "@golbahar.kalametaze",
        "chenaran": "@chenaran.kalametaze",
    }.get(brand, "@kalametaze.ir")
    slide_mode = str(format_.get("slideMode", "single"))
    slide_count = max(1, min(10, int(format_.get("slideCount", 1) or 1)))
    slide_index = max(1, min(slide_count, int(format_.get("slideIndex", 1) or 1)))
    is_series_slide = slide_mode in {"multi_story", "carousel"} and slide_count > 1
    # Keep the approved body as private layout context for continuation
    # slides. It may be removed from visual-copy fields below, but the model
    # still needs its real rhythm and length to reserve the right amount of
    # empty writing space.
    series_caption_context = str(content.get("caption", "")).strip() if is_series_slide and is_news else ""
    series_blank_fields: list[tuple[str, int]] = []
    if is_series_slide:
        club_showcase = content.get("clubShowcase") if template == "club_showcase" else None
        # A serial slide is deliberately a sealed, minimal payload.  Old
        # hidden values from the general design form must never leak into it.
        allowed_by_template = {
            "citizen_message": {"citizenMessageText", "citizenHeadline", "citizenResponse", "citizenInteraction"},
            "editorial_note": {"title", "caption", "source", "editorialNoteStyle"},
        }
        allowed = allowed_by_template.get(template, {"kicker", "title", "subtitle", "caption", "interactionText", "source"})
        content = {key: value for key, value in content.items() if key in allowed and isinstance(value, str) and value.strip()}
        if isinstance(club_showcase, dict):
            content["clubShowcase"] = club_showcase
        # Image models are not dependable for long Persian paragraphs.  They
        # receive only the amount, never the words, and must reserve a blank
        # writing area. These limits are intentionally generous for mobile.
        visible_limits = {"title": 240, "subtitle": 280, "caption": 700, "interactionText": 240, "source": 180, "citizenHeadline": 240, "citizenResponse": 420, "citizenInteraction": 240, "citizenMessageText": 700}
        for key, limit in visible_limits.items():
            value = str(content.get(key, "")).strip()
            if value and len(value) > limit:
                series_blank_fields.append((key, len(value)))
                content.pop(key, None)
    else:
        # Apply the same safe visual-text contract to ordinary single designs.
        # The full text remains in the form/publication flow; it simply is not
        # entrusted to image generation once it is too long for reliable copy.
        visible_limits = {"title": 240, "subtitle": 280, "caption": 700, "interactionText": 240, "citizenMessageText": 700, "citizenHeadline": 240, "citizenResponse": 420, "citizenInteraction": 240, "occasionHeadline": 240, "occasionMessage": 700}
        for key, limit in visible_limits.items():
            value = str(content.get(key, "")).strip()
            if value and len(value) > limit:
                series_blank_fields.append((key, len(value)))
                content.pop(key, None)
    # A news-series cover is an intentionally minimal entry point.  Enforce
    # this at the worker too, so stale deck fields or an old client cannot put
    # article paragraphs, sources, or arbitrary CTAs on slide one.
    if is_series_slide and is_news:
        if slide_index == 1:
            content = {
                key: str(content.get(key, "")).strip()
                for key in ("kicker", "title", "subtitle")
                if str(content.get(key, "")).strip()
            }
            content["interactionText"] = "ورق بزنید"
        else:
            content.pop("kicker", None)
    # Admin-only helper answers are intentionally never part of the visual
    # brief. They exist only to make puzzle suggestions reviewable.
    approved_copy = {key: value for key, value in content.items() if value and key not in {"additionalInstructions", "titleOnly", "titleLayout", "morningRiddleAnswer", "morningVisualRiddleAnswer"}}
    if template == "club_showcase":
        approved_copy = {"title": str((content.get("clubShowcase") or {}).get("title", ""))}
    output_kind = news.get("outputKind", "title_photo")
    layout = news.get("layout", "top")
    photo_frame = news.get("photoFrame", "full")
    video_overlay = bool(news.get("videoOverlay"))
    video_frame = news.get("videoFrame", "landscape")
    video_background_blur = bool(news.get("videoBackgroundBlur"))
    site_link_placeholder = bool(news.get("siteLinkPlaceholder"))
    if is_news and template != "sport":
        # Keep the data payload as small as the selected form state requires;
        # stale text from an earlier selection must never contradict the brief.
        # Caption is sent only to determine the amount of *empty* caption
        # space. It is deliberately excluded from the visible-copy module.
        allowed = {"kicker", "title", "subtitle", "caption", "source", "interactionText"}
        approved_copy = {key: value for key, value in approved_copy.items() if key in allowed}
    template_briefs = {
        "morning_local": "یک استوری صبحگاهی مجله‌ای و ممتاز بساز. کارت‌های شیشه‌ای مستقل برای آب‌وهوا، اوقات شرعی و معما داشته باش. برای هر ردیف اوقات شرعی و هر دادهٔ آب‌وهوا آیکون سه‌بعدیِ ظریف و حرفه‌ای طراحی کن. معما در کارت مستقل و چشمگیر باشد.",
        "morning_kalam": "یک جلد صبحگاهی ملی با حس امید، تقویم و مناسبت‌ها بساز. مناسبت‌ها و معما دو کارت مستقل با آیکون اختصاصی داشته باشند.",
        "market": "یک داشبورد مالی لوکس، طلایی و تیره بساز؛ هر نرخ در یک ردیف/ویجت واضح، حرفه‌ای و قابل اسکن باشد. عددها و واحدها را عیناً حفظ کن.",
        "editorial_note": "یک یادداشت سردبیر/ادمینِ اینستاگرامی با هویت رنگی رسانه، حس انسانی و اقتدار تحریریه، گرید مجله‌ای خلوت و تایپوگرافی حرفه‌ای بساز.",
        "citizen_message": "یک طراحی فیروزه‌ای، انسانی و معتبر برای پیام مردمی بساز؛ متن اصلی با احترام و خوانایی بالا در کارت شیشه‌ای قرار گیرد.",
        "night": "یک طراحی شبانه با ترکیب بنفش عمیق و مشکی، حس فرهنگی و سینمایی، مناسب کتاب/شعر/موسیقی بساز.",
        "home_tip": "یک طراحی کاربردی، گرم و تمیز با حس مجلهٔ سبک زندگی بساز.",
        "visual_riddle": "یک طراحی بازی‌گونه اما حرفه‌ای برای تعامل بساز؛ معما واضح و فضای پاسخ‌گویی جذاب باشد.",
        "nature": "یک طراحی سفر و طبیعت با حس کشف، نقشه/مسیر نمادین و کادرهای اطلاعاتی لوکس بساز.",
        "poll_story": "یک استوری نظرسنجی پرانرژی با فضای مناسب تعامل و دکمه‌های ظاهریِ غیرقابل‌کلیک بساز.",
        "poll_post": "یک پست نظرسنجی چشمگیر با گرید مرتب و فضای پاسخ‌گویی بساز.",
        "sport": "یک طراحی ورزشی پویا، پرانرژی و حرفه‌ای با تایپوگرافی قوی و آیکون‌های ورزشی ظریف بساز.",
        "poster": "یک پوستر تبلیغاتی یا اطلاع‌رسانیِ حرفه‌ای، قابل‌انتشار و دارای پیام اصلیِ بسیار خوانا، گرید ممتاز و دعوت به اقدامِ واضح بساز.",
        "classifieds": "یک صفحهٔ نیازمندی روزنامه‌ایِ حرفه‌ای بساز؛ هر آگهی در کادر مستقل با آیکون کوچک مرتبط، تیتر، متن و راه تماس دقیق قرار بگیرد.",
    }
    # The editable gateway file is the source of truth.  The in-code wording
    # remains a safe fallback for an unknown/legacy template only.
    brief = app.image_template_prompt(template) if hasattr(app, "image_template_prompt") else template_briefs.get(template, "یک استوری خبری واقع‌گرایانه، مدرن و در حد جلد مجله بساز. عکس زمینه ایرانی، معتبر و مستقیماً مرتبط با موضوع باشد. تیتر در بخش طبیعی و آرام تصویر قرار گیرد، نه در یک کادر تیترِ جدا.")
    image_mode = image_mode_contract
    # A visual edit always uses the already-generated parent image as its
    # immutable reference.  In the prompt it therefore has the same visual
    # contract as preserving a real image, while avoiding a missing dictionary
    # key for the internal ``edit_existing`` transport mode.
    if image_mode == "edit_existing":
        image_mode = "preserve"
    reference_count = len(record.get("uploadedImages") or [])
    uploaded_items = [item for item in (record.get("uploadedImages") or []) if isinstance(item, dict)]
    continuity_count = sum(1 for item in uploaded_items if str(item.get("role", "")) == "series_previous_slide")
    user_reference_count = sum(1 for item in uploaded_items if str(item.get("role", "")) != "series_previous_slide")
    has_user_reference = user_reference_count > 0
    reference_instruction = (
        "تصویر پیوست‌شده داراییِ قفل‌شده و خودِ عکس نهایی است، نه منبع الهام: تمام پیکسل‌های بخش اصلی، سوژه، چهره، بافت پوست، لباس، مکان، اشیا، نور و معنای آن را بدون بازسازی و تغییر نگه دار. عکس مشابه یا نسخهٔ تازه نساز. فقط اگر نسبت بوم ایجاب می‌کند، زمینه را از لبه‌های بیرونی همان عکس به‌طور طبیعی گسترش بده؛ داخل محدودهٔ اصلی عکس را دست‌کاری نکن."
        if reference_count <= 1 else
        "همهٔ تصاویر پیوست‌شده دارایی‌های قفل‌شده‌اند و باید بدون بازسازی، تغییر چهره/سوژه/لباس/مکان/اشیا، حذف یا جایگزینی استفاده شوند. هر عکس را با تمام محتوای اصلی‌اش دقیقاً حفظ کن و فقط در بیرونِ لبه‌های آن برای هماهنگی با بوم outpaint انجام بده. اگر چند تصویر باید کنار هم بیایند، کولاژ مجله‌ایِ تمیز بساز اما داخل هیچ عکس را تغییر نده و هیچ تصویر تازه‌ای به‌جای آن‌ها تولید نکن."
    )
    image_instructions = {
        "generate": "عکس خبریِ بدنه را خودت، دقیقاً متناسب با موضوع تیتر، کاملاً واقع‌گرایانه، ایرانی و با حس عکاسی خبری تولید کن. پیش از ساخت عکس، برای بخشِ آرام و خوانای تیتر برنامه‌ریزی کن.",
        "preserve": "همهٔ تصاویر پیوست‌شده، داراییِ قفل‌شده و خودِ عکس نهایی هستند: محدودهٔ اصلی هر عکس و تمام پیکسل‌ها، سوژه‌ها، چهره‌ها، بافت پوست، لباس، مکان، اشیا، نور، لحظه و معنای آن را دقیقاً نگه دار. بهبود یا بازسازی داخل عکس، تغییر رنگ و نور، روتوش، برشِ محتوای اصلی، جایگزینی یا تولید عکس مشابه ممنوع است. فقط گسترش طبیعی زمینه در بیرون لبه‌های عکس برای تکمیل نسبت بوم مجاز است.",
        "reference": reference_instruction,
        "studio": "Ù‡Ù…Ø§Ù† Ù„ÙˆÚ©ÛŒØ´Ù† Ø§Ø³ØªÙˆØ¯ÛŒÙˆÛŒÛŒ Ùˆ Ø§Ù„Ù…Ø§Ù†â€ŒÙ‡Ø§ÛŒ ØªØ£ÛŒÛŒØ¯Ø´Ø¯Ù‡ Ø±Ø§ Ø­ÙØ¸ Ú©Ù†؛ Ø§Ú¯Ø± Ø±ÙØ±Ù†Ø³ Ø§Ø±Ø§Ø¦Ù‡ Ø´Ø¯Ù‡ØŒ Ú©Ø§Ù…Ø±Ø§ØŒ Ú†ÛŒØ¯Ù…Ø§Ù†ØŒ Ù†ÙˆØ±ØŒ Ø²Ù…ÛŒÙ†Ù‡ Ùˆ Ø¬Ø§ÛŒÚ¯Ø°Ø§Ø±ÛŒ Ø±Ø§ Ø¨Ø¯ÙˆÙ† ØªØºÛŒÛŒØ± Ù†Ú¯Ù‡ Ø¯Ø§Ø±؛ Ù…ØªÙ† Ø§ÛŒÙ† Ø§Ø³Ù„Ø§ÛŒØ¯ Ø±Ø§ Ø¨Ø§ Ù‡Ù…ÛŒÙ† Ù„ÙˆÚ©ÛŒØ´Ù† Ùˆ Ù‡Ù…Ø§Ù‡Ù†Ú¯ÛŒ Ù…Ø¬Ù„Ù‡â€ŒØ§ÛŒ Ø±Ù†Ø¯Ø± Ú©Ù†.",
        "none": "هیچ عکس خبری، قاب عکس یا سوژهٔ تصویری مستقل نساز. با تایپوگرافی، رنگ، بافت و گرافیک حرفه‌ایِ کاملاً متناسب با موضوع، طرح را کامل کن.",
    }
    # The worker file historically contained a mojibake copy of the Studio
    # wording. Keep the provider-facing contract explicit and ASCII-safe:
    # attached monitor/reference pixels are evidence to preserve, not a cue to
    # redraw. This override also applies to legacy saved jobs.
    image_instructions["studio"] = (
        "Studio image contract: preserve every attached user-reference image exactly when the request says preserve/reference. "
        "For a monitor image, place the original image inside the existing monitor surface with its pixels, map geometry, labels, typography and colors unchanged; only apply the monitor's natural perspective, glare and scene lighting outside the image content. "
        "Do not redraw, translate, summarize, sharpen, recolor, crop, regenerate or replace any part of the attached image. "
        "The current-slide attachment always outranks a previous-slide continuity reference."
    )
    layout_instructions = {
        "top": f"صفحه‌بندی پیش‌فرضِ مجله‌ای: {provider_text_start} کل کادر تیتر، تمام حروف و سایهٔ آن را پایین این مرز قرار بده. جای تیتر را متناسب با عکس انتخاب کن و آن را تکراری نساز؛ راست‌چین، وسط‌چین یا چپ‌چین بودن باید آگاهانه و هماهنگ با صحنه باشد. یک یا دو تأکید خلاقانهٔ کنترل‌شده انتخاب کن: بزرگ‌کردن یک واژهٔ کلیدی، تغییر رنگ واژه‌ای مهم، خط ظریف کنار/زیر چند کلمه، یا باکس رنگی محدود زیر بخش مهم تیتر. عکس باید جای طبیعی تیتر را ایجاد کند؛ باکس تیترِ جدا و کلیشه‌ای نساز.",
        "right_column": f"یک ستون عمودیِ یکپارچه و حرفه‌ای در سمت راست بساز. {provider_text_start} خود ستون می‌تواند ادامهٔ طبیعی گرید باشد، اما تیتر و تمام نوشته‌های آن فقط پایین این مرز آغاز شوند. تیتر در بالای همین ستونِ پایین‌آمده، چندخطی و با حداکثر یک یا دو کلمه در هر خط باشد. اگر خروجی پنل کپشن دارد، نیمهٔ پایین ستون را برای همان پنل رزرو کن؛ نوع خروجی مشخص می‌کند پنل خالی باشد یا متن کپشن را بگیرد. در غیر این صورت تیتر در ارتفاع ستون متعادل و شاخص قرار گیرد.",
        "center": f"{provider_text_start} تیتر را به‌عنوان قهرمان اصلی طرح، با ترکیب‌بندی مجله‌ای شاخص در مرکزِ مجازِ پایین این مرز قرار بده. اگر قاب عکسِ غیرتمام‌صفحه انتخاب شده، تیتر باید در ناحیهٔ خلوتِ بیرون قاب باشد و با آن هم‌پوشانی نداشته باشد؛ اگر عکس تمام‌صفحه است، در خودِ عکس یک ناحیهٔ طبیعی، آرام و با تضاد کافی برای تیتر بساز، بدون باکس کلیشه‌ای. در حالت فقط تیتر نیز هیچ قاب عکس یا سوژهٔ تصویری مستقل نساز. اگر پنل کپشنِ خالی وجود دارد، تیتر وسط نباید وارد آن شود. اندازه، وزن و شکست خطوط تیتر اولویت بصری اصلی باشد.",
        "bottom": f"{provider_text_start} تیتر را به‌عنوان قهرمان اصلی طرح، با ترکیب‌بندی مجله‌ای شاخص در پایین تصویر قرار بده. اگر قاب عکسِ غیرتمام‌صفحه انتخاب شده، تیتر باید در ناحیهٔ خلوتِ بیرون قاب باشد و با آن هم‌پوشانی نداشته باشد؛ اگر عکس تمام‌صفحه است، در خودِ عکس یک ناحیهٔ طبیعی، آرام و با تضاد کافی در پایین برای تیتر بساز، بدون باکس کلیشه‌ای. در حالت فقط تیتر نیز هیچ قاب عکس یا سوژهٔ تصویری مستقل نساز. اگر پنل کپشنِ خالی وجود دارد، تیتر پایین نباید وارد آن شود. اندازه، وزن و شکست خطوط تیتر اولویت بصری اصلی باشد.",
    }
    photo_frame_instructions = {
        "full": "عکس خبر سراسر بدنه را با برش هوشمند، طبیعی و بدون حاشیهٔ بی‌دلیل پُر کند؛ ناحیهٔ امن بالا و نواحی متن بخشی از همان ترکیب‌بندی پیوسته باشند.",
        "landscape": "در بدنه یک قاب افقیِ بزرگ، مجله‌ای و یکپارچه با گرید بساز و آن را با عکس واقعی یا تولیدشده کاملاً پُر کن. بیرون قاب برای تیتر و عناصر کمکی، خلوت و حساب‌شده بماند.",
        "square": "در بدنه یک قاب مربعِ بزرگ، مجله‌ای و یکپارچه با گرید بساز و آن را با عکس واقعی یا تولیدشده کاملاً پُر کن. بیرون قاب برای تیتر و عناصر کمکی، خلوت و حساب‌شده بماند.",
        "portrait_3_4": "در بدنه یک قاب عمودیِ بزرگ با نسبت دقیق ۳:۴، مجله‌ای و یکپارچه با گرید بساز و آن را با عکس واقعی یا تولیدشده کاملاً پُر کن. بیرون قاب برای تیتر و عناصر کمکی، خلوت و حساب‌شده بماند.",
    }
    video_instruction = "" if not video_overlay else (
        f"این طرح برای قراردادن ویدیو است، نه کاور و نه قاب نمایشی. در بدنه یک فضای ویدیوییِ کاملاً خالی با نسبت دقیق { {'landscape': '۱۶:۹ افقی', 'square': '۱:۱ مربع', 'portrait': '۹:۱۶ عمودی'}[video_frame] } رزرو کن. در حالت افقی یا مربع، این فضا باید با حداکثر عرضِ ممکن و حدود ۳٫۵٪ فاصله از کناره‌ها باشد؛ در حالت عمودی، با حداکثر ارتفاعِ ممکن و در مرکز قرار بگیرد. داخل فضای رزروشده هیچ انسان، عکس، نوشته، لوگو، آیکون، دکمهٔ پخش، بافت، نور، سایه، گرادینت یا عنصر گرافیکی نساز. اگر شفافیت واقعی PNG را پشتیبانی می‌کنی، خودِ این فضا را شفاف بگذار؛ در غیر این صورت همان ناحیه را یک باکس ساده، تمیز، خالی و یکدست با مرز بسیار ظریف بساز تا محل ویدیو دقیق و قابل‌تشخیص باشد. بیرون این باکس ترکیب‌بندی و هویت بصری را با کیفیت ممتاز کامل کن. هیچ پردازش دستی یا حذف پس‌زمینه‌ای بعد از تولید انجام نمی‌شود."
    )
    def module(title: str, body: str) -> str:
        """Return a prompt section only when its controlling form state is active."""
        body = body.strip()
        return f"### {title}\n{body}" if body else ""

    def occasion_instruction(value: str, placement: str) -> str:
        """Safely typeset only short occasions; reserve room for long lists.

        Image models are unreliable with multi-line Persian copy.  The same
        rule as citizen messages therefore gives the editor a designed blank
        area and keeps the authoritative text available for manual overlay.
        """
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        words = len(lines[0].split()) if len(lines) == 1 else 0
        if len(lines) == 1 and words <= 14:
            return f"{placement}، مناسبت امروز را دقیقاً و بدون تغییر در یک خط مستقل بنویس: «{lines[0]}»."
        if lines:
            return f"{placement}، برای {fa_number(len(lines))} خط مناسبتِ تأییدشده (در مجموع حدود {fa_number(sum(len(line.split()) for line in lines))} واژه) یک فضای خالیِ شیشه‌ای، جادار و خوانا رزرو کن. هیچ‌یک از متن مناسبت‌ها، متن آزمایشی، عدد، عنوان یا مناسبت حدسی را در آن ننویس؛ تحریریه متن را بعداً دستی اضافه می‌کند."
        return ""

    # These booleans are the prompt contract for the dynamic news form.  A
    # disabled form branch must never leak a stale instruction into the model.
    has_news_photo = is_news and template != "citizen_message" and output_kind != "title_only" and not video_overlay

    form_modules: list[str] = []
    advertising = request.get("advertising") if isinstance(request.get("advertising"), dict) else {}
    if advertising.get("enabled"):
        ad_mode = {"card": "کارت تبلیغات مستقل", "subtitle": "زیرنویس تبلیغاتی جذاب روی طراحی", "embedded": "طراحی تبلیغ در بطن تصویر"}.get(str(advertising.get("mode")), "کارت تبلیغات مستقل")
        ad_lines = [f"حالت تبلیغ: {ad_mode}"]
        for key, label in (("title", "عنوان"), ("subtitle", "زیرعنوان"), ("description", "توضیحات"), ("contact", "راه‌های ارتباطی")):
            value = str(advertising.get(key) or "").strip()
            if value:
                ad_lines.append(f"{label} را دقیقاً و بدون تغییر استفاده کن: «{value}».")
        ad_lines.append("فایل‌های تبلیغِ پیوست‌شده مرجع قفل‌شده‌اند؛ لوگو، محصول، بسته‌بندی، چهره و نوشته‌های داخل آن‌ها را حفظ کن و فقط مطابق حالت تبلیغ در ترکیب‌بندی اصلی ادغام کن. هیچ ادعا، قیمت، تخفیف، شماره، نشانی یا لوگوی تازه‌ای اختراع نکن.")
        form_modules.append(module("ماژول تبلیغات", "\n".join(ad_lines)))
    if template.startswith("club_"):
        form_modules.append(module("هویت محتوای باشگاه مخاطبان", app.image_template_prompt(template)))
    if template == "club_showcase":
        showcase = content.get("clubShowcase") or {}
        if isinstance(showcase, dict):
            labels = {"title": "عنوان جایزه", "store": "نام فروشگاه", "discount": "تخفیف", "gift": "هدیه", "description": "شرایط جایزه", "points": "امتیاز لازم", "expires": "مهلت استفاده", "address": "نشانی"}
            copy = "\n".join(f"{label}: {str(showcase.get(key, '')).strip()}" for key, label in labels.items() if str(showcase.get(key, '')).strip())
            form_modules.append(module("اطلاعات دقیق کارت جایزه", copy + "\nفقط مقدار فیلدهای بالا را نمایش بده؛ برچسب‌های خالی، شناسه داخلی جایزه و مقادیر حدسی را ننویس. عکس محصول و لوگوی فروشگاه مرجع واقعی هستند؛ تصویر کارت سه‌بعدی را با حفظ ظاهر و هویت آن‌ها طراحی کن."))
    if image_prompt:
        form_modules.append(module(
            "پرامپت اختصاصی لایهٔ تصویر",
            "این دستور فقط سوژه، رخداد، فضا، اشیا، سبک عکاسی و نورِ خودِ تصویر را کنترل می‌کند و حق تغییر متن‌های قفل‌شده، هدر، لوگو، گرید یا ماژول‌های فرم را ندارد. "
            f"تصویر را دقیقاً بر اساس این توضیح بساز: «{image_prompt}»",
        ))
    if image_reference_instructions and image_mode in {"preserve", "reference"}:
        form_modules.append(module(
            "توضیحات اختصاصیِ تصویر مرجع",
            "این دستور فقط بر نحوهٔ استفاده از خودِ عکس/عکس‌های مرجع اثر می‌گذارد و نباید متن طرح، هدر، تایپوگرافی یا سایر ماژول‌ها را تغییر دهد. "
            f"دستور کنترل‌شده: «{image_reference_instructions}»",
        ))
    if design_presenter_ids and not is_studio_image:
        presenter_labels = [app.VIDEO_ASSET_ENTITIES["presenter"].get(item, item) for item in design_presenter_ids]
        form_modules.append(module(
            "حضور مجری‌های مرجع در تصویر",
            "مجری‌های انتخاب‌شده را به‌صورت طبیعی و مرتبط با موضوع در ترکیب‌بندی قرار بده: " + "، ".join(presenter_labels) + ". "
            "تصاویر PRESENTER IDENTITY فقط قرارداد هویت‌اند: هندسهٔ چهره، سن ظاهری، بافت طبیعی پوست، مو و ویژگی‌های تشخیصی هر شخص را دقیق حفظ کن. "
            "ژست، نگاه، میمیک، حالت دست‌ها، زاویهٔ بدن و لباس می‌تواند متناسب با موضوع و توضیحات تکمیلی تغییر کند، اما هویت شخص هرگز نباید تغییر یا با فرد دیگری ادغام شود.",
        ))
    if template == "morning_local":
        def value(name: str) -> str:
            return str(content.get(name, "")).strip()

        morning_city = "چناران" if value("morningCity") == "chenaran" else "گلبهار"
        morning_title = f"اوقات شرعی و آب و هوای امروز شهرستان {morning_city}"
        date_lines = [item for item in (value("morningWeekday"), value("morningPersianDate"), value("morningGregorianDate"), value("morningHijriDate")) if item]
        prayer_facts = [
            ("اذان صبح", value("morningFajr")), ("طلوع آفتاب", value("morningSunrise")),
            ("اذان ظهر", value("morningNoon")), ("غروب", value("morningSunset")),
            ("اذان مغرب", value("morningMaghrib")), ("نیمه‌شب", value("morningMidnight")),
        ]
        morning_sections = [
            "این نخستین استوری صبحگاهیِ یک رسانهٔ خبری است؛ آن را در سطح یک جلد مجلهٔ ممتاز و اثر قابل‌ارسال به جشنوارهٔ طراحی بساز. بدنه باید مدرن، شاداب، مجله‌ای و دارای کارت‌های شیشه‌ایِ حرفه‌ای باشد؛ نه یک قالب خبری معمولی.",
            f"عنوان اصلی طرح را دقیقاً، بدون بازنویسی، کوتاه‌سازی یا افزودن واژه، این‌گونه بنویس: «{morning_title}». این عنوان باید یک‌بار، خوانا و با سلسله‌مراتب اصلی طرح نمایش داده شود.",
            "اگر تصویر مرجع پیوست شده، از همان تصویر در بدنه استفاده کن و بخش شاخص و زیبای آن را نگه دار. فقط ارتقای کیفیت، نور، رنگ و گسترش طبیعی کادر برای تمام‌صفحه‌شدن مجاز است. ناحیهٔ امن بالا را با رنگ، نور و امتداد طبیعی همان تصویر هماهنگ و بدون متن یا نشان نگه دار.",
        ]
        if value("morningLocation"):
            morning_sections.append(f"روی خود عکس، یک نشان کوچکِ لوکیشن با آیکون مکان و متن دقیق «{value('morningLocation')}» بگذار.")
        if value("morningPhotoCredit"):
            morning_sections.append(f"روی خود عکس، یک نشان کوچکِ دوربین با متن دقیق «{value('morningPhotoCredit')}» بگذار.")
        if date_lines:
            morning_sections.append("یک کارت تاریخِ شیشه‌ایِ خوانا بساز؛ عنوانی مانند «تاریخ» یا «کارت تاریخ» ننویس. این خطوط را با سلسله‌مراتب تایپوگرافیِ درست و دقیقاً بدون تغییر درج کن؛ روز هفته و تاریخ شمسی شاخص‌تر باشند:\n" + "\n".join(f"- {line}" for line in date_lines))
        local_occasion = value("morningLocalOccasion")
        if local_occasion:
            morning_sections.append(occasion_instruction(local_occasion, "در یک کارت مستقل، ظریف و هماهنگ با تاریخ"))
        weather_lines = []
        if value("morningWeatherCondition"):
            weather_lines.append(f"- وضعیت جوی با آیکون سه‌بعدیِ مناسب: «{value('morningWeatherCondition')}»")
        if value("morningMinTemperature"):
            weather_lines.append(f"- مقدار کمینه: «{value('morningMinTemperature')}» با فلش کوچک قرمز رو به پایین")
        if value("morningMaxTemperature"):
            weather_lines.append(f"- مقدار بیشینه: «{value('morningMaxTemperature')}» با فلش کوچک سبز رو به بالا")
        if value("morningWindSpeed"):
            weather_lines.append(f"- سرعت باد: «{value('morningWindSpeed')}» با آیکون باد")
        if value("morningHumidity"):
            weather_lines.append(f"- رطوبت: «{value('morningHumidity')}» با آیکون قطره")
        if value("morningAttire"):
            weather_lines.append(f"- پوشاک پیشنهادی: «{value('morningAttire')}» با آیکون پوشاک")
        if weather_lines:
            morning_sections.append("یک ویجت آب‌وهوای حرفه‌ای و شبیه اپلیکیشن بساز؛ عنوان «آب‌وهوا»، و کلمات «کمینه»، «بیشینه»، «باد» و «رطوبت» را روی طرح ننویس. اعداد کمینه و بیشینه باید بزرگ، شاخص و با آیکون وضعیتِ متناسب با داده‌ها باشند. فقط این داده‌های تأییدشده را استفاده کن:\n" + "\n".join(weather_lines))
        prayer_lines = [f"- {label}: {item}" for label, item in prayer_facts if item]
        if prayer_lines:
            morning_sections.append("یک کارت اوقات شرعیِ شیشه‌ای، منظم و آرام با آیکون‌های ظریف بساز و فقط این ساعت‌ها را دقیقاً بنویس:\n" + "\n".join(prayer_lines))
        riddle_question = value("morningRiddleQuestion")
        if riddle_question:
            game_name = "معمای امروز"
            riddle_hint = value("morningRiddleHint")
            riddle_lines = [f"نام کارت، دقیقاً: «{game_name}»", f"پرسش، دقیقاً: «{riddle_question}»"]
            if riddle_hint:
                riddle_lines.append(f"متن کوچک، دقیقاً: «{riddle_hint}»")
            morning_sections.append("در پایین‌ترین بخش طرح، یک کارت تعامل مستقل، جذاب و قابل‌خواندن بساز. پاسخ یا راهنمای اضافه ننویس.\n" + "\n".join(f"- {line}" for line in riddle_lines))
        local_puzzle_count = len([item for item in record.get("uploadedImages", []) if item.get("role") == "puzzle"])
        if local_puzzle_count:
            morning_sections.append(f"{fa_number(local_puzzle_count)} فایل آخرِ مرجع، ایموجی/تصاویر معمای تصویری هستند، نه عکس پس‌زمینه. زمینهٔ آن‌ها را حذف کن، خودِ اجزا را بدون تغییر معنا، رنگ یا جزئیات نگه دار و در یک کارت مستقل و هنرمندانه بچین. بالای این کارت فقط دقیقاً بنویس: «معمای تصویری». پایین آن فقط و با اندازهٔ کوچک دقیقاً بنویس: «پاسخ معمای امروز را برامون بفرستین.» هیچ کلمهٔ اضافی مانند «کارت»، «ایموجی» یا «آیکون» ننویس.")
        elif value("morningVisualRiddleIdea"):
            morning_sections.append(f"در یک کارت مستقل و هنرمندانه، این معمای تصویریِ پیشنهادی را با عناصر دیداریِ واضح و بدون پاسخ اجرا کن: «{value('morningVisualRiddleIdea')}». بالای کارت فقط دقیقاً بنویس: «معمای تصویری». پایین آن فقط و با اندازهٔ کوچک دقیقاً بنویس: «پاسخ معمای امروز را برامون بفرستین.» هیچ کلمهٔ اضافی مانند «کارت»، «ایموجی»، «آیکون» یا پاسخ معما ننویس.")
        morning_sections.append("هر سه واترمارکِ هویت رسانه باید پراکنده، ظریف و کم‌رنگ روی خودِ عکس اصلی باشند، نه روی کارت‌های اطلاعاتی یا فضای خالی.")
        form_modules.append(module("قالب اختصاصی صبح بخیر محلی", "\n\n".join(morning_sections)))
        if image_mode in {"generate", "preserve", "reference"}:
            form_modules.append(module("نحوهٔ استفاده از تصویر", image_instructions[image_mode]))
    elif template == "morning_kalam":
        def kalam_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        morning_kalam = format_.get("morningKalam") or {}
        today_index = int(morning_kalam.get("todayIndex", 1) or 1)
        holiday_indexes = {int(item) for item in morning_kalam.get("holidayIndexes", []) if str(item).isdigit()}
        week_days = [kalam_value(f"morningKalamDay{index}") for index in range(1, 8)]
        calendar_weekdays = ("شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه")
        calendar_lines = []
        for index, day in enumerate(week_days, start=1):
            if not day:
                continue
            tags = []
            if index == today_index:
                tags.append("امروز؛ بزرگ‌تر و شاخص")
            if index in holiday_indexes:
                tags.append("تعطیل؛ رنگ قرمز")
            calendar_lines.append(f"- {calendar_weekdays[index - 1]}: «{day}»" + (f" ({'، '.join(tags)})" if tags else ""))
        main_photo_count = len([item for item in record.get("uploadedImages", []) if item.get("role") != "puzzle"])
        puzzle_count = len([item for item in record.get("uploadedImages", []) if item.get("role") == "puzzle"])
        kalam_sections = [
            "یک استوری اول صبحِ ملی برای کلام تازه، در سطح ارسال به جشنوارهٔ طراحی بساز: مدرن، جذاب، مجله‌ای، سرزنده و دارای کارت‌های شیشه‌ایِ حرفه‌ای. این قالب خبری عادی نیست؛ حس تقویم روزانه، امید صبح و کشفِ معمای تصویری داشته باشد.",
            "اگر تصویر اصلی مرجع پیوست شده، آن را با حفظ سوژه و محتوای اصلی، فقط با ارتقای کیفیت، نور، رنگ و گسترش طبیعی کادر استفاده کن. بخش شاخص و زیبای عکس را حفظ کن و کارت‌ها را در نواحی دیگر با گرید حرفه‌ای بچین.",
        ]
        if kalam_value("morningKalamLocation"):
            kalam_sections.append(f"روی خود عکس، یک نشان کوچکِ لوکیشن با آیکون مکان و متن دقیق «{kalam_value('morningKalamLocation')}» بگذار.")
        if kalam_value("morningKalamPhotoCredit"):
            kalam_sections.append(f"روی خود عکس، یک نشان کوچکِ دوربین با متن دقیق «{kalam_value('morningKalamPhotoCredit')}» بگذار.")
        week_label = kalam_value("morningKalamWeekLabel")
        if week_label and calendar_lines:
            kalam_sections.append("یک کارت تقویم هفتگیِ شیشه‌ای و چشمگیر بساز. عنوان ماه/سال را دقیقاً بنویس: «%s». این هفت خانه دقیقاً روزهای هفته‌اند و ترتیب‌شان قطعی است: شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه، پنج‌شنبه، جمعه. فقط یکی از این دو چیدمان را انتخاب کن: یک ردیف افقی راست‌به‌چپ که شنبه در راست‌ترین خانه و جمعه در چپ‌ترین خانه باشد؛ یا یک ستون عمودی از بالا به پایین که شنبه در بالا و جمعه در پایین باشد. نام کامل هر روز را دقیقاً همان‌گونه که زیر آمده بنویس؛ هیچ مخفف، حرف تک‌نفره، نام ساختگی، ترتیب دیگر یا روز تکراری نساز. خودِ کلمات راهنما مانند «کارت»، «تقویم»، «امروز» یا «تعطیل» را روی طرح ننویس؛ فقط نام روزها و تاریخ‌های زیر را با وضعیت بصری تعیین‌شده نمایش بده:\n%s" % (week_label, "\n".join(calendar_lines)))
        if kalam_value("morningKalamOccasion"):
            kalam_sections.append(occasion_instruction(kalam_value("morningKalamOccasion"), "در زیر تاریخ‌های هفته و در همان کارت"))
        if puzzle_count:
            kalam_sections.append(f"{fa_number(puzzle_count)} تصویر آخرِ مرجع، فایل‌های ایموجیِ معمای تصویری هستند، نه عکس پس‌زمینه. زمینهٔ آن‌ها را حذف کن، خودِ ایموجی‌ها را بدون تغییر معنا، رنگ یا جزئیات نگه دار و در یک کارت مستقل و هنرمندانه بچین. بالای این کارت فقط دقیقاً بنویس: «معمای تصویری». پایین آن فقط و با اندازهٔ کوچک دقیقاً بنویس: «پاسخ معمای امروز را برامون بفرستین.» هیچ کلمهٔ اضافی مانند «کارت»، «ایموجی» یا «آیکون» ننویس.")
        elif kalam_value("morningVisualRiddleIdea"):
            kalam_sections.append(f"در یک کارت مستقل و هنرمندانه، این معمای تصویریِ پیشنهادی را با عناصر دیداریِ واضح و بدون پاسخ اجرا کن: «{kalam_value('morningVisualRiddleIdea')}». بالای کارت فقط دقیقاً بنویس: «معمای تصویری». پایین آن فقط و با اندازهٔ کوچک دقیقاً بنویس: «پاسخ معمای امروز را برامون بفرستین.» هیچ کلمهٔ اضافی مانند «کارت»، «ایموجی»، «آیکون» یا پاسخ معما ننویس.")
        else:
            kalam_sections.append("برای معمای تصویری، یک کارت خالی و مجله‌ای با فضای کافی بساز؛ بالای آن فقط «معمای تصویری» و پایین آن فقط «پاسخ معمای امروز را برامون بفرستین.» بنویس. ایموجی یا معمای حدسی تولید نکن.")
        kalam_sections.append("سه واترمارک هویت رسانه را پراکنده، ظریف و کم‌رنگ روی خودِ عکس اصلی بگذار؛ روی کارت تقویم یا کارت معما قرار نگیرند.")
        if main_photo_count and image_mode in {"generate", "preserve", "reference"}:
            kalam_sections.append("فقط تصاویر مرجعِ اصلی را برای عکس بدنه در نظر بگیر؛ فایل‌های معمای تصویری را هرگز به‌عنوان عکس پس‌زمینه، کولاژ خبری یا سوژهٔ اصلی استفاده نکن. " + image_instructions[image_mode])
        elif not main_photo_count:
            kalam_sections.append("برای بدنهٔ عکس، تصویر یا سوژهٔ شانسی تولید نکن؛ پالت، نور و بافت را از هویت رنگی رسانه و کارت‌های صبحگاهی بساز.")
        form_modules.append(module("قالب اختصاصی صبح بخیر کلام", "\n\n".join(kalam_sections)))
    elif template == "citizen_message":
        def citizen_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        message_type = citizen.get("messageType", "text")
        citizen_photo_frame = citizen.get("photoFrame", "full")
        citizen_video_frame = citizen.get("videoFrame", "landscape")
        message_text = citizen_value("citizenMessageText")
        message_length = len(message_text)
        bubble_size = "کوتاه و جمع‌وجور" if message_length <= 180 else "متوسط و جادار" if message_length <= 650 else "بزرگ و غالب، با ظرفیت چند پاراگراف"
        citizen_sections = [
            "یک استوری پیام مردمیِ مدرن، قابل‌اعتماد و در سطح یک طراحی مجله‌ای ممتاز بساز؛ نه یک قالب خبری قرمز. پالت اصلی باید فیروزه‌ای/آبی، با تضاد حرفه‌ای، شیشه‌های ظریف، نور کنترل‌شده و جزئیات گرافیکی محدود باشد.",
            f"در بدنه، یک ترکیب‌بندی الهام‌گرفته از صفحهٔ گفت‌وگو بساز؛ بدون لوگوی پیام‌رسان، نام اپ، زمانِ ساختگی، تیک پیام، متن آزمایشی یا حباب‌های تصادفی. یک حباب گفت‌وگوی اصلیِ {bubble_size} با فضای داخلی کاملاً خالی بساز. متن پیام مردمی را روی تصویر ننویس؛ فقط همین فضای خالی را متناسب با طول واقعیِ پیامِ ثبت‌شده ({fa_number(message_length)} نویسه) آماده کن تا تحریریه بعداً متن را دستی و دقیق وارد کند.",
            "در پایین طرح، دقیقاً و با فارسی صحیح این متن ثابت را کوچک، خوانا و در یک ناحیهٔ اطلاع‌رسانیِ آرام بنویس: «کلام تازه، محتوای ارسالی توسط هیچ یک از مخاطبان را تایید یا رد نمی‌کند و انتشار آن صرفاً جهت اطلاع مسئولین است.»",
        ]
        sender_context = citizen_value("senderContext")
        known_city = "گلبهار" if "گلبهار" in sender_context else "چناران" if "چناران" in sender_context else ""
        if known_city:
            citizen_sections.append(f"برای معرفی پیام، فقط در صورت نیاز به یک سطر انتساب، دقیقاً از این عبارت استفاده کن: «مخاطب کلام تازه از {known_city} برایمان نوشت:». هرگز «به گزارش کلام تازه» ننویس و شهر دیگری حدس نزن.")
        else:
            citizen_sections.append("اگر برای معرفی پیام به یک سطر انتساب نیاز بود، فقط یکی از این عبارت‌های طبیعی را به‌کار ببر: «به گفته مخاطب کلام تازه»، «طبق پیام مخاطب کلام تازه» یا «مخاطب کلام تازه در پیامی نوشت:». هرگز «به گزارش کلام تازه» ننویس؛ مکان/شهر را هم بدون تصریح کاربر حدس نزن.")
        headline = citizen_value("citizenHeadline")
        if headline:
            citizen_sections.append(f"تیتر مستقل را خارج از حباب اصلی، با تایپوگرافی شاخص اما محترمانه و دقیقاً بدون تغییر بنویس: «{headline}». خود کلمهٔ «تیتر» را ننویس.")
        response = citizen_value("citizenResponse")
        if response:
            citizen_sections.append(f"یک حباب پاسخ مستقل با سلسله‌مراتب بصری متفاوت و محترمانه بساز و دقیقاً این پاسخ کلام تازه را در آن بنویس: «{response}». هیچ پاسخ یا توضیح دیگری اضافه نکن.")
        interaction = citizen_value("citizenInteraction")
        if interaction:
            citizen_sections.append(f"یک کارت تعامل کوچک و جدا از متن ثابت در پایین طرح بساز و دقیقاً بنویس: «{interaction}».")
        if message_type == "photo":
            citizen_sections.append("این پیام شامل عکس است. " + photo_frame_instructions.get(citizen_photo_frame, photo_frame_instructions["full"]))
            if image_mode == "none":
                citizen_sections.append("عکس یا سوژهٔ شانسی تولید نکن؛ بدنه را با بافت، نور و گرافیک فیروزه‌ایِ حرفه‌ای کامل کن.")
            else:
                citizen_sections.append(image_instructions[image_mode])
        elif message_type == "video":
            ratio = {"landscape": "۱۶:۹ افقی", "square": "۱:۱ مربع", "portrait": "۹:۱۶ عمودی"}.get(citizen_video_frame, "۱۶:۹ افقی")
            citizen_sections.append(f"این پیام شامل فیلم است: یک قاب ویدیوییِ بزرگ، خالی، بدون متن، آیکون پخش یا تصویر فرضی، با نسبت {ratio} بساز. قاب باید بخش مهمی از بدنه باشد و برای جای‌گذاری فیلم در مرحلهٔ بعد فضای کافی داشته باشد.")
            if image_mode != "none":
                citizen_sections.append(f"اگر عکس مرجع پیوست شده، {image_instructions[image_mode]} این تصویر فقط پس‌زمینهٔ بیرون قاب فیلم است و نباید وارد فضای خالی فیلم شود.")
            else:
                citizen_sections.append("بدون عکس مرجع، پس‌زمینه را فقط با پالت فیروزه‌ای، بافت و نور گرافیکی بساز؛ صحنه یا سوژهٔ شانسی تولید نکن.")
        else:
            citizen_sections.append("این پیام فقط متن است؛ هیچ عکس، سوژه یا قاب رسانه‌ای فرضی تولید نکن و تمرکز را روی گفت‌وگوی خالی، تیتر احتمالی و گرافیک فیروزه‌ای نگه دار.")
        form_modules.append(module("قالب اختصاصی کلام مردم", "\n\n".join(citizen_sections)))
    elif template == "sticker":
        kind = {"news": "خبری", "promotion": "تبلیغاتی"}.get(str(content.get("stickerKind", "news")), "خبری")
        sticker_text = str(content.get("stickerText", "")).strip()
        sticker_subtext = str(content.get("stickerSubtext", "")).strip()
        sticker_sections = [
            f"یک استیکر {kind} با لبه‌های تمیز و سیلوئتِ مستقل بساز. متن اصلی را دقیقاً بنویس: «{sticker_text}».",
            "کل بوم مربع PNG باید بیرون از خودِ استیکر واقعاً شفاف باشد؛ پس‌زمینه، مستطیل سفید، رنگ تخت، شطرنجی یا صحنه نساز. سایه فقط اگر وجود دارد، نرم و محدود به اطراف خود استیکر باشد.",
        ]
        if kind == "خبری":
            sticker_sections.append("لحن بصری باید ژورنالیستی، فاخر و تحریریه‌ای باشد؛ شبیه لیبل خبر فوریِ معتبر یا نشان یک پروندهٔ خبری ممتاز، نه استیکر کودکانه، ایموجی، برچسب فروش یا دعوت تبلیغاتی. از یک شکل هندسیِ ساده اما متمایز (نشان نواریِ نامتقارن، پلاک زاویه‌دارِ متعادل یا مُهرِ مدرن) با نسبت‌های دقیق و فضای تنفس کافی استفاده کن. تایپوگرافی فارسی را با وزنِ تیترِ روزنامه‌ایِ جدی، حروف خوش‌خوان، کرنینگ دقیق، شکست خطِ سنجیده و سلسله‌مراتب روشن طراحی کن؛ از فونت فانتزی، حبابی، دست‌نویس، کشیده‌نویسی افراطی، افکت سه‌بعدی، استروک ضخیم و رنگ‌های جیغ دوری کن. نهایتاً یک نشانهٔ خبری انتزاعی و بسیار محدود مجاز است؛ هیچ آیکون کلیشه‌ای یا تزئین اضافه نیاور.")
        if sticker_subtext:
            sticker_sections.append(f"متن تکمیلی را کوچک‌تر و دقیقاً بنویس: «{sticker_subtext}».")
        form_modules.append(module("قالب اختصاصی استیکر شفاف", "\n\n".join(sticker_sections)))
    elif template == "poster":
        def poster_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        purpose_labels = {
            "promotion": "تبلیغ / معرفی",
            "campaign": "کمپین و فراخوان",
            "event": "رویداد و برنامه",
            "media": "معرفی رسانه یا کانال",
            "announcement": "اطلاعیه",
        }
        style_instructions = {
            "modern": "مدرن و مجله‌ای: گرید روشن، عمق ظریف، کنتراست دقیق و تایپوگرافی معاصر.",
            "bold": "جسور و پرانرژی: یک نقطهٔ کانونی قوی، حرکت کنترل‌شده و تضاد بالا؛ اما نه شلوغ یا ارزان.",
            "luxury": "لوکس و مینیمال: فضای تنفس فراوان، متریال و نور کنترل‌شده، جزئیات کم اما دقیق.",
            "local": "گرم و محلی: حس انسانی و اصیل، بدون کلیشه یا نماد مکانِ حدسی.",
            "corporate": "رسمی و سازمانی: گرید منظم، قابل‌اعتماد، واضح و بدون تزئین اضافی.",
        }
        poster_sections = [
            "یک پوستر نهایی و آمادهٔ انتشار بساز؛ این قالب آزاد اما ساختارمند است و باید برای تبلیغ، معرفی رسانه/کانال، کمپین، برنامه یا اطلاعیه قابل استفاده باشد. اثر باید در نگاه اول پیام اصلی را منتقل کند، در اندازهٔ کوچک موبایل خوانا بماند و حس یک آرت‌دایرکشن حرفه‌ای داشته باشد؛ نه فلایر آماده، نه بنر ارزان و نه موکاپ.",
            f"کاربری پوستر: «{purpose_labels.get(poster_value('posterPurpose'), 'تبلیغ / معرفی')}». حال‌وهوای انتخاب‌شده: {style_instructions.get(poster_value('posterStyle'), style_instructions['modern'])}",
        ]
        headline = poster_value("posterHeadline")
        if headline:
            poster_sections.append(f"پیام اصلی و قهرمان پوستر را دقیقاً، بدون تغییر، خلاصه‌سازی یا افزودن واژه بنویس: «{headline}». این بزرگ‌ترین متن طرح است و باید فضای کافی، کنتراست واقعی و شکست سطر آگاهانه داشته باشد.")
        subheadline = poster_value("posterSubheadline")
        if subheadline:
            poster_sections.append(f"زیرپیام را فقط به‌عنوان متن ثانویه و دقیقاً با این رشته بنویس: «{subheadline}». آن را با تیتر اصلی قاطی نکن.")
        body = poster_value("posterBody")
        if body:
            poster_sections.append(f"جزئیات تکمیلیِ تأییدشده را دقیقاً و خوانا بنویس: «{body}». اگر چندخطی است، آن را در یک ناحیهٔ اطلاعاتیِ مستقل با سلسله‌مراتب آرام بچین؛ هیچ تاریخ، مزیت، آدرس، قیمت یا ادعای تازه‌ای نساز.")
        cta = poster_value("posterCta")
        if cta:
            poster_sections.append(f"یک دعوت به اقدامِ مشخص، کوچک‌تر از تیتر و جدا از جزئیات بساز و دقیقاً این متن را بنویس: «{cta}». دکمهٔ جعلی، QR، نشانی یا لینک ساختگی تولید نکن.")
        poster_sections.append("از نماد، چهره، محصول، لوگو، نشانی وب، شماره تماس یا تخفیفِ فرضی استفاده نکن. اگر تصویر مرجع وجود دارد، فقط طبق حالت انتخابی کاربر از آن استفاده کن. سه واترمارک رسانه فقط روی زمینه/تصویر بدنه، ظریف و کم‌رنگ باقی بمانند و وارد متن اصلی نشوند.")
        form_modules.append(module("قالب اختصاصی پوستر حرفه‌ای", "\n\n".join(poster_sections)))
    elif template == "classifieds":
        raw_ads = content.get("classifiedsJson", "[]")
        try:
            parsed_ads = json.loads(raw_ads) if isinstance(raw_ads, str) else raw_ads
        except (TypeError, json.JSONDecodeError):
            parsed_ads = []
        category_meta = {
            "lost_found": ("گمشده / پیدا شده", "ذره‌بین یا برچسبِ پیدا/گم‌شده"),
            "job_seeker": ("جویای کار", "شخص با رزومه یا کیف کوچک"),
            "hiring": ("استخدام", "کیف کاری با نشان کوچکِ افزودن"),
            "services": ("خدمات", "آچار یا ابزار مینیمال"),
            "housing": ("مسکن", "خانهٔ مینیمال"),
            "other": ("سایر", "سنجاق آگهی مینیمال"),
        }
        ads: list[dict[str, str]] = []
        if isinstance(parsed_ads, list):
            for item in parsed_ads[:4]:
                if not isinstance(item, dict):
                    continue
                category = str(item.get("category") or "other")
                ads.append({
                    "category": category if category in category_meta else "other",
                    "title": str(item.get("title") or "").strip()[:56],
                    "body": str(item.get("body") or "").strip()[:220],
                    "contact": str(item.get("contact") or "").strip()[:96],
                })
        classified_sections = [
            "یک صفحهٔ نیازمندیِ فارسی با روح روزنامهٔ حرفه‌ای و امروزی بساز؛ کاغذ، خط‌کشی بسیار ظریف، گرید منظم، سلسله‌مراتب واضح و حس معتبر داشته باشد، نه روزنامهٔ کهنه، شلوغ یا کپی‌شده. ناحیهٔ امن بالای رسانه را خالی و پیوسته با زمینه نگه دار.",
            f"دقیقاً {fa_number(len(ads))} آگهیِ واقعی زیر را نمایش بده؛ نه آگهی خالی، نه کارت نمونه، نه ستون اضافی و نه متن فرضی. اگر فقط یک آگهی داریم، همان یک آگهی باید با کیفیت و فضای کافی طراحی شود؛ اگر دو تا چهار آگهی داریم، گرید را متناسب با همان تعداد تنظیم کن.",
            "هر آگهی یک کادر مستقل، بسته و کاملاً جدا با مرز/خط ظریف خودش دارد. متن، راه تماس، آیکون یا رنگ هیچ آگهی نباید وارد کادر آگهی دیگر شود. تیتر هر آگهی از متن آن بزرگ‌تر باشد، راه تماس در پایین همان کادر بماند و یک آیکون کوچکِ مرتبط فقط به همان آگهی تعلق داشته باشد. هیچ شماره، راه تماس، عنوان یا آیکون حدسی اضافه نکن.",
        ]
        for index, ad in enumerate(ads, start=1):
            category_label, icon = category_meta[ad["category"]]
            classified_sections.append(
                f"آگهی {fa_number(index)} — دسته: «{category_label}»؛ آیکون مجاز: {icon}. "
                f"تیتر را دقیقاً بنویس: «{ad['title']}». "
                f"متن را دقیقاً بنویس: «{ad['body']}». "
                f"راه ارتباطی را دقیقاً و در پایینِ همان کادر بنویس: «{ad['contact']}»."
            )
        classified_sections.append("پالت روزنامه‌ایِ گرم، خاکستری-کرم و مشکیِ خوانا داشته باش و فقط برای هر دسته یک تأکید رنگی بسیار محدود استفاده کن. تصویر، چهره، آگهی، شماره تلفن، QR، قیمت، لوگو یا نشانی ساختگی تولید نکن. سه واترمارک رسانه را بسیار ظریف و دور از متن آگهی‌ها، فقط در بافت پس‌زمینه قرار بده.")
        form_modules.append(module("قالب اختصاصی آگهی نیازمندی‌ها", "\n\n".join(classified_sections)))
    elif template == "market":
        def market_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        rates = (
            ("دلار", "marketUsdPrice", "marketUsdChange", "تومان"),
            ("یورو", "marketEurPrice", "marketEurChange", "تومان"),
            ("تمام سکه", "marketCoinPrice", "marketCoinChange", "تومان"),
            ("طلای ۱۸ عیار", "marketGold18Price", "marketGold18Change", "تومان"),
            ("بیت‌کوین", "marketBitcoinPrice", "marketBitcoinChange", "دلار آمریکا"),
        )
        date_lines = [item for item in (market_value("marketWeekday"), market_value("marketPersianDate"), market_value("marketGregorianDate"), market_value("marketHijriDate")) if item]
        market_sections = [
            "یک استوری قیمت روز طلا و ارز در سطح یک مجلهٔ اقتصادی ممتاز بساز؛ ظاهر، گرید و آیکون‌ها اختصاصیِ بازار باشند، نه قالب خبر. پالت پایه طلاییِ لوکس، ذغالی تیره و سفید گرم باشد؛ نور کنترل‌شده، شیشه‌های ظریف، بافت فلزی بسیار محدود و فضای تنفس حرفه‌ای داشته باش. از نمودار بورسِ ساختگی، اعداد تصادفی، لوگوی صرافی یا صفحهٔ تریدینگ اجتناب کن.",
            "در بالا یک عنوان شاخص و دقیقاً با فارسی صحیح بنویس: «قیمت روز طلا و ارز». زیر آن تاریخ و زمان را در یک ناحیهٔ ظریف و قابل اسکن درج کن. این داده‌ها را دقیقاً و بدون تغییر بنویس:\n" + "\n".join(f"- {line}" for line in date_lines + ([f"ساعت دریافت: {market_value('marketTime')}" ] if market_value("marketTime") else [])),
            "پنج ویجت نرخ هم‌اندازه اما با هویت آیکونی متفاوت بساز: دلار، یورو، تمام سکه، طلای ۱۸ عیار و بیت‌کوین. هر ویجت باید نام، مبلغ و واحدِ مشخص‌شده را با سلسله‌مراتب خوانای فارسی داشته باشد. هیچ قیمت یا واحدی را حدس نزن و هیچ مورد دیگری به این پنج‌گانه اضافه نکن.",
        ]
        for label, price_key, change_key, unit in rates:
            price = market_value(price_key)
            change = market_value(change_key)
            if not price:
                continue
            rate_line = f"- {label}: مبلغ دقیق «{price} {unit}»"
            if change:
                stripped_change = change.strip().replace("−", "-")
                if stripped_change.startswith("-"):
                    rate_line += f"؛ تغییر ۲۴ساعته دقیق «{change}٪» با فلش کوچک مینیمال قرمز رو به پایین"
                elif stripped_change.startswith("+"):
                    rate_line += f"؛ تغییر ۲۴ساعته دقیق «{change}٪» با فلش کوچک مینیمال سبز رو به بالا"
                else:
                    rate_line += f"؛ تغییر ۲۴ساعته دقیق «{change}٪» با خط افقی مینیمال و رنگ خنثی"
            else:
                rate_line += "؛ هنوز تغییر ۲۴ساعتهٔ تأییدشده نداریم: فلش، درصد، صفر یا برچسب جایگزین نساز"
            market_sections.append(rate_line)
        if market_value("marketSource"):
            market_sections.append(f"در پایین طرح، یک نشان کوچک و محدودِ منبع/زمان بساز و دقیقاً بنویس: «منبع: {market_value('marketSource')}»؛ این نشان فقط به اندازهٔ متن خودش باشد.")
        market_sections.append("روی عکس یا بافتِ اصلیِ بدنه، نه روی ویجت‌ها، سه واترمارک پراکنده، ظریف و کم‌رنگ از آیدی رسانه قرار بده. تصویر خبری، آدم، پولِ واقعی، اسکناس، سکه یا سوژهٔ تصادفی تولید نکن؛ گرافیک بازار باید انتزاعی، حرفه‌ای و در خدمت داده‌های تأییدشده بماند.")
        form_modules.append(module("قالب اختصاصی قیمت روز طلا و ارز", "\n\n".join(market_sections)))
    elif template == "sport":
        def sport_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        mode = sport_value("sportMode")
        mode_label = {"result": "اعلام نتیجه", "league": "نتایج هفتهٔ لیگ", "upcoming": "بازی‌های مهم پیش رو", "news": "خبر ورزشی یا رقابت محلی"}.get(mode, "محتوای ورزشی")
        sport_sections = [
            f"یک استوری ورزشی مدرن، سریع و حرفه‌ای برای «{mode_label}» بساز. گرید نتیجه/برنامه باید بسیار خوانا، پرانرژی و مناسب موبایل باشد؛ از اسکوربورد خیالی، آمار حدسی، لوگوی جعلی تیم یا جام/مدالِ بی‌ربط پرهیز کن.",
        ]
        if sport_value("title"):
            sport_sections.append(f"تیتر را دقیقاً بدون تغییر بنویس: «{sport_value('title')}». هیچ برچسب «تیتر» اضافه نکن.")
        if sport_value("sportResults"):
            sport_sections.append(f"این داده‌های ورزشی تأییدشده را دقیقاً، خط‌به‌خط و بدون تغییر در کارت‌ها/ردیف‌های حرفه‌ای نمایش بده:\n{sport_value('sportResults')}")
        else:
            sport_sections.append("دادهٔ نتیجه یا برنامه وارد نشده است؛ عدد، نتیجه، رتبه، تیم یا نام ورزشکار حدس نزن و فقط یک ترکیب‌بندی بصری مرتبط و جای خالیِ خوانا آماده کن.")
        if sport_value("sportSource"):
            sport_sections.append(f"منبع داده را کوچک و دقیقاً چنین بنویس: «منبع: {sport_value('sportSource')}».")
        form_modules.append(module("قالب اختصاصی استوری ورزشی", "\n\n".join(sport_sections)))
    elif template == "infographic":
        def infographic_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        info_sections = ["یک اینفوگرافی مستقل، حرفه‌ای، قابل‌اسکن و مناسب استوری/پست بساز؛ با گرید روشن، آیکون‌های محدود و دقیق و سلسله‌مراتب دادهٔ واضح. نمودار، عدد یا واقعیتی که در داده‌های کاربر نیست نساز."]
        for label, key in (("روتیتر", "kicker"), ("تیتر", "title"), ("زیرتیتر", "subtitle")):
            if infographic_value(key):
                info_sections.append(f"{label} را دقیقاً و بدون تغییر بنویس: «{infographic_value(key)}».")
        if infographic_value("dataPoints"):
            info_sections.append(f"داده‌های تأییدشده را هر مورد در یک عنصر بصری مستقل و دقیق نمایش بده:\n{infographic_value('dataPoints')}")
        if infographic_value("source"):
            info_sections.append(f"در پایین یک نشان کوچک فقط به اندازهٔ متن منبع بنویس: «منبع: {infographic_value('source')}».")
        form_modules.append(module("قالب اختصاصی اینفوگرافی", "\n\n".join(info_sections)))
    elif template in {"night", "home_tip"}:
        def lifestyle_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        if template == "night":
            kind = {"film": "فیلم", "series": "سریال", "album": "آلبوم موسیقی", "book": "کتاب"}.get(lifestyle_value("nightKind"), "اثر فرهنگی")
            sections = [f"یک استوری شبانهٔ ممتاز برای معرفی {kind} بساز: بنفش عمیق و مشکیِ کنترل‌شده، حس فرهنگی/سینمایی، مدرن و دور از کلیشهٔ نئون یا پوستر تقلیدی."]
        else:
            sections = ["یک استوری ترفند خانه‌داریِ روشن، تمیز، گرم و کاربردی با حس مجلهٔ سبک زندگی بساز. از ادعاهای درمانی، خطرناک یا مواد/نتایج ساختگی پرهیز کن."]
        if lifestyle_value("title"):
            sections.append(f"عنوان را دقیقاً و بدون تغییر بنویس: «{lifestyle_value('title')}».")
        if lifestyle_value("caption"):
            sections.append(f"توضیح کوتاه را دقیقاً و بدون تغییر بنویس: «{lifestyle_value('caption')}».")
        form_modules.append(module("قالب اختصاصی شبانه / خانه‌داری", "\n\n".join(sections)))
    elif template == "editorial_note":
        def note_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        note_title = note_value("title")
        note_body = note_value("caption")
        note_author = note_value("source")
        note_style = note_value("editorialNoteStyle") or "auto"
        body_words = len(note_body.split())
        style_instruction = {
            "modern_statement": "این یک حرف/یادداشت مدرن است: ترکیب‌بندی معاصر، جسور اما آرام، با فضای منفیِ هوشمند و تایپوگرافیِ تحریریه‌ای داشته باشد. آن را به کاغذ، نامه، دفتر، دست‌نوشته یا بافت کاغذی تبدیل نکن.",
            "personal_message": "این یک پیام مستقیم و انسانی است: صمیمیتِ کنترل‌شده، حضور رسانه‌ای معتبر و گرید مینیمال داشته باشد. از قاب نامه، کاغذ، قلم، دفتر یا تزئینات نوستالژیک استفاده نکن.",
            "progress_report": "این یک گزارش عملکرد یا بازدید صفحه است: ظاهر داشبورد رسانه‌ایِ مدرن، دقیق و قابل‌اعتماد با گرید دیجیتال و سلسله‌مراتب داده داشته باشد. آن را به کاغذ، نامه، دفتر، دست‌نوشته یا بافت کاغذی تبدیل نکن. اگر اسکرین‌شات مرجع وجود دارد، همان اسکرین‌شات سند اصلی طرح است؛ نمودار، عدد، رابط کاربری یا آماری خارج از آن نساز.",
            "auto": "حالت بصری را از متن و تصویر مرجع تشخیص بده: می‌تواند یک حرف مدرن، پیام انسانی یا گزارش عملکرد باشد. هرگز به‌صورت پیش‌فرض از کاغذ، نامه، دفتر، دست‌نوشته یا بافت کاغذی استفاده نکن؛ این عناصر فقط وقتی مجازند که کاربر صریحاً درخواست کرده باشد.",
        }.get(note_style, "حالت بصری مدرن و رسانه‌ای باشد؛ از تم کاغذی یا نامه‌ای پیش‌فرض استفاده نکن.")
        note_sections = [
            "یک یادداشت سردبیر/ادمین برای اینستاگرام بساز؛ ظاهر آن بسیار حرفه‌ای، رسانه‌ای، امروزی و متناسب با هدف کاربر باشد، نه خبر فوری، پوستر تبلیغاتی یا نقل‌قول انگیزشی. هویت رنگی رسانه را با زمینهٔ روشن یا تیره، نور کنترل‌شده، گرید مجله‌ای/دیجیتال و رنگ برندِ تأکیدی به‌کار ببر؛ کل صفحه را با یک رنگ سنگین و یکنواخت پُر نکن.",
            style_instruction,
        ]
        if note_title:
            note_sections.append(f"عنوان یادداشت را دقیقاً، بدون هیچ اصلاح، حذف یا افزودن، به‌عنوان قهرمان بصری طرح بنویس: «{note_title}». فارسی آن باید در نمای کوچک کاملاً خوانا باشد و حداکثر دو رنگ داشته باشد. هیچ برچسبی مثل «یادداشت»، «تیتر» یا «سردبیر می‌نویسد» کنار آن ننویس.")
        if note_body:
            if body_words <= 34 and "\n" not in note_body:
                note_sections.append(f"متن یادداشت کوتاه است؛ آن را دقیقاً و خوانا {'به‌عنوان قهرمان اصلی طرح' if not note_title else 'با سلسله‌مراتب پایین‌تر از عنوان'} بنویس: «{note_body}». قرارداد انحصاری: هیچ پنل، باکس یا فضای نوشتنِ خالیِ دیگری برای متن یادداشت نساز.")
            else:
                note_sections.append(f"متن یادداشت طولانی است ({fa_number(body_words)} واژه). قرارداد انحصاری: یک فضای نوشتنِ خالی، بزرگ، تمیز و متناسب با چند پاراگراف در بدنه بساز، اما حتی یک واژه، خلاصه، نقل‌قول، عدد، متن آزمایشی یا خط نمایشی از این متن را روی طرح ننویس. تحریریه متن دقیق را بعداً دستی اضافه می‌کند.")
        if note_author:
            note_sections.append(f"در انتهای یادداشت، یک امضای کوچک و محترمانه، دقیقاً به این شکل بنویس: «{note_author}». آن را منبع خبر یا آیدی شبکه اجتماعی نشان نده.")
        if image_mode == "preserve":
            note_sections.append("تصویر/اسکرین‌شات مرجع یک سند قفل‌شده و جزء اصلی طرح است: خودِ پیکسل‌ها، چهره‌ها، متن‌ها، نمودارها، رابط کاربری، آمار، رنگ‌ها، لوگوهای درون تصویر و معنای آن را دقیقاً حفظ کن. بازسازی، زیباسازیِ مولد، روتوش چهره، تغییر چهره/بدن، تبدیل اسکرین‌شات به رابط خیالی، حذف یا افزودن جزئیات، جایگزینی داده یا تولید تصویر مشابه ممنوع است. فقط جای‌گذاری متناسب، بزرگ/کوچک‌کردنِ نسبی و در صورت ضرورت امتدادِ کاملاً خنثیِ بیرون قاب مجاز است. تصویر مرجع باید واقعاً در خروجی نهایی دیده شود، نه صرفاً الهام آن.")
        elif image_mode in {"generate", "reference"}:
            note_sections.append("در صورت وجود تصویر مرجع، آن باید بخش اصلی یا مکملِ معنادار طرح باشد و خوانایی متن را مختل نکند. " + image_instructions[image_mode])
        else:
            note_sections.append("بدون عکس مرجع، از تصویر، چهره، لوگو یا سوژهٔ تصادفی استفاده نکن؛ با رنگ برند، بافت کنترل‌شده، نور و گرافیک تحریریه‌ایِ ظریف طرح را کامل کن.")
        note_sections.append("سه واترمارک هویت رسانه را فقط روی بافت/تصویر بدنه، بسیار ظریف و کم‌رنگ بگذار؛ هرگز روی تیتر، پنل یادداشت یا امضا قرار نگیرند.")
        form_modules.append(module("قالب اختصاصی یادداشت سردبیر / ادمین", "\n\n".join(note_sections)))
    elif template == "occasion_greeting":
        def occasion_value(name: str) -> str:
            return str(content.get(name, "")).strip()

        tone = occasion_value("occasionTone")
        category = occasion_value("occasionCategory")
        name = occasion_value("occasionName")
        date = occasion_value("occasionDate")
        headline = occasion_value("occasionHeadline")
        message = occasion_value("occasionMessage")
        signature = occasion_value("occasionSignature")
        tone_label = "تبریک" if tone == "congratulation" else "تسلیت"
        category_label = {
            "religious": "مذهبی", "national": "ملی", "global": "جهانی", "public": "عمومی / اجتماعی", "cultural": "فرهنگی / هنری", "custom": "سایر",
        }.get(category, "عمومی")
        occasion_sections = [
            f"این یک طرح {tone_label} برای مناسبت {category_label} است؛ لحن، نور، بافت، عناصر بصری و شدت رنگ باید دقیقاً با همین حس هماهنگ باشد. طراحی فاخر، مدرن، مجله‌ای و محترمانه باشد، نه کارت آماده، پوستر کلیشه‌ای یا طرح تبلیغاتی ارزان.",
        ]
        if name:
            occasion_sections.append(f"مناسبت/مناسبت‌های انتخاب‌شده را دقیقاً و بدون تغییر در سلسله‌مراتب مناسب بنویس: «{name}». هیچ نام شخصیت، نماد یا رویداد دیگری را حدس نزن.")
        if headline:
            occasion_sections.append(f"عنوان اصلی و قهرمان تایپوگرافی را دقیقاً و بدون هیچ تغییر بنویس: «{headline}». این عبارت باید بزرگ، برجسته و نخستین نقطهٔ خوانش طرح باشد.")
        if date:
            occasion_sections.append(f"این عبارت تکمیلی را فقط یک‌بار، کوچک‌تر و دقیقاً بدون تغییر در گرید مناسب بنویس: «{date}».")
        if message:
            message_words = len(message.split())
            if message_words <= 28:
                occasion_sections.append(f"پیام کوتاه را دقیقاً و بدون تغییر، خوانا و پایین‌تر از عبارت اصلی بنویس: «{message}».")
            else:
                occasion_sections.append(f"پیام کاربر طولانی است ({fa_number(message_words)} واژه). یک فضای نوشتنِ خالی، بزرگ، حرفه‌ای و متناسب با چند خط متن در بدنه رزرو کن؛ متن، لورم‌ایپسوم، خط‌های نمایشی یا نسخهٔ خلاصه‌شدهٔ پیام را ننویس تا تحریریه آن را بعداً دقیقاً اضافه کند.")
        if signature:
            occasion_sections.append(f"پایین طرح یک امضای کوچک، آرام و دقیقاً با این عبارت بنویس: «{signature}». این امضا باید از عنوان و پیام کوچک‌تر باشد و با واترمارک اشتباه نشود.")
        if tone == "condolence":
            occasion_sections.append("فضا آرام، باوقار و همدلانه باشد؛ از چهرهٔ ساختگی، تصویر فرد، صحنهٔ سوگواری، شمع، گل یا نماد مذهبی/ملیِ حدسی استفاده نکن. تنها در صورت وجود عکس مرجع، همان عکس با حفظ معنا می‌تواند مبنای تصویر باشد.")
        else:
            occasion_sections.append("فضا باوقار، روشن و امیدوار باشد؛ از بادکنک، کاغذرنگی، کیک، هدیه، پرچم، شخصیت یا نماد حدسی و کودکانه استفاده نکن، مگر آن‌که از عکس مرجع یا توضیحات تکمیلی کاربر صراحتاً برآید.")
        occasion_sections.append("سه واترمارک هویت رسانه را فقط روی بافت یا عکس بدنه، بسیار ظریف و کم‌رنگ بگذار؛ هرگز روی متن اصلی یا فضای نوشتن قرار نگیرند.")
        form_modules.append(module("قالب اختصاصی تبریک / تسلیت مناسبت‌ها", "\n\n".join(occasion_sections)))
    elif template == "studio" or is_studio_image:
        sections = app.studio_image_prompt_sections(studio)
        if hasattr(app, "studio_image_reference_contract"):
            sections.append(app.studio_image_reference_contract(request))
        form_modules.append(module("ساختار اختصاصی تصویر استودیو", "\n\n".join(item for item in sections if item)))
    elif is_news:
        caption_value = str(approved_copy.get("caption") or "").strip()
        caption_words = len(re.findall(r"\S+", caption_value))
        caption_is_long = caption_words > 55 or len(caption_value) > 360
        caption_panel_instruction = (
            "تیتر و عکس خبری، به‌علاوه یک پنل شیشه‌ایِ کاملاً خالی برای افزودن کپشن در مرحلهٔ بعد. "
            + ("کپشن تأییدشده طولانی است؛ بخش تصویر را جمع‌وجورتر نگه دار و پنل خالیِ بزرگ و غالب برای متن چندپاراگرافی بساز. " if caption_is_long else "کپشن تأییدشده کوتاه است؛ یک پنل خالی متناسب و خوانا در نیمهٔ پایین بساز. ")
            + "متن کپشن را فقط برای درک موضوع و اندازهٔ فضا بخوان؛ حتی یک کلمه از آن را در طرح ننویس. داخل پنل هیچ متن، عدد، آیکون یا متن آزمایشی ننویس."
        )
        if is_series_slide and slide_index > 1 and (caption_value or any(key == "caption" for key, _ in series_blank_fields)):
            form_modules.append(module("فضای کپشنِ قطعی این اسلاید", "این اسلاید، صفحهٔ ادامهٔ متنِ سری است. متن کپشنِ داده‌شده را فقط برای درک موضوع، تعداد سطرها و اندازهٔ فضای لازم بخوان؛ آن را، خلاصه‌اش، تیتر جایگزین یا هیچ نوشته‌ای را داخل تصویر ننویس. یک فضای خالیِ واقعی، بزرگ، آرام و متناسب با متن چندسطره در بدنه بساز. این فضا می‌تواند با نور، بافت و گرید طبیعی صحنه تعریف شود، اما باکس توخالی، خط‌کشی، کادر، رنگ جدا، برچسب، آیکون، لورم‌ایپسوم یا متن آزمایشی نداشته باشد. تیتر و تصویر را طوری بچین که وارد این فضای رزروشده نشوند.\n\nمتن کپشنِ فقط برای محاسبهٔ فضا (روی تصویر ننویس):\n«%s»" % series_caption_context))
        else:
            form_modules.append(module("نوع خروجی انتخاب‌شده", {
                "title_photo": "تیتر و عکس خبری؛ هیچ پنل خالی برای کپشن نساز.",
                "title_photo_caption": caption_panel_instruction,
                "title_only": "فقط تیتر؛ هیچ عکس خبری، قاب عکس یا سوژهٔ تصویری مستقل نساز.",
            }[output_kind]))
        form_modules.append(module("صفحه‌بندی انتخاب‌شده", layout_instructions[layout]))
        if template == "news_post":
            form_modules.append(module("استاندارد اختصاصی پست خبری ۴:۵", "این خروجی برای فید اینستاگرام است، نه برش استوری. گرید ۴:۵ را با نقطهٔ کانونی قوی، حاشیهٔ امن واقعی و خوانایی عالی در نمای کوچک فید طراحی کن. حتی با عکس تمام‌صفحه، جای انتخاب‌شدهٔ تیتر (بالا، وسط یا پایین) باید آگاهانه در خود عکس ساخته شود و رنگ/نور/بافتِ پشت متن تضاد لازم را فراهم کند. تیتر را جذاب و متنوع بچین: می‌توانی فقط یک واژهٔ مهم را بزرگ‌تر یا رنگی کنی، زیر یک بخش خط بکشی یا یک تأکید رنگی محدود بسازی، اما از نوار تیترِ تکراری، شلوغی و پوشاندن سوژهٔ مهم بپرهیز.\n\nناحیهٔ بالای کادر باید امتداد پیوسته و طبیعی همان عکس/صحنه تا لبهٔ بوم باشد و برای مرحلهٔ هویت‌گذاری نهایی، از سوژهٔ مهم و هر نوع متن یا نشان خالی بماند. آن را سفید، تخت، تک‌رنگ، نواری، کارتی، قاب‌دار یا جدا از عکس نساز. منبع و تعامل در صورت وجود، کوچک و در گرید مستقل باقی بمانند."))
        if has_news_photo:
            form_modules.append(module("ابعاد عکس خبر در بدنه", photo_frame_instructions[photo_frame]))
            # Crucially, this module is absent for title-only and video work.
            form_modules.append(module("نحوهٔ استفاده از عکس خبر", image_instructions[image_mode]))
            form_modules.append(module("جای‌گذاری واترمارک", f"هر سه واترمارک «{brand_watermark}» باید واقعاً روی خودِ عکس خبری قرار بگیرند؛ حتی اگر عکس در قاب مربع یا افقیِ جداست. هیچ‌کدام را فقط روی زمینه، پنل متن یا فضای بیرونِ قاب عکس قرار نده. واترمارک‌ها ظریف، کم‌رنگ و پراکنده بمانند اما مرزهای عکس را ترک نکنند."))
            if template == "news_post" and image_mode == "preserve" and photo_frame in {"square", "landscape", "portrait_3_4"}:
                form_modules.append(module("ادامهٔ عکس مرجع تا ناحیهٔ امن بالا", "عکس مرجعِ اصلی را در قاب انتخاب‌شده دقیقاً حفظ کن؛ لبه‌های همان عکس را به‌صورت طبیعی و واقع‌گرایانه به سمت بالا گسترش بده (outpaint/extend) تا رنگ، نور، بافت و محیط همان عکس تا لبهٔ بالایی بوم ادامه یابد. ناحیهٔ بالا را بدون متن، لوگو، خط یا عنصر مهم نگه دار. اگر بالای عکس فضای خالی ندارد، امتداد طبیعی محیط/پس‌زمینه را بساز، ولی سوژه، چهره، لباس، مکان و محتوای اصلی عکس را تغییر نده. هرگونه پس‌زمینهٔ سفید، نوار سفید، کارت رنگی، قاب جدا یا قطع‌شدن عکس ممنوع است."))
            ai_photo_notice = {
                "generate": "عکس این خبر توسط هوش مصنوعی تولید شده است.",
                "reference": "عکس این خبر توسط هوش مصنوعی ویرایش شده است.",
            }.get(image_mode)
            if ai_photo_notice:
                form_modules.append(module("اعلام بسیار ریز دربارهٔ عکس", f"در نیمهٔ پایین طرح، هم‌خط با نشان منبع و در سمت مقابل آن، دقیقاً این عبارت را بنویس: «{ai_photo_notice}» این نوشته یک اطلاع‌رسانی ثانویه است: آن را بسیار کوچک‌تر از منبع، تعامل، روتیتر و هر متن محتوایی دیگر، ظریف، کم‌رنگ اما خوانا قرار بده. هرگز آن را در باکس، کارت، نشان برجسته یا نزدیک تیتر نگذار؛ نباید با تیتر، پنل کپشن یا کارت تعامل تداخل داشته باشد."))
        if video_overlay:
            form_modules.append(module("فضای ویدیو", video_instruction))
            if image_mode == "none":
                form_modules.append(module("پس‌زمینهٔ قالب ویدیو", "هیچ عکس، صحنه یا سوژهٔ شانسی تولید نکن. پس‌زمینه را فقط با رنگ‌ها، نور، بافت و حس بصری هویت رسانه بساز؛ ناحیهٔ امن بالا را بدون نوشته یا نشان نگه دار و لوگوی تازه یا تصویر خبری فرضی نساز."))
            else:
                blur = "عکس زمینه را به‌طور محسوس اما حرفه‌ای محو کن تا ویدیو جدا بماند." if video_background_blur else "عکس زمینه را خوانا و طبیعی نگه دار."
                form_modules.append(module("پس‌زمینهٔ قالب ویدیو", f"{image_instructions[image_mode]} این تصویر فقط پس‌زمینهٔ پشت پنجرهٔ ویدیو است و نباید وارد فضای خالی ویدیو شود. {blur}"))
        if site_link_placeholder:
            form_modules.append(module("محل استیکر لینک سایت", "یک دعوت به اقدام ظریف و مجله‌ای، هماهنگ با گرید انتخاب‌شده طراحی کن. در یک ناحیهٔ خلوت و دارای تضادِ کافی ــ دور از تیتر، منبع، کارت تعامل و در صورت وجود فضای ویدیو ــ یک جای خالیِ افقی با اندازهٔ مناسب برای چسباندن دستیِ استیکر لینک اینستاگرام رزرو کن. این فضا باید در ترکیب‌بندی طبیعی به نظر برسد و متن/آیکون دیگری داخل آن قرار نگیرد. خودِ استیکر، URL، QR، دکمه یا لینک جعلی نساز. بالای آن یا در نزدیک‌ترین سمتِ مناسب، با اندازهٔ کوچک و فارسی درست، دقیقاً بنویس: «جزئیات بیشتر در سایت کلام تازه 👇». جهت اشارهٔ ایموجی باید به محل خالیِ استیکر باشد."))
    else:
        # Non-news templates still receive only the active image behaviour;
        # "none" deliberately has no reference-photo instruction.
        if template == "poster" and image_mode in {"generate", "preserve", "reference"}:
            form_modules.append(module("نحوهٔ استفاده از تصویر پوستر", {
                "generate": "یک تصویر/فضای بصریِ اصیل و کاملاً متناسب با پیام پوستر تولید کن؛ محصول، چهره، نشان یا اطلاعاتی که در فرم نیست نساز.",
                "preserve": "تصویرهای پیوست‌شده داراییِ قطعی پوستر هستند؛ سوژه و محتوای آن‌ها را دقیقاً حفظ کن و فقط نور، کیفیت، برش و ادغام حرفه‌ای مجاز است.",
                "reference": "تصویرهای پیوست‌شده داراییِ قفل‌شدهٔ پوسترند؛ داخل آن‌ها را تغییر نده و فقط در بیرون لبه‌ها برای هماهنگی با بوم گسترش طبیعی انجام بده. دارایی، لوگو یا اطلاعات فرضی اضافه نکن.",
            }[image_mode]))
        elif template == "classifieds" and image_mode in {"generate", "preserve", "reference"}:
            form_modules.append(module("تصویر زمینهٔ نیازمندی‌ها", "تصویر مرجع، در صورت وجود، فقط یک بافت یا جزئیاتِ ثانویهٔ بسیار آرام برای حاشیهٔ صفحه است. کادرهای آگهی و متن‌هایشان اولویت مطلق‌اند؛ تصویر نباید وارد کادرها شود، خوانایی را کم کند یا آگهی/نماد دیگری بسازد."))
        elif image_mode in {"generate", "preserve", "reference"}:
            form_modules.append(module("نحوهٔ استفاده از تصویر", image_instructions[image_mode]))
        elif image_mode == "none":
            form_modules.append(module("تصویر مرجع", "هیچ تصویر مرجع یا لوگوی دیگری وجود ندارد؛ طرح را فقط با عناصر متناسب با قالب کامل کن."))

    copy_modules: list[str] = []
    if is_news:
        if approved_copy.get("kicker"):
            copy_modules.append("روتیتر را کوچک، دقیق و مکمل تیتر اصلی بنویس: «%s»." % approved_copy["kicker"])
        if approved_copy.get("title"):
            copy_modules.append("متن تیتر اصلی را دقیقاً و بدون تغییر بنویس: «%s». تیتر باید بزرگ‌ترین و شاخص‌ترین متنِ بدنه باشد، با وزن و اندازهٔ کافی برای خوانایی فوری در نمای کوچک؛ آن را ریز، هم‌وزن متن‌های فرعی یا فشرده نساز." % approved_copy["title"])
        if approved_copy.get("subtitle"):
            copy_modules.append("زیرتیتر را فقط به‌صورت متن ثانویه و در صورت حفظ خوانایی بنویس: «%s»." % approved_copy["subtitle"])
        if approved_copy.get("source"):
            copy_modules.append("منبع را در یک نشان کوچک شیشه‌ای در پایینِ سمت چپ و بالای کارت تعامل بنویس، دقیقاً به این صورت: «منبع: %s». نشان منبع فقط به اندازهٔ متن خودش باشد." % approved_copy["source"])
        if approved_copy.get("interactionText"):
            copy_modules.append("متن تعامل را در کارت تعاملِ جذابِ پایین طرح، جدا از نشان منبع، دقیقاً این‌گونه بنویس: «%s»." % approved_copy["interactionText"])
    elif approved_copy and template not in {"morning_local", "morning_kalam", "market", "citizen_message", "editorial_note", "occasion_greeting", "poster", "classifieds"}:
        # Other templates have different schemas (weather, prices, prayers,
        # riddles, etc.); retain every entered value without inventing a news
        # hierarchy for them.
        copy_modules.append("داده‌های تأییدشدهٔ این قالب را دقیقاً و فقط در جای مناسب طراحی استفاده کن:\n" + json.dumps(approved_copy, ensure_ascii=False, indent=2))

    if copy_modules:
        form_modules.append(module("متن‌های تأییدشدهٔ فرم", "\n".join(f"- {item}" for item in copy_modules)))
    if is_series_slide:
        if series_blank_fields:
            field_labels = {"title": "عنوان", "subtitle": "زیرتیتر", "caption": "بدنه", "interactionText": "پاورقی/تعامل", "source": "امضا", "citizenMessageText": "متن پیام", "citizenHeadline": "عنوان", "citizenResponse": "پاسخ", "citizenInteraction": "تعامل"}
            blank_lines = "، ".join(f"{field_labels.get(key, key)} ({fa_number(length)} نویسه)" for key, length in series_blank_fields)
            form_modules.append(module("فضای خالیِ متن بلند در اسلاید", f"برای این فیلدهای بلندِ تأییدشده: {blank_lines}، فقط فضای نوشتنِ خالی، واقعی، جادار و متناسب بساز. حتی یک کلمه از متن، خلاصه، بازنویسی، متن آزمایشی، نام‌گذاریِ فیلد، توضیح تحریریه، لورم‌ایپسوم، خط نمایشی یا عبارت جایگزین ننویس. این فضا کاملاً بدون متن، عدد و آیکون بماند تا تحریریه بعداً متن را دستی اضافه کند."))
        form_modules.append(module("قرارداد قطعی متنِ اسلاید", "فقط و فقط عبارت‌هایی را که در ماژول «متن‌های تأییدشدهٔ فرم» به‌صراحت آمده‌اند، روی این اسلاید بنویس. هر فیلدی که در آن ماژول نیامده، خالی بوده یا به‌عنوان متن بلند تعیین شده است، نباید با متن حدسی، جایگزین، راهنما، نقل‌قول، توضیح، عنوان یا برچسب پُر شود. عباراتی مانند «متن کامل…»، «توسط تحریریه…»، «ادامه دارد»، «یادداشت»، «تیتر» یا هر متن نمونه مطلقاً ممنوع‌اند. اگر هیچ متن محتواییِ تأییدشده نداری، فقط هویت سربرگ، واترمارک و نشانگر شمارهٔ اسلاید را نگه دار و باقیِ بدنه را گرافیکی و بدون متن بساز."))
        if is_news:
            if slide_index == 1:
                form_modules.append(module("قرارداد کاورِ اسلاید اول", "این اسلاید فقط کاور سری است. تنها متن‌های مجاز، روتیتر، تیتر، زیرتیتر و عبارت دقیق «ورق بزنید» هستند. متن خبر، کپشن، منبع، نام نویسنده، توضیح، نقل‌قول، شماره، برچسب و هر متن دیگری مطلقاً روی این اسلاید نیاید. عبارت «ورق بزنید» کوچک و خوانا در پایین بدنه باشد و به فضای امن، واترمارک یا نشانگر صفحه وارد نشود."))
            else:
                form_modules.append(module("قرارداد اسلایدهای ادامه", "این اسلاید برای ادامهٔ روایت است. اگر متن کپشن داده شده، موتور باید آن را فقط برای محاسبهٔ فضای خالی بخواند و هرگز آن را روی تصویر ننویسد. فضای متنِ رزروشده باید در ترکیب‌بندی واقعی دیده شود، اما خودش هیچ متن، خط، کادر، رنگ جدا یا نشانهٔ اندازه‌گیری نداشته باشد."))
    elif series_blank_fields:
        field_labels = {"title": "عنوان", "subtitle": "زیرتیتر", "caption": "متن", "interactionText": "تعامل", "citizenMessageText": "متن پیام", "citizenHeadline": "عنوان", "citizenResponse": "پاسخ", "citizenInteraction": "تعامل", "occasionHeadline": "عنوان", "occasionMessage": "پیام"}
        blank_lines = "، ".join(f"{field_labels.get(key, key)} ({fa_number(length)} نویسه)" for key, length in series_blank_fields)
        form_modules.append(module("فضای خالیِ متن بلند", f"برای {blank_lines} فقط فضای نوشتنِ خالی، تمیز و متناسب بساز. متن واقعی، خلاصه، متن آزمایشی، لورم‌ایپسوم، خط نمایشی، برچسب یا عبارت جایگزین ننویس؛ تحریریه متن را بعداً دستی وارد می‌کند."))
    if additional_instructions:
        form_modules.append(module("توضیحات تکمیلی کاربر", additional_instructions))
    if continuity_count or has_user_reference or is_studio_image:
        continuity_rules = [
            "CURRENT-SLIDE USER REFERENCES are authoritative for this slide. Use the attached user image exactly when the brief asks for it; do not replace it with a generated look-alike, redraw its map or screenshot, or invent a substitute.",
            "SERIES CONTINUITY references are previous-slide outputs. They are STYLE/IDENTITY/GRID references only: copy the visual family, camera language, typography rhythm and page-marker geometry, but NEVER copy their text, map, subject, objects, captions or story content into this slide.",
        ]
        if is_studio_image:
            continuity_rules.extend([
                "STUDIO PRESENTER IDENTITY references are locked identity evidence. Preserve the same woman's face, facial geometry, eyes, nose, mouth, skin texture, hairline and recognizable identity exactly; do not blend her with the previous slide or regenerate a different person. Pose, expression, clothing and camera angle may change only when requested.",
                "If a current-slide user image is attached and the monitor state is blank or stale, treat that image as the authoritative monitor content: place it inside the studio monitor unchanged, preserving every pixel, line, label and text. Never use the previous slide as monitor content.",
            ])
        if resolved_logo_behavior(record) == "floating_profile":
            continuity_rules.append(
                "FLOATING PROFILE must be art-directed into the composition, not pasted like a sticker: use a deliberate circular crop with clean edge treatment, subtle scene-matched light/shadow or depth, and a placement that participates in the grid without covering the headline, presenter face or monitor. Keep the profile image's internal text and pixels unchanged; never recolor it yellow or redraw it."
            )
        form_modules.append(module("REFERENCE PRIORITY AND SERIES ISOLATION", "\n".join(continuity_rules)))
    if slide_mode in {"multi_story", "carousel"} and slide_count > 1:
        sequence_kind = "استوری چنداسلایدی" if slide_mode == "multi_story" else "کاروسل چنداسلایدی"
        form_modules.append(module("قواعد سریِ یکپارچه", f"این طرح، اسلاید {slide_index} از یک {sequence_kind} با مجموع {slide_count} اسلاید است. همهٔ اسلایدها باید یک سیستم طراحی مشترک داشته باشند: همان ناحیهٔ امن هویت، رنگ‌های اصلی، جنس نور، خانوادهٔ تایپوگرافی، گرید، میزان کارت‌های شیشه‌ای و حس تصویری. قرارداد هر اسلاید این سری نیز دقیقاً این است: {provider_text_start} ترکیب‌بندی هر اسلاید را متناسب با محتوای خودش متفاوت و زنده نگه دار. در پایین طرح، یک نشانگر صفحهٔ مینیمال و حرفه‌ایِ صرفاً گرافیکی بگذار: دقیقاً {slide_count} نقطه/بخش کوچک هم‌ردیف که فقط نقطهٔ شمارهٔ {slide_index} برجسته باشد. هیچ عدد، کلمه، عبارت «صفحه»، «از»، «اسلاید»، یا متن دیگری برای نشانگر ننویس. نشانگر نباید با واترمارک، منبع یا تعامل تداخل داشته باشد."))

    form_edit_changes = record.get("formEditChanges")
    if record.get("operation") == "visual_edit" and isinstance(form_edit_changes, dict):
        form_modules.append(module("ویرایش هوشمندِ کنترل‌شده روی تصویر ورودی", "این تصویر، نسخهٔ آمادهٔ قبلی است و باید پایهٔ ویرایش بماند. فقط تغییرات زیر را اعمال کن؛ هر جزء دیگری ــ از جمله عکس، چهره‌ها، سربرگ، واترمارک، رنگ، گرید، متن‌های بدون تغییر و نسبت تصویر ــ را دقیقاً حفظ کن. طرح را از نو بازطراحی نکن، متنِ تغییرداده‌نشده را بازنویسی نکن و عنصر تازه‌ای اضافه نکن.\nتغییرات واقعی فرم:\n" + json.dumps(form_edit_changes, ensure_ascii=False, indent=2)))

    active_modules = "\n\n".join(item for item in form_modules if item)
    if uses_editorial_header(record):
        identity_protocol = f"""پروتکل ناحیهٔ امن هویت رسانه:
{readable_text_geometry}
در همین مستطیل بالایی، همان عکس، نور، دیوار، آسمان یا پس‌زمینهٔ طبیعی صحنه را بدون بریدگی تا لبهٔ بوم ادامه بده؛ این ناحیه نباید سفید، تخت، یک‌دست، نواری، کارتی یا جدا از بدنه شود. آن را از چهره، سوژهٔ اصلی، متن، نشان و جزئیات مهم خالی نگه دار. در این ناحیه هیچ نوشته، حروف، لوگو، خط، دایره، سربرگ یا عنصر گرافیکی تولید نکن؛ هویت رسمی بعد از تولید، دقیق و فقط یک‌بار اضافه می‌شود.
سه واترمارک پراکنده، ظریف و کم‌رنگ را دقیقاً با همین متن لاتین روی تصویر بگذار: «{brand_watermark}». هیچ آیدی یا واترمارک دیگری نساز."""
        header_integrity_rule = "۴) عکس، تایپوگرافی و عناصر گرافیکی باید یک طرح یکپارچه باشند و ناحیهٔ امن بالای کادر باید امتداد طبیعی همان صحنه بماند؛ هیچ فضای سفید یا تزئین تصادفی نساز."
        header_leak_rule = "۳) ناحیهٔ امن بالای کادر برای مرحلهٔ نهایی رزرو شده است؛ در آن هیچ لوگو، سربرگ، خط، دایره یا متن نساز و پس‌زمینهٔ طبیعی صحنه را قطع نکن."
    elif resolved_logo_behavior(record) == "floating_profile":
        profile_contract = """پروتکل پروفایل شناور رسانه:
عکس پروفایل واقعی رسانه در ورودی مرجع پیوست شده است. همان فایل را بدون تغییر کیفیت، نوشته، لوگو، نسبت یا رنگ داخلی حفظ کن و آن را با یک ماسک دایره‌ای تمیز، کوچک و حرفه‌ای در نقطه‌ای از ترکیب‌بندی که با سوژه و تیتر تداخل ندارد قرار بده. جای آن را با سلیقهٔ خودت و متناسب با نور و گرید انتخاب کن؛ لازم نیست در همهٔ تصاویر جای ثابتی داشته باشد. پروفایل را نکِش، بازطراحی نکن، متن داخلش را بازنویسی نکن و نسخهٔ زرد یا رنگیِ ساختگی نساز. هویت رسانه فقط همین پروفایل شناور است؛ سربرگ سیستمی، نوار بالایی، تیتر زرد ثابت، واترمارک یا لوگوی دوم نساز."""
        identity_protocol = profile_contract
        header_integrity_rule = "پروفایل دایره‌ای باید با حاشیهٔ تمیز، اندازهٔ خوانا و بدون پوشاندن سوژه یا متن اصلی در خود تصویر قرار بگیرد."
        header_leak_rule = "هیچ سربرگ سیستمی، نوار بالایی، لوگوی تکراری یا تیتر زرد اجباری تولید نکن."
    elif resolved_logo_behavior(record) == "none":
        identity_protocol = "پروتکل بدون پروفایل: هیچ سربرگ، لوگو، پروفایل شناور، واترمارک رسانه‌ای یا نوار هویتی اضافه نکن. هویت را فقط از صحنه و محتوای واقعی درخواست بگیر."
        header_integrity_rule = "هیچ عنصر هویتی رسانه‌ای تولید نشود."
        header_leak_rule = "لوگو، سربرگ، پروفایل، نوار بالایی و تیتر زرد ساختگی ممنوع است."
    elif template == "sticker":
        identity_protocol = """پروتکل استیکر:
این خروجی PNG شفاف و مستقل است. سربرگ اجتماعی، نوار بالایی، واترمارک خبری، نام رسانه یا صحنهٔ پس‌زمینه نساز؛ فقط خودِ استیکر و عناصر چسبیده به آن مجازند."""
        header_integrity_rule = "۴) فقط سیلوئت استیکر و عناصر وابسته به آن دیده شوند؛ همهٔ پیکسل‌های بیرونی واقعاً شفاف بمانند."
        header_leak_rule = "۳) سربرگ، لوگوی رسانه، واترمارک و پس‌زمینهٔ کامل ممنوع است."
    else:
        identity_protocol = """پروتکل هویت صحنهٔ استودیو:
این خروجی هیچ سربرگ اجتماعی، نوار بالایی، لوگوی شناور، واترمارک خبری یا عنوان رسانه‌ای روی لبهٔ تصویر ندارد. هویت «کلام تازه» فقط باید از لوگوها و عناصر فیزیکیِ موجود در تصاویر مرجع خودِ لوکیشن برداشت شود؛ آن‌ها را تکثیر نکن و سربرگ جداگانه نساز."""
        header_integrity_rule = "۴) صحنه، شخصیت‌ها، تایپوگرافیِ درخواستی و عناصر فیزیکی استودیو باید یکپارچه باشند؛ هیچ سربرگ اجتماعی یا نوار بالایی نساز."
        header_leak_rule = "۳) هیچ سربرگ اجتماعی، لوگوی شناور، خط هدر، دایرهٔ هدر یا واترمارک خبری روی تصویر استودیویی نساز."
    return f"""یک طرح نهایی کامل برای انتشار در رسانهٔ فارسی‌زبان طراحی کن؛ نه فقط پس‌زمینه و نه ماکاپ.

{brief}

خروجی: یک طرح کامل {"استیکر مربع PNG با زمینهٔ شفاف" if template == "sticker" else "پست عمودی ۴:۵" if format_.get("canvas") == "post_1080x1350" else "استوری عمودی ۹:۱۶"}، مدرن، مجله‌ای، حرفه‌ای و در سطح ارسال به جشنوارهٔ طراحی.
{foundation}
{app.image_style_prompt()}

{identity_protocol}

قواعد قطعی متن:
۱) متن‌های تأییدشده، به‌ویژه روتیتر، تیتر و زیرتیتر، «دادهٔ قفل‌شده» هستند: پیش از نوشتن، آن‌ها را کاراکتر‌به‌کاراکتر از دادهٔ فرم بخوان و در طرح دقیقاً همان رشته را بنویس. حتی یک حرف، نیم‌فاصله، فاصله، نشانه، عدد یا واژه را اصلاح، جابه‌جا، کوتاه، بلند، بازنویسی یا حدس نزن.
۲) برای تیتر/روتیتر/زیرتیتر، فقط خودِ متن واقعیِ واردشده را نمایش بده؛ هیچ پیشوند یا برچسبی مانند «تیتر:»، «روتیتر:»، «زیرتیتر:»، «خبر:» یا توضیحی به آن اضافه نکن و هیچ بخش آن را حذف نکن. شکست سطرِ گرافیکی مجاز است، اما ترتیب واژه‌ها و املای متن باید کاملاً ثابت بماند.
۳) هر عبارت، عدد، ساعت، تاریخ، واحد و آیدی موجود در دادهٔ تأییدشده را دقیقاً همان‌طور که نوشته شده، با فارسی درست بنویس؛ هیچ‌چیز را ترجمه، خلاصه، بازنویسی، حذف یا اضافه نکن.
۴) خودِ کلمات «تیتر»، «روتیتر»، «زیرتیتر»، «کپشن» یا «کارت» را هرگز در خود طرح ننویس، مگر آن‌که عیناً بخشی از دادهٔ تأییدشدهٔ کاربر باشند.
۵) هیچ متن آزمایشی، لورم‌ایپسوم، غلط املایی، متن انگلیسی ناخواسته، لوگوی ساختگی یا عددِ حدسی تولید نکن.
{header_integrity_rule}
۵) همهٔ عددهای روی طرح باید با رقم فارسی «۰۱۲۳۴۵۶۷۸۹» نوشته شوند؛ تنها استثنا خطِ تاریخ میلادی است که باید دقیقاً با رقم لاتین و همان متنِ داده‌شده باقی بماند.
۶) در هر قالبی که عنوان/تیتر اصلی دارد، عنوان باید از همهٔ متن‌های محتوایی بزرگ‌تر، پررنگ‌تر و نخستین نقطهٔ خوانش باشد؛ برای خوانایی در نمایش کوچک موبایل فضای کافی به آن بده و آن را فشرده یا هم‌اندازهٔ متن فرعی نساز.
۷) تیتر/عنوان اصلی حداکثر از دو رنگ استفاده کند: یک رنگ پایهٔ خوانا و در صورت نیاز فقط یک رنگ تأکیدی برای یک واژه یا بخش محدود. گرادیان متن، رنگین‌کمانی‌کردن، چندرنگ‌کردن واژه‌ها یا استفاده از بیش از دو رنگ در تیتر ممنوع است.

قرارداد منع اختراع و نشت ماژول:
۱) فیلد خالی یعنی «نبودن کامل آن عنصر». برای فیلد خالی هیچ جایگزین، placeholder، خط نمایشی، شمارهٔ نمونه، رشتهٔ «۱۲۳۴۵۶۷۸۹»، تاریخ، ساعت، قیمت، نشانی، آیدی، QR، آیکون یا کارت نساز.
۲) فقط ماژول‌هایی مجازند که زیر عنوان «ماژول‌های فعالِ همین درخواست» آمده‌اند. طلا، ارز، سکه، بازار، آب‌وهوا، اوقات شرعی، تقویم و هر ویجت یا موضوع دیگری، مگر آن‌که ماژول فعالِ همین درخواست با دادهٔ غیرخالی باشد، مطلقاً ممنوع است.
{header_leak_rule}
۴) در حالت حفظ/مرجع، بخش پایین شیت ورودی عکس واقعی کاربر است. این عکس مادهٔ تولید عکس مشابه نیست؛ محتوای اصلی آن باید عیناً بماند و تنها بیرون لبه‌هایش می‌تواند برای تکمیل بوم گسترش یابد.
۵) قبل از تحویل، تمام نوشته‌های خروجی را با «متن‌های تأییدشدهٔ فرم» تطبیق بده. هر نوشته‌ای که منبع دقیق در داده‌های فعال ندارد حذف کن؛ هیچ حرف، کلمه یا عددی را کم یا زیاد نکن.

قالب انتخاب‌شده: {template}

ماژول‌های فعالِ همین درخواست:
{active_modules or 'هیچ ماژول محتوایی اضافه‌ای انتخاب نشده است.'}

کنترل نهاییِ اجباری پیش از رندر — این بند بر هر صفحه‌بندی و ماژول دیگری اولویت دارد:
{provider_text_start}
تمام نوشته‌ها را پس از چیدمان مرور کن. اگر حتی یک پیکسل از حرف، عدد، آیدی، واترمارک، برچسب یا سایهٔ متن بالاتر از این مرز است، همان بلوک متن را پیش از تحویل پایین ببر. در ناحیهٔ ممنوعه فقط ادامهٔ طبیعی عکس/صحنه مجاز است؛ نه متن و نه سربرگ ساختگی.
"""


def render_size(record: dict) -> str:
    # The AI is now the final renderer, so the provider aspect ratio must
    # match the editor's canvas instead of relying on a later crop.
    canvas = record.get("request", {}).get("format", {}).get("canvas")
    # GPT Image 2.5 accepts arbitrary dimensions when both edges are divisible
    # by 16. 1152×2048 is exact 9:16 and 1280×1600 is exact 4:5.
    # Gemini receives the same intent through gemini_aspect_ratio() below.
    return "1024x1024" if canvas == "sticker_1024x1024" else "1280x1600" if canvas == "post_1080x1350" else "1152x2048"


def canvas_size(record: dict) -> tuple[int, int]:
    canvas = record.get("request", {}).get("format", {}).get("canvas")
    return (1024, 1024) if canvas == "sticker_1024x1024" else (1080, 1350) if canvas == "post_1080x1350" else (1080, 1920)


def shape_text(value: str) -> str:
    value = value.strip()
    return value if RTL_TEXT else get_display(arabic_reshaper.reshape(value))


def text_lines(draw: ImageDraw.ImageDraw, value: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = value.strip().split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        if current and draw.textbbox((0, 0), shape_text(candidate), font=font, **TEXT_OPTIONS)[2] > max_width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def fit_font(draw: ImageDraw.ImageDraw, value: str, max_width: int, start: int, minimum: int, max_lines: int) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    path = peyda_font_path("bold")
    for size in range(start, minimum - 1, -2):
        font = ImageFont.truetype(str(path), size)
        lines = text_lines(draw, value, font, max_width)
        if len(lines) <= max_lines:
            return font, lines
    font = ImageFont.truetype(str(path), minimum)
    # Never silently remove approved editorial text. A tight layout may make
    # the type smaller, but every word remains available to the renderer.
    return font, text_lines(draw, value, font, max_width)


def fit_paragraph(draw: ImageDraw.ImageDraw, value: str, font_path: Path, max_width: int, start: int, minimum: int, max_height: int) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    """Fit an entire caption in its actual remaining vertical space."""
    for size in range(start, minimum - 1, -1):
        font = ImageFont.truetype(str(font_path), size)
        lines = text_lines(draw, value, font, max_width)
        line_height = size + max(8, size // 3)
        if len(lines) * line_height <= max_height:
            return font, lines, line_height
    font = ImageFont.truetype(str(font_path), minimum)
    return font, text_lines(draw, value, font, max_width), minimum + max(7, minimum // 3)


def cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), LANCZOS)
    left = max(0, (resized.width - width) // 2)
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def contain(image: Image.Image, width: int, height: int, colour: str = "#10151b") -> Image.Image:
    """Keep every pixel of a real uploaded photo; letterboxing is preferable to a destructive crop."""
    scale = min(width / image.width, height / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), LANCZOS)
    canvas = Image.new("RGB", (width, height), colour)
    canvas.paste(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
    return canvas


def fitted_photo(image: Image.Image, width: int, height: int) -> Image.Image:
    """Fill the canvas with the photo itself, never plain black letterboxing."""
    backdrop = cover(image, width, height).filter(ImageFilter.GaussianBlur(radius=22)).convert("RGBA")
    backdrop.alpha_composite(Image.new("RGBA", (width, height), (0, 0, 0, 72)))
    scale = min(width / image.width, height / image.height)
    foreground = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), LANCZOS).convert("RGBA")
    backdrop.alpha_composite(foreground, ((width - foreground.width) // 2, (height - foreground.height) // 2))
    return backdrop.convert("RGB")


def real_upload_composition(record: dict, width: int, height: int) -> Image.Image:
    """Use the original uploads at the final photo-area dimensions.

    This avoids the old two-stage fit (upload → tall staging canvas → photo
    area), which made a square photo look unnecessarily small in a story.
    """
    images: list[Image.Image] = []
    for item in record.get("uploadedImages", []):
        filename = item.get("filename", "")
        target = app.project_directory(record["requestId"]) / "uploads" / filename
        if Path(filename).name == filename and target.exists():
            images.append(Image.open(target).convert("RGB"))
    if not images:
        return Image.new("RGB", (width, height), "#17212b")
    if len(images) == 1:
        return fitted_photo(images[0], width, height)
    canvas = Image.new("RGB", (width, height), "#17212b")
    columns = 2
    rows = (len(images) + columns - 1) // columns
    cell_width, cell_height = width // columns, height // rows
    for index, image in enumerate(images):
        col, row = index % columns, index // columns
        canvas.paste(fitted_photo(image, cell_width, cell_height), (col * cell_width, row * cell_height))
    return canvas


def video_placeholder_bounds(record: dict, width: int, height: int, brand_row_y: int, text_layout: str) -> tuple[int, int, int, int] | None:
    """Find a transparent, edit-ready video window inside the photo region."""
    format_ = record.get("request", {}).get("format", {})
    legacy = format_.get("videoPlaceholder", {})
    news = format_.get("news", {})
    enabled = bool(legacy.get("enabled")) or bool(news.get("videoOverlay"))
    if not enabled:
        return None
    # Current projects use the same final-pixel geometry as the AI-only
    # finishing pass.  Keeping a second set of bounds here was the source of
    # subtle aspect-ratio drift between renderer variants.
    if bool(news.get("videoOverlay")):
        return video_overlay_bounds(record, width, height)
    # The current editor stores this module under ``format.news``.  Keep the
    # legacy field only for old saved projects.
    frame = news.get("videoFrame") or legacy.get("ratio") or "landscape"
    ratios = {"square": 1.0, "vertical": 9 / 16, "portrait": 9 / 16, "landscape": 16 / 9}
    ratio = ratios.get(frame, 16 / 9)
    if text_layout == "side_panel":
        left, top, right, bottom = 38, 54, int(width * 0.38) - 28, height - 54
    else:
        left, top, right, bottom = 54, 54, width - 54, max(160, brand_row_y - 32)
    available_width, available_height = right - left, bottom - top
    if available_width < 120 or available_height < 120:
        return None
    window_width = min(available_width, int(available_height * ratio))
    window_height = int(window_width / ratio)
    if window_height > available_height:
        window_height = available_height
        window_width = int(window_height * ratio)
    x = left + (available_width - window_width) // 2
    y = top + (available_height - window_height) // 2
    return x, y, x + window_width, y + window_height


def is_transparent_portrait_video_overlay(record: dict) -> bool:
    """A vertical video story is an overlay asset, never a fake background.

    An image model produces flattened RGB pixels.  It cannot be relied on to
    manufacture an alpha channel merely because a prompt calls an area
    "transparent".  Portrait video uses almost the whole story canvas, so it
    must start from a transparent RGBA canvas in our renderer.
    """
    format_ = record.get("request", {}).get("format", {})
    news = format_.get("news", {}) if isinstance(format_, dict) else {}
    return (
        format_.get("family") == "news"
        and bool(news.get("videoOverlay"))
        and news.get("videoFrame") == "portrait"
    )


def requires_native_video_alpha(record: dict) -> bool:
    format_ = record.get("request", {}).get("format", {})
    # Video space is intentionally a prompt-only reserved area.  Only a
    # sticker promises genuine alpha and therefore needs native PNG alpha.
    return format_.get("template") == "sticker"


def verify_native_video_alpha(record: dict, image_bytes: bytes) -> None:
    """Verify the only output type that promises native alpha: stickers."""
    image = Image.open(BytesIO(image_bytes)).convert("RGBA")
    if record.get("request", {}).get("format", {}).get("template") == "sticker":
        transparent = sum(1 for pixel in image.getdata() if pixel[3] <= 12)
        if not transparent or transparent / (image.width * image.height) < 0.10:
            raise RuntimeError("native_sticker_alpha_not_detected")
        return


def is_video_title_sticker(record: dict) -> bool:
    request = record.get("request", {})
    format_ = request.get("format", {}) if isinstance(request, dict) else {}
    content = request.get("content", {}) if isinstance(request, dict) else {}
    return format_.get("template") == "sticker" and content.get("stickerKind") == "video_title"


def compose_video_title_sticker(record: dict) -> bytes:
    """Render a clean transparent headline layer for placement over video.

    This mode is deterministic by design: it is typography, not an AI-made
    badge.  The video editor receives only Persian copy, a restrained accent
    rule and a readable shadow, with the rest of the square fully transparent.
    """
    request = record["request"]
    content = request.get("content", {})
    width, height = canvas_size(record)
    brand = BRANDS.get(request.get("brand"), BRANDS["kalametaze"])
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    title = str(content.get("stickerText", "")).strip()
    subtext = str(content.get("stickerSubtext", "")).strip()
    title_font, title_lines = fit_font(draw, title, width - 150, 104, 50, 3)
    center_x = width // 2
    center_y = height // 2
    line_gap = 18
    title_height = len(title_lines) * ((title_font.size if title_font else 0) + line_gap)
    sub_font = ImageFont.truetype(str(peyda_font_path("regular")), 34) if subtext else None
    total_height = title_height + (sub_font.size + 22 if sub_font else 0)
    top = center_y - total_height // 2
    # A single accent rule gives the layer a visual anchor without becoming a
    # sticker frame or opaque label.
    draw.rounded_rectangle((110, top - 34, width - 110, top - 22), radius=6, fill=(*ImageColor.getrgb(brand["colour"]), 235))
    y = top
    if title_font:
        for line in title_lines:
            draw.text(
                (center_x, y),
                shape_text(line),
                font=title_font,
                fill="#ffffff",
                anchor="ma",
                stroke_width=9,
                stroke_fill=(0, 0, 0, 175),
                **TEXT_OPTIONS,
            )
            y += title_font.size + line_gap
    if sub_font:
        draw.text(
            (center_x, y + 8),
            shape_text(subtext),
            font=sub_font,
            fill="#f4f7fa",
            anchor="ma",
            stroke_width=6,
            stroke_fill=(0, 0, 0, 160),
            **TEXT_OPTIONS,
        )
    output = BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def compose_transparent_portrait_video_overlay(record: dict) -> bytes:
    """Create a true RGBA layer for a 9:16 video, without AI background pixels."""
    request = record["request"]
    content = request.get("content", {})
    news = request.get("format", {}).get("news", {})
    width, height = canvas_size(record)
    brand = BRANDS.get(request.get("brand"), BRANDS["kalametaze"])
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    margin = 54

    # Identity is added in ``apply_exact_header`` below.  Copy and its small
    # translucent cards are the only pixels authored here; every other pixel
    # deliberately remains alpha=0 so an editor can put a real 9:16 video
    # under this PNG.  Do not replace this with a pink/checkerboard/chroma
    # matte: those are ordinary opaque pixels, not transparency.

    title = str(content.get("title", "")).strip()
    kicker = str(content.get("kicker", "")).strip()
    subtitle = str(content.get("subtitle", "")).strip()
    placement = str(news.get("layout", "top"))
    placement_y = {
        "top": int(height * 0.24),
        "center": int(height * 0.47),
        "bottom": int(height * 0.68),
        "right_column": int(height * 0.34),
    }.get(placement, int(height * 0.24))
    title_font, title_lines = fit_font(draw, title, width - margin * 2 - 42, 67, 34, 4) if title else (None, [])
    copy_height = (42 if kicker else 0) + (len(title_lines) * ((title_font.size if title_font else 0) + 17)) + (44 if subtitle else 0) + 46
    box = (margin - 16, placement_y - 28, width - margin + 16, placement_y + max(104, copy_height))
    draw.rounded_rectangle(box, radius=28, fill=(*ImageColor.getrgb(brand["colour"]), 222))
    y = placement_y
    if kicker:
        kicker_font = ImageFont.truetype(str(peyda_font_path("semibold")), 29)
        draw.text((width - margin, y), shape_text(kicker), font=kicker_font, fill="#ffffff", anchor="ra", **TEXT_OPTIONS)
        y += 43
    if title_font:
        for line in title_lines:
            draw.text((width - margin, y), shape_text(line), font=title_font, fill="#ffffff", anchor="ra", **TEXT_OPTIONS)
            y += title_font.size + 17
    if subtitle:
        subtitle_font = ImageFont.truetype(str(peyda_font_path("regular")), 29)
        for line in text_lines(draw, subtitle, subtitle_font, width - margin * 2)[:2]:
            draw.text((width - margin, y), shape_text(line), font=subtitle_font, fill="#f3f7fa", anchor="ra", **TEXT_OPTIONS)
            y += subtitle_font.size + 10

    source = str(content.get("source", "")).strip()
    interaction = str(content.get("interactionText", "")).strip()
    footer_font = ImageFont.truetype(str(peyda_font_path("semibold")), 25)
    if source:
        draw.rounded_rectangle((margin, height - 172, width - margin, height - 116), radius=18, fill=(12, 22, 30, 184))
        draw.text((width - margin - 16, height - 144), shape_text(f"منبع: {source}"), font=footer_font, fill="#ffffff", anchor="rm", **TEXT_OPTIONS)
    if interaction:
        draw.rounded_rectangle((margin, height - 100, width - margin, height - 44), radius=18, fill=(12, 22, 30, 204))
        draw.text((width - margin - 16, height - 72), shape_text(interaction), font=footer_font, fill="#ffffff", anchor="rm", **TEXT_OPTIONS)
    output = BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def video_overlay_bounds(record: dict, width: int, height: int) -> tuple[int, int, int, int] | None:
    """Return the one authoritative pixel rectangle for an embedded video.

    The bounds are calculated from the delivered raster itself, never from
    prompt-only coordinates.  The same function is used to cut the alpha
    channel and is suitable for metadata/QA, so the declared 16:9, 1:1 or
    9:16 ratio cannot drift from the delivered PNG.
    """
    format_ = record.get("request", {}).get("format", {})
    news = format_.get("news", {}) if isinstance(format_, dict) else {}
    if not bool(news.get("videoOverlay")):
        return None
    # Integer unit pairs avoid a one-pixel rounding error in a promised video
    # frame.  The returned pixel box is therefore *exactly* 16:9, 1:1 or 9:16
    # rather than only approximately that ratio.
    ratio_units = {
        "landscape": (16, 9),
        "square": (1, 1),
        "portrait": (9, 16),
    }.get(news.get("videoFrame"), (16, 9))
    margin = max(28, round(width * 0.035))
    top = max(112, round(height * 0.10))
    bottom = height - max(92, round(height * 0.07))
    available_width, available_height = width - margin * 2, bottom - top
    if available_width <= 0 or available_height <= 0:
        return None
    unit_width, unit_height = ratio_units
    unit_scale = min(available_width // unit_width, available_height // unit_height)
    if unit_scale < 1:
        return None
    video_width, video_height = unit_width * unit_scale, unit_height * unit_scale
    left = (width - video_width) // 2
    window_top = top + (available_height - video_height) // 2
    return left, window_top, left + video_width, window_top + video_height


def apply_video_transparency(record: dict, image_bytes: bytes) -> bytes:
    """Convert only the model's green technical matte into real PNG alpha.

    The model returns one flattened raster, so blindly punching a rectangle
    would erase any title, rounded frame or gradient it deliberately put on
    top of the video.  We key *only* #00FF00-like pixels inside the declared
    video window.  Foreground pixels are unmixed from the green backing so
    antialiased text edges survive as semi-transparent pixels.
    """
    format_ = record.get("request", {}).get("format", {})
    news = format_.get("news", {}) if isinstance(format_, dict) else {}
    if not bool(news.get("videoOverlay")):
        return image_bytes
    image = Image.open(BytesIO(image_bytes)).convert("RGBA")
    width, height = image.size
    bounds = video_overlay_bounds(record, width, height)
    if not bounds:
        return image_bytes
    left, top, right, bottom = bounds
    pixels = image.load()
    # Require a meaningful amount of the promised matte.  Without this gate
    # a model that ignored the instruction would silently deliver an opaque
    # fake video area, which is worse than a retryable failure.
    samples = 0
    matte_samples = 0
    sample_step = max(2, min(width, height) // 360)
    inset = max(8, round(width * 0.012))
    for y in range(top + inset, bottom - inset, sample_step):
        for x in range(left + inset, right - inset, sample_step):
            red, green, blue, _ = pixels[x, y]
            samples += 1
            if green >= 220 and red <= 35 and blue <= 35:
                matte_samples += 1
    if not samples or matte_samples / samples < 0.25:
        raise RuntimeError("video_matte_not_detected")

    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue, original_alpha = pixels[x, y]
            # A foreground pixel composited over #00FF00 has a dominant green
            # channel.  Anything else is intentional artwork and stays
            # untouched.  This safely preserves an opaque title/frame as
            # well as its anti-aliased edge and a translucent dark shadow.
            if green < 110 or green < max(red, blue) + 60:
                continue
            recovered_alpha = max(red, blue, 255 - green) / 255
            if recovered_alpha >= 0.96:
                continue
            alpha = round(original_alpha * recovered_alpha)
            if alpha <= 0:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            # Undo normal alpha compositing against pure green.  This avoids
            # the green fringe usually left around text after a basic colour
            # key in mobile editors.
            pixels[x, y] = (
                max(0, min(255, round(red / recovered_alpha))),
                max(0, min(255, round((green - 255 * (1 - recovered_alpha)) / recovered_alpha))),
                max(0, min(255, round(blue / recovered_alpha))),
                alpha,
            )
    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def apply_exact_header(record: dict, image_bytes: bytes) -> bytes:
    """Pin the real transparent masthead onto the AI-authored result.

    Prompting alone cannot guarantee that an image model reproduces a logo
    pixel-for-pixel.  The model still designs the full scene and the pixels
    visible through the transparent masthead; this final identity pass only
    restores the approved brand asset and never invents a substitute.
    """
    image = Image.open(BytesIO(image_bytes)).convert("RGBA")
    if not uses_editorial_header(record):
        output = BytesIO()
        image.save(output, format="PNG", optimize=True)
        return output.getvalue()
    if str(record.get("request", {}).get("format", {}).get("template", "")).startswith("club_"):
        logo_path = ASSET_DIR / "logos" / "club-logo.png"
        if not logo_path.exists():
            raise RuntimeError("club_logo_missing")
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((round(image.width * 0.72), round(image.height * 0.14)), LANCZOS)
        image.alpha_composite(logo, ((image.width - logo.width) // 2, round(image.height * 0.02)))
        output = BytesIO()
        image.save(output, format="PNG", optimize=True)
        return output.getvalue()
    brand_id = str(record.get("request", {}).get("brand", "kalametaze"))
    header_path = header_asset_path(brand_id)
    if not header_path:
        raise RuntimeError(f"brand_header_missing:{brand_id}")
    header = Image.open(header_path).convert("RGBA")
    # Use the approved masthead artwork exactly as supplied. Its original
    # rule, logo, colour dot, alpha and shadows remain untouched; only the
    # dynamic Persian copy below is added in code.
    maximum_width = max(1, round(image.width * 0.94))
    header.thumbnail((maximum_width, max(1, round(image.height * 0.22))), LANCZOS)
    left = (image.width - header.width) // 2
    top = max(8, round(image.height * 0.012))
    scale = header.width / 1280
    image.alpha_composite(header, (left, top))
    # Dynamic Persian copy is rendered here, never delegated to an image
    # model. Coordinates follow the approved 1280x360 masthead artwork.
    header_label, brand_title = editorial_header_copy(record)
    draw = ImageDraw.Draw(image)
    font_size = max(19, round(35 * scale))
    font = ImageFont.truetype(str(peyda_font_path("bold")), font_size)
    handle_font = ImageFont.truetype(str(peyda_font_path("bold")), max(17, round(29 * scale)))
    shadow = max(1, round(2 * scale))
    label_x = left + round(1170 * scale)
    label_y = top + round(136 * scale)
    # Pin the visual left edge of both lines to the masthead's leftmost rule.
    # The text extends rightward toward the centre, never from the centre into
    # the logo as the previous anchor did.
    title_x = left + round(52 * scale)
    title_y = top + round(143 * scale)
    handle_y = top + round(221 * scale)
    page_handle = {
        "kalametaze": "@kalametaze.ir",
        "golbahar": "@golbahar.kalametaze",
        "chenaran": "@chenaran.kalametaze",
    }.get(brand_id, "@kalametaze.ir")
    draw.text((label_x + shadow, label_y + shadow), shape_text(header_label), font=font, fill=(0, 0, 0, 145), anchor="rm", **TEXT_OPTIONS)
    draw.text((title_x + shadow, title_y + shadow), shape_text(brand_title), font=font, fill=(0, 0, 0, 145), anchor="lm", **TEXT_OPTIONS)
    draw.text((title_x + shadow, handle_y + shadow), page_handle, font=handle_font, fill=(0, 0, 0, 145), anchor="lm")
    draw.text((label_x, label_y), shape_text(header_label), font=font, fill="#ffffff", anchor="rm", **TEXT_OPTIONS)
    draw.text((title_x, title_y), shape_text(brand_title), font=font, fill="#ffffff", anchor="lm", **TEXT_OPTIONS)
    draw.text((title_x, handle_y), page_handle, font=handle_font, fill="#ffffff", anchor="lm")
    output = BytesIO()
    image.save(output, format="PNG", optimize=True, interlace=1)
    return output.getvalue()


def draw_template_icon(draw: ImageDraw.ImageDraw, template: str, x: int, y: int, size: int) -> None:
    """Small deterministic editorial icons for recurring non-news formats."""
    ink, warm, light = "#ffffff", "#ffd25a", "#dce8f0"
    if template == "morning_local":
        # Sun plus clock: local morning and local prayer timings.
        center = (x + size // 2, y + size // 2)
        draw.ellipse((center[0] - size // 5, center[1] - size // 5, center[0] + size // 5, center[1] + size // 5), fill=warm)
        for dx, dy in ((0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)):
            draw.line((center[0] + dx * size // 3, center[1] + dy * size // 3, center[0] + dx * size // 2, center[1] + dy * size // 2), fill=warm, width=4)
        draw.ellipse((x + size * 3 // 5, y + size * 3 // 5, x + size, y + size), outline=ink, width=4)
        draw.line((x + size * 4 // 5, y + size * 4 // 5, x + size * 4 // 5, y + size * 7 // 10), fill=ink, width=3)
    elif template == "morning_kalam":
        # Calendar with a rising sun: national/calendar morning briefing.
        draw.rounded_rectangle((x + 5, y + 13, x + size - 5, y + size - 4), radius=12, outline=ink, width=4)
        draw.rectangle((x + 5, y + 13, x + size - 5, y + size // 3), fill=warm)
        for col in range(3):
            for row in range(2):
                cx, cy = x + size * (col + 1) // 4, y + size * (row + 2) // 4
                draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=light)
        draw.arc((x + size // 2, y - 8, x + size + 8, y + size // 2), 190, 350, fill=warm, width=5)
    elif template == "market":
        # Coin stack and a positive neutral market sparkline, entirely vector.
        for offset in (0, 14, 28):
            draw.ellipse((x + 6, y + size - 34 - offset, x + size - 8, y + size - 6 - offset), outline=warm, width=4)
        draw.line((x + 12, y + size // 2, x + size // 3, y + size * 2 // 3, x + size * 3 // 5, y + size // 3, x + size - 8, y + size // 2 - 12), fill=light, width=5)
        draw.polygon(((x + size - 8, y + size // 2 - 12), (x + size - 26, y + size // 2 - 13), (x + size - 13, y + size // 2 + 3)), fill=light)


NON_NEWS_THEMES = {
    "morning_local": ("#173a5e", "#e9a94b", "#f7fbff"),
    "morning_kalam": ("#17395e", "#ffbe5b", "#f7fbff"),
    "market": ("#17130b", "#d9a928", "#fff7d7"),
    "citizen_message": ("#063d4a", "#18b7b4", "#f3ffff"),
    "night": ("#130f25", "#9b72ee", "#fbf8ff"),
    "home_tip": ("#16483e", "#67d4a8", "#f3fff9"),
    "visual_riddle": ("#39205d", "#ffd85b", "#fffdf4"),
    "nature": ("#153d2f", "#94cb74", "#f5fff0"),
    "poll_story": ("#3b174f", "#fc72bd", "#fff7fc"),
    "poll_post": ("#3b174f", "#fc72bd", "#fff7fc"),
    "sport": ("#083b5b", "#38bdf8", "#f0fbff"),
}
NON_NEWS_LABELS = {
    "morning_local": "صبح بخیر", "morning_kalam": "صبح بخیر کلام", "market": "نبض بازار",
    "citizen_message": "پیام مردمی", "night": "شبانه", "home_tip": "ترفند خانه‌داری",
    "visual_riddle": "معمای تصویری", "nature": "طبیعت‌گردی", "poll_story": "نظرسنجی",
    "poll_post": "نظرسنجی", "sport": "ورزش",
}


def non_news_icon(draw: ImageDraw.ImageDraw, name: str, x: int, y: int, size: int, colour: str) -> None:
    """Small original vector icons: crisp at story and post resolution."""
    width = max(2, size // 14)
    if name in {"sun", "sunrise", "noon"}:
        draw.ellipse((x + size // 4, y + size // 4, x + size * 3 // 4, y + size * 3 // 4), outline=colour, width=width)
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            cx, cy = x + size // 2, y + size // 2
            draw.line((cx + dx * size // 3, cy + dy * size // 3, cx + dx * size // 2, cy + dy * size // 2), fill=colour, width=width)
    elif name in {"moon", "maghrib"}:
        draw.ellipse((x + size // 4, y + size // 5, x + size * 3 // 4, y + size * 4 // 5), outline=colour, width=width)
        draw.ellipse((x + size * 7 // 16, y + size // 7, x + size * 15 // 16, y + size * 11 // 16), fill="#173a5e")
    elif name == "cloud":
        draw.ellipse((x + size // 8, y + size // 2, x + size // 2, y + size * 7 // 8), outline=colour, width=width)
        draw.ellipse((x + size // 3, y + size // 3, x + size * 3 // 4, y + size * 7 // 8), outline=colour, width=width)
        draw.line((x + size // 8, y + size * 7 // 8, x + size * 7 // 8, y + size * 7 // 8), fill=colour, width=width)
    elif name == "wind":
        for offset in (0, size // 3, size * 2 // 3):
            draw.arc((x, y + offset, x + size, y + offset + size // 3), 195, 355, fill=colour, width=width)
    elif name == "coin":
        draw.ellipse((x + size // 6, y + size // 6, x + size * 5 // 6, y + size * 5 // 6), outline=colour, width=width)
        draw.text((x + size // 2, y + size // 2), "$", font=ImageFont.truetype(str(peyda_font_path("bold")), max(16, size // 2)), fill=colour, anchor="mm")
    elif name == "question":
        draw.rounded_rectangle((x + 4, y + 4, x + size - 4, y + size - 4), radius=size // 5, outline=colour, width=width)
        draw.text((x + size // 2, y + size // 2), "؟", font=ImageFont.truetype(str(peyda_font_path("bold")), max(18, size * 2 // 3)), fill=colour, anchor="mm", **TEXT_OPTIONS)
    else:
        draw.ellipse((x + size // 4, y + size // 4, x + size * 3 // 4, y + size * 3 // 4), fill=colour)


def fact_icon(line: str) -> str:
    value = line.replace("‌", " ").lower()
    if "اذان صبح" in value or "فجر" in value:
        return "moon"
    if "طلوع" in value:
        return "sunrise"
    if "ظهر" in value:
        return "noon"
    if "مغرب" in value or "غروب" in value:
        return "maghrib"
    if "باد" in value:
        return "wind"
    if any(word in value for word in ("ابری", "باران", "برف", "cloud")):
        return "cloud"
    if any(word in value for word in ("دما", "بیشینه", "کمینه", "وضعیت")):
        return "sun"
    return "coin" if any(word in value for word in ("دلار", "یورو", "طلا", "سکه", "بیت")) else "question"


def non_news_photo(record: dict, background: Image.Image, width: int, height: int) -> Image.Image:
    if record.get("request", {}).get("image", {}).get("mode") == "preserve":
        return real_upload_composition(record, width, height)
    return cover(background, width, height)


def compose_non_news(record: dict, background_bytes: bytes) -> bytes:
    """Dedicated social templates, deliberately separate from newsroom layouts."""
    request, content = record["request"], record["request"].get("content", {})
    template = request.get("format", {}).get("template", "morning_local")
    dark, highlight, light = NON_NEWS_THEMES.get(template, ("#153d4e", "#50b9eb", "#ffffff"))
    label = NON_NEWS_LABELS.get(template, "محتوای کلام تازه")
    width, height = canvas_size(record)
    photo_height = int(height * .37)
    background = Image.open(BytesIO(background_bytes)).convert("RGB")
    canvas = Image.new("RGB", (width, height), dark)
    canvas.paste(non_news_photo(record, background, width, photo_height), (0, 0))
    tint = Image.new("RGBA", (width, photo_height), (0, 0, 0, 80))
    canvas.paste(tint, (0, 0), tint)
    draw = ImageDraw.Draw(canvas)
    brand = BRANDS.get(request.get("brand"), BRANDS["kalametaze"])
    profile_path = ASSET_DIR / "profiles" / brand["profile"]
    if profile_path.exists():
        profile = cover(Image.open(profile_path).convert("RGB"), 66, 66).convert("RGBA")
        mask = Image.new("L", (66, 66), 0); ImageDraw.Draw(mask).ellipse((0, 0, 65, 65), fill=255); profile.putalpha(mask)
        canvas.paste(profile, (54, 28), profile)
    brand_label = {"kalametaze": "کلام تازه", "golbahar": "کلام تازه گلبهار", "chenaran": "کلام تازه چناران"}.get(request.get("brand"), "کلام تازه")
    brand_font = ImageFont.truetype(str(peyda_font_path("semibold")), 24)
    draw.text((width - 54, 60), shape_text(brand_label), font=brand_font, fill="#ffffff", anchor="ra", **TEXT_OPTIONS)
    margin, y = 54, photo_height - 110
    tag_font = ImageFont.truetype(str(peyda_font_path("semibold")), 28 if height > 1500 else 23)
    draw.rounded_rectangle((margin, y, margin + 245, y + 56), radius=20, fill=(*ImageColor.getrgb(highlight), 235))
    draw.text((margin + 222, y + 29), shape_text(label), font=tag_font, fill=dark, anchor="rm", **TEXT_OPTIONS)
    title = content.get("title", "").strip() or label
    title_font, title_lines = fit_font(draw, title, width - margin * 2, 66 if height > 1500 else 52, 36, 2)
    y = photo_height + 68
    for line in title_lines:
        draw.text((width - margin, y), shape_text(line), font=title_font, fill=light, anchor="ra", **TEXT_OPTIONS)
        y += title_font.size + 16

    def card(bounds: tuple[int, int, int, int], fill: str = "#ffffff") -> None:
        draw.rounded_rectangle(bounds, radius=26, fill=fill)

    def write_rows(lines: list[str], start_y: int, icon_colour: str, max_rows: int = 4, columns: int = 1) -> int:
        rows = lines[:max_rows]
        if not rows:
            return start_y
        gap, col_w = 14, (width - margin * 2 - (columns - 1) * 14) // columns
        row_h = 92 if height > 1500 else 76
        for index, line in enumerate(rows):
            col, row = index % columns, index // columns
            right = width - margin - col * (col_w + gap)
            top = start_y + row * (row_h + gap)
            card((right - col_w, top, right, top + row_h), "#ffffff")
            non_news_icon(draw, fact_icon(line), right - col_w + 15, top + 16, row_h - 32, icon_colour)
            row_font, row_lines = fit_font(draw, line, col_w - row_h - 20, 28 if height > 1500 else 23, 16, 2)
            line_y = top + row_h // 2 - ((len(row_lines) - 1) * (row_font.size + 4)) // 2
            for item in row_lines:
                draw.text((right - 18, line_y), shape_text(item), font=row_font, fill=dark, anchor="rm", **TEXT_OPTIONS)
                line_y += row_font.size + 4
        return start_y + ((len(rows) + columns - 1) // columns) * (row_h + gap)

    if template == "morning_local":
        edition = request.get("image", {}).get("localEdition", "golbahar")
        place = "گلبهار" if edition == "golbahar" else "چناران"
        place_font = ImageFont.truetype(str(peyda_font_path("semibold")), 30 if height > 1500 else 24)
        draw.text((width - margin, y), shape_text(f"اوقات شرعی و آب و هوای امروز شهرستان {place}"), font=place_font, fill=highlight, anchor="ra", **TEXT_OPTIONS)
        y += 50
        weather = [line.strip() for line in content.get("weather", "").splitlines() if line.strip()]
        y = write_rows(weather, y, highlight, max_rows=4, columns=2)
        y += 6
        prayers = [line.strip() for line in content.get("prayerTimes", "").splitlines() if line.strip()]
        y = write_rows(prayers, y, highlight, max_rows=4, columns=2)
        riddle = content.get("riddle", "").strip()
        if riddle and y < height - 105:
            top = min(y + 8, height - 156)
            card((margin, top, width - margin, height - 54), highlight)
            non_news_icon(draw, "question", margin + 18, top + 20, 54, dark)
            rfont, rlines = fit_font(draw, riddle, width - margin * 2 - 102, 31 if height > 1500 else 25, 17, 2)
            yy = top + 48 - ((len(rlines) - 1) * (rfont.size + 5)) // 2
            for line in rlines:
                draw.text((width - margin - 18, yy), shape_text(line), font=rfont, fill=dark, anchor="rm", **TEXT_OPTIONS); yy += rfont.size + 5
    elif template == "morning_kalam":
        lines = [line.strip() for line in content.get("occasions", "").splitlines() if line.strip()]
        y = write_rows(lines, y, highlight, max_rows=4, columns=1)
        riddle = content.get("riddle", "").strip()
        if riddle:
            card((margin, min(y + 10, height - 150), width - margin, height - 54), "#ffffff")
            non_news_icon(draw, "question", margin + 18, min(y + 28, height - 132), 48, highlight)
            font, lines = fit_font(draw, riddle, width - margin * 2 - 92, 30, 17, 2)
            draw.text((width - margin - 18, min(y + 62, height - 95)), shape_text(" ".join(lines)), font=font, fill=dark, anchor="rm", **TEXT_OPTIONS)
    elif template == "market":
        rates = [line.strip() for line in content.get("marketRates", "").splitlines() if line.strip()]
        y = write_rows(rates, y, highlight, max_rows=5, columns=1)
        source = content.get("source", "").strip()
        if source:
            draw.text((width - margin, min(height - 54, y + 32)), shape_text(f"منبع: {source}"), font=tag_font, fill=highlight, anchor="ra", **TEXT_OPTIONS)
    else:
        # Remaining non-news templates use their own colour language and
        # icon-led card rather than inheriting the newsroom renderer.
        body = content.get("caption", "").strip() or content.get("senderContext", "").strip()
        card((margin, y + 8, width - margin, min(height - 120, y + int(height * .28))), "#ffffff")
        non_news_icon(draw, "coin" if template == "sport" else "question", margin + 20, y + 30, 68, highlight)
        body_font, body_lines = fit_paragraph(draw, body or label, peyda_font_path("regular"), width - margin * 2 - 116, 38 if height > 1500 else 29, 17, int(height * .22))
        yy = y + 42
        for line in body_lines:
            draw.text((width - margin - 20, yy), shape_text(line), font=body_font, fill=dark, anchor="ra", **TEXT_OPTIONS); yy += body_font.size + 10
    output = BytesIO(); canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def compose_final(record: dict, background_bytes: bytes) -> bytes:
    request = record["request"]
    if request.get("format", {}).get("family") != "news":
        return compose_non_news(record, background_bytes)
    content = request.get("content", {})
    width, height = canvas_size(record)
    brand = BRANDS.get(request.get("brand"), BRANDS["kalametaze"])
    background = Image.open(BytesIO(background_bytes)).convert("RGB")
    layout = resolved_layout(record)
    text_layout = resolved_text_layout(record)
    exact_uploaded_photo = request.get("image", {}).get("mode") == "preserve"
    surface_rgb, text_colour, secondary_colour, accent, surface_alpha = surface_colours(record, brand)
    margin = 68
    content_left, content_right = margin, width - margin
    if text_layout == "bottom_card":
        card_top = int(height * (0.53 if height > 1500 else 0.50))
        # For a real photo, never let the card silently hide its content.
        # The entire uploaded image is fitted above the card instead.
        if exact_uploaded_photo:
            canvas = Image.new("RGB", (width, height), surface_rgb)
            canvas.paste(real_upload_composition(record, width, card_top), (0, 0))
        else:
            canvas = cover(background, width, height)
        card_bounds = (42, card_top, width - 42, height - 38)
        card = Image.new("RGBA", (card_bounds[2] - card_bounds[0], card_bounds[3] - card_bounds[1]), (*surface_rgb, surface_alpha))
        card_draw = ImageDraw.Draw(card)
        card_draw.rounded_rectangle((0, 0, card.width - 1, card.height - 1), radius=34, fill=(*surface_rgb, surface_alpha))
        canvas.paste(card, card_bounds[:2], card)
        brand_row_y = card_top
    elif text_layout == "side_panel":
        side_left = int(width * 0.38)
        if exact_uploaded_photo:
            canvas = Image.new("RGB", (width, height), surface_rgb)
            canvas.paste(real_upload_composition(record, side_left, height), (0, 0))
        else:
            canvas = cover(background, width, height)
        panel = Image.new("RGBA", (width - side_left, height), (*surface_rgb, surface_alpha))
        canvas.paste(panel, (side_left, 0), panel)
        content_left, content_right = side_left + 30, width - 30
        brand_row_y = 42
    elif layout == "full_photo":
        panel_top = int(height * (0.54 if height > 1500 else 0.52))
        if exact_uploaded_photo:
            canvas = Image.new("RGB", (width, height), surface_rgb)
            canvas.paste(real_upload_composition(record, width, panel_top), (0, 0))
        else:
            canvas = cover(background, width, height)
        # A translucent brand panel makes exact Persian copy readable while
        # retaining a genuinely full-page photograph above it.
        panel = Image.new("RGBA", (width, height - panel_top), (*surface_rgb, surface_alpha))
        canvas.paste(panel, (0, panel_top), panel)
        brand_row_y = panel_top
    else:
        photo_height = int(height * (0.45 if height > 1500 else 0.42))
        photo = real_upload_composition(record, width, photo_height) if exact_uploaded_photo else cover(background, width, photo_height)
        canvas = Image.new("RGB", (width, height), surface_rgb)
        canvas.paste(photo, (0, 0))
        overlay = Image.new("RGBA", (width, photo_height), (0, 0, 0, 38))
        canvas.paste(overlay, (0, 0), overlay)
        brand_row_y = photo_height
    draw = ImageDraw.Draw(canvas)
    headline_style = resolved_headline_style(record)
    # Reserve room for the complete wordmark before the editorial text.
    y = brand_row_y + 190
    regular = peyda_font_path("regular")
    semibold = peyda_font_path("semibold")

    is_light_surface = resolved_surface_tone(record) == "light"
    logo_variant = brand["logoLight"] if is_light_surface else brand["logo"]
    logo_path = ASSET_DIR / "logos" / logo_variant
    use_dark_fallback = is_light_surface and not logo_path.exists()
    if use_dark_fallback:
        logo_path = ASSET_DIR / "logos" / brand["logo"]
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGBA")
        if use_dark_fallback:
            # A safe fallback while a dedicated light export is unavailable:
            # use the approved identifier silhouette in dark ink, rather than
            # allowing it to disappear against a light editorial surface.
            alpha = logo.getchannel("A")
            logo = Image.new("RGBA", logo.size, (23, 33, 43, 255))
            logo.putalpha(alpha)
        # Each supplied PNG contains two separate lockup bands on a tall
        # transparent artboard: the Persian media name above and the English
        # account ID below. Extract and place both rather than losing either.
        def crop_band(source: Image.Image, top: int, bottom: int) -> Image.Image | None:
            band = source.crop((0, top, source.width, bottom))
            bounds = band.getchannel("A").getbbox()
            if not bounds:
                return None
            left, y1, right, y2 = bounds
            padding = 10
            return band.crop((max(0, left - padding), max(0, y1 - padding), min(band.width, right + padding), min(band.height, y2 + padding)))

        persian_lockup = crop_band(logo, 0, int(logo.height * 0.66))
        account_lockup = crop_band(logo, int(logo.height * 0.66), logo.height)
        if persian_lockup:
            persian_lockup.thumbnail((520, 92), LANCZOS)
            canvas.paste(persian_lockup, (content_right - persian_lockup.width, brand_row_y + 25), persian_lockup)
        if account_lockup:
            account_lockup.thumbnail((420, 82), LANCZOS)
            account_y = brand_row_y + 42 + (persian_lockup.height if persian_lockup else 0)
            canvas.paste(account_lockup, (content_right - account_lockup.width, account_y), account_lockup)

        # A compact copy is placed inside the actual photo zone as well. This
        # remains visible even when the formal wordmark lives on a text panel.
        # It is particularly important for exact uploaded photos, where no AI
        # is allowed to infer or recreate the media identity.
        if text_layout == "side_panel":
            photo_right, photo_top = int(width * 0.38) - 18, 18
        else:
            photo_right, photo_top = width - 30, 24
        photo_persian = persian_lockup.copy() if persian_lockup else None
        photo_account = account_lockup.copy() if account_lockup else None
        if photo_persian:
            photo_persian.thumbnail((270, 50), LANCZOS)
            canvas.paste(photo_persian, (max(12, photo_right - photo_persian.width), photo_top), photo_persian)
        if photo_account:
            photo_account.thumbnail((235, 42), LANCZOS)
            canvas.paste(photo_account, (max(12, photo_right - photo_account.width), photo_top + (photo_persian.height if photo_persian else 0) + 7), photo_account)

    # The delivered PNG logo exports contain the English account identifier.
    # Pair it with the official circular profile mark so each design carries a
    # recognizable Persian media identity as well.
    profile_path = ASSET_DIR / "profiles" / brand["profile"]
    if profile_path.exists():
        profile = cover(Image.open(profile_path).convert("RGB"), 128, 128).convert("RGBA")
        mask = Image.new("L", (128, 128), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 127, 127), fill=255)
        profile.putalpha(mask)
        badge = Image.new("RGBA", (140, 140), (0, 0, 0, 0))
        ImageDraw.Draw(badge).ellipse((0, 0, 139, 139), fill=(255, 255, 255, 230))
        badge.paste(profile, (6, 6), profile)
        canvas.paste(badge, (content_left, brand_row_y + 27), badge)

    kicker = content.get("kicker", "").strip()
    if kicker:
        kicker_font = ImageFont.truetype(str(semibold), 30)
        draw.text((content_right, y), shape_text(kicker), font=kicker_font, fill=accent, anchor="ra", **TEXT_OPTIONS)
        y += 54

    title = content.get("title", "").strip()
    if title:
        title_x = content_right
        title_width = content_right - content_left
        if headline_style == "accent":
            # A differentiated hierarchy without decorative yellow rules that
            # can look misplaced on a red newsroom layout.
            title_x -= 28
            title_width -= 30
            start_size = 68 if height > 1500 else 56
            max_lines = 4 if height > 1500 else 3
        elif headline_style == "compact":
            y += 28
            start_size = 58 if height > 1500 else 48
            max_lines = 4 if height > 1500 else 3
        else:
            start_size = 74 if height > 1500 else 60
            max_lines = 3
        title_font, lines = fit_font(draw, title, title_width, start_size, 38, max_lines)
        if headline_style == "accent":
            # The former accent rule was too easy to mistake for an arbitrary
            # yellow line. Accent is now a true high-contrast headline card.
            # On the red brand this is a white card with red writing; on other
            # brands the same readable contrast principle is retained.
            line_step = title_font.size + 18
            box_top = y - 20
            box_bottom = y + len(lines) * line_step - 2
            draw.rounded_rectangle(
                (content_left - 18, box_top, content_right + 12, box_bottom),
                radius=24, fill="#ffffff",
            )
            title_colour = brand["colour"] if resolved_surface_tone(record) != "light" else "#17212b"
        else:
            title_colour = text_colour
        for line in lines:
            # Middle anchoring keeps the glyphs optically centred in the
            # emphasis card despite Peyda's Persian ascender/descender metrics.
            anchor = "rm" if headline_style == "accent" else "ra"
            text_y = y + (title_font.size + 18) // 2 if headline_style == "accent" else y
            draw.text((title_x, text_y), shape_text(line), font=title_font, fill=title_colour, anchor=anchor, **TEXT_OPTIONS)
            y += title_font.size + 18
        y += 8

    subtitle = content.get("subtitle", "").strip()
    if subtitle:
        subtitle_font = ImageFont.truetype(str(semibold), 34 if height > 1500 else 28)
        for line in text_lines(draw, subtitle, subtitle_font, content_right - content_left)[:3]:
            draw.text((content_right, y), shape_text(line), font=subtitle_font, fill=secondary_colour, anchor="ra", **TEXT_OPTIONS)
            y += subtitle_font.size + 13

    # Non-news templates carry structured facts. They are rendered by the
    # deterministic compositor (not invented by a model) so prayer times,
    # dates, riddles and market figures remain exactly as approved.
    template = request.get("format", {}).get("template", "")
    special_lines: list[str] = []
    if template == "morning_local":
        special_lines.extend(line.strip() for line in content.get("prayerTimes", "").splitlines() if line.strip())
        riddle = content.get("riddle", "").strip()
        if riddle:
            special_lines.append(f"معمای امروز: {riddle}")
    elif template == "morning_kalam":
        special_lines.extend(line.strip() for line in content.get("occasions", "").splitlines() if line.strip())
        riddle = content.get("riddle", "").strip()
        if riddle:
            special_lines.append(f"معمای امروز: {riddle}")
    elif template == "market":
        special_lines.extend(line.strip() for line in content.get("marketRates", "").splitlines() if line.strip())
    if special_lines:
        special_text = "\n".join(special_lines)
        special_font, lines, line_height = fit_paragraph(
            draw, special_text, semibold, content_right - content_left - 44,
            36 if height > 1500 else 29, 16, max(120, int(height * 0.30)),
        )
        special_height = min(max(82, len(lines) * line_height + 34), max(120, int(height * 0.30)))
        special_bounds = (content_left, y, content_right, y + special_height)
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(overlay).rounded_rectangle(special_bounds, radius=22, fill=(255, 255, 255, 54), outline=(255, 255, 255, 120), width=2)
        canvas.paste(overlay, (0, 0), overlay)
        draw = ImageDraw.Draw(canvas)
        draw_template_icon(draw, template, content_left + 18, y + 10, min(78, special_height - 20))
        text_y = y + 18
        for line in lines:
            if text_y + line_height > y + special_height - 8:
                break
            draw.text((content_right - 20, text_y), shape_text(line), font=special_font, fill="#ffffff" if resolved_surface_tone(record) != "light" else "#17212b", anchor="ra", **TEXT_OPTIONS)
            text_y += line_height
        y += special_height + 18

    interaction = content.get("interactionText", "").strip()
    source = content.get("source", "").strip()
    caption = content.get("caption", "").strip()
    # The interaction call-to-action owns the lowest card. Attribution gets
    # its own glass card just above it, never merged into a long footer line.
    footer_top = height - (190 if interaction and source else 128 if interaction or source else 48)
    if caption and y < footer_top:
        y += 12
        caption_font, lines, line_height = fit_paragraph(
            draw, caption, regular, content_right - content_left,
            54 if height > 1500 else 42, 16, max(36, footer_top - y - 12),
        )
        for line in lines:
            draw.text((content_right, y), shape_text(line), font=caption_font, fill=secondary_colour, anchor="ra", **TEXT_OPTIONS)
            y += line_height

    def glass_card(bounds: tuple[int, int, int, int], kind: str) -> None:
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        if kind == "source":
            overlay_draw.rounded_rectangle(bounds, radius=18, fill=(255, 255, 255, 76), outline=(255, 255, 255, 150), width=2)
        else:
            overlay_draw.rounded_rectangle(bounds, radius=20, fill=(15, 23, 32, 156), outline=(255, 255, 255, 88), width=2)
        canvas.paste(overlay, (0, 0), overlay)

    footer_font = ImageFont.truetype(str(semibold), 26 if height > 1500 else 22)
    if interaction:
        interaction_bounds = (content_left, height - 100, content_right, height - 48)
        glass_card(interaction_bounds, "interaction")
        draw = ImageDraw.Draw(canvas)
        draw.text((content_right - 16, height - 75), shape_text(interaction), font=footer_font, fill="#ffffff", anchor="rm", **TEXT_OPTIONS)
    if source:
        source_label = f"منبع: {source}"
        source_text_width = draw.textbbox((0, 0), shape_text(source_label), font=footer_font, **TEXT_OPTIONS)[2]
        source_width = max(150, min(480, source_text_width + 48))
        source_bounds = (content_left, height - (170 if interaction else 100), min(content_left + source_width, content_right), height - (118 if interaction else 48))
        glass_card(source_bounds, "source")
        draw = ImageDraw.Draw(canvas)
        draw.text((source_bounds[2] - 16, (source_bounds[1] + source_bounds[3]) // 2), shape_text(source_label), font=footer_font, fill="#ffffff", anchor="rm", **TEXT_OPTIONS)

    video_bounds = video_placeholder_bounds(record, width, height, brand_row_y, text_layout)
    if video_bounds:
        # PNG alpha hole: InShot and similar editors can place the real video
        # beneath this design layer without an AI-generated fake video frame.
        canvas = canvas.convert("RGBA")
        alpha = canvas.getchannel("A")
        ImageDraw.Draw(alpha).rounded_rectangle(video_bounds, radius=22, fill=0)
        canvas.putalpha(alpha)

    output = BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def claim_next_job() -> dict | None:
    jobs_dir = app.DATA_DIR / "jobs"
    candidates = []
    for path in jobs_dir.glob("*/request.json") if jobs_dir.exists() else []:
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("state") == "queued" and record.get("renderApproved") is True:
                candidates.append(record)
        except (OSError, json.JSONDecodeError):
            continue
    if not candidates:
        return None
    record = sorted(candidates, key=lambda item: item.get("updatedAt", item.get("createdAt", 0)))[0]
    app.append_job_event(record, "processing", "موتور تولید تصویر کار را آغاز کرد.")
    app.save_project(record)
    return record


def call_avalai(prompt: str, size: str, quality: str = "medium", model: str = "gpt-image-2.5-flare") -> dict:
    if not AVALAI_API_KEY:
        raise RuntimeError("KALAM_AVALAI_API_KEY is not configured")
    payload = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "quality": quality,
        "n": 1,
        "response_format": "b64_json",
    }
    request = urllib.request.Request(
        AVALAI_IMAGE_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {AVALAI_API_KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.loads(response.read().decode("utf-8"))
            # Keep the provider request id alongside the payload.  It makes a
            # paid image generation auditable and lets us associate the usage
            # shown in the studio with AvalAI's own response.
            payload["_avalai_request_id"] = response.headers.get("x-request-id", "")
            return payload
    except urllib.error.HTTPError as exc:
        raise provider_http_error(exc, "AvalAI image") from exc


def gemini_aspect_ratio(size: str) -> str:
    try:
        width, height = (int(part) for part in size.lower().split("x", 1))
    except (TypeError, ValueError):
        return "9:16"
    if width == height:
        return "1:1"
    if width * 5 == height * 4:
        return "4:5"
    return "9:16" if width * 16 == height * 9 else ("4:5" if height > width else "1:1")


def avalai_image_size(size: str, model: str) -> str:
    """Keep the requested Studio aspect ratio for the native image model."""
    if not model.startswith("gpt-image-") or size in {"1024x1024", "auto"}:
        return size
    try:
        width, height = (int(part) for part in size.lower().split("x", 1))
    except (TypeError, ValueError):
        return "1024x1536"
    if width < 256 or height < 256 or width % 16 or height % 16:
        return "1024x1536" if height > width else "1536x1024"
    return f"{width}x{height}"


def provider_http_error(exc: urllib.error.HTTPError, service: str) -> RuntimeError:
    """Return a bounded diagnostic without leaking an upstream HTML page.

    AvalAI/Cloudflare occasionally responds with its full `error-section`
    document.  That markup is neither useful to editors nor safe to persist in
    a project record, so only a compact JSON message is retained when present.
    """
    raw = exc.read(2048).decode("utf-8", errors="replace").strip()
    detail = "upstream HTML error page"
    if raw.startswith("{"):
        try:
            value = json.loads(raw)
            candidate = value.get("error") if isinstance(value, dict) else None
            if isinstance(candidate, dict):
                candidate = candidate.get("message")
            if candidate:
                detail = re.sub(r"\s+", " ", str(candidate)).strip()[:300]
        except json.JSONDecodeError:
            pass
    return RuntimeError(f"{service} returned HTTP {exc.code}: {detail}")


def transient_provider_failure(exc: Exception) -> bool:
    text = str(exc).lower()
    # A depleted AvalAI balance is deterministic and must never be retried:
    # repeated paid attempts only delay the editor and produce the same 429.
    if "insufficient credit" in text or "remaining balance" in text or "credit to complete this request" in text:
        return False
    return any(marker in text for marker in (
        "http 408", "http 429", "http 500", "http 502", "http 503", "http 504",
        "timed out", "temporarily unavailable", "provider_unavailable",
        "provider_empty_response", "no image bytes",
    ))


def selected_image_model(record: dict) -> str:
    """Use the single image-engine choice saved in the request by Gateway.

    Queued work stays reproducible: changing Settings later cannot silently
    change the model of a request that has already been accepted.
    """
    request = record.get("request", {})
    image = request.get("image", {}) if isinstance(request, dict) else {}
    selected = str(image.get("engine", "")) if isinstance(image, dict) else ""
    if selected in {"gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"}:
        return selected
    return AVALAI_IMAGE_FULL_MODEL


def selected_image_quality(record: dict, model: str, transparent: bool = False) -> str:
    """Use economical GPT quality by default without downgrading alpha jobs."""
    image = (record.get("request") or {}).get("image") or {}
    requested = str(image.get("quality", "")).strip() if isinstance(image, dict) else ""
    if transparent:
        return "auto"
    if model in {"gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"} and requested in {"low", "medium", "high", "xhigh", "max"}:
        return requested
    return "medium"


def call_avalai_gemini_image(prompt: str, image: bytes, size: str, model: str) -> dict:
    """Generate or edit through AvalAI's Gemini-compatible chat endpoint.

    The native Gemini generation config is deliberately open: no safety,
    style, token or content restrictions are imposed here.  The only bounded
    parameter is the editor's requested canvas aspect ratio.
    """
    if not AVALAI_API_KEY:
        raise RuntimeError("KALAM_AVALAI_API_KEY is not configured")
    image_url = "data:image/png;base64," + base64.b64encode(image).decode("ascii")
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]}],
        "modalities": ["image", "text"],
        # ``extra_body`` is an OpenAI-SDK argument whose contents are merged
        # into the outgoing JSON. This is raw HTTP, so Gemini configuration
        # must be top-level or the requested aspect ratio is ignored.
        "generationConfig": {"imageConfig": {"aspectRatio": gemini_aspect_ratio(size)}},
    }
    request = urllib.request.Request(
        AVALAI_CHAT_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {AVALAI_API_KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            result = json.loads(response.read().decode("utf-8"))
            result["_avalai_request_id"] = response.headers.get("x-request-id", "")
            result["_kalam_selected_model"] = model
            return result
    except urllib.error.HTTPError as exc:
        raise provider_http_error(exc, "AvalAI Gemini") from exc


def call_avalai_edit(prompt: str, image: bytes, size: str, model: str, transparent: bool = False, quality: str = "medium") -> dict:
    if model.startswith("gemini-"):
        return call_avalai_gemini_image(prompt, image, size, model)
    if not AVALAI_API_KEY:
        raise RuntimeError("KALAM_AVALAI_API_KEY is not configured")
    boundary = f"----KalamDesign{int(time.time() * 1000)}"
    parts: list[bytes] = []
    def field(name: str, value: str) -> None:
        parts.extend([f"--{boundary}\r\n".encode(), f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(), value.encode("utf-8"), b"\r\n"])
    field("model", model)
    field("prompt", prompt)
    field("size", avalai_image_size(size, model))
    field("quality", quality)
    # AvalAI's GPT Image edit API requires the output count as multipart data.
    # A Studio job deliberately produces one final deliverable.
    field("n", "1")
    # GPT Image edit routes return their native payload. AvalAI rejects the
    # legacy response_format multipart field for GPT Image 2 and 2.5 alike.
    if transparent:
        field("background", "transparent")
        field("output_format", "png")
    parts.extend([f"--{boundary}\r\n".encode(), b'Content-Disposition: form-data; name="image"; filename="source.png"\r\n', b"Content-Type: image/png\r\n\r\n", image, b"\r\n", f"--{boundary}--\r\n".encode()])
    request = urllib.request.Request(AVALAI_IMAGE_EDIT_URL, data=b"".join(parts), method="POST", headers={"Authorization": f"Bearer {AVALAI_API_KEY}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.loads(response.read().decode("utf-8"))
            payload["_avalai_request_id"] = response.headers.get("x-request-id", "")
            payload["_kalam_selected_model"] = model
            return payload
    except urllib.error.HTTPError as exc:
        raise provider_http_error(exc, "AvalAI edit") from exc


def parent_photo(record: dict) -> bytes:
    parent_id, filename = record.get("parentRequestId"), record.get("parentOutputFilename")
    if not parent_id or not filename:
        raise RuntimeError("The image-edit source is missing")
    source = app.project_directory(parent_id) / "outputs" / filename
    image = Image.open(source).convert("RGB")
    photo = image.crop((0, 0, image.width, int(image.height * .45)))
    output = BytesIO(); photo.save(output, format="PNG")
    return output.getvalue()


def parent_background(record: dict) -> bytes:
    parent_id, filename = record.get("parentRequestId"), record.get("parentOutputFilename")
    if not parent_id or not filename or Path(filename).name != filename:
        raise RuntimeError("The render-edit source is missing")
    source = app.project_directory(parent_id) / "outputs" / filename
    if not source.exists():
        raise RuntimeError("The render-edit source file is missing")
    return source.read_bytes()


def uploaded_background(record: dict) -> bytes:
    """Build an exact, non-generative composition from every uploaded photo."""
    uploaded = record.get("uploadedImages", [])
    if not uploaded:
        raise RuntimeError("برای استفادهٔ واقعی، حداقل یک عکس پیوست کنید.")
    images: list[Image.Image] = []
    for item in uploaded:
        filename = item.get("filename", "")
        if Path(filename).name != filename:
            continue
        target = app.project_directory(record["requestId"]) / "uploads" / filename
        if target.exists():
            images.append(Image.open(target).convert("RGB"))
    if not images:
        raise RuntimeError("فایل‌های عکس پیوست‌شده پیدا نشدند.")
    width, height = 1024, 1536
    source_shape = record.get("request", {}).get("image", {}).get("sourceShape", "auto")
    if len(images) == 1:
        # The editor may explicitly describe the source, but no mode is ever
        # allowed to crop out real content in renderer-only work.
        canvas = fitted_photo(images[0], width, height)
    else:
        canvas = Image.new("RGB", (width, height), "#111111")
        columns = 2
        rows = (len(images) + columns - 1) // columns
        cell_width = width // columns
        cell_height = height // rows
        for index, image in enumerate(images):
            column, row = index % columns, index // columns
            canvas.paste(fitted_photo(image, cell_width, cell_height), (column * cell_width, row * cell_height))
    output = BytesIO(); canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def header_asset_path(brand_id: str) -> Path | None:
    """Find the optional AI reference masthead for a media brand.

    The user can add one PNG per brand without a deployment.  We accept both
    the concise production name and a readable ``*-header`` variant.
    """
    for candidate in (
        ASSET_DIR / "headers" / f"{brand_id}.png",
        ASSET_DIR / "headers" / f"{brand_id}-header.png",
        ASSET_DIR / "brands" / brand_id / "header.png",
    ):
        if candidate.is_file():
            return candidate
    return None


def ai_reference_board(record: dict) -> bytes:
    """Create an input-only identity/reference sheet for the image model.

    This is never delivered to the editor and is not a renderer.  It simply
    gives the model the real masthead/logo and every uploaded reference photo
    in one image-edit request, where the provider API accepts one image field.
    """
    request = record["request"]
    # The exact masthead is intentionally withheld from the image model and
    # pinned once after generation. This removes the source of duplicated
    # logos, lines and model-authored header copy.
    canvas = Image.new("RGBA", (1024, 1536), (255, 255, 255, 0))
    draw = ImageDraw.Draw(canvas)
    header_height = 0
    uploaded: list[tuple[str, Image.Image]] = []
    user_uploaded: list[tuple[str, Image.Image]] = []
    continuity_uploaded: list[tuple[str, Image.Image]] = []
    studio_assets: list[tuple[dict, Image.Image]] = []
    for item in record.get("uploadedImages", []):
        filename = item.get("filename", "")
        target = app.project_directory(record["requestId"]) / "uploads" / filename
        if Path(filename).name == filename and target.is_file():
            item_role = str(item.get("role") or "")
            role = (
                "MONITOR CONTENT — CURRENT SLIDE; PRESERVE PIXELS AND TEXT"
                if item_role == "monitor_reference"
                else "PUZZLE ASSET"
                if item_role == "puzzle"
                else "SERIES CONTINUITY — STYLE/IDENTITY/GRID ONLY; NEVER COPY CONTENT"
                if item_role == "series_previous_slide"
                else "USER REFERENCE — CURRENT SLIDE; AUTHORITATIVE CONTENT"
            )
            entry = (role, Image.open(target).convert("RGB"))
            uploaded.append(entry)
            (continuity_uploaded if item_role == "series_previous_slide" else user_uploaded).append(entry)
    if resolved_logo_behavior(record) == "floating_profile":
        profile_path = brand_profile_path(str(request.get("brand", "kalametaze")))
        if profile_path:
            profile_photo = Image.open(profile_path).convert("RGB")
            profile_entry = ("BRAND PROFILE — PRESERVE EXACTLY; CIRCULAR FLOATING PLACEMENT", profile_photo)
            uploaded.append(profile_entry)
            user_uploaded.append(profile_entry)
    studio = request.get("format", {}).get("studio", {})
    studio_image_request = request.get("format", {}).get("family") == "studio" or request.get("image", {}).get("mode") == "studio"
    if studio_image_request and isinstance(studio, dict):
        reference_assets = app.selected_studio_image_reference_assets(request) if hasattr(app, "selected_studio_image_reference_assets") else []
        missing: list[str] = []
        # A generated location deliberately has no image asset.  `locationId`
        # remains in the contract as a UI/category value, but it must not turn
        # into a fictitious required reference (for example, `newsroom`) when
        # the editor has asked the model to create a metro station from text.
        location = studio.get("location", {}) if isinstance(studio.get("location"), dict) else {}
        location_mode = str(location.get("mode") or "catalog")
        expected = [("presenter", str(item)) for item in studio.get("presenterIds", [])]
        if location_mode in {"catalog", "exact_reference", "faithful_reference"}:
            expected.append(("location", str(studio.get("locationId", ""))))
        selected_keys = {(str(item.get("kind")), str(item.get("entityId"))) for item in reference_assets}
        missing.extend(entity_id for kind, entity_id in expected if (kind, entity_id) not in selected_keys)
        for asset in reference_assets:
            try:
                photo = Image.open(app.video_asset_path(asset)).convert("RGB")
                role = "PRESENTER IDENTITY" if asset.get("kind") == "presenter" else "LOCATION GEOMETRY"
                uploaded.append((role, photo))
                studio_assets.append((asset, photo))
            except (app.ClientError, OSError):
                missing.append(str(asset.get("entityId", "")))
                continue
        if missing:
            raise RuntimeError("studio_reference_missing:" + ",".join(missing))
    elif hasattr(app, "selected_design_presenter_reference_assets"):
        reference_assets = app.selected_design_presenter_reference_assets(request)
        expected_presenters = [str(item) for item in request.get("image", {}).get("presenterIds", [])]
        selected_presenters = {str(item.get("entityId")) for item in reference_assets}
        missing = [item for item in expected_presenters if item not in selected_presenters]
        for asset in reference_assets:
            try:
                uploaded.append(("PRESENTER IDENTITY", Image.open(app.video_asset_path(asset)).convert("RGB")))
            except (app.ClientError, OSError):
                missing.append(str(asset.get("entityId", "")))
        if missing:
            raise RuntimeError("design_presenter_reference_missing:" + ",".join(sorted(set(missing))))
    if len(uploaded) > app.STUDIO_IMAGE_REFERENCE_LIMIT:
        raise RuntimeError(f"image_reference_limit:{len(uploaded)}>{app.STUDIO_IMAGE_REFERENCE_LIMIT}")
    if studio_image_request and studio_assets:
        # Spatial hierarchy matters more than a visually uniform contact
        # sheet. The first location is the master camera/geometry plate and
        # must dominate the board; small character cards are identity or pose
        # evidence only. Equal-sized cells encouraged the model to copy a
        # white-background portrait's placement and paste it over the set.
        locations = [(asset, photo) for asset, photo in studio_assets if asset.get("kind") == "location"]
        presenters = [(asset, photo) for asset, photo in studio_assets if asset.get("kind") == "presenter"]
        if locations:
            canvas = Image.new("RGB", (1024, 1536), (17, 20, 24))
            draw = ImageDraw.Draw(canvas)
            label_font = ImageFont.truetype(str(peyda_font_path("bold")), 19)
            master_asset, master_photo = locations[0]
            draw.text((24, 18), "MASTER SCENE — COPY CAMERA, GEOMETRY, LIGHT, FURNITURE AND OCCLUSION", font=label_font, fill=(255, 215, 96))
            master_top, master_bottom = 54, 1068
            contained = ImageOps.contain(master_photo, (976, master_bottom - master_top), LANCZOS)
            master_x = (1024 - contained.width) // 2
            master_y = master_top + (master_bottom - master_top - contained.height) // 2
            canvas.paste(contained, (master_x, master_y))
            draw.rectangle((master_x - 2, master_y - 2, master_x + contained.width + 1, master_y + contained.height + 1), outline=(255, 215, 96), width=2)

            secondary: list[tuple[str, Image.Image]] = []
            for asset, photo in presenters:
                profile = app.video_asset_profile(asset) if hasattr(app, "video_asset_profile") else {}
                if profile.get("role") in {"identity", "portrait"}:
                    label = "IDENTITY ONLY — DO NOT COPY BACKGROUND, SCALE OR PLACEMENT"
                else:
                    label = "POSE CUE ONLY — DO NOT COPY BACKGROUND OR COMPOSITION"
                secondary.append((label, photo))
            for asset, photo in locations[1:]:
                secondary.append(("LOCATION DETAIL ONLY — DO NOT MIX CAMERA ANGLES", photo))
            secondary.extend(user_uploaded)
            secondary.extend(continuity_uploaded)
            if secondary:
                cols = 2 if len(secondary) <= 4 else 3
                rows = (len(secondary) + cols - 1) // cols
                gap, side = 12, 24
                cell_w = (1024 - side * 2 - gap * (cols - 1)) // cols
                cell_h = (1536 - 1092 - gap * (rows - 1)) // rows
                for index, (role, photo) in enumerate(secondary):
                    col, row = index % cols, index // cols
                    cell_x = side + col * (cell_w + gap)
                    cell_y = 1092 + row * (cell_h + gap)
                    title_h = 42
                    compact_font = ImageFont.truetype(str(peyda_font_path("bold")), 13 if cols == 3 else 15)
                    draw.text((cell_x + 6, cell_y + 8), role, font=compact_font, fill=(235, 240, 245))
                    contained = ImageOps.contain(photo, (cell_w - 8, max(1, cell_h - title_h - 6)), LANCZOS)
                    x = cell_x + (cell_w - contained.width) // 2
                    y = cell_y + title_h + (cell_h - title_h - contained.height) // 2
                    canvas.paste(contained, (x, y))
                    draw.rectangle((cell_x, cell_y, cell_x + cell_w - 1, cell_y + cell_h - 1), outline=(82, 94, 106), width=1)
            output = BytesIO(); canvas.save(output, format="PNG", optimize=True)
            return output.getvalue()
    if uploaded:
        available_height = 1536 - header_height - 44
        if len(uploaded) == 1:
            # Never crop a user reference before it reaches the model.  The
            # full image is pixel evidence; transparent padding is preferable
            # to silently deleting an edge with ``ImageOps.fit``.
            role, photo = uploaded[0]
            label_height = 46
            contained = ImageOps.contain(photo, (960, max(1, available_height - label_height)), LANCZOS)
            x = (1024 - contained.width) // 2
            y = header_height + 12 + label_height + (available_height - label_height - contained.height) // 2
            label_font = ImageFont.truetype(str(peyda_font_path("bold")), 24)
            draw.text((32, header_height + 18), role, font=label_font, fill=(255, 255, 255, 255))
            canvas.paste(contained, (x, y))
        else:
            cols, rows = 2, (len(uploaded) + 1) // 2
            cell_w, cell_h = 472, max(160, (available_height - (rows - 1) * 14) // rows)
            for index, (role, photo) in enumerate(uploaded):
                col, row = index % cols, index // cols
                label_height = 34
                contained = ImageOps.contain(photo, (cell_w, max(1, cell_h - label_height)), LANCZOS)
                cell_x = 32 + col * (cell_w + 16)
                cell_y = header_height + 12 + row * (cell_h + 14)
                label_font = ImageFont.truetype(str(peyda_font_path("bold")), 18)
                draw.text((cell_x, cell_y + 4), role, font=label_font, fill=(255, 255, 255, 255))
                canvas.paste(contained, (cell_x + (cell_w - contained.width) // 2, cell_y + label_height + (cell_h - label_height - contained.height) // 2))
    else:
        # A restrained identity board still anchors generated designs in the
        # correct brand when no user image is attached.
        draw.rounded_rectangle((32, header_height + 12, 992, 1492), radius=36, outline=(255, 255, 255), width=3)
    output = BytesIO(); canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()


def renderer_background(record: dict) -> bytes:
    """A plain, branded-safe base for templates deliberately created without photos."""
    surface_rgb, *_ = surface_colours(record, BRANDS.get(record.get("request", {}).get("brand"), BRANDS["kalametaze"]))
    image = Image.new("RGB", (1024, 1536), surface_rgb)
    output = BytesIO(); image.save(output, format="PNG")
    return output.getvalue()


def avalai_usage(response: dict) -> dict:
    """Normalize the usage fields returned by AvalAI without inventing cost.

    AvalAI labels both ``estimated_cost.irt`` and ``paid_irt`` as IRT (toman),
    so the browser must display this amount directly — never divide it by ten.
    The Gateway verifies the provisional amount against User API after the
    provider's documented accounting delay.
    """
    usage = response.get("usage") or {}
    estimated = response.get("estimated_cost") or {}
    normalized = {
        "promptTokens": usage.get("prompt_tokens", usage.get("input_tokens")),
        "completionTokens": usage.get("completion_tokens", usage.get("output_tokens")),
        "totalTokens": usage.get("total_tokens", usage.get("totalTokens")),
        "costIrt": estimated.get("irt"),
        "costVerified": False,
        # Some AvalAI-compatible responses expose the remaining balance. Keep
        # it only when the provider actually returns it; never estimate it.
        "balanceIrt": response.get("balance_irt", response.get("remaining_balance_irt")),
        "requestId": response.get("_avalai_request_id", ""),
        "model": response.get("_kalam_selected_model", response.get("model", "")),
    }
    # Image endpoints may omit estimated_cost even after a successful paid
    # response. The transaction endpoint is AvalAI's authoritative source.
    request_id = normalized["requestId"]
    if normalized["costIrt"] is None and request_id:
        try:
            lookup = urllib.request.Request(
                "https://api.avalai.ir/user/v1/transactions/lookup",
                data=json.dumps({"transaction_ids": [request_id]}).encode("utf-8"),
                method="POST",
                headers={"Authorization": f"Bearer {AVALAI_API_KEY}", "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(lookup, timeout=15) as transaction_response:
                transaction = json.loads(transaction_response.read().decode("utf-8"))
            found = (transaction.get("transactions") or [{}])[0]
            normalized["costIrt"] = (found.get("cost") or {}).get("paid_irt")
            normalized["costVerified"] = normalized["costIrt"] is not None
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, json.JSONDecodeError):
            pass
    return normalized


def decoded_background(response: dict) -> tuple[bytes, str, dict]:
    item = (response.get("data") or [{}])[0]
    encoded = item.get("b64_json")
    revised_prompt = item.get("revised_prompt", "")
    provider_url = item.get("url")
    if not encoded and isinstance(provider_url, str) and provider_url.startswith("https://"):
        try:
            image_request = urllib.request.Request(
                provider_url,
                headers={
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "User-Agent": "Mozilla/5.0 (Kalam Studio image worker)",
                },
            )
            with urllib.request.urlopen(image_request, timeout=90) as image_response:
                image = image_response.read()
            if len(image) >= 1024:
                return image, revised_prompt, avalai_usage(response)
        except urllib.error.URLError as exc:
            raise RuntimeError("AvalAI image URL could not be downloaded") from exc
    if not encoded:
        # Gemini image responses use the OpenAI-compatible chat shape.  Their
        # image URL is normally a data URL, but an ordinary HTTPS URL is also
        # accepted to remain compatible with future AvalAI response variants.
        message = ((response.get("choices") or [{}])[0].get("message") or {})
        images = message.get("images") or []
        image_url = ((images[0].get("image_url") or {}).get("url") if images else "")
        revised_prompt = revised_prompt or str(message.get("content") or "")
        if image_url.startswith("data:image") and "," in image_url:
            encoded = image_url.split(",", 1)[1]
        elif image_url.startswith("https://"):
            try:
                with urllib.request.urlopen(image_url, timeout=90) as image_response:
                    image = image_response.read()
                if len(image) >= 1024:
                    return image, revised_prompt, avalai_usage(response)
            except urllib.error.URLError as exc:
                raise RuntimeError("AvalAI Gemini image URL could not be downloaded") from exc
    if not encoded:
        content = revised_prompt.lower()
        if any(marker in content for marker in ("error-section", "gateway timeout", "temporarily unavailable", "please try again")):
            raise RuntimeError("provider_unavailable: AvalAI returned an upstream error page without image bytes")
        raise RuntimeError("provider_empty_response: AvalAI returned no image bytes")
    try:
        image = base64.b64decode(encoded, validate=True)
    except ValueError as exc:
        raise RuntimeError("AvalAI image data is invalid") from exc
    if len(image) < 1024:
        raise RuntimeError("AvalAI returned an unexpectedly small image")
    return image, revised_prompt, avalai_usage(response)


def staged_background(record: dict) -> tuple[bytes, str, dict] | None:
    """Return a durable AI-only output from this attempt, if one exists."""
    attempt = int(record.get("attempt", 1))
    for item in reversed(record.get("outputs", [])):
        if item.get("kind") != "ai_design" or item.get("attempt") != attempt:
            continue
        filename = item.get("filename", "")
        target = app.project_directory(record["requestId"]) / "outputs" / filename
        if Path(filename).name == filename and target.exists():
            return target.read_bytes(), item.get("revisedPrompt", ""), item.get("usage", {})
    return None


def persist_background(record: dict, background: bytes, revised_prompt: str, kind: str = "generated_background", usage: dict | None = None) -> None:
    output_dir = app.project_directory(record["requestId"]) / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True, mode=0o750)
    filename = f"attempt-{record.get('attempt', 1)}-background.png"
    target = output_dir / filename
    temporary = target.with_suffix(".tmp")
    temporary.write_bytes(background)
    os.chmod(temporary, 0o640)
    temporary.replace(target)
    record["intermediates"] = [
        item for item in record.get("intermediates", [])
        if item.get("filename") != filename
    ]
    record.setdefault("intermediates", []).append({
        "kind": kind,
        "filename": filename,
        "mimeType": "image/png",
        "bytes": len(background),
        "createdAt": int(time.time()),
        "attempt": record.get("attempt", 1),
        "revisedPrompt": revised_prompt,
        "usage": usage or {},
    })


def persist_output(record: dict, image: bytes, revised_prompt: str, usage: dict | None = None) -> None:
    output_dir = app.project_directory(record["requestId"]) / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True, mode=0o750)
    filename = f"attempt-{record.get('attempt', 1)}-{int(time.time())}.png"
    target = output_dir / filename
    temporary = target.with_suffix(".tmp")
    temporary.write_bytes(image)
    os.chmod(temporary, 0o640)
    temporary.replace(target)
    record.setdefault("outputs", []).append({
        "filename": filename,
        "mimeType": "image/png",
        "bytes": len(image),
        "createdAt": int(time.time()),
        "attempt": record.get("attempt", 1),
        "kind": "ai_design",
        "revisedPrompt": revised_prompt,
        "usage": usage or {},
    })


def process(record: dict) -> None:
    try:
        current = app.load_project(record["requestId"])
        # Retained only to open already-completed historical jobs. New jobs no
        # longer have a deterministic or chroma-key transparency route.
        if is_video_title_sticker(current):
            image = compose_video_title_sticker(current)
            revised_prompt = "deterministic_video_title_overlay"
            usage = {"model": "deterministic_video_title_overlay", "providerCalled": False}
            verify_native_video_alpha(current, image)
            app.append_job_event(current, "processing", "لایهٔ تیتر ویدیوییِ شفاف به‌صورت دقیق و بدون ظاهر استیکری ساخته شد.")
            app.save_project(current)
        elif False and is_transparent_portrait_video_overlay(current) and bool(
            current.get("request", {}).get("format", {}).get("news", {}).get("deterministicOverlay")
        ):
            # Do not ask the provider to draw a chroma matte and then try to
            # guess which pink pixels it meant.  This is a genuine RGBA
            # composition from its first pixel, so every image mode — new AI
            # image, reference or faithful reference — gets an edit-ready
            # transparent 9:16 video region.
            image = compose_transparent_portrait_video_overlay(current)
            revised_prompt = "vertical_video_overlay_rendered_with_real_rgba_alpha"
            usage = {"model": "deterministic_rgba_overlay", "providerCalled": False}
            app.append_job_event(current, "processing", "لایهٔ عمودی با کانال آلفای واقعی ساخته می‌شود؛ هیچ پس‌زمینه یا شطرنجیِ ساختگی تولید نخواهد شد.")
            app.save_project(current)
        else:
            native_video_alpha = requires_native_video_alpha(current)
            staged = None if native_video_alpha else staged_background(current)
            if staged:
                image, revised_prompt, usage = staged
                app.append_job_event(current, "processing", "خروجی هوش مصنوعیِ همین تلاش از بایگانی بازیابی شد؛ درخواست جدیدی به مدل ارسال نمی‌شود.")
                app.save_project(current)
            else:
                model = selected_image_model(current)
                quality = selected_image_quality(current, model, native_video_alpha)
                if native_video_alpha and model not in {"gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"}:
                    raise RuntimeError("native_video_alpha_requires_gpt_image_model")
                app.append_job_event(current, "processing", f"مدل انتخاب‌شده برای این درخواست: {model} · کیفیت: {quality}")
                app.save_project(current)
                if current.get("operation") == "recompose":
                    raise RuntimeError("ویرایش قالب رندر در نسخهٔ AI-only غیرفعال شده است؛ از ویرایش تصویر با دستور متنی استفاده کنید.")
                prompt = render_prompt(current)
                source_image = parent_background(current) if current.get("operation") == "visual_edit" else ai_reference_board(current)
                # Cloudflare/AvalAI can transiently return 502/503/504 HTML or a
                # JSON chat response without image bytes. Retry transport
                # failures, but never swap the globally selected model.
                for provider_attempt in range(3):
                    try:
                        response = call_avalai_edit(prompt, source_image, render_size(current), model, transparent=native_video_alpha, quality=quality)
                        image, revised_prompt, usage = decoded_background(response)
                        if native_video_alpha:
                            verify_native_video_alpha(current, image)
                        break
                    except Exception as provider_exc:
                        if provider_attempt >= 2 or not transient_provider_failure(provider_exc):
                            raise
                        wait_seconds = 4 if provider_attempt == 0 else 10
                        app.append_job_event(
                            current,
                            "processing",
                            f"پاسخ موقت سرویس تصویر ناقص بود؛ بازیابی خودکار {provider_attempt + 2} از ۳ پس از {wait_seconds} ثانیه با همان مدل انجام می‌شود.",
                        )
                        app.save_project(current)
                        time.sleep(wait_seconds)
        current = app.load_project(record["requestId"])
        # Keep the model-authored raster before the deterministic masthead is
        # composited. Editors can download this clean version when the model
        # did not leave enough room for the official header.
        persist_background(current, image, revised_prompt, usage=usage)
        finalized_image = apply_exact_header(current, image)
        persist_output(current, finalized_image, revised_prompt, usage)
        app.append_job_event(current, "processing", "طرح کامل هوش مصنوعی با موفقیت و به‌صورت پایدار ذخیره شد.")
        app.save_project(current)
        if current.get("state") == "cancel_requested":
            app.append_job_event(current, "cancelled", "تولید پس از درخواست لغو پایان یافت؛ خروجی برای بازیابی نگه‌داری شد.")
        else:
            app.append_job_event(current, "completed", "تصویر با موفقیت ساخته و بایگانی شد.")
        app.save_project(current)
        owner_id = str(current.get("ownerId") or "")
        if owner_id:
            app.notify_browser("designComplete", "تصویر آماده شد", str(current.get("title") or "خروجی تصویر شما آماده است."), "?tab=library", {owner_id})
    except Exception as exc:
        current = app.load_project(record["requestId"])
        raw_error = str(exc)
        if "studio_reference_missing" in raw_error:
            missing_ids = raw_error.split("studio_reference_missing:", 1)[-1].strip(" ,")
            missing_labels = {"kamran": "کامران", "tara": "تارا", "mojtaba_jafari": "مجتبی جعفری", "hamidreza_jafari": "حمیدرضا جعفری", "newsroom": "لوکیشن تحریریه", "studio_main": "استودیو با مانیتور بزرگ", "studio_2": "استودیو شمارهٔ ۲", "terrace": "تراس", "living_room": "اتاق نشیمن"}
            readable_missing = "، ".join(missing_labels.get(item.strip(), item.strip()) for item in missing_ids.split(",") if item.strip())
            friendly_error = f"مرجع تصویری لازم برای {readable_missing or 'کاراکتر یا لوکیشن'} به درخواست نرسیده است. انتخاب نام کاراکتر به‌تنهایی کافی نیست؛ یک تصویر مرجع معتبر برای هر مورد انتخاب کنید. هیچ چهرهٔ جایگزین یا ساختگی تولید نشد."
            error_code = "studio_reference_missing"
        elif "native_video_alpha_requires_gpt_image_model" in raw_error:
            friendly_error = "برای PNG شفافِ ویدیو یا استیکر، یکی از مدل‌های GPT Image را انتخاب کنید؛ این مدل‌ها کانال آلفای واقعی می‌سازند."
            error_code = "native_video_alpha_requires_gpt_image_model"
        elif "native_video_alpha_not_detected" in raw_error:
            friendly_error = "مدل GPT Image این‌بار پنجرهٔ ویدیوییِ شفاف تحویل نداد؛ خروجیِ غیرشفاف ذخیره نشد. «تلاش مجدد» را بزنید."
            error_code = "native_video_alpha_not_detected"
        elif "native_sticker_alpha_not_detected" in raw_error:
            friendly_error = "مدل GPT Image این‌بار استیکر با زمینهٔ شفاف تحویل نداد؛ خروجیِ غیرشفاف ذخیره نشد. «تلاش مجدد» را بزنید."
            error_code = "native_sticker_alpha_not_detected"
        elif "drop_params" in raw_error.lower():
            friendly_error = "مسیر ویرایش AvalAI پاسخ ناسازگار داد. اطلاعات پروژه محفوظ است؛ «تلاش مجدد» را بزنید. اگر تکرار شد، مشکل از سرویس واسط است و جزئیات آن ثبت شده است."
            error_code = "provider_edit_route_incompatible"
        elif "quota_exceeded" in raw_error or "credit has been exhausted" in raw_error or "insufficient credit" in raw_error.lower() or "remaining balance" in raw_error.lower():
            friendly_error = "اعتبار AvalAI برای ساخت تصویر تمام شده است. پس از افزایش اعتبار، «تلاش مجدد» را بزنید؛ اطلاعات و عکس‌های پروژه محفوظ مانده‌اند."
            error_code = "provider_quota_exceeded"
        elif any(marker in raw_error.lower() for marker in (
            "rejected by the safety system",
            "safety system",
            "content_policy_violation",
            "content policy",
        )):
            # A repeated submission with the same prompt/reference is rejected
            # again by the provider.  Do not disguise this as a transient
            # failure: tell the editor what can actually be changed.
            friendly_error = "سرویس تصویرساز این متن یا تصویر مرجع را با فیلتر ایمنی رد کرد. «تلاش مجدد» با همان اطلاعات نتیجه‌ای ندارد؛ تصویر مرجع یا متن را تغییر دهید، یا برای طرح گرافیکی بدون عکس مرجع یک درخواست تازه بسازید."
            error_code = "provider_safety_rejected"
        elif "HTTP 429" in raw_error:
            friendly_error = "سرویس تصویرساز موقتاً درخواست‌های زیادی دریافت کرده است. چند دقیقه بعد «تلاش مجدد» را بزنید؛ پروژه محفوظ مانده است."
            error_code = "provider_rate_limited"
        elif "HTTP 401" in raw_error or "HTTP 403" in raw_error:
            friendly_error = "اتصال AvalAI برای ساخت تصویر معتبر نیست. کلید یا دسترسی سرویس را در تنظیمات سرور بررسی کنید."
            error_code = "provider_auth_failed"
        elif any(marker in raw_error.lower() for marker in ("timed out", "unavailable", "provider_empty_response", "no image bytes", "http 502", "http 503", "http 504")):
            friendly_error = "ارتباط با سرویس تصویرساز موقتاً برقرار نشد. چند دقیقه بعد «تلاش مجدد» را بزنید؛ پروژه محفوظ مانده است."
            error_code = "provider_unavailable"
        else:
            friendly_error = "ساخت تصویر کامل نشد. اطلاعات پروژه محفوظ است؛ «تلاش مجدد» را بزنید یا با تنظیمات دیگر یک نسخه تازه بسازید."
            error_code = "generation_failed"
        app.append_job_event(current, "failed", friendly_error)
        # Never expose Cloudflare/AvalAI HTML or provider internals in the UI.
        current["error"] = friendly_error
        current["errorCode"] = error_code
        app.save_project(current)
        print(f"Kalam design job {record['requestId']} failed: {exc!r}\n{traceback.format_exc()}", flush=True)


def main() -> None:
    print("Kalam design worker started", flush=True)
    while True:
        job = claim_next_job()
        if job:
            process(job)
        else:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
