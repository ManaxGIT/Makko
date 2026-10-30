from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import admin, weekly_food
from app.dependencies.auth import get_current_user
from app.dependencies.repositories import get_repository
from app.models.user import CurrentUser
from app.repositories.supabase import SupabaseError

USER='22222222-2222-4222-8222-222222222222'
ORDER='11111111-1111-4111-8111-111111111111'


class Repository:
    def __init__(self):
        self.member=True
        self.active=True
        self.calls=[]
        self.error=None

    async def select_one(self, table, *, params):
        self.calls.append((table,params))
        if table=='admin_memberships':return {'user_id':USER} if self.member else None
        if table=='profiles':return {'id':USER} if self.active else None
        if table=='weekly_food_orders':
            assert params['or']==f'(customer_id.eq.{USER},shopper_id.eq.{USER})'
            return None
        raise AssertionError(table)

    async def rpc_as_user(self, function, *, payload, access_token):
        self.calls.append((function,payload,access_token))
        if self.error:raise SupabaseError(self.error)
        if function=='admin_list_orders':return {'items':[],'total':0,'stats':{'total':0,'handover':0,'delivering':0,'wages':0}}
        if function=='act_weekly_food_order':return 'delivering'
        return ORDER


@pytest.fixture
def api():
    app=FastAPI()
    app.include_router(admin.router,prefix='/api/v1')
    app.include_router(weekly_food.router,prefix='/api/v1')
    repo=Repository()
    app.dependency_overrides[get_current_user]=lambda:CurrentUser(UUID(USER),'verified-token')
    app.dependency_overrides[get_repository]=lambda:repo
    with TestClient(app) as client:yield client,repo,app


def test_membership_rechecked_and_revocation_blocks_read(api):
    client,repo,_=api
    assert client.get('/api/v1/admin/orders').status_code==200
    repo.member=False
    repo.calls=[]
    assert client.get('/api/v1/admin/orders').status_code==403
    assert len(repo.calls)==1


def test_suspended_admin_denied(api):
    client,repo,_=api
    repo.active=False
    assert client.get('/api/v1/admin/me').status_code==403
    assert not any(c[0].startswith('admin_list') for c in repo.calls)


def test_list_filters_and_pagination_forwarded_as_values(api):
    client,repo,_=api
    response=client.get('/api/v1/admin/orders',params={'order_type':'weekly','search_query':" a,b.*' ",'page_offset':25,'work_queue':'handover'})
    assert response.status_code==200
    assert repo.calls[-1]==('admin_list_orders',{'order_type':'weekly','status_filter':'all','search_query':"a,b.*'",'work_queue':'handover','page_offset':25,'page_limit':25},'verified-token')


@pytest.mark.parametrize('params',[{'page_limit':101},{'page_offset':-1},{'search_query':'x'*121},{'order_type':'unknown'}])
def test_invalid_filters_never_reach_sql(api,params):
    client,repo,_=api
    assert client.get('/api/v1/admin/orders',params=params).status_code==422
    assert not any(c[0]=='admin_list_orders' for c in repo.calls)


def test_handover_only_calls_atomic_rpc_with_verified_token(api):
    client,repo,_=api
    assert client.post(f'/api/v1/admin/weekly-orders/{ORDER}/handover',json={}).status_code==200
    assert repo.calls[-1]==('act_weekly_food_order',{'target_order_id':ORDER,'action_name':'handover'},'verified-token')


def test_nonadmin_cannot_handover(api):
    client,repo,_=api
    repo.member=False
    assert client.post(f'/api/v1/admin/weekly-orders/{ORDER}/handover',json={}).status_code==403
    assert not any(c[0]=='act_weekly_food_order' for c in repo.calls)


@pytest.mark.parametrize('error,code',[('admin_required',403),('invalid_transition',409),('order_not_found',404)])
def test_sql_denial_mapped_to_http(api,error,code):
    client,repo,_=api
    repo.error=error
    assert client.post(f'/api/v1/admin/weekly-orders/{ORDER}/pay-wage',json={}).status_code==code


def test_customer_route_cannot_call_admin_action(api):
    client,repo,_=api
    assert client.post(f'/api/v1/weekly-food/orders/{ORDER}/handover',json={}).status_code==422
    assert not any(c[0]=='act_weekly_food_order' for c in repo.calls)


