from __future__ import annotations

import html
import re
from dataclasses import dataclass

import httpx

from .config import settings


class SmsDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class SmsReceipt:
    provider_message_id: str
    raw: str


def provider_phone(phone: str) -> str:
    return "0" + phone[3:] if phone.startswith("+98") else phone


def _soap_scalar(raw: str) -> str:
    """Read the actual terminal SOAP value, not an arbitrary XML node.

    MeliPayamak returns either a plain scalar or a small XML envelope.  The
    earlier broad expression could accidentally pick an unrelated first XML
    value and mark a sent OTP as failed (or vice versa).
    """

    text = (raw or "").strip()
    if not text:
        return ""
    values = re.findall(r"<[^/!][^>]*>\s*([^<>]+?)\s*</[^>]+>", text, flags=re.DOTALL)
    if values:
        return html.unescape(values[-1]).strip()
    numeric = re.search(r"(?<!\d)(-?\d+(?:\.\d+)?)(?!\d)", text)
    return (numeric.group(1) if numeric else text).strip()


def _successful(value: str) -> bool:
    normalized = (value or "").strip().lower()
    if not normalized:
        return False
    if normalized in {"0", "false", "null", "none"} or normalized.startswith("-"):
        return False
    # The pattern endpoint may return "1" for acceptance or a larger record ID.
    # Positive values 2..18 are provider error codes, not record IDs.
    if normalized.isdigit() and 2 <= int(normalized) <= 18:
        return False
    return True


async def send_otp(phone: str, code: str) -> SmsReceipt:
    """Send a login OTP through the single approved MeliPayamak pattern."""

    cfg = settings()
    if not cfg.melipayamak_username or not (cfg.melipayamak_password or cfg.melipayamak_api_key):
        raise SmsDeliveryError("تنظیمات ملی‌پیامک برای OTP کامل نیست.")
    recipient = provider_phone(phone)
    timeout = httpx.Timeout(8.0, connect=4.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                cfg.melipayamak_pattern_url,
                data={
                    "username": cfg.melipayamak_username,
                    "password": cfg.melipayamak_password or cfg.melipayamak_api_key,
                    "text": code,
                    "to": recipient,
                    "bodyId": str(cfg.melipayamak_pattern_id),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
            )
            raw = response.text
            receipt = _soap_scalar(raw)
            if not response.is_success or not _successful(receipt):
                raise SmsDeliveryError("ارسال کد تأیید ملی‌پیامک ناموفق بود.")
            return SmsReceipt(provider_message_id=receipt[:160], raw=raw[:2000])
    except httpx.HTTPError as error:
        raise SmsDeliveryError("ارتباط با ملی‌پیامک موقتاً ناموفق بود.") from error


async def send_transactional_sms(phone: str, text: str) -> SmsReceipt:
    cfg = settings()
    if not cfg.melipayamak_username or not (cfg.melipayamak_password or cfg.melipayamak_api_key):
        raise SmsDeliveryError("تنظیمات ملی‌پیامک کامل نیست.")
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=4.0)) as client:
        response = await client.post(
            cfg.melipayamak_sms_url,
            data={
                "UserName": cfg.melipayamak_username,
                "PassWord": cfg.melipayamak_password or cfg.melipayamak_api_key,
                "To": provider_phone(phone),
                "From": cfg.melipayamak_sender_number,
                "Text": text,
                "IsFlash": "false",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
        )
        raw = response.text
        receipt = _soap_scalar(raw)
        if not response.is_success or not _successful(receipt):
            raise SmsDeliveryError("ارسال پیامک ملی‌پیامک ناموفق بود.")
        return SmsReceipt(provider_message_id=receipt[:160], raw=raw[:2000])
