from __future__ import annotations

import math
import base64
import hashlib
import hmac
import re
import secrets
import uuid
from base64 import b64decode, b64encode
from datetime import timedelta

from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload

from .club_policy import RULES_VERSION, CONTENT_CATEGORIES
from .points import add_entry, lock_member
from .models import StoryCampaign
from .config import settings
from .database import create_schema, get_session
from .domain import (
    audit,
    claim_reward,
    create_admin_message,
    create_member_message,
    create_submission,
    create_anonymous_submission,
    ensure_admin,
    import_reward_codes,
    reveal_code,
    review_claim,
    review_submission,
    serialize_member,
    serialize_message,
    serialize_reward,
)
from .models import (
    ClaimStatus,
    ClubAdmin,
    AuditLog,
    ClubAttachment,
    ClubReplyRule,
    ContentStatus,
    ContentSubmission,
    Conversation,
    ConversationMessage,
    Member,
    MemberSession,
    NotificationOutbox,
    NotificationStatus,
    NotificationTemplate,
    OtpChallenge,
    Reward,
    RewardClaim,
    RewardCode,
    RewardKind,
    FulfillmentMode,
    RewardPartner,
    SenderKind,
    UploadSession,
    UploadStatus,
    utcnow,
)
from .notifications import seed_templates
from .realtime import realtime
from .schemas import (
    AdminClaimReview,
    AdminContentReview,
    AdminMediaUpload,
    AdminReplyCreate,
    AdminRolesUpdate,
    ChatMessageCreate,
    ContentSubmissionCreate,
    AnonymousContentSubmissionCreate,
    AnonymousAuthorizationCreate,
    AnonymousUploadInitiate,
    AnonymousUploadPartsRequest,
    AnonymousUploadComplete,
    OtpRequest,
    OtpVerify,
    PartnerUpsert,
    ProfileUpdate,
    RulesAcceptance,
    ReplyRuleUpsert,
    RewardClaimCreate,
    RewardCodesImport,
    RewardUpsert,
    NotificationTemplateUpdate,
    UploadComplete,
    UploadInitiate,
    UploadPartsRequest,
)
from .security import (
    MEMBER_COOKIE,
    AdminPrincipal,
    member_session_expiry,
    member_session_is_active,
    new_otp,
    new_token_id,
    normalize_iranian_phone,
    otp_hash,
    read_member_token,
    require_admin,
    verify_internal_admin_request,
    issue_member_token,
)
from .sms import SmsDeliveryError, send_otp, send_transactional_sms
from .storage import (
    PART_SIZE_BYTES,
    admin_image_object_key,
    client as s3_client,
    complete_multipart,
    delete_object,
    download_url,
    initiate_multipart,
    object_key,
    object_prefix,
    part_url,
    put_small_object,
    upload_part,
    validate_admin_image,
    validate_uploaded_media_signature,
    validate_upload,
)


app = FastAPI(title="Kalam Club API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Club-Admin-Id", "X-Club-Admin-Name", "X-Club-Admin-Roles", "X-Club-Admin-Timestamp", "X-Club-Admin-Signature"],
)


@app.on_event("startup")
def bootstrap() -> None:
    create_schema()
    session = next(get_session())
    try:
        seed_templates(session)
    finally:
        session.close()


def current_member(request: Request, session: Session = Depends(get_session)) -> Member:
    principal = read_member_token(request)
    if not member_session_is_active(session, principal):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="نشست ورود معتبر نیست.")
    member = session.get(Member, uuid.UUID(principal.member_id))
    if not member or member.status.value != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="حساب کاربری در دسترس نیست.")
    member.last_seen_at = utcnow()
    session.commit()
    return member


async def current_admin(request: Request, session: Session = Depends(get_session)) -> ClubAdmin:
    principal = verify_internal_admin_request(request, await request.body())
    admin = ensure_admin(session, principal)
    session.commit()
    return admin


@app.post("/api/admin/studio-login-otp")
async def admin_studio_login_otp(payload: dict, request: Request, session: Session = Depends(get_session)) -> dict:
    """Send a Studio login code via Club's shared, approved SMS pattern."""
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    phone = normalize_iranian_phone(str(payload.get("phone") or ""))
    code = str(payload.get("code") or "")
    if not phone or not re.fullmatch(r"\d{6}", code):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="شماره یا کد ورود معتبر نیست.")
    try:
        receipt = await send_otp(phone, code)
    except SmsDeliveryError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ارسال پیامک ورود ناموفق بود.") from exc
    return {"sent": True, "providerMessageId": receipt.provider_message_id}


def serialize_attachment(item: ClubAttachment) -> dict:
    return {
        "id": str(item.id), "filename": item.original_filename, "contentType": item.content_type,
        "bytes": item.bytes, "status": item.status.value, "createdAt": item.created_at.isoformat(),
    }


def serialize_submission(item: ContentSubmission) -> dict:
    member = serialize_member(item.member) if item.member else {
        "id": "", "phone": "", "fullName": "ارسال‌کننده ناشناس", "city": "",
        "contentTypes": [], "skills": [], "creditLabel": "بدون نام", "platformHandles": {},
        "score": 0, "profileComplete": False, "rulesVersion": RULES_VERSION,
        "marketingSmsAllowed": False, "createdAt": item.created_at.isoformat(),
    }
    return {
        "id": str(item.id), "memberId": str(item.member_id) if item.member_id else None, "member": member,
        "anonymous": bool(item.is_anonymous), "classifiedDetails": item.classified_details or {},
        "status": item.status.value, "creditLabel": item.credit_label, "awardedScore": item.awarded_score,
        "contentCategory": item.content_category,
        "reviewedBy": item.reviewer.display_name if item.reviewer else None,
        "campaign": item.campaign_details or None,
        "adminNote": item.admin_note, "rejectionReason": item.rejection_reason,
        "createdAt": item.created_at.isoformat(), "reviewedAt": item.reviewed_at.isoformat() if item.reviewed_at else None,
        "items": [
            {"id": str(child.id), "attachmentId": str(child.attachment_id) if child.attachment_id else None, "text": child.text, "caption": child.caption, "position": child.position}
            for child in sorted(item.items, key=lambda child: child.position)
        ],
    }


