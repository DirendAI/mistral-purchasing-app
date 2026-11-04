from decimal import Decimal

from db import engine as db_engine
from db.accessors import products as product_accessors
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from .._auth import CurrentUser
from .._research import start_research
from .._schemas import ProductOut, product_out

router = APIRouter()

MAX_IMAGE_BYTES = 10 * 1024 * 1024


@router.get("", operation_id="list_products", response_model=list[ProductOut], summary="The caller's tracked products with their latest research")
async def list_products(user: CurrentUser) -> list[ProductOut]:
    async with db_engine.get_session_maker()() as session:
        products = await product_accessors.list_products(session, user)
        return [await product_out(session, product) for product in products]


@router.post(
    "",
    operation_id="create_product",
    response_model=ProductOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a product to track, optionally starting a first research run",
)
async def create_product(
    user: CurrentUser,
    name: str = Form(min_length=1, max_length=300),
    image: UploadFile | None = File(default=None),
    image_url: str | None = Form(default=None, max_length=2048),
    source_url: str | None = Form(default=None, max_length=2048),
    product_url: str | None = Form(default=None, max_length=2048),
    target_price: float | None = Form(default=None, ge=0),
    currency: str | None = Form(default=None, max_length=8),
    ai_context: str | None = Form(default=None),
    research_now: bool = Form(default=False),
) -> ProductOut:
    image_bytes: bytes | None = None
    image_content_type: str | None = None
    if image is not None:
        if image.content_type is not None and not image.content_type.startswith("image/"):
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="The product photo must be an image.")
        image_bytes = await image.read()
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="The product photo must be at most 10 MB.")
        image_content_type = image.content_type
    async with db_engine.get_session_maker()() as session:
        product = await product_accessors.create_product(
            session,
            user,
            name=name,
            image=image_bytes,
            image_content_type=image_content_type,
            image_url=image_url,
            source_url=source_url,
            product_url=product_url,
            target_price=Decimal(str(target_price)) if target_price is not None else None,
            currency=currency,
            ai_context=ai_context,
        )
        out = await product_out(session, product)
    if research_now:
        await start_research(product.id, user)
    return out
