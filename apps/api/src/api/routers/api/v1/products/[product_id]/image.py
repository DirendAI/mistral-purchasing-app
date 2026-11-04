import uuid

from db import engine as db_engine
from fastapi import APIRouter, HTTPException, Response, status

from ..._auth import CurrentUser
from ..._schemas import get_owned_product

router = APIRouter()


@router.get("", operation_id="get_product_image", response_class=Response, summary="The uploaded product photo")
async def get_product_image(product_id: uuid.UUID, user: CurrentUser) -> Response:
    async with db_engine.get_session_maker()() as session:
        product = await get_owned_product(session, user, product_id)
    if product.image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This product has no uploaded photo.")
    return Response(content=product.image, media_type=product.image_content_type or "application/octet-stream")