def serialize_claim(item: RewardClaim, include_code: bool = False) -> dict:
    return {
        "id": str(item.id), "reward": serialize_reward(item.reward), "status": item.status.value,
        "pointsDebited": item.points_debited, "fulfillmentNote": item.fulfillment_note,
        "createdAt": item.created_at.isoformat(), "redeemedAt": item.redeemed_at.isoformat() if item.redeemed_at else None,
        "codeAvailable": bool(include_code),
    }


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/auth/request-otp", status_code=status.HTTP_202_ACCEPTED)
async def request_otp(payload: OtpRequest, session: Session = Depends(get_session)) -> dict:
    phone = normalize_iranian_phone(payload.phone)
    now = utcnow()
    latest = (
        session.query(OtpChallenge)
        .filter(OtpChallenge.phone == phone, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.sent_at.desc())
        .first()
    )
    if latest and (now - latest.sent_at).total_seconds() < settings().otp_resend_seconds:
        remaining = settings().otp_resend_seconds - int((now - latest.sent_at).total_seconds())
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"لطفاً {remaining} ثانیه دیگر تلاش کنید.")
    code = new_otp()
    challenge = OtpChallenge(phone=phone, code_hash=otp_hash(phone, code), expires_at=now + timedelta(seconds=settings().otp_ttl_seconds))
    session.add(challenge)
    # Persist the challenge before contacting the provider. Some SMS gateways
    # accept the message but lose/slow their HTTP response; rolling this row
    # back made an actually delivered code impossible to use.
    session.commit()
    try:
        receipt = await send_otp(phone, code)
    except SmsDeliveryError as error:
        audit(session, "system", "melipayamak", "otp.delivery_unconfirmed", "otp_challenge", str(challenge.id))
        session.commit()
        # The provider has been observed to deliver an OTP while its response
        # is delayed or malformed. Keep the legitimate code usable and let the
        # client move to the code screen instead of presenting a false error.
        return {
            "ok": True,
            "resendAfterSeconds": settings().otp_resend_seconds,
            "expiresInSeconds": settings().otp_ttl_seconds,
            "deliveryStatus": "unconfirmed",
        }
    challenge.provider_message_id = receipt.provider_message_id
    session.commit()
    return {
        "ok": True,
        "resendAfterSeconds": settings().otp_resend_seconds,
        "expiresInSeconds": settings().otp_ttl_seconds,
        "deliveryStatus": "confirmed",
    }


@app.post("/api/auth/verify-otp")
def verify_otp(payload: OtpVerify, response: Response, session: Session = Depends(get_session)) -> dict:
    phone = normalize_iranian_phone(payload.phone)
    challenge = (
        session.query(OtpChallenge)
        .filter(OtpChallenge.phone == phone, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.sent_at.desc())
        .first()
    )
    if not challenge or challenge.expires_at <= utcnow() or challenge.attempts >= settings().otp_max_attempts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="کد تأیید منقضی یا نامعتبر است.")
    challenge.attempts += 1
    if otp_hash(phone, payload.code) != challenge.code_hash:
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="کد تأیید صحیح نیست.")
    challenge.consumed_at = utcnow()
    member = session.query(Member).filter_by(phone=phone).one_or_none()
    if not member:
        member = Member(phone=phone)
        session.add(member)
        session.flush()
        audit(session, "member", str(member.id), "member.created", "member", str(member.id))
    expiry = member_session_expiry()
    token_id = new_token_id()
    session.add(MemberSession(member_id=member.id, token_id=token_id, expires_at=expiry))
    session.commit()
    response.set_cookie(MEMBER_COOKIE, issue_member_token(str(member.id), token_id, expiry), max_age=30 * 24 * 3600, httponly=True, secure=True, samesite="lax", path="/")
    return {"member": serialize_member(member), "profileComplete": bool(member.agreement_accepted_at)}


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, session: Session = Depends(get_session)) -> Response:
    try:
        principal = read_member_token(request)
    except HTTPException as error:
        if error.status_code != status.HTTP_401_UNAUTHORIZED:
            raise
        response.delete_cookie(MEMBER_COOKIE, path="/", secure=True, httponly=True, samesite="lax")
        response.status_code = status.HTTP_204_NO_CONTENT
        return response
    record = session.query(MemberSession).filter_by(token_id=principal.token_id).one_or_none()
    if record:
        record.revoked_at = utcnow()
        session.commit()
    response.delete_cookie(MEMBER_COOKIE, path="/", secure=True, httponly=True, samesite="lax")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@app.get("/api/me")
def get_me(member: Member = Depends(current_member)) -> dict:
    return {"member": serialize_member(member)}


@app.post("/api/me/rules")
def accept_rules(payload: RulesAcceptance, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    if payload.version != RULES_VERSION:
        raise HTTPException(status_code=422, detail="نسخه قوانین تغییر کرده است؛ صفحه را تازه کنید.")
    if member.rules_version != RULES_VERSION:
        member.rules_version = RULES_VERSION
        member.rules_accepted_at = utcnow()
        audit(session, "member", str(member.id), "member.rules_accepted", "member", str(member.id), {"version": RULES_VERSION})
        session.commit()
    return {"member": serialize_member(member)}


@app.put("/api/me")
def update_profile(payload: ProfileUpdate, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    member = lock_member(session, member.id)
    if member.rules_version != RULES_VERSION:
        raise HTTPException(status_code=422, detail="ابتدا قوانین و شرایط باشگاه را بخوانید و تأیید کنید.")
    member.full_name = payload.full_name.strip()
    member.city = payload.city.strip()
    member.content_types = [item.strip()[:100] for item in payload.content_types if item.strip()]
    member.skills = [item.strip()[:100] for item in payload.skills if item.strip()]
    member.credit_label = payload.credit_label.strip()
    member.platform_handles = payload.platform_handles
    member.marketing_sms_allowed = payload.marketing_sms_allowed
    if payload.agreement_accepted and not member.agreement_accepted_at:
        member.agreement_accepted_at = utcnow()
        add_entry(session, member.id, 10, f"welcome:{member.id}", "هدیه عضویت در باشگاه")
    if not member.agreement_accepted_at:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="پذیرش قوانین عضویت لازم است.")
    audit(session, "member", str(member.id), "member.profile_updated", "member", str(member.id))
    session.commit()
    return {"member": serialize_member(member)}


@app.get("/api/chat/conversation")
def get_my_conversation(member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    from .domain import get_or_create_open_conversation

    conversation = get_or_create_open_conversation(session, member)
    session.commit()
    return {"conversation": {"id": str(conversation.id), "status": conversation.status.value, "lastMessageAt": conversation.last_message_at.isoformat()}}


@app.get("/api/chat/messages")
def get_my_messages(limit: int = 80, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    from .domain import get_or_create_open_conversation

    limit = max(1, min(limit, 200))
    conversation = get_or_create_open_conversation(session, member)
    messages = (
        session.query(ConversationMessage)
        .filter_by(conversation_id=conversation.id)
        .order_by(ConversationMessage.sent_at.desc())
        .limit(limit)
        .all()
    )
    now = utcnow()
    for item in messages:
        if item.sender_kind in {SenderKind.ADMIN, SenderKind.SYSTEM} and not item.read_at:
            item.read_at = now
    conversation.member_last_read_at = now
    session.query(NotificationOutbox).filter(
        NotificationOutbox.member_id == member.id,
        NotificationOutbox.event_key == "chat_new_admin_message",
        NotificationOutbox.status == NotificationStatus.QUEUED,
    ).update({NotificationOutbox.status: NotificationStatus.CANCELLED}, synchronize_session=False)
    session.commit()
    return {"messages": [serialize_message(item) for item in reversed(messages)]}


@app.post("/api/chat/messages", status_code=status.HTTP_201_CREATED)
async def send_my_message(payload: ChatMessageCreate, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    message = create_member_message(session, member, payload.text, payload.attachment_ids)
    message.attachment_captions = payload.attachment_captions
    session.commit()
    serialized = serialize_message(message)
    await realtime.publish_admins({"type": "message.created", "message": serialized, "member": serialize_member(member)})
    return {"message": serialized}


def upload_owned_by(upload, owner):
    return upload.owner_admin_id == owner.id if getattr(owner, "is_admin", False) else upload.owner_member_id == owner.id


def member_can_read_attachment(session, member, attachment):
    if attachment.owner_member_id == member.id:
        return True
    if not attachment.owner_admin_id:
        return False
    messages = session.query(ConversationMessage.attachment_ids).join(Conversation).filter(Conversation.member_id == member.id).all()
    return any(str(attachment.id) in row[0] for row in messages)


@app.post("/api/uploads/initiate", status_code=status.HTTP_201_CREATED)
def upload_initiate(payload: UploadInitiate, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    if not settings().s3_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="فضای آپلود هنوز پیکربندی نشده است.")
    filename, media_type = validate_upload(payload.filename, payload.bytes, payload.content_type)
    storage_key = object_key(str(member.id), filename)
    try:
        provider_upload_id = initiate_multipart(storage_key, media_type)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="شروع آپلود موقتاً ناموفق بود.") from error
    upload = UploadSession(
        owner_member_id=None if getattr(member, "is_admin", False) else member.id,
        owner_admin_id=member.id if getattr(member, "is_admin", False) else None,
        storage_key=storage_key,
        s3_upload_id=provider_upload_id,
        original_filename=filename,
        content_type=media_type,
        bytes=payload.bytes,
        part_size=PART_SIZE_BYTES,
        status=UploadStatus.UPLOADING,
        expires_at=utcnow() + timedelta(hours=24),
    )
    session.add(upload)
    session.commit()
    part_count = math.ceil(payload.bytes / PART_SIZE_BYTES)
    transport = settings().upload_transport.strip().lower()
    if transport not in {"proxy", "direct"}:
        transport = "proxy"
    return {"uploadId": str(upload.id), "partSize": PART_SIZE_BYTES, "partCount": part_count, "expiresAt": upload.expires_at.isoformat(), "transport": transport}


@app.post("/api/uploads/{upload_id}/parts")
def upload_parts(upload_id: uuid.UUID, payload: UploadPartsRequest, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    upload = session.get(UploadSession, upload_id)
    if not upload or not upload_owned_by(upload, member) or upload.status != UploadStatus.UPLOADING or upload.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جلسهٔ آپلود در دسترس نیست.")
    total_parts = math.ceil(upload.bytes / upload.part_size)
    if any(item > total_parts for item in payload.part_numbers):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="شمارهٔ بخش آپلود معتبر نیست.")
    return {"parts": [{"partNumber": number, "url": part_url(upload.storage_key, upload.s3_upload_id, number)} for number in payload.part_numbers]}


@app.put("/api/uploads/{upload_id}/parts/{part_number}")
async def upload_part_proxy(upload_id: uuid.UUID, part_number: int, request: Request, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    """Same-origin multipart transport when object storage cannot grant CORS.

    The browser sends at most one 8 MB segment, retaining retry/resume while
    server-only S3 credentials and bucket policies remain private.
    """

    upload = session.get(UploadSession, upload_id)
    if not upload or not upload_owned_by(upload, member) or upload.status != UploadStatus.UPLOADING or upload.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جلسهٔ آپلود در دسترس نیست.")
    total_parts = math.ceil(upload.bytes / upload.part_size)
    if part_number < 1 or part_number > total_parts:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="شمارهٔ بخش آپلود معتبر نیست.")
    body = await request.body()
    expected_bytes = min(upload.part_size, upload.bytes - (part_number - 1) * upload.part_size)
    if len(body) != expected_bytes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="اندازهٔ بخش آپلود معتبر نیست.")
    try:
        etag = upload_part(upload.storage_key, upload.s3_upload_id, part_number, body)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="ارسال این بخش فایل موقتاً ناموفق بود.") from error
    if not etag:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="پاسخ فضای ذخیره‌سازی معتبر نبود.")
    return {"partNumber": part_number, "etag": etag}


