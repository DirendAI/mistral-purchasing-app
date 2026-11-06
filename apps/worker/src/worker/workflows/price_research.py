"""Price research for one tracked product.

Triggered manually from the app (``trigger=manual``) or by a per-product schedule
(``trigger=schedule``). The run loads the product and the user's location settings, identifies
the product from its photo when one was uploaded, runs the managed price-researcher agent
(``apps/agent``, deployed once as ``agent-<app>``) to find current offers near the user, parses
them into structured findings, and stores the run and its findings in Postgres. Every database
and model call happens inside an activity; the entrypoint only sequences them.
"""

from datetime import timedelta
from typing import Any

import mistralai.workflows as workflows
from mistralai.workflows.plugins.mistralai import (
    ChatCompletionRequest,
    SystemMessage,
    UserMessage,
    chat_parse_to_model,
    mistralai_chat_complete,
)
from pydantic import BaseModel, Field

VISION_MODEL = "mistral-small-latest"
PARSE_MODEL = "mistral-large-latest"

# The managed agent the app's agent module (apps/agent) is registered under at deploy time.
# Must equal agent-<app name in mistral.json>; kept a constant because the workflow module
# is imported inside the Temporal sandbox, which forbids file I/O at import time.
RESEARCH_AGENT_NAME = "agent-mistral-purchasing-app"


class PriceResearchInput(BaseModel):
    product_id: str
    user_id: str
    trigger: str = "manual"


class Finding(BaseModel):
    store_name: str
    product_url: str | None = None
    title: str | None = None
    price: float | None = None
    original_price: float | None = None
    currency: str | None = None
    in_stock: bool | None = None
    distance_km: float | None = None
    notes: str | None = None


class ResearchOutcome(BaseModel):
    summary: str
    findings: list[Finding] = Field(default_factory=list)


class PriceResearchResult(BaseModel):
    run_id: str
    status: str
    summary: str | None = None
    best_price: float | None = None
    best_store: str | None = None
    target_met: bool | None = None
    findings: list[Finding] = Field(default_factory=list)


@workflows.activity(start_to_close_timeout=timedelta(minutes=2))
async def load_product_context(product_id: str, user_id: str) -> dict[str, Any]:
    import uuid

    from db.accessors import products as product_accessors
    from db.accessors import user_settings as settings_accessors
    from db.engine import get_session_maker

    async with get_session_maker()() as session:
        product = await product_accessors.get_product(session, user_id, uuid.UUID(product_id))
        if product is None:
            raise ValueError(f"product {product_id} does not exist for this user")
        settings = await settings_accessors.get_settings(session, user_id)
    return {
        "name": product.name,
        "has_image": product.image is not None,
        "image_url": product.image_url,
        "source_url": product.source_url,
        "product_url": product.product_url,
        "target_price": float(product.target_price) if product.target_price is not None else None,
        "currency": product.currency,
        "ai_context": product.ai_context,
        "location": settings.location if settings is not None else "",
        "latitude": settings.latitude if settings is not None else None,
        "longitude": settings.longitude if settings is not None else None,
        "proximity_km": settings.proximity_km if settings is not None else 10.0,
        "default_currency": settings.currency if settings is not None else "EUR",
    }


@workflows.activity(start_to_close_timeout=timedelta(minutes=1), retry_policy_max_attempts=3)
async def create_run(run_id: str, execution_id: str | None, product_id: str, user_id: str, trigger: str) -> None:
    import uuid

    from db.accessors import research_runs as run_accessors
    from db.engine import get_session_maker

    async with get_session_maker()() as session:
        await run_accessors.create_run(
            session,
            run_id=uuid.UUID(run_id),
            product_id=uuid.UUID(product_id),
            user_id=user_id,
            trigger=trigger,
            execution_id=execution_id,
        )


@workflows.activity(start_to_close_timeout=timedelta(minutes=10))
async def run_research_agent(task: str) -> str:
    from mistralai.agents import agents

    agent = agents.Agent.load_from(agent_name=RESEARCH_AGENT_NAME)
    result = await agent.run(task)
    return getattr(result, "text", None) or str(result)


@workflows.activity(start_to_close_timeout=timedelta(minutes=3))
async def describe_product_image(product_id: str, user_id: str) -> str:
    import base64
    import uuid

    from db.accessors import products as product_accessors
    from db.engine import get_session_maker

    async with get_session_maker()() as session:
        product = await product_accessors.get_product(session, user_id, uuid.UUID(product_id))
    if product is None or product.image is None:
        return ""
    data_uri = f"data:{product.image_content_type or 'image/jpeg'};base64,{base64.b64encode(product.image).decode()}"
    request = ChatCompletionRequest(
        model=VISION_MODEL,
        messages=[
            SystemMessage(
                content=(
                    "You identify retail products from photos. Answer with only the product "
                    "identification: brand, model, variant, size or capacity when visible. No "
                    "preamble, no advice."
                )
            ),
            UserMessage(
                content=[
                    {"type": "text", "text": "Identify this product."},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ]
            ),
        ],
    )
    response = await mistralai_chat_complete(request)
    content = response.choices[0].message.content if response.choices else None
    return str(content) if content else ""


