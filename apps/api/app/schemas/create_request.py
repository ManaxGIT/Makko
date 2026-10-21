from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.common import ApiModel, to_camel

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]


class CreateRequestItem(ApiModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid')
    name: Text = Field(max_length=160)
    quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=3, allow_inf_nan=False)
    unit: Text = Field(max_length=30)
    note: str | None = Field(default=None, max_length=500)
    allow_substitution: bool = False


class CreateRequestBody(ApiModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid')
    submission_key: Annotated[str, StringConstraints(pattern=r'^[a-zA-Z0-9_-]{16,100}$')]
    address_id: UUID
    title: str | None = None
    items: list[CreateRequestItem] = Field(min_length=1, max_length=100)
    deliver_by: AwareDatetime
    estimated_items_total: Money | None = None
    delivery_fee: Money
    payment_method: Literal['cash', 'bank_transfer']
    delivery_note: str | None = Field(default=None, max_length=500)

    @field_validator('title')
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if not 3 <= len(value) <= 120:
            raise ValueError('Tiêu đề cần từ 3 đến 120 ký tự.')
        return value
