from datetime import datetime
from typing import Literal
from uuid import UUID

from app.schemas.common import ApiModel
from app.schemas.explore import ExploreRequest


OrderStatus = Literal[
    "draft", "open", "accepted", "shopping", "delivering", "delivered",
    "completed", "cancelled", "disputed",
]


class OrderCounterpart(ApiModel):
    id: UUID
    display_name: str
    avatar_path: str | None
    average_rating: float
    rating_count: int


class OrderSummary(ApiModel):
    has_recipe: bool = False
    id: UUID
    role: Literal["customer", "shopper"]
    title: str
    status: OrderStatus
    currency: str
    estimated_items_total: float | None
    delivery_fee: float
    actual_items_total: float | None
    deliver_by: datetime | None
    published_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    item_count: int
    counterpart: OrderCounterpart | None
    assignment_accepted_at: datetime | None


class OrderStatusEvent(ApiModel):
    id: int
    to_status: OrderStatus
    created_at: datetime


class OrderTracking(ApiModel):
    has_recipe: bool = False
    id: UUID
    role: Literal["customer", "shopper"]
    status: OrderStatus
    deliver_by: datetime | None
    counterpart: OrderCounterpart | None
    assignment_accepted_at: datetime | None
    status_history: list[OrderStatusEvent]


class OrderDetail(ExploreRequest):
    role: Literal["customer", "shopper"]
    status: OrderStatus


class TransitionOrderBody(ApiModel):
    status: OrderStatus


class OrderActionResult(ApiModel):
    request_id: UUID
    status: OrderStatus
