from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.schemas.common import ApiModel, to_camel

NonEmpty = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ProvinceCode = Annotated[str, StringConstraints(pattern=r'^\d{2}$')]
WardCode = Annotated[str, StringConstraints(pattern=r'^\d{5}$')]


class CreateAddressBody(ApiModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid')

    label: NonEmpty = Field(max_length=60)
    recipient_name: NonEmpty = Field(max_length=160)
    recipient_phone: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r'^\+?[0-9][0-9 ()-]{7,19}$')]
    line1: NonEmpty = Field(max_length=300)
    line2: NonEmpty | None = Field(default=None, max_length=300)
    province_code: ProvinceCode
    ward_code: WardCode
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    delivery_note: NonEmpty | None = Field(default=None, max_length=500)
    is_default: bool = False


    @field_validator("recipient_phone")
    @classmethod
    def validate_phone_digits(cls, value: str) -> str:
        if not 8 <= sum(char.isdigit() for char in value) <= 15:
            raise ValueError("Phone must contain 8 to 15 digits")
        return value


    @model_validator(mode="after")
    def validate_coordinate_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both coordinates or omit both")
        return self


class Address(ApiModel):
    id: UUID
    label: str
    recipient_name: str
    recipient_phone: str
    line1: str
    line2: str | None
    # Legacy addresses remain readable without guessed administrative codes.
    province_code: str | None
    ward_code: str | None
    city: str
    district: str | None
    ward: str | None
    latitude: float | None
    longitude: float | None
    delivery_note: str | None
    is_default: bool
    created_at: datetime
    updated_at: datetime


class Province(ApiModel):
    code: str
    name: str
    full_name: str


class Ward(Province):
    province_code: str
