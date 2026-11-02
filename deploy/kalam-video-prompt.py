"""Canonical, provider-neutral prompt compiler for Kalam's presenter videos."""
from __future__ import annotations

PRESENTERS = {"kamran": "کامران", "tara": "تارا", "mojtaba_jafari": "مجتبی جعفری", "hamidreza_jafari": "حمیدرضا جعفری"}
VEO_MODELS = {
    # AvalAI publishes the -001 variants as the stable Veo 3.1 surface.
    # Preview variants are still listed but are being deprecated and have
    # shown intermittent internal-provider failures in production.
    "fast": "veo-3.1-fast-generate-001",
    "precise": "veo-3.1-generate-001",
}
LOCATIONS = {"newsroom": "فضای داخلی حرفه‌ای با میز کار و مانیتور", "studio_main": "استودیو با مانیتور بزرگ", "studio_2": "استودیو شمارهٔ ۲", "terrace": "تراس", "living_room": "اتاق نشیمن"}
SHOTS = {"formal": "formal composed medium shot", "semi_formal": "warm semi-formal medium shot", "close_up": "restrained close-up; never crop forehead or chin", "medium": "balanced waist-up shot", "full": "full-body shot with clear environment", "moving": "smooth motivated dolly movement", "podium": "presenter behind an elegant podium", "microphone": "presenter at a professional microphone", "reference": "camera composition guided by the supplied reference"}
MOTION_STYLES = {"headline": "short on-screen title", "lower_third": "clean lower-third name or context strap", "stat": "large data point or statistic", "label": "small corner label"}
MOTION_POSITIONS = {"top": "upper safe area", "center": "clear central area away from the face", "bottom": "lower safe area", "left": "left safe area", "right": "right safe area"}
MOTION_ANIMATIONS = {"fade": "gentle fade in and out", "slide_up": "short upward slide-in", "slide_left": "short lateral slide-in", "type_on": "restrained type-on reveal"}
DIRECTION_MODES = {
    "news_bulletin": "composed direct-to-camera delivery, measured pacing and restrained motivated camera movement",
    "explainer": "clear visual explainer with conversational blocking and purposeful reframing",
    "social_reel": "high-retention social reel with an immediate visual hook and elegant beat-driven movement",
    "cinematic_report": "cinematic on-location scene with environmental storytelling and dimensional blocking",
}
CAMERA_PROGRESSION = (
    "begin on an establishing angle and make a subtle push toward the presenter",
    "start from a complementary three-quarter angle and execute a motivated lateral slide",
    "open tighter at eye level, then ease back enough to restore environmental context",
    "begin with foreground depth and arc gently into a clean composed hero angle",
)

SHOTS["selfie"] = "front-facing handheld selfie at arm length, natural eye-level perspective, subtle handheld motion and realistic facial proportions"


def scene_project(project: dict, line: dict, index: int) -> dict:
    """Resolve one scene for prompting and transport, with legacy defaults."""
    duration = int(line.get("durationSeconds", project.get("durationSeconds", 8)) or 8)
    speech = bool(project.get("speechEnabled", True)) and bool(line.get("speechEnabled", bool(str(line.get("text", "")).strip())))
    timeline = [row for row in project.get("timeline", []) if isinstance(row, dict) and (row.get("sceneIndex") is None or row.get("sceneIndex") == index)]
    return {**project, "durationSeconds": duration, "speechEnabled": speech, "timeline": timeline}


def dialogue_window(line: dict, duration: int) -> str:
    start = line.get("dialogueStartSecond", 0)
    end = line.get("dialogueEndSecond", duration)
    return f"Speech timing: {start}-{end}s within this scene; remain silent outside this window."


def provider_options(project: dict, line: dict | None = None) -> dict:
    """One safe Veo request profile per Studio mode.

    Veo accepts 4, 6 or 8 seconds. Reference images are separately guarded
    by the Gateway because that mode is supported only at 8 seconds.
    """
    mode = str(project.get("qualityMode", "precise"))
    return {
        "model": VEO_MODELS.get(mode, VEO_MODELS["precise"]),
        "seconds": str((line or {}).get("durationSeconds", project.get("durationSeconds")) or 8),
        "size": ("720x1280" if project.get("canvas") == "portrait" else "1280x720") if project.get("resolution") == "720p" else ("1080x1920" if project.get("canvas") == "portrait" else "1920x1080"),
    }

