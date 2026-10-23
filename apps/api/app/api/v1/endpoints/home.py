from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.home import HomeDashboard
from app.services.marketplace import MarketplaceService

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
