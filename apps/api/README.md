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
- `GET /api/v1/home/profile` — own profile, rating average/count, and exact
  `completedCustomerCount` / `completedShopperCount`. Customer totals count
  completed requests; shopper totals count completed, unreleased assignments.
- `PATCH /api/v1/home/profile` — save `displayName` (2–80 characters),
  optional `phone` (up to 32), `bio` (up to 500), and explicit `avatarPath`
  (path or null to remove). Uses the authenticated `update_account_profile` RPC.
  Upload JPEG/PNG/WebP (up to 10 MB) to the private `profile-avatars` bucket at
  `<user-id>/<unique-filename>` before saving. Images stay immutable; no client
  overwrite/delete. Signed reads allow the owner or an active signed-in viewer
  of a currently referenced avatar. Profile edits never change Auth credentials
  or existing delivery snapshots.
- `GET /api/v1/home/profile/reviews?limit=20&offset=0` — received reviews for
  the authenticated account, newest first, with average/count and `hasMore`.
  Returns reviewer display name/role, rating, optional comment, date and related
  order ID/title. `limit` is 1–50; account identity always comes from the token.
- `GET /api/v1/explore` — `query` tìm nội dung không dấu; `province_code` và `ward_code` lọc theo địa chỉ giao của đơn. `ward_code` cần đi cùng `province_code`. Khi chọn tỉnh/thành, bán kính không áp dụng; tọa độ (nếu có) vẫn dùng để tính khoảng cách.
- `GET /api/v1/explore/{request_id}`
- `GET /api/v1/orders`
- `POST /api/v1/orders`
- `GET /api/v1/orders/{request_id}/tracking`
- `GET /api/v1/orders/{request_id}/details`
- `POST /api/v1/orders/{request_id}/accept`
- `POST /api/v1/orders/{request_id}/release`
- `POST /api/v1/orders/{request_id}/publish`
- `PATCH /api/v1/orders/{request_id}/status`
- `GET /api/v1/orders/{request_id}/review` — current participant's review,
  counterpart, and eligibility.
- `POST /api/v1/orders/{request_id}/review` — `{ "rating": 5, "comment": null }`;
  integer 1–5, optional comment up to 1,000 characters. Only current participants
  in completed orders can submit. The server chooses the recipient. An identical
  retry returns the saved review; changing a saved review returns 409. The
  `submit_order_review` RPC saves the review and updates reputation atomically.

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
Optional `title` accepts 3–120 characters after trimming. Omitted, null or blank
titles on creation are derived from item names.

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


Apply `optional_request_title` after `update_shopping_request` to enable user titles.
The editor returns the stored title and allows changing it. Sending a null/blank
edit title regenerates it from the submitted items; omitting the field preserves
the current title for older clients. Existing rows are not renamed by migration.
Run `supabase/tests/optional_request_title.sql` for rollback-only title checks.

## Fixed-price purchase evidence

- `GET /api/v1/orders/{request_id}/evidence`: participant-only photo metadata.
- `POST /api/v1/orders/{request_id}/evidence`: `checkedItemIds` and `photos`
  (`kind`: `goods` or `receipt`, `storagePath`). Validates the assigned shopper,
  all item IDs, and private Storage objects in one RPC before starting delivery.
- `estimatedItemsTotal` retains its legacy name but now means the positive,
  agreed goods amount. Actual purchase cost is not overwritten or required.
- Apply both purchase-evidence migrations before starting the updated API.
  Existing missing budgets must be explicitly resolved before migration.
- `supabase/tests/purchase_evidence.sql` verifies transactional and RLS behavior
  using an existing shopping order and rolled-back synthetic Storage metadata.
  It does not verify actual image uploads or camera access.

## Order chat

- `GET /api/v1/orders/{request_id}/chat`: current participant-only conversation
  context and up to 50 messages, newest first. Optional `limit` is 1–100. Use
  `before=<message-id>` for older messages or `after=<message-id>` to catch up
  (mutually exclusive). `hasMore` refers to the selected direction; an `after`
  query reads the oldest unseen batch first and returns that batch newest first.
  Message bigint IDs are JSON strings.
- `POST /api/v1/orders/{request_id}/chat/messages`: `{ "body": "Xin chào",
  "clientKey": "<uuid>", "assignmentId": "<uuid from GET>" }`. Returns the
  persisted message. Text is trimmed and limited to 1–4000 characters. Reuse the
  same key, body and assignment when retrying an uncertain response. The server
  derives the sender from the validated token; supplied sender IDs are rejected.