@workflows.activity(start_to_close_timeout=timedelta(minutes=2))
async def save_results(
    run_id: str,
    product_id: str,
    outcome: dict[str, Any],
    target_price: float | None,
    default_currency: str | None,
    raw_output: str,
) -> dict[str, Any]:
    import uuid
    from decimal import Decimal

    from db.accessors import price_findings as finding_accessors
    from db.accessors import research_runs as run_accessors
    from db.engine import get_session_maker

    rows = [
        {
            "store_name": finding["store_name"],
            "product_url": finding.get("product_url"),
            "title": finding.get("title"),
            "price": Decimal(str(finding["price"])) if finding.get("price") is not None else None,
            "original_price": Decimal(str(finding["original_price"])) if finding.get("original_price") is not None else None,
            "currency": finding.get("currency") or default_currency,
            "in_stock": finding.get("in_stock"),
            "distance_km": finding.get("distance_km"),
            "notes": finding.get("notes"),
        }
        for finding in outcome["findings"]
    ]
    priced = [row for row in rows if row["price"] is not None and row["in_stock"] is not False]
    best = min(priced, key=lambda row: row["price"]) if priced else None
    target_met = target_price is not None and best is not None and float(best["price"]) <= target_price
    async with get_session_maker()() as session:
        await finding_accessors.add_findings(session, run_id=uuid.UUID(run_id), product_id=uuid.UUID(product_id), findings=rows)
        await run_accessors.finish_run(
            session,
            uuid.UUID(run_id),
            status="completed",
            summary=outcome["summary"],
            best_price=best["price"] if best is not None else None,
            best_store=best["store_name"] if best is not None else None,
            target_met=target_met,
            details=raw_output[:8000],
        )
    return {
        "best_price": float(best["price"]) if best is not None else None,
        "best_store": best["store_name"] if best is not None else None,
        "target_met": target_met,
    }


@workflows.activity(start_to_close_timeout=timedelta(minutes=1), retry_policy_max_attempts=3)
async def fail_run(run_id: str, error: str) -> None:
    import uuid

    from db.accessors import research_runs as run_accessors
    from db.engine import get_session_maker

    async with get_session_maker()() as session:
        await run_accessors.finish_run(session, uuid.UUID(run_id), status="failed", error=error[:2000])


def _research_task(context: dict[str, Any]) -> str:
    lines = [
        f"Product to research: {context['name']}",
    ]
    if context.get("ai_context"):
        lines.append(f"Extra context from the user: {context['ai_context']}")
    if context.get("source_url"):
        lines.append(f"Store page where the user saw the product: {context['source_url']}")
    if context.get("product_url"):
        lines.append(f"Product page URL: {context['product_url']}")
    if context.get("image_url"):
        lines.append(f"Photo of the product: {context['image_url']}")
    location = context.get("location") or "the user's location"
    lines.append(f"User's location: {location}")
    if context.get("latitude") is not None and context.get("longitude") is not None:
        lines.append(f"Coordinates: {context['latitude']}, {context['longitude']}")
    lines.append(f"Search stores within {context['proximity_km']} km of that location, online and physical.")
    if context.get("target_price") is not None:
        lines.append(f"Target price: {context['target_price']} {context.get('currency') or context.get('default_currency') or ''}")
    lines.append(
        "Find the current price of this exact product in as many stores as you can, preferring stores "
        "near the location. For each offer report: store name, product page URL, product title, price, "
        "currency, whether it is in stock, approximate distance in km from the location if it is a "
        "physical store, and any relevant note (shipping cost, deal, model mismatch)."
    )
    return "\n".join(lines)


_PARSE_SYSTEM = (
    "You turn a price researcher's notes into structured data. Extract every offer mentioned into the "
    "findings list. For each offer: price is the effective price after discounts/coupons; original_price "
    "is the struck-through list price when one was shown (null otherwise); put promo codes and caveats in "
    "notes. Omit offers without a price. summary is a short paragraph (2-4 sentences) describing the best "
    "current effective price, where, any active discount, and whether it beats the target price if one "
    "was given."
)


@workflows.workflow.define(name="price-research")
class PriceResearchWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, request: PriceResearchInput) -> PriceResearchResult:
        run_id = str(workflows.workflow.uuid4())
        execution_id = workflows.get_execution_id()
        context = await load_product_context(request.product_id, request.user_id)
        await create_run(run_id, execution_id, request.product_id, request.user_id, request.trigger)
        try:
            task = _research_task(context)
            if context["has_image"]:
                identified = await describe_product_image(request.product_id, request.user_id)
                if identified:
                    task = f"Product identified from the uploaded photo: {identified}\n\n{task}"
            raw = await run_research_agent(task)
            outcome = await chat_parse_to_model(
                ResearchOutcome,
                ChatCompletionRequest(
                    model=PARSE_MODEL,
                    messages=[
                        SystemMessage(content=_PARSE_SYSTEM),
                        UserMessage(content=f"Researcher's notes:\n\n{raw}\n\nProduct: {context['name']}"),
                    ],
                ),
            )
            saved = await save_results(
                run_id,
                request.product_id,
                outcome.model_dump(),
                context["target_price"],
                context.get("currency") or context.get("default_currency"),
                raw,
            )
            return PriceResearchResult(
                run_id=run_id,
                status="completed",
                summary=outcome.summary,
                best_price=saved["best_price"],
                best_store=saved["best_store"],
                target_met=saved["target_met"],
                findings=outcome.findings,
            )
        except Exception as error:
            await fail_run(run_id, str(error))
            raise
