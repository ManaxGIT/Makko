from fastapi import HTTPException

from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.create_request import CreateRequestBody
from app.schemas.orders import OrderActionResult


class CreateRequestService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def create_and_publish(self, body: CreateRequestBody, access_token: str) -> OrderActionResult:
        try:
            result = await self.repository.rpc_as_user(
                'create_and_publish_request',
                payload={'p_request': body.model_dump(mode='json')},
                access_token=access_token,
            )
        except SupabaseError as error:
            errors = {
                'invalid_request': (422, 'Thông tin yêu cầu không hợp lệ.'),
                'delivery_time_must_be_future': (422, 'Thời gian giao phải ở trong tương lai.'),
                'address_not_found': (404, 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn.'),
                'active_profile_required': (403, 'Tài khoản không hoạt động.'),
            }
            if str(error) in errors:
                code, message = errors[str(error)]
                raise HTTPException(code, message) from error
            raise
        return OrderActionResult(**result)
