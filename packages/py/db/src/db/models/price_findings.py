import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PriceFinding(SQLModel, table=True):
    """One offer found during a research run: a store, a price, a link."""

    __tablename__ = "price_findings"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    run_id: uuid.UUID = Field(index=True)
    product_id: uuid.UUID = Field(index=True)
    store_name: str = Field(max_length=200)
    product_url: str | None = Field(default=None, max_length=2048)
    title: str | None = Field(default=None, max_length=500)
    price: Decimal | None = Field(default=None, sa_column=Column(Numeric(12, 2)))
    original_price: Decimal | None = Field(default=None, sa_column=Column(Numeric(12, 2)))
    currency: str | None = Field(default=None, max_length=8)
    in_stock: bool | None = Field(default=None)
    distance_km: float | None = Field(default=None)
    notes: str | None = Field(default=None)
    found_at: datetime = Field(default_factory=_utcnow)
