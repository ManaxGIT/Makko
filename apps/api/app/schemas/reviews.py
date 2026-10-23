from datetime import datetime
from uuid import UUID
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.schemas.common import ApiModel
from app.schemas.orders import OrderCounterpart


class SubmitReviewBody(ApiModel):
    model_config = ConfigDict(extra='forbid')
    rating: int = Field(strict=True, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator('comment')
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is not None and '\x00' in value:
            raise ValueError('Nhận xét không hợp lệ')
        return value.strip() or None if value is not None else None


class OrderReview(ApiModel):
    id: UUID
    rating: int
    comment: str | None
    created_at: datetime


class OrderReviewContext(ApiModel):
    request_id: UUID
    title: str
    counterpart: OrderCounterpart
    role: Literal["customer", "shopper"]
    can_review: bool
    review: OrderReview | None


class ReceivedReview(OrderReview):
    request_id: UUID
    request_title: str
    reviewer_name: str
    reviewer_role: Literal['customer', 'shopper']


class AccountReputation(ApiModel):
    average_rating: float
    rating_count: int
    reviews: list[ReceivedReview]
    has_more: bool
