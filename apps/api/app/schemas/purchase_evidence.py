from typing import Literal
from uuid import UUID

from pydantic import Field
from app.schemas.common import ApiModel


class EvidencePhoto(ApiModel):
    kind: Literal['goods', 'receipt', 'delivery']
    storage_path: str = Field(min_length=1, max_length=300)


class PurchaseEvidencePhoto(EvidencePhoto):
    kind: Literal['goods', 'receipt']


class DeliveryEvidencePhoto(EvidencePhoto):
    kind: Literal['delivery']


class SubmitDeliveryEvidenceBody(ApiModel):
    photos: list[DeliveryEvidencePhoto] = Field(min_length=1, max_length=20)


class SubmitEvidenceBody(ApiModel):
    checked_item_ids: list[UUID] = Field(min_length=1, max_length=100)
    photos: list[PurchaseEvidencePhoto] = Field(min_length=1, max_length=20)
