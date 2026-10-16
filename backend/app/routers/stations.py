from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Booking, Station
from ..schemas import StationCreate, StationOut, StationType, StationUpdate

router = APIRouter(prefix="/api/stations", tags=["stations"])


def get_station_or_404(db: Session, station_id: int, lock: bool = False) -> Station:
    station = db.get(Station, station_id, with_for_update=lock)
    if station is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Station not found")
    return station


def ensure_code_free(db: Session, code: str, exclude_id: int | None = None) -> None:
    query = select(Station.id).where(Station.code == code)
    if exclude_id is not None:
        query = query.where(Station.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Station code {code} is already in use")


@router.get("", response_model=list[StationOut])
def list_stations(
    type: StationType | None = None, active: bool | None = None, db: Session = Depends(get_db)
):
    query = select(Station).order_by(Station.code)
    if type is not None:
        query = query.where(Station.type == type)
    if active is not None:
        query = query.where(Station.is_active.is_(active))
    return db.scalars(query).all()


@router.post("", response_model=StationOut, status_code=status.HTTP_201_CREATED)
def create_station(payload: StationCreate, db: Session = Depends(get_db)):
    ensure_code_free(db, payload.code)
    station = Station(**payload.model_dump())
    db.add(station)
    db.commit()
    return station


@router.get("/{station_id}", response_model=StationOut)
def get_station(station_id: int, db: Session = Depends(get_db)):
    return get_station_or_404(db, station_id)


@router.put("/{station_id}", response_model=StationOut)
def update_station(station_id: int, payload: StationUpdate, db: Session = Depends(get_db)):
    station = get_station_or_404(db, station_id)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "code" in changes:
        ensure_code_free(db, changes["code"], exclude_id=station_id)
    for field, value in changes.items():
        setattr(station, field, value)
    db.commit()
    return station


@router.delete("/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(station_id: int, db: Session = Depends(get_db)):
    station = get_station_or_404(db, station_id)
    has_bookings = db.scalar(select(Booking.id).where(Booking.station_id == station_id).limit(1))
    if has_bookings is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Station has bookings, mark it under maintenance instead"
        )
    db.delete(station)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
