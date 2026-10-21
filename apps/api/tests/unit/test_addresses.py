from copy import deepcopy
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.endpoints import addresses, locations
from app.core.config import Settings, get_settings
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseError
from app.schemas.addresses import CreateAddressBody

USER = CurrentUser(UUID('3e0765f0-afea-4a7d-9fd4-2e4b1036572d'), 'test-token')
BODY = dict(label='Nhà', recipientName='Người nhận', recipientPhone='0901234567',
            line1='12 Nguyễn Huệ', provinceCode='79', wardCode='26740',
            latitude=10.77, longitude=106.70, isDefault=True)
ROW = dict(id='f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc', label='Nhà',
           recipient_name='Người nhận', recipient_phone='0901234567',
           line1='12 Nguyễn Huệ', line2=None, province_code='79', ward_code='26740',
           city='Thành phố Hồ Chí Minh', district=None, ward='Phường Sài Gòn',
           latitude=10.77, longitude=106.70, delivery_note=None, is_default=True,
           created_at='2026-10-20T00:00:00Z', updated_at='2026-10-20T00:00:00Z')


class Repository:
    def __init__(self):
        self.calls = []
        self.error = None

    async def select(self, table, *, params):
        self.calls.append((table, params))
        if table == 'addresses':
            return [deepcopy(ROW)]
        if table == 'provinces':
            return [dict(code='79', name='Hồ Chí Minh', full_name='Thành phố Hồ Chí Minh')]
        return [dict(code='26740', name='Sài Gòn', full_name='Phường Sài Gòn', province_code='79')]

    async def select_one(self, table, *, params):
        self.calls.append((table, params))
        return {'code': '79'} if params['code'] == 'eq.79' else None

    async def rpc_as_user(self, function, *, payload, access_token):
        self.calls.append((function, payload, access_token))
        if self.error:
            raise SupabaseError(self.error)
        return deepcopy(ROW)


@pytest.fixture
def api():
    app = FastAPI()
    app.include_router(addresses.router, prefix='/api/v1')
    app.include_router(locations.router, prefix='/api/v1')
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, supabase_url='https://example.invalid',
        supabase_publishable_key='test-publishable', supabase_secret_key='test-secret',
    )
    repo = Repository()
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app) as client:
        yield client, repo, app


def test_create_uses_user_token_and_returns_camel_case(api):
    client, repo, _ = api
    result = client.post('/api/v1/addresses', json=BODY)
    assert result.status_code == 201
    assert result.json()['provinceCode'] == '79'
    assert 'ownerId' not in result.json()
    function, payload, token = repo.calls[0]
    assert function == 'create_delivery_address'
    assert token == USER.access_token
    assert payload['p_address']['ward_code'] == '26740'
    assert 'owner_id' not in payload['p_address']


def test_list_scopes_to_verified_owner_and_orders_defaults_first(api):
    client, repo, _ = api
    result = client.get('/api/v1/addresses?limit=10&offset=10')
    assert result.status_code == 200
    table, params = repo.calls[0]
    assert table == 'addresses'
    assert params['owner_id'] == f'eq.{USER.id}'
    assert params['order'] == 'is_default.desc,created_at.desc,id.asc'
    assert params['limit'] == '10' and params['offset'] == '10'


@pytest.mark.parametrize('change', [
    {'latitude': None}, {'longitude': None}, {'latitude': 91}, {'longitude': -181},
    {'label': '   '}, {'line1': '  '}, {'recipientName': ''},
    {'recipientPhone': '0       '}, {'provinceCode': '1'}, {'wardCode': 'abcde'},
    {'ownerId': str(USER.id)}, {'city': 'tên tự giả'},
])
def test_invalid_body_never_writes(api, change):
    client, repo, _ = api
    assert client.post('/api/v1/addresses', json={**BODY, **change}).status_code == 422
    assert not repo.calls


def test_coordinates_required_and_finite():
    for field in ('latitude', 'longitude'):
        body = dict(BODY)
        del body[field]
        with pytest.raises(ValidationError):
            CreateAddressBody(**body)
        for value in (float('nan'), float('inf'), float('-inf')):
            with pytest.raises(ValidationError):
                CreateAddressBody(**{**BODY, field: value})


