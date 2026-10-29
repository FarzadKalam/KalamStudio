from __future__ import annotations

import asyncio
import logging

from .database import SessionLocal
from .notifications import schedule_discount_code_reminders, seed_templates, send_due_notifications
from .scanner import scan_pending_attachments


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


async def run() -> None:
    # API owns schema bootstrap. Running DDL concurrently in both containers
    # races PostgreSQL enum creation on a clean installation.
    while True:
        session = SessionLocal()
        try:
            seed_templates(session)
            scans = scan_pending_attachments(session)
            reminders = schedule_discount_code_reminders(session)
            sent = await send_due_notifications(session)
            if scans or reminders or sent:
                logging.info("Club worker: %s scans, %s reminders, %s delivered notifications", scans, reminders, sent)
        except Exception:
            logging.exception("Club notification worker cycle failed")
            session.rollback()
        finally:
            session.close()
        await asyncio.sleep(20)


if __name__ == "__main__":
    asyncio.run(run())
