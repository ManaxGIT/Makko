from datetime import datetime
from uuid import UUID

from pydantic import AwareDatetime, Field

from app.schemas.common import ApiModel
from app.schemas.create_request import CreateRequestBody, CreateRequestItem


class EditRequestItem(CreateRequestItem):
    id: UUID | None = None


class EditRequestBody(CreateRequestBody):
    # Null keeps the order's existing address snapshot, even if the account address changed.
    address_id: UUID | None = None
    expected_updated_at: AwareDatetime
    items: list[EditRequestItem] = Field(min_length=1, max_length=100)


class OrderAddressSnapshot(ApiModel):
    recipient_phone: str
    line1: str
    line2: str | None
    ward: str | None
    district: str | None
    city: str


class EditableRequest(ApiModel):
    id: UUID
    updated_at: datetime
    items: list[EditRequestItem]
    address: OrderAddressSnapshot
    deliver_by: datetime | None
    estimated_items_total: float | None
    delivery_fee: float
    payment_method: str
    delivery_note: str | None
