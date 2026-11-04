"""add original_price to price_findings (list price before discounts)

Revision ID: c41d8e6f2a97
Revises: b7e2f4a19c3d
Create Date: 2026-05-12 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c41d8e6f2a97"
down_revision: str | Sequence[str] | None = "b7e2f4a19c3d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("price_findings", sa.Column("original_price", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("price_findings", "original_price")
