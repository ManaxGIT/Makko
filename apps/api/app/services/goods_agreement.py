from uuid import UUID
from fastapi import HTTPException
from app.repositories.supabase import SupabaseError, SupabaseRepository
from app.schemas.goods_agreement import GoodsAmountAgreement, ProposeGoodsAmountBody, RespondGoodsAmountBody


class GoodsAgreementService:
    def __init__(self, repository: SupabaseRepository):
        self.repository = repository

    async def _call(self, function: str, payload: dict, token: str) -> GoodsAmountAgreement:
        try:
            row = await self.repository.rpc_as_user(function, payload=payload, access_token=token)
        except SupabaseError as error:
            errors = {
                'authentication_required': (401, 'Bạn cần đăng nhập lại.'),
                'active_profile_required': (403, 'Tài khoản chưa hoạt động.'),
                'agreement_not_found': (404, 'Không tìm thấy đề nghị hoặc bạn không có quyền thao tác.'),
                'agreement_stage_closed': (409, 'Chỉ đổi tiền hàng sau khi nhận đơn và trong lúc mua hàng.'),
                'agreement_pending': (409, 'Đã có một đề nghị đang chờ người đi chợ xác nhận.'),
                'agreement_already_resolved': (409, 'Đề nghị đã được xử lý hoặc hết hiệu lực.'),
                'agreement_amount_changed': (409, 'Tiền hàng đã thay đổi. Vui lòng tải lại đơn.'),
                'invalid_goods_amount': (422, 'Nhập tiền hàng lớn hơn 0 và khác tiền hiện tại, tối đa 2 chữ số thập phân.'),
                'invalid_agreement_response': (422, 'Vui lòng chọn đồng ý hoặc từ chối.'),
            }
            if str(error) in errors:
                code, detail = errors[str(error)]
                raise HTTPException(code, detail) from error
            raise
        return GoodsAmountAgreement(**row)

    async def get(self, request_id: UUID, token: str) -> GoodsAmountAgreement:
        return await self._call('get_goods_amount_agreement', {'target_request_id': str(request_id)}, token)

    async def propose(self, request_id: UUID, body: ProposeGoodsAmountBody, token: str) -> GoodsAmountAgreement:
        return await self._call('propose_goods_amount', {
            'target_request_id': str(request_id), 'new_goods_amount': str(body.amount),
        }, token)

    async def respond(self, request_id: UUID, proposal_id: UUID, body: RespondGoodsAmountBody, token: str) -> GoodsAmountAgreement:
        return await self._call('respond_goods_amount', {
            'target_request_id': str(request_id), 'target_proposal_id': str(proposal_id), 'accept_proposal': body.accept,
        }, token)
