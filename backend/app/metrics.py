"""Business metrics for Prometheus, on top of the default HTTP metrics."""

from datetime import UTC, datetime
from typing import get_args

from prometheus_client import REGISTRY, Counter
from prometheus_client.core import GaugeMetricFamily
from sqlalchemy import distinct, func, select

from .db import SessionLocal
from .models import Booking, Station
from .schemas import StationType

BOOKINGS_CREATED = Counter(
    "respawnhub_bookings_created_total", "Bookings created", ["station_type"]
)
BOOKING_CONFLICTS = Counter(
    "respawnhub_booking_conflicts_total", "Booking requests refused because the slot was taken"
)
BOOKING_REVENUE = Counter(
    "respawnhub_booking_revenue_rupees_total",
    "Value of bookings created, in rupees",
    ["station_type"],
)

LIVE_NAME = "respawnhub_stations_live"
LIVE_HELP = "Stations with a session in progress right now"


class LiveStationsCollector:
    """Counts live stations at scrape time. Skipped quietly if the DB is down."""

    def describe(self):
        return [GaugeMetricFamily(LIVE_NAME, LIVE_HELP)]

    def collect(self):
        now = datetime.now(UTC)
        query = (
            select(func.count(distinct(Booking.station_id)))
            .join(Station)
            .where(
                Booking.status == "BOOKED",
                Booking.start_at <= now,
                Booking.end_at > now,
                Station.is_active.is_(True),
            )
        )
        try:
            with SessionLocal() as db:
                live = db.scalar(query) or 0
        except Exception:
            return
        gauge = GaugeMetricFamily(LIVE_NAME, LIVE_HELP)
        gauge.add_metric([], live)
        yield gauge


_registered = False


def register_collectors() -> None:
    global _registered
    if not _registered:
        REGISTRY.register(LiveStationsCollector())
        # Publish every label at 0 straight away. A series that first appears
        # already at 1 hides that first booking from increase() and rate().
        for station_type in get_args(StationType):
            BOOKINGS_CREATED.labels(station_type)
            BOOKING_REVENUE.labels(station_type)
        _registered = True
