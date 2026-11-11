"""Meeting rules.

Everything that reads or changes meetings lives here, so the REST routes and
the WebSocket handler stay thin and apply exactly the same rules.
"""

import hashlib
import secrets

from sqlalchemy import case, or_, select
from sqlalchemy.orm import Session

from app.clock import utcnow
from app.errors import (
    InvalidSession,
    MeetingAlreadyStarted,
    MeetingEnded,
    MeetingNotFound,
    NotMeetingHost,
    RemovedFromMeeting,
)
from app.models import Meeting, MeetingStatus, Participant, ParticipantRole, User
from app.schemas import ScheduleMeetingIn, UpdateMeetingIn

CODE_DIGITS = 10
RECENT_LIMIT = 10


# ---- helpers --------------------------------------------------------------


def _generate_code(db: Session) -> str:
    """A random Meeting ID: ten digits, never starting with zero, not in use.

    The loop only avoids the (tiny) chance of a clash up front; the UNIQUE
    constraint on meetings.code is what actually guarantees uniqueness.
    """
    lowest = 10 ** (CODE_DIGITS - 1)
    while True:
        code = str(lowest + secrets.randbelow(9 * lowest))
        if db.scalar(select(Meeting.id).where(Meeting.code == code)) is None:
            return code


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _require_host(meeting: Meeting, user: User) -> None:
    if meeting.host_id != user.id:
        raise NotMeetingHost()


def _require_not_started(meeting: Meeting) -> None:
    if meeting.status != MeetingStatus.SCHEDULED:
        raise MeetingAlreadyStarted()


# ---- reading --------------------------------------------------------------


def get_meeting(db: Session, code: str) -> Meeting:
    meeting = db.scalar(select(Meeting).where(Meeting.code == code))
    if meeting is None:
        raise MeetingNotFound()
    return meeting


def list_upcoming(db: Session, user: User) -> list[Meeting]:
    """Meetings the user hosts that are not over: live ones first, then by start time."""
    live_first = case((Meeting.status == MeetingStatus.LIVE, 0), else_=1)
    query = (
        select(Meeting)
        .where(
            Meeting.host_id == user.id,
            Meeting.status.in_([MeetingStatus.SCHEDULED, MeetingStatus.LIVE]),
        )
        .order_by(live_first, Meeting.scheduled_start, Meeting.created_at)
    )
    return list(db.scalars(query))


def list_recent(db: Session, user: User, limit: int = RECENT_LIMIT) -> list[Meeting]:
    """Finished meetings the user hosted or attended, newest first."""
    attended = select(Participant.meeting_id).where(Participant.user_id == user.id)
    query = (
        select(Meeting)
        .where(
            Meeting.status == MeetingStatus.ENDED,
            or_(Meeting.host_id == user.id, Meeting.id.in_(attended)),
        )
        .order_by(Meeting.ended_at.desc())
        .limit(limit)
    )
    return list(db.scalars(query))


# ---- creating and editing -------------------------------------------------


