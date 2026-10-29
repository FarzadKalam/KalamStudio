from __future__ import annotations

import hashlib
import uuid
from datetime import timedelta

from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .config import settings
from .models import (
    AuditLog,
    ClaimStatus,
    ClubAdmin,
    ClubAttachment,
    ClubReplyRule,
    ContentStatus,
    ContentSubmission,
    ContentSubmissionItem,
    Conversation,
    ConversationMessage,
    ConversationStatus,
    Member,
    Reward,
    RewardClaim,
    RewardCode,
    RewardKind,
    SenderKind,
    UploadStatus,
    utcnow,
)
from .notifications import queue_sms
from .security import AdminPrincipal
from .points import add_entry, lock_member


def audit(session: Session, actor_kind: str, actor_id: str, action: str, subject_type: str, subject_id: str, details: dict | None = None) -> None:
    session.add(
        AuditLog(
            actor_kind=actor_kind,
            actor_id=actor_id,
            action=action,
            subject_type=subject_type,
            subject_id=subject_id,
            details=details or {},
        )
    )


def ensure_admin(session: Session, principal: AdminPrincipal) -> ClubAdmin:
    admin = session.query(ClubAdmin).filter_by(external_id=principal.external_id).one_or_none()
    if not admin:
        admin = ClubAdmin(external_id=principal.external_id, display_name=principal.display_name, roles=list(principal.roles), active=True)
        session.add(admin)
        session.flush()
        audit(session, "system", "gateway", "admin.provisioned", "admin", str(admin.id), {"roles": admin.roles})
    elif admin.active:
        # Gateway only provides an identity assertion. Existing role customizations
        # are intentionally not overwritten on every Studio request.
        admin.display_name = principal.display_name or admin.display_name
    if not admin.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="دسترسی باشگاه برای این کاربر غیرفعال است.")
    return admin


def get_or_create_open_conversation(session: Session, member: Member) -> Conversation:
    conversation = (
        session.query(Conversation)
        .filter(Conversation.member_id == member.id, Conversation.status == ConversationStatus.OPEN)
        .order_by(Conversation.last_message_at.desc())
        .first()
    )
    if conversation:
        return conversation
    conversation = Conversation(member_id=member.id, status=ConversationStatus.OPEN)
    session.add(conversation)
    session.flush()
    return conversation


def require_member_attachments(session: Session, member: Member, attachment_ids: list[uuid.UUID]) -> list[ClubAttachment]:
    if not attachment_ids:
        return []
    attachments = (
        session.query(ClubAttachment)
        .filter(ClubAttachment.id.in_(attachment_ids), ClubAttachment.owner_member_id == member.id)
        .all()
    )
    if len(attachments) != len(set(attachment_ids)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="یکی از فایل‌های انتخاب‌شده به حساب شما تعلق ندارد.")
    unavailable = [item for item in attachments if item.status not in {UploadStatus.AVAILABLE, UploadStatus.QUARANTINED}]
    if unavailable:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="یکی از فایل‌ها هنوز برای ارسال آماده نیست.")
    return attachments


def _rule_matches(rule: ClubReplyRule, text: str) -> bool:
    candidate = text.strip().casefold()
    needle = rule.match_text.strip().casefold()
    if not candidate or not needle:
        return False
    if rule.match_mode == "exact":
        return candidate == needle
    if rule.match_mode == "starts_with":
        return candidate.startswith(needle)
    return needle in candidate


