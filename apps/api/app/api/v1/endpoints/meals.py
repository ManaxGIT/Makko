from typing import Annotated

import httpx
from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.dependencies.auth import get_current_user
from app.models.user import CurrentUser
from app.schemas.meals import MealPreferences, MealSuggestions
from app.services.meals import MealService

router = APIRouter(prefix='/meals', tags=['meals'])


@router.post('/suggestions', response_model=MealSuggestions, response_model_by_alias=True)
async def suggest_meals(
    body: MealPreferences,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> MealSuggestions:
    async with httpx.AsyncClient() as client:
        return await MealService(settings, client).suggest(body)
