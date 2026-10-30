from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException

from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.weekly_food import RegisterWeeklyFoodBody, WeeklyFoodActionBody
from app.services.admin import authorized_rpc


class WeeklyFoodService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def weeks(self) -> list[dict]:
        return await self.repository.select('weekly_food_weeks', params={
            'select': 'id,week_start,delivery_deadline,menu,published_at',
            'delivery_deadline': f'gt.{datetime.now(timezone.utc).isoformat()}',
            'order': 'week_start.asc', 'limit': '52',
        })

    async def register(self, body: RegisterWeeklyFoodBody, token: str) -> dict:
        result = await authorized_rpc(self.repository, 'register_weekly_food_order', {
            'target_week_id': str(body.week_id), 'address_id': str(body.address_id),
            'people_count': body.people, 'meal_option': body.meals, 'idempotency_key': str(body.submission_key),
        }, token)
        return {'id': result}

    async def list(self, user_id: UUID, role: str, limit: int, offset: int) -> list[dict]:
        return await self.repository.select('weekly_food_orders', params={
            'select': '*', 'customer_id' if role == 'customer' else 'shopper_id': f'eq.{user_id}',
            'order': 'created_at.desc,id.desc', 'limit': str(limit), 'offset': str(offset),
        })

    async def available(self, token: str, limit: int, offset: int) -> list[dict]:
        return await authorized_rpc(self.repository, 'list_available_weekly_food_orders', {
            'page_limit': limit, 'page_offset': offset,
        }, token)

    async def detail(self, order_id: UUID, user_id: UUID) -> dict:
        order = await self.repository.select_one('weekly_food_orders', params={
            'select': '*', 'id': f'eq.{order_id}',
            'or': f'(customer_id.eq.{user_id},shopper_id.eq.{user_id})',
        })
        if order is None:
            raise HTTPException(404, 'Không tìm thấy gói nguyên liệu của bạn.')
        week = await self.repository.select_one('weekly_food_weeks', params={
            'select': 'id,week_start,menu,delivery_deadline,published_at', 'id': f'eq.{order["week_id"]}',
        })
        return {**order, 'week': week}

    async def act(self, order_id: UUID, action: str, body: WeeklyFoodActionBody, token: str) -> dict:
        result = await authorized_rpc(self.repository, 'act_weekly_food_order', {
            'target_order_id': str(order_id), 'action_name': action, 'photo_paths': body.photo_paths,
        }, token)
        return {'id': str(order_id), 'status': result}
