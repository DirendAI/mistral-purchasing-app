"""Request/response models shared by the v1 routes, plus row-to-schema conversion helpers."""

import uuid
from datetime import datetime

from db.accessors import price_findings as finding_accessors
from db.accessors import product_schedules as schedule_accessors
from db.accessors import products as product_accessors
from db.models.price_findings import PriceFinding
from db.models.product_schedules import ProductSchedule
from db.models.products import Product
from db.models.research_runs import ResearchRun
from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession


def _price(value) -> float | None:
    return float(value) if value is not None else None


class FindingOut(BaseModel):
    id: uuid.UUID
    store_name: str
    product_url: str | None = None
    title: str | None = None
    price: float | None = None
    currency: str | None = None
    in_stock: bool | None = None
    distance_km: float | None = None
    notes: str | None = None
    found_at: datetime


class ResearchRunOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    execution_id: str | None = None
    trigger: str
    status: str
    summary: str | None = None
    best_price: float | None = None
    best_store: str | None = None
    target_met: bool | None = None
    error: str | None = None
    started_at: datetime
    finished_at: datetime | None = None
    findings: list[FindingOut] = Field(default_factory=list)


class ScheduleOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    schedule_id: str
    cron_expressions: list[str]
    interval_seconds: int | None = None
    enabled: bool
    updated_at: datetime


class ProductOut(BaseModel):
    id: uuid.UUID
    name: str
    has_image: bool
    image_content_type: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    product_url: str | None = None
    target_price: float | None = None
    currency: str | None = None
    ai_context: str | None = None
    created_at: datetime
    updated_at: datetime
    latest_run: ResearchRunOut | None = None
    schedule: ScheduleOut | None = None


class SettingsOut(BaseModel):
    location: str
    latitude: float | None = None
    longitude: float | None = None
    proximity_km: float
    currency: str
    updated_at: datetime | None = None


class SettingsIn(BaseModel):
    location: str = Field(default="", max_length=512)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    proximity_km: float = Field(default=10.0, gt=0, le=1000)
    currency: str = Field(default="EUR", min_length=3, max_length=8)


class ProductPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    image_url: str | None = Field(default=None, max_length=2048)
    source_url: str | None = Field(default=None, max_length=2048)
    product_url: str | None = Field(default=None, max_length=2048)
    target_price: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=8)
    ai_context: str | None = None
    clear_image: bool = False


class ScheduleIn(BaseModel):
    cron_expressions: list[str] | None = None
    interval_seconds: int | None = Field(default=None, ge=60)
    enabled: bool = True


class ResearchTriggerOut(BaseModel):
    execution_id: str


def finding_out(row: PriceFinding) -> FindingOut:
    return FindingOut(
        id=row.id,
        store_name=row.store_name,
        product_url=row.product_url,
        title=row.title,
        price=_price(row.price),
        currency=row.currency,
        in_stock=row.in_stock,
        distance_km=row.distance_km,
        notes=row.notes,
        found_at=row.found_at,
    )


async def run_out(session: AsyncSession, run: ResearchRun) -> ResearchRunOut:
    findings = await finding_accessors.list_findings_for_run(session, run.id)
    return ResearchRunOut(
        id=run.id,
        product_id=run.product_id,
        execution_id=run.execution_id,
        trigger=run.trigger,
        status=run.status,
        summary=run.summary,
        best_price=_price(run.best_price),
        best_store=run.best_store,
        target_met=run.target_met,
        error=run.error,
        started_at=run.started_at,
        finished_at=run.finished_at,
        findings=[finding_out(f) for f in findings],
    )


def schedule_out(row: ProductSchedule) -> ScheduleOut:
    return ScheduleOut(
        id=row.id,
        product_id=row.product_id,
        schedule_id=row.schedule_id,
        cron_expressions=list(row.cron_expressions),
        interval_seconds=row.interval_seconds,
        enabled=row.enabled,
        updated_at=row.updated_at,
    )


async def product_out(session: AsyncSession, product: Product) -> ProductOut:
    latest = await product_accessors.latest_run(session, product.id)
    schedule = await schedule_accessors.get_schedule(session, product.id)
    return ProductOut(
        id=product.id,
        name=product.name,
        has_image=product.image is not None,
        image_content_type=product.image_content_type,
        image_url=product.image_url,
        source_url=product.source_url,
        product_url=product.product_url,
        target_price=_price(product.target_price),
        currency=product.currency,
        ai_context=product.ai_context,
        created_at=product.created_at,
        updated_at=product.updated_at,
        latest_run=await run_out(session, latest) if latest is not None else None,
        schedule=schedule_out(schedule) if schedule is not None else None,
    )


async def get_owned_product(session: AsyncSession, user_id: str, product_id: uuid.UUID) -> Product:
    product = await product_accessors.get_product(session, user_id, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    return product
