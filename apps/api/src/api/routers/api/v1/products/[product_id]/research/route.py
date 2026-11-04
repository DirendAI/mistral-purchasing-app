import uuid

from db import engine as db_engine
from db.accessors import research_runs as run_accessors
from fastapi import APIRouter, status

from ...._auth import CurrentUser
from ...._research import start_research
from ...._schemas import ResearchRunOut, ResearchTriggerOut, get_owned_product, run_out

router = APIRouter()


@router.get(
    "",
    operation_id="list_research_runs",
    response_model=list[ResearchRunOut],
    summary="The product's research runs, newest first, each with its findings",
)
async def list_research_runs(product_id: uuid.UUID, user: CurrentUser, limit: int = 20) -> list[ResearchRunOut]:
    async with db_engine.get_session_maker()() as session:
        product = await get_owned_product(session, user, product_id)
        runs = await run_accessors.list_runs(session, product.id, limit=limit)
        return [await run_out(session, run) for run in runs]


@router.post(
    "",
    operation_id="trigger_research",
    response_model=ResearchTriggerOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start a price research run for the product right now",
)
async def trigger_research(product_id: uuid.UUID, user: CurrentUser) -> ResearchTriggerOut:
    async with db_engine.get_session_maker()() as session:
        product = await get_owned_product(session, user, product_id)
    execution_id = await start_research(product.id, user)
    return ResearchTriggerOut(execution_id=execution_id)
