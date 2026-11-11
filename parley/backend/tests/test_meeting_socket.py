"""WebSocket: presence, signalling relay, host controls and meeting lifecycle."""

import time

import pytest
from starlette.websockets import WebSocketDisconnect

from app.errors import CloseCode


def _start_instant(client) -> tuple[str, dict]:
    body = client.post("/api/meetings/instant", json={}).json()
    return body["meeting"]["code"], body


def _join(client, code: str, name: str) -> dict:
    return client.post(f"/api/meetings/{code}/join", json={"display_name": name}).json()


def _connect(client, code: str, session: dict):
    return client.websocket_connect(f"/ws/meetings/{code}?token={session['token']}")


def _status(client, code: str) -> str:
    return client.get(f"/api/meetings/{code}").json()["status"]


def _wait_for_status(client, code: str, expected: str) -> None:
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        if _status(client, code) == expected:
            return
        time.sleep(0.02)
    raise AssertionError(f"meeting never became {expected}")


def _expect_close(socket, code: CloseCode) -> None:
    with pytest.raises(WebSocketDisconnect) as closed:
        socket.receive_json()
    assert closed.value.code == code


def test_socket_refuses_an_unknown_token_or_meeting(client):
    code, _ = _start_instant(client)

    with client.websocket_connect(f"/ws/meetings/{code}?token=nope") as socket:
        _expect_close(socket, CloseCode.INVALID_SESSION)
    with client.websocket_connect("/ws/meetings/0000000000?token=nope") as socket:
        _expect_close(socket, CloseCode.MEETING_NOT_FOUND)


def test_presence_signalling_and_media_state(client):
    code, host_session = _start_instant(client)
    guest_session = _join(client, code, "Sam Lee")
    host_id = host_session["participant"]["id"]
    guest_id = guest_session["participant"]["id"]

    with _connect(client, code, host_session) as host:
        welcome = host.receive_json()
        assert welcome["type"] == "welcome"
        assert welcome["self"]["role"] == "host"
        assert welcome["participants"] == []

        with _connect(client, code, guest_session) as guest:
            # The newcomer is told who is already there...
            welcome = guest.receive_json()
            assert [p["id"] for p in welcome["participants"]] == [host_id]
            # ...and everyone else is told about the newcomer.
            joined = host.receive_json()
            assert joined["type"] == "participant-joined"
            assert joined["participant"]["name"] == "Sam Lee"

            # WebRTC signalling is relayed to exactly one peer, tagged with the sender.
            guest.send_json({"type": "signal", "to": host_id, "data": {"description": "offer"}})
            assert host.receive_json() == {
                "type": "signal",
                "from": guest_id,
                "data": {"description": "offer"},
            }

            guest.send_json({"type": "media-state", "audio": True, "video": False})
            updated = host.receive_json()
            assert updated["type"] == "participant-updated"
            assert updated["participant"]["audio"] is True
            assert updated["participant"]["video"] is False

        left = host.receive_json()
        assert left == {"type": "participant-left", "participantId": guest_id}


def test_only_the_host_can_use_host_controls(client):
    code, host_session = _start_instant(client)
    guest_session = _join(client, code, "Sam Lee")

    with (
        _connect(client, code, host_session) as host,
        _connect(client, code, guest_session) as guest,
    ):
        host.receive_json()  # welcome
        host.receive_json()  # participant-joined
        guest.receive_json()  # welcome

        for attempt in ("mute-all", "end-meeting"):
            guest.send_json({"type": attempt})
            assert guest.receive_json() == {
                "type": "error",
                "message": "Only the host can do that.",
            }
        guest.send_json(
            {"type": "remove-participant", "participantId": host_session["participant"]["id"]}
        )
        assert guest.receive_json()["type"] == "error"

        assert _status(client, code) == "live"


def test_host_can_mute_everyone(client):
    code, host_session = _start_instant(client)
    guest_session = _join(client, code, "Sam Lee")
    host_id = host_session["participant"]["id"]

    with (
        _connect(client, code, host_session) as host,
        _connect(client, code, guest_session) as guest,
    ):
        host.receive_json()
        host.receive_json()
        guest.receive_json()

        host.send_json({"type": "mute-all"})
        assert guest.receive_json() == {"type": "all-muted", "by": host_id}
        assert host.receive_json() == {"type": "all-muted", "by": host_id}


def test_host_can_remove_a_participant_for_good(client):
    code, host_session = _start_instant(client)
    guest_session = _join(client, code, "Sam Lee")
    guest_id = guest_session["participant"]["id"]

    with _connect(client, code, host_session) as host:
        host.receive_json()
        with _connect(client, code, guest_session) as guest:
            guest.receive_json()
            host.receive_json()

            host.send_json({"type": "remove-participant", "participantId": guest_id})
            assert host.receive_json() == {"type": "participant-left", "participantId": guest_id}
            _expect_close(guest, CloseCode.REMOVED)

        # The removed session cannot be used to slip back in.
        with _connect(client, code, guest_session) as again:
            _expect_close(again, CloseCode.REMOVED)


def test_host_can_end_the_meeting_for_everyone(client):
    code, host_session = _start_instant(client)
    guest_session = _join(client, code, "Sam Lee")

    with (
        _connect(client, code, host_session) as host,
        _connect(client, code, guest_session) as guest,
    ):
        host.receive_json()
        host.receive_json()
        guest.receive_json()

        host.send_json({"type": "end-meeting"})
        _expect_close(guest, CloseCode.MEETING_ENDED)
        _expect_close(host, CloseCode.MEETING_ENDED)

    meeting = client.get(f"/api/meetings/{code}").json()
    assert meeting["status"] == "ended"
    assert meeting["ended_at"] >= meeting["started_at"]
    assert code in [m["code"] for m in client.get("/api/meetings/recent").json()]
    assert code not in [m["code"] for m in client.get("/api/meetings/upcoming").json()]
    assert (
        client.post(f"/api/meetings/{code}/join", json={"display_name": "Late"}).status_code == 410
    )


def test_meeting_ends_by_itself_once_everyone_has_left(client):
    code, host_session = _start_instant(client)

    with _connect(client, code, host_session) as host:
        host.receive_json()
        assert _status(client, code) == "live"

    _wait_for_status(client, code, "ended")


def test_opening_the_same_session_twice_keeps_only_the_newest_connection(client):
    code, host_session = _start_instant(client)

    with _connect(client, code, host_session) as first:
        first.receive_json()
        with _connect(client, code, host_session) as second:
            assert second.receive_json()["type"] == "welcome"
            _expect_close(first, CloseCode.REPLACED)
            assert _status(client, code) == "live"
