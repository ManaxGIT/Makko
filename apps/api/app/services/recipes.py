from uuid import UUID

from app.repositories.supabase import SupabaseRepository
from app.schemas.recipes import RecipeSnapshot


class RecipeService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def get(self, request_id: UUID, user_id: UUID) -> RecipeSnapshot:
        # Secret-key reads bypass RLS; always scope to the authenticated owner here too.
        row = await self.repository.select_one('order_recipes', params={
            'select': 'snapshot', 'request_id': f'eq.{request_id}', 'customer_id': f'eq.{user_id}',
        })
        if not row:
            raise LookupError('Recipe not found')
        return RecipeSnapshot.model_validate(row['snapshot'])

    async def ids(self, request_ids: list[str], user_id: UUID) -> set[str]:
        if not request_ids:
            return set()
        rows = await self.repository.select('order_recipes', params={
            'select': 'request_id', 'customer_id': f'eq.{user_id}',
            'request_id': f"in.({','.join(request_ids)})", 'limit': '100',
        })
        return {row['request_id'] for row in rows}
