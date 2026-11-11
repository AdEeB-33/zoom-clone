"""Database schema.

    users 1 ──< meetings            a user hosts many meetings
    meetings 1 ──< participants     every join is recorded as one participant row
    users 1 ──< participants        optional: guests join without an account

`Participant` is declared before `Meeting` only because `Meeting` counts its
participants in a SQL subquery, which needs the class to exist already.
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, func, select
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship

from app.clock import utcnow
from app.database import Base, UTCDateTime


class MeetingStatus(StrEnum):
    SCHEDULED = "scheduled"  # created, nobody has entered yet
    LIVE = "live"  # in progress
    ENDED = "ended"  # over; kept as history


class MeetingKind(StrEnum):
    INSTANT = "instant"
    SCHEDULED = "scheduled"


class ParticipantRole(StrEnum):
    HOST = "host"
    PARTICIPANT = "participant"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    hosted_meetings: Mapped[list["Meeting"]] = relationship(back_populates="host")


class Participant(Base):
    """One person's attendance in one meeting, from joining until leaving."""

    __tablename__ = "participants"
    __table_args__ = (
        CheckConstraint("role IN ('host', 'participant')", name="ck_participants_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    # NULL for guests. If an account is deleted the attendance record stays.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(60))
    role: Mapped[str] = mapped_column(String(16), default=ParticipantRole.PARTICIPANT.value)
    # SHA-256 of the secret handed to the browser when it joined. The browser
    # presents the secret to open its WebSocket; only the hash is stored.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    removed: Mapped[bool] = mapped_column(default=False)

    meeting: Mapped["Meeting"] = relationship(back_populates="participants")
    user: Mapped["User | None"] = relationship()


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("status IN ('scheduled', 'live', 'ended')", name="ck_meetings_status"),
        # A meeting either has a full schedule (start and duration) or none (instant).
        CheckConstraint(
            "(scheduled_start IS NULL) = (duration_minutes IS NULL)",
            name="ck_meetings_schedule_complete",
        ),
        CheckConstraint(
            "duration_minutes IS NULL OR duration_minutes > 0",
            name="ck_meetings_duration_positive",
        ),
        # Serves the dashboard query "my meetings with status X".
        Index("ix_meetings_host_status", "host_id", "status"),
    )

    # Internal key used by foreign keys. Never shown to people.
    id: Mapped[int] = mapped_column(primary_key=True)
    # The public 10-digit Meeting ID that people type or follow a link to.
    code: Mapped[str] = mapped_column(String(10), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default=MeetingStatus.SCHEDULED.value)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Planned times. Both are NULL for instant meetings.
    scheduled_start: Mapped[datetime | None] = mapped_column(UTCDateTime)
    duration_minutes: Mapped[int | None]

    # What actually happened.
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    # The host is shown wherever a meeting is, so it is loaded in the same query.
    host: Mapped[User] = relationship(back_populates="hosted_meetings", lazy="joined")
    participants: Mapped[list[Participant]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True
    )

    # Counted by the database inside the meeting SELECT itself, so listing
    # meetings never loads participant rows or runs one query per meeting.
    participant_count: Mapped[int] = column_property(
        select(func.count(Participant.id))
        .where(Participant.meeting_id == id)
        .correlate_except(Participant)
        .scalar_subquery()
    )

    @property
    def kind(self) -> MeetingKind:
        return MeetingKind.INSTANT if self.scheduled_start is None else MeetingKind.SCHEDULED
