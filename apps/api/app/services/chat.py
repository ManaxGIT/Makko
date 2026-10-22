from uuid import UUID

from fastapi import HTTPException

from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.chat import ChatConversation, ChatMessage, ChatPerson, SendMessageBody


class ChatService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def get(self, request_id: UUID, user_id: UUID, *, before: int | None, after: int | None, limit: int) -> ChatConversation:
        request = await self.repository.select_one('shopping_requests', params={
            'select': 'id,customer_id,title,status,estimated_items_total,delivery_fee,currency',
            'id': f'eq.{request_id}',
        })
        if request is None:
            raise HTTPException(404, 'Không tìm thấy cuộc trò chuyện.')
        assignment = await self.repository.select_one('request_assignments', params={
            'select': 'id,shopper_id,accepted_at,status', 'request_id': f'eq.{request_id}',
            'released_at': 'is.null',
        })
        if assignment is None or str(user_id) not in (request['customer_id'], assignment['shopper_id']):
            raise HTTPException(404, 'Không tìm thấy cuộc trò chuyện.')
        customer = str(user_id) == request['customer_id']
        other_id = assignment['shopper_id'] if customer else request['customer_id']
        profile = await self.repository.select_one('profiles', params={
            'select': 'id,display_name', 'id': f'eq.{other_id}',
        })
        if profile is None:
            raise HTTPException(404, 'Không tìm thấy người tham gia.')
        params = {'select': 'id,sender_id,body,client_key,created_at', 'request_id': f'eq.{request_id}',
                  'order': 'id.asc' if after is not None else 'id.desc', 'limit': str(limit + 1)}
        if before is not None:
            params['id'] = f'lt.{before}'
        if after is not None:
            params['id'] = f'gt.{after}'
        rows = await self.repository.select('messages', params=params)
        has_more = len(rows) > limit
        rows = rows[:limit]
        if after is not None:
            rows.reverse()
        # Recheck the assignment after the read: release deletes history and a new
        # shopper must never receive content fetched from the previous assignment.
        current = await self.repository.select_one('request_assignments', params={
            'select': 'id', 'id': f"eq.{assignment['id']}", 'released_at': 'is.null',
        })
        if current is None:
            raise HTTPException(404, 'Cuộc trò chuyện đã kết thúc do hủy nhận đơn.')
        items = await self.repository.select('request_items', params={
            'select': 'id', 'request_id': f'eq.{request_id}', 'limit': '100',
        })
        return ChatConversation(
            request_id=request_id, assignment_id=assignment['id'], title=request['title'],
            status=request['status'], role='customer' if customer else 'shopper',
            counterpart=ChatPerson(**profile), accepted_at=assignment['accepted_at'],
            estimated_items_total=request['estimated_items_total'], delivery_fee=request['delivery_fee'],
            currency=request['currency'], item_count=len(items),
            can_send=request['status'] in ('accepted','shopping','delivering','delivered','disputed') and assignment['status'] == 'active',
            messages=[ChatMessage(**{**row, 'id': str(row['id'])}) for row in rows], has_more=has_more,
        )

    async def send(self, request_id: UUID, body: SendMessageBody, token: str) -> ChatMessage:
        try:
            row = await self.repository.rpc_as_user('send_order_message', payload={
                'target_request_id': str(request_id), 'target_assignment_id': str(body.assignment_id),
                'message_body': body.body, 'message_key': str(body.client_key),
            }, access_token=token)
        except SupabaseError as error:
            errors = {
                'chat_not_found': (404, 'Cuộc trò chuyện không còn khả dụng. Lịch sử được xóa khi hủy nhận đơn.'),
                'chat_read_only': (409, 'Đơn đã kết thúc. Bạn chỉ có thể xem lịch sử.'),
                'invalid_message': (422, 'Tin nhắn phải có từ 1 đến 4.000 ký tự.'),
                'message_key_conflict': (409, 'Lần gửi này đã được dùng cho nội dung khác. Vui lòng tải lại.'),
                'active_profile_required': (403, 'Tài khoản chưa hoạt động.'),
                'authentication_required': (401, 'Bạn cần đăng nhập lại.'),
            }
            if str(error) in errors:
                code, detail = errors[str(error)]
                raise HTTPException(code, detail) from error
            raise
        return ChatMessage(**row)
