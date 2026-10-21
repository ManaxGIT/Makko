import pytest
from fastapi import HTTPException
from app.services.edit_request import EditRequestService
from tests.unit.test_create_request import api, BODY, USER

ID = 'f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc'
EDIT = {**BODY, 'addressId': None, 'expectedUpdatedAt': '2026-10-21T00:00:00Z'}


def test_edit_uses_atomic_rpc_and_user_token(api):
    client, repo, _ = api
    result = client.patch(f'/api/v1/orders/{ID}', json=EDIT)
    assert result.status_code == 200
    assert result.json()['requestId'] == ID
    function, payload, token = repo.calls[0]
    assert function == 'update_shopping_request' and token == USER.access_token
    assert payload['target_request_id'] == ID
    assert payload['p_request']['address_id'] is None
    assert payload['p_request']['expected_updated_at']


@pytest.mark.parametrize('change', [{'expectedUpdatedAt': None}, {'items': []}, {'customerId': str(USER.id)}, {'status': 'accepted'}])
def test_invalid_edit_rejected(api, change):
    client, repo, _ = api
    assert client.patch(f'/api/v1/orders/{ID}', json={**EDIT, **change}).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('error,code', [('request_not_found',404), ('request_not_editable',409), ('request_changed',409), ('address_not_found',404)])
def test_edit_conflicts(api, error, code):
    client, repo, _ = api
    repo.error = error
    assert client.patch(f'/api/v1/orders/{ID}', json=EDIT).status_code == code


def test_edit_requires_authentication(api):
    from app.dependencies.auth import get_current_user
    client, repo, app = api
    del app.dependency_overrides[get_current_user]
    assert client.patch(f'/api/v1/orders/{ID}', json=EDIT).status_code == 401
    assert client.get(f'/api/v1/orders/{ID}/edit').status_code == 401
    assert not repo.calls


class ReadRepository:
    def __init__(self, status='open'):
        self.row = {
            'id': ID, 'title': 'Trái cây cho cả nhà', 'status': status, 'updated_at': '2026-10-21T00:00:00Z',
            'delivery_phone': '0901234567', 'delivery_line1': 'Original street', 'delivery_line2': None,
            'delivery_ward': 'Original ward', 'delivery_district': None, 'delivery_city': 'Original city',
            'deliver_by': BODY['deliverBy'], 'estimated_items_total': None, 'delivery_fee': 25000,
            'payment_method': 'cash', 'delivery_note': None,
            'request_items': [{'id': ID, 'name': 'Rau', 'quantity': 0.5, 'unit': 'bó', 'note': None,
                               'allow_substitution': True, 'sort_order': 0}],
        }

    async def select_one(self, table, *, params):
        assert table == 'shopping_requests'
        assert params['customer_id'] == f'eq.{USER.id}' and params['id'] == f'eq.{ID}'
        return self.row


@pytest.mark.asyncio
async def test_edit_read_preserves_order_snapshot():
    result = await EditRequestService(ReadRepository()).get(ID, USER.id)
    assert result.address.line1 == 'Original street'
    assert str(result.items[0].quantity) == '0.5'


@pytest.mark.asyncio
@pytest.mark.parametrize('status', ['accepted','shopping','completed','cancelled'])
async def test_edit_read_rejects_non_editable_status(status):
    with pytest.raises(HTTPException) as error:
        await EditRequestService(ReadRepository(status)).get(ID, USER.id)
    assert error.value.status_code == 409


@pytest.mark.asyncio
async def test_edit_read_hides_missing_or_other_owner():
    repo = ReadRepository()
    repo.row = None
    with pytest.raises(HTTPException) as error:
        await EditRequestService(repo).get(ID, USER.id)
    assert error.value.status_code == 404


def test_edit_read_http_uses_camel_case(api):
    from app.dependencies.repositories import get_repository
    client, _, app = api
    app.dependency_overrides[get_repository] = lambda: ReadRepository()
    result = client.get(f'/api/v1/orders/{ID}/edit')
    assert result.status_code == 200
    data = result.json()
    assert data['title'] == 'Trái cây cho cả nhà'
    assert data['updatedAt'] and data['address']['recipientPhone'] == '0901234567'
    assert data['items'][0]['allowSubstitution'] is True
    assert 'customerId' not in data


def test_edit_without_title_preserves_legacy_contract(api):
    client, repo, _ = api
    assert client.patch(f'/api/v1/orders/{ID}', json=EDIT).status_code == 200
    assert 'title' not in repo.calls[0][1]['p_request']


@pytest.mark.parametrize('title,expected', [('  Bữa sáng cả nhà  ','Bữa sáng cả nhà'), (' ',None)])
def test_edit_title_or_clear_to_automatic(api, title, expected):
    client, repo, _ = api
    assert client.patch(f'/api/v1/orders/{ID}', json={**EDIT, 'title': title}).status_code == 200
    assert repo.calls[0][1]['p_request']['title'] == expected
