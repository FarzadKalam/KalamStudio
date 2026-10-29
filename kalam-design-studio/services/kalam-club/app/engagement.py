"""Member activity, point collection and administrator-managed story gifts."""
import uuid
from datetime import timezone, timedelta
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from .database import get_session
from .models import (Member, PointEntry, StoryCampaign, ClubAttachment, ContentSubmission,
                     ContentStatus, RewardClaim, AuditLog, UploadStatus, utcnow)
from .schemas import CampaignUpsert, StorySubmissionCreate
from .points import collect_points, lock_member
from .domain import serialize_member, create_submission, require_member_attachments, audit
from .security import AdminPrincipal, require_admin
from .storage import download_url
from .club_policy import RULES_VERSION

MEDIA = {
    "golbahar": {"label": "کلام تازه گلبهار", "handle": "golbahar.kalametaze"},
    "chenaran": {"label": "کلام تازه چناران", "handle": "chenaran.kalametaze"},
    "kalam": {"label": "کلام تازه (استانی و کشوری)", "handle": "kalametaze.ir"},
}
CLAIM_LABELS = {"pending": "در انتظار بررسی", "approved": "تأیید شد", "processing": "در حال آماده‌سازی",
                "delivered": "تحویل داده شد", "redeemed": "استفاده شد", "rejected": "رد شد",
                "expired": "منقضی شد", "cancelled": "لغو شد"}


def point_data(entry):
    return {"id": str(entry.id), "amount": entry.amount, "title": entry.title,
            "submissionId": str(entry.submission_id) if entry.submission_id else None,
            "createdAt": entry.created_at.isoformat(),
            "receivedAt": entry.received_at.isoformat() if entry.received_at else None}


def campaign_data(campaign, session):
    media = []
    for key, info in MEDIA.items():
        banner_id = campaign.media.get(key, {}).get("banner_id")
        attachment = session.get(ClubAttachment, uuid.UUID(banner_id)) if banner_id else None
        ready = bool(attachment and attachment.status == UploadStatus.AVAILABLE)
        media.append({"id": key, **info, "bannerId": banner_id, "ready": ready,
                      "bannerUrl": f"/api/public-media/{banner_id}" if ready else None})
    return {"id": str(campaign.id), "title": campaign.title, "active": campaign.active,
            "points": campaign.points, "media": media, "createdAt": campaign.created_at.isoformat()}


