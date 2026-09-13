from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.explore import ExploreRequest
from app.services.marketplace import MarketplaceService

router = APIRouter(prefix="/explore", tags=["explore"])


@router.get("", response_model=list[ExploreRequest], response_model_by_alias=True)
async def list_explore_requests(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    query: Annotated[str | None, Query(max_length=120)] = None,
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    radius_meters: Annotated[int | None, Query(ge=100, le=50_000)] = 3_000,
) -> list[ExploreRequest]:
    return await MarketplaceService(repository).list_explore_requests(
        user.id, query=query, latitude=latitude, longitude=longitude,
        limit=limit, radius_meters=radius_meters,
    )


@router.get("/{request_id}", response_model=ExploreRequest, response_model_by_alias=True)
async def get_explore_request(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
) -> ExploreRequest:
    return await MarketplaceService(repository).get_explore_request(
        request_id, user.id, latitude=latitude, longitude=longitude,
    )
