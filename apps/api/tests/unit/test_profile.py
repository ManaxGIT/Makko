from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import home
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser

USER = '11111111-1111-4111-8111-111111111111'


def test_profile_only_reads_authenticated_account_reputation():
    class Repository:
        async def count(self, table, *, params):
            if table == 'shopping_requests':
                assert params['status'] == 'eq.completed'
                assert params['customer_id'] == f'eq.{USER}'
                return 3
            assert table == 'request_assignments'
            assert params['status'] == 'eq.completed'
            assert params['shopper_id'] == f'eq.{USER}'
            assert params['released_at'] == 'is.null'
            return 2

        async def select_one(self, table, *, params):
            assert table == 'profiles'
            assert params['id'] == f'eq.{USER}'
            assert params['account_status'] == 'eq.active'
            return dict(id=USER, display_name='Test', created_at='2026-10-23T00:00:00Z', average_rating=4.5, rating_count=2)
    app = FastAPI()
    app.include_router(home.router, prefix='/api/v1')
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(USER), 'token')
    app.dependency_overrides[get_repository] = Repository
    with TestClient(app) as client:
        response = client.get('/api/v1/home/profile')
        assert response.status_code == 200
        assert response.json()['averageRating'] == 4.5
        assert response.json()['ratingCount'] == 2
        assert response.json()['completedCustomerCount'] == 3
        assert response.json()['completedShopperCount'] == 2


async def test_exact_count_does_not_fetch_or_truncate_rows():
    import httpx
    from app.repositories.supabase import SupabaseRepository

    def handler(request):
        assert request.method == 'HEAD'
        assert request.headers['prefer'] == 'count=exact'
        assert request.url.params['customer_id'] == f'eq.{USER}'
        assert request.url.params['status'] == 'eq.completed'
        return httpx.Response(200, headers={'Content-Range': '0-999/1005'})

    async with httpx.AsyncClient(base_url='https://example.test', transport=httpx.MockTransport(handler)) as client:
        repository = SupabaseRepository(client, 'secret', 'publishable')
        assert await repository.count('shopping_requests', params={'customer_id': f'eq.{USER}', 'status': 'eq.completed'}) == 1005


async def test_empty_count_is_zero():
    import httpx
    from app.repositories.supabase import SupabaseRepository

    async with httpx.AsyncClient(base_url='https://example.test', transport=httpx.MockTransport(lambda _: httpx.Response(200, headers={'Content-Range': '*/0'}))) as client:
        assert await SupabaseRepository(client, 'secret', 'publishable').count('request_assignments', params={'shopper_id': f'eq.{USER}'}) == 0


def test_update_uses_user_rpc_and_only_editable_fields():
    class Repository:
        calls = []
        async def rpc_as_user(self, function, *, payload, access_token):
            self.calls.append((function, payload, access_token))
            return dict(display_name=payload['profile_name'], phone=payload['profile_phone'], bio=payload['profile_bio'], avatar_path=payload['profile_avatar'])
    repo = Repository()
    app = FastAPI()
    app.include_router(home.router, prefix='/api/v1')
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(UUID(USER), 'verified-token')
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app) as client:
        response = client.patch('/api/v1/home/profile', json={'displayName': ' Nam ', 'phone': None, 'bio': ' Hello ', 'avatarPath': None})
        assert response.status_code == 200
        assert response.json()['displayName'] == 'Nam'
        assert repo.calls == [('update_account_profile', {'profile_name': 'Nam', 'profile_phone': None, 'profile_bio': 'Hello', 'profile_avatar': None}, 'verified-token')]
        for changes in [{'id': USER}, {'averageRating': 5}, {'email': 'spoofed@example.test'}, {'displayName': '  '}, {'bio': 'a'*501}, {'avatarPath': '\x00'}, {'phone': '1'*33}]:
            assert client.patch('/api/v1/home/profile', json={'displayName':'Nam', 'avatarPath':None, **changes}).status_code == 422
        assert len(repo.calls) == 1
        assert client.patch('/api/v1/home/profile', json={'displayName':'Nam'}).status_code == 422
