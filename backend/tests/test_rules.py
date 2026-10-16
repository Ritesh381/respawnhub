from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.rules import (
    SlotError,
    booking_state,
    day_bounds,
    floor_status,
    overlaps,
    price,
    validate_slot,
)

NOW = datetime(2026, 10, 20, 8, 10, tzinfo=UTC)


def at(hour, minute=0):
    return datetime(2026, 10, 20, hour, minute, tzinfo=UTC)


def booking(start, end, status="BOOKED", player="Arjun"):
    return SimpleNamespace(start_at=start, end_at=end, status=status, player_name=player)


def station(active=True):
    return SimpleNamespace(is_active=active)


def test_valid_slot_returns_minutes():
    assert validate_slot(at(9), at(10), NOW) == 60


def test_current_half_hour_is_allowed_for_walk_ins():
    assert validate_slot(at(8), at(9), NOW) == 60


@pytest.mark.parametrize(
    ("start", "end", "message"),
    [
        (at(9), at(9, 45) + timedelta(minutes=0), "30 minute steps"),
        (at(9), at(17, 30), "between 30 minutes and 8 hours"),
        (at(9, 10), at(10, 10), "hour or half hour"),
        (at(10), at(9), "after start"),
        (at(7, 30), at(8, 30), "in the past"),
    ],
)
def test_invalid_slots_are_rejected(start, end, message):
    with pytest.raises(SlotError, match=message):
        validate_slot(start, end, NOW)


def test_naive_times_are_rejected():
    with pytest.raises(SlotError, match="timezone"):
        validate_slot(datetime(2026, 10, 20, 9), datetime(2026, 10, 20, 10), NOW)


def test_price_is_rate_times_hours():
    assert price(150, 90) == 225
    assert price(125, 30) == 63


def test_back_to_back_slots_do_not_overlap():
    assert not overlaps(at(9), at(10), at(10), at(11))
    assert overlaps(at(9), at(10, 30), at(10), at(11))


def test_booking_state_follows_the_clock():
    assert booking_state(booking(at(9), at(10)), NOW) == "UPCOMING"
    assert booking_state(booking(at(8), at(9)), NOW) == "LIVE"
    assert booking_state(booking(at(6), at(7)), NOW) == "COMPLETED"
    assert booking_state(booking(at(9), at(10), "CANCELLED"), NOW) == "CANCELLED"


def test_floor_status_live_shows_current_player_and_end():
    info = floor_status(station(), [booking(at(8), at(9), player="Meera")], NOW)
    assert info.status == "LIVE"
    assert info.current_end == at(9)
    assert info.current_player == "Meera"


def test_floor_status_reserved_soon_within_an_hour():
    info = floor_status(station(), [booking(at(9), at(10))], NOW)
    assert info.status == "RESERVED_SOON"
    assert info.next_start == at(9)


def test_floor_status_free_ignores_cancelled_and_far_bookings():
    bookings = [booking(at(8), at(9), "CANCELLED"), booking(at(12), at(13))]
    info = floor_status(station(), bookings, NOW)
    assert info.status == "FREE"
    assert info.next_start == at(12)


def test_floor_status_maintenance_when_inactive():
    assert floor_status(station(active=False), [], NOW).status == "MAINTENANCE"


def test_day_bounds_use_cafe_timezone():
    start, end = day_bounds(date(2026, 10, 20), "Asia/Kolkata")
    assert start == datetime(2026, 10, 19, 18, 30, tzinfo=UTC)
    assert end == datetime(2026, 10, 20, 18, 30, tzinfo=UTC)
