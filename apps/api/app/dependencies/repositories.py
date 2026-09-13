from typing import Annotated

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.repositories.supabase import SupabaseRepository


def get_repository(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SupabaseRepository:
    return SupabaseRepository(
        request.app.state.http,
        settings.supabase_secret_key,
        settings.supabase_publishable_key,
    )
