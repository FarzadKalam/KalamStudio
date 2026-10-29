from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_values(enum_type):
    return [member.value for member in enum_type]


class MemberStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class ConversationStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class SenderKind(str, Enum):
    MEMBER = "member"
    ADMIN = "admin"
    SYSTEM = "system"


class ContentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RewardKind(str, Enum):
    CASH = "cash"
    MOBILE_CREDIT = "mobile_credit"
    INTERNET_PACKAGE = "internet_package"
    DISCOUNT_CODE = "discount_code"
    PARTNER_BENEFIT = "partner_benefit"


class FulfillmentMode(str, Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"


class ClaimStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PROCESSING = "processing"
    DELIVERED = "delivered"
    REDEEMED = "redeemed"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class UploadStatus(str, Enum):
    INITIATED = "initiated"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    QUARANTINED = "quarantined"
    AVAILABLE = "available"
    FAILED = "failed"
    ABORTED = "aborted"


class NotificationChannel(str, Enum):
    SMS = "sms"
    IN_APP = "in_app"


class NotificationStatus(str, Enum):
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Member(Timestamped, Base):
    __tablename__ = "club_members"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    content_types: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    credit_label: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    platform_handles: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)
    rules_version: Mapped[str] = mapped_column(String(32), default="", server_default="", nullable=False)
    rules_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    agreement_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    marketing_sms_allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[MemberStatus] = mapped_column(SAEnum(MemberStatus, name="club_member_status", values_callable=enum_values), default=MemberStatus.ACTIVE, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversations: Mapped[list[Conversation]] = relationship(back_populates="member")
    submissions: Mapped[list[ContentSubmission]] = relationship(back_populates="member")
    reward_claims: Mapped[list[RewardClaim]] = relationship(back_populates="member")


class OtpChallenge(Base):
    __tablename__ = "club_otp_challenges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), default="login", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_message_id: Mapped[str | None] = mapped_column(String(160))


class MemberSession(Base):
    __tablename__ = "club_member_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_members.id", ondelete="CASCADE"), index=True, nullable=False)
    token_id: Mapped[str] = mapped_column(String(72), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class ClubAdmin(Timestamped, Base):
    """Studio identities and their multiple Club roles.

    The gateway is the identity authority; this service stores only the stable
    external id and Club-local role assignments/audit information.
    """

    __tablename__ = "club_admins"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    roles: Mapped[list[str]] = mapped_column(JSON, default=lambda: ["club_admin"], nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Conversation(Timestamped, Base):
    __tablename__ = "club_conversations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_members.id", ondelete="CASCADE"), index=True, nullable=False)
    status: Mapped[ConversationStatus] = mapped_column(SAEnum(ConversationStatus, name="club_conversation_status", values_callable=enum_values), default=ConversationStatus.OPEN, nullable=False)
    assigned_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_admins.id", ondelete="SET NULL"), index=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True, nullable=False)
    member_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    admin_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    member: Mapped[Member] = relationship(back_populates="conversations")
    messages: Mapped[list[ConversationMessage]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class ClubAttachment(Timestamped, Base):
    __tablename__ = "club_attachments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_members.id", ondelete="SET NULL"), index=True)
    owner_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_admins.id", ondelete="SET NULL"), index=True)
    storage_key: Mapped[str] = mapped_column(String(720), unique=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(300), nullable=False)
    content_type: Mapped[str] = mapped_column(String(160), nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[UploadStatus] = mapped_column(SAEnum(UploadStatus, name="club_upload_status", values_callable=enum_values), default=UploadStatus.QUARANTINED, nullable=False)
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConversationMessage(Base):
    __tablename__ = "club_conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_conversations.id", ondelete="CASCADE"), index=True, nullable=False)
    sender_kind: Mapped[SenderKind] = mapped_column(SAEnum(SenderKind, name="club_sender_kind", values_callable=enum_values), nullable=False)
    sender_member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_members.id", ondelete="SET NULL"), index=True)
    sender_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_admins.id", ondelete="SET NULL"), index=True)
    text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    attachment_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    attachment_captions: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}", nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True, nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    automated_rule_id: Mapped[str | None] = mapped_column(String(96))
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class ClubReplyRule(Timestamped, Base):
    """A deterministic, human-authored chat rule.

    AI suggestions are deliberately not stored here: a rule may answer only
    with text that an administrator has explicitly written and enabled.
    """

    __tablename__ = "club_reply_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    match_mode: Mapped[str] = mapped_column(String(20), default="contains", nullable=False)
    match_text: Mapped[str] = mapped_column(String(500), nullable=False)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)


