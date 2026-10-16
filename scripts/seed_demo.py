"""Fill today's floor with a realistic mix of bookings for a demo.

Usage: python3 scripts/seed_demo.py [base_url]   (default http://localhost:3000)
Only uses the public API, so it works against Compose, kind or EKS.
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
PLAYERS = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Isha", "Vihaan", "Anaya", "Arjun", "Sara"]


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        BASE + path, data=data, method=method, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read() or "null")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or "null")


def main():
    now = datetime.now(timezone.utc)
    slot = now.replace(minute=0 if now.minute < 30 else 30, second=0, microsecond=0)
    _, stations = call("GET", "/api/stations?active=true")
    codes = {s["code"]: s["id"] for s in stations}

    # (station, minutes from the current slot, length in minutes)
    plan = [
        ("PC-01", 0, 120), ("PC-02", 0, 60), ("PC-04", 0, 90), ("PC-07", 0, 180),
        ("PS5-01", 0, 60), ("XBOX-02", 0, 120), ("VR-01", 30, 30), ("PC-03", 30, 60),
        ("PS5-02", 30, 90), ("PC-05", 180, 120), ("PC-08", 240, 60), ("PS5-03", 150, 60),
    ]
    made = 0
    for i, (code, offset, length) in enumerate(plan):
        if code not in codes:
            continue
        start = slot + timedelta(minutes=offset)
        body = {
            "station_id": codes[code],
            "player_name": PLAYERS[i % len(PLAYERS)],
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(minutes=length)).isoformat(),
        }
        status, result = call("POST", "/api/bookings", body)
        made += status == 201
        print(f"{code:8} {status} {result.get('detail', '') if isinstance(result, dict) else ''}")
    print(f"{made} bookings created")


if __name__ == "__main__":
    main()