def apply_reply_rule(session: Session, conversation: Conversation, member: Member, text: str) -> ConversationMessage | None:
    """Create at most one safe canned response for a member message.

    A rule is only emitted once per conversation. This prevents loops and makes
    the behaviour predictable for the shared human inbox.
    """

    if not text.strip():
        return None
    rules = (
        session.query(ClubReplyRule)
        .filter(ClubReplyRule.enabled.is_(True))
        .order_by(ClubReplyRule.priority.asc(), ClubReplyRule.created_at.asc())
        .all()
    )
    for rule in rules:
        if not _rule_matches(rule, text):
            continue
        already_sent = (
            session.query(ConversationMessage.id)
            .filter(
                ConversationMessage.conversation_id == conversation.id,
                ConversationMessage.automated_rule_id == str(rule.id),
            )
            .first()
        )
        if already_sent:
            continue
        response = ConversationMessage(
            conversation_id=conversation.id,
            sender_kind=SenderKind.SYSTEM,
            text=rule.response_text.strip(),
            attachment_ids=[],
            automated_rule_id=str(rule.id),
        )
        conversation.last_message_at = utcnow()
        conversation.member_last_read_at = None
        session.add(response)
        session.flush()
        audit(
            session,
            "system",
            str(rule.id),
            "conversation.reply_rule_applied",
            "conversation",
            str(conversation.id),
            {"message_id": str(response.id), "member_id": str(member.id)},
        )
        return response
    return None


def create_member_message(session: Session, member: Member, text: str, attachment_ids: list[uuid.UUID]) -> ConversationMessage:
    require_member_attachments(session, member, attachment_ids)
    conversation = get_or_create_open_conversation(session, member)
    message = ConversationMessage(
        conversation_id=conversation.id,
        sender_kind=SenderKind.MEMBER,
        sender_member_id=member.id,
        text=text,
        attachment_ids=[str(item) for item in attachment_ids],
    )
    conversation.last_message_at = utcnow()
    conversation.admin_last_read_at = None
    session.add(message)
    session.flush()
    audit(session, "member", str(member.id), "conversation.message_sent", "conversation", str(conversation.id), {"message_id": str(message.id)})
    apply_reply_rule(session, conversation, member, text)
    return message


def create_admin_message(
    session: Session,
    admin: ClubAdmin,
    conversation: Conversation,
    text: str,
    attachment_ids: list[uuid.UUID],
    ai_generated: bool = False,
) -> ConversationMessage:
    if attachment_ids:
        attachments = session.query(ClubAttachment).filter(ClubAttachment.id.in_(attachment_ids), ClubAttachment.owner_admin_id == admin.id).all()
        if len(attachments) != len(set(attachment_ids)) or any(a.status not in {UploadStatus.AVAILABLE, UploadStatus.QUARANTINED} for a in attachments):
            raise HTTPException(422, "یکی از فایل‌ها متعلق به شما نیست یا آماده ارسال نیست.")
    message = ConversationMessage(
        conversation_id=conversation.id,
        sender_kind=SenderKind.ADMIN,
        sender_admin_id=admin.id,
        text=text,
        attachment_ids=[str(i) for i in attachment_ids],
        ai_generated=ai_generated,
    )
    conversation.last_message_at = utcnow()
    conversation.member_last_read_at = None
    session.add(message)
    session.flush()
    member = conversation.member
    queue_sms(
        session,
        member,
        "chat_new_admin_message",
        {"link": settings().public_origin},
        f"chat-unread:{message.id}",
        delay_seconds=15 * 60,
    )
    audit(session, "admin", str(admin.id), "conversation.reply_sent", "conversation", str(conversation.id), {"message_id": str(message.id), "ai": ai_generated})
    return message


def create_submission(session: Session, member: Member, credit_label: str, items: list[dict]) -> ContentSubmission:
    submission = ContentSubmission(member_id=member.id, credit_label=credit_label or member.credit_label, status=ContentStatus.PENDING)
    session.add(submission)
    session.flush()
    for index, item in enumerate(items):
        attachment_id = item.get("attachment_id")
        if attachment_id:
            require_member_attachments(session, member, [attachment_id])
        if not item.get("text", "").strip() and not attachment_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="هر بخش محتوا باید متن یا فایل داشته باشد.")
        session.add(
            ContentSubmissionItem(
                submission_id=submission.id,
                attachment_id=attachment_id,
                text=item.get("text", "").strip(),
                caption=item.get("caption", "").strip(),
                position=index,
            )
        )
    audit(session, "member", str(member.id), "content.submitted", "content_submission", str(submission.id), {"items": len(items)})
    return submission


