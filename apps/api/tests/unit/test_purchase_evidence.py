import pytest
from tests.unit.test_create_request import api, USER
from app.services.purchase_evidence import PurchaseEvidenceService

ID = 'f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc'
BODY = {'checkedItemIds': [ID], 'photos': [{'kind': 'goods', 'storagePath': f'{USER.id}/{ID}/photo.jpg'}]}


def test_submit_passes_user_and_one_atomic_rpc(api):
    client, repo, _ = api
    assert client.post(f'/api/v1/orders/{ID}/evidence', json=BODY).status_code == 200
    function, payload, token = repo.calls[0]
    assert function == 'submit_purchase_evidence'
    assert token == USER.access_token
    assert payload['photos'][0]['storage_path'] == BODY['photos'][0]['storagePath']
    assert payload['checked_item_ids'] == [ID]
    assert len(repo.calls) == 1


@pytest.mark.parametrize('body', [
    {**BODY, 'checkedItemIds': []}, {**BODY, 'photos': []},
    {**BODY, 'photos': [{'kind': 'other', 'storagePath': 'path'}]},
])
def test_invalid_evidence_rejected_before_rpc(api, body):
    client, repo, _ = api
    assert client.post(f'/api/v1/orders/{ID}/evidence', json=body).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize('message,status', [('request_not_found',404), ('request_not_shopping',409), ('items_not_confirmed',422), ('goods_photo_required',422), ('invalid_evidence',422)])
def test_evidence_errors_are_actionable(api, message, status):
    client, repo, _ = api
    repo.error = message
    result = client.post(f'/api/v1/orders/{ID}/evidence', json=BODY)
    assert result.status_code == status
    assert result.json()['detail'] != message


async def test_evidence_list_checks_participation_first():
    class Repo:
        calls = []
        async def select_one(self, table, **kwargs):
            self.calls.append(table)
            return None
        async def select(self, table, **kwargs):
            raise AssertionError('Must not read photos before authorizing participant')
    repo = Repo()
    with pytest.raises(LookupError):
        await PurchaseEvidenceService(repo).list(ID, USER.id)
    assert repo.calls == ['shopping_requests']
