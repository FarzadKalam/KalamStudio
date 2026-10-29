from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """Best-effort in-process realtime fan-out with HTTP polling as fallback.

    The API remains the source of truth; losing a socket never loses a message.
    Redis fan-out can replace this implementation when the service scales beyond
    one API process without changing endpoint contracts.
    """

    def __init__(self) -> None:
        self._member_sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._admin_sockets: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect_member(self, member_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._member_sockets[member_id].add(websocket)

    async def connect_admin(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._admin_sockets.add(websocket)

    async def disconnect_member(self, member_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._member_sockets[member_id].discard(websocket)
            if not self._member_sockets[member_id]:
                self._member_sockets.pop(member_id, None)

    async def disconnect_admin(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._admin_sockets.discard(websocket)

    async def _send_many(self, sockets: list[WebSocket], payload: dict) -> None:
        failed: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                failed.append(socket)
        if failed:
            async with self._lock:
                for socket in failed:
                    self._admin_sockets.discard(socket)
                    for member_sockets in self._member_sockets.values():
                        member_sockets.discard(socket)

    async def publish_member(self, member_id: str, payload: dict) -> None:
        async with self._lock:
            sockets = list(self._member_sockets.get(member_id, set()))
        await self._send_many(sockets, payload)

    async def publish_admins(self, payload: dict) -> None:
        async with self._lock:
            sockets = list(self._admin_sockets)
        await self._send_many(sockets, payload)


realtime = ConnectionManager()
