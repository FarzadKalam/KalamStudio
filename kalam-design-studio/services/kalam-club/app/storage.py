from __future__ import annotations

import hashlib
import re
import uuid
from datetime import timedelta
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from fastapi import HTTPException, status

from .config import settings
from .models import utcnow


PART_SIZE_BYTES = 8 * 1024 * 1024
# Club member uploads intentionally support a narrow, display-safe media set.
# Do not add document, archive, SVG or executable-like formats here: the Club
# has no business need for them and they are a frequent source of browser and
# malware-delivery issues when an antivirus service is temporarily offline.
ALLOWED_MEMBER_MEDIA_TYPES: dict[str, tuple[str, set[str]]] = {
    ".jpg": ("image/jpeg", {"image/jpeg", "image/pjpeg"}),
    ".jpeg": ("image/jpeg", {"image/jpeg", "image/pjpeg"}),
    ".png": ("image/png", {"image/png"}),
    ".webp": ("image/webp", {"image/webp"}),
    ".gif": ("image/gif", {"image/gif"}),
    ".mp4": ("video/mp4", {"video/mp4"}),
    ".mov": ("video/quicktime", {"video/quicktime"}),
    ".webm": ("video/webm", {"video/webm"}),
    ".mp3": ("audio/mpeg", {"audio/mpeg", "audio/mp3"}),
    ".m4a": ("audio/mp4", {"audio/mp4", "audio/x-m4a"}),
    ".wav": ("audio/wav", {"audio/wav", "audio/x-wav", "audio/wave"}),
    ".ogg": ("audio/ogg", {"audio/ogg", "application/ogg"}),
    ".opus": ("audio/ogg", {"audio/ogg"}),
}
ALLOWED_IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def safe_filename(value: str) -> str:
    filename = str(value or "").replace("\\", "/").split("/")[-1].strip()
    filename = re.sub(r"[\x00-\x1f<>:\\|?*]", "_", filename)
    return filename[:240] or "file"


def media_extension(filename: str) -> str:
    return "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def normalize_content_type(value: str) -> str:
    return str(value or "").split(";", 1)[0].strip().lower()


def validate_upload(filename: str, bytes_count: int, declared_content_type: str = "") -> tuple[str, str]:
    if bytes_count <= 0 or bytes_count > settings().max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="حجم فایل خارج از سقف مجاز ۳۰۰ مگابایت است.")
    clean = safe_filename(filename)
    extension = media_extension(clean)
    media = ALLOWED_MEMBER_MEDIA_TYPES.get(extension)
    if not media:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="فقط فایل‌های تصویری، ویدیویی و صوتی مجاز هستند.",
        )
    canonical_type, accepted_declared_types = media
    declared = normalize_content_type(declared_content_type)
    # Some mobile browsers do not expose File.type. The completed object is
    # still signature-checked below, so an absent generic type is safe.
    if declared and declared != "application/octet-stream" and declared not in accepted_declared_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="نوع اعلام‌شدهٔ فایل با فرمت مجاز آن هم‌خوانی ندارد.",
        )
    return clean, canonical_type


def validate_uploaded_media_signature(filename: str, content_type: str, body_prefix: bytes) -> None:
    """Ensure a multipart object really is the allowed media format.

    Browser-supplied names and MIME types can be forged. This inexpensive
    first-bytes check runs before an attachment becomes visible, and is also
    the required safety boundary while ClamAV is intentionally disabled.
    """

    extension = media_extension(safe_filename(filename))
    media = ALLOWED_MEMBER_MEDIA_TYPES.get(extension)
    if not media or normalize_content_type(content_type) != media[0]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="نوع فایل مجاز نیست.")
    valid = {
        ".jpg": body_prefix.startswith(b"\xff\xd8\xff"),
        ".jpeg": body_prefix.startswith(b"\xff\xd8\xff"),
        ".png": body_prefix.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": body_prefix.startswith(b"RIFF") and body_prefix[8:12] == b"WEBP",
        ".gif": body_prefix.startswith((b"GIF87a", b"GIF89a")),
        ".mp4": len(body_prefix) >= 12 and body_prefix[4:8] == b"ftyp",
        ".mov": len(body_prefix) >= 12 and body_prefix[4:8] == b"ftyp",
        ".m4a": len(body_prefix) >= 12 and body_prefix[4:8] == b"ftyp",
        ".webm": body_prefix.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in body_prefix[:4096].lower(),
        ".mp3": body_prefix.startswith(b"ID3") or (len(body_prefix) >= 2 and body_prefix[0] == 0xff and body_prefix[1] & 0xe0 == 0xe0),
        ".wav": body_prefix.startswith(b"RIFF") and body_prefix[8:12] == b"WAVE",
        ".ogg": body_prefix.startswith(b"OggS"),
        ".opus": body_prefix.startswith(b"OggS") and b"OpusHead" in body_prefix[:256],
    }.get(extension, False)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="محتوای واقعی فایل با فرمت انتخاب‌شده هم‌خوانی ندارد.",
        )


