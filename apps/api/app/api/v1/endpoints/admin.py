from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.admin import get_current_admin
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.admin import AdminOrderDetail, AdminOrderList, AdminSession, OrderType, PublishWeekBody
from app.services.admin import AdminService, authorized_rpc

router = APIRouter(prefix='/admin', tags=['admin'])
Admin = Annotated[CurrentUser, Depends(get_current_admin)]
Repository = Annotated[SupabaseRepository, Depends(get_repository)]


@router.get('/me', response_model=AdminSession, response_model_by_alias=True)
async def me(user: Admin) -> AdminSession:
    return AdminSession(user_id=user.id)


@router.get('/orders', response_model=AdminOrderList, response_model_by_alias=True)
async def list_orders(
    user: Admin, repository: Repository,
    order_type: Literal['all', 'weekly', 'errand'] = 'all',
    status_filter: Literal['all', 'draft', 'registered', 'open', 'accepted', 'shopping', 'delivering', 'delivered', 'completed', 'cancelled', 'disputed'] = 'all',
    search_query: Annotated[str, Query(max_length=120)] = '',
    work_queue: Literal['all', 'handover', 'wages'] = 'all',
    page_offset: Annotated[int, Query(ge=0)] = 0,
    page_limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> AdminOrderList:
    return await AdminService(repository).list(user.access_token, order_type=order_type,
        status_filter=status_filter, search_query=search_query.strip(), work_queue=work_queue,
        page_offset=page_offset, page_limit=page_limit)


@router.get('/orders/{order_type}/{order_id}', response_model=AdminOrderDetail, response_model_by_alias=True)
async def detail(order_type: OrderType, order_id: UUID, user: Admin, repository: Repository) -> AdminOrderDetail:
    return await AdminService(repository).detail(order_id, order_type, user.access_token)


@router.post('/weekly-orders/{order_id}/{action}')
async def act(order_id: UUID, action: Literal['handover', 'pay-wage'], user: Admin, repository: Repository) -> dict:
    result = await authorized_rpc(repository, 'act_weekly_food_order', {
        'target_order_id': str(order_id), 'action_name': action.replace('-', '_'),
    }, user.access_token)
    return {'id': str(order_id), 'status': result}


@router.post('/weekly-weeks', status_code=201)
async def publish_week(body: PublishWeekBody, user: Admin, repository: Repository) -> dict:
    return await AdminService(repository).publish_week(body, user.access_token)
