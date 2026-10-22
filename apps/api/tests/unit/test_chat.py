from uuid import UUID

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.v1.endpoints import orders
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseError
from app.services.chat import ChatService

CUSTOMER = '11111111-1111-4111-8111-111111111111'
SHOPPER = '22222222-2222-4222-8222-222222222222'
OUTSIDER = '33333333-3333-4333-8333-333333333333'
REQUEST = '44444444-4444-4444-8444-444444444444'
ASSIGNMENT = '55555555-5555-4555-8555-555555555555'
KEY = '66666666-6666-4666-8666-666666666666'
STAMP = '2026-10-23T09:02:00Z'
BODY = {'body': ' Xin chào ', 'clientKey': KEY, 'assignmentId': ASSIGNMENT}


class Repository:
    def __init__(self):
        self.calls = []
        self.error = None
        self.released = False
        self.status = 'accepted'
        self.rows = [dict(id=9007199254740993, sender_id=SHOPPER, body='Xin chào', client_key=KEY, created_at=STAMP)]

    async def select_one(self, table, *, params):
        self.calls.append((table, params))
        if table == 'shopping_requests':
            return dict(id=REQUEST, customer_id=CUSTOMER, title='Bữa tối', status=self.status,
                        estimated_items_total=100000, delivery_fee=20000, currency='VND')
        if table == 'request_assignments':
            if self.released:
                return None
            return dict(id=ASSIGNMENT, shopper_id=SHOPPER, accepted_at=STAMP, status='active')
        if table == 'profiles':
            return dict(id=SHOPPER if params['id'] == f'eq.{SHOPPER}' else CUSTOMER, display_name='Test')
        raise AssertionError(table)

    async def select(self, table, *, params):
        self.calls.append((table, params))
        if table == 'messages':
            return self.rows.copy()
        if table == 'request_items':
            return [{'id': 'item'}]
        raise AssertionError(table)

    async def rpc_as_user(self, function, *, payload, access_token):
        self.calls.append((function, payload, access_token))
        if self.error:
            raise SupabaseError(self.error)
        return {**self.rows[0], 'id': str(self.rows[0]['id'])}


@pytest.fixture
def api():
    app = FastAPI()
    app.include_router(orders.router, prefix='/api/v1')
    repo = Repository()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(CUSTOMER), 'verified-token')
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app) as client:
        yield client, repo, app


def test_send_uses_atomic_user_rpc_and_normalizes_text(api):
    client, repo, _ = api
    response = client.post(f'/api/v1/orders/{REQUEST}/chat/messages', json=BODY)
    assert response.status_code == 201
    assert response.json()['id'] == '9007199254740993'
    assert repo.calls == [('send_order_message', {
        'target_request_id': REQUEST, 'target_assignment_id': ASSIGNMENT,
        'message_body': 'Xin chào', 'message_key': KEY,
    }, 'verified-token')]


@pytest.mark.parametrize('changes', [{'body': ' \n\t '}, {'body': 'a'*4001}, {'body': '\x00'},
    {'senderId': SHOPPER}, {'clientKey': 'bad'}, {'assignmentId': 'bad'}, {'body': None}])
def test_rejects_invalid_or_spoofed_message_before_rpc(api, changes):
    client, repo, _ = api
    assert client.post(f'/api/v1/orders/{REQUEST}/chat/messages', json={**BODY, **changes}).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('error,code', [('chat_not_found',404), ('chat_read_only',409),
    ('active_profile_required',403), ('invalid_message',422), ('message_key_conflict',409)])
def test_transaction_errors_are_actionable(api, error, code):
    client, repo, _ = api
    repo.error = error
    response = client.post(f'/api/v1/orders/{REQUEST}/chat/messages', json=BODY)
    assert response.status_code == code
    assert response.json()['detail'] != error


@pytest.mark.parametrize('path,method', [('chat','get'), ('chat/messages','post')])
def test_requires_auth(api, path, method):
    client, repo, app = api
    del app.dependency_overrides[get_current_user]
    kwargs = {'json': BODY} if method == 'post' else {}
    assert getattr(client, method)(f'/api/v1/orders/{REQUEST}/{path}', **kwargs).status_code == 401
    assert not repo.calls


@pytest.mark.parametrize('status,can_send', [('accepted', True), ('shopping', True),
    ('delivering', True), ('delivered', True), ('disputed', True), ('completed', False), ('cancelled', False)])
def test_chat_status_and_string_ids(api, status, can_send):
    client, repo, _ = api
    repo.status = status
    response = client.get(f'/api/v1/orders/{REQUEST}/chat')
    assert response.status_code == 200
    result = response.json()
    assert result['canSend'] is can_send
    assert result['assignmentId'] == ASSIGNMENT
    assert result['messages'][0]['id'] == '9007199254740993'


async def test_outsider_cannot_load_messages():
    repo = Repository()
    with pytest.raises(HTTPException) as error:
        await ChatService(repo).get(UUID(REQUEST), UUID(OUTSIDER), before=None, after=None, limit=50)
    assert error.value.status_code == 404
    assert not any(call[0] == 'messages' for call in repo.calls)


async def test_released_assignment_does_not_expose_history():
    repo = Repository()
    repo.released = True
    with pytest.raises(HTTPException) as error:
        await ChatService(repo).get(UUID(REQUEST), UUID(SHOPPER), before=None, after=None, limit=50)
    assert error.value.status_code == 404
    assert not any(call[0] == 'messages' for call in repo.calls)


async def test_release_during_read_drops_fetched_history():
    class ReleasingRepository(Repository):
        async def select(self, table, *, params):
            result = await super().select(table, params=params)
            if table == 'messages':
                self.released = True
            return result
    with pytest.raises(HTTPException) as error:
        await ChatService(ReleasingRepository()).get(UUID(REQUEST), UUID(CUSTOMER), before=None, after=None, limit=50)
    assert error.value.status_code == 404


def test_catchup_is_ascending_and_returns_newest_first(api):
    client, repo, _ = api
    repo.rows = [{**repo.rows[0], 'id': i} for i in [2, 3, 4]]
    response = client.get(f'/api/v1/orders/{REQUEST}/chat?after=1&limit=2')
    assert response.status_code == 200
    assert [m['id'] for m in response.json()['messages']] == ['3', '2']
    assert response.json()['hasMore'] is True
    query = next(params for table, params in repo.calls if table == 'messages')
    assert query['id'] == 'gt.1' and query['order'] == 'id.asc' and query['limit'] == '3'


def test_older_history_cursor(api):
    client, repo, _ = api
    assert client.get(f'/api/v1/orders/{REQUEST}/chat?before=9007199254740993').status_code == 200
    query = next(params for table, params in repo.calls if table == 'messages')
    assert query['id'] == 'lt.9007199254740993' and query['order'] == 'id.desc'


@pytest.mark.parametrize('query', ['before=1&after=2', 'before=-1', 'after=9223372036854775808', 'limit=101'])
def test_invalid_pagination(api, query):
    client, repo, _ = api
    assert client.get(f'/api/v1/orders/{REQUEST}/chat?{query}').status_code == 422
    assert not repo.calls
