from uuid import UUID
from fastapi import HTTPException
from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.purchase_evidence import EvidencePhoto, SubmitEvidenceBody, SubmitDeliveryEvidenceBody
from app.schemas.orders import OrderActionResult
from app.services.marketplace import MarketplaceService


class PurchaseEvidenceService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def list(self, request_id: UUID, user_id: UUID) -> list[EvidencePhoto]:
        # Verify participation before using the server repository's privileged SELECT.
        await MarketplaceService(self.repository).get_order_tracking(request_id, user_id)
        rows = await self.repository.select('purchase_evidence', params={
            'select': 'kind,storage_path', 'request_id': f'eq.{request_id}', 'order': 'created_at.asc',
        })
        return [EvidencePhoto(**row) for row in rows]

    async def submit(self, request_id: UUID, body: SubmitEvidenceBody, token: str) -> OrderActionResult:
        try:
            result = await self.repository.rpc_as_user('submit_purchase_evidence', payload={
                'target_request_id': str(request_id),
                'checked_item_ids': [str(item) for item in body.checked_item_ids],
                'photos': [photo.model_dump() for photo in body.photos],
            }, access_token=token)
        except SupabaseError as error:
            messages = {
                'request_not_found': (404, 'Không tìm thấy đơn bạn đang nhận.'),
                'request_not_shopping': (409, 'Đơn không còn ở bước chọn hàng. Vui lòng tải lại.'),
                'items_not_confirmed': (422, 'Cần xác nhận đủ và đúng từng món trong đơn.'),
                'goods_photo_required': (422, 'Cần ít nhất một ảnh hàng đã mua.'),
                'invalid_evidence': (422, 'Ảnh chưa được tải lên đầy đủ hoặc không thuộc đơn này.'),
            }
            if str(error) in messages:
                code, message = messages[str(error)]
                raise HTTPException(code, message) from error
            raise
        return OrderActionResult(**result)


    async def submit_delivery(self, request_id: UUID, body: SubmitDeliveryEvidenceBody, token: str) -> OrderActionResult:
        try:
            result = await self.repository.rpc_as_user('submit_delivery_evidence', payload={
                'target_request_id': str(request_id),
                'photos': [photo.model_dump() for photo in body.photos],
            }, access_token=token)
        except SupabaseError as error:
            messages = {
                'request_not_found': (404, 'Không tìm thấy đơn bạn đang nhận.'),
                'request_not_delivering': (409, 'Đơn không còn ở bước giao hàng. Vui lòng tải lại.'),
                'delivery_photo_required': (422, 'Cần ít nhất một ảnh giao hàng.'),
                'invalid_evidence': (422, 'Ảnh chưa được tải lên đầy đủ hoặc không thuộc đơn này.'),
            }
            if str(error) in messages:
                code, message = messages[str(error)]
                raise HTTPException(code, message) from error
            raise
        return OrderActionResult(**result)
