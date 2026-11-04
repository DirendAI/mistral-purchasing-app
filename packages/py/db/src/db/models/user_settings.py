from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserSettings(SQLModel, table=True):
    """One row per user: where price research should look, and how far.

    ``user_id`` is the caller principal id the Apps gateway resolves (see
    ``/v1/whoami``), so rows are scoped to the signed-in person.
    """

    __tablename__ = "user_settings"

    user_id: str = Field(primary_key=True, max_length=128)
    location: str = Field(default="", max_length=512)
    latitude: float | None = Field(default=None)
    longitude: float | None = Field(default=None)
    proximity_km: float = Field(default=10.0)
    currency: str = Field(default="EUR", max_length=8)
    updated_at: datetime = Field(default_factory=_utcnow)
