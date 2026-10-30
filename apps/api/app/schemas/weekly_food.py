from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, ConfigDict, Field

from app.schemas.common import ApiModel
from app.schemas.admin import MenuIngredient


class RegisterWeeklyFoodBody(ApiModel):
    model_config = ConfigDict(extra='forbid')
    week_id: UUID
    address_id: UUID
    people: int = Field(ge=1, le=4, strict=True)
    meals: Literal['lunch', 'dinner', 'both']
    submission_key: UUID


class WeeklyFoodActionBody(ApiModel):
    model_config = ConfigDict(extra='forbid')
    photo_paths: list[str] = Field(default_factory=list, max_length=10)


class WeeklyFoodWeek(ApiModel):
    id: UUID
    week_start: date
    delivery_deadline: datetime
    ingredients: list[MenuIngredient] = Field(validation_alias=AliasChoices('ingredients', 'menu'))
    published_at: datetime | None = None


class AdminWeeklyFoodWeek(WeeklyFoodWeek):
    order_count: int = Field(ge=0)


class AdminWeeklyFoodWeekList(ApiModel):
    items: list[AdminWeeklyFoodWeek]
    total: int = Field(ge=0)


class WeeklyFoodOrder(ApiModel):
    id: UUID
    customer_id: UUID
    week_id: UUID
    people: int
    meals: Literal['lunch', 'dinner', 'both']
    price: int
    status: Literal['registered', 'accepted', 'delivering', 'delivered', 'completed', 'cancelled']
    delivery_deadline: datetime
    recipient_name: str
    recipient_phone: str
    delivery_address: str
    shopper_id: UUID | None
    accepted_at: datetime | None
    handover_at: datetime | None
    delivered_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    wage_paid_at: datetime | None
    created_at: datetime


class WeeklyFoodDetail(WeeklyFoodOrder):
    week: WeeklyFoodWeek | None


class AvailableWeeklyFood(ApiModel):
    week: WeeklyFoodWeek
    id: UUID
    people: int
    meals: Literal['lunch', 'dinner', 'both']
    price: int
    wage: int
    delivery_deadline: datetime
    created_at: datetime
