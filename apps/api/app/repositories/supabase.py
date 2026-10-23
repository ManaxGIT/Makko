from typing import Any

import httpx


class SupabaseError(RuntimeError):
    pass


class SupabaseRepository:
    def __init__(self, client: httpx.AsyncClient, secret_key: str, publishable_key: str) -> None:
        self._client = client
        self._publishable_key = publishable_key
        # Modern sb_secret_* keys are sent only as apikey; they are not JWTs.
        self._headers = {"apikey": secret_key}

    async def select(
        self,
        table: str,
        *,
        params: dict[str, str],
    ) -> list[dict[str, Any]]:
        response = await self._client.get(
            f"/rest/v1/{table}", params=params, headers=self._headers
        )
        if response.is_error:
            raise SupabaseError(f"Supabase query failed ({response.status_code})")
        payload = response.json()
        if not isinstance(payload, list):
            raise SupabaseError("Supabase returned an invalid collection")
        return payload

    async def count(self, table: str, *, params: dict[str, str]) -> int:
        response = await self._client.head(
            f"/rest/v1/{table}", params={**params, 'select': 'id'},
            headers={**self._headers, 'Prefer': 'count=exact'},
        )
        if response.is_error:
            raise SupabaseError(f"Supabase count failed ({response.status_code})")
        total = response.headers.get('content-range', '').rsplit('/', 1)[-1]
        if not total.isdigit():
            raise SupabaseError('Supabase returned an invalid count')
        return int(total)

    async def select_one(
        self,
        table: str,
        *,
        params: dict[str, str],
    ) -> dict[str, Any] | None:
        rows = await self.select(table, params={**params, "limit": "1"})
        return rows[0] if rows else None

    async def rpc_as_user(
        self,
        function: str,
        *,
        payload: dict[str, Any],
        access_token: str,
    ) -> Any:
        response = await self._client.post(
            f"/rest/v1/rpc/{function}",
            json=payload,
            headers={
                "apikey": self._publishable_key,
                "Authorization": f"Bearer {access_token}",
            },
        )
        if response.is_error:
            detail = response.json().get("message") if response.headers.get("content-type", "").startswith("application/json") else None
            raise SupabaseError(detail or f"Supabase transaction failed ({response.status_code})")
        return response.json()
