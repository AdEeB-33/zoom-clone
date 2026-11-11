"""Request and response shapes for the REST API."""

from datetime import datetime, timedelta
from typing import Annotated

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    field_validator,
)

from app.clock import utcnow
from app.config import settings
from app.models import MeetingKind, MeetingStatus, ParticipantRole

MIN_DURATION_MINUTES = 15
MAX_DURATION_MINUTES = 8 * 60

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Duration = Annotated[int, Field(ge=MIN_DURATION_MINUTES, le=MAX_DURATION_MINUTES)]


def _require_future(value: datetime | None) -> datetime | None:
    # One minute of slack covers the gap between picking "now" and sending it.
    if value is not None and value < utcnow() - timedelta(minutes=1):
        raise ValueError("Choose a start time in the future.")
    return value


# ---- requests -------------------------------------------------------------


class InstantMeetingIn(BaseModel):
    title: Title | None = None


class ScheduleMeetingIn(BaseModel):
    title: Title
    description: Description | None = None
    # AwareDatetime rejects timestamps without a UTC offset, so "10:00" can
    # never be silently read in the server's timezone instead of the user's.
    scheduled_start: AwareDatetime
    duration_minutes: Duration

    _future_start = field_validator("scheduled_start")(_require_future)


class UpdateMeetingIn(BaseModel):
    """Partial update: only the fields that are sent are changed."""

    title: Title | None = None
    description: Description | None = None
    scheduled_start: AwareDatetime | None = None
    duration_minutes: Duration | None = None

    _future_start = field_validator("scheduled_start")(_require_future)


class JoinMeetingIn(BaseModel):
    display_name: DisplayName


# ---- responses ------------------------------------------------------------


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    title: str
    description: str | None
    kind: MeetingKind
    status: MeetingStatus
    host: UserOut
    scheduled_start: datetime | None
    duration_minutes: int | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    participant_count: int

    @computed_field
    @property
    def invite_link(self) -> str:
        # Derived from the code rather than stored, so links keep working if
        # the frontend moves to another domain.
        return f"{settings.frontend_url}/join/{self.code}"


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    role: ParticipantRole
    joined_at: datetime


class MeetingSessionOut(BaseModel):
    """Returned when someone enters a meeting. `token` is shown only once and
    is what the browser presents to open the meeting's WebSocket."""

    meeting: MeetingOut
    participant: ParticipantOut
    token: str
