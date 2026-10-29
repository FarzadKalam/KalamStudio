from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-only configuration for the Kalam Club service."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(alias="CLUB_DATABASE_URL")
    session_secret: str = Field(alias="CLUB_SESSION_SECRET", min_length=32)
    internal_signing_secret: str = Field(alias="CLUB_INTERNAL_SIGNING_SECRET", min_length=32)
    field_encryption_key: str = Field(alias="CLUB_FIELD_ENCRYPTION_KEY", min_length=32)

    public_origin: str = Field("https://club.kalametaze.ir", alias="CLUB_PUBLIC_ORIGIN")
    cors_origins: str = Field("https://club.kalametaze.ir", alias="CLUB_CORS_ORIGINS")
    max_upload_bytes: int = Field(300 * 1024 * 1024, alias="CLUB_MAX_UPLOAD_BYTES", ge=1)
    # Brand assets are intentionally kept small. Member uploads retain their
    # separate 300 MB multipart limit; this protects the Studio→Club JSON
    # gateway from oversized base64 request bodies.
    max_admin_image_bytes: int = Field(4 * 1024 * 1024, alias="CLUB_MAX_ADMIN_IMAGE_BYTES", ge=1)
    otp_ttl_seconds: int = Field(300, alias="CLUB_OTP_TTL_SECONDS", ge=60, le=900)
    otp_resend_seconds: int = Field(90, alias="CLUB_OTP_RESEND_SECONDS", ge=30, le=600)
    otp_max_attempts: int = Field(5, alias="CLUB_OTP_MAX_ATTEMPTS", ge=3, le=10)

    melipayamak_username: str = Field("", alias="MELIPAYAMAK_USERNAME")
    melipayamak_password: str = Field("", alias="MELIPAYAMAK_PASSWORD")
    melipayamak_api_key: str = Field("", alias="MELIPAYAMAK_API_KEY")
    melipayamak_sender_number: str = Field("", alias="MELIPAYAMAK_SENDER_NUMBER")
    # One approved service-pattern is shared by Club and Studio login codes.
    # Its first placeholder receives the six digit verification code.
    melipayamak_pattern_id: int = Field(461155, alias="MELIPAYAMAK_PATTERN_ID", ge=1)
    melipayamak_pattern_url: str = Field(
        "https://api.payamak-panel.com/post/Send.asmx/SendByBaseNumber2", alias="MELIPAYAMAK_PATTERN_URL"
    )
    melipayamak_sms_url: str = Field(
        "https://api.payamak-panel.com/post/send.asmx/SendSimpleSMS2", alias="MELIPAYAMAK_SMS_URL"
    )

    s3_endpoint: str = Field("", alias="S3_ENDPOINT")
    s3_bucket: str = Field("", alias="S3_BUCKET")
    s3_access_key_id: str = Field("", alias="S3_ACCESS_KEY_ID")
    s3_secret_access_key: str = Field("", alias="S3_SECRET_ACCESS_KEY")
    s3_region: str = Field("", alias="S3_REGION")
    s3_force_path_style: bool = Field(True, alias="S3_FORCE_PATH_STYLE")
    s3_prefix: str = Field("kalam-club/v1", alias="CLUB_S3_PREFIX")
    upload_transport: str = Field("proxy", alias="CLUB_UPLOAD_TRANSPORT")

    clamav_enabled: bool = Field(True, alias="CLUB_CLAMAV_ENABLED")
    clamav_host: str = Field("clamav", alias="CLAMAV_HOST")
    clamav_port: int = Field(3310, alias="CLAMAV_PORT", ge=1, le=65535)
    clamav_timeout_seconds: int = Field(180, alias="CLAMAV_TIMEOUT_SECONDS", ge=20, le=900)

    @field_validator("cors_origins")
    @classmethod
    def normalize_origins(cls, value: str) -> str:
        return ",".join(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())

    @property
    def allowed_origins(self) -> list[str]:
        return self.cors_origins.split(",")

    @property
    def s3_enabled(self) -> bool:
        return all((self.s3_endpoint, self.s3_bucket, self.s3_access_key_id, self.s3_secret_access_key))


@lru_cache
def settings() -> Settings:
    return Settings()
