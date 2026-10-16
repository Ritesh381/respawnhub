from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..clock import get_now
from ..config import settings
from ..db import get_db
from ..models import Booking, Station
from ..rules import day_bounds, floor_status
from ..schemas import FloorStation, StationOut, StatsOut, TypeStats

router = APIRouter(prefix="/api", tags=["floor"])

TYPE_ORDER = {"PC": 0, "PS5": 1, "XBOX": 2, "VR": 3}


def build_floor(db: Session, now: datetime) -> list[FloorStation]:
    stations = sorted(db.scalars(select(Station)), key=lambda s: (TYPE_ORDER[s.type], s.code))
    upcoming = db.scalars(
        select(Booking).where(
            Booking.status == "BOOKED",
            Booking.end_at > now,
            Booking.start_at < now + timedelta(days=1),
        )
    ).all()
    by_station: dict[int, list[Booking]] = {}
    for booking in upcoming:
        by_station.setdefault(booking.station_id, []).append(booking)

    floor = []
    for station in stations:
        info = floor_status(station, by_station.get(station.id, []), now)
        floor.append(
            FloorStation(
                station=StationOut.model_validate(station),
                status=info.status,
                current_end=info.current_end,
                next_start=info.next_start,
                current_player=info.current_player,
            )
        )
    return floor


@router.get("/floor", response_model=list[FloorStation])
def floor(db: Session = Depends(get_db), now: datetime = Depends(get_now)):
    return build_floor(db, now)


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db), now: datetime = Depends(get_now)):
    today = now.astimezone(ZoneInfo(settings.cafe_tz)).date()
    start, end = day_bounds(today, settings.cafe_tz)

    rows = db.execute(
        select(Station.type, func.count(Booking.id), func.coalesce(func.sum(Booking.amount), 0))
        .join(Booking)
        .where(Booking.status == "BOOKED", Booking.start_at >= start, Booking.start_at < end)
        .group_by(Station.type)
    ).all()
    totals = {kind: (count, revenue) for kind, count, revenue in rows}

    floor_now = build_floor(db, now)
    active = [item for item in floor_now if item.station.is_active]
    live = sum(1 for item in floor_now if item.status == "LIVE")
    types = sorted({item.station.type for item in floor_now}, key=TYPE_ORDER.get)

    return StatsOut(
        date=today,
        bookings_today=sum(count for count, _ in totals.values()),
        revenue_today=sum(revenue for _, revenue in totals.values()),
        live_now=live,
        active_stations=len(active),
        occupancy_percent=round(live * 100 / len(active)) if active else 0,
        by_type=[
            TypeStats(
                type=kind, bookings=totals.get(kind, (0, 0))[0], revenue=totals.get(kind, (0, 0))[1]
            )
            for kind in types
        ],
    )
