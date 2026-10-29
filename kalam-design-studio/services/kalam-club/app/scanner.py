from __future__ import annotations

import socket
import struct
import logging
from contextlib import closing

from sqlalchemy.orm import Session

from .config import settings
from .models import ClubAttachment, UploadStatus, utcnow
from .storage import ALLOWED_MEMBER_MEDIA_TYPES, client as s3_client, delete_object, media_extension, normalize_content_type


class ScannerUnavailable(RuntimeError):
    """ClamAV was not ready; leave the file quarantined and retry later."""


def _clamav_scan_s3_object(storage_key: str) -> str:
    """Stream an S3 object to clamd without storing a 300 MB copy on disk."""

    cfg = settings()
    try:
        response = s3_client().get_object(Bucket=cfg.s3_bucket, Key=storage_key)
        body = response["Body"]
        with closing(socket.create_connection((cfg.clamav_host, cfg.clamav_port), timeout=cfg.clamav_timeout_seconds)) as connection:
            connection.settimeout(cfg.clamav_timeout_seconds)
            connection.sendall(b"zINSTREAM\0")
            while chunk := body.read(1024 * 1024):
                connection.sendall(struct.pack("!I", len(chunk)))
                connection.sendall(chunk)
            connection.sendall(struct.pack("!I", 0))
            answer = bytearray()
            while True:
                data = connection.recv(4096)
                if not data:
                    break
                answer.extend(data)
                if b"\0" in data:
                    break
    except (OSError, KeyError) as error:
        raise ScannerUnavailable("سرویس اسکن فایل در دسترس نیست.") from error
    finally:
        try:
            body.close()
        except (NameError, AttributeError):
            pass
    result = answer.decode("utf-8", errors="replace").strip("\0\r\n ")
    if not result:
        raise ScannerUnavailable("اسکن فایل پاسخ معتبری نداد.")
    return result


def scan_attachment(session: Session, attachment: ClubAttachment) -> bool:
    """Set AVAILABLE only after a clean result; delete infected objects."""

    if attachment.status != UploadStatus.QUARANTINED:
        return False
    if not settings().clamav_enabled:
        # ClamAV can be deliberately paused on a constrained host. In that
        # mode only the server-validated media set may leave quarantine; old
        # arbitrary uploads remain unavailable and are removed.
        allowed = ALLOWED_MEMBER_MEDIA_TYPES.get(media_extension(attachment.original_filename))
        if not allowed or normalize_content_type(attachment.content_type) != allowed[0]:
            attachment.status = UploadStatus.FAILED
            attachment.scanned_at = utcnow()
            try:
                delete_object(attachment.storage_key)
            except Exception:
                pass
            return True
        attachment.status = UploadStatus.AVAILABLE
        attachment.scanned_at = utcnow()
        return True
    result = _clamav_scan_s3_object(attachment.storage_key)
    if result.endswith("OK"):
        attachment.status = UploadStatus.AVAILABLE
        attachment.scanned_at = utcnow()
        return True
    if "FOUND" in result:
        attachment.status = UploadStatus.FAILED
        attachment.scanned_at = utcnow()
        try:
            delete_object(attachment.storage_key)
        except Exception:
            # It remains failed even if remote cleanup needs a later operator
            # action; it can never be downloaded through this application.
            pass
        return True
    raise ScannerUnavailable("نتیجهٔ اسکن فایل نامعتبر بود.")


def scan_pending_attachments(session: Session, limit: int = 8) -> int:
    pending = (
        session.query(ClubAttachment)
        .filter(ClubAttachment.status == UploadStatus.QUARANTINED)
        .order_by(ClubAttachment.created_at.asc())
        .limit(limit)
        .all()
    )
    completed = 0
    for attachment in pending:
        try:
            if scan_attachment(session, attachment):
                session.commit()
                completed += 1
        except ScannerUnavailable:
            session.rollback()
            logging.warning("Club attachment scan deferred: %s", attachment.id)
            continue
        except Exception:
            session.rollback()
            logging.exception("Club attachment scan failed: %s", attachment.id)
            continue
    return completed
