import json
from unittest.mock import AsyncMock, patch
from uuid import UUID

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.meals import MealPreferences, MealSuggestions
from app.services.meals import MealService


def settings(key='test-key'):
    return Settings(_env_file=None, supabase_url='https://example.supabase.co', supabase_publishable_key='test', supabase_secret_key='test', gemini_api_key=key)


def suggestion(**changes):
    return dict(title='Trứng sốt cà chua', description='Bữa ăn hai người.', cookingMinutes=20, suggestedGoodsAmount=45000, ingredients=[dict(name='Trứng gà', quantity=4, unit='quả', note='Mua trứng nguyên quả')], recipe=dict(title='Trứng sốt cà chua', cookingMinutes=20, servings=2, ingredients=[dict(name='Trứng gà', quantity=4, unit='quả')], steps=['Sơ chế và nấu trứng đến khi chín đều.'])) | changes


def three_suggestions(**first_changes):
    return [suggestion(**first_changes), suggestion(title='Đậu phụ kho nấm'), suggestion(title='Shakshuka')]


def response_body(result, finish='STOP'):
    return {'candidates': [{'finishReason': finish, 'content': {'parts': [{'text': json.dumps(result)}]}}]}


prefs = MealPreferences(meal='Ăn khuya', people=2, budget=100000, avoid='Tôm', pantry='Gạo', style='Món Tây, nhiều nước, thử món mới')


@pytest.mark.asyncio
async def test_generation_context_and_credentials():
    def handler(request):
        assert request.headers['x-goog-api-key'] == 'test-key'
        assert 'Authorization' not in request.headers
        body = json.loads(request.content)
        assert json.loads(body['contents'][0]['parts'][0]['text'])['preferences'] == prefs.model_dump(by_alias=True)
        assert body['generationConfig']['responseMimeType'] == 'application/json'
        schema = body['generationConfig']['responseSchema']
        assert schema['type'] == 'OBJECT'
        assert schema['properties']['suggestions']['items']['properties']['ingredients']['items']['properties']['quantity']['type'] == 'NUMBER'
        assert '$ref' not in json.dumps(schema)
        return httpx.Response(200, json=response_body({'suggestions': three_suggestions()}))
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await MealService(settings(), client).suggest(prefs)
    assert len(result.suggestions) == 3
    assert result.suggestions[0].ingredients[0].quantity == 4
    assert result.model_dump(by_alias=True)['suggestions'][0]['suggestedGoodsAmount'] == 45000


@pytest.mark.asyncio
@pytest.mark.parametrize('payload', [{}, {'candidates': []}, response_body({}, 'MAX_TOKENS'), response_body({'suggestions': []}), response_body({'suggestions': three_suggestions(suggestedGoodsAmount=100001)}), response_body({'suggestions': three_suggestions(ingredients=[dict(name='Gạo', quantity=-1, unit='kg')])} )])
async def test_rejects_bad_or_over_budget_results(payload):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))) as client:
        with pytest.raises(HTTPException) as error:
            await MealService(settings(), client).suggest(prefs)
    assert error.value.status_code == 502


@pytest.mark.asyncio
@pytest.mark.parametrize('status,expected', [(429, 429), (403, 502), (500, 502)])
async def test_provider_errors_are_sanitized(status, expected):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(status, json={'error': 'secret'}))) as client:
        with pytest.raises(HTTPException) as error:
            await MealService(settings(), client).suggest(prefs)
    assert error.value.status_code == expected
    assert 'secret' not in error.value.detail


@pytest.mark.asyncio
async def test_provider_overload_is_explained_without_retrying():
    calls = 0
    def handler(request):
        nonlocal calls
        calls += 1
        return httpx.Response(503, json={'error': {'message': 'secret'}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(HTTPException) as error:
            await MealService(settings(), client).suggest(prefs)
    assert error.value.status_code == 502
    assert 'quá tải' in error.value.detail
    assert 'secret' not in error.value.detail
    assert calls == 1


@pytest.mark.asyncio
async def test_timeout_and_missing_configuration():
    def timeout(request):
        raise httpx.ReadTimeout('secret', request=request)
    async with httpx.AsyncClient(transport=httpx.MockTransport(timeout)) as client:
        with pytest.raises(HTTPException) as error:
            await MealService(settings(), client).suggest(prefs)
        assert error.value.status_code == 504
        with pytest.raises(HTTPException) as error:
            await MealService(settings(None), client).suggest(prefs)
        assert error.value.status_code == 503


def test_input_limits_and_result_precision():
    for changes in ({'meal': ' '}, {'people': 0}, {'budget': -1}, {'pantry': 'a' * 1001}, {'style': 'a' * 1001}):
        with pytest.raises(ValidationError):
            MealPreferences.model_validate(prefs.model_dump() | changes)
    for ingredients in ([dict(name='Gạo', quantity=.0001, unit='kg')], [dict(name='Gạo', quantity=1, unit='kg'), dict(name='gạo', quantity=2, unit='kg')]):
        with pytest.raises(ValidationError):
            MealSuggestions.model_validate({'suggestions': three_suggestions(ingredients=ingredients)})


@pytest.mark.asyncio
async def test_endpoint_authentication_and_response_contract():
    from app.main import app
    from app.dependencies.auth import get_current_user
    from app.models.user import CurrentUser
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/v1/meals/suggestions', json=prefs.model_dump(by_alias=True))
        assert response.status_code == 401
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=UUID('00000000-0000-0000-0000-000000000001'), access_token='test')
        try:
            result = MealSuggestions.model_validate({'suggestions': three_suggestions()})
            with patch.object(MealService, 'suggest', new=AsyncMock(return_value=result)):
                response = await client.post('/api/v1/meals/suggestions', json=prefs.model_dump(by_alias=True))
            assert response.status_code == 200
            assert response.json()['suggestions'][0]['suggestedGoodsAmount'] == 45000
        finally:
            app.dependency_overrides.pop(get_current_user, None)


def test_style_is_optional_for_existing_clients():
    original = prefs.model_dump(exclude={'style'})
    assert MealPreferences.model_validate(original).style == ''


@pytest.mark.parametrize('choices', [three_suggestions()[:2], three_suggestions() + [suggestion(title='Món thứ tư')], [suggestion(), suggestion(), suggestion()]])
def test_requires_three_distinct_suggestions(choices):
    with pytest.raises(ValidationError):
        MealSuggestions.model_validate({'suggestions': choices})


@pytest.mark.parametrize('recipe_change', [{'steps': []}, {'steps': [' ']}, {'servings': 0}, {'cookingMinutes': 0}])
def test_invalid_cooking_instructions_rejected(recipe_change):
    value = suggestion()
    value['recipe'].update(recipe_change)
    with pytest.raises(ValidationError):
        MealSuggestions.model_validate({'suggestions': [value, suggestion(title='Món hai'), suggestion(title='Món ba')]})
