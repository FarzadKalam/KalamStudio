#!/usr/bin/env python3
"""Durable AvalAI Veo 3.1 worker for Kalam Studio video projects."""
from __future__ import annotations

import importlib.util
import json
import mimetypes
import os
import subprocess
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import app

AVALAI_API_KEY = os.environ.get("KALAM_AVALAI_API_KEY", "")
AVALAI_VIDEOS_URL = "https://api.avalai.ir/v1/videos"
POLL_SECONDS = int(os.getenv("KALAM_VIDEO_POLL_SECONDS", "8"))
MAX_POLL_SECONDS = int(os.getenv("KALAM_VIDEO_MAX_POLL_SECONDS", "1200"))
ASSET_DIR = Path("/opt/kalam-design-assets")


def load_prompt_module():
    path = Path(__file__).with_name("video_prompt.py")
    spec = importlib.util.spec_from_file_location("kalam_video_prompt", path)
    if not spec or not spec.loader:
        raise RuntimeError("video prompt compiler is unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prompt_module = load_prompt_module()


def project_path(project_id: str) -> Path:
    return app.VIDEO_PROJECT_DIR / project_id / "project.json"


def save(record: dict) -> None:
    record["updatedAt"] = int(time.time())
    app.write_json_atomic(project_path(record["projectId"]), record)


def event(record: dict, state: str, message: str) -> None:
    record["state"] = state
    record.setdefault("events", []).append({"at": int(time.time()), "attempt": max(1, int(record.get("attempt", 1) or 1)), "state": state, "message": message})
    save(record)


def claim() -> dict | None:
    candidates = []
    for target in app.VIDEO_PROJECT_DIR.glob("*/project.json") if app.VIDEO_PROJECT_DIR.exists() else []:
        try:
            record = json.loads(target.read_text(encoding="utf-8"))
            if record.get("state") in {"queued", "processing"}:
                candidates.append(record)
        except (OSError, UnicodeError, json.JSONDecodeError):
            continue
    if not candidates:
        return None
    record = sorted(candidates, key=lambda item: item.get("updatedAt", item.get("createdAt", 0)))[0]
    if record.get("state") == "queued":
        event(record, "processing", "ساخت ویدیو با Veo 3.1 آغاز شد.")
    return record


def request_json(url: str, method: str = "GET", payload: dict | None = None, timeout: int = 45) -> tuple[dict, dict]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = {"Authorization": f"Bearer {AVALAI_API_KEY}"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8")), dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"AvalAI HTTP {exc.code}: {body}") from exc


def multipart_body(fields: dict[str, str], files: list[tuple[Path, str]]) -> tuple[bytes, str]:
    boundary = f"----KalamVeo{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend([f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode("utf-8")])
    for path, upload_name in files[:3]:
        safe_name = Path(upload_name).name or path.name
        mime = mimetypes.guess_type(safe_name)[0] or "image/jpeg"
        chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"input_reference\"; filename=\"{safe_name}\"\r\nContent-Type: {mime}\r\n\r\n".encode("utf-8"))
        chunks.append(path.read_bytes())
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), boundary


def request_multipart(fields: dict[str, str], files: list[tuple[Path, str]]) -> tuple[dict, dict]:
    body, boundary = multipart_body(fields, files)
    request = urllib.request.Request(AVALAI_VIDEOS_URL, data=body, method="POST", headers={"Authorization": f"Bearer {AVALAI_API_KEY}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8")), dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"AvalAI HTTP {exc.code}: {body_text}") from exc


def default_assets(kind: str, entity_id: str, need: dict | None = None) -> list[Path]:
    matches = [item for item in app.video_asset_registry().get("assets", []) if item.get("kind") == kind and item.get("entityId") == entity_id]
    if need and hasattr(app, "video_asset_match_score"):
        matches.sort(key=lambda item: (app.video_asset_match_score(item, need), int(item.get("createdAt", 0))), reverse=True)
    else:
        matches.sort(key=lambda item: (not bool(item.get("isDefault")), item.get("createdAt", 0)))
    result = []
    for item in matches:
        try:
            result.append(app.video_asset_path(item))
        except app.ClientError:
            continue
    return result


