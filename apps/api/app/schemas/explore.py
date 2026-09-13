from datetime import datetime
from uuid import UUID

from app.schemas.common import ApiModel


class ExploreItem(ApiModel):
    id: UUID
    name: str
    quantity: float
    unit: str
    estimated_unit_price: float | None
    note: str | None
    allow_substitution: bool
    sort_order: int


class ExploreRequest(ApiModel):
    id: UUID
    customer_id: UUID
    owner_display_name: str
    owner_avatar_path: str | None
    owner_average_rating: float
    owner_rating_count: int
    title: str
    description: str | None
    currency: str
    estimated_items_total: float | None
    delivery_fee: float
    deliver_by: datetime | None
    delivery_ward: str | None
    delivery_district: str | None
    delivery_city: str
    published_at: datetime | None
    distance_meters: float | None
    item_count: int
    items: list[ExploreItem]
