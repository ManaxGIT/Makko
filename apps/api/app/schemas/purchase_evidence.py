from typing import Literal
from uuid import UUID

from pydantic import Field
from app.schemas.common import ApiModel


class EvidencePhoto(ApiModel):
    kind: Literal['goods', 'receipt']
    storage_path: str = Field(min_length=1, max_length=300)


class SubmitEvidenceBody(ApiModel):
    checked_item_ids: list[UUID] = Field(min_length=1, max_length=100)
    photos: list[EvidencePhoto] = Field(min_length=1, max_length=20)
