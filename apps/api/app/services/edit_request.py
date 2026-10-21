from uuid import UUID

from fastapi import HTTPException

from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.edit_request import EditableRequest, EditRequestBody
from app.schemas.orders import OrderActionResult


class EditRequestService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def get(self, request_id: UUID, user_id: UUID) -> EditableRequest:
        row = await self.repository.select_one('shopping_requests', params={
            'select': '*,request_items(*)', 'id': f'eq.{request_id}', 'customer_id': f'eq.{user_id}',
        })
        if not row:
            raise HTTPException(404, 'Không tìm thấy yêu cầu của bạn.')
        if row['status'] not in ('draft', 'open'):
            raise HTTPException(409, 'Đơn đã được nhận hoặc kết thúc, không thể chỉnh sửa.')
        return EditableRequest(
            id=row['id'], updated_at=row['updated_at'],
            items=[{key: item.get(key) for key in ('id', 'name', 'quantity', 'unit', 'note', 'allow_substitution')}
                   for item in sorted(row['request_items'], key=lambda item: item['sort_order'])],
            address={key: row[f'delivery_{key}'] for key in ('line1', 'line2', 'ward', 'district', 'city')} | {'recipient_phone': row['delivery_phone']},
            deliver_by=row['deliver_by'], estimated_items_total=row['estimated_items_total'],
            delivery_fee=row['delivery_fee'], payment_method=row['payment_method'], delivery_note=row['delivery_note'],
        )

    async def update(self, request_id: UUID, body: EditRequestBody, token: str) -> OrderActionResult:
        try:
            result = await self.repository.rpc_as_user('update_shopping_request', payload={
                'target_request_id': str(request_id), 'p_request': body.model_dump(mode='json'),
            }, access_token=token)
        except SupabaseError as error:
            errors = {
                'request_not_found': (404, 'Không tìm thấy yêu cầu của bạn.'),
                'request_not_editable': (409, 'Đơn đã được nhận hoặc kết thúc, không thể chỉnh sửa.'),
                'request_changed': (409, 'Đơn đã thay đổi. Quay về Đơn hàng rồi mở lại để chỉnh sửa.'),
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
