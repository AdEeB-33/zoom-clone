"""Sample data so the dashboard has something to show on first run.

Seeding happens automatically at startup when the database is empty. To wipe
everything and start again:

    python -m app.seed --reset
"""

import secrets
import sys
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.clock import utcnow
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Meeting, MeetingStatus, Participant, ParticipantRole, User


def _half_hour(moment: datetime) -> datetime:
    """Round up to the next :00 or :30 so seeded times look like real bookings."""
    moment = moment.replace(second=0, microsecond=0)
    return moment + timedelta(minutes=(30 - moment.minute % 30) % 30)


def _attendance(
    name: str,
    joined: datetime,
    left: datetime,
    *,
    user: User | None = None,
    role: ParticipantRole = ParticipantRole.PARTICIPANT,
) -> Participant:
    return Participant(
        user=user,
        display_name=name,
        role=role,
        # These meetings are over, so nobody will ever present these secrets.
        token_hash=secrets.token_hex(32),
        joined_at=joined,
        left_at=left,
    )


def _finished_meeting(
    *,
    code: str,
    title: str,
    host: User,
    started: datetime,
    minutes: int,
    guests: list[tuple[str, User | None]],
    scheduled: bool = True,
    description: str | None = None,
) -> Meeting:
    ended = started + timedelta(minutes=minutes)
    meeting = Meeting(
        code=code,
        title=title,
        description=description,
        host=host,
        status=MeetingStatus.ENDED,
        scheduled_start=started if scheduled else None,
        duration_minutes=max(15, round(minutes / 15) * 15) if scheduled else None,
        started_at=started,
        ended_at=ended,
        created_at=started - timedelta(days=2),
    )
    meeting.participants.append(
        _attendance(host.name, started, ended, user=host, role=ParticipantRole.HOST)
    )
    for name, user in guests:
        meeting.participants.append(
            _attendance(name, started + timedelta(minutes=1), ended, user=user)
        )
    return meeting


def seed_database(db: Session) -> bool:
    """Insert the sample data. Does nothing if any user already exists."""
    if db.scalar(select(User.id).limit(1)) is not None:
        return False

    jamie = User(name="Jamie Rivera", email=settings.default_user_email)
    priya = User(name="Priya Nair", email="priya.nair@example.com")
    tomas = User(name="Tomas Okafor", email="tomas.okafor@example.com")
    lena = User(name="Lena Fischer", email="lena.fischer@example.com")
    db.add_all([jamie, priya, tomas, lena])

    now = utcnow()
    soon = _half_hour(now + timedelta(hours=2))

    upcoming = [
        Meeting(
            code="4820193765",
            title="Weekly product sync",
            description="Roadmap check-in, blockers, and what ships this week.",
            host=jamie,
            scheduled_start=soon,
            duration_minutes=45,
        ),
        Meeting(
            code="7315502846",
            title="Design review: onboarding flow",
            description="Walk through the new sign-up screens with design and support.",
            host=jamie,
            scheduled_start=soon + timedelta(days=1, hours=1),
            duration_minutes=60,
        ),
        Meeting(
            code="2649087153",
            title="Quarterly planning workshop",
            description="Bring your team's top three priorities for next quarter.",
            host=jamie,
            scheduled_start=soon + timedelta(days=3),
            duration_minutes=90,
        ),
        Meeting(
            code="9051346278",
            title="1:1 with Priya",
            host=jamie,
            scheduled_start=soon + timedelta(days=6, hours=2),
            duration_minutes=30,
        ),
    ]

    earlier = _half_hour(now) - timedelta(hours=1)
    recent = [
        _finished_meeting(
            code="5568120394",
            title="Sprint retrospective",
            description="What went well, what did not, and one thing to change.",
            host=jamie,
            started=earlier - timedelta(days=1),
            minutes=52,
            guests=[
                ("Priya Nair", priya),
                ("Tomas Okafor", tomas),
                ("Lena Fischer", lena),
                ("Dana (contractor)", None),
            ],
        ),
        _finished_meeting(
            code="3307945182",
            title="Customer onboarding call",
            host=priya,
            started=earlier - timedelta(days=2, hours=3),
            minutes=31,
            guests=[("Jamie Rivera", jamie), ("Miguel Santos", None)],
        ),
        _finished_meeting(
            code="8124670539",
            title="Jamie Rivera’s meeting",
            host=jamie,
            started=earlier - timedelta(days=4, minutes=20),
            minutes=12,
            guests=[("Tomas Okafor", tomas)],
            scheduled=False,
        ),
        _finished_meeting(
            code="6490238715",
            title="Hiring debrief",
            host=lena,
            started=earlier - timedelta(days=6),
            minutes=40,
            guests=[("Jamie Rivera", jamie), ("Priya Nair", priya)],
        ),
        # Jamie was not part of this one, so it must never show up for Jamie.
        _finished_meeting(
            code="1783659420",
            title="Finance review",
            host=tomas,
            started=earlier - timedelta(days=3),
            minutes=45,
            guests=[("Priya Nair", priya)],
        ),
    ]

    db.add_all(upcoming + recent)
    db.commit()
    return True


def reset_database() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset_database()
        print("Database wiped and seeded again.")
    else:
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            print(
                "Seeded sample data."
                if seed_database(db)
                else "Data already present; nothing changed."
            )
