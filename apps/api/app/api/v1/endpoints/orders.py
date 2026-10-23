from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.services.recipes import RecipeService
from app.schemas.recipes import RecipeSnapshot
from app.schemas.orders import OrderActionResult, OrderDetail, OrderSummary, OrderTracking, TransitionOrderBody
from app.services.chat import ChatService
from app.schemas.chat import ChatConversation, ChatMessage, SendMessageBody
from app.services.marketplace import MarketplaceService
from app.services.create_request import CreateRequestService
from app.schemas.create_request import CreateRequestBody
from app.schemas.edit_request import EditableRequest, EditRequestBody
from app.services.edit_request import EditRequestService

from app.schemas.purchase_evidence import EvidencePhoto, SubmitEvidenceBody, SubmitDeliveryEvidenceBody
from app.services.purchase_evidence import PurchaseEvidenceService

from app.schemas.reviews import OrderReview, OrderReviewContext, SubmitReviewBody
from app.services.reviews import ReviewService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get('/{request_id}/recipe', response_model=RecipeSnapshot, response_model_by_alias=True)
async def get_order_recipe(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> RecipeSnapshot:
    return await RecipeService(repository).get(request_id, user.id)


@router.get("/{request_id}/edit", response_model=EditableRequest, response_model_by_alias=True)
async def get_editable_order(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> EditableRequest:
    return await EditRequestService(repository).get(request_id, user.id)


@router.patch("/{request_id}", response_model=OrderActionResult, response_model_by_alias=True)
async def update_order(
    request_id: UUID,
    body: EditRequestBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await EditRequestService(repository).update(request_id, body, user.access_token)


@router.post("", response_model=OrderActionResult, response_model_by_alias=True, status_code=201)
async def create_and_publish_order(
    body: CreateRequestBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await CreateRequestService(repository).create_and_publish(body, user.access_token)


@router.get("", response_model=list[OrderSummary], response_model_by_alias=True)
async def list_orders(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    scope: Literal["all", "active", "history"] = "all",
) -> list[OrderSummary]:
    return await MarketplaceService(repository).list_orders(user.id, limit=limit, scope=scope)


@router.get("/{request_id}/tracking", response_model=OrderTracking, response_model_by_alias=True)
async def get_order_tracking(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderTracking:
    return await MarketplaceService(repository).get_order_tracking(request_id, user.id)


@router.get("/{request_id}/details", response_model=OrderDetail, response_model_by_alias=True)
async def get_order_details(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
) -> OrderDetail:
    return await MarketplaceService(repository).get_order_detail(
        request_id, user.id, latitude=latitude, longitude=longitude,
    )


@router.post("/{request_id}/accept", response_model=OrderActionResult, response_model_by_alias=True)
async def accept_order(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await MarketplaceService(repository).accept_request(request_id, user.access_token)


@router.post("/{request_id}/release", response_model=OrderActionResult, response_model_by_alias=True)
async def release_order(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await MarketplaceService(repository).release_accepted_request(
        request_id, user.access_token
    )


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




@router.get('/{request_id}/evidence', response_model=list[EvidencePhoto], response_model_by_alias=True)
async def get_purchase_evidence(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> list[EvidencePhoto]:
    return await PurchaseEvidenceService(repository).list(request_id, user.id)


@router.post('/{request_id}/evidence', response_model=OrderActionResult, response_model_by_alias=True)
async def submit_purchase_evidence(
    request_id: UUID,
    body: SubmitEvidenceBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await PurchaseEvidenceService(repository).submit(request_id, body, user.access_token)


@router.post('/{request_id}/delivery-evidence', response_model=OrderActionResult, response_model_by_alias=True)
async def submit_delivery_evidence(
    request_id: UUID,
    body: SubmitDeliveryEvidenceBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderActionResult:
    return await PurchaseEvidenceService(repository).submit_delivery(request_id, body, user.access_token)


@router.get('/{request_id}/chat', response_model=ChatConversation, response_model_by_alias=True)
async def get_order_chat(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    before: Annotated[int | None, Query(ge=1, le=9223372036854775807)] = None,
    after: Annotated[int | None, Query(ge=1, le=9223372036854775807)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ChatConversation:
    if before is not None and after is not None:
        raise HTTPException(422, 'Chỉ dùng một mốc phân trang.')
    return await ChatService(repository).get(request_id, user.id, before=before, after=after, limit=limit)


@router.post('/{request_id}/chat/messages', response_model=ChatMessage, response_model_by_alias=True, status_code=201)
async def send_order_message(
    request_id: UUID,
    body: SendMessageBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> ChatMessage:
    return await ChatService(repository).send(request_id, body, user.access_token)


@router.get('/{request_id}/review', response_model=OrderReviewContext, response_model_by_alias=True)
async def get_order_review(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderReviewContext:
    return await ReviewService(repository).get(request_id, user.id)


@router.post('/{request_id}/review', response_model=OrderReview, response_model_by_alias=True, status_code=201)
async def submit_order_review(
    request_id: UUID,
    body: SubmitReviewBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> OrderReview:
    return await ReviewService(repository).submit(request_id, body, user.access_token)
