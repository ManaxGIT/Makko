from copy import deepcopy
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import orders
from app.core.config import Settings, get_settings
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseError

USER = CurrentUser(UUID('3e0765f0-afea-4a7d-9fd4-2e4b1036572d'), 'test-token')
BODY = {
    'submissionKey': 'test-submission-0001',
    'addressId': 'f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc',
    'items': [{'name': 'Rau muống', 'quantity': '0.5', 'unit': 'bó', 'note': 'Rau non', 'allowSubstitution': True}],
    'deliverBy': '2030-01-01T10:00:00+07:00', 'estimatedItemsTotal': '100000',
    'deliveryFee': '25000', 'paymentMethod': 'cash', 'deliveryNote': 'Gọi khi đến',
}


class Repository:
    def __init__(self):
        self.calls = []
        self.error = None

    async def rpc_as_user(self, function, *, payload, access_token):
        self.calls.append((function, payload, access_token))
        if self.error:
            raise SupabaseError(self.error)
        return {'request_id': 'f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc', 'status': 'open'}


@pytest.fixture
def api():
    app = FastAPI()
    app.include_router(orders.router, prefix='/api/v1')
    repo = Repository()
    app.dependency_overrides[get_current_user] = lambda: USER
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, supabase_url='https://example.invalid',
        supabase_publishable_key='test', supabase_secret_key='test',
    )
    with TestClient(app) as client:
        yield client, repo, app


def test_post_uses_one_authenticated_transaction(api):
    client, repo, _ = api
    result = client.post('/api/v1/orders', json=BODY)
    assert result.status_code == 201
    assert result.json()['status'] == 'open' and result.json()['requestId']
    assert len(repo.calls) == 1
    function, payload, token = repo.calls[0]
    assert function == 'create_and_publish_request' and token == USER.access_token
    request = payload['p_request']
    assert request['submission_key'] == BODY['submissionKey']
    assert request['items'][0]['quantity'] == '0.5'
    assert request['items'][0]['allow_substitution'] is True
    assert request['estimated_items_total'] == '100000'
    assert 'customer_id' not in request and 'latitude' not in request


@pytest.mark.parametrize('change', [
    {'items': []}, {'submissionKey': 'short'}, {'addressId': 'invalid'},
    {'deliverBy': '2030-01-01T10:00:00'}, {'deliveryFee': '-1'},
    {'deliveryFee': '10000000000'}, {'estimatedItemsTotal': '-1'},
    {'paymentMethod': 'unsupported'}, {'customerId': str(USER.id)},
    {'deliveryNote': 'a' * 501},
])
def test_invalid_request_does_not_reach_database(api, change):
    client, repo, _ = api
    assert client.post('/api/v1/orders', json={**BODY, **change}).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('change', [
    {'quantity': '0'}, {'quantity': '0.0001'}, {'quantity': '10000000'},
    {'quantity': 'NaN'}, {'name': ' '}, {'unit': 'a' * 31}, {'note': 'a' * 501},
])
def test_invalid_item_does_not_reach_database(api, change):
    client, repo, _ = api
    body = deepcopy(BODY)
    body['items'][0].update(change)
    assert client.post('/api/v1/orders', json=body).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('error,code', [('invalid_request',422), ('delivery_time_must_be_future',422), ('address_not_found',404), ('active_profile_required',403)])
def test_transaction_rejection(api, error, code):
    client, repo, _ = api
    repo.error = error
    assert client.post('/api/v1/orders', json=BODY).status_code == code


def test_post_requires_authentication(api):
    client, repo, app = api
    del app.dependency_overrides[get_current_user]
    assert client.post('/api/v1/orders', json=BODY).status_code == 401
    assert not repo.calls


@pytest.mark.parametrize('title,expected', [(None,None), ('',None), ('   ',None), ('  Trái cây cho cả nhà  ','Trái cây cho cả nhà'), ('a'*120,'a'*120)])
def test_optional_title_is_normalized(api, title, expected):
    client, repo, _ = api
    assert client.post('/api/v1/orders', json={**BODY, 'title': title}).status_code == 201
    assert repo.calls[0][1]['p_request']['title'] == expected


@pytest.mark.parametrize('title', ['ab', 'a'*121, 123])
def test_invalid_title_is_rejected(api, title):
    client, repo, _ = api
    assert client.post('/api/v1/orders', json={**BODY, 'title': title}).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('amount', [None, '0', '-1'])
def test_fixed_amount_is_required(api, amount):
    client, repo, _ = api
    assert client.post('/api/v1/orders', json={**BODY, 'estimatedItemsTotal': amount}).status_code == 422
    assert not repo.calls


def test_recipe_is_saved_in_the_same_creation_rpc(api):
    from tests.unit.test_recipes import SNAPSHOT
    client, repo, _ = api
    result = client.post('/api/v1/orders', json={**BODY, 'recipe': SNAPSHOT})
    assert result.status_code == 201
    assert len(repo.calls) == 1
    assert repo.calls[0][1]['p_request']['recipe'] == SNAPSHOT


def test_invalid_recipe_rejects_entire_creation(api):
    from tests.unit.test_recipes import SNAPSHOT
    client, repo, _ = api
    assert client.post('/api/v1/orders', json={**BODY, 'recipe': {**SNAPSHOT, 'steps': []}}).status_code == 422
    assert not repo.calls
