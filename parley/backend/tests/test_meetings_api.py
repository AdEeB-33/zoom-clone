"""REST API: dashboard lists, creating, scheduling, editing and joining."""

from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Meeting, Participant, User

SEEDED_UPCOMING = "4820193765"  # hosted by the default user, not started
SEEDED_ENDED = "5568120394"


def _in(**delta) -> str:
    return (datetime.now(UTC) + timedelta(**delta)).isoformat()


def _schedule(client, **overrides):
    payload = {
        "title": "Budget review",
        "description": "Numbers for next year.",
        "scheduled_start": _in(days=2),
        "duration_minutes": 30,
        **overrides,
    }
    return client.post("/api/meetings/scheduled", json=payload)


def test_current_user_is_the_seeded_default_user(client):
    assert client.get("/api/users/me").json()["name"] == "Jamie Rivera"


def test_upcoming_lists_my_unstarted_meetings_in_time_order(client):
    upcoming = client.get("/api/meetings/upcoming").json()

    assert len(upcoming) == 4
    assert all(m["status"] == "scheduled" for m in upcoming)
    starts = [m["scheduled_start"] for m in upcoming]
    assert starts == sorted(starts)
    assert starts[0].endswith("Z")  # always sent with an explicit UTC offset


def test_recent_lists_ended_meetings_i_hosted_or_attended(client):
    recent = client.get("/api/meetings/recent").json()
    titles = [m["title"] for m in recent]

    assert "Sprint retrospective" in titles  # hosted
    assert "Customer onboarding call" in titles  # attended, hosted by someone else
    assert "Finance review" not in titles  # not involved at all
    ended = [m["ended_at"] for m in recent]
    assert ended == sorted(ended, reverse=True)
    assert recent[0]["participant_count"] == 5


def test_instant_meeting_is_live_and_returns_a_host_session(client):
    response = client.post("/api/meetings/instant", json={})
    assert response.status_code == 201
    body = response.json()
    meeting = body["meeting"]

    assert len(meeting["code"]) == 10 and meeting["code"].isdigit()
    assert meeting["kind"] == "instant"
    assert meeting["status"] == "live"
    assert meeting["invite_link"].endswith(f"/join/{meeting['code']}")
    assert body["participant"]["role"] == "host"
    assert body["token"]
    # A live meeting is listed first on the dashboard.
    assert client.get("/api/meetings/upcoming").json()[0]["code"] == meeting["code"]


def test_meeting_ids_are_unique(client):
    codes = {
        client.post("/api/meetings/instant", json={}).json()["meeting"]["code"] for _ in range(25)
    }
    assert len(codes) == 25


def test_scheduled_meeting_is_stored_and_listed(client):
    response = _schedule(client, title="  Budget review  ")
    assert response.status_code == 201
    meeting = response.json()

    assert meeting["title"] == "Budget review"  # whitespace trimmed
    assert meeting["kind"] == "scheduled"
    assert meeting["status"] == "scheduled"
    assert meeting["duration_minutes"] == 30
    assert meeting["invite_link"].endswith(meeting["code"])
    assert meeting["code"] in [m["code"] for m in client.get("/api/meetings/upcoming").json()]
    assert (
        client.get(f"/api/meetings/{meeting['code']}").json()["description"]
        == "Numbers for next year."
    )


def test_schedule_keeps_the_exact_instant_across_timezones(client):
    # 10:00 in India (UTC+5:30) must come back as 04:30 UTC.
    start = (datetime.now(UTC) + timedelta(days=3)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )
    local = start.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
    meeting = _schedule(client, scheduled_start=local.isoformat()).json()

    returned = datetime.fromisoformat(meeting["scheduled_start"])
    assert returned == local
    assert returned.utcoffset() == timedelta(0)


def test_schedule_rejects_bad_input(client):
    assert _schedule(client, title="   ").status_code == 422
    assert _schedule(client, scheduled_start=_in(hours=-2)).status_code == 422
    assert _schedule(client, scheduled_start="2030-01-01T10:00:00").status_code == 422  # no offset
    assert _schedule(client, duration_minutes=5).status_code == 422
    assert _schedule(client, duration_minutes=10_000).status_code == 422


def test_host_can_edit_and_delete_a_meeting_that_has_not_started(client):
    code = _schedule(client).json()["code"]

    edited = client.patch(
        f"/api/meetings/{code}", json={"title": "Budget review v2", "description": ""}
    )
    assert edited.status_code == 200
    assert edited.json()["title"] == "Budget review v2"
    assert edited.json()["description"] is None
    assert edited.json()["duration_minutes"] == 30  # untouched fields stay

    assert client.delete(f"/api/meetings/{code}").status_code == 204
    assert client.get(f"/api/meetings/{code}").status_code == 404


def test_started_meetings_cannot_be_edited_or_deleted(client):
    code = client.post("/api/meetings/instant", json={}).json()["meeting"]["code"]

    assert client.patch(f"/api/meetings/{code}", json={"title": "x"}).status_code == 409
    assert client.delete(f"/api/meetings/{code}").status_code == 409


def test_join_validates_the_meeting(client):
    missing = client.post("/api/meetings/0000000000/join", json={"display_name": "Sam"})
    assert missing.status_code == 404
    assert missing.json()["detail"].startswith("No meeting has that ID.")

    ended = client.post(f"/api/meetings/{SEEDED_ENDED}/join", json={"display_name": "Sam"})
    assert ended.status_code == 410

    blank = client.post(f"/api/meetings/{SEEDED_UPCOMING}/join", json={"display_name": "  "})
    assert blank.status_code == 422


def test_joining_records_a_participant_and_starts_the_meeting(client):
    response = client.post(
        f"/api/meetings/{SEEDED_UPCOMING}/join", json={"display_name": " Sam Lee "}
    )
    assert response.status_code == 200
    body = response.json()

    assert body["participant"]["display_name"] == "Sam Lee"
    assert body["participant"]["role"] == "participant"
    assert body["meeting"]["status"] == "live"
    assert body["meeting"]["started_at"] is not None
    assert body["meeting"]["participant_count"] == 1


def test_only_the_host_can_start_or_change_a_meeting(client):
    with SessionLocal() as db:
        priya = db.scalars(select(User).where(User.email == "priya.nair@example.com")).one()
        db.add(
            Meeting(
                code="1112223334",
                title="Priya's planning",
                host=priya,
                scheduled_start=datetime.now(UTC) + timedelta(days=1),
                duration_minutes=30,
            )
        )
        db.commit()

    assert client.post("/api/meetings/1112223334/start").status_code == 403
    assert client.patch("/api/meetings/1112223334", json={"title": "Mine now"}).status_code == 403
    assert client.delete("/api/meetings/1112223334").status_code == 403
    # ...but anyone with the ID can join as a participant.
    assert (
        client.post("/api/meetings/1112223334/join", json={"display_name": "Jamie"}).status_code
        == 200
    )


def test_deleting_a_meeting_removes_its_participants(client):
    """ON DELETE CASCADE only works because foreign keys are switched on."""
    with SessionLocal() as db:
        meeting = db.scalars(select(Meeting).where(Meeting.code == SEEDED_ENDED)).one()
        assert meeting.participant_count == 5

        db.delete(meeting)
        db.commit()

        left_behind = db.scalar(
            select(func.count(Participant.id)).where(Participant.meeting_id == meeting.id)
        )
        assert left_behind == 0
