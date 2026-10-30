from typing import Annotated

from fastapi import Depends, HTTPException

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository


async def get_current_admin(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> CurrentUser:
    membership = await repository.select_one('admin_memberships', params={
        'select': 'user_id', 'user_id': f'eq.{user.id}',
    })
    if membership is None:
        raise HTTPException(403, 'Tài khoản chưa được cấp quyền quản trị Makko.')
    profile = await repository.select_one('profiles', params={
        'select': 'id', 'id': f'eq.{user.id}', 'account_status': 'eq.active',
    })
    if profile is None:
        raise HTTPException(403, 'Tài khoản quản trị không hoạt động.')
    return user
