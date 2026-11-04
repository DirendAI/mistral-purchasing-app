"""Starting price-research runs: the API only asks the platform to execute the worker's workflow."""

import uuid

import mistralai.workflows as workflows
from mistralai_capabilities.workflows.client import start_workflow
from worker.workflows.price_research import PriceResearchInput, PriceResearchWorkflow

WORKFLOW_NAME = workflows.get_workflow_definition(PriceResearchWorkflow).name


async def start_research(product_id: uuid.UUID, user_id: str, trigger: str = "manual") -> str:
    """Start one ``price-research`` execution for the product; returns its execution id."""
    run = await start_workflow(
        PriceResearchWorkflow,
        PriceResearchInput(product_id=str(product_id), user_id=user_id, trigger=trigger),
        wait_for_result=False,
    )
    return run.execution_id


def schedule_id_for(product_id: uuid.UUID) -> str:
    return f"purchasing-product-{product_id}"
