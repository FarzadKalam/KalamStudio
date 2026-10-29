#!/usr/bin/env python3
"""Small, dependency-free gateway for the Kalam Telegram Design Mini App.

It is the only public receiver for Mini App submissions. It validates Telegram
initData, checks the admin allow-list, stores uploaded photos, and forwards a
trusted envelope to the private n8n intake webhook.
"""

from __future__ import annotations

import cgi
import hashlib
import hmac
import json
import os
import re
import traceback
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http import HTTPStatus
from pathlib import Path
from wsgiref.simple_server import make_server

HOST = os.getenv("KALAM_GATEWAY_HOST", "127.0.0.1")
PORT = int(os.getenv("KALAM_GATEWAY_PORT", "8091"))
BOT_TOKEN = os.environ.get("KALAM_TELEGRAM_BOT_TOKEN", "")
OWNER_ID = os.getenv("KALAM_OWNER_TELEGRAM_ID", "605598559")
N8N_WEBHOOK_URL = os.getenv("KALAM_N8N_WEBHOOK_URL", "http://127.0.0.1:5678/webhook/design-request")
N8N_SHARED_SECRET = os.environ.get("KALAM_N8N_SHARED_SECRET", "")
N8N_API_URL = os.getenv("KALAM_N8N_API_URL", "https://n8n.kalametazenews.ir/api/v1")
N8N_API_KEY = os.environ.get("KALAM_N8N_API_KEY", "")
N8N_REPORTER_WORKFLOW_ID = os.getenv("KALAM_N8N_REPORTER_WORKFLOW_ID", "OHXw52fzQvoY88OS")
DATA_DIR = Path(os.getenv("KALAM_DATA_DIR", "/var/lib/kalam-design"))
MAX_BODY_BYTES = int(os.getenv("KALAM_MAX_BODY_BYTES", str(80 * 1024 * 1024)))
MAX_FILE_BYTES = int(os.getenv("KALAM_MAX_FILE_BYTES", str(12 * 1024 * 1024)))
MAX_INIT_AGE_SECONDS = int(os.getenv("KALAM_MAX_INIT_AGE_SECONDS", "3600"))
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ACCESS_FILE = DATA_DIR / "access.json"
MINIAPP_URL = os.getenv("KALAM_MINIAPP_URL", "https://n8n.kalametazenews.ir/miniapp/")


class ClientError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST) -> None:
        self.message = message
        self.status = status
        super().__init__(message)


