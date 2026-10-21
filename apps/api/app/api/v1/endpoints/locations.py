from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.repositories.supabase import SupabaseRepository
from app.schemas.addresses import Province, Ward
from app.services.addresses import AddressService

router = APIRouter(prefix='/locations', tags=['locations'], dependencies=[Depends(get_current_user)])


@router.get('/provinces', response_model=list[Province], response_model_by_alias=True)
async def list_provinces(
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> list[Province]:
    return await AddressService(repository).list_provinces()


@router.get('/provinces/{province_code}/wards', response_model=list[Ward], response_model_by_alias=True)
async def list_wards(
    province_code: Annotated[str, Path(pattern=r'^\d{2}$')],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> list[Ward]:
    return await AddressService(repository).list_wards(province_code)
