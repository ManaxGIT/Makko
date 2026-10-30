from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, ConfigDict, Field

from app.schemas.common import ApiModel

OrderType = Literal['weekly', 'errand']


class AdminSession(ApiModel):
    user_id: UUID


class AdminOrder(ApiModel):
    id: UUID
    type: OrderType
    title: str
    status: str
    customer_id: UUID
    customer_name: str
    shopper_id: UUID | None
    shopper_name: str | None
    price: float | None
    fee: float
    delivery_deadline: datetime | None
    created_at: datetime
    completed_at: datetime | None
    handover_at: datetime | None
    wage_paid_at: datetime | None
    recipient_name: str
    recipient_phone: str
    delivery_address: str


class AdminStats(ApiModel):
    total: int
    handover: int
    delivering: int
    wages: int


class AdminOrderList(ApiModel):
    items: list[AdminOrder]
    total: int
    stats: AdminStats


class AdminItem(ApiModel):
    name: str
    quantity: float
    unit: str
    note: str | None = None


class AdminHistory(ApiModel):
    status: str
    created_at: datetime


class MenuIngredient(ApiModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=160)
    quantity: str = Field(min_length=1, max_length=60)


class AdminOrderDetail(AdminOrder):
    items: list[AdminItem]
    history: list[AdminHistory]
    ingredients: list[MenuIngredient] | None = Field(default=None, validation_alias=AliasChoices('ingredients', 'menu'))


class PublishWeekBody(ApiModel):
    model_config = ConfigDict(extra='forbid')
    week_start: date
    ingredients: list[MenuIngredient] = Field(min_length=1, max_length=350)