def create_anonymous_submission(session: Session, items: list[dict]) -> ContentSubmission:
    submission = ContentSubmission(member_id=None, is_anonymous=True, credit_label="", status=ContentStatus.PENDING)
    session.add(submission)
    session.flush()
    for index, item in enumerate(items):
        attachment_id = item.get("attachment_id")
        text = item.get("text", "").strip()
        caption = item.get("caption", "").strip()
        if not text and not caption and not attachment_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="متن یا فایل پیام مردمی را وارد کنید.")
        session.add(ContentSubmissionItem(submission_id=submission.id, attachment_id=attachment_id, text=text, caption=caption, position=index))
    return submission


def review_submission(session: Session, admin: ClubAdmin, submission: ContentSubmission, target_status: str, score: int, note: str) -> ContentSubmission:
    submission = session.query(ContentSubmission).filter_by(id=submission.id).populate_existing().with_for_update().one()
    if submission.status != ContentStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="این محتوا پیش‌تر بررسی شده است.")
    if target_status == "rejected" and not note.strip():
        raise HTTPException(422, "لطفاً دلیل رد محتوا را بنویسید.")
    member = submission.member
    submission.reviewed_by_admin_id = admin.id
    submission.reviewed_at = utcnow()
    submission.admin_note = note
    if target_status == ContentStatus.APPROVED.value:
        submission.status = ContentStatus.APPROVED
        score = int(submission.campaign_details.get("points", 15)) if submission.campaign_id else score
        if submission.is_anonymous:
            score = 0
        submission.awarded_score = score
        if score > 0 and member:
            title = "هدیه انتشار استوری" if submission.campaign_id else "تأیید محتوای شما"
            add_entry(session, member.id, score, f"content:{submission.id}", title, submission_id=submission.id)
        if member:
            queue_sms(
                session, member, "content_approved",
                {"score": str(score), "link": settings().public_origin},
                f"content-approved:{submission.id}",
            )
    else:
        submission.status = ContentStatus.REJECTED
        submission.rejection_reason = note
        if member:
            queue_sms(
                session, member, "content_rejected",
                {"link": settings().public_origin},
                f"content-rejected:{submission.id}",
            )
    audit(session, "admin", str(admin.id), "content.reviewed", "content_submission", str(submission.id), {"status": target_status, "score": score})
    return submission


def _active_reward(session: Session, reward_id: uuid.UUID) -> Reward:
    reward = session.query(Reward).filter(Reward.id == reward_id).with_for_update().one_or_none()
    if not reward or not reward.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="این جایزه در دسترس نیست.")
    now = utcnow()
    if (reward.active_from and reward.active_from > now) or (reward.active_until and reward.active_until <= now):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="این جایزه در بازهٔ فعال خود نیست.")
    if reward.stock_remaining is not None and reward.stock_remaining <= 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="موجودی این جایزه تمام شده است.")
    return reward


def _code_cipher() -> Fernet:
    try:
        return Fernet(settings().field_encryption_key.encode("utf-8"))
    except ValueError as error:
        raise RuntimeError("CLUB_FIELD_ENCRYPTION_KEY معتبر نیست.") from error


def reward_code_fingerprint(value: str) -> str:
    return hashlib.sha256(value.strip().encode("utf-8")).hexdigest()


