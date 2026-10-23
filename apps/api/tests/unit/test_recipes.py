from uuid import UUID

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.api.v1.endpoints.orders import router
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.services.recipes import RecipeService
from app.services.marketplace import MarketplaceService
from tests.unit.test_marketplace import TrackingRepository, USER_ID, CUSTOMER_ID, REQUEST_ID

SNAPSHOT = {'title': 'Súp bí đỏ', 'cooking_minutes': 30, 'servings': 2,
            'ingredients': [{'name': 'Bơ lạt', 'quantity': 20, 'unit': 'g'}], 'steps': ['Nấu nguyên liệu đến khi chín.']}


class OwnerRepository:
    async def select_one(self, table, *, params):
        assert table == 'order_recipes'
        assert params['request_id'] == f'eq.{REQUEST_ID}'
        return {'snapshot': SNAPSHOT} if params['customer_id'] == f'eq.{USER_ID}' else None


@pytest.mark.asyncio
async def test_recipe_is_owner_only_even_for_secret_key_reads():
    service = RecipeService(OwnerRepository())
    assert (await service.get(UUID(REQUEST_ID), USER_ID)).servings == 2
    with pytest.raises(LookupError):
        await service.get(UUID(REQUEST_ID), UUID(CUSTOMER_ID))


class RecipeTrackingRepository(TrackingRepository):
    async def select(self, table, *, params):
        if table == 'order_recipes':
            assert params['customer_id'] == f'eq.{USER_ID}'
            return [{'request_id': REQUEST_ID}]
        return await super().select(table, params=params)


@pytest.mark.asyncio
async def test_tracking_only_discloses_recipe_presence_to_customer():
    service = MarketplaceService(RecipeTrackingRepository())
    assert (await service.get_order_tracking(UUID(REQUEST_ID), USER_ID)).has_recipe
    # Assigned shopper can track the order but must not even query the recipe table.
    assert not (await service.get_order_tracking(UUID(REQUEST_ID), UUID(CUSTOMER_ID))).has_recipe


def test_recipe_endpoint_auth_owner_camel_case_and_no_shopper_access():
    app = FastAPI()
    app.include_router(router, prefix='/api/v1')
    @app.exception_handler(LookupError)
    async def not_found(request: Request, error: LookupError):
        return JSONResponse(status_code=404, content={'detail': str(error)})
    app.dependency_overrides[get_repository] = lambda: OwnerRepository()
    with TestClient(app) as client:
        path = f'/api/v1/orders/{REQUEST_ID}/recipe'
        assert client.get(path).status_code == 401
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(USER_ID, 'test-token')
        result = client.get(path)
        assert result.status_code == 200
        assert result.json()['cookingMinutes'] == 30
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(CUSTOMER_ID), 'test-token')
        assert client.get(path).status_code == 404
