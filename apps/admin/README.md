# Makko Admin

React + TypeScript + Vite web administration client. It uses Supabase only for
Auth; application data goes through the existing FastAPI app. No mock orders
are included in this application. The separate HTML prototype is retained at
`design/figma-import/makko-admin.html`.

## Run locally

Start the existing API (from the repository root):

```sh
cd apps/api
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal:

```sh
cd apps/admin
npm ci
cp .env.example .env
npm run dev
```

Fill `.env` with the same Supabase URL and **publishable** key used by Makko.
`VITE_API_URL` is the API origin, normally `http://localhost:8000` on the same
computer. Open `http://localhost:5173`. Keep the server-only Supabase secret key
in `apps/api/.env`; never put it in a `VITE_*` variable.

Add the admin origin to `API_CORS_ORIGINS` in `apps/api/.env`. The example includes
`http://localhost:5173` and `http://127.0.0.1:5173`. When accessing from another
computer, configure both the API URL and CORS with reachable LAN addresses.
Restart the web after changing its environment. Restart API after CORS changes.

## Access

Use an existing Makko email/password account. Every admin request validates the
Auth token and checks `admin_memberships` plus an active profile. The SQL RPCs
also check membership; client visibility is not an access-control boundary.
Membership is never editable by a customer or through this web UI.

Provision or revoke an explicitly approved account in the Supabase SQL editor:

```sql
insert into public.admin_memberships(user_id)
select id from auth.users where lower(email) = lower('approved-account@example.com')
on conflict do nothing;

-- Revoke: delete the corresponding row from public.admin_memberships.
```

## Behavior

- List, filter, search and paginate actual shopping requests and weekly orders.
- Inspect delivery snapshots, current shopper, amounts and request status history.
- Confirm weekly-package advance/handover and separate 25,000 VND wage payments.
  Writes lock the order in SQL, check admin membership and reject repeated or
  out-of-sequence confirmations. Actor IDs and times are stored on the order.
- Shopping-request statuses remain controlled by customer/shopper workflows.
- Previous list content remains visible during refresh. Requests are aborted on
  filter/account changes and local data is discarded on logout.

### Publish package ingredients

Open **Nguyên liệu trong gói**, choose the Monday starting the consumption week,
and enter a flat list of ingredient names and quantities (1–350 rows). There are
no dish names or daily sections. The live summary combines matching names and
compatible units (g/kg, ml/l and matching count units); free-form quantities remain
separate. Entered quantities are the base for one person and one meal/day for seven days.
The mobile app multiplies by people and doubles for lunch plus dinner; lunch-only
and dinner-only use the same quantities. Admin order details label the base
quantities explicitly.
Select **Xem lại nguyên liệu**, then **Công bố gói nguyên liệu**. Publication uses
`POST /api/v1/admin/weekly-weeks` with `weekStart` and `ingredients`.

The Monday date and publication deadline (at least ten days before the preceding
Sunday delivery deadline) remain enforced. A week can be published only once;
editing published ingredients is not currently supported. Draft input survives
navigation between admin sections, but is discarded on reload or account change.
The editor never inserts demonstration data automatically. The mobile app reads
published ingredients through FastAPI; the HTML prototype has no live writes.
Admin itself neither fabricates orders nor changes live customer orders for QA.

## Checks and build

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`dist/` is the static deployment artifact. `VITE_*` configuration is embedded
at build time; the API is hosted separately. No public hosting is configured.
