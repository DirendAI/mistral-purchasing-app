from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from db.models.app_state import AppState


async def get_value(session: AsyncSession, key: str) -> str | None:
    row = (await session.execute(select(AppState).where(AppState.key == key))).scalar_one_or_none()
    return row.value if row is not None else None


async def set_value(session: AsyncSession, key: str, value: str) -> None:
    row = (await session.execute(select(AppState).where(AppState.key == key))).scalar_one_or_none()
    if row is None:
        row = AppState(key=key, value=value)
        session.add(row)
    row.value = value
    row.updated_at = datetime.now(timezone.utc)
    await session.commit()
