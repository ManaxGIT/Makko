from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import orders
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseError

CUSTOMER = '11111111-1111-4111-8111-111111111111'
SHOPPER = '22222222-2222-4222-8222-222222222222'
OUTSIDER = '33333333-3333-4333-8333-333333333333'
REQUEST = '44444444-4444-4444-8444-444444444444'
REVIEW = dict(id='55555555-5555-4555-8555-555555555555', rating=4, comment='Tốt', created_at='2026-10-23T09:00:00Z')


class Repository:
    def __init__(self):
        self.error = None
        self.calls = []
        self.review = None
        self.status = 'completed'

    async def select_one(self, table, *, params):
        self.calls.append((table, params))
        if table == 'shopping_requests':
            return dict(id=REQUEST, customer_id=CUSTOMER, title='Trứng', status=self.status)
        if table == 'request_assignments':
            assert params['released_at'] == 'is.null'
            return dict(shopper_id=SHOPPER)
        if table == 'profiles':
            return dict(id=params['id'][3:], display_name='Test', avatar_path=None, average_rating=4, rating_count=1)
        if table == 'reviews':
            return self.review
        raise AssertionError(table)

    async def rpc_as_user(self, function, *, payload, access_token):
        self.calls.append((function, payload, access_token))
        if self.error:
            raise SupabaseError(self.error)
        return REVIEW


@pytest.fixture
def api():
    app = FastAPI()
    app.include_router(orders.router, prefix='/api/v1')
    repo = Repository()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(CUSTOMER), 'verified-token')
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app) as client:
        yield client, repo, app


def test_submit_atomic_rpc_and_strips_comment(api):
    client, repo, _ = api
    response = client.post(f'/api/v1/orders/{REQUEST}/review', json={'rating': 4, 'comment': ' Tốt '})
    assert response.status_code == 201
    assert response.json()['createdAt']
    assert repo.calls == [('submit_order_review', {'target_request_id': REQUEST, 'review_rating': 4, 'review_comment': 'Tốt'}, 'verified-token')]


@pytest.mark.parametrize('body', [{'rating': 0}, {'rating': 6}, {'rating': 1.5}, {'rating': True}, {'rating': '5'}, {'rating': 5, 'comment': 'x'*1001}, {'rating': 5, 'comment': '\x00'}, {'rating': 5, 'revieweeId': OUTSIDER}])
def test_validation_blocks_spoofing_and_invalid_ratings(api, body):
    client, repo, _ = api
    assert client.post(f'/api/v1/orders/{REQUEST}/review', json=body).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('user,other', [(CUSTOMER, SHOPPER), (SHOPPER, CUSTOMER)])
def test_both_sides_review_current_counterpart(api, user, other):
    client, repo, app = api
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(user), 'token')
    response = client.get(f'/api/v1/orders/{REQUEST}/review')
    assert response.status_code == 200
    assert response.json()['counterpart']['id'] == other
    assert response.json()['canReview'] is True
    assert repo.calls[-1][1]['reviewer_id'] == f'eq.{user}'


def test_outsider_cannot_read_review_context(api):
    client, repo, app = api
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(OUTSIDER), 'token')
    assert client.get(f'/api/v1/orders/{REQUEST}/review').status_code == 404
    assert len(repo.calls) == 2


@pytest.mark.parametrize('status', ['delivered', 'cancelled', 'shopping'])
def test_unfinished_and_cancelled_cannot_review(api, status):
    client, repo, _ = api
    repo.status = status
    assert client.get(f'/api/v1/orders/{REQUEST}/review').json()['canReview'] is False


def test_existing_review_readonly(api):
    client, repo, _ = api
    repo.review = REVIEW
    payload = client.get(f'/api/v1/orders/{REQUEST}/review').json()
    assert payload['review']['rating'] == 4
    assert payload['canReview'] is False


@pytest.mark.parametrize('error,code', [('review_not_found',404), ('review_not_completed',409), ('review_already_submitted',409), ('invalid_review',422), ('active_profile_required',403), ('authentication_required',401)])
def test_rpc_errors(api, error, code):
    client, repo, _ = api
    repo.error = error
    response = client.post(f'/api/v1/orders/{REQUEST}/review', json={'rating': 4})
    assert response.status_code == code
    assert response.json()['detail'] != error
