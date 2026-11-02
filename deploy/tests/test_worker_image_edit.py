from __future__ import annotations

import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest import mock


WORKER_PATH = Path(__file__).resolve().parents[1] / "kalam-design-worker.py"


def load_worker() -> types.ModuleType:
    # The production gateway module is named app.py.  The repository keeps it
    # as a deploy artifact, so the worker's multipart contract can be tested
    # without booting the whole HTTP gateway.
    app_stub = types.ModuleType("app")
    reshaper_stub = types.ModuleType("arabic_reshaper")
    reshaper_stub.reshape = lambda value: value  # type: ignore[attr-defined]
    bidi_stub = types.ModuleType("bidi")
    bidi_algorithm_stub = types.ModuleType("bidi.algorithm")
    bidi_algorithm_stub.get_display = lambda value: value  # type: ignore[attr-defined]
    bidi_stub.algorithm = bidi_algorithm_stub  # type: ignore[attr-defined]
    replacements = {
        "app": app_stub,
        "arabic_reshaper": reshaper_stub,
        "bidi": bidi_stub,
        "bidi.algorithm": bidi_algorithm_stub,
    }
    previous_modules = {name: sys.modules.get(name) for name in replacements}
    sys.modules.update(replacements)
    try:
        spec = importlib.util.spec_from_file_location("kalam_worker_image_edit_test", WORKER_PATH)
        assert spec and spec.loader
        worker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(worker)
        return worker
    finally:
        for name, previous_module in previous_modules.items():
            if previous_module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous_module


class FakeResponse:
    headers: dict[str, str] = {}

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps({"data": []}).encode("utf-8")


