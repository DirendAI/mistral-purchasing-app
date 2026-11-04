"""Starting price-research runs: the API only asks the platform to execute the worker's workflow."""

import asyncio
import uuid

import mistralai.workflows as workflows
from fastapi import HTTPException, status
from mistralai.client.errors import MistralError
from mistralai_capabilities.workflows.client import start_workflow
from worker.workflows.price_research import PriceResearchInput, PriceResearchWorkflow

WORKFLOW_NAME = workflows.get_workflow_definition(PriceResearchWorkflow).name

# The worker registers its workflows a few seconds after it starts; until then the platform answers
# WF_1100 "Workflow not found". Retry briefly so a trigger right after `mistral apps dev` still works.
_REGISTRATION_ATTEMPTS = 3
_REGISTRATION_DELAY_S = 3.0
_sleep = asyncio.sleep


async def start_research(product_id: uuid.UUID, user_id: str, trigger: str = "manual") -> str:
    """Start one ``price-research`` execution for the product; returns its execution id."""
    last_error: MistralError | None = None
    for _ in range(_REGISTRATION_ATTEMPTS):
        try:
            run = await start_workflow(
                PriceResearchWorkflow,
                PriceResearchInput(product_id=str(product_id), user_id=user_id, trigger=trigger),
                wait_for_result=False,
            )
            return run.execution_id
        except MistralError as error:
            if getattr(error, "status_code", None) != 404 or "WF_1100" not in str(getattr(error, "body", "") or ""):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Could not start the price-research workflow: {error}",
                ) from error
            last_error = error
            await _sleep(_REGISTRATION_DELAY_S)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "The price-research workflow is not registered yet. Make sure the worker is running "
            "(mistral apps dev; its logs should show 'workflow discovery complete' with "
            "'price-research') and MISTRAL_API_KEY is set in .env, then try again."
        ),
    ) from last_error


def schedule_id_for(product_id: uuid.UUID) -> str:
    return f"purchasing-product-{product_id}"
