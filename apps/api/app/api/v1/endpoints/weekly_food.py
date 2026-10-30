from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.weekly_food import RegisterWeeklyFoodBody, WeeklyFoodActionBody, WeeklyFoodWeek, WeeklyFoodOrder, WeeklyFoodDetail, AvailableWeeklyFood
from app.services.weekly_food import WeeklyFoodService

router = APIRouter(prefix='/weekly-food', tags=['weekly-food'])
User = Annotated[CurrentUser, Depends(get_current_user)]
Repository = Annotated[SupabaseRepository, Depends(get_repository)]


@router.get('/weeks', response_model=list[WeeklyFoodWeek], response_model_by_alias=True)
async def weeks(user: User, repository: Repository) -> list[dict]:
    return await WeeklyFoodService(repository).weeks()


@router.post('/orders', status_code=201)
async def register(body: RegisterWeeklyFoodBody, user: User, repository: Repository) -> dict:
    return await WeeklyFoodService(repository).register(body, user.access_token)


@router.get('/orders', response_model=list[WeeklyFoodOrder], response_model_by_alias=True)
async def my_orders(user: User, repository: Repository,
    role: Literal['customer', 'shopper'] = 'customer',
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict]:
    return await WeeklyFoodService(repository).list(user.id, role, limit, offset)


@router.get('/available', response_model=list[AvailableWeeklyFood], response_model_by_alias=True)
async def available(user: User, repository: Repository,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict]:
    return await WeeklyFoodService(repository).available(user.access_token, limit, offset)


@router.get('/orders/{order_id}', response_model=WeeklyFoodDetail, response_model_by_alias=True)
async def detail(order_id: UUID, user: User, repository: Repository) -> dict:
    return await WeeklyFoodService(repository).detail(order_id, user.id)


@router.post('/orders/{order_id}/{action}')
async def act(order_id: UUID, action: Literal['cancel', 'accept', 'release', 'deliver', 'receive'],
    body: WeeklyFoodActionBody, user: User, repository: Repository,
) -> dict:
    return await WeeklyFoodService(repository).act(order_id, action, body, user.access_token)
