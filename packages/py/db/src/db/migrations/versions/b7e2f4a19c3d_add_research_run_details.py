"""add details to research_runs: raw agent output for debugging empty results

Revision ID: b7e2f4a19c3d
Revises: 3f9a1c2d7b4e
Create Date: 2026-05-12 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7e2f4a19c3d"
down_revision: str | Sequence[str] | None = "3f9a1c2d7b4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("research_runs", sa.Column("details", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("research_runs", "details")
