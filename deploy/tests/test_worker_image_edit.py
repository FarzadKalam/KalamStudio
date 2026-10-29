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

