from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class OtpRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=32)


class OtpVerify(BaseModel):
    phone: str
    code: str = Field(pattern=r"^\d{6}$")


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    city: str = Field(min_length=2, max_length=120)
    content_types: list[str] = Field(default_factory=list, max_length=20)
    skills: list[str] = Field(default_factory=list, max_length=30)
    credit_label: str = Field(default="", max_length=160)
    platform_handles: dict[str, str] = Field(default_factory=dict)
    agreement_accepted: bool
    marketing_sms_allowed: bool = False

    @field_validator("platform_handles")
    @classmethod
    def permitted_platforms(cls, value: dict[str, str]) -> dict[str, str]:
        allowed = {"instagram", "telegram", "eitaa", "rubika", "bale"}
        return {key: str(handle).strip().lstrip("@")[0:128] for key, handle in value.items() if key in allowed and str(handle).strip()}


class UploadInitiate(BaseModel):
    filename: str = Field(min_length=1, max_length=300)
    bytes: int = Field(gt=0)
    content_type: str = Field(default="application/octet-stream", max_length=160)


class UploadPartsRequest(BaseModel):
    part_numbers: list[int] = Field(min_length=1, max_length=50)

    @field_validator("part_numbers")
    @classmethod
    def unique_parts(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value) or any(part < 1 for part in value):
            raise ValueError("شمارهٔ بخش‌های آپلود معتبر نیست.")
        return value


class UploadCompletePart(BaseModel):
    part_number: int = Field(ge=1)
    etag: str = Field(min_length=1, max_length=300)


class UploadComplete(BaseModel):
    parts: list[UploadCompletePart] = Field(min_length=1, max_length=100)
    sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")


class ChatMessageCreate(BaseModel):
    attachment_captions: dict[str, str] = Field(default_factory=dict, max_length=12)
    attachment_ids: list[UUID] = Field(default_factory=list, max_length=12)
    text: str = Field(default="", max_length=8000)

    @model_validator(mode="after")
    def require_text_or_attachment(self):
        if not self.text.strip() and not self.attachment_ids:
            raise ValueError("پیام یا فایل لازم است.")
        self.text = self.text.strip()
        allowed = {str(i) for i in self.attachment_ids}
        self.attachment_captions = {k: v.strip()[:4000] for k, v in self.attachment_captions.items() if k in allowed}
        return self


class ContentItemCreate(BaseModel):
    attachment_id: UUID | None = None
    text: str = Field(default="", max_length=20000)
    caption: str = Field(default="", max_length=4000)


class RulesAcceptance(BaseModel):
    version: str = Field(max_length=32)


class ContentSubmissionCreate(BaseModel):
    content_category: str = Field(default="other", max_length=32)
    credit_label: str = Field(default="", max_length=160)
    items: list[ContentItemCreate] = Field(min_length=1, max_length=12)
    classified_type: str = Field(default="", max_length=32)
    classified_contact: str = Field(default="", max_length=1000)


class AnonymousContentSubmissionCreate(BaseModel):
    content_category: Literal["people"] = "people"
    items: list[ContentItemCreate] = Field(min_length=1, max_length=12)
    authorization_token: str = Field(min_length=20, max_length=500)


class AnonymousAuthorizationCreate(BaseModel):
    captcha_token: str = Field(min_length=20, max_length=500)
    captcha_answer: str = Field(min_length=1, max_length=12)
    website: str = Field(default="", max_length=200)


class AnonymousUploadInitiate(UploadInitiate):
    authorization_token: str = Field(min_length=20, max_length=500)


class AnonymousUploadPartsRequest(UploadPartsRequest):
    authorization_token: str = Field(min_length=20, max_length=500)


class AnonymousUploadComplete(UploadComplete):
    authorization_token: str = Field(min_length=20, max_length=500)


class RewardClaimCreate(BaseModel):
    reward_id: UUID


class AdminReplyCreate(ChatMessageCreate):
    ai_generated: bool = False


class AdminContentReview(BaseModel):
    status: Literal["approved", "rejected"]
    score: int = Field(default=0, ge=0, le=100000)
    note: str = Field(default="", max_length=4000)


class AdminClaimReview(BaseModel):
    status: Literal["approved", "processing", "delivered", "rejected", "redeemed"]
    note: str = Field(default="", max_length=4000)


class PartnerUpsert(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    short_description: str = Field(default="", max_length=3000)
    address: str = Field(default="", max_length=1000)
    phone: str = Field(default="", max_length=32)
    website_url: str = Field(default="", max_length=500)
    logo_attachment_id: UUID | None = None
    active: bool = True


class RewardUpsert(BaseModel):
    partner_id: UUID | None = None
    title: str = Field(min_length=2, max_length=220)
    description: str = Field(default="", max_length=4000)
    image_attachment_id: UUID | None = None
    kind: Literal["cash", "mobile_credit", "internet_package", "discount_code", "partner_benefit"]
    fulfillment_mode: Literal["manual", "automatic"] = "manual"
    points_cost: int = Field(ge=0, le=1000000)
    stock_total: int | None = Field(default=None, ge=0)
    code_expires_after_days: int | None = Field(default=None, ge=1, le=3650)
    active_from: datetime | None = None
    active_until: datetime | None = None
    active: bool = True


class RewardCodesImport(BaseModel):
    codes: list[str] = Field(min_length=1, max_length=10000)


class AdminRolesUpdate(BaseModel):
    display_name: str = Field(default="", max_length=160)
    roles: list[Literal["club_admin", "support", "content_moderator", "reward_manager"]] = Field(min_length=1, max_length=4)
    active: bool = True


class ReplyRuleUpsert(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    enabled: bool = True
    match_mode: Literal["contains", "exact", "starts_with"] = "contains"
    match_text: str = Field(min_length=1, max_length=500)
    response_text: str = Field(min_length=1, max_length=8000)
    priority: int = Field(default=100, ge=0, le=10000)


class NotificationTemplateUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    enabled: bool = True


class AdminMediaUpload(BaseModel):
    filename: str = Field(min_length=1, max_length=300)
    content_type: str = Field(min_length=1, max_length=160)
    data_base64: str = Field(min_length=8)
    purpose: Literal["partner_logo", "reward_image", "campaign_banner"]


class CampaignMedia(BaseModel):
    banner_id: UUID | None = None


class CampaignUpsert(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    active: bool = False
    media: dict[str, CampaignMedia]


class StorySubmissionCreate(BaseModel):
    media: Literal["golbahar", "chenaran", "kalam"]
    published_at: datetime
    attachment_id: UUID
