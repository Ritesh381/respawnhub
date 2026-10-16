"""create stations and bookings

Revision ID: 0001
Revises:
Create Date: 2026-10-16
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("hourly_rate", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("specs", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("hourly_rate > 0", name="ck_stations_rate_positive"),
    )
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "station_id",
            sa.Integer(),
            sa.ForeignKey("stations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("player_name", sa.String(80), nullable=False),
        sa.Column("player_phone", sa.String(10), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="BOOKED"),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("end_at > start_at", name="ck_bookings_end_after_start"),
    )
    op.create_index("ix_bookings_station_start", "bookings", ["station_id", "start_at"])


def downgrade() -> None:
    op.drop_index("ix_bookings_station_start", table_name="bookings")
    op.drop_table("bookings")
    op.drop_table("stations")