@app.post("/api/uploads/{upload_id}/complete", status_code=status.HTTP_201_CREATED)
def upload_complete(upload_id: uuid.UUID, payload: UploadComplete, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    upload = session.get(UploadSession, upload_id)
    if not upload or not upload_owned_by(upload, member) or upload.status != UploadStatus.UPLOADING:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جلسهٔ آپلود در دسترس نیست.")
    expected = math.ceil(upload.bytes / upload.part_size)
    parts = [{"part_number": item.part_number, "etag": item.etag.strip().strip('"')} for item in payload.parts]
    if sorted(item["part_number"] for item in parts) != list(range(1, expected + 1)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="همهٔ بخش‌های فایل آپلود نشده‌اند.")
    try:
        complete_multipart(upload.storage_key, upload.s3_upload_id, parts)
        remote = s3_client().head_object(Bucket=settings().s3_bucket, Key=upload.storage_key)
        if int(remote.get("ContentLength") or 0) != upload.bytes:
            raise ValueError("size mismatch")
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="تکمیل آپلود ناموفق بود؛ امکان ادامهٔ آپلود را دوباره امتحان کنید.") from error
    try:
        validate_uploaded_media_signature(upload.original_filename, upload.content_type, object_prefix(upload.storage_key))
    except HTTPException:
        # A forged multipart upload must never remain in object storage.
        try:
            delete_object(upload.storage_key)
        except Exception:
            pass
        raise
    except Exception as error:
        try:
            delete_object(upload.storage_key)
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="اعتبارسنجی امنیتی فایل موقتاً ناموفق بود.") from error
    attachment = ClubAttachment(
        owner_member_id=None if getattr(member, "is_admin", False) else member.id,
        owner_admin_id=member.id if getattr(member, "is_admin", False) else None,
        storage_key=upload.storage_key,
        original_filename=upload.original_filename,
        content_type=upload.content_type,
        bytes=upload.bytes,
        sha256=payload.sha256.lower() if payload.sha256 else None,
        status=UploadStatus.QUARANTINED,
    )
    session.add(attachment)
    session.flush()
    upload.parts = parts
    upload.status = UploadStatus.QUARANTINED
    upload.attachment_id = attachment.id
    audit(session, "member", str(member.id), "upload.completed", "attachment", str(attachment.id), {"bytes": attachment.bytes})
    session.commit()
    return {"attachment": serialize_attachment(attachment), "scanStatus": "pending"}


@app.get("/api/attachments/{attachment_id}/download")
def download_attachment(attachment_id: uuid.UUID, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    attachment = session.get(ClubAttachment, attachment_id)
    if not attachment or not member_can_read_attachment(session, member, attachment):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="فایل پیدا نشد.")
    if attachment.status == UploadStatus.QUARANTINED:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="فایل هنوز در حال بررسی امنیتی است.")
    if attachment.status != UploadStatus.AVAILABLE:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="این فایل برای دریافت در دسترس نیست.")
    return {"url": download_url(attachment.storage_key), "filename": attachment.original_filename}


@app.get("/api/attachments/{attachment_id}")
def attachment_metadata(attachment_id: uuid.UUID, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    attachment = session.get(ClubAttachment, attachment_id)
    if not attachment or not member_can_read_attachment(session, member, attachment):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="فایل پیدا نشد.")
    return {"attachment": serialize_attachment(attachment)}


