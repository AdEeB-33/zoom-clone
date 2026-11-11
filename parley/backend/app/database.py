"""Database engine, session factory and the shared declarative base."""

from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import settings

# FastAPI runs each request on a worker thread, so the SQLite connection must
# be usable from a thread other than the one that opened it.
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _enforce_foreign_keys(dbapi_connection, _connection_record) -> None:
    # SQLite ignores foreign keys (and ON DELETE rules) unless asked per connection.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# expire_on_commit=False keeps loaded attributes readable after a commit, so
# objects can be serialised into a response without another round of SELECTs.
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator):
    """A datetime column that is always UTC.

    SQLite has no timezone-aware type, so values are stored as naive UTC and
    handed back with tzinfo attached. The API therefore always emits an
    explicit offset and browsers convert to the viewer's local time correctly.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes are not accepted; attach a timezone first")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        return None if value is None else value.replace(tzinfo=UTC)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    with SessionLocal() as session:
        yield session
