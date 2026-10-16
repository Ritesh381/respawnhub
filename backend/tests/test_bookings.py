from conftest import iso


def test_create_booking_prices_the_slot(make_station, book):
    station = make_station(rate=120)
    response = book(station["id"], iso(9), iso(10, 30), phone="9876543210")
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 180
    assert data["state"] == "UPCOMING"
    assert data["station_code"] == "PC-01"
    assert data["status"] == "BOOKED"


def test_overlapping_booking_is_refused(make_station, book):
    station = make_station()
    book(station["id"], iso(9), iso(10))
    response = book(station["id"], iso(9, 30), iso(10, 30), player="Kabir")
    assert response.status_code == 409
    assert "already booked" in response.json()["detail"]


def test_back_to_back_bookings_are_allowed(make_station, book):
    station = make_station()
    assert book(station["id"], iso(9), iso(10)).status_code == 201
    assert book(station["id"], iso(10), iso(11)).status_code == 201


def test_same_slot_on_another_station_is_fine(make_station, book):
    first, second = make_station("PC-01"), make_station("PC-02")
    assert book(first["id"], iso(9), iso(10)).status_code == 201
    assert book(second["id"], iso(9), iso(10)).status_code == 201


def test_station_under_maintenance_cannot_be_booked(make_station, book):
    station = make_station(is_active=False)
    response = book(station["id"], iso(9), iso(10))
    assert response.status_code == 409
    assert "maintenance" in response.json()["detail"]


def test_unknown_station_is_404(book):
    assert book(999, iso(9), iso(10)).status_code == 404


def test_time_without_offset_is_rejected(make_station, book):
    station = make_station()
    assert book(station["id"], "2026-10-20T09:00:00", "2026-10-20T10:00:00").status_code == 422


def test_odd_duration_is_rejected(make_station, book):
    station = make_station()
    response = book(station["id"], iso(9), iso(9, 45))
    assert response.status_code == 422
    assert "30 minute steps" in response.json()["detail"]


def test_bad_phone_is_rejected(make_station, book):
    station = make_station()
    assert book(station["id"], iso(9), iso(10), phone="12345").status_code == 422


def test_reschedule_into_taken_slot_is_refused(client, make_station, book):
    station = make_station()
    book(station["id"], iso(9), iso(10))
    later = book(station["id"], iso(11), iso(12)).json()
    response = client.put(
        f"/api/bookings/{later['id']}", json={"start_at": iso(9, 30), "end_at": iso(10, 30)}
    )
    assert response.status_code == 409


def test_reschedule_can_overlap_its_own_old_slot(client, make_station, book):
    station = make_station(rate=120)
    booking = book(station["id"], iso(9), iso(10)).json()
    response = client.put(
        f"/api/bookings/{booking['id']}", json={"start_at": iso(9, 30), "end_at": iso(11)}
    )
    assert response.status_code == 200
    assert response.json()["amount"] == 180


def test_cancelling_frees_the_slot(client, make_station, book):
    station = make_station()
    booking = book(station["id"], iso(9), iso(10)).json()
    response = client.put(f"/api/bookings/{booking['id']}", json={"status": "CANCELLED"})
    assert response.json()["state"] == "CANCELLED"
    assert book(station["id"], iso(9), iso(10), player="Kabir").status_code == 201


def test_restoring_into_a_taken_slot_is_refused(client, make_station, book):
    station = make_station()
    booking = book(station["id"], iso(9), iso(10)).json()
    client.put(f"/api/bookings/{booking['id']}", json={"status": "CANCELLED"})
    book(station["id"], iso(9), iso(10), player="Kabir")
    response = client.put(f"/api/bookings/{booking['id']}", json={"status": "BOOKED"})
    assert response.status_code == 409


def test_list_bookings_filters_by_cafe_day(client, make_station, book):
    station = make_station()
    book(station["id"], iso(9), iso(10))
    book(station["id"], iso(9, day=21), iso(10, day=21))
    response = client.get("/api/bookings?date=2026-10-20")
    assert [b["start_at"][:10] for b in response.json()] == ["2026-10-20"]


def test_delete_booking(client, make_station, book):
    station = make_station()
    booking = book(station["id"], iso(9), iso(10)).json()
    assert client.delete(f"/api/bookings/{booking['id']}").status_code == 204
    assert client.get(f"/api/bookings/{booking['id']}").status_code == 404


def test_running_session_extension_after_start_is_allowed(client, make_station, book):
    from datetime import UTC, datetime

    from app.clock import get_now

    station = make_station(rate=120)
    booking = book(station["id"], iso(8), iso(9)).json()
    client.app.dependency_overrides[get_now] = lambda: datetime(2026, 10, 20, 8, 40, tzinfo=UTC)
    response = client.put(f"/api/bookings/{booking['id']}", json={"end_at": iso(10)})
    assert response.status_code == 200
    assert response.json()["amount"] == 240


def test_finished_booking_cannot_be_restored(client, make_station, book):
    from datetime import UTC, datetime

    from app.clock import get_now

    station = make_station()
    booking = book(station["id"], iso(8), iso(9)).json()
    client.put(f"/api/bookings/{booking['id']}", json={"status": "CANCELLED"})
    client.app.dependency_overrides[get_now] = lambda: datetime(2026, 10, 20, 9, 30, tzinfo=UTC)
    response = client.put(f"/api/bookings/{booking['id']}", json={"status": "BOOKED"})
    assert response.status_code == 422
    assert "already ended" in response.json()["detail"]
