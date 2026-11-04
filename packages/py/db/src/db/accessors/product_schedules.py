import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from db.models.product_schedules import ProductSchedule


async def get_schedule(session: AsyncSession, product_id: uuid.UUID) -> ProductSchedule | None:
    statement = select(ProductSchedule).where(ProductSchedule.product_id == product_id)
    return (await session.execute(statement)).scalar_one_or_none()


async def upsert_schedule(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    schedule_id: str,
    cron_expressions: list[str],
    interval_seconds: int | None,
    enabled: bool,
) -> ProductSchedule:
    schedule = await get_schedule(session, product_id)
    if schedule is None:
        schedule = ProductSchedule(product_id=product_id, schedule_id=schedule_id)
        session.add(schedule)
    schedule.schedule_id = schedule_id
    schedule.cron_expressions = cron_expressions
    schedule.interval_seconds = interval_seconds
    schedule.enabled = enabled
    schedule.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(schedule)
    return schedule


async def delete_schedule(session: AsyncSession, product_id: uuid.UUID) -> None:
    schedule = await get_schedule(session, product_id)
    if schedule is not None:
        await session.delete(schedule)
        await session.commit()
