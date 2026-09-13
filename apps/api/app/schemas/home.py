from uuid import UUID

from app.schemas.common import ApiModel
from app.schemas.explore import ExploreRequest


class HomeProfile(ApiModel):
    id: UUID
    display_name: str
    avatar_path: str | None


class HomeLocation(ApiModel):
    ward: str | None
    district: str | None
    city: str
    latitude: float
    longitude: float


class HomeDashboard(ApiModel):
    profile: HomeProfile
    location: HomeLocation | None
    nearby_requests: list[ExploreRequest]