def create_instant_meeting(db: Session, host: User, title: str | None = None) -> Meeting:
    """An instant meeting has no schedule and is live from the moment it exists."""
    meeting = Meeting(
        code=_generate_code(db),
        title=title or f"{host.name}’s meeting",
        host=host,
        status=MeetingStatus.LIVE,
        started_at=utcnow(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def schedule_meeting(db: Session, host: User, data: ScheduleMeetingIn) -> Meeting:
    meeting = Meeting(
        code=_generate_code(db),
        title=data.title,
        description=data.description or None,
        host=host,
        scheduled_start=data.scheduled_start,
        duration_minutes=data.duration_minutes,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def update_meeting(db: Session, meeting: Meeting, user: User, data: UpdateMeetingIn) -> Meeting:
    _require_host(meeting, user)
    _require_not_started(meeting)

    changes = data.model_dump(exclude_unset=True)
    if "description" in changes:
        meeting.description = changes.pop("description") or None
    for field, value in changes.items():
        if value is not None:  # the remaining fields are required columns
            setattr(meeting, field, value)

    db.commit()
    db.refresh(meeting)
    return meeting


def delete_meeting(db: Session, meeting: Meeting, user: User) -> None:
    _require_host(meeting, user)
    _require_not_started(meeting)
    db.delete(meeting)
    db.commit()


# ---- entering a meeting ---------------------------------------------------


def start_meeting(db: Session, meeting: Meeting, user: User) -> tuple[Participant, str]:
    """The host enters their own meeting and gets host controls."""
    _require_host(meeting, user)
    return _admit(db, meeting, user=user, display_name=user.name, role=ParticipantRole.HOST)


def join_meeting(
    db: Session, meeting: Meeting, user: User | None, display_name: str
) -> tuple[Participant, str]:
    """Anyone with the Meeting ID or link enters as a regular participant."""
    return _admit(
        db, meeting, user=user, display_name=display_name, role=ParticipantRole.PARTICIPANT
    )


def _admit(
    db: Session,
    meeting: Meeting,
    *,
    user: User | None,
    display_name: str,
    role: ParticipantRole,
) -> tuple[Participant, str]:
    """Record a new participant and return it with its one-time secret."""
    if meeting.status == MeetingStatus.ENDED:
        raise MeetingEnded()

    now = utcnow()
    if meeting.status == MeetingStatus.SCHEDULED:
        # The first person through the door starts the meeting.
        meeting.status = MeetingStatus.LIVE
        meeting.started_at = now

    token = secrets.token_urlsafe(32)
    participant = Participant(
        meeting=meeting,
        user=user,
        display_name=display_name,
        role=role,
        token_hash=_hash_token(token),
        joined_at=now,
    )
    db.add(participant)
    db.commit()
    db.refresh(meeting)  # picks up the new participant_count
    return participant, token


# ---- live presence (used by the WebSocket handler) ------------------------


def authenticate_participant(db: Session, code: str, token: str) -> Participant:
    """Match a WebSocket connection to the participant row created on join."""
    meeting = get_meeting(db, code)
    if meeting.status == MeetingStatus.ENDED:
        raise MeetingEnded()

    participant = db.scalar(
        select(Participant).where(
            Participant.meeting_id == meeting.id,
            Participant.token_hash == _hash_token(token),
        )
    )
    if participant is None:
        raise InvalidSession()
    if participant.removed:
        raise RemovedFromMeeting()
    return participant


def mark_connected(db: Session, participant: Participant) -> None:
    """Called when the socket opens; also covers reconnecting after a refresh."""
    participant.left_at = None
    db.commit()


def mark_left(db: Session, participant_id: int, *, removed: bool = False) -> None:
    participant = db.get(Participant, participant_id)
    if participant is None:
        return
    participant.left_at = utcnow()
    participant.removed = participant.removed or removed
    db.commit()


# ---- ending ---------------------------------------------------------------


def _close_out(meeting: Meeting) -> None:
    now = utcnow()
    for participant in meeting.participants:
        if participant.left_at is None:
            participant.left_at = now
    meeting.status = MeetingStatus.ENDED
    # The meeting is over when the last person left, not when we noticed.
    meeting.ended_at = max((p.left_at for p in meeting.participants), default=now)


def end_meeting(db: Session, code: str) -> None:
    """End a live meeting. Safe to call for a meeting that is already over."""
    meeting = db.scalar(select(Meeting).where(Meeting.code == code))
    if meeting is None or meeting.status != MeetingStatus.LIVE:
        return
    _close_out(meeting)
    db.commit()


def end_stale_live_meetings(db: Session) -> int:
    """Run at startup. Connections live in memory, so after a restart nobody
    can still be inside a meeting the database says is live."""
    stale = db.scalars(select(Meeting).where(Meeting.status == MeetingStatus.LIVE)).all()
    for meeting in stale:
        _close_out(meeting)
    db.commit()
    return len(stale)
