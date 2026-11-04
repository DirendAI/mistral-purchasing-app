import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, LargeBinary, Numeric
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Product(SQLModel, table=True):
    """A product the user wants to buy.

    The product can be described by an uploaded photo (``image``), a photo URL
    (``image_url``), the store page where the user saw it (``source_url``), a
    product URL entered by hand (``product_url``), free-form AI context, and an
    optional target price used to flag a good deal.
    """

    __tablename__ = "products"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: str = Field(index=True, max_length=128)
    name: str = Field(max_length=300)
    image: bytes | None = Field(default=None, sa_column=Column(LargeBinary))
    image_content_type: str | None = Field(default=None, max_length=100)
    image_url: str | None = Field(default=None, max_length=2048)
    source_url: str | None = Field(default=None, max_length=2048)
    product_url: str | None = Field(default=None, max_length=2048)
    target_price: Decimal | None = Field(default=None, sa_column=Column(Numeric(12, 2)))
    currency: str | None = Field(default=None, max_length=8)
    ai_context: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
