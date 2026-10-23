from uuid import UUID

from fastapi import HTTPException

from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.profile import AccountProfile, EditableProfile, UpdateProfileBody


class ProfileService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def get(self, user_id: UUID) -> AccountProfile:
        profile = await self.repository.select_one('profiles', params={
            'select': 'id,display_name,phone,bio,avatar_path,created_at,average_rating,rating_count',
            'id': f'eq.{user_id}', 'account_status': 'eq.active',
        })
        if profile is None:
            raise HTTPException(404, 'Không tìm thấy hồ sơ.')
        customer_count = await self.repository.count('shopping_requests', params={
            'customer_id': f'eq.{user_id}', 'status': 'eq.completed',
        })
        shopper_count = await self.repository.count('request_assignments', params={
            'shopper_id': f'eq.{user_id}', 'status': 'eq.completed', 'released_at': 'is.null',
        })
        return AccountProfile(**profile, completed_customer_count=customer_count,
                              completed_shopper_count=shopper_count)

    async def update(self, body: UpdateProfileBody, token: str) -> EditableProfile:
        try:
            result = await self.repository.rpc_as_user('update_account_profile', payload={
                'profile_name': body.display_name, 'profile_phone': body.phone,
                'profile_bio': body.bio, 'profile_avatar': body.avatar_path,
            }, access_token=token)
        except SupabaseError as error:
            errors = {
                'authentication_required': (401, 'Bạn cần đăng nhập lại.'),
                'active_profile_required': (403, 'Tài khoản chưa hoạt động.'),
                'invalid_profile': (422, 'Tên cần từ 2–80 ký tự, giới thiệu tối đa 500 ký tự.'),
                'invalid_avatar': (422, 'Ảnh chưa tải lên đầy đủ hoặc không thuộc tài khoản này.'),
            }
            if str(error) in errors:
                code, detail = errors[str(error)]
                raise HTTPException(code, detail) from error
            raise
        return EditableProfile(**result)
