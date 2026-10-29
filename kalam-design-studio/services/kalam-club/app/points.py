"""An idempotent points ledger. Awards are spendable only after collection."""
from sqlalchemy.orm import Session
from .models import Member, PointEntry, utcnow


def lock_member(session: Session, member_id):
    session.flush()
    return session.query(Member).filter_by(id=member_id).populate_existing().with_for_update().one()


def add_entry(session: Session, member_id, amount: int, key: str, title: str, submission_id=None, claim_id=None, pending=True):
    member = lock_member(session, member_id)
    existing = session.query(PointEntry).filter_by(event_key=key).one_or_none()
    if existing:
        return existing
    entry = PointEntry(member_id=member_id, amount=amount, event_key=key, title=title,
                       submission_id=submission_id, claim_id=claim_id,
                       received_at=None if pending else utcnow())
    if not pending:
        member.score += amount
    session.add(entry)
    session.flush()
    return entry


def collect_points(session: Session, member_id, entry_id):
    from fastapi import HTTPException
    member = lock_member(session, member_id)
    entry = session.query(PointEntry).filter_by(id=entry_id, member_id=member_id).with_for_update().one_or_none()
    if not entry:
        raise HTTPException(404, "این امتیاز پیدا نشد.")
    if entry.received_at is None:
        member.score += entry.amount
        entry.received_at = utcnow()
    session.flush()
    return member
