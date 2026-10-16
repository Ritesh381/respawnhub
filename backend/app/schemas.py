from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

StationType = Literal["PC", "PS5", "XBOX", "VR"]
BookingStatus = Literal["BOOKED", "CANCELLED"]
BookingState = Literal["UPCOMING", "LIVE", "COMPLETED", "CANCELLED"]
FloorState = Literal["FREE", "LIVE", "RESERVED_SOON", "MAINTENANCE"]

Code = Annotated[
    str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Z0-9][A-Z0-9-]{1,19}$")
]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Phone = Annotated[str, StringConstraints(pattern=r"^\d{10}$")]
Rate = Annotated[int, Field(gt=0, le=10000)]
Specs = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]


class StationCreate(BaseModel):
    code: Code
    name: Name
    type: StationType
    hourly_rate: Rate
    is_active: bool = True
    specs: Specs = ""


class StationUpdate(BaseModel):
    code: Code | None = None
    name: Name | None = None
    type: StationType | None = None
    hourly_rate: Rate | None = None
    is_active: bool | None = None
    specs: Specs | None = None


class StationOut(StationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class BookingCreate(BaseModel):
    station_id: int
    player_name: Name
    player_phone: Phone | None = None
    start_at: AwareDatetime
    end_at: AwareDatetime


class BookingUpdate(BaseModel):
    start_at: AwareDatetime | None = None
    end_at: AwareDatetime | None = None
    status: BookingStatus | None = None
    player_name: Name | None = None
    player_phone: Phone | None = None


class BookingOut(BaseModel):
    id: int
    station_id: int
    station_code: str
    station_name: str
    station_type: StationType
    player_name: str
    player_phone: str | None
    start_at: datetime
    end_at: datetime
    status: BookingStatus
    amount: int
    state: BookingState
    created_at: datetime


class FloorStation(BaseModel):
    station: StationOut
    status: FloorState
    current_end: datetime | None
    next_start: datetime | None
    current_player: str | None


class TypeStats(BaseModel):
    type: StationType
    bookings: int
    revenue: int


class StatsOut(BaseModel):
    date: date
    bookings_today: int
    revenue_today: int
    live_now: int
    active_stations: int
    occupancy_percent: int
    by_type: list[TypeStats]