def test_client_cannot_set_price_or_status_when_registering(api):
    client,repo,_=api
    body={'weekId':ORDER,'addressId':ORDER,'people':2,'meals':'dinner','submissionKey':ORDER,'price':1}
    assert client.post('/api/v1/weekly-food/orders',json=body).status_code==422
    assert not repo.calls


def test_weekly_detail_ownership_is_always_scoped(api):
    client,repo,_=api
    assert client.get(f'/api/v1/weekly-food/orders/{ORDER}').status_code==404


def test_unauthenticated_request_requires_bearer_token(api):
    client,_,app=api
    app.dependency_overrides.pop(get_current_user)
    assert client.get('/api/v1/admin/orders').status_code==401


def week_body(start='2099-01-05'):
    return {'weekStart':start,'ingredients':[{'name':'Thịt gà','quantity':'300 g'}]}


def test_admin_publishes_flat_ingredients_with_verified_token(api):
    client,repo,_=api
    response=client.post('/api/v1/admin/weekly-weeks',json=week_body())
    assert response.status_code==201
    assert response.json()=={'id':ORDER}
    assert repo.calls[-1][0]=='admin_publish_weekly_food_week'
    assert repo.calls[-1][1]['week_start_date']=='2099-01-05'
    assert repo.calls[-1][1]['week_menu']==[{'name':'Thịt gà','quantity':'300 g'}]
    assert repo.calls[-1][2]=='verified-token'


@pytest.mark.parametrize('start',['2000-01-03','2099-01-06'])
def test_week_publication_rejects_expired_or_non_monday_before_rpc(api,start):
    client,repo,_=api
    assert client.post('/api/v1/admin/weekly-weeks',json=week_body(start)).status_code==422
    assert not any(c[0]=='admin_publish_weekly_food_week' for c in repo.calls)


def test_non_admin_cannot_publish_week(api):
    client,repo,_=api
    repo.member=False
    assert client.post('/api/v1/admin/weekly-weeks',json=week_body()).status_code==403
    assert not any(c[0]=='admin_publish_weekly_food_week' for c in repo.calls)


def test_duplicate_week_is_conflict_and_never_overwrites_menu(api):
    client,repo,_=api
    repo.error='duplicate key value violates unique constraint "weekly_food_weeks_week_start_key"'
    assert client.post('/api/v1/admin/weekly-weeks',json=week_body()).status_code==409
    assert sum(c[0]=='admin_publish_weekly_food_week' for c in repo.calls)==1


def test_package_requires_nonempty_ingredients_and_quantities(api):
    client,repo,_=api
    for ingredients in [[],[{'name':'Gạo'}],[{'name':' ','quantity':'1 kg'}],[{'name':'Gạo','quantity':' '}],[{'day':'Thứ Hai','lunch':'Gà','dinner':'Cá','ingredients':[]}]]:
        body=week_body();body['ingredients']=ingredients
        assert client.post('/api/v1/admin/weekly-weeks',json=body).status_code==422
    assert not any(c[0]=='admin_publish_weekly_food_week' for c in repo.calls)


def test_storage_column_is_serialized_as_flat_ingredients():
    from app.schemas.weekly_food import WeeklyFoodWeek
    from app.schemas.admin import AdminOrderDetail
    row={'id':ORDER,'week_start':'2026-11-16','delivery_deadline':'2026-11-15T23:59:59+07:00','menu':[{'name':'Gạo','quantity':'2,1 kg'}]}
    result=WeeklyFoodWeek(**row).model_dump(by_alias=True)
    assert result['ingredients']==row['menu']
    assert 'menu' not in result
    assert AdminOrderDetail.model_fields['ingredients'].validation_alias.choices==['ingredients','menu']


def test_old_daily_publication_payload_rejected(api):
    client,repo,_=api
    body=week_body();body['menu']=body.pop('ingredients')
    assert client.post('/api/v1/admin/weekly-weeks',json=body).status_code==422
    assert not any(c[0]=='admin_publish_weekly_food_week' for c in repo.calls)


def test_weekly_catalogue_returns_flat_ingredients_through_route(api):
    from unittest.mock import AsyncMock
    client,repo,_=api
    repo.select=AsyncMock(return_value=[{'id':ORDER,'week_start':'2026-11-16','delivery_deadline':'2026-11-15T23:59:59+07:00','menu':[{'name':'Gạo','quantity':'2,1 kg'}]}])
    response=client.get('/api/v1/weekly-food/weeks')
    assert response.status_code==200
    assert response.json()[0]['ingredients']==[{'name':'Gạo','quantity':'2,1 kg'}]
    assert 'menu' not in response.json()[0]


