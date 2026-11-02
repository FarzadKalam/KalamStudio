from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import types
import unittest
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock


GATEWAY_PATH = Path(__file__).resolve().parents[1] / "kalam-design-gateway.app.py"
if "cgi" not in sys.modules:
    cgi_stub = types.ModuleType("cgi")
    cgi_stub.FieldStorage = object
    sys.modules["cgi"] = cgi_stub
SPEC = importlib.util.spec_from_file_location("kalam_gateway_regression_test", GATEWAY_PATH)
assert SPEC and SPEC.loader
gateway = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gateway)


class FakeForm:
    def __init__(self, values: dict[str, str], items: list[object] | None = None):
        self.values = values
        self.list = items or []

    def getfirst(self, key: str, default: str = "") -> str:
        return self.values.get(key, default)


class UploadWhoseTruthValueIsInvalid:
    name = "image"
    filename = "tara-front.jpg"

    def __init__(self) -> None:
        self.file = io.BytesIO(b"valid-test-image")

    def __bool__(self) -> bool:
        raise TypeError("Cannot be converted to bool.")


class GatewayRegressionTests(unittest.TestCase):
    def test_serial_non_studio_cannot_reuse_hidden_presenter_or_scene(self) -> None:
        for mode in ("generate", "preserve", "reference", "none"):
            request = {
                "format": {"slideMode": "carousel", "family": "studio", "baseFamily": "news", "template": "news_post", "studio": {"presenterIds": ["tara"]}},
                "image": {"mode": mode, "presenterIds": ["tara"], "referenceSelection": {"presenters": {"tara": {"mode": "auto"}}}},
            }
            gateway.normalize_series_visual_contract(request)
            self.assertEqual(request["format"]["family"], "news")
            self.assertNotIn("studio", request["format"])
            self.assertEqual(request["image"]["presenterIds"], [])
            self.assertEqual(request["image"]["referenceSelection"], {"presenters": {}})

    def test_serial_studio_keeps_its_explicit_contract(self) -> None:
        request = {"format": {"slideMode": "carousel", "family": "studio", "studio": {"presenterIds": []}}, "image": {"mode": "studio"}}
        gateway.normalize_series_visual_contract(request)
        self.assertEqual(request["format"]["studio"]["presenterIds"], [])

    def test_studio_without_presenter_has_no_portrait_or_character_direction(self) -> None:
        prompt = "\n".join(gateway.studio_image_prompt_sections({"presenterIds": [], "locationId": "newsroom", "monitor": {"mode": "blank"}}))
        self.assertIn("بدون مجری", prompt)
        self.assertNotIn("۱۶ تا ۲۴", prompt)
        self.assertNotIn("تک‌مجری", prompt)

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temporary.name)
        gateway.DATA_DIR = self.data_dir
        gateway.VIDEO_ASSET_DIR = self.data_dir / "video-assets"
        gateway.VIDEO_ASSET_REGISTRY_FILE = gateway.VIDEO_ASSET_DIR / "registry.json"
        gateway.NEWS_SEEKER_DIR = self.data_dir / "news-seeker"
        gateway.NEWS_SEEKER_SNAPSHOTS_FILE = gateway.NEWS_SEEKER_DIR / "snapshots.json"
        gateway.NEWSROOM_QUEUE_FILE = gateway.NEWS_SEEKER_DIR / "publication-queue.json"
        gateway.ENGAGEMENT_DIR = self.data_dir / "engagement"
        gateway.ENGAGEMENT_MEDIA_DIR = gateway.ENGAGEMENT_DIR / "media"
        gateway.ENGAGEMENT_TAGS_FILE = gateway.ENGAGEMENT_DIR / "tags.json"
        gateway.ACCESS_FILE = self.data_dir / "access.json"
        gateway.WEB_SESSIONS_FILE = self.data_dir / "web-sessions.json"
        gateway.WEB_LOGIN_ATTEMPTS_FILE = self.data_dir / "web-login-attempts.json"
        gateway.WEB_LOGIN_OTP_FILE = self.data_dir / "web-login-otp.json"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def studio_request(self, studio: dict) -> dict:
        return {
            "requestId": "00000000-0000-4000-8000-000000000001",
            "platform": "telegram",
            "brand": "kalametaze",
            "format": {"family": "studio", "template": "studio", "canvas": "story_1080x1920", "studio": studio},
            "content": {"titleOnly": False, "title": ""},
            "image": {"mode": "generate", "engine": "gpt_image_2"},
            "production": {"kind": "image"},
        }

    def test_video_asset_upload_never_evaluates_field_storage_truthiness(self) -> None:
        upload = UploadWhoseTruthValueIsInvalid()
        form = FakeForm(
            {"action": "add", "scope": "studio", "kind": "presenter", "entityId": "tara"},
            [upload],
        )
        with (
            mock.patch.object(gateway, "access_status", return_value="owner"),
            mock.patch.object(gateway, "require_owner"),
            mock.patch.object(gateway, "sync_media_to_s3", return_value=""),
        ):
            result = gateway.manage_video_assets(form, {"id": gateway.OWNER_ID})
        self.assertEqual(len(result["assets"]), 1)
        self.assertEqual(result["assets"][0]["entityId"], "tara")
        registry = json.loads(gateway.VIDEO_ASSET_REGISTRY_FILE.read_text(encoding="utf-8"))
        stored = registry["assets"][0]["storedFilename"]
        self.assertTrue((gateway.VIDEO_ASSET_DIR / "presenter" / "tara" / stored).is_file())

    def test_newsroom_item_scores_and_deduplicates_sources(self) -> None:
        published_at = (gateway.dt.datetime.now(gateway.dt.timezone.utc) - gateway.dt.timedelta(minutes=30)).strftime("%a, %d %b %Y %H:%M:%S +0000")
        first = gateway.news_seeker_snapshot({
            "category": "national", "sourceId": "irna", "scope": "national",
            "items": [{"title": "خبر فوری آزمایشی دربارهٔ حمل‌ونقل", "summary": "جزئیات تأییدشده", "url": "https://www.irna.ir/a", "publishedAt": published_at}],
        })
        second = gateway.news_seeker_snapshot({
            "category": "national", "sourceId": "isna", "scope": "national",
            "items": [{"title": "خبر فوری آزمایشی دربارهٔ حمل‌ونقل", "summary": "منبع دوم", "url": "https://www.isna.ir/b", "publishedAt": published_at}],
        })
        gateway.news_seeker_save([second, first])
        workspace = gateway.list_news_seeker_snapshots()
        self.assertEqual(len(workspace["items"]), 1)
        item = workspace["items"][0]
        self.assertEqual(item["source"], "ایسنا")
        self.assertGreaterEqual(item["priorityScore"], 1)
        self.assertEqual(len(item["related"]), 1)
        self.assertTrue(any(source["id"] == "irna" for source in workspace["sources"]))

    def test_newsroom_rejects_archive_and_stale_source_results(self) -> None:
        fresh = (gateway.dt.datetime.now(gateway.dt.timezone.utc) - gateway.dt.timedelta(hours=1)).strftime("%a, %d %b %Y %H:%M:%S +0000")
        self.assertFalse(gateway.newsroom_valid_source_item({"sourceId": "fararu", "title": "آرشیو - فرارو", "publishedAt": fresh}))
        self.assertFalse(gateway.newsroom_valid_source_item({"sourceId": "ham_mihan", "title": "- هم\u200cمیهن", "publishedAt": fresh}))
        self.assertFalse(gateway.newsroom_valid_source_item({"sourceId": "irna", "title": "Iran news landing page", "publishedAt": fresh}))
        self.assertTrue(gateway.newsroom_valid_source_item({"sourceId": "irna", "title": "تصویب طرح تازه برای توسعه حمل‌ونقل عمومی", "publishedAt": fresh}))

    def test_instagram_dm_limit_is_enforced_in_utf8_bytes(self) -> None:
        self.assertEqual(gateway.engagement_instagram_text_bytes("سلام"), len("سلام".encode("utf-8")))
        with self.assertRaises(gateway.ClientError):
            gateway.engagement_require_instagram_text_limit("س" * 501)

    def test_shared_tag_catalog_migrates_legacy_threads_once(self) -> None:
        records = [{"tags": ["مشتری ویژه", "نیازمند پیگیری"]}, {"tags": ["مشتری ویژه"]}]
        self.assertEqual(gateway.engagement_tag_catalog(records), ["مشتری ویژه", "نیازمند پیگیری"])
        gateway.engagement_save_tag_catalog(["لید", "مشتری ویژه"])
        self.assertEqual(gateway.engagement_tag_catalog(records), ["لید", "مشتری ویژه"])

    def test_postback_matches_a_direct_message_rule(self) -> None:
        rule = {"enabled": True, "accountIds": ["connection:account"], "eventTypes": ["messaging"], "match": {"mode": "equals", "terms": ["قیمت"]}}
        item = {"accountId": "other-connection:account", "eventType": "messaging_postbacks", "text": "قیمت"}
        self.assertTrue(gateway.engagement_rule_matches(rule, item))

    def test_showcase_payload_keeps_every_card_and_ignores_an_unfinished_link(self) -> None:
        cards = [
            {
                "cardId": "first", "title": "کارت اول", "subtitle": "توضیح اول",
                "image": {"attachmentId": "rule-00000000-0000-4000-8000-000000000001", "storedFilename": "media-0000000000000001.jpg", "mimeType": "image/jpeg"},
                "buttons": [{"type": "web_url", "title": "لینک ناتمام", "url": ""}],
            },
            {
                "cardId": "second", "title": "کارت دوم", "subtitle": "توضیح دوم",
                "image": {"attachmentId": "rule-00000000-0000-4000-8000-000000000002", "storedFilename": "media-0000000000000002.png", "mimeType": "image/png"},
                "buttons": [{"type": "postback", "title": "انتخاب", "payload": "SECOND"}],
            },
        ]
        for card in cards:
            image = card["image"]
            target = gateway.engagement_media_cache_path(image["attachmentId"], image["storedFilename"])
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b"image")
        with mock.patch.object(gateway, "signed_engagement_media_url", side_effect=lambda event, filename, ttl: f"https://media.example/{event}/{filename}"):
            elements = gateway.engagement_showcase_elements(cards)
        self.assertEqual([element["title"] for element in elements], ["کارت اول", "کارت دوم"])
        self.assertEqual(elements[0]["buttons"], [])
        self.assertNotIn("default_action", elements[0])
        self.assertEqual(elements[1]["buttons"][0]["payload"], "SECOND")

    def test_web_session_keeps_three_newest_devices_for_one_user(self) -> None:
        tokens = [gateway.create_web_session("42")[0] for _ in range(4)]

        sessions = gateway._load_json_list(gateway.WEB_SESSIONS_FILE)

        self.assertEqual(len(sessions), 3)
        hashes = {item["tokenHash"] for item in sessions}
        self.assertNotIn(gateway.hashlib.sha256(tokens[0].encode()).hexdigest(), hashes)
        self.assertTrue(all(gateway.hashlib.sha256(token.encode()).hexdigest() in hashes for token in tokens[1:]))

    def test_phone_otp_login_accepts_registered_work_phone(self) -> None:
        gateway.write_json_atomic(gateway.ACCESS_FILE, {
            "version": 1,
            "users": {"42": {"status": "active", "username": "editor", "workPhone": "09121234567"}},
        })
        environ = {"REMOTE_ADDR": "127.0.0.1"}
        with (
            mock.patch.object(gateway, "club_internal_admin_request", return_value={"sent": True}),
            mock.patch.object(gateway.secrets, "randbelow", return_value=123456),
        ):
            result = gateway.web_request_otp(FakeForm({"phone": "۰۹۱۲۱۲۳۴۵۶۷"}), environ)
        self.assertTrue(result["sent"])

        user, _cookie = gateway.web_login_otp(FakeForm({"phone": "+989121234567", "code": "123456"}), environ)

        self.assertEqual(user["id"], "42")
        self.assertEqual(user["auth"], "sms")

    def test_active_admin_can_list_users_without_receiving_access_management_rights(self) -> None:
        previous_access_file = gateway.ACCESS_FILE
        gateway.ACCESS_FILE = self.data_dir / "access.json"
        self.addCleanup(setattr, gateway, "ACCESS_FILE", previous_access_file)
        gateway.write_json_atomic(gateway.ACCESS_FILE, {
            "version": 1,
            "users": {
                gateway.OWNER_ID: {"status": "active"},
                "987654321": {"status": "active"},
            },
        })
        active_admin = {"id": "987654321"}

        view = gateway.update_access(FakeForm({"action": "list"}), active_admin)

        self.assertEqual({item["chatId"] for item in view["users"]}, {gateway.OWNER_ID, "987654321"})
        with self.assertRaises(gateway.ClientError):
            gateway.update_access(FakeForm({"action": "add", "chatId": "123456789"}), active_admin)

    def test_sticker_is_rejected_before_queueing_when_global_engine_cannot_return_alpha(self) -> None:
        request = self.studio_request({})
        request["format"] = {"family": "non_news", "template": "sticker", "canvas": "sticker_1024x1024"}
        request["content"] = {"stickerKind": "news", "stickerText": "خبر فوری", "stickerSubtext": ""}
        with mock.patch.object(gateway, "image_model_settings", return_value={"defaultModel": "gemini-3.1-flash-image"}):
            with self.assertRaisesRegex(gateway.ClientError, "GPT Image 2"):
                gateway.validate_request(request)

    def test_sticker_captures_gpt_image_2_and_its_square_canvas(self) -> None:
        request = self.studio_request({})
        request["format"] = {"family": "non_news", "template": "sticker", "canvas": "sticker_1024x1024"}
        request["content"] = {"stickerKind": "promotion", "stickerText": "پیشنهاد ویژه", "stickerSubtext": ""}
        with mock.patch.object(gateway, "image_model_settings", return_value={"defaultModel": "gpt-image-2"}):
            accepted = gateway.validate_request(request)
        self.assertEqual(accepted["image"]["engine"], "gpt-image-2")
        self.assertEqual(accepted["format"]["canvas"], "sticker_1024x1024")

    def test_video_title_sticker_mode_is_accepted(self) -> None:
        request = self.studio_request({})
        request["format"] = {"family": "non_news", "template": "sticker", "canvas": "sticker_1024x1024"}
        request["content"] = {"stickerKind": "video_title", "stickerText": "مهم‌ترین خبر امروز", "stickerSubtext": "کلام تازه"}
        with mock.patch.object(gateway, "image_model_settings", return_value={"defaultModel": "gpt-image-2.5-flare"}):
            accepted = gateway.validate_request(request)
        self.assertEqual(accepted["content"]["stickerKind"], "video_title")

    def test_market_caption_preview_uses_the_exact_form_values(self) -> None:
        request = self.studio_request({})
        request["format"] = {
            "family": "fixed",
            "template": "market",
            "canvas": "story_1080x1920",
        }
        request["content"] = {
            "marketWeekday": "دوشنبه",
            "marketPersianDate": "۱ مهر ۱۴۰۵",
            "marketTime": "۱۰:۴۵",
            "marketUsdPrice": "۱۰۱٬۲۵۰",
            "marketEurPrice": "۱۱۸٬۹۰۰",
            "marketCoinPrice": "۱۱۲٬۰۰۰٬۰۰۰",
            "marketGold18Price": "۱۰٬۷۵۰٬۰۰۰",
            "marketBitcoinPrice": "۱۱۴٬۵۰۰",
            "marketSource": "API بازار",
            "publicationCaption": "کپشن قدیمی",
        }
        with mock.patch.object(gateway, "image_model_settings", return_value={"defaultModel": "gemini-3.1-flash-image"}):
            result = gateway.design_caption_preview(
                FakeForm({"request": json.dumps(request, ensure_ascii=False)}),
                {"id": gateway.OWNER_ID},
            )
        self.assertIn("۱۰۱٬۲۵۰", result["caption"])
        self.assertIn("API بازار", result["caption"])
        self.assertNotIn("کپشن قدیمی", result["caption"])

    def test_saved_caption_is_kept_for_fast_publish_after_editing(self) -> None:
        package = gateway.design_publication_package({
            "request": {
                "brand": "kalametaze",
                "format": {"template": "sport"},
                "content": {
                    "title": "ورزش امروز",
                    "publicationCaption": "کپشن ویرایش‌شدهٔ مدیر",
                },
            },
        })
        self.assertEqual(package["caption"], "کپشن ویرایش‌شدهٔ مدیر")
        self.assertEqual(package["article"]["body"], "کپشن ویرایش‌شدهٔ مدیر")

    def test_request_keeps_one_off_image_engine_and_economical_quality(self) -> None:
        request = self.studio_request({})
        request["format"] = {"family": "news", "template": "news_story", "canvas": "story_1080x1920"}
        request["content"] = {"title": "تیتر آزمایشی"}
        request["image"].update({"engine": "gpt-image-2", "quality": "medium"})
        with mock.patch.object(gateway, "image_model_settings", return_value={"defaultModel": "gemini-3.1-flash-image"}):
            accepted = gateway.validate_request(request)
        self.assertEqual(accepted["image"]["engine"], "gpt-image-2")
        self.assertEqual(accepted["image"]["quality"], "medium")

    def test_sport_tool_returns_persian_curated_event_choices(self) -> None:
        league = {"leagues": [{"strCurrentSeason": "2026-2027", "strBadge": "league.png"}]}
        events = {"events": [{
            "idEvent": "1", "strHomeTeam": "Esteghlal", "strAwayTeam": "Persepolis",
            "dateEvent": "2026-09-21", "strTime": "16:00:00", "intRound": "8",
            "intHomeScore": "2", "intAwayScore": "1", "strHomeTeamBadge": "home.png", "strAwayTeamBadge": "away.png",
        }]}
        with mock.patch.object(gateway, "fetch_json", side_effect=[league, events]):
            result = gateway.sport_data_tool(FakeForm({"action": "events", "competitionId": "iran_pro", "mode": "result"}))
        self.assertEqual(result["events"][0]["home"], "استقلال")
        self.assertEqual(result["events"][0]["away"], "پرسپولیس")
        self.assertEqual(result["events"][0]["score"], "2 - 1")

    def test_visual_riddle_uses_validated_city_id(self) -> None:
        with mock.patch.object(gateway, "ai_delimited_suggestions", return_value=["ایدهٔ تصویری", "پاسخ"]):
            result = gateway.morning_visual_riddle_value("golbahar")
        self.assertEqual(result["values"]["morningVisualRiddleAnswer"], "پاسخ")

    def test_ai_suggestions_retry_once_when_model_breaks_the_delimiter_contract(self) -> None:
        with mock.patch.object(gateway, "morning_ai_text", side_effect=["خروجی بدون جداکننده", "پرسش|||پاسخ"]) as model:
            result = gateway.ai_delimited_suggestions("یک معما بساز.", "پیشنهاد معما", 2)
        self.assertEqual(result, ["پرسش", "پاسخ"])
        self.assertEqual(model.call_count, 2)

    def test_ai_suggestions_accept_first_complete_set_when_model_adds_an_alternative(self) -> None:
        with mock.patch.object(gateway, "morning_ai_text", return_value="عنوان اول|||متن اول|||عنوان دوم|||متن دوم") as model:
            result = gateway.ai_delimited_suggestions("عنوان و متن بساز.", "پیشنهاد مناسبت", 2)
        self.assertEqual(result, ["عنوان اول", "متن اول"])
        self.assertEqual(model.call_count, 1)

    def test_ai_provider_retries_one_transient_gateway_timeout(self) -> None:
        timeout = urllib.error.HTTPError("https://api.avalai.ir", 504, "timeout", {}, io.BytesIO(b"{}"))
        self.addCleanup(timeout.close)
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(
            {"choices": [{"message": {"content": "پیشنهاد سالم"}}]},
            ensure_ascii=False,
        ).encode("utf-8")
        with (
            mock.patch.object(gateway, "AVALAI_API_KEY", "test-key"),
            mock.patch.object(gateway.urllib.request, "urlopen", side_effect=[timeout, response]) as provider,
            mock.patch.object(gateway.time, "sleep"),
        ):
            result = gateway.morning_ai_text("prompt", "پیشنهاد آزمایشی")
        self.assertEqual(result, "پیشنهاد سالم")
        self.assertEqual(provider.call_count, 2)

    def test_concurrent_json_writes_remain_valid_and_leave_no_shared_temp_file(self) -> None:
        target = self.data_dir / "state.json"
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda index: gateway.write_json_atomic(target, {"index": index, "text": "فارسی"}), range(40)))
        payload = json.loads(target.read_text(encoding="utf-8"))
        self.assertIn(payload["index"], range(40))
        self.assertEqual(payload["text"], "فارسی")
        self.assertEqual(list(self.data_dir.glob(".state.json.*.tmp")), [])

    def test_corrupt_news_snapshot_is_contained_instead_of_becoming_http_503(self) -> None:
        gateway.NEWS_SEEKER_DIR.mkdir(parents=True)
        gateway.NEWS_SEEKER_SNAPSHOTS_FILE.write_bytes(b"[\xff]")
        self.assertEqual(gateway.news_seeker_load(), [])

    def test_studio_blank_space_uses_only_text_dimensions_not_raw_copy(self) -> None:
        secret_copy = "این عنوان هنوز نباید روی تصویر نوشته شود"
        request = gateway.validate_request(self.studio_request({
            "presenterIds": ["tara"],
            "locationId": "studio_main",
            "textMode": "blank",
            "text": secret_copy,
            "copySpacePlacement": "left",
            "expressions": {"tara": "مطمئن"},
        }))
        prompt = "\n".join(gateway.studio_image_prompt_sections(request["format"]["studio"]))
        self.assertNotIn(secret_copy, prompt)
        self.assertIn("سمت چپ تصویر", prompt)
        self.assertIn("۸ واژه", prompt)
        self.assertIn("هیچ متن", prompt)

    def test_studio_designed_text_and_character_direction_are_explicit(self) -> None:
        request = gateway.validate_request(self.studio_request({
            "presenterIds": ["kamran", "tara"],
            "locationId": "newsroom",
            "textMode": "designed",
            "text": "روایت تازه از شهر",
            "expressions": {"tara": "لبخند ملایم"},
            "characterInstructions": {"tara": "با دست چپ به عنوان اشاره کند"},
        }))
        prompt = "\n".join(gateway.studio_image_prompt_sections(request["format"]["studio"]))
        self.assertIn("«روایت تازه از شهر»", prompt)
        self.assertIn("قهرمان تایپوگرافیک", prompt)
        self.assertIn("کارگردانی اختصاصی این کاراکتر: با دست چپ به عنوان اشاره کند", prompt)

    def test_studio_prompt_uses_tighter_environmental_framing_and_forbids_cutout(self) -> None:
        request = gateway.validate_request(self.studio_request({
            "presenterIds": ["tara"],
            "locationId": "studio_2",
            "textMode": "monitor",
            "monitorText": "",
            "expressions": {},
        }))
        prompt = "\n".join(gateway.studio_image_prompt_sections(request["format"]["studio"]))
        self.assertIn("از کمر یا حداکثر میانهٔ ران به بالا", prompt)
        self.assertIn("۱۶ تا ۲۴ درصد", prompt)
        self.assertIn("cutout", prompt)
        self.assertIn("هم‌پوشانی طبیعی با مبلمان", prompt)

    def test_location_profile_guides_mise_en_scene_without_forcing_a_desk_or_reference_camera(self) -> None:
        location = {
            "assetId": "00000000-0000-4000-8000-000000000031",
            "kind": "location",
            "entityId": "studio_2",
            "profile": {"role": "single_presenter", "framing": "medium", "placement": "behind_desk", "foregroundOccluder": "desk"},
        }
        presenter = {
            "assetId": "00000000-0000-4000-8000-000000000032",
            "kind": "presenter",
            "entityId": "tara",
            "profile": {"role": "portrait", "framing": "close"},
        }
        profile = gateway.video_asset_profile(location)
        self.assertEqual(profile["placement"], "behind_desk")
        self.assertEqual(profile["foregroundOccluder"], "desk")
        request = self.studio_request({"presenterIds": ["tara"], "locationId": "studio_2"})
        with mock.patch.object(gateway, "selected_studio_image_reference_assets", return_value=[presenter, location]):
            contract = gateway.studio_image_reference_contract(request)
        self.assertIn("مرجع اصلیِ هویت محیط", contract)
        self.assertIn("فقط هویت چهره", contract)
        self.assertIn("میز فقط یک امکانِ محیطی است", contract)
        self.assertIn("دوربین، زاویه، میزانس یا ترکیب‌بندی اجباری", contract)
        self.assertNotIn("میز عنصر جلویی قطعی", contract)
        self.assertNotIn("استقرار: پشت میز", contract)

    def test_studio_prompt_uses_environment_as_evidence_and_requires_natural_full_frame_bokeh(self) -> None:
        request = self.studio_request({
            "presenterIds": ["tara"],
            "locationId": "newsroom",
            "location": {"mode": "exact_reference", "id": "newsroom"},
            "textMode": "monitor",
            "monitorText": "",
        })
        prompt = "\n".join(gateway.studio_image_prompt_sections(request["format"]["studio"]))
        self.assertIn("خودِ عکس، پلان یا قاب نهایی نیست", prompt)
        self.assertIn("مجری را خودکار پشت میز حبس نکن", prompt)
        self.assertIn("دوربین فول‌فریم", prompt)
        self.assertIn("f/1.8 تا f/2.8", prompt)
        self.assertIn("bokeh واقعی", prompt)

    def test_news_templates_delegate_geometry_to_active_render_module(self) -> None:
        story = gateway.DEFAULT_TEMPLATE_PROMPTS["news_story"]
        post = gateway.DEFAULT_TEMPLATE_PROMPTS["news_post"]
        for brief in (story, post):
            self.assertNotIn("y_min", brief)
            self.assertIn("ماژول هندسی", brief)
            self.assertIn("شیشه", brief)
        self.assertIn("همهٔ اسلایدهای کاروسل", post)

    def test_channel_caption_keeps_one_intentional_blank_line_without_tripling_it(self) -> None:
        rich_text = "<p>خط اول</p><p><br></p><p>خط دوم</p>"
        self.assertEqual(gateway.channel_rich_text(rich_text), "خط اول\n\nخط دوم")

    def test_ambiguous_album_gateway_error_never_triggers_per_file_fallback(self) -> None:
        error = urllib.error.HTTPError("https://n8n.example/album", 500, "upstream", {}, io.BytesIO(b""))
        self.addCleanup(error.close)
        self.assertTrue(gateway.publication_delivery_is_ambiguous(error))
        self.assertTrue(gateway.publication_delivery_is_ambiguous(TimeoutError("timed out")))
        definite = urllib.error.HTTPError("https://n8n.example/album", 400, "bad request", {}, io.BytesIO(b""))
        self.addCleanup(definite.close)
        self.assertFalse(gateway.publication_delivery_is_ambiguous(definite))

    def test_studio_monitor_images_and_title_space_are_independent(self) -> None:
        request = gateway.validate_request(self.studio_request({
            "presenterIds": ["tara"],
            "locationId": "newsroom",
            "textMode": "designed",
            "text": "روایت امروز",
            "monitor": {"mode": "images", "imageMode": "preserve", "imageCount": 2, "brief": "گزارش افتتاح پروژه"},
            "titleSpace": {"enabled": True, "placement": "right", "textHint": "عنوان دو خطی"},
        }))
        studio = request["format"]["studio"]
        prompt = "\n".join(gateway.studio_image_prompt_sections(studio))
        self.assertEqual(studio["monitor"]["imageMode"], "preserve")
        self.assertTrue(studio["titleSpace"]["enabled"])
        self.assertIn("محتوای پیکسلی کاملاً وفادار", prompt)
        self.assertIn("گزارش افتتاح پروژه", prompt)
        self.assertIn("سمت راست تصویر", prompt)
        self.assertIn("قهرمان تایپوگرافیک", prompt)
        self.assertIn("هیچ نمایشگر، تلویزیون، مانیتور", prompt)
        self.assertIn("به باکس، کارت، مستطیل، پنل", prompt)

    def test_monitor_upload_is_stored_with_distinct_role(self) -> None:
        upload = UploadWhoseTruthValueIsInvalid()
        upload.name = "monitorImages"
        upload.filename = "خبر-مانیتور.png"
        form = FakeForm({}, [upload])
        with mock.patch.object(gateway, "sync_media_to_s3", return_value=""):
            result = gateway.save_uploads(form, "00000000-0000-4000-8000-000000000099")
        self.assertEqual(result[0]["role"], "monitor_reference")
        self.assertEqual(result[0]["originalFilename"], "خبر-مانیتور.png")

    def test_legacy_studio_monitor_text_is_normalised(self) -> None:
        request = gateway.validate_request(self.studio_request({
            "presenterIds": ["kamran"],
            "locationId": "newsroom",
            "monitorText": "کلام تازه",
            "expressions": {},
        }))
        studio = request["format"]["studio"]
        self.assertEqual(studio["textMode"], "monitor")
        self.assertEqual(studio["text"], "کلام تازه")
        self.assertEqual(studio["monitorText"], "کلام تازه")

    def test_studio_rejects_unknown_presenters(self) -> None:
        with self.assertRaises(gateway.ClientError):
            gateway.validate_request(self.studio_request({
                "presenterIds": ["unknown-person"],
                "locationId": "newsroom",
            }))


if __name__ == "__main__":
    unittest.main()
