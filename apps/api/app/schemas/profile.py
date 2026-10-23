from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator

from app.schemas.common import ApiModel


class EditableProfile(ApiModel):
    display_name: str
    phone: str | None = None
    bio: str | None = None
    avatar_path: str | None = None


class UpdateProfileBody(EditableProfile):
    model_config = ConfigDict(extra='forbid')
    display_name: str = Field(min_length=2, max_length=80)
    phone: str | None = Field(default=None, max_length=32)
    bio: str | None = Field(default=None, max_length=500)
    avatar_path: str | None = Field(max_length=2048)

    @field_validator('display_name', 'phone', 'bio', 'avatar_path')
    @classmethod
    def clean(cls, value: str | None) -> str | None:
        if value is not None and '\x00' in value:
            raise ValueError('Thông tin không hợp lệ')
        return value.strip() if value is not None else None

    @field_validator('display_name')
    @classmethod
    def require_name(cls, value: str) -> str:
        if len(value) < 2:
            raise ValueError('Tên cần có ít nhất 2 ký tự')
        return value


class AccountProfile(EditableProfile):
    id: UUID
    display_name: str
    created_at: datetime
    average_rating: float
    rating_count: int
    completed_customer_count: int
    completed_shopper_count: int
