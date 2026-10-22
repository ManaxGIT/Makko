from datetime import datetime
from uuid import UUID
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.schemas.common import ApiModel
from app.schemas.orders import OrderStatus


class SendMessageBody(ApiModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=4000)
    client_key: UUID
    assignment_id: UUID

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str) -> str:
        value = value.strip()
        if not value or "\x00" in value:
            raise ValueError("Tin nhắn không hợp lệ")
        return value


class ChatMessage(ApiModel):
    client_key: UUID | None = None
    # PostgreSQL bigint IDs travel as strings to avoid JS number precision loss.
    id: str
    sender_id: UUID
    body: str
    created_at: datetime


class ChatPerson(ApiModel):
    id: UUID
    display_name: str


class ChatConversation(ApiModel):
    request_id: UUID
    assignment_id: UUID
    title: str
    status: OrderStatus
    role: Literal["customer", "shopper"]
    counterpart: ChatPerson
    accepted_at: datetime
    estimated_items_total: float | None
    delivery_fee: float
    currency: str
    item_count: int
    can_send: bool
    messages: list[ChatMessage]
    has_more: bool
