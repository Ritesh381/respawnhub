from conftest import iso


def test_health_is_up(client):
    assert client.get("/health").json() == {"status": "UP"}


def test_ready_checks_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "READY"}


def test_root_describes_service(client):
    body = client.get("/").json()
    assert body["service"] == "RespawnHub API"
    assert body["docs"] == "/docs"


def test_metrics_expose_booking_counters(client, make_station, book):
    station = make_station()
    book(station["id"], iso(9), iso(10))
    book(station["id"], iso(9), iso(10))  # conflict

    text = client.get("/metrics").text
    assert 'respawnhub_bookings_created_total{station_type="PC"}' in text
    assert "respawnhub_booking_conflicts_total" in text
    assert "respawnhub_stations_live" in text
    assert "http_requests_total" in text


def test_meta_reports_running_build(client):
    assert client.get("/api/meta").json() == {"version": "dev", "cafe_timezone": "Asia/Kolkata"}


def test_booking_counters_start_at_zero_for_every_station_type(client):
    # Prometheus can only see an increase if it has scraped the series before
    # the first booking, so every label must exist from start up.
    text = client.get("/metrics").text
    for station_type in ("PC", "PS5", "XBOX", "VR"):
        assert f'respawnhub_bookings_created_total{{station_type="{station_type}"}}' in text
        assert f'respawnhub_booking_revenue_rupees_total{{station_type="{station_type}"}}' in text
