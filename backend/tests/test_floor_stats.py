from conftest import iso


def test_floor_shows_live_free_and_maintenance(client, make_station, book):
    pc = make_station("PC-01", rate=120)
    make_station("PC-02", rate=120)
    make_station("VR-01", type="VR", rate=250, is_active=False)
    book(pc["id"], iso(8), iso(9), player="Meera")

    floor = client.get("/api/floor").json()
    by_code = {item["station"]["code"]: item for item in floor}

    assert [item["station"]["code"] for item in floor] == ["PC-01", "PC-02", "VR-01"]
    assert by_code["PC-01"]["status"] == "LIVE"
    assert by_code["PC-01"]["current_player"] == "Meera"
    assert by_code["PC-02"]["status"] == "FREE"
    assert by_code["VR-01"]["status"] == "MAINTENANCE"


def test_stats_count_today_and_skip_cancelled(client, make_station, book):
    pc = make_station("PC-01", rate=120)
    ps5 = make_station("PS5-01", type="PS5", rate=150)
    book(pc["id"], iso(8), iso(9))
    cancelled = book(ps5["id"], iso(10), iso(12)).json()
    client.put(f"/api/bookings/{cancelled['id']}", json={"status": "CANCELLED"})
    book(ps5["id"], iso(9, day=21), iso(10, day=21))  # tomorrow

    stats = client.get("/api/stats").json()
    assert stats["date"] == "2026-10-20"
    assert stats["bookings_today"] == 1
    assert stats["revenue_today"] == 120
    assert stats["live_now"] == 1
    assert stats["active_stations"] == 2
    assert stats["occupancy_percent"] == 50
    assert stats["by_type"] == [
        {"type": "PC", "bookings": 1, "revenue": 120},
        {"type": "PS5", "bookings": 0, "revenue": 0},
    ]