def compile_segment(project: dict, line: dict, index: int) -> str:
    project = scene_project(project, line, index)
    presenter = PRESENTERS.get(line.get("presenterId"), line.get("presenterId", "presenter"))
    location = LOCATIONS.get(project.get("location", {}).get("id"), project.get("location", {}).get("id", "controlled interior"))
    shot = SHOTS.get(line.get("shot"), SHOTS["medium"])
    direction = DIRECTION_MODES.get(project.get("directionMode"), DIRECTION_MODES["news_bulletin"])
    camera_progression = "subtle natural handheld reframing at arm length; no dolly or external camera" if line.get("shot") == "selfie" else CAMERA_PROGRESSION[index % len(CAMERA_PROGRESSION)]
    monitor = project.get("monitor", {}) if isinstance(project.get("monitor"), dict) else {}
    monitor_enabled = bool(monitor.get("enabled", monitor.get("mode") != "disabled"))
    monitor_mode = str(monitor.get("mode") or ("text" if str(project.get("monitorText", "")).strip() else "blank"))
    monitor_text = str(monitor.get("text", project.get("monitorText", ""))).strip()
    if not monitor_enabled or monitor_mode == "disabled":
        monitor_instruction = " Do not add a monitor, screen, lower-third or interface to the scene."
    elif monitor_mode == "images":
        image_mode = str(monitor.get("imageMode") or "generate")
        count = max(1, min(4, int(monitor.get("imageCount", 1) or 1)))
        brief = str(monitor.get("brief", "")).strip()
        if image_mode == "preserve":
            use = "place the supplied MONITOR reference image content pixel-faithfully on the physical display; perspective mapping is allowed but altering text, logos, people or internal details is forbidden"
        elif image_mode == "reference":
            use = "use the supplied MONITOR reference images as the primary screen content, adapting only layout, display perspective and scene lighting"
        else:
            use = "create fresh, credible editorial screen imagery from the approved news brief, without fabricated captions, logos or UI"
        monitor_instruction = f" Use {count} distinct but visually related monitor visuals; {use}. Approved screen brief: {brief or 'derive only from the spoken news content'}. First detect each existing physical screen plane from its bezel, corners, reflections, perspective and foreground occlusions; perspective-map content strictly inside that quadrilateral, preserve bezel/glass/glare/occlusions, and never create another display or spill even one pixel onto walls, desk or set."
    elif monitor_mode == "text" and monitor_text:
        monitor_instruction = f' The monitor shows only this exact Persian copy: «{monitor_text}».'
    else:
        monitor_instruction = " Keep every visible monitor powered on but completely free of text, news imagery, charts, fake logos and interface elements."
    music = {"calm": "calm restrained instrumental bed", "serious": "subtle serious instrumental bed", "uplifting": "restrained uplifting instrumental bed", "neutral": "minimal neutral ambient bed"}.get(project.get("music", {}).get("mood"), "minimal neutral ambient bed")
    location_contract = project.get("location", {})
    location_mode = {
        "catalog": "match the catalog location reference faithfully",
        "generated_prompt": f"generate the complete background from this location-only brief: {str(location_contract.get('prompt', '')).strip()}",
        "new_from_reference": "build a new coherent location from the supplied spatial reference",
        "exact_reference": "use the supplied location reference directly; preserve its geometry, objects, material relationships and visible details exactly",
        "faithful_reference": "use the supplied location references faithfully, preserving spatial identity while allowing only the requested controlled adaptation: " + (str(location_contract.get("referenceInstructions", "")).strip() or "no extra adaptation requested"),
        "inspiration": "use the supplied image only for spatial and lighting inspiration",
    }.get(location_contract.get("mode"), "match the location reference faithfully")
    character_direction = str(project.get("characterInstructions", {}).get(line.get("presenterId"), "")).strip()
    character_direction = f" Character-specific direction: {character_direction}." if character_direction else ""
    overall_direction = str(project.get("additionalInstructions", "")).strip()
    overall_direction = f" Project-wide direction: {overall_direction}." if overall_direction else ""
    cohosts = [PRESENTERS.get(item, item) for item in project.get("presenterIds", []) if item != line.get("presenterId")]
    cohost_instruction = f" Other selected presenters remain naturally present but silent in this segment: {', '.join(cohosts)}. " if cohosts else ""
    duration = int(project.get("durationSeconds") or 8)
    resolution = str(project.get("resolution") or "1080p")
    dimensions = "720x1280" if resolution == "720p" and project.get("canvas") == "portrait" else "1280x720" if resolution == "720p" else "1080x1920" if project.get("canvas") == "portrait" else "1920x1080"
    canvas = f"vertical {dimensions} (9:16)" if project.get("canvas") == "portrait" else f"horizontal {dimensions} (16:9)"
    timeline = project.get("timeline", []) if isinstance(project.get("timeline"), list) else []
    timing = "; ".join(f"{row.get('startSecond', 0)}-{row.get('endSecond', duration)} seconds: {str(row.get('description', '')).strip()}" for row in timeline if isinstance(row, dict) and str(row.get("description", "")).strip())
    motion_copy = []
    for row in timeline:
        if not isinstance(row, dict) or not str(row.get("motionText", "")).strip():
            continue
        style = MOTION_STYLES.get(str(row.get("motionStyle", "headline")), MOTION_STYLES["headline"])
        position = MOTION_POSITIONS.get(str(row.get("motionPosition", "bottom")), MOTION_POSITIONS["bottom"])
        animation = MOTION_ANIMATIONS.get(str(row.get("motionAnimation", "fade")), MOTION_ANIMATIONS["fade"])
        motion_copy.append(f"{row.get('startSecond', 0)}-{row.get('endSecond', duration)} seconds: render the exact Persian on-screen motion graphic copy «{str(row.get('motionText', '')).strip()}» as a {style}, in the {position}, with {animation}; make the kinetic typography genuinely creative and motivated by the scene using elegant timing, depth, accent colour, micro-parallax or a reveal synchronized to the action/camera when appropriate, never a generic sticker template. Keep it crisp, brief, readable on mobile and away from the presenter’s eyes, mouth and hands. It is on-screen graphic text, not a subtitle.")
    speech_enabled = bool(project.get("speechEnabled", True))
    continuity = "Begin as a seamless continuation of CONTINUITY_PREVIOUS_LAST_FRAME.jpg (or CONTINUITY_PARENT_LAST_FRAME.jpg when supplied); preserve the same set, wardrobe, lighting direction, screen direction and ongoing audio bed before progressing naturally. " if index > 0 or project.get("continuation") else "Establish the set and identities clearly for following segments. "
    return (f"A {duration}-second {canvas}, 24fps Veo 3.1 scene with natural motion and motivated camera movement. "
            f"Cinematic professional Persian-language presenter segment, {shot}; {direction}; {camera_progression}. "
            f"{continuity}"
            f"Presenter: {presenter}; lock the exact person identity, facial geometry, apparent age, natural skin texture, hairstyle and diagnostic features across all segments. Body pose, gaze, expression and hand gesture may change only as directed; wardrobe may change only when explicitly requested, but the person must never change.{character_direction}{overall_direction} "
            f"Location: {location}; {location_mode}. Natural controlled key light, realistic skin, restrained brand colours, clean composition, no oversized face, no fake logo or unreadable on-screen text.{cohost_instruction}{monitor_instruction} "
            + (f"The presenter says exactly in Persian: «{str(line.get('text', '')).strip()}». Use calm, precise Persian delivery. Audio: clean studio voice, natural room tone, and a {music}; keep the music character and loudness consistent with adjacent segments and always below speech. " if speech_enabled else f"No character may speak, narrate, lip-sync or mouth intelligible words. Audio is only natural room tone and a {music}; no voice or narration. ")
            + (dialogue_window(line, duration) + " " if speech_enabled else "")
            + (f"Scene action: {str(line.get('description', '')).strip()}. " if line.get("description") else "")
            + (f"Timing plan: {timing}. " if timing else "")
            + (f"MOTION GRAPHICS CONTRACT: {' '.join(motion_copy)} " if motion_copy else "")
            + "Keep the delivery natural and composed; do not imply institutional authority or independently verified facts. "
            + "Camera and lighting contract: use a professional full-frame cinema-camera look with an appropriate prime lens, correct perspective and body scale, deliberate framing and motivated camera angle/movement; keep the presenter plane and eyes sharply focused while distant layers fall into a gentle natural optical blur. Match key, fill, rim and contact shadows to the real environment and time of day, with controlled highlights and natural skin tone—never fake blur, flat face lighting or cutout compositing. Do not invent subtitles, logos or lower thirds; only render the exact motion-graphics copy explicitly listed above.")
