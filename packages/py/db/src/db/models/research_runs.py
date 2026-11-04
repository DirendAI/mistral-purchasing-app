import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ResearchRun(SQLModel, table=True):
    """One price-research execution for a product, manual or scheduled.

    ``execution_id`` is the Mistral Workflows execution id when the run came
    from a workflow (manual trigger or schedule); the worker fills it in.
    """

    __tablename__ = "research_runs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    product_id: uuid.UUID = Field(index=True)
    user_id: str = Field(index=True, max_length=128)
    execution_id: str | None = Field(default=None, max_length=128)
    trigger: str = Field(default="manual", max_length=16)
    status: str = Field(default="running", max_length=16)
    summary: str | None = Field(default=None)
    best_price: Decimal | None = Field(default=None, sa_column=Column(Numeric(12, 2)))
    best_store: str | None = Field(default=None, max_length=200)
    target_met: bool | None = Field(default=None)
    error: str | None = Field(default=None)
    started_at: datetime = Field(default_factory=_utcnow)
    finished_at: datetime | None = Field(default=None)
