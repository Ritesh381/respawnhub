"""seed the cafe floor

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-16
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

STATIONS = [
    *[
        (f"PC-0{n}", f"Arena Rig {n}", "PC", 120, "RTX 4060, 165Hz, mechanical keyboard")
        for n in range(1, 7)
    ],
    ("PC-07", "Pro Rig 7", "PC", 180, "RTX 4080, 240Hz, streaming setup"),
    ("PC-08", "Pro Rig 8", "PC", 180, "RTX 4080, 240Hz, streaming setup"),
    ("PS5-01", "Couch Bay 1", "PS5", 150, "PS5, 55 inch 4K TV, two controllers"),
    ("PS5-02", "Couch Bay 2", "PS5", 150, "PS5, 55 inch 4K TV, two controllers"),
    ("PS5-03", "Couch Bay 3", "PS5", 150, "PS5, 65 inch 4K TV, four controllers"),
    ("XBOX-01", "Xbox Bay 1", "XBOX", 140, "Series X, Game Pass, 55 inch TV"),
    ("XBOX-02", "Xbox Bay 2", "XBOX", 140, "Series X, Game Pass, 55 inch TV"),
    ("VR-01", "VR Pod", "VR", 250, "Meta Quest 3, 3x3 m play area"),
]


def upgrade() -> None:
    stations = sa.table(
        "stations",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("type", sa.String),
        sa.column("hourly_rate", sa.Integer),
        sa.column("specs", sa.Text),
    )
    op.bulk_insert(
        stations,
        [
            {"code": code, "name": name, "type": kind, "hourly_rate": rate, "specs": specs}
            for code, name, kind, rate, specs in STATIONS
        ],
    )


def downgrade() -> None:
    codes = ", ".join(f"'{code}'" for code, *_ in STATIONS)
    op.execute(f"DELETE FROM stations WHERE code IN ({codes})")
