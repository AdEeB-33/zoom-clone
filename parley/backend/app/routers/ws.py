"""The meeting WebSocket: presence, host controls and WebRTC signalling.

One socket per participant. The server never touches audio or video; it only
tells browsers who is in the room and relays the small "signal" messages two
browsers exchange to set up a direct (peer-to-peer) media connection.

Browser -> server                      Server -> browser
  media-state  {audio, video}            welcome             {self, participants}
  signal       {to, data}                participant-joined  {participant}
  mute-all                  (host)       participant-updated {participant}
  remove-participant {participantId}     participant-left    {participantId}
                            (host)       all-muted           {by}
  end-meeting               (host)       signal              {from, data}
                                         error               {message}
"""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.database import SessionLocal
from app.errors import AppError, CloseCode, NotMeetingHost
from app.models import ParticipantRole
from app.realtime.hub import Member, Room, hub
from app.services import meetings as meeting_service

router = APIRouter()

# asyncio keeps only weak references to tasks, so pending ones are held here.
_pending_tasks: set[asyncio.Task] = set()


@router.websocket("/ws/meetings/{code}")
async def meeting_socket(socket: WebSocket, code: str, token: str = "") -> None:
    # Accept first: a close code can only be delivered on an open socket.
    await socket.accept()
    try:
        with SessionLocal() as db:
            participant = meeting_service.authenticate_participant(db, code, token)
            meeting_service.mark_connected(db, participant)
            member = Member(
                id=participant.id,
                name=participant.display_name,
                role=participant.role,
                socket=socket,
            )
    except AppError as error:
        await socket.close(code=error.close_code, reason=str(error))
        return

    room = hub.room(code)
    try:
        await _enter(room, member)
        # The loop also stops once this member has been taken out of the room
        # (removed by the host, or the meeting ended) and its socket closed.
        while room.members.get(member.id) is member:
            message = _parse(await socket.receive_text())
            if message is not None:
                await _handle(room, member, message)
    except WebSocketDisconnect:
        pass
    finally:
        await _leave(room, member)


def _parse(raw: str) -> dict | None:
    try:
        message = json.loads(raw)
    except ValueError:
        return None
    return message if isinstance(message, dict) else None


# ---- joining and leaving --------------------------------------------------


async def _enter(room: Room, member: Member) -> None:
    earlier = room.members.get(member.id)
    others = [other.describe() for other in room.members.values() if other.id != member.id]
    # Take the seat before the first await, so the room never looks empty to
    # the grace-period timer while this member is still being welcomed.
    room.members[member.id] = member

    if earlier is not None:
        # The same participant opened the meeting in another tab: newest wins.
        # Telling the others it "left" makes them drop the old media connection.
        await room.broadcast(
            {"type": "participant-left", "participantId": member.id}, exclude=member.id
        )
        await _close(earlier, CloseCode.REPLACED, "Opened in another tab")

    await room.send(member, {"type": "welcome", "self": member.describe(), "participants": others})
    await room.broadcast(
        {"type": "participant-joined", "participant": member.describe()}, exclude=member.id
    )


async def _leave(room: Room, member: Member) -> None:
    """Runs whenever a socket closes, whatever the reason."""
    if room.members.get(member.id) is not member:
        return  # already taken out of the room (removed, replaced or meeting ended)

    del room.members[member.id]
    with SessionLocal() as db:
        meeting_service.mark_left(db, member.id)
    await room.broadcast({"type": "participant-left", "participantId": member.id})

    if not room.members:
        task = asyncio.create_task(_end_if_still_empty(room.code))
        _pending_tasks.add(task)
        task.add_done_callback(_pending_tasks.discard)


async def _close(member: Member, close_code: CloseCode, reason: str) -> None:
    try:
        await member.socket.close(code=close_code, reason=reason)
    except (WebSocketDisconnect, RuntimeError):
        pass  # already closed from the other side


async def _end_if_still_empty(code: str) -> None:
    """End a meeting once everyone has been gone for the grace period."""
    await asyncio.sleep(settings.empty_room_grace_seconds)
    if not hub.is_empty(code):
        return  # someone came back
    hub.discard(code)
    with SessionLocal() as db:
        meeting_service.end_meeting(db, code)


# ---- messages from the browser --------------------------------------------


async def _handle(room: Room, member: Member, message: dict) -> None:
    try:
        match message.get("type"):
            case "media-state":
                await _update_media(room, member, message)
            case "signal":
                await _relay_signal(room, member, message)
            case "mute-all":
                await _mute_all(room, member)
            case "remove-participant":
                await _remove_participant(room, member, message)
            case "end-meeting":
                await _end_meeting(room, member)
    except AppError as error:
        await room.send(member, {"type": "error", "message": str(error)})


async def _update_media(room: Room, member: Member, message: dict) -> None:
    member.audio = bool(message.get("audio"))
    member.video = bool(message.get("video"))
    await room.broadcast(
        {"type": "participant-updated", "participant": member.describe()}, exclude=member.id
    )


async def _relay_signal(room: Room, member: Member, message: dict) -> None:
    """Pass a WebRTC offer, answer or ICE candidate to one other participant."""
    target = _find(room, message.get("to"))
    if target is not None:
        await room.send(target, {"type": "signal", "from": member.id, "data": message.get("data")})


def _find(room: Room, member_id: object) -> Member | None:
    return room.members.get(member_id) if isinstance(member_id, int) else None


def _require_host(member: Member) -> None:
    if member.role != ParticipantRole.HOST:
        raise NotMeetingHost()


async def _mute_all(room: Room, host: Member) -> None:
    _require_host(host)
    for other in room.members.values():
        if other.id != host.id:
            other.audio = False
    # Each browser switches its own microphone off when it receives this.
    await room.broadcast({"type": "all-muted", "by": host.id})


async def _remove_participant(room: Room, host: Member, message: dict) -> None:
    _require_host(host)
    target = _find(room, message.get("participantId"))
    if target is None or target.id == host.id:
        return
    del room.members[target.id]
    with SessionLocal() as db:
        meeting_service.mark_left(db, target.id, removed=True)
    await room.broadcast({"type": "participant-left", "participantId": target.id})
    await _close(target, CloseCode.REMOVED, "Removed by the host")


async def _end_meeting(room: Room, host: Member) -> None:
    _require_host(host)
    with SessionLocal() as db:
        meeting_service.end_meeting(db, room.code)

    members = list(room.members.values())
    room.members.clear()
    hub.discard(room.code)
    for member in members:
        await _close(member, CloseCode.MEETING_ENDED, "The host ended the meeting")
