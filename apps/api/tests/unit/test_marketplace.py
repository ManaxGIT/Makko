from uuid import UUID

import pytest

from app.services.marketplace import MarketplaceService, haversine_meters

USER_ID = UUID("3e0765f0-afea-4a7d-9fd4-2e4b1036572d")
CUSTOMER_ID = "ee0fb2ff-69a1-459a-8d06-bc7b39700c43"
REQUEST_ID = "f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc"


class FakeRepository:
    async def select_one(self, table: str, *, params: dict[str, str]):
        rows = await self.select(table, params=params)
        return rows[0] if rows else None

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


class TrackingRepository:
    async def select_one(self, table: str, *, params: dict[str, str]):
        if table == "shopping_requests":
            return {
                "id": REQUEST_ID,
                "customer_id": str(USER_ID),
                "status": "shopping",
                "deliver_by": "2026-09-13T10:00:00Z",
            }
        if table == "request_assignments":
            return {
                "shopper_id": CUSTOMER_ID,
                "accepted_at": "2026-09-13T08:30:00Z",
                "released_at": None,
            }
        return None

    async def select(self, table: str, *, params: dict[str, str]):
        if table == "profiles":
            return [{
                "id": CUSTOMER_ID,
                "display_name": "Chú Tư",
                "avatar_path": None,
                "average_rating": "4.95",
                "rating_count": 126,
                "account_status": "active",
            }]
        if table == "request_status_history":
            return [{
                "id": 1,
                "to_status": "shopping",
                "created_at": "2026-09-13T08:45:00Z",
            }]
        return []


class OpenOrderTrackingRepository(TrackingRepository):
    async def select_one(self, table: str, *, params: dict[str, str]):
        if table == "request_assignments":
            return None
        return await super().select_one(table, params=params)


class ParticipantDetailRepository(FakeRepository):
    async def select_one(self, table: str, *, params: dict[str, str]):
        if table == "shopping_requests":
            request = (await self.select(table, params=params))[0]
            return {**request, "status": "accepted"}
        if table == "request_assignments":
            return {"shopper_id": str(USER_ID), "released_at": None}
        return await super().select_one(table, params=params)


class ActionRepository:
    def __init__(self):
        self.function = None
        self.payload = None

    async def rpc_as_user(self, function: str, *, payload: dict, access_token: str):
        self.function = function
        self.payload = payload
        return {"status": "open"}


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


@pytest.mark.asyncio
async def test_explore_detail_maps_request_and_items():
    service = MarketplaceService(FakeRepository())  # type: ignore[arg-type]

    result = await service.get_explore_request(
        UUID(REQUEST_ID), USER_ID, latitude=10.7798, longitude=106.7009,
    )

    assert result.id == UUID(REQUEST_ID)
    assert result.owner_display_name == "Cô Lan"
    assert result.item_count == 1
    assert result.items[0].name == "Cam sành"


@pytest.mark.asyncio
async def test_tracking_returns_participant_order_history():
    service = MarketplaceService(TrackingRepository())  # type: ignore[arg-type]

    tracking = await service.get_order_tracking(UUID(REQUEST_ID), USER_ID)

    assert tracking.role == "customer"
    assert tracking.status == "shopping"
    assert tracking.counterpart is not None
    assert tracking.counterpart.display_name == "Chú Tư"
    assert tracking.status_history[0].to_status == "shopping"


@pytest.mark.asyncio
async def test_tracking_does_not_return_customer_as_their_own_counterpart():
    service = MarketplaceService(OpenOrderTrackingRepository())  # type: ignore[arg-type]

    tracking = await service.get_order_tracking(UUID(REQUEST_ID), USER_ID)

    assert tracking.role == "customer"
    assert tracking.counterpart is None


@pytest.mark.asyncio
async def test_order_detail_is_available_to_assigned_shopper():
    service = MarketplaceService(ParticipantDetailRepository())  # type: ignore[arg-type]

    detail = await service.get_order_detail(
        UUID(REQUEST_ID), USER_ID, latitude=10.7798, longitude=106.7009,
    )

    assert detail.role == "shopper"
    assert detail.status == "accepted"
    assert detail.owner_display_name == "Cô Lan"
    assert detail.items[0].name == "Cam sành"


@pytest.mark.asyncio
async def test_release_accepted_request_uses_transaction_rpc():
    repository = ActionRepository()
    service = MarketplaceService(repository)  # type: ignore[arg-type]

    result = await service.release_accepted_request(UUID(REQUEST_ID), "access-token")

    assert repository.function == "release_accepted_request"
    assert repository.payload == {"target_request_id": REQUEST_ID}
    assert result.status == "open"


class NoCoordinatesRepository(FakeRepository):
    async def select(self, table, *, params):
        rows = await super().select(table, params=params)
        if table == 'shopping_requests':
            for row in rows:
                row['delivery_latitude'] = None
                row['delivery_longitude'] = None
        return rows


@pytest.mark.asyncio
async def test_explore_without_order_coordinates():
    service = MarketplaceService(NoCoordinatesRepository())
    rows = await service.list_explore_requests(USER_ID, query=None, latitude=10.78, longitude=106.70, limit=10, radius_meters=None)
    assert len(rows) == 1 and rows[0].distance_meters is None
    nearby = await service.list_explore_requests(USER_ID, query=None, latitude=10.78, longitude=106.70, limit=10, radius_meters=3000)
    assert nearby == []
    detail = await service.get_explore_request(UUID(REQUEST_ID), USER_ID, latitude=10.78, longitude=106.70)
    assert detail.distance_meters is None