Apply `order_chat` before running the updated clients. The sending RPC locks the
request using the same lock as release and status changes, validates the current
assignment, and prevents duplicate retry writes. Chat opens immediately after
acceptance. Completed/cancelled orders retain read-only history. Releasing an
accepted assignment **deletes its chat history in the release transaction**; a
new shopper starts fresh and stale composers cannot send into the new assignment.
Mobile only uses Realtime inserts as invalidation signals, reloads content via
FastAPI, and also polls every five seconds while the screen is focused/foreground
to recover missed events and update order status. No push notifications are added.

`supabase/tests/order_chat.sql` checks RLS, RPC authorization, retry behavior,
read-only states, history deletion, and reassignment with rolled-back synthetic
requests. It needs three existing active profiles and leaves no test rows.
Run `pytest` from `apps/api` for HTTP and service checks. Native keyboard behavior
and two-device Realtime delivery still require a device test.

## Order lists and removing an unaccepted request

`GET /api/v1/orders` supports `scope=active` (exclude completed/cancelled),
`scope=history` (only completed/cancelled), or `scope=all` (default, backward
compatible). The filter is applied before the query limit. Mobile displays active
orders by customer/shopper role; Account → Order history displays terminal orders.

The owner's **Xóa đơn** action reuses `PATCH /api/v1/orders/{id}/status` with
`{"status":"cancelled"}`. It retains the row for history. The existing transaction
only permits cancellation of owned draft/open requests, locks the request, and
prevents subsequent acceptance. If acceptance already won, cancellation returns
409 and the client reloads the list. No hard-delete endpoint is introduced.
`supabase/tests/cancel_unaccepted_order.sql` verifies ownership and both operation
orders with rolled-back synthetic rows; it does not run a two-session stress test.

## Device coordinates for nearby requests

`GET /api/v1/home` accepts optional `latitude`/`longitude`, like Explore;
nearby distances use these device coordinates rather than the saved home address.
The saved-address and publication contracts continue to accept null coordinates.
Addresses are entered manually; the API does not call Google Geocoding.

## Hôm nay ăn gì (Gemini)

`POST /api/v1/meals/suggestions` yêu cầu Bearer session hiện có. Body:

```json
{"meal":"Bữa tối","people":2,"budget":100000,"avoid":"Không ăn tôm","pantry":"Gạo, dầu ăn, gia vị","style":"Món Tây, muốn thử món mới"}
```

Kết quả `suggestions` gồm `title`, `description`, `cookingMinutes`,
`suggestedGoodsAmount` (VND, chỉ là tham khảo) và `ingredients` (`name`,
`quantity`, `unit`) cho toàn bộ khẩu phần. Tên bữa có thể tự nhập. Backend
kiểm tra cấu trúc/định lượng, nguyên liệu trùng và giá không vượt ngân sách.
Các sở thích/kiêng được gửi cho mô hình làm ngữ cảnh, không phải bảo đảm dinh
dưỡng hay giá thị trường đã xác minh.

Đặt `GEMINI_API_KEY` trong `.env` backend (được Git bỏ qua) và
`GEMINI_MODEL=gemini-3.1-flash-lite`. Không đưa key vào `EXPO_PUBLIC_*`.
Khởi động lại FastAPI sau khi đổi cấu hình; biến thiếu không làm ứng dụng lỗi
khởi động, endpoint trả 503. Hạn mức Gemini trả 429; kết quả không hợp lệ/lỗi
nhà cung cấp trả 502; timeout trả 504. Không tự thử lại để tránh phát sinh
thêm lượt gọi. Không gửi địa chỉ, số điện thoại hay token đăng nhập đến Gemini.

API gợi ý không lưu toàn bộ gợi ý vào database và không đăng đơn. Công thức của món được chọn có thể được lưu cùng đơn khi người dùng xác nhận đăng. Chọn món
trên app sẽ điền danh sách và giá tham khảo vào luồng tạo yêu cầu hiện có;
người dùng sửa, chốt tiền/giao hàng và xác nhận trước khi đăng.

`style` là chuỗi tùy chọn (tối đa 1000 ký tự) cho loại món, phong cách ẩm thực
và mong muốn đổi vị. Bỏ qua trường này vẫn tương thích. Pantry không giới hạn
mọi gợi ý vào cùng nguyên liệu; avoid và ngân sách vẫn có ưu tiên cao hơn style.

Kết quả có đúng 3 gợi ý: hai lựa chọn thông thường giữ cách đề xuất hiện tại;
lựa chọn thứ ba là “Thử điều mới”, với mô tả điểm khác biệt. Backend kiểm tra
số lượng và tên không trùng; mức độ mới lạ là hướng dẫn cho mô hình, không
phải bảo đảm người dùng chưa từng ăn món đó.