@app.get("/api/public-media/{attachment_id}", include_in_schema=False)
def public_brand_media(attachment_id: uuid.UUID, session: Session = Depends(get_session)) -> RedirectResponse:
    """Serve only clean images that an active public reward or partner uses."""

    attachment = session.get(ClubAttachment, attachment_id)
    if not attachment or attachment.status != UploadStatus.AVAILABLE or attachment.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="تصویر در دسترس نیست.")
    used_by_active_reward = (
        session.query(Reward.id)
        .filter(Reward.image_attachment_id == attachment.id, Reward.active.is_(True))
        .first()
    )
    used_by_active_partner = (
        session.query(RewardPartner.id)
        .filter(RewardPartner.logo_attachment_id == attachment.id, RewardPartner.active.is_(True))
        .first()
    )
    used_by_campaign = any(str(attachment.id) == value.get("banner_id") for campaign in session.query(StoryCampaign).filter_by(active=True).all() for value in campaign.media.values())
    if not used_by_active_reward and not used_by_active_partner and not used_by_campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="تصویر در دسترس نیست.")
    return RedirectResponse(download_url(attachment.storage_key), status_code=status.HTTP_307_TEMPORARY_REDIRECT)


def _anonymous_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _captcha_token(answer: int, nonce: str, issued: int) -> str:
    payload = f"{issued}.{nonce}"
    signature = hmac.new(settings().session_secret.encode(), f"{payload}.{answer}".encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}.{signature}".encode()).decode().rstrip("=")


def _anonymous_authorization_token(actor: str, nonce: str, issued: int) -> str:
    payload = f"{issued}.{actor}.{nonce}"
    signature = hmac.new(settings().session_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}.{signature}".encode()).decode().rstrip("=")


def _verify_anonymous_authorization(token: str, request: Request) -> str:
    actor = hashlib.sha256((settings().session_secret + _anonymous_ip(request)).encode()).hexdigest()
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4)).decode()
        issued_text, token_actor, nonce, signature = raw.split(".", 3)
        signed = f"{issued_text}.{token_actor}.{nonce}"
        valid = hmac.compare_digest(signature, hmac.new(settings().session_secret.encode(), signed.encode(), hashlib.sha256).hexdigest())
        valid = valid and token_actor == actor and int(utcnow().timestamp()) - int(issued_text) <= 20 * 60
    except (ValueError, UnicodeDecodeError):
        valid = False
        nonce = ""
    if not valid:
        raise HTTPException(status_code=422, detail="مجوز ارسال ناشناس منقضی یا نامعتبر است؛ کپچا را دوباره انجام دهید.")
    return nonce


@app.get("/api/public/anonymous-captcha")
def anonymous_captcha(request: Request, session: Session = Depends(get_session)) -> dict:
    actor = hashlib.sha256((settings().session_secret + _anonymous_ip(request)).encode()).hexdigest()
    cutoff = utcnow() - timedelta(minutes=10)
    recent = session.query(AuditLog).filter(AuditLog.actor_id == actor, AuditLog.action == "anonymous.captcha", AuditLog.created_at >= cutoff).count()
    if recent >= 12:
        raise HTTPException(status_code=429, detail="تعداد درخواست‌های کپچا زیاد است؛ چند دقیقه بعد دوباره تلاش کنید.")
    left, right = secrets.randbelow(8) + 2, secrets.randbelow(8) + 1
    issued = int(utcnow().timestamp())
    nonce = secrets.token_urlsafe(10)
    token = _captcha_token(left + right, nonce, issued)
    audit(session, "public", actor, "anonymous.captcha", "captcha", nonce, {})
    session.commit()
    return {"token": token, "question": f"{left} + {right} = ؟", "expiresInSeconds": 300}


@app.post("/api/public/content/authorize")
def authorize_anonymous_content(payload: AnonymousAuthorizationCreate, request: Request, session: Session = Depends(get_session)) -> dict:
    if payload.website.strip():
        raise HTTPException(status_code=422, detail="ارسال نامعتبر است.")
    actor = hashlib.sha256((settings().session_secret + _anonymous_ip(request)).encode()).hexdigest()
    cutoff = utcnow() - timedelta(hours=1)
    recent = session.query(AuditLog).filter(AuditLog.actor_id == actor, AuditLog.action == "anonymous.authorized", AuditLog.created_at >= cutoff).count()
    if recent >= 3:
        raise HTTPException(status_code=429, detail="سقف ارسال ناشناس در این ساعت پر شده است.")
    try:
        raw = base64.urlsafe_b64decode(payload.captcha_token + "=" * (-len(payload.captcha_token) % 4)).decode()
        issued_text, nonce, signature = raw.split(".", 2)
        issued = int(issued_text)
        signed = f"{issued_text}.{nonce}.{payload.captcha_answer.strip()}"
        valid = hmac.compare_digest(signature, hmac.new(settings().session_secret.encode(), signed.encode(), hashlib.sha256).hexdigest())
        valid = valid and int(utcnow().timestamp()) - issued <= 300
    except (ValueError, UnicodeDecodeError):
        valid = False
    if not valid:
        raise HTTPException(status_code=422, detail="پاسخ کپچا درست نیست یا منقضی شده است.")
    if session.query(AuditLog).filter(AuditLog.actor_id == actor, AuditLog.action == "anonymous.captcha.used", AuditLog.subject_id == nonce).first():
        raise HTTPException(status_code=422, detail="این کپچا قبلاً استفاده شده است.")
    audit(session, "public", actor, "anonymous.captcha.used", "captcha", nonce, {})
    authorization_nonce = secrets.token_urlsafe(18)
    audit(session, "public", actor, "anonymous.authorized", "anonymous_authorization", authorization_nonce, {})
    session.commit()
    return {"authorizationToken": _anonymous_authorization_token(actor, authorization_nonce, int(utcnow().timestamp())), "expiresInSeconds": 1200}


def _public_upload(session: Session, upload_id: uuid.UUID, nonce: str) -> UploadSession:
    upload = session.get(UploadSession, upload_id)
    if not upload or upload.public_authorization_id != nonce or upload.status != UploadStatus.UPLOADING or upload.expires_at <= utcnow():
        raise HTTPException(status_code=404, detail="جلسهٔ آپلود ناشناس در دسترس نیست.")
    return upload


@app.post("/api/public/uploads/initiate", status_code=status.HTTP_201_CREATED)
def anonymous_upload_initiate(payload: AnonymousUploadInitiate, request: Request, session: Session = Depends(get_session)) -> dict:
    nonce = _verify_anonymous_authorization(payload.authorization_token, request)
    if not settings().s3_enabled:
        raise HTTPException(status_code=503, detail="فضای آپلود هنوز پیکربندی نشده است.")
    if payload.bytes > min(settings().max_upload_bytes, 50 * 1024 * 1024):
        raise HTTPException(status_code=422, detail="حداکثر حجم هر فایل ناشناس ۵۰ مگابایت است.")
    filename, media_type = validate_upload(payload.filename, payload.bytes, payload.content_type)
    storage_key = object_key(f"anonymous-{nonce[:16]}", filename)
    try:
        provider_upload_id = initiate_multipart(storage_key, media_type)
    except Exception as error:
        raise HTTPException(status_code=503, detail="شروع آپلود موقتاً ناموفق بود.") from error
    upload = UploadSession(owner_member_id=None, owner_admin_id=None, public_authorization_id=nonce, storage_key=storage_key, s3_upload_id=provider_upload_id, original_filename=filename, content_type=media_type, bytes=payload.bytes, part_size=PART_SIZE_BYTES, status=UploadStatus.UPLOADING, expires_at=utcnow() + timedelta(minutes=25))
    session.add(upload); session.commit()
    return {"uploadId": str(upload.id), "partSize": PART_SIZE_BYTES, "partCount": math.ceil(payload.bytes / PART_SIZE_BYTES), "expiresAt": upload.expires_at.isoformat(), "transport": "proxy"}