def claim_reward(session: Session, member: Member, reward_id: uuid.UUID) -> RewardClaim:
    reward = _active_reward(session, reward_id)
    locked_member = lock_member(session, member.id)
    if locked_member.score < reward.points_cost:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="امتیاز شما برای این جایزه کافی نیست.")
    locked_member.score -= reward.points_cost  # reserve points atomically; rejection refunds them.
    if reward.stock_remaining is not None:
        reward.stock_remaining -= 1
    claim = RewardClaim(member_id=member.id, reward_id=reward.id, status=ClaimStatus.PENDING, points_debited=reward.points_cost)
    session.add(claim)
    session.flush()
    from .models import PointEntry
    session.add(PointEntry(member_id=member.id, amount=-reward.points_cost, event_key=f"claim:{claim.id}",
                           title=f"درخواست جایزه: {reward.title}", claim_id=claim.id, received_at=utcnow()))

    if reward.fulfillment_mode.value == "automatic" and reward.kind == RewardKind.DISCOUNT_CODE:
        code = (
            session.query(RewardCode)
            .filter(RewardCode.reward_id == reward.id, RewardCode.assigned_claim_id.is_(None))
            .with_for_update(skip_locked=True)
            .first()
        )
        if not code:
            locked_member.score += reward.points_cost
            if reward.stock_remaining is not None:
                reward.stock_remaining += 1
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="کد یکتای این جایزه فعلاً موجود نیست.")
        code.assigned_claim_id = claim.id
        code.expires_at = utcnow() + timedelta(days=reward.code_expires_after_days or 30)
        claim.status = ClaimStatus.DELIVERED
        queue_sms(session, member, "reward_delivered", {"reward_title": reward.title, "link": settings().public_origin}, f"reward-delivered:{claim.id}")
    else:
        queue_sms(session, member, "reward_requested", {"reward_title": reward.title, "link": settings().public_origin}, f"reward-requested:{claim.id}")
    audit(session, "member", str(member.id), "reward.claimed", "reward_claim", str(claim.id), {"reward_id": str(reward.id)})
    return claim


def review_claim(session: Session, admin: ClubAdmin, claim: RewardClaim, next_status: str, note: str) -> RewardClaim:
    # Match reservation lock order: reward, then member, then claim.
    session.query(Reward).filter_by(id=claim.reward_id).populate_existing().with_for_update().one()
    lock_member(session, claim.member_id)
    claim = session.query(RewardClaim).filter_by(id=claim.id).populate_existing().with_for_update().one()
    if claim.status in {ClaimStatus.REJECTED, ClaimStatus.REDEEMED, ClaimStatus.EXPIRED, ClaimStatus.CANCELLED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="وضعیت این درخواست قابل تغییر نیست.")
    if next_status == ClaimStatus.REJECTED.value:
        if claim.status == ClaimStatus.REJECTED:
            return claim
        add_entry(session, claim.member_id, claim.points_debited, f"refund:{claim.id}",
                  f"بازگشت امتیاز جایزه: {claim.reward.title}", claim_id=claim.id, pending=False)
        if claim.reward.stock_remaining is not None:
            claim.reward.stock_remaining += 1
        claim.status = ClaimStatus.REJECTED
        queue_sms(session, claim.member, "reward_rejected", {"reward_title": claim.reward.title, "link": settings().public_origin}, f"reward-rejected:{claim.id}")
    else:
        claim.status = ClaimStatus(next_status)
        if claim.status == ClaimStatus.APPROVED:
            queue_sms(session, claim.member, "reward_approved", {"reward_title": claim.reward.title, "link": settings().public_origin}, f"reward-approved:{claim.id}")
        if claim.status == ClaimStatus.DELIVERED:
            queue_sms(session, claim.member, "reward_delivered", {"reward_title": claim.reward.title, "link": settings().public_origin}, f"reward-delivered:{claim.id}")
        if claim.status == ClaimStatus.REDEEMED:
            claim.redeemed_at = utcnow()
            queue_sms(session, claim.member, "reward_redeemed", {"reward_title": claim.reward.title, "link": settings().public_origin}, f"reward-redeemed:{claim.id}")
    claim.fulfilled_by_admin_id = admin.id
    claim.fulfillment_note = note
    audit(session, "admin", str(admin.id), "reward.claim_reviewed", "reward_claim", str(claim.id), {"status": next_status, "note": note})
    return claim


