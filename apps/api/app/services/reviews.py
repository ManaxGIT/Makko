from uuid import UUID

from fastapi import HTTPException

from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.reviews import AccountReputation, ReceivedReview, OrderReview, OrderReviewContext, SubmitReviewBody


class ReviewService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def get(self, request_id: UUID, user_id: UUID) -> OrderReviewContext:
        request = await self.repository.select_one('shopping_requests', params={
            'select': 'id,customer_id,title,status', 'id': f'eq.{request_id}',
        })
        assignment = await self.repository.select_one('request_assignments', params={
            'select': 'shopper_id', 'request_id': f'eq.{request_id}', 'released_at': 'is.null',
        })
        if request is None or assignment is None or str(user_id) not in (request['customer_id'], assignment['shopper_id']):
            raise HTTPException(404, 'Không tìm thấy đơn hàng.')
        customer = str(user_id) == request['customer_id']
        other_id = assignment['shopper_id'] if customer else request['customer_id']
        profile = await self.repository.select_one('profiles', params={
            'select': 'id,display_name,avatar_path,average_rating,rating_count', 'id': f'eq.{other_id}',
        })
        if profile is None:
            raise HTTPException(404, 'Không tìm thấy người tham gia.')
        review = await self.repository.select_one('reviews', params={
            'select': 'id,rating,comment,created_at', 'request_id': f'eq.{request_id}',
            'reviewer_id': f'eq.{user_id}', 'reviewee_id': f'eq.{other_id}',
        })
        return OrderReviewContext(request_id=request_id, title=request['title'], counterpart=profile,
            role='customer' if customer else 'shopper', can_review=request['status'] == 'completed' and review is None,
            review=OrderReview(**review) if review else None)

    async def submit(self, request_id: UUID, body: SubmitReviewBody, token: str) -> OrderReview:
        try:
            row = await self.repository.rpc_as_user('submit_order_review', payload={
                'target_request_id': str(request_id), 'review_rating': body.rating, 'review_comment': body.comment,
            }, access_token=token)
        except SupabaseError as error:
            errors = {
                'review_not_found': (404, 'Không tìm thấy đơn hàng.'),
                'review_not_completed': (409, 'Chỉ đánh giá khi đơn hàng đã hoàn thành.'),
                'review_already_submitted': (409, 'Bạn đã đánh giá đơn này. Đánh giá không thể sửa hoặc xóa.'),
                'invalid_review': (422, 'Chọn từ 1 đến 5 sao, nhận xét tối đa 1.000 ký tự.'),
                'active_profile_required': (403, 'Tài khoản chưa hoạt động.'),
                'authentication_required': (401, 'Bạn cần đăng nhập lại.'),
            }
            if str(error) in errors:
                code, detail = errors[str(error)]
                raise HTTPException(code, detail) from error
            raise
        return OrderReview(**row)

    async def received(self, user_id: UUID, *, limit: int, offset: int) -> AccountReputation:
        profile = await self.repository.select_one('profiles', params={
            'select': 'average_rating,rating_count', 'id': f'eq.{user_id}', 'account_status': 'eq.active',
        })
        if profile is None:
            raise HTTPException(404, 'Không tìm thấy hồ sơ.')
        rows = await self.repository.select('reviews', params={
            'select': 'id,request_id,reviewer_id,rating,comment,created_at',
            'reviewee_id': f'eq.{user_id}', 'order': 'created_at.desc,id.desc',
            'limit': str(limit + 1), 'offset': str(offset),
        })
        has_more = len(rows) > limit
        rows = rows[:limit]
        if not rows:
            return AccountReputation(**profile, reviews=[], has_more=False)
        reviewer_ids = ','.join(sorted({str(row['reviewer_id']) for row in rows}))
        request_ids = ','.join(sorted({str(row['request_id']) for row in rows}))
        people = {str(row['id']): row for row in await self.repository.select('profiles', params={
            'select': 'id,display_name', 'id': f'in.({reviewer_ids})',
        })}
        requests = {str(row['id']): row for row in await self.repository.select('shopping_requests', params={
            'select': 'id,title,customer_id', 'id': f'in.({request_ids})',
        })}
        return AccountReputation(**profile, has_more=has_more, reviews=[ReceivedReview(
            **row, request_title=requests[str(row['request_id'])]['title'],
            reviewer_name=people[str(row['reviewer_id'])]['display_name'],
            reviewer_role='customer' if requests[str(row['request_id'])]['customer_id'] == row['reviewer_id'] else 'shopper',
        ) for row in rows])
