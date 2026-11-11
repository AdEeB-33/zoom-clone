"""Domain errors.

Services raise these instead of HTTP exceptions so they stay independent of
the transport. Each error knows the HTTP status used by the REST API and the
close code used when the same problem surfaces on a WebSocket.
"""

from enum import IntEnum


class CloseCode(IntEnum):
    """Application-defined WebSocket close codes (the 4000-4999 range is free
    for apps). The frontend mirrors these in src/lib/protocol.ts."""

    INVALID_SESSION = 4401
    REMOVED = 4403
    MEETING_NOT_FOUND = 4404
    REPLACED = 4409
    MEETING_ENDED = 4410


class AppError(Exception):
    status_code = 400
    close_code = 1008  # "policy violation", the generic refusal
    message = "The request could not be completed."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)


class MeetingNotFound(AppError):
    status_code = 404
    close_code = CloseCode.MEETING_NOT_FOUND
    message = "No meeting has that ID. Check the number and try again."


class MeetingEnded(AppError):
    status_code = 410
    close_code = CloseCode.MEETING_ENDED
    message = "This meeting has ended."


class NotMeetingHost(AppError):
    status_code = 403
    message = "Only the host can do that."


class MeetingAlreadyStarted(AppError):
    status_code = 409
    message = "Only meetings that have not started can be changed or deleted."


class InvalidSession(AppError):
    status_code = 401
    close_code = CloseCode.INVALID_SESSION
    message = "Your place in this meeting could not be verified. Join again."


class RemovedFromMeeting(AppError):
    status_code = 403
    close_code = CloseCode.REMOVED
    message = "The host removed you from this meeting."
