import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProductSchedule(SQLModel, table=True):
    """The recurring price research a user configured for one product.

    Exactly one of ``cron_expressions`` (5-field UTC cron) or
    ``interval_seconds`` carries the timing; ``schedule_id`` is the id of the
    Mistral Workflows schedule that fires the ``price-research`` workflow with
    this product as input, and ``enabled`` mirrors whether that schedule is
    active or paused.
    """

    __tablename__ = "product_schedules"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    product_id: uuid.UUID = Field(index=True, unique=True)
    schedule_id: str = Field(max_length=128)
    cron_expressions: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    interval_seconds: int | None = Field(default=None)
    enabled: bool = Field(default=True)
    updated_at: datetime = Field(default_factory=_utcnow)
