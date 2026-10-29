from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, StrictBool
from app.schemas.common import ApiModel
from app.schemas.orders import OrderStatus


class ProposeGoodsAmountBody(ApiModel):
    model_config = ConfigDict(extra='forbid')
    amount: Decimal = Field(gt=0, le=Decimal('9999999999.99'), decimal_places=2)


class RespondGoodsAmountBody(ApiModel):
    model_config = ConfigDict(extra='forbid')
    accept: StrictBool


class GoodsAmountProposal(ApiModel):
    id: UUID
    old_amount: float | None
    new_amount: float
    status: Literal['pending', 'accepted', 'rejected', 'expired']
    created_at: datetime
    responded_at: datetime | None


class GoodsAmountAgreement(ApiModel):
    request_id: UUID
    role: Literal['customer', 'shopper']
    status: OrderStatus
    currency: str
    agreed_amount: float | None
    delivery_fee: float
    can_propose: bool
    proposal: GoodsAmountProposal | None