def json_response(start_response, status: HTTPStatus, body: dict) -> list[bytes]:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    start_response(
        f"{status.value} {status.phrase}",
        [("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(data))), ("Cache-Control", "no-store")],
    )
    return [data]


def load_access() -> dict:
    if not ACCESS_FILE.exists():
        return {"version": 1, "users": {OWNER_ID: {"status": "active", "addedBy": "system", "updatedAt": int(time.time())}}}
    return json.loads(ACCESS_FILE.read_text(encoding="utf-8"))


def save_access(access: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o750)
    temporary = ACCESS_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(access, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(temporary, 0o640)
    temporary.replace(ACCESS_FILE)


def send_bot_message(chat_id: str, text: str) -> None:
    payload = {"chat_id": chat_id, "text": text, "reply_markup": {"inline_keyboard": [[{"text": "مدیریت دسترسی‌ها", "web_app": {"url": MINIAPP_URL}}]]}}
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), method="POST", headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8):
            pass
    except (urllib.error.URLError, TimeoutError):
        # A notification failure must not expose the app or discard a request.
        pass


def access_status(user_id: str) -> str:
    if user_id == OWNER_ID:
        return "owner"
    return load_access().get("users", {}).get(user_id, {}).get("status", "none")


def register_access_request(user: dict) -> str:
    user_id = str(user["id"])
    if user_id == OWNER_ID:
        return "owner"
    access = load_access()
    users = access.setdefault("users", {})
    existing = users.get(user_id, {})
    status = existing.get("status", "none")
    if status == "none":
        users[user_id] = {"status": "pending", "username": user.get("username", ""), "requestedAt": int(time.time())}
        save_access(access)
        send_bot_message(OWNER_ID, f"درخواست دسترسی جدید به استودیو طراحی\nChat ID: {user_id}\nنام کاربری: @{user.get('username') or 'ندارد'}")
        return "pending"
    return status


def require_owner(user: dict) -> None:
    if str(user["id"]) != OWNER_ID:
        raise ClientError("تنها مدیر اصلی می‌تواند دسترسی‌ها را مدیریت کند.", HTTPStatus.FORBIDDEN)


def validate_telegram_init_data(init_data: str) -> dict:
    if not BOT_TOKEN or not N8N_SHARED_SECRET:
        raise RuntimeError("Gateway secrets are not configured.")
    try:
        values = dict(urllib.parse.parse_qsl(init_data, strict_parsing=True, keep_blank_values=True))
        received_hash = values.pop("hash")
        auth_date = int(values["auth_date"])
        user = json.loads(values["user"])
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        keys = [part.split("=", 1)[0] for part in init_data.split("&") if "=" in part]
        print(f"Telegram initData parse rejected: length={len(init_data)} keys={keys} reason={type(exc).__name__}", flush=True)
        raise ClientError("اطلاعات ورود تلگرام معتبر نیست.", HTTPStatus.UNAUTHORIZED) from exc

    data_check = "\n".join(f"{key}={values[key]}" for key in sorted(values))
    secret_key = hmac.new(BOT_TOKEN.encode("utf-8"), b"WebAppData", hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise ClientError("امضای ورود تلگرام تأیید نشد.", HTTPStatus.UNAUTHORIZED)
    if auth_date > int(time.time()) + 60 or int(time.time()) - auth_date > MAX_INIT_AGE_SECONDS:
        raise ClientError("نشست تلگرام منقضی شده است؛ مینی‌اپ را دوباره باز کنید.", HTTPStatus.UNAUTHORIZED)
    return user


def validate_request(request: object) -> dict:
    if not isinstance(request, dict):
        raise ClientError("بدنهٔ درخواست طراحی معتبر نیست.")
    required = ("requestId", "platform", "brand", "format", "content", "image", "production")
    if any(not request.get(key) for key in required):
        raise ClientError("اطلاعات اصلی درخواست کامل نیست.")
    if request["brand"] not in {"kalametaze", "golbahar", "chenaran"}:
        raise ClientError("رسانهٔ انتخاب‌شده معتبر نیست.")
    if request["format"].get("canvas") not in {"story_1080x1920", "post_1080x1350"}:
        raise ClientError("ابعاد خروجی معتبر نیست.")
    if request["image"].get("mode") not in {"generate", "preserve", "reference", "edit_existing", "none"}:
        raise ClientError("حالت تصویر معتبر نیست.")
    if request["production"].get("kind") != "image":
        raise ClientError("تولید ویدیو هنوز فعال نشده است.", HTTPStatus.CONFLICT)
    return request


def safe_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower().lstrip(".")
    if suffix not in ALLOWED_EXTENSIONS:
        raise ClientError("فقط فایل‌های JPG، PNG و WebP قابل دریافت هستند.")
    return suffix


def save_uploads(form: cgi.FieldStorage, request_id: str) -> list[dict]:
    destination = DATA_DIR / "jobs" / request_id / "uploads"
    destination.mkdir(parents=True, exist_ok=True, mode=0o750)
    uploads: list[dict] = []
    for item in form.list or []:
        if item.name != "images" or not item.filename:
            continue
        suffix = safe_suffix(item.filename)
        content = item.file.read(MAX_FILE_BYTES + 1)
        if not content or len(content) > MAX_FILE_BYTES:
            raise ClientError("حجم هر تصویر حداکثر ۱۲ مگابایت است.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        stored_name = f"{len(uploads) + 1:02d}-{uuid.uuid4().hex}.{suffix}"
        target = destination / stored_name
        target.write_bytes(content)
        os.chmod(target, 0o640)
        uploads.append({"assetId": f"job:{request_id}:{stored_name}", "filename": stored_name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    return uploads


def persist_project(request: dict, user: dict, uploaded_images: list[dict]) -> None:
    project_dir = DATA_DIR / "jobs" / request["requestId"]
    project_dir.mkdir(parents=True, exist_ok=True, mode=0o750)
    record = {
        "requestId": request["requestId"],
        "title": request.get("content", {}).get("title", ""),
        "brand": request["brand"],
        "createdAt": int(time.time()),
        "state": "queued",
        "adminUserId": str(user["id"]),
        "uploadedImages": uploaded_images,
        "request": request,
    }
    temporary = project_dir / "request.tmp.json"
    temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(temporary, 0o640)
    temporary.replace(project_dir / "request.json")


def list_projects() -> dict:
    jobs_dir = DATA_DIR / "jobs"
    projects = []
    for item in jobs_dir.iterdir() if jobs_dir.exists() else []:
        record_path = item / "request.json"
        if not record_path.exists():
            continue
        try:
            record = json.loads(record_path.read_text(encoding="utf-8"))
            projects.append({
                "requestId": record["requestId"], "title": record.get("title", ""), "brand": record.get("brand", ""),
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.get("createdAt", 0))),
                "uploadedImageCount": len(record.get("uploadedImages", [])), "state": record.get("state", "queued"),
            })
        except (OSError, json.JSONDecodeError, KeyError):
            continue
    return {"projects": sorted(projects, key=lambda project: project["createdAt"], reverse=True)[:100]}


def forward_to_n8n(envelope: dict) -> None:
    payload = json.dumps(envelope, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        N8N_WEBHOOK_URL,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json", "X-Kalam-Design-Gateway": N8N_SHARED_SECRET},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            if response.status not in {HTTPStatus.OK, HTTPStatus.ACCEPTED}:
                raise RuntimeError(f"n8n returned {response.status}")
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError("n8n intake is unavailable") from exc


def access_view() -> dict:
    users = load_access().get("users", {})
    return {"ownerId": OWNER_ID, "users": [{"chatId": user_id, **details} for user_id, details in users.items()]}


def update_access(form: cgi.FieldStorage, requester: dict) -> dict:
    require_owner(requester)
    action = form.getfirst("action", "")
    target_id = form.getfirst("chatId", "").strip()
    if action == "list":
        return access_view()
    if action not in {"add", "approve", "reject", "revoke"} or not re.fullmatch(r"\d{5,20}", target_id):
        raise ClientError("دستور مدیریت دسترسی معتبر نیست.")
    if target_id == OWNER_ID and action == "revoke":
        raise ClientError("دسترسی مدیر اصلی قابل مسدودسازی نیست.")
    access = load_access()
    users = access.setdefault("users", {})
    now = int(time.time())
    current = users.get(target_id, {})
    status = {"add": "active", "approve": "active", "reject": "rejected", "revoke": "revoked"}[action]
    users[target_id] = {**current, "status": status, "updatedAt": now, "updatedBy": str(requester["id"])}
    save_access(access)
    if action != "add":
        message = "دسترسی شما به استودیو طراحی فعال شد." if status == "active" else "دسترسی شما به استودیو طراحی غیرفعال شد."
        send_bot_message(target_id, message)
    return access_view()


def n8n_request(method: str, path: str, body: dict | None = None) -> dict:
    if not N8N_API_KEY:
        raise RuntimeError("n8n API key is not configured")
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        f"{N8N_API_URL.rstrip('/')}/{path.lstrip('/')}", data=data, method=method,
        headers={"X-N8N-API-KEY": N8N_API_KEY, **({"Content-Type": "application/json"} if data else {})},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_prompts(workflow: dict) -> list[dict]:
    prompts = []
    for node in workflow.get("nodes", []):
        parameters = node.get("parameters", {})
        candidates: list[tuple[list[object], str]] = []
        for index, message in enumerate(parameters.get("messages", {}).get("values", [])):
            if isinstance(message.get("content"), str) and len(message["content"].strip()) > 40:
                candidates.append((["messages", "values", index, "content"], message["content"]))
        for index, assignment in enumerate(parameters.get("assignments", {}).get("assignments", [])):
            if str(assignment.get("name", "")).lower() in {"prompt", "instruction"} and isinstance(assignment.get("value"), str):
                candidates.append((["assignments", "assignments", index, "value"], assignment["value"]))
        for key in ("prompt", "systemPrompt", "instruction"):
            if isinstance(parameters.get(key), str) and len(parameters[key].strip()) > 40:
                candidates.append(([key], parameters[key]))
        for path, content in candidates:
            locator = f"{node['id']}|{'/'.join(map(str, path))}"
            prompts.append({"id": hashlib.sha256(locator.encode()).hexdigest()[:24], "nodeId": node["id"], "nodeName": node["name"], "path": path, "label": f"{node['name']} — {'/'.join(map(str, path))}", "content": content})
    return prompts


def set_path(value: dict, path: list[object], content: str) -> None:
    current: object = value
    for key in path[:-1]:
        current = current[key]  # type: ignore[index]
    current[path[-1]] = content  # type: ignore[index]


def manage_prompts(form: cgi.FieldStorage, requester: dict) -> dict:
    require_owner(requester)
    action = form.getfirst("action", "list")
    workflow = n8n_request("GET", f"workflows/{N8N_REPORTER_WORKFLOW_ID}")
    prompts = extract_prompts(workflow)
    if action == "list":
        return {"prompts": [{key: value for key, value in prompt.items() if key != "path"} for prompt in prompts]}
    if action != "update":
        raise ClientError("دستور مدیریت پرامپت معتبر نیست.")
    prompt_id, content = form.getfirst("promptId", ""), form.getfirst("content", "")
    target = next((prompt for prompt in prompts if prompt["id"] == prompt_id), None)
    if not target or len(content.strip()) < 20:
        raise ClientError("پرامپت انتخاب‌شده یا متن جدید معتبر نیست.")
    versions_dir = DATA_DIR / "prompt-versions"
    versions_dir.mkdir(parents=True, exist_ok=True, mode=0o750)
    version = {"at": int(time.time()), "by": str(requester["id"]), "workflowId": workflow["id"], "nodeId": target["nodeId"], "path": target["path"], "old": target["content"], "new": content}
    (versions_dir / f"{version['at']}-{prompt_id}.json").write_text(json.dumps(version, ensure_ascii=False, indent=2), encoding="utf-8")
    node = next(node for node in workflow["nodes"] if node["id"] == target["nodeId"])
    set_path(node["parameters"], target["path"], content)
    payload = {key: workflow.get(key) for key in ("name", "nodes", "connections", "settings")}
    payload["staticData"] = None
    n8n_request("PUT", f"workflows/{workflow['id']}", payload)
    return {"updated": prompt_id, "prompts": [{key: value for key, value in prompt.items() if key != "path"} for prompt in extract_prompts(n8n_request("GET", f"workflows/{workflow['id']}"))]}


def app(environ, start_response):
    path = environ.get("PATH_INFO", "")
    method = environ.get("REQUEST_METHOD", "GET")
    if method == "GET" and path == "/healthz":
        return json_response(start_response, HTTPStatus.OK, {"status": "ok"})
    if method != "POST" or path not in {"/design-requests", "/session", "/settings/access", "/settings/prompts", "/library/projects"}:
        return json_response(start_response, HTTPStatus.NOT_FOUND, {"error": "not_found"})
    try:
        content_length = int(environ.get("CONTENT_LENGTH") or 0)
        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            raise ClientError("حجم درخواست مجاز نیست.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        if not environ.get("CONTENT_TYPE", "").startswith("multipart/form-data"):
            raise ClientError("نوع ارسال فایل معتبر نیست.")
        form = cgi.FieldStorage(fp=environ["wsgi.input"], environ=environ, keep_blank_values=True)
        telegram_user = validate_telegram_init_data(form.getfirst("telegramInitData", ""))
        if path == "/session":
            status = register_access_request(telegram_user)
            return json_response(start_response, HTTPStatus.OK, {"userId": str(telegram_user["id"]), "access": status})
        if path == "/settings/access":
            return json_response(start_response, HTTPStatus.OK, update_access(form, telegram_user))
        if path == "/settings/prompts":
            return json_response(start_response, HTTPStatus.OK, manage_prompts(form, telegram_user))
        access = register_access_request(telegram_user)
        if access not in {"owner", "active"}:
            raise ClientError("دسترسی شما در انتظار تأیید مدیر است.", HTTPStatus.FORBIDDEN)
        if path == "/library/projects":
            return json_response(start_response, HTTPStatus.OK, list_projects())
        try:
            design_request = validate_request(json.loads(form.getfirst("request", "")))
        except json.JSONDecodeError as exc:
            raise ClientError("بدنهٔ درخواست طراحی قابل خواندن نیست.") from exc
        request_id = str(design_request["requestId"])
        if not re.fullmatch(r"[a-zA-Z0-9-]{16,64}", request_id):
            raise ClientError("شناسهٔ درخواست معتبر نیست.")
        uploaded_images = save_uploads(form, request_id)
        design_request["adminUserId"] = str(telegram_user["id"])
        design_request["assets"] = {**design_request.get("assets", {}), "adminImageIds": [item["assetId"] for item in uploaded_images]}
        persist_project(design_request, telegram_user, uploaded_images)
        envelope = {"request": design_request, "uploadedImages": uploaded_images, "verifiedTelegramUser": {"id": telegram_user["id"], "username": telegram_user.get("username")}}
        forward_to_n8n(envelope)
        return json_response(start_response, HTTPStatus.ACCEPTED, {"requestId": request_id, "state": "queued"})
    except ClientError as exc:
        return json_response(start_response, exc.status, {"error": exc.message})
    except Exception as exc:
        print(f"Kalam design gateway request failed: {exc!r}\n{traceback.format_exc()}", flush=True)
        return json_response(start_response, HTTPStatus.SERVICE_UNAVAILABLE, {"error": "سرویس طراحی موقتاً در دسترس نیست."})


if __name__ == "__main__":
    DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o750)
    print(f"Kalam design gateway listening on {HOST}:{PORT}")
    make_server(HOST, PORT, app).serve_forever()
