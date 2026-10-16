from datetime import UTC, datetime


def get_now() -> datetime:
    """Current time in UTC. A dependency so tests can freeze the clock."""
    return datetime.now(UTC)
