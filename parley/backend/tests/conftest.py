"""Test setup: every test gets a freshly seeded throwaway database."""

import os
import tempfile

# These must be set before the app is imported, because settings are read once.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["EMPTY_ROOM_GRACE_SECONDS"] = "0"

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.realtime.hub import hub
from app.seed import reset_database


@pytest.fixture
def client():
    reset_database()
    hub._rooms.clear()
    with TestClient(app) as test_client:
        yield test_client