### Công thức theo đơn và quy cách mua

Mỗi gợi ý có `recipe` (`title`, `cookingMinutes`, `servings`, `ingredients`,
`steps`). `recipe.ingredients` là lượng dùng để nấu, gồm cả đồ sẵn có.
`ingredients` ngoài cùng là lượng/quy cách mua; `note` ghi lượng tối thiểu
với gói/hộp nhỏ. Giá tham khảo tính cho lượng mua, không chỉ lượng nấu.

`POST /orders` nhận `recipe` tùy chọn (khách cũ vẫn đăng bình thường). RPC
`create_and_publish_request` lưu snapshot trong cùng giao dịch, trước publish;
retry cùng submission key giữ nguyên snapshot. Không backfill công thức cho đơn cũ.
Chỉnh danh sách đơn không sửa công thức nguyên bản; giao diện cách nấu nhắc
đối chiếu nguyên liệu. Công thức được giữ trong đơn đã hoàn tất/đã hủy.

`GET /orders/{id}/recipe` chỉ trả snapshot cho customer, người khác nhận 404.
Danh sách đơn và tracking có `hasRecipe`; chỉ customer được trả true. Không
thêm công thức vào Explore hay Chi tiết yêu cầu. Database có RLS chỉ cho chủ
đơn SELECT, không cấp INSERT/UPDATE/DELETE trực tiếp cho authenticated.

Migration: `20261023085134_order_recipe_snapshots.sql`. Kiểm tra giao dịch và
quyền bằng `supabase/tests/order_recipes.sql`; mọi dữ liệu test được rollback.

### Quản lý sổ địa chỉ

`GET /api/v1/addresses` tiếp tục phân trang và xếp mặc định trước, sau đó mới nhất.
`POST /api/v1/addresses` vẫn trả một địa chỉ; địa chỉ đầu tiên của tài khoản tự làm
mặc định. Thêm địa chỉ khác không tự thay mặc định trừ khi `isDefault=true`.

- `PATCH /api/v1/addresses/{id}`: sửa bằng cùng DTO với tạo mới.
- `POST /api/v1/addresses/{id}/default`: đặt mặc định.
- `DELETE /api/v1/addresses/{id}?replacement_address_id={id}`: xóa; cần địa chỉ
  thay thế thuộc cùng tài khoản khi xóa mặc định và còn địa chỉ khác.

Ba thao tác quản lý trả danh sách địa chỉ còn lại từ cùng giao dịch để mobile cập
nhật cache mà không tải lại toàn bộ. RPC dùng token của người dùng, RLS và khóa
profile chủ sở hữu giống tạo địa chỉ/đăng đơn; tên tỉnh/phường lấy từ danh mục.
Sửa không tự bỏ mặc định của địa chỉ đang là mặc định. Không backfill mặc định
cho tài khoản cũ; khi chưa có mặc định, mobile ưu tiên địa chỉ được tạo gần nhất.
Xóa chỉ làm null liên kết nguồn của đơn, không thay bản chốt địa chỉ giao hàng.

Migration `20261023132806_saved_address_management.sql`; kiểm tra rollback với
`supabase/tests/saved_address_management.sql` dùng tài khoản và đơn tổng hợp.

### Thỏa thuận lại tiền hàng

- `GET /api/v1/orders/{id}/goods-agreement`: tiền hàng đang áp dụng, phí đi chợ và đề nghị gần nhất của lượt nhận hiện tại. Chỉ hai bên hiện tại được đọc.
- `POST /api/v1/orders/{id}/goods-agreement`, body `{ "amount": 200000 }`: người đăng xác nhận và gửi mức tiền hàng mới khi đơn ở `accepted` hoặc `shopping`. Chỉ có một đề nghị chờ xác nhận; tiền hiện tại chưa thay đổi.
- `POST /api/v1/orders/{id}/goods-agreement/{proposalId}/response`, body `{ "accept": true }` (hoặc `false`): chỉ người đi chợ đang nhận đơn được đồng ý/từ chối mức tiền cụ thể đó.

Các thao tác chạy qua RPC với JWT người dùng và khóa cùng dòng đơn với chuyển trạng thái/hủy nhận đơn. `accepted → shopping` giữ đề nghị chờ; rời hai giai đoạn này làm đề nghị hết hiệu lực. Đề nghị gắn với lượt nhận đơn để người nhận sau không dùng lại xác nhận cũ. Phí đi chợ và chi phí mua thực tế không bị sửa. Các lần gửi/xác nhận giống hệt khi đề nghị chưa thay đổi không tạo thêm bản ghi hoặc sửa quyết định đã chốt.
