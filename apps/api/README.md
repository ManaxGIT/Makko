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
- `GET /api/v1/explore/{request_id}`
- `GET /api/v1/orders`
- `POST /api/v1/orders`
- `GET /api/v1/orders/{request_id}/tracking`
- `GET /api/v1/orders/{request_id}/details`
- `POST /api/v1/orders/{request_id}/accept`
- `POST /api/v1/orders/{request_id}/release`
- `POST /api/v1/orders/{request_id}/publish`
- `PATCH /api/v1/orders/{request_id}/status`

All endpoints except health and OpenAPI documentation require
`Authorization: Bearer <access-token>`.

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

## Delivery addresses

- `GET /api/v1/addresses?limit=50&offset=0`: the authenticated user's saved
  addresses, default first and then newest first. `limit` is 1–100.
- `POST /api/v1/addresses`: creates an address; returns `201` and the saved row.
- `GET /api/v1/locations/provinces`: province codes and display names.
- `GET /api/v1/locations/provinces/{province_code}/wards`: wards for one province.

All four require a Supabase access token. Example POST body (codes must come from
this API's directory; coordinates here are illustrative):

```json
{
  "label": "Nhà",
  "recipientName": "Nguyễn Văn An",
  "recipientPhone": "0901234567",
  "line1": "12 Nguyễn Huệ",
  "provinceCode": "79",
  "wardCode": "26740",
  "latitude": 10.77,
  "longitude": 106.70,
  "isDefault": true
}
```

Optional fields: `line2`, `deliveryNote`, `isDefault` (default `false`). Blank
optional strings should be omitted or sent as `null`. Coordinates are optional: omit both or send both as null. If supplied, both
are required together, finite and range checked. The API does not geocode or certify that a
point matches the street address; a future address picker must let the user
confirm the actual delivery location rather than use an administrative centroid.

Province and ward codes are strings. The ward must belong to the province. The
server derives `city` and `ward` display text from the directory and sets
`district` to null for new two-level addresses. It rejects supplied ownership or
canonical-name fields. Responses use camelCase and include `id`, the address
fields, `isDefault`, `createdAt` and `updatedAt`. Legacy rows may have null
`provinceCode` and `wardCode`; their existing text and coordinates remain intact.

`create_delivery_address` runs as the authenticated user (RLS remains active).
It locks that user's profile, checks the account is active, and atomically clears
the old default only when the new address requests `isDefault: true`. It never
modifies another user's address. A failed save rolls back the default change.
An address not marked default remains non-default, even when it is the first;
the existing home fallback to newest address still applies.

Missing/invalid authentication returns `401`; inactive profiles cannot create
addresses (`403`); malformed bodies, incomplete coordinate pairs, or mismatched
administrative codes return `422`. An unknown province in the ward-list route
returns `404`. Unexpected upstream failures retain the existing `502` behavior.

Apply `add_delivery_addresses`, then `seed_vietnamese_provinces_v520`, then
`optional_address_coordinates`.
The directory is pinned to Vietnamese Provinces Database v5.2.0; provenance and
MIT license are under `supabase/data/vietnamese-provinces/`. No automatic download
runs at API startup. The mobile delivery form saves a default address immediately and reloads it
for the signed-in account. No map provider is needed for saving an address.
Order publication also permits missing coordinates. Missing coordinates never
produce an invented distance and do not match a coordinate-based radius filter.

Run `pytest` from `apps/api` for HTTP/service validation. Execute
`supabase/tests/delivery_addresses.sql` against a migrated development database
with an active profile to check RLS, canonical codes, coordinates and atomic
default replacement; it rolls back all test writes.


## Create and publish a shopping request

`POST /api/v1/orders` accepts an authenticated user's saved `addressId`,
`submissionKey` (16–100 ASCII letters/digits/underscore/hyphen), `items`, an
ISO-8601 `deliverBy` with timezone, `deliveryFee`, `paymentMethod` (`cash` or
`bank_transfer`), optional `estimatedItemsTotal` and `deliveryNote`.
Each item contains `name`, positive `quantity` (up to 3 decimal places), `unit`,
optional `note` and `allowSubstitution`. The list must contain 1–100 items.
The title is derived from item names; no extra title input is required.

The response is `201` with `{ "requestId": "<uuid>", "status": "open" }`.
A replay returns the same request ID and its current status. Scope keys to one
logical submission and reuse the same key and body after an uncertain network
response. Never generate a fresh key merely because the response was lost.
The mobile form locks edits during uncertain submission and offers a retry.
Keys and pending form data are session-only; there is no saved-order draft or
background outbox. After restarting the app, check My Orders for prior submissions.

`create_and_publish_request` serializes submissions per account, verifies an
active profile and ownership of the saved address, snapshots the address, inserts
items, and invokes the existing `publish_request` RPC in the same transaction.
Errors roll back all inserts; no intermediate draft is exposed by this workflow.
The address may lack coordinates. Existing request coordinate values are retained.
A missing address returns `404`, inactive account `403`, invalid values or a past
delivery deadline `422`. The database checks the deadline on first submission,
not on an idempotent replay. Unexpected upstream errors keep the `502` behavior.

Apply `create_and_publish_request`, `allow_request_policy_checks`, and
`allow_owner_request_returning` after the address migrations. The policy-check migration grants authenticated execution of two existing
private ownership predicates needed to evaluate RLS; it does not bypass RLS or
grant anonymous access. The owner policy checks the row's customer directly so
`INSERT RETURNING` can read a newly inserted owned request.
Run `supabase/tests/create_and_publish_request.sql` on a
development database with active profiles to verify publication, snapshots,
ownership, replay safety and transaction rollback. It rolls back all test writes.

## Edit an existing request

- `GET /api/v1/orders/{id}/edit` returns the owner's editable order, items,
  address snapshot and `updatedAt`. Other owners receive 404; non-editable
  statuses receive 409.
- `PATCH /api/v1/orders/{id}` accepts the same editable fields as creation,
  plus `expectedUpdatedAt` and optional existing item IDs. `addressId: null`
  retains the order's snapshot; a supplied owned address replaces it.
  `submissionKey` identifies one edit attempt and is reused on network retries.

Apply `update_shopping_request`. Its authenticated RPC locks the request before
writing, permits only owned draft/open orders, checks the loaded version, and
saves the complete item collection and order fields in one transaction. It keeps
publication status/time and metadata of retained items. An edit never creates a
new order or publishes a draft. Concurrent acceptance or stale edits are rejected.
The mobile editor reuses the three-step request form; only the final **Lưu thay đổi**
updates the order. Saving an account address remains a separate immediate action.
Run `supabase/tests/update_shopping_request.sql` for rollback-only database checks.
