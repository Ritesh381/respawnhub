from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .. import metrics
from ..clock import get_now
from ..config import settings
from ..db import get_db
from ..models import Booking, Station
from ..rules import SlotError, booking_state, day_bounds, price, validate_slot
from ..schemas import BookingCreate, BookingOut, BookingStatus, BookingUpdate
from .stations import get_station_or_404

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


def cafe_time(value: datetime) -> str:
    local = value.astimezone(ZoneInfo(settings.cafe_tz))
    return f"{local:%I:%M %p}".lstrip("0").lower()


def to_out(booking: Booking, now: datetime) -> BookingOut:
    station = booking.station
    return BookingOut(
        id=booking.id,
        station_id=station.id,
        station_code=station.code,
        station_name=station.name,
        station_type=station.type,
        player_name=booking.player_name,
        player_phone=booking.player_phone,
        start_at=booking.start_at,
        end_at=booking.end_at,
        status=booking.status,
        amount=booking.amount,
        state=booking_state(booking, now),
        created_at=booking.created_at,
    )


def check_slot(start: datetime, end: datetime, now: datetime, started_ok: bool = False) -> int:
    try:
        return validate_slot(start, end, now, started_ok)
    except SlotError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error


def ensure_bookable(
    db: Session, station: Station, start: datetime, end: datetime, exclude_id: int | None = None
) -> None:
    if not station.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{station.code} is under maintenance")
    query = select(Booking).where(
        Booking.station_id == station.id,
        Booking.status == "BOOKED",
        Booking.start_at < end,
        Booking.end_at > start,
    )
    if exclude_id is not None:
        query = query.where(Booking.id != exclude_id)
    clash = db.scalars(query.limit(1)).first()
    if clash is not None:
        metrics.BOOKING_CONFLICTS.inc()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{station.code} is already booked from "
            f"{cafe_time(clash.start_at)} to {cafe_time(clash.end_at)}",
        )


def get_booking_or_404(db: Session, booking_id: int) -> Booking:
    booking = db.get(Booking, booking_id, options=[joinedload(Booking.station)])
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return booking


@router.get("", response_model=list[BookingOut])
def list_bookings(
    date: date | None = None,
    station_id: int | None = None,
    status: BookingStatus | None = None,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    query = select(Booking).options(joinedload(Booking.station)).order_by(Booking.start_at)
    if date is not None:
        start, end = day_bounds(date, settings.cafe_tz)
        query = query.where(Booking.start_at >= start, Booking.start_at < end)
    if station_id is not None:
        query = query.where(Booking.station_id == station_id)
    if status is not None:
        query = query.where(Booking.status == status)
    return [to_out(b, now) for b in db.scalars(query)]


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate, db: Session = Depends(get_db), now: datetime = Depends(get_now)
):
    station = get_station_or_404(db, payload.station_id, lock=True)
    minutes = check_slot(payload.start_at, payload.end_at, now)
    ensure_bookable(db, station, payload.start_at, payload.end_at)

    booking = Booking(
        station=station,
        player_name=payload.player_name,
        player_phone=payload.player_phone,
        start_at=payload.start_at,
        end_at=payload.end_at,
        status="BOOKED",
        amount=price(station.hourly_rate, minutes),
    )
    db.add(booking)
    db.commit()

    metrics.BOOKINGS_CREATED.labels(station.type).inc()
    metrics.BOOKING_REVENUE.labels(station.type).inc(booking.amount)
    return to_out(booking, now)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: Session = Depends(get_db), now: datetime = Depends(get_now)):
    return to_out(get_booking_or_404(db, booking_id), now)


@router.put("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    booking = get_booking_or_404(db, booking_id)
    station = get_station_or_404(db, booking.station_id, lock=True)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)

    start = changes.get("start_at", booking.start_at)
    end = changes.get("end_at", booking.end_at)
    new_status = changes.get("status", booking.status)
    times_changed = start != booking.start_at or end != booking.end_at
    restoring = booking.status == "CANCELLED" and new_status == "BOOKED"

    if restoring and end <= now:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "This booking has already ended")
    if times_changed:
        # Moving only the end of a session that has started (an extension)
        # is fine; a new start time still has to be in the future.
        same_start = start == booking.start_at
        minutes = check_slot(start, end, now, started_ok=same_start)
        booking.amount = price(station.hourly_rate, minutes)
    if new_status == "BOOKED" and (times_changed or restoring):
        ensure_bookable(db, station, start, end, exclude_id=booking.id)

    booking.start_at, booking.end_at, booking.status = start, end, new_status
    for field in ("player_name", "player_phone"):
        if field in changes:
            setattr(booking, field, changes[field])
    db.commit()
    return to_out(booking, now)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    db.delete(get_booking_or_404(db, booking_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
