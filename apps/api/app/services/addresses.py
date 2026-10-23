from uuid import UUID

from fastapi import HTTPException

from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.addresses import Address, CreateAddressBody, Province, Ward

ADDRESS_COLUMNS = (
    'id,label,recipient_name,recipient_phone,line1,line2,province_code,ward_code,'
    'city,district,ward,latitude,longitude,delivery_note,is_default,created_at,updated_at'
)


class AddressService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def list_addresses(self, user_id: UUID, *, limit: int, offset: int) -> list[Address]:
        rows = await self.repository.select('addresses', params={
            'select': ADDRESS_COLUMNS, 'owner_id': f'eq.{user_id}',
            'order': 'is_default.desc,created_at.desc,id.asc',
            'limit': str(limit), 'offset': str(offset),
        })
        return [Address(**row) for row in rows]

    async def create_address(self, user: CurrentUser, body: CreateAddressBody) -> Address:
        try:
            # Owner comes from auth.uid() inside the transaction, never from the body.
            result = await self.repository.rpc_as_user(
                'create_delivery_address', payload={'p_address': body.model_dump()},
                access_token=user.access_token,
            )
        except SupabaseError as error:
            if str(error) == 'Invalid delivery address':
                raise HTTPException(422, 'Địa chỉ hoặc mã tỉnh/xã không hợp lệ.') from error
            if str(error) == 'Active profile required':
                raise HTTPException(403, 'Tài khoản không hoạt động.') from error
            raise
        return Address(**result)

    async def change_address(self, user: CurrentUser, function: str, payload: dict) -> list[Address]:
        try:
            rows = await self.repository.rpc_as_user(function, payload=payload, access_token=user.access_token)
        except SupabaseError as error:
            errors = {
                'Address not found': (404, 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn.'),
                'Invalid delivery address': (422, 'Địa chỉ hoặc mã tỉnh/xã không hợp lệ.'),
                'Default replacement required': (409, 'Vui lòng chọn địa chỉ mặc định thay thế.'),
                'Active profile required': (403, 'Tài khoản không hoạt động.'),
            }
            if str(error) in errors:
                status, detail = errors[str(error)]
                raise HTTPException(status, detail) from error
            raise
        return [Address(**row) for row in rows]

    async def list_provinces(self) -> list[Province]:
        rows = await self.repository.select('provinces', params={
            'select': 'code,name,full_name', 'order': 'name.asc,code.asc',
        })
        return [Province(**row) for row in rows]

    async def list_wards(self, province_code: str) -> list[Ward]:
        province = await self.repository.select_one('provinces', params={
            'select': 'code', 'code': f'eq.{province_code}',
        })
        if province is None:
            raise LookupError('Province not found')
        rows = await self.repository.select('wards', params={
            'select': 'code,name,full_name,province_code',
            'province_code': f'eq.{province_code}', 'order': 'name.asc,code.asc',
        })
        return [Ward(**row) for row in rows]