class WorkerImageEditTests(unittest.TestCase):
    def news_prompt(self, *, canvas="story_1080x1920", logo="floating_profile", slide=0, mode="generate", engine="gpt-image-2.5-flare", output="title_photo"):
        worker = load_worker()
        prompt_dir = WORKER_PATH.parent / "prompts"
        worker.app.image_base_prompt = lambda: (prompt_dir / "image-base.production.fa.txt").read_text(encoding="utf-8")
        worker.app.image_non_news_prompt = lambda: "طرح مستقل"
        worker.app.image_style_prompt = lambda: "گرید و عمق حرفه‌ای"
        worker.app.image_template_prompt = lambda template: (prompt_dir / f"{template}.master.fa.txt").read_text(encoding="utf-8")
        record = {"requestId": "render-style-regression", "request": {
            "brand": "kalametaze", "content": {"title": "پژوهش تازه؛ افزایش کیفیت زندگی", "subtitle": "گزارش محلی", "source": "تحریریه"},
            "format": {"family": "news", "template": "news_post" if canvas == "post_1080x1350" else "news_story", "canvas": canvas, "logoBehavior": logo, "slideMode": "carousel" if slide else "single", "slideCount": 3 if slide else 1, "slideIndex": slide or 1, "news": {"layout": "center", "outputKind": output}},
            "image": {"mode": mode, "engine": engine},
        }}
        if slide > 1:
            record["uploadedImages"] = [{"role": "series_previous_slide", "filename": "previous.png"}]
        return worker, record, worker.render_prompt(record)

    def test_all_news_outputs_share_magazine_glass_glyph_and_scattered_watermark_direction(self):
        for canvas in ("story_1080x1920", "post_1080x1350"):
            for slide in (0, 1, 2):
                for logo in ("system_header", "floating_profile", "none"):
                    with self.subTest(canvas=canvas, slide=slide, logo=logo):
                        _, _, prompt = self.news_prompt(canvas=canvas, slide=slide, logo=logo)
                        self.assertIn("جهت هنری رندر خبری — جلد مجلهٔ ممتاز", prompt)
                        self.assertIn("کارت‌های شیشه‌ای ممتاز", prompt)
                        self.assertIn("کنترل رندر حروف فارسی", prompt)
                        self.assertIn("تعداد و جای دقیق نقطه", prompt)
                        self.assertEqual(prompt.count("واترمارک پراکندهٔ رسانه، مستقل"), 1)
                        self.assertIn("دقیقاً سه واترمارک", prompt)
                        self.assertIn("@kalametaze.ir", prompt)
                        if logo != "system_header":
                            self.assertNotIn("y >=", prompt)
                            self.assertNotIn("y_min", prompt)
                            self.assertNotIn("واترمارک رسانه‌ای هم نساز", prompt)
                        if slide > 1:
                            self.assertIn("REFERENCE PRIORITY AND SERIES ISOLATION", prompt)

    def test_system_header_geometry_matches_native_flare_raster(self):
        for canvas, expected, minimum in (("story_1080x1920", "۱۱۵۲×۲۰۴۸", "۳۶۳"), ("post_1080x1350", "۱۲۸۰×۱۶۰۰", "۴۰۳")):
            _, _, prompt = self.news_prompt(canvas=canvas, logo="system_header")
            self.assertIn(expected, prompt)
            self.assertIn(f"y >= {minimum}", prompt)
            self.assertNotIn("۷۶۸×۱۳۷۶", prompt)

    def test_news_palette_is_scene_led_not_mandatory_brand_decoration(self):
        for canvas in ("story_1080x1920", "post_1080x1350"):
            for logo in ("system_header", "floating_profile", "none"):
                with self.subTest(canvas=canvas, logo=logo):
                    worker, record, _ = self.news_prompt(canvas=canvas, logo=logo)
                    worker.app.image_style_prompt = lambda: "سبک عمومی: رنگ برند در طراحی به کار برود."
                    prompt = worker.render_prompt(record)
                    self.assertIn("رنگ رسانه الزام طراحی نیست", prompt)
                    self.assertIn("استفاده‌نکردن از رنگ لوگو کاملاً مجاز است", prompt)
                    self.assertIn("موج سینوسیِ تزئینی", prompt)
                    self.assertGreater(prompt.index("استقلال پالت"), prompt.index("سبک عمومی"))
                    self.assertNotIn("یک رنگ تأکیدی از هویت رسانه", prompt)
                    self.assertNotIn("رنگ تیتر را آزادانه بر اساس تم رسانه", prompt)
                    self.assertIn("دقیقاً سه واترمارک", prompt)
        self.assertIn("نقش‌ها و فرم‌های داخل پروفایل فقط داخل همان نشان", worker.floating_profile_prompt())

    def test_preserved_reference_and_title_only_keep_their_own_contracts(self):
        _, _, prompt = self.news_prompt(mode="preserve")
        self.assertIn("تمام پیکسل‌ها", prompt)
        _, _, prompt = self.news_prompt(output="title_only")
        self.assertIn("فقط تیتر؛ هیچ عکس خبری", prompt)
        self.assertNotIn("### نحوهٔ استفاده از عکس خبر", prompt)
        self.assertIn("روی بافت گرافیکیِ بدنه", prompt)

    def test_news_does_not_get_a_fourth_fixed_corner_watermark(self):
        worker, record, _ = self.news_prompt()
        encoded = worker.BytesIO()
        worker.Image.new("RGB", (400, 500), (20, 40, 60)).save(encoded, format="PNG")
        with mock.patch.object(worker.ImageDraw, "Draw", side_effect=AssertionError("extra corner watermark forbidden")):
            worker.apply_exact_header(record, encoded.getvalue())

    def test_floating_profile_is_model_authored_not_a_pasted_badge(self) -> None:
        from io import BytesIO
        from PIL import Image
        worker = load_worker()
        source = BytesIO()
        Image.new("RGB", (400, 500), (20, 40, 60)).save(source, format="PNG")
        with mock.patch.object(worker, "brand_profile_path", side_effect=AssertionError("manual profile overlay forbidden")):
            result = worker.apply_exact_header({"request": {"format": {"logoBehavior": "floating_profile"}}}, source.getvalue())
        raster = Image.open(BytesIO(result))
        # A watermark may remain at bottom-right, but no badge can be pasted
        # at bottom-left or anywhere else by the identity pass.
        self.assertEqual(raster.getpixel((40, 440))[:3], (20, 40, 60))
        prompt = worker.floating_profile_prompt()
        self.assertIn("BRAND PROFILE", prompt)
        self.assertIn("هیچ نشان دستی", prompt)

    def test_edit_request_sets_one_output_as_required_multipart_field(self) -> None:
        worker = load_worker()
        with (
            mock.patch.object(worker, "AVALAI_API_KEY", "test-key"),
            mock.patch.object(worker.urllib.request, "urlopen", return_value=FakeResponse()) as urlopen,
        ):
            worker.call_avalai_edit(
                "یک تصویر خبری بساز",
                b"fake-png",
                "1024x1536",
                "gpt-image-2.5-flare",
            )

        request = urlopen.call_args.args[0]
        self.assertIn(b'name="n"\r\n\r\n1\r\n', request.data)
        self.assertNotIn(b'name="response_format"', request.data)

    def test_native_model_receives_story_and_post_ratios_without_silent_remapping(self) -> None:
        worker = load_worker()
        self.assertEqual(worker.render_size({"request": {"format": {"canvas": "story_1080x1920"}}}), "1152x2048")
        self.assertEqual(worker.render_size({"request": {"format": {"canvas": "post_1080x1350"}}}), "1280x1600")
        self.assertEqual(worker.avalai_image_size("1152x2048", "gpt-image-2.5-flare"), "1152x2048")
        self.assertEqual(worker.avalai_image_size("1280x1600", "gpt-image-2.5-flare"), "1280x1600")
        self.assertEqual(worker.gemini_aspect_ratio("1152x2048"), "9:16")
        self.assertEqual(worker.gemini_aspect_ratio("1280x1600"), "4:5")

    def test_native_flare_model_is_the_default_and_native_dimensions_are_preserved(self) -> None:
        worker = load_worker()
        self.assertEqual(worker.AVALAI_IMAGE_FULL_MODEL, "gpt-image-2.5-flare")
        source = worker.Image.new("RGB", (1024, 1536), "#4b5563")
        encoded = worker.BytesIO()
        source.save(encoded, format="PNG")
        result = worker.apply_exact_header(
            {"request": {"format": {"family": "studio", "template": "studio", "canvas": "story_1080x1920"}}},
            encoded.getvalue(),
        )
        with worker.Image.open(worker.BytesIO(result)) as image:
            self.assertEqual(image.size, (1024, 1536))

    def test_native_post_dimensions_are_not_cropped_after_generation(self) -> None:
        worker = load_worker()
        source = worker.Image.new("RGB", (1024, 1280), "#4b5563")
        encoded = worker.BytesIO()
        source.save(encoded, format="PNG")
        result = worker.apply_exact_header(
            {"request": {"format": {"family": "studio", "template": "news_post", "canvas": "post_1080x1350"}}},
            encoded.getvalue(),
        )
        with worker.Image.open(worker.BytesIO(result)) as image:
            self.assertEqual(image.size, (1024, 1280))

