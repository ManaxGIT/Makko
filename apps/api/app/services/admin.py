from uuid import UUID
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.admin import AdminOrderDetail, AdminOrderList, PublishWeekBody


async def authorized_rpc(repository: SupabaseRepository, function: str, payload: dict, token: str):
    try:
        return await repository.rpc_as_user(function, payload=payload, access_token=token)
    except SupabaseError as error:
        messages = {
            'admin_required': (403, 'Bạn không còn quyền quản trị. Vui lòng đăng nhập lại.'),
            'account_inactive': (403, 'Tài khoản không hoạt động.'),
            'week_not_found': (404, 'Gói nguyên liệu không còn tồn tại. Vui lòng tải lại.'),
            'week_has_orders': (409, 'Không thể xóa gói đã có đơn đăng ký, kể cả đơn đã hủy hoặc hoàn tất.'),
            'order_not_found': (404, 'Không tìm thấy đơn hàng.'),
            'invalid_transition': (409, 'Đơn đã thay đổi hoặc chưa đủ điều kiện. Vui lòng tải lại.'),
            'cannot_reaccept': (409, 'Bạn đã hủy nhận và không thể nhận lại đơn này.'),
            'registration_closed': (409, 'Đã hết hạn đăng ký tuần này.'),
            'submission_conflict': (409, 'Mã đăng ký đã được dùng cho lựa chọn khác.'),
            'invalid_address': (422, 'Chọn địa chỉ đã lưu của bạn tại Đà Nẵng.'),
            'invalid_package': (422, 'Gói nguyên liệu không hợp lệ.'),
            'delivery_photo_required': (422, 'Cần ít nhất một ảnh bàn giao.'),
            'invalid_evidence': (422, 'Ảnh chưa tải lên hoặc không thuộc đơn này.'),
        }
        if str(error) in messages:
            code, message = messages[str(error)]
            raise HTTPException(code, message) from error
        raise


class AdminService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def list(self, token: str, **filters) -> AdminOrderList:
        result = await authorized_rpc(self.repository, 'admin_list_orders', filters, token)
        return AdminOrderList(**result)

    async def detail(self, order_id: UUID, order_type: str, token: str) -> AdminOrderDetail:
        result = await authorized_rpc(self.repository, 'admin_get_order', {
            'target_order_id': str(order_id), 'order_type': order_type,
        }, token)
        return AdminOrderDetail(**result)

    async def publish_week(self, body: PublishWeekBody, token: str) -> dict:
        start = datetime.combine(body.week_start, time(), ZoneInfo('Asia/Ho_Chi_Minh'))
        if body.week_start.weekday() != 0 or start - timedelta(microseconds=1, days=10) <= datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')):
            raise HTTPException(422, 'Chọn tuần bắt đầu thứ Hai và công bố ít nhất 10 ngày trước hạn giao.')
        try:
            result = await authorized_rpc(self.repository, 'admin_publish_weekly_food_week', {
                'week_start_date': body.week_start.isoformat(), 'week_menu': [d.model_dump() for d in body.ingredients],
            }, token)
        except SupabaseError as error:
            if 'weekly_food_weeks_week_start_key' in str(error):
                raise HTTPException(409, 'Tuần này đã được công bố.') from error
            raise
        return {'id': result}
