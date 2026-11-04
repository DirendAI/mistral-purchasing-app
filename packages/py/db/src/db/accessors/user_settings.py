from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from db.models.user_settings import UserSettings


async def get_settings(session: AsyncSession, user_id: str) -> UserSettings | None:
    return (await session.execute(select(UserSettings).where(UserSettings.user_id == user_id))).scalar_one_or_none()


async def upsert_settings(
    session: AsyncSession,
    user_id: str,
    *,
    location: str,
    latitude: float | None,
    longitude: float | None,
    proximity_km: float,
    currency: str,
) -> UserSettings:
    settings = await get_settings(session, user_id)
    if settings is None:
        settings = UserSettings(user_id=user_id)
        session.add(settings)
    settings.location = location
    settings.latitude = latitude
    settings.longitude = longitude
    settings.proximity_km = proximity_km
    settings.currency = currency
    settings.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(settings)
    return settings
