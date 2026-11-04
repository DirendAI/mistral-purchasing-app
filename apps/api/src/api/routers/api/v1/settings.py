from db import engine as db_engine
from db.accessors import user_settings as settings_accessors
from fastapi import APIRouter

from ._auth import CurrentUser
from ._schemas import SettingsIn, SettingsOut

router = APIRouter()


@router.get("", operation_id="get_settings", response_model=SettingsOut, summary="The caller's search settings")
async def get_settings(user: CurrentUser) -> SettingsOut:
    async with db_engine.get_session_maker()() as session:
        settings = await settings_accessors.get_settings(session, user)
    if settings is None:
        return SettingsOut(location="", latitude=None, longitude=None, proximity_km=10.0, currency="EUR")
    return SettingsOut(
        location=settings.location,
        latitude=settings.latitude,
        longitude=settings.longitude,
        proximity_km=settings.proximity_km,
        currency=settings.currency,
        updated_at=settings.updated_at,
    )


@router.put("", operation_id="put_settings", response_model=SettingsOut, summary="Replace the caller's search settings")
async def put_settings(body: SettingsIn, user: CurrentUser) -> SettingsOut:
    async with db_engine.get_session_maker()() as session:
        settings = await settings_accessors.upsert_settings(
            session,
            user,
            location=body.location,
            latitude=body.latitude,
            longitude=body.longitude,
            proximity_km=body.proximity_km,
            currency=body.currency,
        )
    return SettingsOut(
        location=settings.location,
        latitude=settings.latitude,
        longitude=settings.longitude,
        proximity_km=settings.proximity_km,
        currency=settings.currency,
        updated_at=settings.updated_at,
    )
