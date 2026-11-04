import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from db.models.price_findings import PriceFinding
from db.models.product_schedules import ProductSchedule
from db.models.products import Product
from db.models.research_runs import ResearchRun


async def create_product(
    session: AsyncSession,
    user_id: str,
    *,
    name: str,
    image: bytes | None = None,
    image_content_type: str | None = None,
    image_url: str | None = None,
    source_url: str | None = None,
    product_url: str | None = None,
    target_price: Decimal | None = None,
    currency: str | None = None,
    ai_context: str | None = None,
) -> Product:
    product = Product(
        user_id=user_id,
        name=name,
        image=image,
        image_content_type=image_content_type,
        image_url=image_url,
        source_url=source_url,
        product_url=product_url,
        target_price=target_price,
        currency=currency,
        ai_context=ai_context,
    )
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return product


async def get_product(session: AsyncSession, user_id: str, product_id: uuid.UUID) -> Product | None:
    statement = select(Product).where(Product.id == product_id, Product.user_id == user_id)
    return (await session.execute(statement)).scalar_one_or_none()


async def list_products(session: AsyncSession, user_id: str) -> list[Product]:
    statement = select(Product).where(Product.user_id == user_id).order_by(Product.created_at.desc())
    return list((await session.execute(statement)).scalars().all())


async def update_product(session: AsyncSession, product: Product, fields: dict) -> Product:
    for name, value in fields.items():
        setattr(product, name, value)
    product.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(product)
    return product


async def delete_product(session: AsyncSession, product: Product) -> None:
    await session.delete(product)
    await session.commit()


async def latest_run(session: AsyncSession, product_id: uuid.UUID) -> ResearchRun | None:
    statement = (
        select(ResearchRun).where(ResearchRun.product_id == product_id).order_by(ResearchRun.started_at.desc()).limit(1)
    )
    return (await session.execute(statement)).scalar_one_or_none()


async def get_schedule(session: AsyncSession, product_id: uuid.UUID) -> ProductSchedule | None:
    statement = select(ProductSchedule).where(ProductSchedule.product_id == product_id)
    return (await session.execute(statement)).scalar_one_or_none()


async def count_findings(session: AsyncSession, run_id: uuid.UUID) -> int:
    statement = select(PriceFinding).where(PriceFinding.run_id == run_id)
    return len((await session.execute(statement)).scalars().all())
