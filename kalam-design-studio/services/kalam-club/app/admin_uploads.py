"""Signed Studio transport over the same multipart storage and AV pipeline."""
import uuid
from base64 import b64decode
from types import SimpleNamespace
from fastapi import Request, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .database import get_session
from .schemas import UploadInitiate, UploadComplete
from .security import require_admin, AdminPrincipal


class PartBody(BaseModel):
    data_base64: str = Field(min_length=4, max_length=12_000_000)


def install_admin_uploads(app, current_admin, initiate, upload_part, complete):
    async def owner(request, session):
        admin = await current_admin(request, session)
        require_admin(AdminPrincipal(admin.external_id, admin.display_name, tuple(admin.roles)), "support")
        return SimpleNamespace(id=admin.id, is_admin=True)

    @app.post("/api/admin/uploads/initiate", status_code=201)
    async def begin(payload: UploadInitiate, request: Request, session: Session = Depends(get_session)):
        admin = await owner(request, session)
        return initiate(payload, admin, session)

    @app.post("/api/admin/uploads/{upload_id}/parts/{number}")
    async def part(upload_id: uuid.UUID, number: int, payload: PartBody, request: Request, session: Session = Depends(get_session)):
        admin = await owner(request, session)
        try:
            data = b64decode(payload.data_base64, validate=True)
        except ValueError:
            raise HTTPException(422, "داده فایل معتبر نیست.")
        class Body:
            async def body(self):
                return data
        return await upload_part(upload_id, number, Body(), admin, session)

    @app.post("/api/admin/uploads/{upload_id}/complete", status_code=201)
    async def finish(upload_id: uuid.UUID, payload: UploadComplete, request: Request, session: Session = Depends(get_session)):
        admin = await owner(request, session)
        return complete(upload_id, payload, admin, session)