def test_unknown_or_mismatched_codes_are_validation_error(api):
    client, repo, _ = api
    repo.error = 'Invalid delivery address'
    assert client.post('/api/v1/addresses', json=BODY).status_code == 422


def test_inactive_profile_is_forbidden(api):
    client, repo, _ = api
    repo.error = 'Active profile required'
    assert client.post('/api/v1/addresses', json=BODY).status_code == 403


def test_directory_is_filtered_by_province(api):
    client, repo, _ = api
    assert client.get('/api/v1/locations/provinces').json()[0]['code'] == '79'
    response = client.get('/api/v1/locations/provinces/79/wards')
    assert response.json()[0]['provinceCode'] == '79'
    assert repo.calls[-1][1]['province_code'] == 'eq.79'
    assert client.get('/api/v1/locations/provinces/invalid/wards').status_code == 422


@pytest.mark.parametrize('method,path', [('get', '/api/v1/addresses'), ('post', '/api/v1/addresses'),
    ('get', '/api/v1/locations/provinces'), ('get', '/api/v1/locations/provinces/79/wards')])
def test_auth_required(api, method, path):
    client, repo, app = api
    del app.dependency_overrides[get_current_user]
    # Missing bearer token is rejected before reaching repository/network.
    kwargs = {'json': BODY} if method == 'post' else {}
    assert getattr(client, method)(path, **kwargs).status_code == 401
    assert not repo.calls


def test_legacy_address_can_still_be_serialized():
    from app.schemas.addresses import Address
    row = {**ROW, 'province_code': None, 'ward_code': None, 'district': 'Quận 1'}
    result = Address(**row).model_dump(by_alias=True)
    assert result['provinceCode'] is None and result['wardCode'] is None
    assert result['district'] == 'Quận 1'


@pytest.mark.asyncio
async def test_unknown_province_does_not_return_unfiltered_wards():
    from app.services.addresses import AddressService
    repo = Repository()
    with pytest.raises(LookupError, match='Province not found'):
        await AddressService(repo).list_wards('00')
    assert len(repo.calls) == 1
    assert repo.calls[0][0] == 'provinces'


@pytest.mark.parametrize('coordinates', [{}, {'latitude': None, 'longitude': None}])
def test_save_address_without_coordinates(api, coordinates):
    client, repo, _ = api
    body = {key: value for key, value in BODY.items() if key not in ('latitude', 'longitude')}
    result = client.post('/api/v1/addresses', json={**body, **coordinates})
    assert result.status_code == 201
    payload = repo.calls[0][1]['p_address']
    assert payload['latitude'] is None and payload['longitude'] is None


def test_address_and_home_accept_null_coordinates():
    from app.schemas.addresses import Address
    from app.schemas.home import HomeLocation
    assert Address(**{**ROW, 'latitude': None, 'longitude': None}).latitude is None
    assert HomeLocation(ward='Phường Sài Gòn', district=None, city='Hồ Chí Minh', latitude=None, longitude=None).longitude is None


@pytest.mark.asyncio
async def test_home_does_not_use_missing_coordinates_for_distance():
    from unittest.mock import AsyncMock
    from app.services.marketplace import MarketplaceService
    repo = Repository()
    repo.select_one = AsyncMock(side_effect=[
        {'id': str(USER.id), 'display_name': 'Test', 'avatar_path': None, 'account_status': 'active'},
        {'ward': 'Phường Sài Gòn', 'district': None, 'city': 'Hồ Chí Minh', 'latitude': None, 'longitude': None},
    ])
    service = MarketplaceService(repo)
    service.list_explore_requests = AsyncMock(return_value=[])
    result = await service.get_home_dashboard(USER.id, nearby_limit=1)
    assert result.location is not None and result.location.latitude is None
    assert service.list_explore_requests.call_args.kwargs['latitude'] is None
    assert service.list_explore_requests.call_args.kwargs['longitude'] is None