@app.post("/api/public/uploads/{upload_id}/parts")
def anonymous_upload_parts(upload_id: uuid.UUID, payload: AnonymousUploadPartsRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    upload = _public_upload(session, upload_id, _verify_anonymous_authorization(payload.authorization_token, request))
    total_parts = math.ceil(upload.bytes / upload.part_size)
    if any(item > total_parts for item in payload.part_numbers):
        raise HTTPException(status_code=422, detail="شمارهٔ بخش آپلود معتبر نیست.")
    return {"parts": [{"partNumber": number, "url": f"/api/public/uploads/{upload.id}/parts/{number}?authorization_token={payload.authorization_token}"} for number in payload.part_numbers]}


@app.put("/api/public/uploads/{upload_id}/parts/{part_number}")
async def anonymous_upload_part(upload_id: uuid.UUID, part_number: int, authorization_token: str, request: Request, session: Session = Depends(get_session)) -> dict:
    upload = _public_upload(session, upload_id, _verify_anonymous_authorization(authorization_token, request))
    total_parts = math.ceil(upload.bytes / upload.part_size)
    if part_number < 1 or part_number > total_parts:
        raise HTTPException(status_code=422, detail="شمارهٔ بخش آپلود معتبر نیست.")
    body = await request.body(); expected = min(upload.part_size, upload.bytes - (part_number - 1) * upload.part_size)
    if len(body) != expected:
        raise HTTPException(status_code=422, detail="اندازهٔ بخش آپلود معتبر نیست.")
    try:
        etag = upload_part(upload.storage_key, upload.s3_upload_id, part_number, body)
    except Exception as error:
        raise HTTPException(status_code=502, detail="ارسال این بخش فایل موقتاً ناموفق بود.") from error
    return {"partNumber": part_number, "etag": etag}


@app.post("/api/public/uploads/{upload_id}/complete", status_code=status.HTTP_201_CREATED)
def anonymous_upload_complete(upload_id: uuid.UUID, payload: AnonymousUploadComplete, request: Request, session: Session = Depends(get_session)) -> dict:
    upload = _public_upload(session, upload_id, _verify_anonymous_authorization(payload.authorization_token, request))
    expected = math.ceil(upload.bytes / upload.part_size)
    parts = [{"part_number": item.part_number, "etag": item.etag.strip().strip('"')} for item in payload.parts]
    if sorted(item["part_number"] for item in parts) != list(range(1, expected + 1)):
        raise HTTPException(status_code=422, detail="همهٔ بخش‌های فایل آپلود نشده‌اند.")
    try:
        complete_multipart(upload.storage_key, upload.s3_upload_id, parts)
        remote = s3_client().head_object(Bucket=settings().s3_bucket, Key=upload.storage_key)
        if int(remote.get("ContentLength") or 0) != upload.bytes: raise ValueError("size mismatch")
        validate_uploaded_media_signature(upload.original_filename, upload.content_type, object_prefix(upload.storage_key))
    except HTTPException: raise
    except Exception as error:
        try: delete_object(upload.storage_key)
        except Exception: pass
        raise HTTPException(status_code=502, detail="اعتبارسنجی و تکمیل فایل ناموفق بود.") from error
    attachment = ClubAttachment(owner_member_id=None, owner_admin_id=None, storage_key=upload.storage_key, original_filename=upload.original_filename, content_type=upload.content_type, bytes=upload.bytes, sha256=payload.sha256.lower() if payload.sha256 else None, status=UploadStatus.QUARANTINED)
    session.add(attachment); session.flush(); upload.parts = parts; upload.status = UploadStatus.QUARANTINED; upload.attachment_id = attachment.id
    session.commit()
    return {"attachment": serialize_attachment(attachment), "scanStatus": "pending"}


@app.post("/api/public/content/submissions", status_code=status.HTTP_201_CREATED)
def submit_anonymous_content(payload: AnonymousContentSubmissionCreate, request: Request, session: Session = Depends(get_session)) -> dict:
    actor = hashlib.sha256((settings().session_secret + _anonymous_ip(request)).encode()).hexdigest()
    nonce = _verify_anonymous_authorization(payload.authorization_token, request)
    if session.query(AuditLog).filter(AuditLog.actor_id == actor, AuditLog.action == "anonymous.authorization.used", AuditLog.subject_id == nonce).first():
        raise HTTPException(status_code=422, detail="این مجوز ارسال قبلاً استفاده شده است.")
    attachments = [item.attachment_id for item in payload.items if item.attachment_id]
    if attachments:
        uploads = session.query(UploadSession).filter(UploadSession.attachment_id.in_(attachments), UploadSession.public_authorization_id == nonce, UploadSession.status == UploadStatus.QUARANTINED).all()
        if len(uploads) != len(set(attachments)):
            raise HTTPException(status_code=422, detail="یکی از فایل‌های ناشناس معتبر نیست یا هنوز کامل نشده است.")
    submission = create_anonymous_submission(session, [item.model_dump() for item in payload.items])
    audit(session, "public", actor, "anonymous.authorization.used", "anonymous_authorization", nonce, {})
    audit(session, "public", actor, "anonymous.submission", "content_submission", str(submission.id), {"items": len(payload.items), "attachments": len(attachments)})
    session.commit()
    return {"submission": serialize_submission(submission)}


@app.post("/api/content/submissions", status_code=status.HTTP_201_CREATED)
def submit_content(payload: ContentSubmissionCreate, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    if member.rules_version != RULES_VERSION or not member.agreement_accepted_at:
        raise HTTPException(status_code=422, detail="ابتدا قوانین و اطلاعات عضویت را تکمیل کنید.")
    if payload.content_category not in CONTENT_CATEGORIES:
        raise HTTPException(status_code=422, detail="نوع محتوا معتبر نیست.")
    submission = create_submission(session, member, payload.credit_label, [item.model_dump() for item in payload.items])
    submission.content_category = payload.content_category
    if payload.content_category == "classifieds":
        submission.classified_details = {"type": payload.classified_type, "contact": payload.classified_contact}
    session.commit()
    return {"submission": serialize_submission(submission)}


@app.get("/api/content/submissions")
def list_my_submissions(member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    records = (
        session.query(ContentSubmission)
        .options(joinedload(ContentSubmission.member), joinedload(ContentSubmission.items))
        .filter(ContentSubmission.member_id == member.id)
        .order_by(ContentSubmission.created_at.desc())
        .all()
    )
    return {"submissions": [serialize_submission(item) for item in records]}


@app.get("/api/rewards")
def list_rewards(session: Session = Depends(get_session)) -> dict:
    now = utcnow()
    records = (
        session.query(Reward)
        .options(joinedload(Reward.partner))
        .filter(Reward.active.is_(True), (Reward.active_from.is_(None) | (Reward.active_from <= now)), (Reward.active_until.is_(None) | (Reward.active_until > now)))
        .order_by(Reward.points_cost.asc(), Reward.created_at.desc())
        .all()
    )
    return {"rewards": [serialize_reward(item) for item in records if item.stock_remaining is None or item.stock_remaining > 0]}


@app.post("/api/reward-claims", status_code=status.HTTP_201_CREATED)
def create_reward_claim(payload: RewardClaimCreate, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    claim = claim_reward(session, member, payload.reward_id)
    session.commit()
    return {"claim": serialize_claim(claim)}


@app.get("/api/reward-claims")
def list_reward_claims(member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    records = (
        session.query(RewardClaim)
        .options(joinedload(RewardClaim.reward).joinedload(Reward.partner))
        .filter(RewardClaim.member_id == member.id)
        .order_by(RewardClaim.created_at.desc())
        .all()
    )
    return {"claims": [serialize_claim(item) for item in records]}


@app.get("/api/reward-claims/{claim_id}/code")
def get_reward_code(claim_id: uuid.UUID, member: Member = Depends(current_member), session: Session = Depends(get_session)) -> dict:
    claim = session.query(RewardClaim).filter(RewardClaim.id == claim_id).one_or_none()
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="درخواست جایزه پیدا نشد.")
    code = reveal_code(session, member, claim)
    session.commit()
    return {"code": code}


# Studio administration routes. Their request signature is generated only by
# the existing gateway after it validates the Studio admin session.
@app.get("/api/admin/conversations")
async def admin_conversations(request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "support")
    records = (
        session.query(Conversation)
        .options(joinedload(Conversation.member))
        .order_by(Conversation.last_message_at.desc())
        .limit(500)
        .all()
    )
    return {"conversations": [{"id": str(item.id), "status": item.status.value, "member": serialize_member(item.member), "lastMessageAt": item.last_message_at.isoformat(), "assignedAdminId": str(item.assigned_admin_id) if item.assigned_admin_id else None} for item in records]}


@app.get("/api/admin/conversations/{conversation_id}/messages")
async def admin_conversation_messages(conversation_id: uuid.UUID, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "support")
    conversation = session.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="گفتگو پیدا نشد.")
    records = session.query(ConversationMessage).filter_by(conversation_id=conversation.id).order_by(ConversationMessage.sent_at.asc()).limit(500).all()
    now = utcnow()
    for item in records:
        if item.sender_kind == SenderKind.MEMBER and not item.read_at:
            item.read_at = now
    conversation.admin_last_read_at = now
    session.commit()
    return {"messages": [serialize_message(item) for item in records]}


@app.post("/api/admin/conversations/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
async def admin_send_message(conversation_id: uuid.UUID, payload: AdminReplyCreate, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "support")
    conversation = session.query(Conversation).options(joinedload(Conversation.member)).filter(Conversation.id == conversation_id).one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="گفتگو پیدا نشد.")
    message = create_admin_message(session, admin, conversation, payload.text, payload.attachment_ids, payload.ai_generated)
    message.attachment_captions = payload.attachment_captions
    session.commit()
    serialized = serialize_message(message)
    await realtime.publish_member(str(conversation.member_id), {"type": "message.created", "message": serialized})
    return {"message": serialized}


@app.post("/api/admin/archive-export")
async def admin_archive_export(payload: dict, request: Request, session: Session = Depends(get_session)) -> dict:
    """Return only explicitly selected Club material to the trusted Studio gateway.

    URLs are short-lived S3 URLs and this endpoint is reachable solely through
    the signed Studio-admin envelope.  It is intentionally an export, never an
    automatic archive/import job.
    """
    admin = await current_admin(request, session)
    principal = AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles))
    require_admin(principal, "content_moderator")
    message_ids = payload.get("message_ids", [])
    submission_ids = payload.get("submission_ids", [])
    if not isinstance(message_ids, list) or not isinstance(submission_ids, list):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="انتخاب‌های آرشیو معتبر نیست.")
    if not message_ids and not submission_ids or len(message_ids) + len(submission_ids) > 30:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="حداقل یک و حداکثر ۳۰ مورد انتخاب کنید.")
    try:
        message_keys = [uuid.UUID(str(value)) for value in message_ids]
        submission_keys = [uuid.UUID(str(value)) for value in submission_ids]
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="شناسهٔ انتخاب معتبر نیست.") from exc

    attachment_cache: dict[str, dict] = {}
    def attachment_export(attachment_id: str | None) -> dict | None:
        if not attachment_id:
            return None
        key = str(attachment_id)
        if key in attachment_cache:
            return attachment_cache[key]
        try:
            attachment = session.get(ClubAttachment, uuid.UUID(key))
        except ValueError:
            return None
        if not attachment or attachment.status != UploadStatus.AVAILABLE:
            return None
        value = {"id": str(attachment.id), "filename": attachment.original_filename,
                 "contentType": attachment.content_type, "bytes": attachment.bytes,
                 "url": download_url(attachment.storage_key)}
        attachment_cache[key] = value
        return value

    items: list[dict] = []
    members: list[str] = []
    if message_keys:
        messages = session.query(ConversationMessage).join(Conversation).options(joinedload(Conversation.member)).filter(ConversationMessage.id.in_(message_keys)).all()
        if len(messages) != len(set(message_keys)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="یکی از پیام‌های انتخاب‌شده پیدا نشد.")
        indexed = {str(item.id): item for item in messages}
        for key in message_keys:
            message = indexed[str(key)]
            member = message.conversation.member
            members.append(member.full_name or member.phone)
            items.append({"kind": "conversation_message", "id": str(message.id), "text": message.text or "",
                          "attachments": [value for value in (attachment_export(value) for value in (message.attachment_ids or [])) if value]})
    if submission_keys:
        submissions = session.query(ContentSubmission).options(joinedload(ContentSubmission.member), joinedload(ContentSubmission.items)).filter(ContentSubmission.id.in_(submission_keys)).all()
        if len(submissions) != len(set(submission_keys)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="یکی از محتواهای انتخاب‌شده پیدا نشد.")
        indexed = {str(item.id): item for item in submissions}
        for key in submission_keys:
            submission = indexed[str(key)]
            members.append(submission.member.full_name or submission.member.phone)
            text = "\n".join(part for child in sorted(submission.items, key=lambda value: value.position) for part in (child.text, child.caption) if part)
            items.append({"kind": "content_submission", "id": str(submission.id), "text": text,
                          "attachments": [value for value in (attachment_export(str(child.attachment_id) if child.attachment_id else None) for child in submission.items) if value]})
    first_text = next((str(item.get("text") or "").strip() for item in items if str(item.get("text") or "").strip()), "محتوای ارسالی باشگاه")
    return {"items": items, "source": {"member": "، ".join(dict.fromkeys(value for value in members if value))[:240], "title": first_text.split("\n", 1)[0][:240]}}


