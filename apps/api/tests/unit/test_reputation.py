from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import home
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser

USER = '11111111-1111-4111-8111-111111111111'
PERSON = '22222222-2222-4222-8222-222222222222'
ORDER = '33333333-3333-4333-8333-333333333333'
REVIEW = '44444444-4444-4444-8444-444444444444'


class Repository:
    def __init__(self):
        self.empty = False
        self.customer = PERSON
        self.calls = []

    async def select_one(self, table, *, params):
        assert table == 'profiles'
        assert params['id'] == f'eq.{USER}'
        assert params['account_status'] == 'eq.active'
        return dict(average_rating=4.5, rating_count=0 if self.empty else 2)

    async def select(self, table, *, params):
        self.calls.append((table, params))
        if table == 'reviews':
            assert params['reviewee_id'] == f'eq.{USER}'
            assert params['order'] == 'created_at.desc,id.desc'
            return [] if self.empty else [dict(id=REVIEW, request_id=ORDER, reviewer_id=PERSON, rating=5, comment=None, created_at='2026-10-23T00:00:00Z')] * 2
        if table == 'profiles':
            assert params['id'] == f'in.({PERSON})'
            return [dict(id=PERSON, display_name='Test')]
        if table == 'shopping_requests':
            assert params['id'] == f'in.({ORDER})'
            return [dict(id=ORDER, title='Trứng', customer_id=self.customer)]
        raise AssertionError(table)


@pytest.fixture
def api():
    app = FastAPI()
    app.include_router(home.router, prefix='/api/v1')
    repo = Repository()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(USER), 'token')
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app) as client:
        yield client, repo


@pytest.mark.parametrize('customer,role', [(PERSON, 'customer'), (USER, 'shopper')])
def test_received_reviews_scoped_paginated_and_labelled(api, customer, role):
    client, repo = api
    repo.customer = customer
    response = client.get('/api/v1/home/profile/reviews?limit=1&offset=2&reviewee_id=spoofed')
    assert response.status_code == 200
    data = response.json()
    assert data['ratingCount'] == 2
    assert data['averageRating'] == 4.5
    assert data['hasMore'] is True
    assert len(data['reviews']) == 1
    assert data['reviews'][0]['reviewerRole'] == role
    assert data['reviews'][0]['requestTitle'] == 'Trứng'
    assert data['reviews'][0]['reviewerName'] == 'Test'
    assert 'reviewerId' not in data['reviews'][0]
    assert repo.calls[0][1]['offset'] == '2'
    assert repo.calls[0][1]['limit'] == '2'


def test_empty_does_not_query_other_profiles_or_orders(api):
    client, repo = api
    repo.empty = True
    data = client.get('/api/v1/home/profile/reviews').json()
    assert data['reviews'] == []
    assert data['hasMore'] is False
    assert len(repo.calls) == 1


@pytest.mark.parametrize('query', ['limit=0', 'limit=51', 'offset=-1'])
def test_invalid_pagination_rejected(api, query):
    client, repo = api
    assert client.get('/api/v1/home/profile/reviews?' + query).status_code == 422
    assert not repo.calls
