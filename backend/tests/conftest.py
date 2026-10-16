import os

# Tests run against an in-memory SQLite database, never the real Postgres.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from datetime import UTC, datetime  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.clock import get_now  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

# 08:00 UTC is 1:30 pm in the cafe (Asia/Kolkata).
FIXED_NOW = datetime(2026, 10, 20, 8, 0, tzinfo=UTC)


def iso(hour: int, minute: int = 0, day: int = 20) -> str:
    return datetime(2026, 10, day, hour, minute, tzinfo=UTC).isoformat()


@pytest.fixture
def client():
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_now] = lambda: FIXED_NOW
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


@pytest.fixture
def make_station(client):
    def _make(code="PC-01", type="PC", rate=120, **extra):
        body = {"code": code, "name": f"{code} rig", "type": type, "hourly_rate": rate, **extra}
        response = client.post("/api/stations", json=body)
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture
def book(client):
    def _book(station_id, start, end, player="Arjun", phone=None):
        body = {
            "station_id": station_id,
            "player_name": player,
            "player_phone": phone,
            "start_at": start,
            "end_at": end,
        }
        return client.post("/api/bookings", json=body)

    return _book