@app.post("/api/admin/studio-team-sms")
async def admin_studio_team_sms(payload: dict, request: Request, session: Session = Depends(get_session)) -> dict:
    """Deliver a reviewed Studio-team alert through the existing SMS provider."""
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    recipients = payload.get("recipients", [])
    text = str(payload.get("text") or "").strip()
    if not isinstance(recipients, list) or not recipients or len(recipients) > 30:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="گیرندگان پیامک معتبر نیستند.")
    if not text or len(text) > 320:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="متن پیامک باید حداکثر ۳۲۰ نویسه باشد.")
    phones: list[str] = []
    for recipient in recipients:
        phone = str(recipient.get("phone") if isinstance(recipient, dict) else "")
        if not re.fullmatch(r"09\d{9}", phone):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="شمارهٔ کاری معتبر نیست.")
        if phone not in phones:
            phones.append(phone)
    delivered = 0
    failures: list[str] = []
    for phone in phones:
        try:
            await send_transactional_sms(phone, text)
            delivered += 1
        except SmsDeliveryError:
            failures.append(phone[-4:])
    return {"delivered": delivered, "failed": len(failures), "failedLast4": failures}


@app.get("/api/admin/content/submissions")
async def admin_submissions(request: Request, state: str = "all", session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "content_moderator")
    query = session.query(ContentSubmission).options(joinedload(ContentSubmission.member), joinedload(ContentSubmission.items)).order_by(ContentSubmission.created_at.desc())
    if state in {"pending", "approved", "rejected"}:
        query = query.filter(ContentSubmission.status == ContentStatus(state))
    return {"submissions": [serialize_submission(item) for item in query.all()]}


