import uuid
from collections.abc import Iterable

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from db.models.price_findings import PriceFinding


async def add_findings(
    session: AsyncSession,
    *,
    run_id: uuid.UUID,
    product_id: uuid.UUID,
    findings: Iterable[dict],
) -> list[PriceFinding]:
    rows = [PriceFinding(run_id=run_id, product_id=product_id, **finding) for finding in findings]
    session.add_all(rows)
    await session.commit()
    for row in rows:
        await session.refresh(row)
    return rows


async def list_findings_for_run(session: AsyncSession, run_id: uuid.UUID) -> list[PriceFinding]:
    statement = select(PriceFinding).where(PriceFinding.run_id == run_id).order_by(PriceFinding.price.asc())
    return list((await session.execute(statement)).scalars().all())
