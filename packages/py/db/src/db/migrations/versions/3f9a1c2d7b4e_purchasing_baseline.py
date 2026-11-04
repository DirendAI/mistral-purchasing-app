"""purchasing baseline: settings, products, research runs, findings, schedules

Revision ID: 3f9a1c2d7b4e
Revises:
Create Date: 2026-05-12 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3f9a1c2d7b4e"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = ("purchasing",)
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.String(length=128), primary_key=True),
        sa.Column("location", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("proximity_km", sa.Float(), nullable=False, server_default="10.0"),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="EUR"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=True),
        sa.Column("image_content_type", sa.String(length=100), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("product_url", sa.String(length=2048), nullable=True),
        sa.Column("target_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("ai_context", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_products_user_id", "products", ["user_id"])
    op.create_table(
        "research_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("execution_id", sa.String(length=128), nullable=True),
        sa.Column("trigger", sa.String(length=16), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="running"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("best_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("best_store", sa.String(length=200), nullable=True),
        sa.Column("target_met", sa.Boolean(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_research_runs_product_id", "research_runs", ["product_id"])
    op.create_index("ix_research_runs_user_id", "research_runs", ["user_id"])
    op.create_table(
        "price_findings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("store_name", sa.String(length=200), nullable=False),
        sa.Column("product_url", sa.String(length=2048), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("in_stock", sa.Boolean(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("found_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_price_findings_run_id", "price_findings", ["run_id"])
    op.create_index("ix_price_findings_product_id", "price_findings", ["product_id"])
    op.create_table(
        "product_schedules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("product_id", sa.Uuid(), nullable=False, unique=True),
        sa.Column("schedule_id", sa.String(length=128), nullable=False),
        sa.Column("cron_expressions", sa.JSON(), nullable=False),
        sa.Column("interval_seconds", sa.Integer(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_product_schedules_product_id", "product_schedules", ["product_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_product_schedules_product_id", table_name="product_schedules")
    op.drop_table("product_schedules")
    op.drop_index("ix_price_findings_product_id", table_name="price_findings")
    op.drop_index("ix_price_findings_run_id", table_name="price_findings")
    op.drop_table("price_findings")
    op.drop_index("ix_research_runs_user_id", table_name="research_runs")
    op.drop_index("ix_research_runs_product_id", table_name="research_runs")
    op.drop_table("research_runs")
    op.drop_index("ix_products_user_id", table_name="products")
    op.drop_table("products")
    op.drop_table("user_settings")
