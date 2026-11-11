"""REST endpoints for meetings. Rules live in app/services/meetings.py; these
functions only translate between HTTP and those rules."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.deps import CurrentUser, DbSession
from app.models import Meeting, Participant
from app.schemas import (
    InstantMeetingIn,
    JoinMeetingIn,
    MeetingOut,
    MeetingSessionOut,
    ScheduleMeetingIn,
    UpdateMeetingIn,
)
from app.services import meetings as meeting_service

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _meeting_from_path(code: str, db: DbSession) -> Meeting:
    """Turns the {code} in the URL into a Meeting, or a 404."""
    return meeting_service.get_meeting(db, code)


MeetingFromPath = Annotated[Meeting, Depends(_meeting_from_path)]


def _session(meeting: Meeting, entered: tuple[Participant, str]) -> MeetingSessionOut:
    participant, token = entered
    return MeetingSessionOut(meeting=meeting, participant=participant, token=token)


# The fixed paths are declared before "/{code}" so they are matched first.


@router.get("/upcoming", response_model=list[MeetingOut])
def list_upcoming_meetings(db: DbSession, user: CurrentUser):
    return meeting_service.list_upcoming(db, user)


@router.get("/recent", response_model=list[MeetingOut])
def list_recent_meetings(db: DbSession, user: CurrentUser):
    return meeting_service.list_recent(db, user)


@router.post("/instant", response_model=MeetingSessionOut, status_code=status.HTTP_201_CREATED)
def create_instant_meeting(
    db: DbSession, user: CurrentUser, payload: InstantMeetingIn | None = None
):
    """Create a meeting and enter it as host in one request."""
    title = payload.title if payload else None
    meeting = meeting_service.create_instant_meeting(db, user, title)
    return _session(meeting, meeting_service.start_meeting(db, meeting, user))


@router.post("/scheduled", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def schedule_meeting(payload: ScheduleMeetingIn, db: DbSession, user: CurrentUser):
    return meeting_service.schedule_meeting(db, user, payload)


@router.get("/{code}", response_model=MeetingOut)
def read_meeting(meeting: MeetingFromPath):
    """Public lookup used by the join flow to confirm a meeting exists."""
    return meeting


@router.patch("/{code}", response_model=MeetingOut)
def update_meeting(
    payload: UpdateMeetingIn, meeting: MeetingFromPath, db: DbSession, user: CurrentUser
):
    return meeting_service.update_meeting(db, meeting, user, payload)


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting: MeetingFromPath, db: DbSession, user: CurrentUser):
    meeting_service.delete_meeting(db, meeting, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{code}/start", response_model=MeetingSessionOut)
def start_meeting(meeting: MeetingFromPath, db: DbSession, user: CurrentUser):
    """The host enters their meeting."""
    return _session(meeting, meeting_service.start_meeting(db, meeting, user))


@router.post("/{code}/join", response_model=MeetingSessionOut)
def join_meeting(
    payload: JoinMeetingIn, meeting: MeetingFromPath, db: DbSession, user: CurrentUser
):
    """Enter a meeting as a participant under the given display name."""
    return _session(meeting, meeting_service.join_meeting(db, meeting, user, payload.display_name))
