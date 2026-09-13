# Makko API

FastAPI is the application-data boundary between the Expo client and Supabase.
All feature-data HTTP endpoints live here; the mobile app does not call database
tables or read-only RPCs directly.

## Structure

- `app/api/v1/endpoints/`: HTTP route handlers.
- `app/core/`: settings, security, logging, and application-wide concerns.
- `app/dependencies/`: FastAPI dependency providers.
- `app/models/`: internal domain or persistence models.
- `app/schemas/`: Pydantic request and response schemas.
- `app/services/`: business use cases.
- `app/repositories/`: database access boundaries.
- `tests/unit/`: isolated business tests.
- `tests/integration/`: API and database integration tests.

## Boundary with Supabase

- FastAPI validates every Bearer token with Supabase Auth.
- Repositories use `SUPABASE_SECRET_KEY` on the server and scope every query with
  the verified user ID. The secret key must never be copied to mobile.
- Normal reads and application orchestration live in FastAPI.
- Atomic workflows such as `accept_request`, `publish_request`, and
  `transition_request` remain PostgreSQL RPCs. FastAPI calls those functions
  instead of duplicating transaction or locking logic.
- Mobile may still use Supabase Auth directly to establish and refresh sessions.

## Current endpoints

- `GET /api/v1/health`
- `GET /api/v1/home`
- `GET /api/v1/explore`
- `GET /api/v1/orders`
- `POST /api/v1/orders/{request_id}/accept`
- `POST /api/v1/orders/{request_id}/publish`
- `PATCH /api/v1/orders/{request_id}/status`

The three feature endpoints require `Authorization: Bearer <access-token>`.

## Run locally

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0
```

Fill `.env` with the Supabase URL, publishable key, and a server-only secret key.
The `0.0.0.0` binding lets a physical phone on the same Wi-Fi reach the API.
Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the computer's LAN address,
for example `http://192.168.1.9:8000`. The address may change when reconnecting
to Wi-Fi; on macOS, find the current address with `ipconfig getifaddr en0`.

OpenAPI documentation remains available on the computer at
`http://localhost:8000/docs` and from the phone at
`http://<computer-lan-ip>:8000/docs`.

Run tests with `pytest`.
