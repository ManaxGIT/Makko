from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseRepository
from app.schemas.addresses import Address, CreateAddressBody
from app.services.addresses import AddressService

router = APIRouter(prefix='/addresses', tags=['addresses'])


@router.get('', response_model=list[Address], response_model_by_alias=True)
async def list_addresses(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Address]:
    return await AddressService(repository).list_addresses(user.id, limit=limit, offset=offset)


@router.post('', response_model=Address, response_model_by_alias=True, status_code=201)
async def create_address(
    body: CreateAddressBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> Address:
    return await AddressService(repository).create_address(user, body)
