import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from db.models.research_runs import ResearchRun


async def create_run(
    session: AsyncSession,
    *,
    run_id: uuid.UUID,
    product_id: uuid.UUID,
    user_id: str,
    trigger: str,
    execution_id: str | None = None,
) -> ResearchRun:
    run = ResearchRun(
        id=run_id,
        product_id=product_id,
        user_id=user_id,
        trigger=trigger,
        execution_id=execution_id,
        status="running",
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return run


async def finish_run(
    session: AsyncSession,
    run_id: uuid.UUID,
    *,
    status: str,
    summary: str | None = None,
    best_price: Decimal | None = None,
    best_store: str | None = None,
    target_met: bool | None = None,
    error: str | None = None,
) -> ResearchRun | None:
    statement = select(ResearchRun).where(ResearchRun.id == run_id)
    run = (await session.execute(statement)).scalar_one_or_none()
    if run is None:
        return None
    run.status = status
    run.summary = summary
    run.best_price = best_price
    run.best_store = best_store
    run.target_met = target_met
    run.error = error
    run.finished_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(run)
    return run


async def list_runs(session: AsyncSession, product_id: uuid.UUID, limit: int = 20) -> list[ResearchRun]:
    statement = (
        select(ResearchRun)
        .where(ResearchRun.product_id == product_id)
        .order_by(ResearchRun.started_at.desc())
        .limit(limit)
    )
    return list((await session.execute(statement)).scalars().all())


async def get_run(session: AsyncSession, run_id: uuid.UUID) -> ResearchRun | None:
    statement = select(ResearchRun).where(ResearchRun.id == run_id)
    return (await session.execute(statement)).scalar_one_or_none()
