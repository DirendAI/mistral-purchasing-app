"""add app_state key/value table

Revision ID: f0a1b2c3d4e5
Revises: c41d8e6f2a97
Create Date: 2026-11-05 09:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f0a1b2c3d4e5"
down_revision: str | Sequence[str] | None = "c41d8e6f2a97"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_state",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("value", sa.String(length=4096), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("app_state")
