import uuid

from db import engine as db_engine
from db.accessors import product_schedules as schedule_accessors
from env.workflows import env as workflows_env
from fastapi import APIRouter, HTTPException, Response, status
from mistralai.client.errors import MistralError
from mistralai_capabilities.workflows.client import (
    get_client,
    pause_schedule_if_present,
    resume_schedule_if_paused,
    upsert_schedule,
)

from ..._auth import CurrentUser
from ..._research import WORKFLOW_NAME, schedule_id_for
from ..._schemas import ScheduleIn, ScheduleOut, get_owned_product, schedule_out

router = APIRouter()

_DISABLED_NOTE = "disabled from the app"
_ENABLED_NOTE = "enabled from the app"


def _validate_timing(body: ScheduleIn) -> None:
    if bool(body.cron_expressions) == bool(body.interval_seconds):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Provide exactly one of cron_expressions or interval_seconds.",
        )
    for expression in body.cron_expressions or []:
        if len(expression.split()) != 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Not a 5-field cron expression: {expression!r}.",
            )


@router.get("", operation_id="get_product_schedule", response_model=ScheduleOut, summary="The product's research schedule")
async def get_product_schedule(product_id: uuid.UUID, user: CurrentUser) -> ScheduleOut:
    async with db_engine.get_session_maker()() as session:
        await get_owned_product(session, user, product_id)
        row = await schedule_accessors.get_schedule(session, product_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This product has no schedule.")
    return schedule_out(row)


@router.put("", operation_id="put_product_schedule", response_model=ScheduleOut, summary="Set or change the product's research schedule")
async def put_product_schedule(product_id: uuid.UUID, body: ScheduleIn, user: CurrentUser) -> ScheduleOut:
    _validate_timing(body)
    async with db_engine.get_session_maker()() as session:
        product = await get_owned_product(session, user, product_id)
    schedule_id = schedule_id_for(product.id)
    if body.enabled:
        await upsert_schedule(
            schedule_id=schedule_id,
            workflow_identifier=WORKFLOW_NAME,
            input={"product_id": str(product.id), "user_id": user, "trigger": "schedule"},
            cron_expressions=body.cron_expressions,
            interval_seconds=body.interval_seconds,
            deployment_name=workflows_env.deployment_name,
        )
        await resume_schedule_if_paused(schedule_id=schedule_id, note=_ENABLED_NOTE)
    else:
        await pause_schedule_if_present(schedule_id=schedule_id, note=_DISABLED_NOTE)
    async with db_engine.get_session_maker()() as session:
        row = await schedule_accessors.upsert_schedule(
            session,
            product_id=product.id,
            schedule_id=schedule_id,
            cron_expressions=body.cron_expressions or [],
            interval_seconds=body.interval_seconds,
            enabled=body.enabled,
        )
    return schedule_out(row)


@router.delete("", operation_id="delete_product_schedule", status_code=status.HTTP_204_NO_CONTENT, summary="Remove the product's research schedule")
async def delete_product_schedule(product_id: uuid.UUID, user: CurrentUser) -> Response:
    async with db_engine.get_session_maker()() as session:
        await get_owned_product(session, user, product_id)
        row = await schedule_accessors.get_schedule(session, product_id)
        if row is not None:
            try:
                await (await get_client()).workflows.schedules.unschedule_workflow_async(schedule_id=row.schedule_id)
            except MistralError as error:
                if getattr(error, "status_code", None) != 404:
                    raise
            await schedule_accessors.delete_schedule(session, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
