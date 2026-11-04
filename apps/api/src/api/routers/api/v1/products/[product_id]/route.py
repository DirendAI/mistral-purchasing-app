import uuid
from decimal import Decimal

from db import engine as db_engine
from db.accessors import products as product_accessors
from fastapi import APIRouter, Response, status

from ..._auth import CurrentUser
from ..._schemas import ProductOut, ProductPatch, get_owned_product, product_out

router = APIRouter()


@router.get("", operation_id="get_product", response_model=ProductOut, summary="One tracked product with its latest research")
async def get_product(product_id: uuid.UUID, user: CurrentUser) -> ProductOut:
    async with db_engine.get_session_maker()() as session:
        product = await get_owned_product(session, user, product_id)
        return await product_out(session, product)


@router.patch("", operation_id="update_product", response_model=ProductOut, summary="Edit a tracked product")
async def update_product(product_id: uuid.UUID, body: ProductPatch, user: CurrentUser) -> ProductOut:
    fields = body.model_dump(exclude_unset=True)
    if "target_price" in fields and fields["target_price"] is not None:
        fields["target_price"] = Decimal(str(fields["target_price"]))
    if fields.pop("clear_image", False):
        fields["image"] = None
        fields["image_content_type"] = None
    async with db_engine.get_session_maker()() as session:
        product = await get_owned_product(session, user, product_id)
        product = await product_accessors.update_product(session, product, fields)
        return await product_out(session, product)


@router.delete("", operation_id="delete_product", status_code=status.HTTP_204_NO_CONTENT, summary="Stop tracking a product")
async def delete_product(product_id: uuid.UUID, user: CurrentUser) -> Response:
    async with db_engine.get_session_maker()() as session:
        product = await get_owned_product(session, user, product_id)
        await product_accessors.delete_product(session, product)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
