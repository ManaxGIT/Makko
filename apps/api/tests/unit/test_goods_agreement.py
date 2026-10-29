from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.v1.endpoints import orders
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseError

REQUEST = '11111111-1111-4111-8111-111111111111'
PROPOSAL = '22222222-2222-4222-8222-222222222222'


class Repository:
    error = None
    def __init__(self):
        self.calls = []

    async def rpc_as_user(self, name, *, payload, access_token):
        self.calls.append((name, payload, access_token))
        if self.error:
            raise SupabaseError(self.error)
        return dict(request_id=REQUEST, role='customer', status='shopping', currency='VND',
                    agreed_amount=180000, delivery_fee=30000, can_propose=False,
                    proposal=dict(id=PROPOSAL, old_amount=180000, new_amount=200000, status='pending',
                                  created_at='2026-10-24T00:00:00Z', responded_at=None))


@pytest.fixture
def api():
    app = FastAPI()
    app.include_router(orders.router, prefix='/api/v1')
    repo = Repository()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(REQUEST), 'verified-token')
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app) as client:
        yield client, repo


def test_get_uses_authenticated_atomic_snapshot(api):
    client, repo = api
    data = client.get(f'/api/v1/orders/{REQUEST}/goods-agreement').json()
    assert data['agreedAmount'] == 180000
    assert data['proposal']['newAmount'] == 200000
    assert repo.calls == [('get_goods_amount_agreement', {'target_request_id': REQUEST}, 'verified-token')]


def test_propose_keeps_current_money_and_uses_exact_decimal(api):
    client, repo = api
    response = client.post(f'/api/v1/orders/{REQUEST}/goods-agreement', json={'amount': 200000.25})
    assert response.status_code == 200
    assert response.json()['agreedAmount'] == 180000
    assert repo.calls == [('propose_goods_amount', {'target_request_id': REQUEST, 'new_goods_amount': '200000.25'}, 'verified-token')]


@pytest.mark.parametrize('accept', [True, False])
def test_response_pins_exact_proposal(api, accept):
    client, repo = api
    response = client.post(f'/api/v1/orders/{REQUEST}/goods-agreement/{PROPOSAL}/response', json={'accept': accept})
    assert response.status_code == 200
    assert repo.calls == [('respond_goods_amount', {'target_request_id': REQUEST, 'target_proposal_id': PROPOSAL, 'accept_proposal': accept}, 'verified-token')]


@pytest.mark.parametrize('body', [{'amount': 0}, {'amount': -1}, {'amount': 0.001}, {'amount': 10000000000}, {'amount': True}, {'amount': 'NaN'}, {'amount': 'Infinity'}, {'amount': 2, 'deliveryFee': 0}, {'amount': 2, 'customerId': REQUEST}])
def test_invalid_amount_or_spoofed_fields_blocked(api, body):
    client, repo = api
    assert client.post(f'/api/v1/orders/{REQUEST}/goods-agreement', json=body).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('body', [{'accept': 'true'}, {'accept': 1}, {'accept': None}, {'accept': True, 'newAmount': 1}])
def test_invalid_consent_blocked(api, body):
    client, repo = api
    assert client.post(f'/api/v1/orders/{REQUEST}/goods-agreement/{PROPOSAL}/response', json=body).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('error,code', [('agreement_not_found',404), ('agreement_stage_closed',409), ('agreement_pending',409), ('agreement_already_resolved',409), ('agreement_amount_changed',409), ('invalid_goods_amount',422), ('active_profile_required',403), ('authentication_required',401)])
def test_rpc_conflicts_are_readable(api, error, code):
    client, repo = api
    repo.error = error
    assert client.post(f'/api/v1/orders/{REQUEST}/goods-agreement', json={'amount': 200000}).status_code == code