def test_available_weekly_preview_has_ingredients_but_no_private_customer_fields(api):
    from unittest.mock import AsyncMock
    client,repo,_=api
    repo.rpc_as_user=AsyncMock(return_value=[{'id':ORDER,'people':2,'meals':'dinner','price':449000,'wage':25000,'delivery_deadline':'2026-11-01T23:59:59+07:00','created_at':'2026-10-24T00:00:00+07:00','recipient_phone':'private','delivery_address':'private','week':{'id':ORDER,'week_start':'2026-11-02','delivery_deadline':'2026-11-01T23:59:59+07:00','menu':[{'name':'Gạo','quantity':'1 kg'}]}}])
    response=client.get('/api/v1/weekly-food/available',params={'limit':25,'offset':0})
    assert response.status_code==200
    row=response.json()[0]
    assert row['week']['ingredients']==[{'name':'Gạo','quantity':'1 kg'}]
    assert 'private' not in response.text
    assert 'recipientPhone' not in row and 'deliveryAddress' not in row
    repo.rpc_as_user.assert_awaited_once_with('list_available_weekly_food_orders',payload={'page_limit':25,'page_offset':0},access_token='verified-token')


def test_admin_week_list_includes_expired_weeks_and_order_counts(api):
    from unittest.mock import AsyncMock
    client, repo, _ = api
    repo.rpc_as_user = AsyncMock(return_value={'items': [{'id': ORDER, 'week_start': '2000-01-03', 'delivery_deadline': '2000-01-02T23:59:59+07:00', 'menu': [{'name': 'Gạo', 'quantity': '1 kg'}], 'order_count': 2}], 'total': 26})
    response = client.get('/api/v1/admin/weekly-weeks?page_offset=25&page_limit=25')
    assert response.status_code == 200
    assert response.json()['items'][0]['orderCount'] == 2
    assert response.json()['items'][0]['ingredients'] == [{'name': 'Gạo', 'quantity': '1 kg'}]
    assert 'menu' not in response.json()['items'][0]
    assert response.json()['total'] == 26
    repo.rpc_as_user.assert_awaited_once_with('admin_list_weekly_food_weeks', payload={'page_offset': 25, 'page_limit': 25}, access_token='verified-token')


@pytest.mark.parametrize('params', [{'page_offset': -1}, {'page_limit': 101}, {'page_limit': 0}])
def test_week_list_validates_pagination(api, params):
    client, repo, _ = api
    assert client.get('/api/v1/admin/weekly-weeks', params=params).status_code == 422
    assert not any(c[0] == 'admin_list_weekly_food_weeks' for c in repo.calls)


@pytest.mark.parametrize('path,method', [('/api/v1/admin/weekly-weeks', 'get'), (f'/api/v1/admin/weekly-weeks/{ORDER}/delete', 'post')])
def test_week_management_rechecks_membership_on_every_request(api, path, method):
    client, repo, _ = api
    repo.member = False
    assert getattr(client, method)(path).status_code == 403
    assert not any(c[0] in ('admin_list_weekly_food_weeks', 'admin_delete_weekly_food_week') for c in repo.calls)
    repo.member, repo.active = True, False
    assert getattr(client, method)(path).status_code == 403


def test_delete_week_uses_atomic_rpc_and_verified_token(api):
    client, repo, _ = api
    response = client.post(f'/api/v1/admin/weekly-weeks/{ORDER}/delete', json={})
    assert response.status_code == 200
    assert response.json() == {'id': ORDER}
    assert repo.calls[-1] == ('admin_delete_weekly_food_week', {'target_week_id': ORDER}, 'verified-token')


@pytest.mark.parametrize('error,status', [('week_has_orders', 409), ('week_not_found', 404), ('admin_required', 403)])
def test_delete_week_reports_database_rejection(api, error, status):
    client, repo, _ = api
    repo.error = error
    assert client.post(f'/api/v1/admin/weekly-weeks/{ORDER}/delete', json={}).status_code == status


def test_delete_week_rejects_invalid_id_before_rpc(api):
    client, repo, _ = api
    assert client.post('/api/v1/admin/weekly-weeks/not-a-uuid/delete', json={}).status_code == 422
    assert not any(c[0] == 'admin_delete_weekly_food_week' for c in repo.calls)
