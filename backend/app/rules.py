"""Booking rules for the cafe floor. Pure functions, no database access."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

SLOT_STEP_MINUTES = 30
MIN_MINUTES = 30
MAX_MINUTES = 480
SOON_WINDOW = timedelta(minutes=60)


class SlotError(ValueError):
    """Raised when a requested time slot breaks a booking rule."""


@dataclass
class FloorInfo:
    status: str
    current_end: datetime | None = None
    next_start: datetime | None = None
    current_player: str | None = None


def current_slot_start(now: datetime) -> datetime:
    return now.replace(minute=0 if now.minute < 30 else 30, second=0, microsecond=0)


def validate_slot(start: datetime, end: datetime, now: datetime, started_ok: bool = False) -> int:
    """Check a slot against the cafe rules and return its length in minutes.

    started_ok allows a start in the past (extending a session that is already
    running); the end must then still be in the future.
    """
    if start.tzinfo is None or end.tzinfo is None:
        raise SlotError("Times must include a timezone offset")
    start, end = start.astimezone(UTC), end.astimezone(UTC)
    if end <= start:
        raise SlotError("End time must be after start time")
    if start.minute % SLOT_STEP_MINUTES or start.second or start.microsecond:
        raise SlotError("Bookings start on the hour or half hour")

    seconds = (end - start).total_seconds()
    minutes = int(seconds // 60)
    if seconds % 60 or minutes % SLOT_STEP_MINUTES:
        raise SlotError("Duration must be in 30 minute steps")
    if not MIN_MINUTES <= minutes <= MAX_MINUTES:
        raise SlotError("Duration must be between 30 minutes and 8 hours")
    if started_ok:
        if end <= now:
            raise SlotError("End time is in the past")
    elif start < current_slot_start(now):
        raise SlotError("Start time is in the past")
    return minutes


def price(hourly_rate: int, minutes: int) -> int:
    """Rupees for a slot, rounded half up."""
    return (hourly_rate * minutes + 30) // 60


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and a_end > b_start


def booking_state(booking, now: datetime) -> str:
    if booking.status == "CANCELLED":
        return "CANCELLED"
    if now < booking.start_at:
        return "UPCOMING"
    if now < booking.end_at:
        return "LIVE"
    return "COMPLETED"


def floor_status(station, bookings, now: datetime) -> FloorInfo:
    """Work out what a station looks like on the floor right now."""
    active = sorted((b for b in bookings if b.status == "BOOKED"), key=lambda b: b.start_at)
    current = next((b for b in active if b.start_at <= now < b.end_at), None)
    upcoming = next((b for b in active if b.start_at > now), None)
    next_start = upcoming.start_at if upcoming else None

    if not station.is_active:
        return FloorInfo("MAINTENANCE", next_start=next_start)
    if current:
        return FloorInfo("LIVE", current.end_at, next_start, current.player_name)
    if upcoming and upcoming.start_at - now <= SOON_WINDOW:
        return FloorInfo("RESERVED_SOON", next_start=next_start)
    return FloorInfo("FREE", next_start=next_start)


def day_bounds(day: date, tz_name: str) -> tuple[datetime, datetime]:
    """UTC start and end of a calendar day in the cafe's timezone."""
    tz = ZoneInfo(tz_name)
    start = datetime.combine(day, time.min, tzinfo=tz)
    end = start + timedelta(days=1)
    return start.astimezone(UTC), end.astimezone(UTC)
