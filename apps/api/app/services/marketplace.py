import math
from collections import Counter
from typing import Any
from uuid import UUID

from app.repositories.supabase import SupabaseRepository
from app.schemas.explore import ExploreItem, ExploreRequest
from app.schemas.home import HomeDashboard, HomeLocation, HomeProfile
from app.schemas.orders import (
    OrderActionResult,
    OrderCounterpart,
    OrderDetail,
    OrderStatus,
    OrderStatusEvent,
    OrderSummary,
    OrderTracking,
)


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius = 6_371_000
    first_latitude, second_latitude = math.radians(lat1), math.radians(lat2)
    latitude_delta = math.radians(lat2 - lat1)
    longitude_delta = math.radians(lon2 - lon1)
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(first_latitude) * math.cos(second_latitude)
        * math.sin(longitude_delta / 2) ** 2
    )
    return earth_radius * 2 * math.asin(math.sqrt(min(1, value)))


class MarketplaceService:
    def __init__(self, repository: SupabaseRepository) -> None:
        self.repository = repository

    async def list_explore_requests(
        self,
        user_id: UUID,
        *,
        query: str | None,
        latitude: float | None,
        longitude: float | None,
        limit: int,
        radius_meters: int | None,
    ) -> list[ExploreRequest]:
        requests = await self.repository.select(
            "shopping_requests",
            params={
                "select": "id,customer_id,title,description,currency,estimated_items_total,delivery_fee,deliver_by,delivery_ward,delivery_district,delivery_city,delivery_latitude,delivery_longitude,published_at,created_at",
                "status": "eq.open",
                "customer_id": f"neq.{user_id}",
                "order": "published_at.desc.nullslast,created_at.desc",
                "limit": "100",
            },
        )
        request_ids = [row["id"] for row in requests]
        customer_ids = sorted({row["customer_id"] for row in requests})
        profiles = await self._profiles(customer_ids)
        items = await self._items(request_ids)
        needle = (query or "").strip().casefold()
        results: list[ExploreRequest] = []

        for request in requests:
            profile = profiles.get(request["customer_id"])
            if profile is None or profile.get("account_status") != "active":
                continue
            request_items = items.get(request["id"], [])
            searchable = " ".join([
                str(request["title"]), str(request.get("description") or ""),
                str(profile["display_name"]),
                *(str(item["name"]) for item in request_items),
            ]).casefold()
            if needle and needle not in searchable:
                continue

            distance = None
            if (latitude is not None and longitude is not None
                    and request.get("delivery_latitude") is not None
                    and request.get("delivery_longitude") is not None):
                distance = haversine_meters(
                    latitude, longitude,
                    float(request["delivery_latitude"]), float(request["delivery_longitude"]),
                )
            if latitude is not None and longitude is not None and radius_meters is not None:
                if distance is None or distance > radius_meters:
                    continue

            results.append(ExploreRequest(
                id=request["id"], customer_id=request["customer_id"],
                owner_display_name=profile["display_name"],
                owner_avatar_path=profile.get("avatar_path"),
                owner_average_rating=profile["average_rating"],
                owner_rating_count=profile["rating_count"], title=request["title"],
                description=request.get("description"), currency=request["currency"],
                estimated_items_total=request.get("estimated_items_total"),
                delivery_fee=request["delivery_fee"], deliver_by=request.get("deliver_by"),
                delivery_ward=request.get("delivery_ward"),
                delivery_district=request.get("delivery_district"),
                delivery_city=request["delivery_city"], published_at=request.get("published_at"),
                distance_meters=distance, item_count=len(request_items),
                items=[ExploreItem(**item) for item in request_items],
            ))

        if latitude is not None and longitude is not None:
            results.sort(key=lambda item: item.distance_meters if item.distance_meters is not None else math.inf)
        return results[:limit]

    async def get_home_dashboard(self, user_id: UUID, *, nearby_limit: int) -> HomeDashboard:
        profile = await self.repository.select_one(
            "profiles",
            params={"select": "id,display_name,avatar_path,account_status", "id": f"eq.{user_id}"},
        )
        if profile is None or profile.get("account_status") != "active":
            raise LookupError("Profile not found")
        address = await self.repository.select_one(
            "addresses",
            params={
                "select": "ward,district,city,latitude,longitude,is_default,created_at",
                "owner_id": f"eq.{user_id}", "order": "is_default.desc,created_at.desc",
            },
        )
        location = HomeLocation(**address) if address else None
        nearby = await self.list_explore_requests(
            user_id, query=None,
            latitude=location.latitude if location else None,
            longitude=location.longitude if location else None,
            limit=nearby_limit, radius_meters=3_000,
        )
        return HomeDashboard(
            profile=HomeProfile(**profile), location=location, nearby_requests=nearby
        )

    async def get_explore_request(
        self,
        request_id: UUID,
        user_id: UUID,
        *,
        latitude: float | None,
        longitude: float | None,
    ) -> ExploreRequest:
        request = await self.repository.select_one(
            "shopping_requests",
            params={
                "select": "id,customer_id,title,description,currency,estimated_items_total,delivery_fee,deliver_by,delivery_ward,delivery_district,delivery_city,delivery_latitude,delivery_longitude,published_at",
                "id": f"eq.{request_id}",
                "status": "eq.open",
                "customer_id": f"neq.{user_id}",
            },
        )
        if request is None:
            raise LookupError("Request not found")

        profile = await self.repository.select_one(
            "profiles",
            params={
                "select": "id,display_name,avatar_path,average_rating,rating_count,account_status",
                "id": f"eq.{request['customer_id']}",
                "account_status": "eq.active",
            },
        )
        if profile is None:
            raise LookupError("Request not found")

        items = (await self._items([request["id"]])).get(request["id"], [])
        distance = None
        if (latitude is not None and longitude is not None
                and request.get("delivery_latitude") is not None
                and request.get("delivery_longitude") is not None):
            distance = haversine_meters(
                latitude,
                longitude,
                float(request["delivery_latitude"]),
                float(request["delivery_longitude"]),
            )

        return ExploreRequest(
            id=request["id"],
            customer_id=request["customer_id"],
            owner_display_name=profile["display_name"],
            owner_avatar_path=profile.get("avatar_path"),
            owner_average_rating=profile["average_rating"],
            owner_rating_count=profile["rating_count"],
            title=request["title"],
            description=request.get("description"),
            currency=request["currency"],
            estimated_items_total=request.get("estimated_items_total"),
            delivery_fee=request["delivery_fee"],
            deliver_by=request.get("deliver_by"),
            delivery_ward=request.get("delivery_ward"),
            delivery_district=request.get("delivery_district"),
            delivery_city=request["delivery_city"],
            published_at=request.get("published_at"),
            distance_meters=distance,
            item_count=len(items),
            items=[ExploreItem(**item) for item in items],
        )

    async def list_orders(self, user_id: UUID, *, limit: int) -> list[OrderSummary]:
        shopper_assignments = await self.repository.select(
            "request_assignments",
            params={
                "select": "request_id,shopper_id,accepted_at,released_at",
                "shopper_id": f"eq.{user_id}", "released_at": "is.null", "limit": "100",
            },
        )
        shopper_request_ids = [row["request_id"] for row in shopper_assignments]
        owned = await self.repository.select(
            "shopping_requests",
            params={"select": self._order_columns(), "customer_id": f"eq.{user_id}", "limit": "100"},
        )
        shopping = []
        if shopper_request_ids:
            shopping = await self.repository.select(
                "shopping_requests",
                params={"select": self._order_columns(), "id": f"in.({','.join(shopper_request_ids)})", "limit": "100"},
            )
        request_map = {row["id"]: row for row in [*owned, *shopping]}
        request_ids = list(request_map)
        assignments = await self._assignments(request_ids)
        item_counts = await self._item_counts(request_ids)
        counterpart_ids: set[str] = set()
        for request in request_map.values():
            assignment = assignments.get(request["id"])
            counterpart_id = assignment.get("shopper_id") if request["customer_id"] == str(user_id) and assignment else request["customer_id"]
            if counterpart_id and counterpart_id != str(user_id):
                counterpart_ids.add(counterpart_id)
        profiles = await self._profiles(sorted(counterpart_ids))

        results: list[OrderSummary] = []
        for request in request_map.values():
            assignment = assignments.get(request["id"])
            role = "customer" if request["customer_id"] == str(user_id) else "shopper"
            counterpart_id = assignment.get("shopper_id") if role == "customer" and assignment else request["customer_id"]
            profile = profiles.get(counterpart_id) if counterpart_id else None
            counterpart = OrderCounterpart(
                id=profile["id"], display_name=profile["display_name"],
                avatar_path=profile.get("avatar_path"), average_rating=profile["average_rating"],
                rating_count=profile["rating_count"],
            ) if profile else None
            results.append(OrderSummary(
                **request, role=role, item_count=item_counts[request["id"]],
                counterpart=counterpart,
                assignment_accepted_at=assignment.get("accepted_at") if assignment else None,
            ))
        terminal = {"completed", "cancelled"}
        active = [item for item in results if item.status not in terminal]
        done = [item for item in results if item.status in terminal]
        active.sort(key=lambda item: item.published_at or item.created_at, reverse=True)
        done.sort(key=lambda item: item.completed_at or item.cancelled_at or item.created_at, reverse=True)
        return [*active, *done][:limit]

    async def get_order_tracking(self, request_id: UUID, user_id: UUID) -> OrderTracking:
        request = await self.repository.select_one(
            "shopping_requests",
            params={
                "select": "id,customer_id,status,deliver_by",
                "id": f"eq.{request_id}",
            },
        )
        if request is None:
            raise LookupError("Order not found")

        assignment = await self.repository.select_one(
            "request_assignments",
            params={
                "select": "shopper_id,accepted_at,released_at",
                "request_id": f"eq.{request_id}",
                "released_at": "is.null",
            },
        )
        current_user_id = str(user_id)
        is_customer = request["customer_id"] == current_user_id
        is_shopper = assignment is not None and assignment["shopper_id"] == current_user_id
        if not is_customer and not is_shopper:
            raise LookupError("Order not found")

        counterpart_id = (
            assignment["shopper_id"]
            if is_customer and assignment
            else request["customer_id"] if is_shopper else None
        )
        profile_rows = await self._profiles([counterpart_id]) if counterpart_id else {}
        profile = profile_rows.get(counterpart_id) if counterpart_id else None
        counterpart = OrderCounterpart(
            id=profile["id"],
            display_name=profile["display_name"],
            avatar_path=profile.get("avatar_path"),
            average_rating=profile["average_rating"],
            rating_count=profile["rating_count"],
        ) if profile else None

        history_rows = await self.repository.select(
            "request_status_history",
            params={
                "select": "id,to_status,created_at",
                "request_id": f"eq.{request_id}",
                "order": "created_at.asc,id.asc",
                "limit": "100",
            },
        )
        return OrderTracking(
            id=request["id"],
            role="customer" if is_customer else "shopper",
            status=request["status"],
            deliver_by=request.get("deliver_by"),
            counterpart=counterpart,
            assignment_accepted_at=assignment.get("accepted_at") if assignment else None,
            status_history=[OrderStatusEvent(**row) for row in history_rows],
        )

    async def get_order_detail(
        self,
        request_id: UUID,
        user_id: UUID,
        *,
        latitude: float | None,
        longitude: float | None,
    ) -> OrderDetail:
        request = await self.repository.select_one(
            "shopping_requests",
            params={
                "select": "id,customer_id,title,description,status,currency,estimated_items_total,delivery_fee,deliver_by,delivery_ward,delivery_district,delivery_city,delivery_latitude,delivery_longitude,published_at",
                "id": f"eq.{request_id}",
            },
        )
        if request is None:
            raise LookupError("Order not found")

        assignment = await self.repository.select_one(
            "request_assignments",
            params={
                "select": "shopper_id,released_at",
                "request_id": f"eq.{request_id}",
                "released_at": "is.null",
            },
        )
        current_user_id = str(user_id)
        is_customer = request["customer_id"] == current_user_id
        is_shopper = assignment is not None and assignment["shopper_id"] == current_user_id
        if not is_customer and not is_shopper:
            raise LookupError("Order not found")

        profile = await self.repository.select_one(
            "profiles",
            params={
                "select": "id,display_name,avatar_path,average_rating,rating_count,account_status",
                "id": f"eq.{request['customer_id']}",
                "account_status": "eq.active",
            },
        )
        if profile is None:
            raise LookupError("Order not found")

        items = (await self._items([request["id"]])).get(request["id"], [])
        distance = None
        if (latitude is not None and longitude is not None
                and request.get("delivery_latitude") is not None
                and request.get("delivery_longitude") is not None):
            distance = haversine_meters(
                latitude,
                longitude,
                float(request["delivery_latitude"]),
                float(request["delivery_longitude"]),
            )

        return OrderDetail(
            id=request["id"], customer_id=request["customer_id"],
            owner_display_name=profile["display_name"],
            owner_avatar_path=profile.get("avatar_path"),
            owner_average_rating=profile["average_rating"],
            owner_rating_count=profile["rating_count"], title=request["title"],
            description=request.get("description"), currency=request["currency"],
            estimated_items_total=request.get("estimated_items_total"),
            delivery_fee=request["delivery_fee"], deliver_by=request.get("deliver_by"),
            delivery_ward=request.get("delivery_ward"),
            delivery_district=request.get("delivery_district"),
            delivery_city=request["delivery_city"], published_at=request.get("published_at"),
            distance_meters=distance, item_count=len(items),
            items=[ExploreItem(**item) for item in items],
            role="customer" if is_customer else "shopper", status=request["status"],
        )

    async def accept_request(self, request_id: UUID, access_token: str) -> OrderActionResult:
        await self.repository.rpc_as_user(
            "accept_request", payload={"target_request_id": str(request_id)},
            access_token=access_token,
        )
        return OrderActionResult(request_id=request_id, status="accepted")

    async def release_accepted_request(
        self, request_id: UUID, access_token: str
    ) -> OrderActionResult:
        await self.repository.rpc_as_user(
            "release_accepted_request",
            payload={"target_request_id": str(request_id)},
            access_token=access_token,
        )
        return OrderActionResult(request_id=request_id, status="open")

    async def publish_request(self, request_id: UUID, access_token: str) -> OrderActionResult:
        await self.repository.rpc_as_user(
            "publish_request", payload={"target_request_id": str(request_id)},
            access_token=access_token,
        )
        return OrderActionResult(request_id=request_id, status="open")

    async def transition_request(
        self, request_id: UUID, target_status: OrderStatus, access_token: str
    ) -> OrderActionResult:
        await self.repository.rpc_as_user(
            "transition_request",
            payload={"target_request_id": str(request_id), "target_status": target_status},
            access_token=access_token,
        )
        return OrderActionResult(request_id=request_id, status=target_status)

    async def _profiles(self, ids: list[str]) -> dict[str, dict[str, Any]]:
        if not ids:
            return {}
        rows = await self.repository.select(
            "profiles",
            params={
                "select": "id,display_name,avatar_path,average_rating,rating_count,account_status",
                "id": f"in.({','.join(ids)})", "limit": "100",
            },
        )
        return {row["id"]: row for row in rows}

    async def _items(self, request_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
        if not request_ids:
            return {}
        rows = await self.repository.select(
            "request_items",
            params={
                "select": "id,request_id,name,quantity,unit,estimated_unit_price,note,allow_substitution,sort_order",
                "request_id": f"in.({','.join(request_ids)})", "order": "sort_order.asc", "limit": "1000",
            },
        )
        grouped: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            request_id = row.pop("request_id")
            grouped.setdefault(request_id, []).append(row)
        return grouped

    async def _item_counts(self, request_ids: list[str]) -> Counter[str]:
        if not request_ids:
            return Counter()
        rows = await self.repository.select(
            "request_items",
            params={"select": "request_id", "request_id": f"in.({','.join(request_ids)})", "limit": "1000"},
        )
        return Counter(row["request_id"] for row in rows)

    async def _assignments(self, request_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not request_ids:
            return {}
        rows = await self.repository.select(
            "request_assignments",
            params={
                "select": "request_id,shopper_id,accepted_at,released_at",
                "request_id": f"in.({','.join(request_ids)})", "released_at": "is.null", "limit": "100",
            },
        )
        return {row["request_id"]: row for row in rows}

    @staticmethod
    def _order_columns() -> str:
        return "id,customer_id,title,status,currency,estimated_items_total,delivery_fee,actual_items_total,deliver_by,published_at,completed_at,cancelled_at,created_at"
