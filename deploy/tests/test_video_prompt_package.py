from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import types
import unittest
import zipfile
from pathlib import Path
from unittest import mock


GATEWAY_PATH = Path(__file__).resolve().parents[1] / "kalam-design-gateway.app.py"
if "cgi" not in sys.modules:
    cgi_stub = types.ModuleType("cgi")
    cgi_stub.FieldStorage = object
    sys.modules["cgi"] = cgi_stub
SPEC = importlib.util.spec_from_file_location("kalam_gateway_video_prompt_test", GATEWAY_PATH)
assert SPEC and SPEC.loader
gateway = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gateway)


class FakeForm:
    def __init__(self, values: dict[str, str]):
        self.values = values

    def getfirst(self, key: str, default: str = "") -> str:
        return self.values.get(key, default)


class VideoPromptPackageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        data_dir = Path(self.temporary.name)
        gateway.DATA_DIR = data_dir
        gateway.VIDEO_PROJECT_DIR = data_dir / "video-projects"
        gateway.VIDEO_ASSET_DIR = data_dir / "video-assets"
        gateway.VIDEO_ASSET_REGISTRY_FILE = gateway.VIDEO_ASSET_DIR / "registry.json"
        self.user = {"id": gateway.OWNER_ID}
        assets = [
            self._asset("presenter", "kamran", "kamran-source.jpg", "presenter-1", True),
            self._asset("location", "newsroom", "newsroom-source.png", "location-1", True),
        ]
        gateway.VIDEO_ASSET_REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
        gateway.VIDEO_ASSET_REGISTRY_FILE.write_text(json.dumps({"version": 1, "assets": assets}), encoding="utf-8")
        self.project = {
            "projectId": "12345678-1234-1234-1234-123456789012",
            "brand": "kalametaze",
            "canvas": "portrait",
            "qualityMode": "precise",
            "presenterIds": ["kamran"],
            "location": {"mode": "catalog", "id": "newsroom"},
            "monitorText": "خبر فوری",
            "lines": [{"presenterId": "kamran", "text": "این یک آزمون است.", "shot": "medium"}],
            "music": {"mood": "neutral", "continuityKey": "test-continuity"},
        }

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _asset(self, kind: str, entity_id: str, original: str, asset_id: str, default: bool) -> dict:
        suffix = Path(original).suffix
        stored = f"{asset_id}{suffix}"
        path = gateway.VIDEO_ASSET_DIR / kind / entity_id / stored
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"test-image")
        return {
            "assetId": asset_id,
            "kind": kind,
            "entityId": entity_id,
            "filename": original,
            "storedFilename": stored,
            "bytes": path.stat().st_size,
            "isDefault": default,
            "scope": "studio",
            "createdAt": 1,
        }

    def test_package_uses_exact_download_names_and_builds_portable_zip(self) -> None:
        generated = {
            "projectSummary": "خلاصه",
            "directorialStrategy": "حرکت نرم دوربین",
            "segments": [{"index": 0, "prompt": "A directed camera move. The presenter says exactly in Persian: «این یک آزمون است.»", "negativePrompt": "identity drift"}],
        }
        with mock.patch.object(gateway, "call_video_prompt_gemini", return_value=generated):
            package = gateway.build_video_prompt_package(gateway.validate_video_project(self.project), self.user)
        filenames = [item["downloadName"] for item in package["references"]]
        self.assertEqual(filenames, ["CHARACTER_KAMRAN_FLEXIBLE_IDENTITY_01.jpg", "LOCATION_NEWSROOM_FLEXIBLE_MASTER_01.png"])
        for filename in filenames:
            self.assertIn(filename, package["segments"][0]["prompt"])
        self.assertIn("CREATE A VIDEO, NOT A STILL IMAGE", package["segments"][0]["prompt"])
        self.assertIn("1080x1920", package["segments"][0]["prompt"])
        self.assertEqual(package["project"]["projectId"], self.project["projectId"])
        archive_bytes, _ = gateway.video_prompt_bundle_for_user(FakeForm({"projectId": self.project["projectId"]}), self.user)
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            names = set(archive.namelist())
        self.assertIn("VEO_3.1_PROMPT.txt", names)
        self.assertNotIn("GEMINI_OMNI_PROMPT.txt", names)
        self.assertIn("manifest.json", names)
        self.assertIn("prompts/segment-01/VEO_3.1_PROMPT.txt", names)
        self.assertIn("references/CHARACTER_KAMRAN_FLEXIBLE_IDENTITY_01.jpg", names)
        self.assertIn("references/LOCATION_NEWSROOM_FLEXIBLE_MASTER_01.png", names)

    def test_motion_graphics_are_kept_exactly_inside_timeline_contract(self) -> None:
        project = {
            **self.project,
            "timeline": [{
                "startSecond": 0,
                "endSecond": 3,
                "description": "دوربین آرام نزدیک شود.",
                "motionText": "افزایش قیمت نان",
                "motionStyle": "headline",
                "motionPosition": "bottom",
                "motionAnimation": "slide_up",
            }],
        }
        generated = {"segments": [{"index": 0, "prompt": "A directed camera move.", "negativePrompt": ""}]}
        with mock.patch.object(gateway, "call_video_prompt_gemini", return_value=generated):
            package = gateway.build_video_prompt_package(gateway.validate_video_project(project), self.user)
        prompt = package["segments"][0]["prompt"]
        self.assertIn("MOTION GRAPHICS CONTRACT", prompt)
        self.assertIn("افزایش قیمت نان", prompt)
        self.assertIn("slide-in", prompt)
        self.assertEqual(package["project"]["timeline"][0]["motionText"], "افزایش قیمت نان")

    def test_more_than_three_location_references_is_rejected(self) -> None:
        project = {**self.project, "location": {"mode": "exact_reference", "id": "newsroom", "assetIds": ["1", "2", "3", "4"]}}
        with self.assertRaises(gateway.ClientError):
            gateway.validate_video_project(project)

    def test_veo_budget_counts_automatic_and_uploaded_references_together(self) -> None:
        project = {
            **self.project,
            "monitor": {
                "mode": "images", "imageMode": "reference", "imageCount": 1,
                "assetIds": ["00000000-0000-4000-8000-000000000009"],
            },
            "presenterIds": ["kamran", "tara"],
            "lines": [
                *self.project["lines"],
                {"presenterId": "tara", "text": "ادامهٔ خبر.", "shot": "medium"},
            ],
        }
        # Two automatic character images + one automatic location + one user
        # monitor image exceed Veo's three-image contract.
        with self.assertRaises(gateway.ClientError) as raised:
            gateway.validate_video_project(project)
        self.assertIn("در مجموع", raised.exception.message)

    def test_manual_presenter_images_are_preserved_in_segment_manifest(self) -> None:
        first_id = "00000000-0000-4000-8000-000000000011"
        second_id = "00000000-0000-4000-8000-000000000012"
        assets = json.loads(gateway.VIDEO_ASSET_REGISTRY_FILE.read_text(encoding="utf-8"))["assets"]
        assets.extend([
            self._asset("presenter", "kamran", "kamran-three-quarter.jpg", first_id, False),
            self._asset("presenter", "kamran", "kamran-full.jpg", second_id, False),
        ])
        gateway.VIDEO_ASSET_REGISTRY_FILE.write_text(json.dumps({"version": 2, "assets": assets}), encoding="utf-8")
        project = gateway.validate_video_project({
            **self.project,
            "referenceSelection": {
                "presenters": {"kamran": {"mode": "manual", "assetIds": [first_id, second_id]}},
                "location": {"mode": "auto", "assetIds": []},
            },
        })
        selected = gateway.selected_video_reference_assets(project, self.user)
        self.assertEqual([item["assetId"] for item in selected[:2]], [first_id, second_id])
        manifest = gateway.video_reference_manifest(project, self.user)
        segment_ids = gateway.video_segment_reference_ids(project, project["lines"][0], manifest, 0)
        self.assertEqual(segment_ids[:2], [first_id, second_id])
        self.assertEqual(len(segment_ids), 3)

    def test_later_segment_reserves_third_veo_slot_for_continuity_frame(self) -> None:
        manifest = [
            {"referenceId": "presenter", "kind": "presenter", "entityId": "kamran"},
            {"referenceId": "location-1", "kind": "location", "entityId": "newsroom"},
            {"referenceId": "location-2", "kind": "location", "entityId": "newsroom"},
        ]
        line = {"presenterId": "kamran"}
        # One identity plus the single best-matching location. Supplying two
        # competing location views to one segment weakens spatial continuity.
        self.assertEqual(len(gateway.video_segment_reference_ids(self.project, line, manifest, 0)), 2)
        self.assertEqual(len(gateway.video_segment_reference_ids(self.project, line, manifest, 1)), 2)

    def test_smart_location_selection_prefers_portrait_single_presenter_profile(self) -> None:
        landscape = self._asset("location", "newsroom", "wide.png", "location-wide", True)
        landscape["profile"] = {"role": "master", "aspectRatio": "landscape", "framing": "wide", "presenterCapacity": 2, "copySpace": "none", "label": "نمای باز"}
        portrait = self._asset("location", "newsroom", "portrait.png", "location-portrait", False)
        portrait["profile"] = {"role": "single_presenter", "aspectRatio": "portrait", "framing": "medium", "presenterCapacity": 1, "copySpace": "none", "label": "عمودی تک‌مجری"}
        need = gateway.video_line_asset_need(self.project, self.project["lines"][0])
        selected = gateway.smart_video_asset([landscape, portrait], "location", "newsroom", need)
        self.assertEqual(selected["assetId"], "location-portrait")

    def test_blank_studio_image_prefers_reference_with_copy_space(self) -> None:
        without_space = self._asset("location", "newsroom", "plain.png", "location-plain", True)
        without_space["profile"] = {"role": "master", "aspectRatio": "portrait", "framing": "wide", "presenterCapacity": 1, "copySpace": "none", "label": "عادی"}
        with_space = self._asset("location", "newsroom", "copy.png", "location-copy", False)
        with_space["profile"] = {"role": "title_space", "aspectRatio": "portrait", "framing": "wide", "presenterCapacity": 1, "copySpace": "left", "label": "فضای تیتر"}
        request = {"format": {"canvas": "story_1080x1920", "studio": {"presenterIds": ["kamran"], "locationId": "newsroom", "textMode": "blank"}}}
        need = gateway.studio_image_asset_need(request)
        selected = gateway.smart_video_asset([without_space, with_space], "location", "newsroom", need)
        self.assertEqual(selected["assetId"], "location-copy")

    def test_omni_package_contains_only_selected_model_prompt(self) -> None:
        project = {**self.project, "generationModel": "gemini_omni_flash"}
        generated = {"segments": [{"index": 0, "prompt": "Gemini Omni directed prompt.", "negativePrompt": ""}]}
        with mock.patch.object(gateway, "call_video_prompt_gemini", return_value=generated):
            package = gateway.build_video_prompt_package(gateway.validate_video_project(project), self.user)
        archive_bytes, _ = gateway.video_prompt_bundle_for_user(FakeForm({"projectId": project["projectId"]}), self.user)
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            names = set(archive.namelist())
        self.assertEqual(package["targetModel"], "gemini_omni_flash")
        self.assertIn("GEMINI_OMNI_PROMPT.txt", names)
        self.assertNotIn("VEO_3.1_PROMPT.txt", names)

    def test_direct_omni_video_creation_is_blocked(self) -> None:
        project = {**self.project, "generationModel": "gemini_omni_flash"}
        with self.assertRaises(gateway.ClientError) as raised:
            gateway.create_video_project(FakeForm({"project": json.dumps(project, ensure_ascii=False)}), self.user)
        self.assertEqual(raised.exception.status, gateway.HTTPStatus.CONFLICT)

    def test_monitor_reference_gets_portable_name_and_segment_slot(self) -> None:
        monitor_asset = self._asset("monitor", "newsroom", "breaking-screen.png", "monitor-1", False)
        monitor_asset["scope"] = "project"
        monitor_asset["ownerId"] = gateway.OWNER_ID
        registry = json.loads(gateway.VIDEO_ASSET_REGISTRY_FILE.read_text(encoding="utf-8"))
        registry["assets"].append(monitor_asset)
        gateway.VIDEO_ASSET_REGISTRY_FILE.write_text(json.dumps(registry), encoding="utf-8")
        project = {
            **self.project,
            "generationModel": "veo_3_1",
            "monitor": {"mode": "images", "imageMode": "preserve", "imageCount": 1, "brief": "خبر فوری", "assetIds": ["monitor-1"]},
        }
        generated = {"segments": [{"index": 0, "prompt": "A faithful physical monitor composition.", "negativePrompt": ""}]}
        with mock.patch.object(gateway, "call_video_prompt_gemini", return_value=generated):
            package = gateway.build_video_prompt_package(gateway.validate_video_project(project), self.user)
        monitor = next(item for item in package["references"] if item["kind"] == "monitor")
        self.assertEqual(monitor["downloadName"], "MONITOR_NEWSROOM_FLEXIBLE_CONTENT_01.png")
        self.assertIn(monitor["referenceId"], package["segments"][0]["referenceIds"])


if __name__ == "__main__":
    unittest.main()
