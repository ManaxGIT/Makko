from uuid import UUID

import pytest

from app.services.marketplace import MarketplaceService, haversine_meters

USER_ID = UUID("3e0765f0-afea-4a7d-9fd4-2e4b1036572d")
CUSTOMER_ID = "ee0fb2ff-69a1-459a-8d06-bc7b39700c43"
REQUEST_ID = "f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc"


class FakeRepository:
    async def select(self, table: str, *, params: dict[str, str]):
        if table == "shopping_requests":
            return [{
                "id": REQUEST_ID, "customer_id": CUSTOMER_ID,
                "title": "Trái cây buổi sáng", "description": None,
                "currency": "VND", "estimated_items_total": "50000",
                "delivery_fee": "28000", "deliver_by": None,
                "delivery_ward": "Bến Nghé", "delivery_district": "Quận 1",
                "delivery_city": "TP. Hồ Chí Minh", "delivery_latitude": 10.78,
                "delivery_longitude": 106.70, "published_at": "2026-09-13T08:00:00Z",
                "created_at": "2026-09-13T07:00:00Z",
            }]
        if table == "profiles":
            return [{
                "id": CUSTOMER_ID, "display_name": "Cô Lan", "avatar_path": None,
                "average_rating": "5.0", "rating_count": 10, "account_status": "active",
            }]
        if table == "request_items":
            return [{
                "id": "861f39ae-32a6-4ce7-a9a9-f1907f2ba2ed",
                "request_id": REQUEST_ID, "name": "Cam sành", "quantity": "1",
                "unit": "kg", "estimated_unit_price": "50000", "note": None,
                "allow_substitution": True, "sort_order": 0,
            }]
        return []


def test_haversine_returns_zero_for_same_point():
    assert haversine_meters(10.78, 106.70, 10.78, 106.70) == 0


@pytest.mark.asyncio
async def test_explore_maps_safe_public_response():
    service = MarketplaceService(FakeRepository())  # type: ignore[arg-type]
    results = await service.list_explore_requests(
        USER_ID, query="cam", latitude=10.7798, longitude=106.7009,
        limit=20, radius_meters=3_000,
    )

    assert len(results) == 1
    assert results[0].owner_display_name == "Cô Lan"
    assert results[0].items[0].name == "Cam sành"
    assert results[0].distance_meters is not None
