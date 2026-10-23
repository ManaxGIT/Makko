from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.home import HomeDashboard
from app.services.marketplace import MarketplaceService

from app.schemas.reviews import AccountReputation
from app.services.reviews import ReviewService
from app.schemas.profile import AccountProfile, EditableProfile, UpdateProfileBody
from app.services.profile import ProfileService

router = APIRouter(prefix="/home", tags=["home"])


@router.get("", response_model=HomeDashboard, response_model_by_alias=True)
async def get_home_dashboard(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    nearby_limit: Annotated[int, Query(ge=1, le=10)] = 5,
    latitude: Annotated[float | None, Query(ge=-90, le=90, allow_inf_nan=False)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180, allow_inf_nan=False)] = None,
) -> HomeDashboard:
    return await MarketplaceService(repository).get_home_dashboard(
        user.id, nearby_limit=nearby_limit, latitude=latitude, longitude=longitude
    )


@router.get('/profile', response_model=AccountProfile, response_model_by_alias=True)
async def get_account_profile(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> AccountProfile:
    return await ProfileService(repository).get(user.id)


@router.get('/profile/reviews', response_model=AccountReputation, response_model_by_alias=True)
async def get_received_reviews(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AccountReputation:
    return await ReviewService(repository).received(user.id, limit=limit, offset=offset)


@router.patch('/profile', response_model=EditableProfile, response_model_by_alias=True)
async def update_account_profile(
    body: UpdateProfileBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> EditableProfile:
    return await ProfileService(repository).update(body, user.access_token)
