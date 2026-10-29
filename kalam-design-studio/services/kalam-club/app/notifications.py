from __future__ import annotations

from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .models import (
    ClaimStatus,
    Member,
    NotificationChannel,
    NotificationOutbox,
    NotificationStatus,
    NotificationTemplate,
    RewardClaim,
    RewardCode,
    utcnow,
)
from .sms import SmsDeliveryError, send_transactional_sms


DEFAULT_TEMPLATES: dict[str, tuple[str, bool]] = {
    "content_approved": ("محتوای شما در باشگاه کلام تازه تأیید شد و {score} امتیاز گرفت. {link}", True),
    "content_rejected": ("محتوای ارسالی شما نیاز به اصلاح دارد. دلیل را در باشگاه کلام تازه ببینید: {link}", True),
    "reward_requested": ("درخواست جایزهٔ «{reward_title}» ثبت شد. وضعیت را در باشگاه ببینید: {link}", True),
    "reward_approved": ("درخواست جایزهٔ «{reward_title}» تأیید شد. {link}", True),
    "reward_rejected": ("درخواست جایزهٔ «{reward_title}» تأیید نشد و امتیاز شما برگشت. {link}", True),
    "reward_delivered": ("جایزهٔ «{reward_title}» برای شما تحویل/فعال شد. {link}", True),
    "reward_redeemed": ("استفاده از جایزهٔ «{reward_title}» ثبت شد. {link}", True),
    "discount_expiring": ("کد تخفیف «{reward_title}» تا {days_left} روز دیگر منقضی می‌شود. {link}", True),
    "chat_new_admin_message": ("پاسخ جدیدی از کلام تازه دارید. {link}", True),
}


def seed_templates(session: Session) -> None:
    for event_key, (body, transactional) in DEFAULT_TEMPLATES.items():
        if not session.query(NotificationTemplate).filter_by(event_key=event_key, channel=NotificationChannel.SMS).one_or_none():
            session.add(
                NotificationTemplate(
                    event_key=event_key,
                    channel=NotificationChannel.SMS,
                    body=body,
                    enabled=True,
                    transactional=transactional,
                )
            )
    session.commit()


def render_template(template: str, variables: dict[str, str]) -> str:
    result = template
    for key, value in variables.items():
        result = result.replace("{" + key + "}", str(value or ""))
    return result.replace("  ", " ").strip()


def queue_sms(
    session: Session,
    member: Member,
    event_key: str,
    variables: dict[str, str],
    idempotency_key: str,
    delay_seconds: int = 0,
) -> NotificationOutbox | None:
    template = session.query(NotificationTemplate).filter_by(event_key=event_key, channel=NotificationChannel.SMS).one_or_none()
    if not template or not template.enabled:
        return None
    item = NotificationOutbox(
        member_id=member.id,
        channel=NotificationChannel.SMS,
        event_key=event_key,
        recipient=member.phone,
        template_body=template.body,
        variables=variables,
        scheduled_for=utcnow() + timedelta(seconds=max(0, delay_seconds)),
        idempotency_key=idempotency_key,
    )
    try:
        with session.begin_nested():
            session.add(item)
            session.flush()
    except IntegrityError:
        return session.query(NotificationOutbox).filter_by(idempotency_key=idempotency_key).one_or_none()
    return item


def schedule_discount_code_reminders(session: Session) -> int:
    """Queue each 7/3/1-day reminder once and expire stale delivered claims."""

    now = utcnow()
    scheduled = 0
    codes = (
        session.query(RewardCode)
        .filter(RewardCode.assigned_claim_id.is_not(None), RewardCode.expires_at.is_not(None), RewardCode.redeemed_at.is_(None))
        .all()
    )
    for code in codes:
        claim = session.get(RewardClaim, code.assigned_claim_id)
        if not claim:
            continue
        if code.expires_at <= now:
            if claim.status in {ClaimStatus.APPROVED, ClaimStatus.PROCESSING, ClaimStatus.DELIVERED}:
                claim.status = ClaimStatus.EXPIRED
            continue
        days_left = (code.expires_at.date() - now.date()).days
        if days_left not in {1, 3, 7}:
            continue
        item = queue_sms(
            session,
            claim.member,
            "discount_expiring",
            {"reward_title": claim.reward.title, "days_left": str(days_left), "link": settings().public_origin},
            f"discount-expiring:{code.id}:{days_left}",
        )
        if item:
            scheduled += 1
    if scheduled or any(code.expires_at <= now for code in codes):
        session.commit()
    return scheduled


async def send_due_notifications(session: Session, limit: int = 40) -> int:
    """Deliver queued transactional notices with durable state transitions."""

    items = (
        session.query(NotificationOutbox)
        .filter(
            NotificationOutbox.status == NotificationStatus.QUEUED,
            NotificationOutbox.scheduled_for <= utcnow(),
        )
        .order_by(NotificationOutbox.scheduled_for.asc())
        .limit(limit)
        .all()
    )
    delivered = 0
    for item in items:
        item.status = NotificationStatus.SENDING
        item.attempts += 1
        session.commit()
        try:
            receipt = await send_transactional_sms(item.recipient, render_template(item.template_body, item.variables))
            item.status = NotificationStatus.SENT
            item.sent_at = utcnow()
            item.provider_message_id = receipt.provider_message_id
            item.provider_response = receipt.raw
            item.error_message = ""
            delivered += 1
        except SmsDeliveryError as error:
            item.status = NotificationStatus.FAILED if item.attempts >= 3 else NotificationStatus.QUEUED
            item.error_message = str(error)
            if item.status == NotificationStatus.QUEUED:
                item.scheduled_for = utcnow() + timedelta(minutes=2 * item.attempts)
        except Exception:
            # Do not leak provider internals into member-facing surfaces.
            item.status = NotificationStatus.FAILED if item.attempts >= 3 else NotificationStatus.QUEUED
            item.error_message = "خطای غیرمنتظره هنگام ارسال اعلان"
            if item.status == NotificationStatus.QUEUED:
                item.scheduled_for = utcnow() + timedelta(minutes=2 * item.attempts)
        session.commit()
    return delivered