def install_engagement_routes(app, current_member, current_admin, serialize_submission):
    @app.get("/api/points/pending")
    def pending(member: Member = Depends(current_member), session: Session = Depends(get_session)):
        entries = session.query(PointEntry).filter_by(member_id=member.id, received_at=None).order_by(PointEntry.created_at).all()
        return {"points": [point_data(entry) for entry in entries]}

    @app.post("/api/points/{entry_id}/receive")
    def receive(entry_id: uuid.UUID, member: Member = Depends(current_member), session: Session = Depends(get_session)):
        member = collect_points(session, member.id, entry_id)
        session.commit()
        return {"member": serialize_member(member)}

    @app.get("/api/activity")
    def activity(member: Member = Depends(current_member), session: Session = Depends(get_session)):
        submissions = session.query(ContentSubmission).options(joinedload(ContentSubmission.items), joinedload(ContentSubmission.reviewer)).filter_by(member_id=member.id).all()
        events = []
        for item in submissions:
            data = serialize_submission(item)
            events.append({"id": f"sent:{item.id}", "kind": "content", "title": "استوری برای بررسی ارسال شد" if item.campaign_id else "محتوای شما دریافت شد", "createdAt": item.created_at.isoformat(), "submission": data})
            if item.reviewed_at:
                events.append({"id": f"review:{item.id}", "kind": "content", "title": "محتوای شما تأیید شد" if item.status == ContentStatus.APPROVED else "محتوای شما تأیید نشد", "createdAt": item.reviewed_at.isoformat(), "submission": data})
        for entry in session.query(PointEntry).filter_by(member_id=member.id).all():
            events.append({**point_data(entry), "id": f"point:{entry.id}", "kind": "points"})
        claims = session.query(RewardClaim).filter_by(member_id=member.id).all()
        claim_map = {str(c.id): c for c in claims}
        for claim in claims:
            events.append({"id": f"claim:{claim.id}", "kind": "reward", "title": f"درخواست جایزه: {claim.reward.title}", "createdAt": claim.created_at.isoformat(), "description": f"وضعیت فعلی: {CLAIM_LABELS.get(claim.status.value, 'در حال بررسی')}"})
        if claim_map:
            logs = session.query(AuditLog).filter(AuditLog.subject_type == "reward_claim", AuditLog.subject_id.in_(list(claim_map)), AuditLog.action == "reward.claim_reviewed").all()
            for log in logs:
                claim = claim_map[log.subject_id]
                events.append({"id": str(log.id), "kind": "reward", "title": f"{claim.reward.title}؛ {CLAIM_LABELS.get(log.details.get('status'), 'تغییر وضعیت')}", "createdAt": log.created_at.isoformat(), "description": log.details.get("note", claim.fulfillment_note)})
        events.sort(key=lambda e: e["createdAt"], reverse=True)
        return {"events": events, "submissions": [serialize_submission(s) for s in submissions]}

    @app.get("/api/story-campaigns")
    def campaigns(member: Member = Depends(current_member), session: Session = Depends(get_session)):
        rows = session.query(StoryCampaign).filter_by(active=True).order_by(StoryCampaign.created_at.desc()).all()
        results = []
        for row in rows:
            latest = session.query(ContentSubmission).filter_by(member_id=member.id, campaign_id=row.id).order_by(ContentSubmission.created_at.desc()).first()
            results.append({**campaign_data(row, session), "submissionStatus": latest.status.value if latest else None})
        return {"campaigns": results}

    @app.get("/api/story-campaigns/{campaign_id}/banner/{media_id}")
    def banner(campaign_id: uuid.UUID, media_id: str, member: Member = Depends(current_member), session: Session = Depends(get_session)):
        campaign = session.get(StoryCampaign, campaign_id)
        if not campaign or not campaign.active or media_id not in MEDIA:
            raise HTTPException(404, "این هدیه در دسترس نیست.")
        banner_id = campaign.media.get(media_id, {}).get("banner_id")
        attachment = session.get(ClubAttachment, uuid.UUID(banner_id)) if banner_id else None
        if not attachment or attachment.status != UploadStatus.AVAILABLE:
            raise HTTPException(409, "بنر این رسانه هنوز آماده نیست؛ کمی بعد دوباره تلاش کنید.")
        return {"url": download_url(attachment.storage_key)}

    @app.post("/api/story-campaigns/{campaign_id}/submissions", status_code=201)
    def submit_story(campaign_id: uuid.UUID, payload: StorySubmissionCreate, member: Member = Depends(current_member), session: Session = Depends(get_session)):
        campaign = session.query(StoryCampaign).filter_by(id=campaign_id).with_for_update().one_or_none()
        if not campaign or not campaign.active:
            raise HTTPException(409, "این هدیه اکنون فعال نیست.")
        member = lock_member(session, member.id)
        if not member.agreement_accepted_at or member.rules_version != RULES_VERSION:
            raise HTTPException(422, "ابتدا ثبت‌نام و پذیرش قوانین را تکمیل کنید.")
        duplicate = session.query(ContentSubmission).filter(ContentSubmission.member_id == member.id, ContentSubmission.campaign_id == campaign.id, ContentSubmission.status != ContentStatus.REJECTED).first()
        if duplicate:
            raise HTTPException(409, "اسکرین‌شات شما قبلاً ثبت شده است؛ نتیجه را در تاریخچه ببینید.")
        published = payload.published_at
        if published.tzinfo is None or published > utcnow() - timedelta(hours=20):
            raise HTTPException(422, "حداقل ۲۰ ساعت پس از انتشار استوری، اسکرین‌شات را ارسال کنید.")
        started = campaign.created_at.replace(tzinfo=timezone.utc) if campaign.created_at.tzinfo is None else campaign.created_at
        if published < started:
            raise HTTPException(422, "استوری باید پس از شروع این کمپین منتشر شده باشد.")
        media = campaign.media.get(payload.media, {})
        banner_id = media.get("banner_id")
        banner_image = session.get(ClubAttachment, uuid.UUID(banner_id)) if banner_id else None
        if not banner_image or banner_image.status != UploadStatus.AVAILABLE:
            raise HTTPException(409, "بنر این رسانه هنوز آماده نیست.")
        attachment = require_member_attachments(session, member, [payload.attachment_id])[0]
        if attachment.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(422, "اسکرین‌شات را با فرمت JPG، PNG یا WebP بفرستید.")
        info = MEDIA[payload.media]
        submission = create_submission(session, member, member.credit_label, [{"attachment_id": attachment.id, "caption": f"اسکرین‌شات استوری {info['label']}"}])
        submission.content_category = "story_gift"
        submission.campaign_id = campaign.id
        submission.campaign_details = {"title": campaign.title, "points": campaign.points, "media": payload.media, **info, "bannerId": banner_id, "publishedAt": published.isoformat()}
        session.commit()
        return {"submission": serialize_submission(submission)}

    async def manager(request, session):
        admin = await current_admin(request, session)
        require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "reward_manager")
        return admin

    @app.get("/api/admin/story-campaigns")
    async def admin_campaigns(request: Request, session: Session = Depends(get_session)):
        await manager(request, session)
        return {"campaigns": [campaign_data(c, session) for c in session.query(StoryCampaign).order_by(StoryCampaign.created_at.desc()).all()]}

    def save_campaign(session, campaign, payload, admin):
        if set(payload.media) != set(MEDIA):
            raise HTTPException(422, "بنر هر سه رسانه را مشخص کنید.")
        for media in payload.media.values():
            attachment = session.get(ClubAttachment, media.banner_id) if media.banner_id else None
            if media.banner_id and (not attachment or attachment.owner_member_id is not None or attachment.content_type not in {"image/jpeg", "image/png", "image/webp"} or attachment.status not in {UploadStatus.AVAILABLE, UploadStatus.QUARANTINED}):
                raise HTTPException(422, "بنر باید از تصاویر بارگذاری‌شده توسط مدیر انتخاب شود.")
            if payload.active and not attachment:
                raise HTTPException(422, "برای فعال کردن هدیه، بنر هر سه رسانه را بارگذاری کنید.")
        campaign.title = payload.title.strip()
        campaign.active = payload.active
        campaign.media = {key: {"banner_id": str(value.banner_id) if value.banner_id else None} for key, value in payload.media.items()}
        session.add(campaign); session.flush()
        audit(session, "admin", str(admin.id), "campaign.saved", "story_campaign", str(campaign.id), {"active": campaign.active})
        session.commit()
        return {"campaign": campaign_data(campaign, session)}

    @app.post("/api/admin/story-campaigns", status_code=201)
    async def new_campaign(payload: CampaignUpsert, request: Request, session: Session = Depends(get_session)):
        admin = await manager(request, session)
        return save_campaign(session, StoryCampaign(points=15), payload, admin)

    @app.put("/api/admin/story-campaigns/{campaign_id}")
    async def edit_campaign(campaign_id: uuid.UUID, payload: CampaignUpsert, request: Request, session: Session = Depends(get_session)):
        admin = await manager(request, session)
        campaign = session.query(StoryCampaign).filter_by(id=campaign_id).with_for_update().one_or_none()
        if not campaign:
            raise HTTPException(404, "کمپین پیدا نشد.")
        return save_campaign(session, campaign, payload, admin)

    @app.get("/api/admin/attachments/{attachment_id}/download")
    async def admin_attachment(attachment_id: uuid.UUID, request: Request, session: Session = Depends(get_session)):
        admin = await current_admin(request, session)
        require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "content_moderator")
        attachment = session.get(ClubAttachment, attachment_id)
        if not attachment or attachment.status != UploadStatus.AVAILABLE:
            raise HTTPException(409, "فایل هنوز آماده مشاهده نیست؛ ممکن است بررسی امنیتی آن در جریان باشد.")
        return {"url": download_url(attachment.storage_key), "filename": attachment.original_filename}

    @app.get("/api/admin/attachments/{attachment_id}")
    async def admin_attachment_info(attachment_id: uuid.UUID, request: Request, session: Session = Depends(get_session)):
        admin = await current_admin(request, session)
        if not set(admin.roles).intersection({"club_admin", "support", "content_moderator", "reward_manager"}):
            raise HTTPException(403, "دسترسی مشاهده فایل ندارید.")
        attachment = session.get(ClubAttachment, attachment_id)
        if not attachment:
            raise HTTPException(404, "فایل پیدا نشد.")
        return {"attachment": {"id": str(attachment.id), "filename": attachment.original_filename,
                "contentType": attachment.content_type, "bytes": attachment.bytes, "status": attachment.status.value,
                "url": download_url(attachment.storage_key) if attachment.status == UploadStatus.AVAILABLE else None}}
