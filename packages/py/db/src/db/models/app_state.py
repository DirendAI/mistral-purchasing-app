from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AppState(SQLModel, table=True):
    """App-level key/value rows that must survive worker restarts and replicas.

    Example: the remote id of the shared price-research agent, so every run updates
    that agent instead of creating a new one per worker process.
    """

    __tablename__ = "app_state"

    key: str = Field(primary_key=True, max_length=128)
    value: str = Field(max_length=4096)
    updated_at: datetime = Field(default_factory=_utcnow)
