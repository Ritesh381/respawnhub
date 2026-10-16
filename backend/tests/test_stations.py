from conftest import iso


def test_create_station(client):
    body = {"code": "PS5-01", "name": "PS5 Bay 1", "type": "PS5", "hourly_rate": 150}
    response = client.post("/api/stations", json=body)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "PS5-01"
    assert data["is_active"] is True
    assert data["specs"] == ""


def test_list_stations_filters_by_type_and_active(client, make_station):
    make_station("PC-01")
    make_station("VR-01", type="VR", rate=250, is_active=False)

    assert [s["code"] for s in client.get("/api/stations?type=VR").json()] == ["VR-01"]
    assert [s["code"] for s in client.get("/api/stations?active=true").json()] == ["PC-01"]


def test_duplicate_code_is_conflict(client, make_station):
    make_station("PC-01")
    body = {"code": "PC-01", "name": "Again", "type": "PC", "hourly_rate": 100}
    assert client.post("/api/stations", json=body).status_code == 409


def test_invalid_station_type_is_rejected(client):
    body = {"code": "NS-01", "name": "Switch", "type": "SWITCH", "hourly_rate": 100}
    assert client.post("/api/stations", json=body).status_code == 422


def test_update_station_toggles_maintenance(client, make_station):
    station = make_station()
    response = client.put(f"/api/stations/{station['id']}", json={"is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert response.json()["name"] == station["name"]


def test_unknown_station_is_404(client):
    assert client.get("/api/stations/999").status_code == 404


def test_delete_station(client, make_station):
    station = make_station()
    assert client.delete(f"/api/stations/{station['id']}").status_code == 204
    assert client.get(f"/api/stations/{station['id']}").status_code == 404


def test_delete_station_with_bookings_is_blocked(client, make_station, book):
    station = make_station()
    book(station["id"], iso(9), iso(10))
    response = client.delete(f"/api/stations/{station['id']}")
    assert response.status_code == 409
    assert "maintenance" in response.json()["detail"]