def extract_last_frame(video: Path, destination: Path) -> Path | None:
    result = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-sseof", "-0.08", "-i", str(video), "-frames:v", "1", "-q:v", "2", "-y", str(destination)], capture_output=True, text=True, timeout=90)
    return destination if result.returncode == 0 and destination.is_file() else None


def canonical_reference_image(source: Path, destination: Path) -> Path:
    """Give AvalAI a conservative, EXIF-free RGB JPEG regardless of upload origin.

    Phone images can carry malformed orientation/thumbnail metadata even when a
    browser preview is fine. Veo rejects those files before it reads the prompt.
    Converting every submitted reference also makes PNG and extracted frames
    consistent without changing the original asset stored in the library.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(source),
            "-frames:v", "1", "-vf", "scale=2048:2048:force_original_aspect_ratio=decrease,format=yuvj420p",
            "-q:v", "2", "-y", str(destination),
        ],
        capture_output=True,
        text=True,
        timeout=90,
    )
    if result.returncode != 0 or not destination.is_file() or destination.stat().st_size < 1024:
        detail = (result.stderr or result.stdout).strip()[:300]
        raise RuntimeError(f"reference_image_normalization_failed:{source.name}:{detail}")
    return destination


def canonical_references(record: dict, refs: list[tuple[Path, str]]) -> list[tuple[Path, str]]:
    canonical_dir = app.VIDEO_PROJECT_DIR / record["projectId"] / "references"
    normalized = [
        (canonical_reference_image(path, canonical_dir / f"reference-{index + 1}.jpg"), f"reference-{index + 1}.jpg")
        for index, (path, _name) in enumerate(refs[:3])
    ]
    # AvalAI's currently exposed /v1/videos multipart route documents one
    # input_reference field.  Veo itself can reason over several references,
    # so retain all selected evidence in one safe contact board instead of
    # silently dropping character/location choices or sending repeated fields
    # that the provider rejects with an opaque HTTP 400.
    if len(normalized) < 2:
        return normalized
    board = canonical_dir / "provider-reference-board.jpg"
    inputs: list[str] = []
    filters: list[str] = []
    for index, (path, _name) in enumerate(normalized):
        inputs.extend(["-i", str(path)])
        filters.append(
            f"[{index}:v]scale=1024:1024:force_original_aspect_ratio=decrease,"
            f"pad=1024:1024:(ow-iw)/2:(oh-ih)/2:color=black[r{index}]"
        )
    if len(normalized) == 2:
        filters.append("[r0][r1]hstack=inputs=2,format=yuvj420p[board]")
    else:
        filters.extend([
            "[r0][r1]hstack=inputs=2[top]",
            "[r2]scale=2048:1024:force_original_aspect_ratio=decrease,pad=2048:1024:(ow-iw)/2:(oh-ih)/2:color=black[bottom]",
            "[top][bottom]vstack=inputs=2,format=yuvj420p[board]",
        ])
    result = subprocess.run(
        ["/usr/bin/ffmpeg", "-hide_banner", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filters), "-map", "[board]", "-frames:v", "1", "-q:v", "2", "-y", str(board)],
        capture_output=True,
        text=True,
        timeout=90,
    )
    if result.returncode != 0 or not board.is_file() or board.stat().st_size < 1024:
        detail = (result.stderr or result.stdout).strip()[:300]
        raise RuntimeError(f"reference_board_creation_failed:{detail}")
    return [(board, "kalam-reference-board.jpg")]


def references(record: dict, segment: dict) -> list[tuple[Path, str]]:
    project = record["project"]
    index = int(segment["index"])
    refs: list[tuple[Path, str]] = []
    if index == 0 and project.get("continuation", {}).get("parentProjectId"):
        parent_id = str(project["continuation"]["parentProjectId"])
        parent_manifest = app.VIDEO_PROJECT_DIR / parent_id / "project.json"
        if parent_manifest.is_file():
            try:
                parent = json.loads(parent_manifest.read_text(encoding="utf-8"))
                parent_output = app.VIDEO_PROJECT_DIR / parent_id / "outputs" / str(parent.get("outputFilename", ""))
                if parent_output.is_file():
                    last_frame = extract_last_frame(parent_output, app.VIDEO_PROJECT_DIR / record["projectId"] / "parent.last.jpg")
                    if last_frame:
                        refs.append((last_frame, "CONTINUITY_PARENT_LAST_FRAME.jpg"))
            except (OSError, UnicodeError, json.JSONDecodeError):
                pass
    elif index > 0:
        previous = record["segments"][index - 1]
        previous_file = app.VIDEO_PROJECT_DIR / record["projectId"] / "segments" / str(previous.get("outputFilename", ""))
        if previous_file.is_file():
            last_frame = extract_last_frame(previous_file, previous_file.with_suffix(".last.jpg"))
            if last_frame:
                refs.append((last_frame, "CONTINUITY_PREVIOUS_LAST_FRAME.jpg"))
    prompt_asset_ids = [str(item) for item in segment.get("referenceAssetIds", []) if item]
    if prompt_asset_ids:
        assets = {str(item.get("assetId")): item for item in app.video_asset_registry().get("assets", [])}
        prompt_filenames = [str(item) for item in segment.get("referenceFiles", [])]
        for reference_index, asset_id in enumerate(prompt_asset_ids):
            item = assets.get(asset_id)
            if not item:
                raise RuntimeError(f"prompt_reference_missing:{asset_id}")
            try:
                path = app.video_asset_path(item)
                refs.append((path, prompt_filenames[reference_index] if reference_index < len(prompt_filenames) else path.name))
            except app.ClientError:
                raise RuntimeError(f"prompt_reference_missing:{asset_id}")
    else:
        line = project.get("lines", [])[index] if index < len(project.get("lines", [])) else {}
        presenter_need = app.video_line_asset_need(project, line, "presenter") if hasattr(app, "video_line_asset_need") else None
        location_need = app.video_line_asset_need(project, line, "location") if hasattr(app, "video_line_asset_need") else None
        presenter_refs = default_assets("presenter", str(segment["presenterId"]), presenter_need)
        if not presenter_refs:
            raise RuntimeError(f"studio_reference_missing:presenter:{segment['presenterId']}")
        refs.extend((path, path.name) for path in presenter_refs[:1])
        location = project.get("location", {})
        if location.get("mode") == "catalog":
            location_refs = default_assets("location", str(location.get("id", "")), location_need)
            if not location_refs:
                raise RuntimeError(f"studio_reference_missing:location:{location.get('id', '')}")
            refs.extend((path, path.name) for path in location_refs[:1])
        selected = set(str(item) for item in location.get("assetIds", []) if item)
        selected_paths: list[Path] = []
        for item in app.video_asset_registry().get("assets", []):
            if item.get("assetId") in selected:
                try:
                    path = app.video_asset_path(item)
                    refs.append((path, path.name))
                    selected_paths.append(path)
                except app.ClientError:
                    pass
        if location.get("mode") != "catalog" and not selected_paths:
            raise RuntimeError("studio_reference_missing:location_attachment")
    unique: list[tuple[Path, str]] = []
    known_paths: set[Path] = set()
    for item in refs:
        if item[0] not in known_paths:
            known_paths.add(item[0])
            unique.append(item)
    return unique[:3]


def recover_provider_id(safety_identifier: str) -> str:
    try:
        data, _ = request_json(f"{AVALAI_VIDEOS_URL}/?{urllib.parse.urlencode({'safety_identifier': safety_identifier})}")
        items = data.get("data", data.get("videos", [])) if isinstance(data, dict) else []
        if isinstance(items, list) and items:
            return str(sorted(items, key=lambda item: item.get("created_at", 0), reverse=True)[0].get("id", ""))
    except Exception:
        pass
    return ""


def submit_segment(record: dict, segment: dict) -> None:
    project = record["project"]
    line = project["lines"][int(segment["index"])]
    options = prompt_module.provider_options(project)
    safety_id = f"kalam_{record['projectId']}_{segment['index']}"
    prompt = str(segment.get("prompt", "")).strip() or prompt_module.compile_segment(project, line, int(segment["index"]))
    negative = str(segment.get("negativePrompt", "")).strip()
    if negative:
        prompt += f"\n\nEXCLUDE COMPLETELY: {negative}"
    fields = {**options, "prompt": prompt, "safety_identifier": safety_id}
    refs = canonical_references(record, references(record, segment))
    try:
        response, headers = request_multipart(fields, refs) if refs else request_json(AVALAI_VIDEOS_URL, "POST", fields, 90)
    except Exception:
        recovered = recover_provider_id(safety_id)
        if not recovered:
            raise
        response, headers = {"id": recovered, "status": "processing"}, {}
    provider_id = str(response.get("id", ""))
    if not provider_id:
        raise RuntimeError(f"AvalAI did not return video id: {response}")
    # `avalai-request-id` is the authoritative billing/support trace.  The
    # legacy x-request-id may be a CDN identifier, so retain the dedicated
    # header first and keep the body value as a compatibility fallback.
    segment.update({"state": str(response.get("status", "processing")), "providerId": provider_id, "providerRequestId": str(response.get("request_id") or headers.get("avalai-request-id") or headers.get("x-request-id") or ""), "progress": int(response.get("progress", 0) or 0)})
    save(record)


def poll_segment(record: dict, segment: dict) -> None:
    started = time.monotonic()
    while time.monotonic() - started < MAX_POLL_SECONDS:
        current = json.loads(project_path(record["projectId"]).read_text(encoding="utf-8"))
        if current.get("state") == "cancel_requested":
            record.update(current)
            segment["state"] = "cancelled"
            event(record, "cancelled", "ادامهٔ ساخت پس از پایان درخواست جاری متوقف شد.")
            return
        status, _ = request_json(f"{AVALAI_VIDEOS_URL}/{segment['providerId']}")
        segment.update({"state": str(status.get("status", "processing")), "progress": int(status.get("progress", 0) or 0)})
        save(record)
        if segment["state"] == "completed":
            return
        if segment["state"] in {"failed", "cancelled", "rejected"}:
            raise RuntimeError(str(status.get("error") or status.get("message") or "Veo generation failed"))
        time.sleep(POLL_SECONDS)
    raise TimeoutError("Veo polling timed out; provider id was retained for safe resume")


def download_segment(record: dict, segment: dict) -> None:
    destination_dir = app.VIDEO_PROJECT_DIR / record["projectId"] / "segments"
    destination_dir.mkdir(parents=True, exist_ok=True, mode=0o750)
    filename = f"segment-{int(segment['index']) + 1:02d}.mp4"
    destination = destination_dir / filename
    request = urllib.request.Request(f"{AVALAI_VIDEOS_URL}/{segment['providerId']}/content", headers={"Authorization": f"Bearer {AVALAI_API_KEY}"})
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            content = response.read(300 * 1024 * 1024)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"AvalAI video download HTTP {exc.code}") from exc
    if len(content) < 1024:
        raise RuntimeError("AvalAI returned an empty video")
    destination.write_bytes(content)
    os.chmod(destination, 0o640)
    segment["outputFilename"] = filename
    segment["state"] = "completed"
    segment["progress"] = 100
    segment["s3Key"] = app.sync_media_to_s3(destination)
    save(record)


def compose(record: dict) -> None:
    output_dir = app.VIDEO_PROJECT_DIR / record["projectId"] / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True, mode=0o750)
    concat_file = output_dir / "segments.txt"
    segment_paths: list[Path] = []
    parent_id = str(record.get("project", {}).get("continuation", {}).get("parentProjectId", ""))
    if parent_id:
        parent_manifest = app.VIDEO_PROJECT_DIR / parent_id / "project.json"
        if parent_manifest.is_file():
            parent = json.loads(parent_manifest.read_text(encoding="utf-8"))
            parent_output = app.VIDEO_PROJECT_DIR / parent_id / "outputs" / str(parent.get("outputFilename", ""))
            if parent_output.is_file():
                segment_paths.append(parent_output)
    segment_paths.extend(app.VIDEO_PROJECT_DIR / record["projectId"] / "segments" / segment["outputFilename"] for segment in record["segments"])
    concat_file.write_text("".join(f"file '{str(path).replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'\n" for path in segment_paths), encoding="utf-8")
    raw = output_dir / "joined.mp4"
    final = output_dir / "final.mp4"
    join = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", "-y", str(raw)], capture_output=True, text=True, timeout=600)
    if join.returncode != 0:
        join = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", "-y", str(raw)], capture_output=True, text=True, timeout=1200)
    if join.returncode != 0:
        raise RuntimeError(f"ffmpeg concat failed: {join.stderr[-1000:]}")
    brand = record["project"].get("brand", "kalametaze")
    logo_name = {"kalametaze": "kalametaze-on-dark.png", "golbahar": "golbahar-on-dark.png", "chenaran": "chenaran-on-dark.png"}.get(brand, "kalametaze-on-dark.png")
    logo = ASSET_DIR / logo_name
    if logo.is_file():
        overlay = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(raw), "-i", str(logo), "-filter_complex", "[1:v]scale=180:-1[logo];[0:v][logo]overlay=W-w-36:36", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", "-y", str(final)], capture_output=True, text=True, timeout=1200)
        if overlay.returncode != 0:
            raise RuntimeError(f"ffmpeg brand overlay failed: {overlay.stderr[-1000:]}")
    else:
        raw.replace(final)
    record["outputFilename"] = final.name
    record["s3Key"] = app.sync_media_to_s3(final)
    event(record, "completed", "ویدیو با همهٔ بخش‌ها ساخته، یکپارچه و ذخیره شد.")


def process(record: dict) -> None:
    try:
        if not AVALAI_API_KEY:
            raise RuntimeError("KALAM_AVALAI_API_KEY is missing")
        for segment in record.get("segments", []):
            if segment.get("state") == "completed" and segment.get("outputFilename"):
                continue
            if not segment.get("providerId"):
                submit_segment(record, segment)
            poll_segment(record, segment)
            if record.get("state") == "cancelled":
                return
            download_segment(record, segment)
        compose(record)
        owner_id = str(record.get("ownerId") or "")
        if owner_id:
            app.notify_browser("designComplete", "ویدیو آماده شد", str(record.get("project", {}).get("title") or "خروجی ویدیو شما آماده است."), "?tab=library", {owner_id})
    except Exception as exc:
        active = next((item for item in record.get("segments", []) if item.get("state") not in {"completed", "cancelled"}), None)
        if active:
            active["state"] = "failed"
            active["error"] = str(exc)[:1000]
        event(record, "failed", "ساخت ویدیو کامل نشد؛ شناسهٔ درخواست حفظ شده و تلاش مجدد هزینهٔ تکراری ایجاد نمی‌کند.")
        record["error"] = str(exc)[:2000]
        save(record)
        print(f"Kalam video project {record.get('projectId')} failed: {exc!r}\n{traceback.format_exc()}", flush=True)


def main() -> None:
    print("Kalam Veo worker started", flush=True)
    while True:
        record = claim()
        if record:
            process(record)
        else:
            time.sleep(2)


if __name__ == "__main__":
    main()