def validate_admin_image(filename: str, declared_content_type: str, body: bytes) -> tuple[str, str]:
    """Validate a small brand image before it enters the normal AV queue.

    The Studio gateway deliberately forwards administration calls as signed
    JSON. Restricting this path to raster brand assets and checking both the
    extension and real file signature keeps it separate from member uploads.
    """

    if not body or len(body) > settings().max_admin_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="حجم تصویر باید حداکثر ۴ مگابایت باشد.",
        )
    clean = safe_filename(filename)
    extension = "." + clean.rsplit(".", 1)[-1].lower() if "." in clean else ""
    expected_type = ALLOWED_IMAGE_TYPES.get(extension)
    if not expected_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="برای لوگو و تصویر جایزه فقط JPG، PNG و WebP مجاز است.",
        )
    detected_type = ""
    if body.startswith(b"\xff\xd8\xff"):
        detected_type = "image/jpeg"
    elif body.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_type = "image/png"
    elif body.startswith(b"RIFF") and body[8:12] == b"WEBP":
        detected_type = "image/webp"
    if detected_type != expected_type or (declared_content_type and declared_content_type.lower() != expected_type):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="نوع واقعی فایل تصویر با پسوند یا نوع ارسالی آن هم‌خوانی ندارد.",
        )
    return clean, detected_type


@lru_cache
def client():
    cfg = settings()
    if not cfg.s3_enabled:
        raise RuntimeError("فضای ذخیره‌سازی فایل باشگاه پیکربندی نشده است.")
    return boto3.client(
        "s3",
        endpoint_url=cfg.s3_endpoint,
        aws_access_key_id=cfg.s3_access_key_id,
        aws_secret_access_key=cfg.s3_secret_access_key,
        region_name=cfg.s3_region or None,
        config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path" if cfg.s3_force_path_style else "virtual"}),
    )


def object_key(member_id: str, filename: str) -> str:
    stamp = utcnow().strftime("%Y/%m/%d")
    digest = hashlib.sha256(f"{member_id}:{uuid.uuid4()}:{filename}".encode("utf-8")).hexdigest()[:24]
    return f"{settings().s3_prefix.strip('/')}/members/{member_id}/{stamp}/{digest}-{safe_filename(filename)}"


def admin_image_object_key(purpose: str, filename: str) -> str:
    stamp = utcnow().strftime("%Y/%m/%d")
    digest = hashlib.sha256(f"admin:{purpose}:{uuid.uuid4()}:{filename}".encode("utf-8")).hexdigest()[:24]
    return f"{settings().s3_prefix.strip('/')}/brand/{purpose}/{stamp}/{digest}-{safe_filename(filename)}"


def initiate_multipart(storage_key: str, content_type: str) -> str:
    result = client().create_multipart_upload(
        Bucket=settings().s3_bucket,
        Key=storage_key,
        ContentType=content_type,
        Metadata={"source": "kalam-club", "scan": "pending"},
    )
    return str(result["UploadId"])


def part_url(storage_key: str, s3_upload_id: str, part_number: int) -> str:
    return client().generate_presigned_url(
        "upload_part",
        Params={"Bucket": settings().s3_bucket, "Key": storage_key, "UploadId": s3_upload_id, "PartNumber": part_number},
        ExpiresIn=15 * 60,
    )


def complete_multipart(storage_key: str, s3_upload_id: str, parts: list[dict]) -> None:
    client().complete_multipart_upload(
        Bucket=settings().s3_bucket,
        Key=storage_key,
        UploadId=s3_upload_id,
        MultipartUpload={"Parts": [{"ETag": item["etag"], "PartNumber": int(item["part_number"])} for item in parts]},
    )


def upload_part(storage_key: str, s3_upload_id: str, part_number: int, body: bytes) -> str:
    result = client().upload_part(
        Bucket=settings().s3_bucket,
        Key=storage_key,
        UploadId=s3_upload_id,
        PartNumber=part_number,
        Body=body,
    )
    return str(result.get("ETag") or "").strip('"')


def put_small_object(storage_key: str, content_type: str, body: bytes) -> None:
    client().put_object(
        Bucket=settings().s3_bucket,
        Key=storage_key,
        Body=body,
        ContentType=content_type,
        Metadata={"source": "kalam-club-admin", "scan": "pending"},
    )


def abort_multipart(storage_key: str, s3_upload_id: str) -> None:
    client().abort_multipart_upload(Bucket=settings().s3_bucket, Key=storage_key, UploadId=s3_upload_id)


def download_url(storage_key: str) -> str:
    return client().generate_presigned_url(
        "get_object", Params={"Bucket": settings().s3_bucket, "Key": storage_key}, ExpiresIn=int(timedelta(minutes=10).total_seconds())
    )


def delete_object(storage_key: str) -> None:
    client().delete_object(Bucket=settings().s3_bucket, Key=storage_key)


def object_prefix(storage_key: str, bytes_count: int = 8192) -> bytes:
    response = client().get_object(
        Bucket=settings().s3_bucket,
        Key=storage_key,
        Range=f"bytes=0-{max(0, bytes_count - 1)}",
    )
    body = response["Body"]
    try:
        return body.read(bytes_count)
    finally:
        body.close()
