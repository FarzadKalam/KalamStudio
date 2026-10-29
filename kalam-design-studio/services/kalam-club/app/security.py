from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import jwt
from fastapi import HTTPException, Request, status

from .config import settings
from .models import MemberSession, utcnow


PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
MEMBER_COOKIE = "kalam_club_session"


def normalize_iranian_phone(value: str) -> str:
    raw = str(value or "").translate(PERSIAN_DIGITS).strip().replace(" ", "").replace("-", "")
    if raw.startswith("0098"):
        raw = "+98" + raw[4:]
    if raw.startswith("98") and len(raw) == 12:
        raw = "+" + raw
    if raw.startswith("0") and len(raw) == 11:
        raw = "+98" + raw[1:]
    if raw.startswith("9") and len(raw) == 10:
        raw = "+98" + raw
    if len(raw) != 13 or not raw.startswith("+989") or not raw[1:].isdigit():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="شماره موبایل معتبر نیست.")
    return raw


def otp_hash(phone: str, code: str) -> str:
    material = f"{phone}:{code}".encode("utf-8")
    return hmac.new(settings().session_secret.encode("utf-8"), material, hashlib.sha256).hexdigest()


def new_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def new_token_id() -> str:
    return secrets.token_urlsafe(36)


def issue_member_token(member_id: str, token_id: str, expires_at) -> str:
    payload = {"sub": member_id, "jti": token_id, "typ": "member", "exp": expires_at, "iat": utcnow()}
    return jwt.encode(payload, settings().session_secret, algorithm="HS256")


@dataclass(frozen=True)
class MemberPrincipal:
    member_id: str
    token_id: str


def read_member_token(request: Request) -> MemberPrincipal:
    token = request.cookies.get(MEMBER_COOKIE)
    if not token:
        header = request.headers.get("Authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ورود لازم است.")
    try:
        payload = jwt.decode(token, settings().session_secret, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="نشست ورود معتبر نیست.") from error
    if payload.get("typ") != "member" or not payload.get("sub") or not payload.get("jti"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="نشست ورود معتبر نیست.")
    return MemberPrincipal(member_id=str(payload["sub"]), token_id=str(payload["jti"]))


def member_session_is_active(session, principal: MemberPrincipal) -> bool:
    record = session.query(MemberSession).filter(MemberSession.token_id == principal.token_id).one_or_none()
    return bool(record and not record.revoked_at and record.expires_at > utcnow() and str(record.member_id) == principal.member_id)


@dataclass(frozen=True)
class AdminPrincipal:
    external_id: str
    display_name: str
    roles: tuple[str, ...]


def verify_internal_admin_request(request: Request, body: bytes) -> AdminPrincipal:
    """Validate the short-lived signature emitted server-side by Studio gateway.

    No browser receives this secret. The signature ties identity, timestamp,
    request method/path and body hash together and expires after five minutes.
    """

    external_id = request.headers.get("X-Club-Admin-Id", "").strip()
    display_name = request.headers.get("X-Club-Admin-Name", "").strip()
    roles_header = request.headers.get("X-Club-Admin-Roles", "").strip()
    timestamp = request.headers.get("X-Club-Admin-Timestamp", "").strip()
    signature = request.headers.get("X-Club-Admin-Signature", "").strip()
    if not all((external_id, timestamp, signature)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="دسترسی ادمین معتبر نیست.")
    try:
        sent_at = int(timestamp)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="دسترسی ادمین معتبر نیست.") from error
    if abs(int(utcnow().timestamp()) - sent_at) > 300:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="دسترسی ادمین منقضی شده است.")
    body_hash = hashlib.sha256(body).hexdigest()
    material = "\n".join((timestamp, external_id, request.method.upper(), request.url.path, body_hash)).encode("utf-8")
    expected = hmac.new(settings().internal_signing_secret.encode("utf-8"), material, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="امضای دسترسی ادمین معتبر نیست.")
    roles = tuple(sorted({role.strip() for role in roles_header.split(",") if role.strip()})) or ("club_admin",)
    return AdminPrincipal(external_id=external_id, display_name=display_name, roles=roles)


def admin_can(principal: AdminPrincipal, required: str) -> bool:
    return "club_admin" in principal.roles or required in principal.roles


def require_admin(principal: AdminPrincipal, required: str) -> None:
    if not admin_can(principal, required):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="این نقش اجازهٔ انجام عملیات را ندارد.")


def member_session_expiry():
    return utcnow() + timedelta(days=30)