@app.post("/api/admin/content/submissions/{submission_id}/review")
async def admin_review_content(submission_id: uuid.UUID, payload: AdminContentReview, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "content_moderator")
    submission = session.query(ContentSubmission).options(joinedload(ContentSubmission.member), joinedload(ContentSubmission.items)).filter(ContentSubmission.id == submission_id).one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="محتوا پیدا نشد.")
    review_submission(session, admin, submission, payload.status, payload.score, payload.note)
    session.commit()
    return {"submission": serialize_submission(submission)}


@app.get("/api/admin/showcase-rewards")
async def showcase_rewards(request: Request, session: Session = Depends(get_session)) -> dict:
    await current_admin(request, session)
    return list_rewards(session)


@app.get("/api/admin/showcase-rewards/{reward_id}/images")
async def showcase_reward_images(reward_id: uuid.UUID, request: Request, session: Session = Depends(get_session)) -> dict:
    await current_admin(request, session)
    eligible = {item["id"] for item in list_rewards(session)["rewards"]}
    if str(reward_id) not in eligible:
        raise HTTPException(status_code=404, detail="این جایزه دیگر فعال یا موجود نیست؛ جایزه دیگری انتخاب کنید.")
    reward = session.get(Reward, reward_id)
    ids = [reward.image_attachment_id, reward.partner.logo_attachment_id if reward.partner else None]
    images, pending = [], False
    for attachment_id in dict.fromkeys(ids):
        if not attachment_id:
            continue
        attachment = session.get(ClubAttachment, attachment_id)
        if not attachment or attachment.status != UploadStatus.AVAILABLE:
            pending = True
            continue
        if attachment.content_type not in {"image/jpeg", "image/png", "image/webp"} or attachment.bytes > settings().max_admin_image_bytes:
            continue
        try:
            obj = s3_client().get_object(Bucket=settings().s3_bucket, Key=attachment.storage_key)
            stream = obj["Body"]
            try:
                body = stream.read(settings().max_admin_image_bytes + 1)
            finally:
                stream.close()
            if len(body) > settings().max_admin_image_bytes:
                continue
        except Exception as error:
            raise HTTPException(status_code=503, detail="دریافت تصویر جایزه موقتاً ناموفق بود؛ دوباره تلاش کنید.") from error
        images.append({"id": str(attachment.id), "filename": attachment.original_filename, "contentType": attachment.content_type, "dataBase64": b64encode(body).decode("ascii")})
    return {"images": images, "pending": pending}


@app.get("/api/admin/rewards")
async def admin_rewards(request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    records = session.query(Reward).options(joinedload(Reward.partner)).order_by(Reward.created_at.desc()).all()
    return {"rewards": [serialize_reward(item) | {"active": item.active, "stockTotal": item.stock_total} for item in records]}


@app.post("/api/admin/media", status_code=status.HTTP_201_CREATED)
async def upload_admin_media(payload: AdminMediaUpload, request: Request, session: Session = Depends(get_session)) -> dict:
    """Store a signed Studio brand image, then let the regular AV worker clear it."""

    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    try:
        body = b64decode(payload.data_base64, validate=True)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="دادهٔ تصویر معتبر نیست.") from error
    filename, content_type = validate_admin_image(payload.filename, payload.content_type, body)
    key = admin_image_object_key(payload.purpose, filename)
    try:
        put_small_object(key, content_type, body)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ذخیرهٔ تصویر موقتاً ناموفق بود.") from error
    attachment = ClubAttachment(
        owner_member_id=None,
        storage_key=key,
        original_filename=filename,
        content_type=content_type,
        bytes=len(body),
        status=UploadStatus.QUARANTINED,
    )
    session.add(attachment)
    session.flush()
    audit(session, "admin", str(admin.id), "reward.brand_media_uploaded", "attachment", str(attachment.id), {"purpose": payload.purpose, "bytes": len(body)})
    session.commit()
    return {"attachment": serialize_attachment(attachment), "scanStatus": "pending"}