def reveal_code(session: Session, member: Member, claim: RewardClaim) -> str:
    if claim.member_id != member.id or claim.status not in {ClaimStatus.APPROVED, ClaimStatus.DELIVERED, ClaimStatus.REDEEMED}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="کد این جایزه در دسترس نیست.")
    code = session.query(RewardCode).filter(RewardCode.assigned_claim_id == claim.id).one_or_none()
    if not code or (code.expires_at and code.expires_at <= utcnow()):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="کد این جایزه منقضی شده یا در دسترس نیست.")
    claim.code_revealed_at = claim.code_revealed_at or utcnow()
    audit(session, "member", str(member.id), "reward.code_revealed", "reward_claim", str(claim.id))
    return _code_cipher().decrypt(code.encrypted_value.encode("utf-8")).decode("utf-8")


def import_reward_codes(session: Session, reward: Reward, values: list[str]) -> int:
    if reward.kind != RewardKind.DISCOUNT_CODE:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="کد فقط برای جایزهٔ کد تخفیف قابل ثبت است.")
    cipher = _code_cipher()
    created = 0
    for value in {item.strip() for item in values if item.strip()}:
        fingerprint = reward_code_fingerprint(value)
        if session.query(RewardCode).filter_by(code_fingerprint=fingerprint).one_or_none():
            continue
        session.add(RewardCode(reward_id=reward.id, encrypted_value=cipher.encrypt(value.encode("utf-8")).decode("utf-8"), code_fingerprint=fingerprint))
        created += 1
    if reward.stock_total is None:
        reward.stock_total = created
        reward.stock_remaining = created
    else:
        reward.stock_total += created
        reward.stock_remaining = (reward.stock_remaining or 0) + created
    return created


def serialize_member(member: Member) -> dict:
    return {
        "id": str(member.id), "phone": member.phone, "fullName": member.full_name, "city": member.city,
        "contentTypes": member.content_types, "skills": member.skills, "creditLabel": member.credit_label,
        "platformHandles": member.platform_handles, "score": member.score, "profileComplete": bool(member.agreement_accepted_at),
        "rulesVersion": member.rules_version,
        "marketingSmsAllowed": member.marketing_sms_allowed, "createdAt": member.created_at.isoformat(),
    }


def serialize_message(message: ConversationMessage) -> dict:
    return {
        "id": str(message.id), "conversationId": str(message.conversation_id), "sender": message.sender_kind.value,
        "text": message.text, "attachmentIds": message.attachment_ids, "sentAt": message.sent_at.isoformat(),
        "attachmentCaptions": message.attachment_captions,
        "readAt": message.read_at.isoformat() if message.read_at else None, "aiGenerated": message.ai_generated,
    }


def serialize_reward(reward: Reward) -> dict:
    public_origin = settings().public_origin.rstrip("/")
    return {
        "id": str(reward.id), "partnerId": str(reward.partner_id) if reward.partner_id else None, "partner": {
            "name": reward.partner.name, "description": reward.partner.short_description, "address": reward.partner.address,
            "phone": reward.partner.phone, "websiteUrl": reward.partner.website_url,
            "logoAttachmentId": str(reward.partner.logo_attachment_id) if reward.partner.logo_attachment_id else None,
            "logoUrl": f"{public_origin}/api/public-media/{reward.partner.logo_attachment_id}" if reward.partner.logo_attachment_id else None,
        } if reward.partner else None,
        "title": reward.title, "description": reward.description, "kind": reward.kind.value,
        "imageAttachmentId": str(reward.image_attachment_id) if reward.image_attachment_id else None,
        "imageUrl": f"{public_origin}/api/public-media/{reward.image_attachment_id}" if reward.image_attachment_id else None,
        "fulfillmentMode": reward.fulfillment_mode.value, "pointsCost": reward.points_cost,
        "stockRemaining": reward.stock_remaining, "codeExpiresAfterDays": reward.code_expires_after_days,
        "activeUntil": reward.active_until.isoformat() if reward.active_until else None,
    }
