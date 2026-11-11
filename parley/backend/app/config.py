"""Runtime settings. Every value has a local-development default and can be
overridden with an environment variable when the API is deployed."""

import os
from dataclasses import dataclass


def _split(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str
    # Public address of the frontend. Invite links are built from it.
    frontend_url: str
    # Browser origins allowed to call the API. The frontend is always included.
    cors_origins: list[str]
    # Email of the seeded account that is treated as "logged in" (see app/deps.py).
    default_user_email: str
    # How long a meeting may sit with nobody connected before it is closed out.
    # The delay lets someone refresh the page without ending their own meeting.
    empty_room_grace_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
        extra_origins = _split(os.getenv("CORS_ORIGINS", "http://127.0.0.1:3000"))
        return cls(
            database_url=os.getenv("DATABASE_URL", "sqlite:///./parley.db"),
            frontend_url=frontend_url,
            cors_origins=sorted({frontend_url, *extra_origins}),
            default_user_email=os.getenv("DEFAULT_USER_EMAIL", "jamie.rivera@example.com"),
            empty_room_grace_seconds=float(os.getenv("EMPTY_ROOM_GRACE_SECONDS", "15")),
        )


settings = Settings.from_env()