@app.post("/api/admin/partners", status_code=status.HTTP_201_CREATED)
async def create_partner(payload: PartnerUpsert, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    item = RewardPartner(**payload.model_dump())
    session.add(item)
    session.flush()
    audit(session, "admin", str(admin.id), "reward.partner_created", "reward_partner", str(item.id))
    session.commit()
    return {"partner": {"id": str(item.id), **payload.model_dump()}}


@app.get("/api/admin/partners")
async def admin_partners(request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    records = session.query(RewardPartner).order_by(RewardPartner.name.asc()).all()
    origin = settings().public_origin.rstrip("/")
    return {"partners": [{"id": str(item.id), "name": item.name, "shortDescription": item.short_description, "address": item.address, "phone": item.phone, "websiteUrl": item.website_url, "logoAttachmentId": str(item.logo_attachment_id) if item.logo_attachment_id else None, "logoUrl": f"{origin}/api/public-media/{item.logo_attachment_id}" if item.logo_attachment_id else None, "active": item.active} for item in records]}


@app.put("/api/admin/partners/{partner_id}")
async def update_partner(partner_id: uuid.UUID, payload: PartnerUpsert, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    item = session.get(RewardPartner, partner_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="کسب‌وکار پیدا نشد.")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    audit(session, "admin", str(admin.id), "reward.partner_updated", "reward_partner", str(item.id))
    session.commit()
    return {"partner": {"id": str(item.id), **payload.model_dump()}}


@app.post("/api/admin/rewards", status_code=status.HTTP_201_CREATED)
async def create_reward(payload: RewardUpsert, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    values = payload.model_dump()
    stock_total = values.pop("stock_total")
    values["kind"] = RewardKind(values["kind"])
    values["fulfillment_mode"] = FulfillmentMode(values["fulfillment_mode"])
    item = Reward(**values, stock_total=stock_total, stock_remaining=stock_total)
    session.add(item)
    session.flush()
    audit(session, "admin", str(admin.id), "reward.created", "reward", str(item.id))
    session.commit()
    return {"reward": serialize_reward(item) | {"active": item.active, "stockTotal": item.stock_total}}


@app.put("/api/admin/rewards/{reward_id}")
async def update_reward(reward_id: uuid.UUID, payload: RewardUpsert, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    item = session.query(Reward).options(joinedload(Reward.partner)).filter(Reward.id == reward_id).one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جایزه پیدا نشد.")
    values = payload.model_dump()
    requested_total = values.pop("stock_total")
    values["kind"] = RewardKind(values["kind"])
    values["fulfillment_mode"] = FulfillmentMode(values["fulfillment_mode"])
    if requested_total is not None:
        reserved = (item.stock_total or 0) - (item.stock_remaining or 0)
        if requested_total < reserved:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="موجودی جدید از تعداد جوایز رزروشده کمتر است.")
        item.stock_total = requested_total
        item.stock_remaining = requested_total - reserved
    for key, value in values.items():
        setattr(item, key, value)
    audit(session, "admin", str(admin.id), "reward.updated", "reward", str(item.id))
    session.commit()
    return {"reward": serialize_reward(item) | {"active": item.active, "stockTotal": item.stock_total}}


@app.delete("/api/admin/rewards/{reward_id}")
async def delete_reward(reward_id: uuid.UUID, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    item = session.get(Reward, reward_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جایزه پیدا نشد.")
    item.active = False
    audit(session, "admin", str(admin.id), "reward.deactivated", "reward", str(item.id))
    session.commit()
    return {"deleted": True}


@app.post("/api/admin/rewards/{reward_id}/codes", status_code=status.HTTP_201_CREATED)
async def add_reward_codes(reward_id: uuid.UUID, payload: RewardCodesImport, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    reward = session.get(Reward, reward_id)
    if not reward:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="جایزه پیدا نشد.")
    count = import_reward_codes(session, reward, payload.codes)
    audit(session, "admin", str(admin.id), "reward.codes_imported", "reward", str(reward.id), {"count": count})
    session.commit()
    return {"imported": count, "stockRemaining": reward.stock_remaining}


@app.get("/api/admin/reward-claims")
async def admin_claims(request: Request, claim_status: str | None = None, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    query = session.query(RewardClaim).options(joinedload(RewardClaim.member), joinedload(RewardClaim.reward).joinedload(Reward.partner)).order_by(RewardClaim.created_at.desc())
    if claim_status and claim_status in {item.value for item in ClaimStatus}:
        query = query.filter(RewardClaim.status == ClaimStatus(claim_status))
    return {"claims": [{**serialize_claim(item), "member": serialize_member(item.member)} for item in query.limit(500).all()]}


@app.post("/api/admin/reward-claims/{claim_id}/review")
async def admin_review_claim(claim_id: uuid.UUID, payload: AdminClaimReview, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
    claim = session.query(RewardClaim).options(joinedload(RewardClaim.member), joinedload(RewardClaim.reward)).filter(RewardClaim.id == claim_id).one_or_none()
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="درخواست جایزه پیدا نشد.")
    review_claim(session, admin, claim, payload.status, payload.note)
    session.commit()
    return {"claim": serialize_claim(claim)}


@app.get("/api/admin/notification-templates")
async def admin_notification_templates(request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    records = session.query(NotificationTemplate).order_by(NotificationTemplate.event_key).all()
    return {"templates": [{"id": str(item.id), "eventKey": item.event_key, "channel": item.channel.value, "body": item.body, "enabled": item.enabled, "transactional": item.transactional} for item in records]}


@app.put("/api/admin/notification-templates/{template_id}")
async def update_notification_template(template_id: uuid.UUID, payload: NotificationTemplateUpdate, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    item = session.get(NotificationTemplate, template_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="قالب اعلان پیدا نشد.")
    item.body = payload.body.strip()
    item.enabled = payload.enabled
    audit(session, "admin", str(admin.id), "notification_template.updated", "notification_template", str(item.id), {"enabled": item.enabled})
    session.commit()
    return {"template": {"id": str(item.id), "eventKey": item.event_key, "channel": item.channel.value, "body": item.body, "enabled": item.enabled, "transactional": item.transactional}}


def serialize_reply_rule(item: ClubReplyRule) -> dict:
    return {
        "id": str(item.id), "name": item.name, "enabled": item.enabled,
        "matchMode": item.match_mode, "matchText": item.match_text,
        "responseText": item.response_text, "priority": item.priority,
        "createdAt": item.created_at.isoformat(), "updatedAt": item.updated_at.isoformat(),
    }


@app.get("/api/admin/reply-rules")
async def admin_reply_rules(request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    records = session.query(ClubReplyRule).order_by(ClubReplyRule.priority.asc(), ClubReplyRule.created_at.asc()).all()
    return {"rules": [serialize_reply_rule(item) for item in records]}


@app.post("/api/admin/reply-rules", status_code=status.HTTP_201_CREATED)
async def create_reply_rule(payload: ReplyRuleUpsert, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    item = ClubReplyRule(**payload.model_dump())
    session.add(item)
    session.flush()
    audit(session, "admin", str(admin.id), "reply_rule.created", "reply_rule", str(item.id))
    session.commit()
    return {"rule": serialize_reply_rule(item)}


@app.put("/api/admin/reply-rules/{rule_id}")
async def update_reply_rule(rule_id: uuid.UUID, payload: ReplyRuleUpsert, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    item = session.get(ClubReplyRule, rule_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="قانون پاسخ پیدا نشد.")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    audit(session, "admin", str(admin.id), "reply_rule.updated", "reply_rule", str(item.id))
    session.commit()
    return {"rule": serialize_reply_rule(item)}


@app.delete("/api/admin/reply-rules/{rule_id}")
async def delete_reply_rule(rule_id: uuid.UUID, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    item = session.get(ClubReplyRule, rule_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="قانون پاسخ پیدا نشد.")
    audit(session, "admin", str(admin.id), "reply_rule.deleted", "reply_rule", str(item.id))
    session.delete(item)
    session.commit()
    return {"deleted": True}


@app.get("/api/admin/admins")
async def admin_list_admins(request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    records = session.query(ClubAdmin).order_by(ClubAdmin.display_name.asc(), ClubAdmin.external_id.asc()).all()
    return {"admins": [{"externalId": item.external_id, "displayName": item.display_name, "roles": item.roles, "active": item.active} for item in records]}


@app.put("/api/admin/admins/{external_id}")
async def admin_set_roles(external_id: str, payload: AdminRolesUpdate, request: Request, session: Session = Depends(get_session)) -> dict:
    admin = await current_admin(request, session)
    require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "club_admin")
    target = session.query(ClubAdmin).filter_by(external_id=external_id).one_or_none()
    if not target:
        target = ClubAdmin(external_id=external_id)
        session.add(target)
    target.display_name = payload.display_name
    target.roles = payload.roles
    target.active = payload.active
    audit(session, "admin", str(admin.id), "admin.roles_updated", "admin", str(target.id), {"roles": payload.roles, "active": payload.active})
    session.commit()
    return {"admin": {"externalId": target.external_id, "displayName": target.display_name, "roles": target.roles, "active": target.active}}


from .engagement import install_engagement_routes
install_engagement_routes(app, current_member, current_admin, serialize_submission)
from .admin_uploads import install_admin_uploads
install_admin_uploads(app, current_admin, upload_initiate, upload_part_proxy, upload_complete)


@app.websocket("/api/realtime/member")
async def member_socket(websocket: WebSocket) -> None:
    try:
        principal = read_member_token(websocket)  # WebSocket exposes cookies/headers like Request.
    except HTTPException:
        await websocket.close(code=4401)
        return
    await realtime.connect_member(principal.member_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # heartbeat from client
    except WebSocketDisconnect:
        await realtime.disconnect_member(principal.member_id, websocket)


@app.websocket("/api/realtime/admin")
async def admin_socket(websocket: WebSocket) -> None:
    # Browser admin socket is intentionally deferred until the gateway issues a
    # short-lived signed socket token. HTTP inbox remains fully usable meanwhile.
    await websocket.close(code=4401)
