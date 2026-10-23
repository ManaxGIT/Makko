from typing import Annotated
from uuid import UUID

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


@router.patch('/{address_id}', response_model=list[Address], response_model_by_alias=True)
async def update_address(
    address_id: UUID,
    body: CreateAddressBody,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> list[Address]:
    return await AddressService(repository).change_address(user, 'update_delivery_address', {
        'p_address_id': str(address_id), 'p_address': body.model_dump(),
    })


@router.post('/{address_id}/default', response_model=list[Address], response_model_by_alias=True)
async def set_default_address(
    address_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
) -> list[Address]:
    return await AddressService(repository).change_address(user, 'set_default_delivery_address', {
        'p_address_id': str(address_id),
    })


@router.delete('/{address_id}', response_model=list[Address], response_model_by_alias=True)
async def delete_address(
    address_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[SupabaseRepository, Depends(get_repository)],
    replacement_address_id: UUID | None = None,
) -> list[Address]:
    return await AddressService(repository).change_address(user, 'delete_delivery_address', {
        'p_address_id': str(address_id),
        'p_replacement_id': str(replacement_address_id) if replacement_address_id else None,
    })
