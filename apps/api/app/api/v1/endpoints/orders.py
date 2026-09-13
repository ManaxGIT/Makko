from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.orders import OrderActionResult, OrderSummary, TransitionOrderBody
from app.services.marketplace import MarketplaceService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderSummary], response_model_by_alias=True)
async def list_orders(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[OrderSummary]:
    return await MarketplaceService(repository).list_orders(user.id, limit=limit)


@router.post("/{request_id}/accept", response_model=OrderActionResult, response_model_by_alias=True)
async def accept_order(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await MarketplaceService(repository).accept_request(request_id, user.access_token)


@router.post("/{request_id}/publish", response_model=OrderActionResult, response_model_by_alias=True)
async def publish_order(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await MarketplaceService(repository).publish_request(request_id, user.access_token)


@router.patch("/{request_id}/status", response_model=OrderActionResult, response_model_by_alias=True)
async def transition_order(
    request_id: UUID,
    body: TransitionOrderBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await MarketplaceService(repository).transition_request(
        request_id, body.status, user.access_token
    )