class ContentSubmission(Timestamped, Base):
    __tablename__ = "club_content_submissions"

    content_category: Mapped[str] = mapped_column(String(32), default="other", server_default="other", nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_story_campaigns.id", ondelete="SET NULL"), index=True)
    campaign_details: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}", nullable=False)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_members.id", ondelete="SET NULL"), index=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    classified_details: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}", nullable=False)
    status: Mapped[ContentStatus] = mapped_column(SAEnum(ContentStatus, name="club_content_status", values_callable=enum_values), default=ContentStatus.PENDING, index=True, nullable=False)
    credit_label: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    admin_note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    rejection_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    awarded_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reviewed_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_admins.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    member: Mapped[Member | None] = relationship(back_populates="submissions")
    reviewer: Mapped[ClubAdmin | None] = relationship(foreign_keys=[reviewed_by_admin_id])
    items: Mapped[list[ContentSubmissionItem]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class ContentSubmissionItem(Base):
    __tablename__ = "club_content_submission_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_content_submissions.id", ondelete="CASCADE"), index=True, nullable=False)
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_attachments.id", ondelete="SET NULL"))
    text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    caption: Mapped[str] = mapped_column(Text, default="", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    submission: Mapped[ContentSubmission] = relationship(back_populates="items")


class RewardPartner(Timestamped, Base):
    __tablename__ = "club_reward_partners"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    logo_attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_attachments.id", ondelete="SET NULL"))
    short_description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    address: Mapped[str] = mapped_column(Text, default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    website_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    rewards: Mapped[list[Reward]] = relationship(back_populates="partner")


class Reward(Timestamped, Base):
    __tablename__ = "club_rewards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_reward_partners.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_attachments.id", ondelete="SET NULL"))
    kind: Mapped[RewardKind] = mapped_column(SAEnum(RewardKind, name="club_reward_kind", values_callable=enum_values), nullable=False)
    fulfillment_mode: Mapped[FulfillmentMode] = mapped_column(SAEnum(FulfillmentMode, name="club_fulfillment_mode", values_callable=enum_values), default=FulfillmentMode.MANUAL, nullable=False)
    points_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_total: Mapped[int | None] = mapped_column(Integer)
    stock_remaining: Mapped[int | None] = mapped_column(Integer)
    code_expires_after_days: Mapped[int | None] = mapped_column(Integer)
    active_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    partner: Mapped[RewardPartner | None] = relationship(back_populates="rewards")
    codes: Mapped[list[RewardCode]] = relationship(back_populates="reward", cascade="all, delete-orphan")
    claims: Mapped[list[RewardClaim]] = relationship(back_populates="reward")


class RewardCode(Timestamped, Base):
    __tablename__ = "club_reward_codes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    reward_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_rewards.id", ondelete="CASCADE"), index=True, nullable=False)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    code_fingerprint: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    assigned_claim_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_reward_claims.id", ondelete="SET NULL"), unique=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    reward: Mapped[Reward] = relationship(back_populates="codes")


class RewardClaim(Timestamped, Base):
    __tablename__ = "club_reward_claims"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_members.id", ondelete="CASCADE"), index=True, nullable=False)
    reward_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_rewards.id", ondelete="RESTRICT"), index=True, nullable=False)
    status: Mapped[ClaimStatus] = mapped_column(SAEnum(ClaimStatus, name="club_claim_status", values_callable=enum_values), default=ClaimStatus.PENDING, index=True, nullable=False)
    points_debited: Mapped[int] = mapped_column(Integer, nullable=False)
    fulfilled_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_admins.id", ondelete="SET NULL"))
    fulfillment_note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    code_revealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    member: Mapped[Member] = relationship(back_populates="reward_claims")
    reward: Mapped[Reward] = relationship(back_populates="claims")


class UploadSession(Timestamped, Base):
    __tablename__ = "club_upload_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_members.id", ondelete="CASCADE"), index=True)
    owner_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_admins.id", ondelete="CASCADE"), index=True)
    public_authorization_id: Mapped[str | None] = mapped_column(String(96), index=True)
    storage_key: Mapped[str] = mapped_column(String(720), unique=True, nullable=False)
    s3_upload_id: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(300), nullable=False)
    content_type: Mapped[str] = mapped_column(String(160), nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    part_size: Mapped[int] = mapped_column(Integer, nullable=False)
    parts: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[UploadStatus] = mapped_column(SAEnum(UploadStatus, name="club_upload_session_status", values_callable=enum_values), default=UploadStatus.INITIATED, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_attachments.id", ondelete="SET NULL"))


class NotificationTemplate(Timestamped, Base):
    __tablename__ = "club_notification_templates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_key: Mapped[str] = mapped_column(String(96), unique=True, nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel, name="club_notification_channel", values_callable=enum_values), default=NotificationChannel.SMS, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    transactional: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class NotificationOutbox(Timestamped, Base):
    __tablename__ = "club_notification_outbox"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_club_notification_idempotency"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_members.id", ondelete="SET NULL"), index=True)
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel, name="club_outbox_channel", values_callable=enum_values), nullable=False)
    event_key: Mapped[str] = mapped_column(String(96), nullable=False)
    recipient: Mapped[str] = mapped_column(String(64), nullable=False)
    template_body: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(SAEnum(NotificationStatus, name="club_notification_status", values_callable=enum_values), default=NotificationStatus.QUEUED, index=True, nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_message_id: Mapped[str | None] = mapped_column(String(160))
    provider_response: Mapped[str] = mapped_column(Text, default="", nullable=False)
    error_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(180), nullable=False)


class AuditLog(Base):
    __tablename__ = "club_audit_logs"
    __table_args__ = (Index("ix_club_audit_created_subject", "created_at", "subject_type", "subject_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(80), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(128), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class StoryCampaign(Timestamped, Base):
    __tablename__ = "club_story_campaigns"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    media: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class PointEntry(Base):
    __tablename__ = "club_point_entries"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("club_members.id", ondelete="CASCADE"), index=True, nullable=False)
    event_key: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    submission_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_content_submissions.id", ondelete="SET NULL"))
    claim_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("club_reward_claims.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
