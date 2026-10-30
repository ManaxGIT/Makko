# Makko mobile

Universal Expo application for Android, iOS, and web.

## Structure

- `app/`: Expo Router routes and layouts.
- `src/components/`: reusable UI and feature components.
- `src/features/`: domain modules such as auth, requests, chat, receipts, and reviews.
- `src/services/`: API, Supabase Auth, Realtime, Storage, maps, and notifications.
- `src/store/`: local client state.
- `src/lib/`, `src/hooks/`, `src/types/`: shared application utilities.
- `assets/`: static images and icons.

## Run locally

```bash
npm install
npm start
```

Run `npm run typecheck` before committing UI changes.

## Authentication setup

Copy `.env.example` to `.env` and provide the project URL, publishable key, and
the FastAPI base URL through `EXPO_PUBLIC_API_URL`. Physical-device development
is the default: use the computer's LAN IP rather than `localhost`, and keep the
phone and computer on the same Wi-Fi network.
In Supabase Auth, enable the Google provider and add `makko://**` to the redirect
URL allow list. Google Cloud must use the Supabase callback URL shown on the
provider page as an authorized redirect URI.

Authentication implementation status, temporary verification behavior, and
production follow-ups are tracked in the repository's `product-schema-notes.md`.

## Data API boundary

Feature data is loaded through FastAPI in `apps/api`; mobile must not call
Supabase tables or read-only database RPCs directly. The shared Supabase client
remains responsible for authentication sessions, and its access token is attached
to FastAPI requests by `src/lib/api.ts`.

## Shared bottom navigation

All primary screens live under `app/(tabs)/`. The group layout configures the
tab navigator once, and `src/components/navigation/AppTabBar.tsx` owns the
shared bottom navigation UI. Add a route to the group and register it in the
layout; do not create a separate bottom bar inside individual screens.

## Purchase evidence

`requests/[id]/evidence` uses `expo-image-picker` for camera and gallery access.
Rebuild the development client after installing this native dependency (for
example `npx expo run:ios`); restarting Metro alone does not add native modules.
Photos upload to the private `purchase-evidence` bucket with the signed-in
session. Metadata and final submission go through FastAPI. Camera permissions
and real photo uploads still need physical-device verification.

## Refresh behavior

Order lists keep an in-memory cache per account and list scope (active/history).
A list focused again within 30 seconds uses its cached data; older or invalidated
lists refresh in the background. Only an initial load hides the list. Pull down
on Orders/Order history to force a refresh. Successful cancellation updates the
list locally, and other order mutations invalidate freshness. Signing out or
changing accounts clears the cache. Cache entries are not persisted to disk.

Order tracking and chat retain their live background refresh. Request details
reuse loaded content for 30 seconds while the screen remains mounted. Explore
keeps results during refresh/search and ignores obsolete search responses.

Run `node --test tests/order-list-cache.test.cjs` from `apps/mobile` to check
read deduplication, cancellation, invalidation, account isolation, stale-response
handling and recovery from a failed refresh.

## Google Maps and nearby requests

Google Maps is temporarily paused. The delivery form uses manual address entry
and an optional foreground GPS button for deliveries at the user's current location.
The Maps picker is not imported by the app and its Expo config plugin is disabled,
so an existing client without `RNMapsAirModule` can open the form. Maps SDK keys
are not required for this mode. The setup below is retained for when Maps resumes;
restore the picker and plugin only after the user asks to resume the integration.


Install dependencies, then rebuild the native development client (`npx expo run:ios`
or `npx expo run:android`). Google Maps on iPhone requires a native build with
its SDK/key; Expo Go is not the test target for this integration.

In Google Cloud, enable billing, Maps SDK for iOS and Maps SDK for Android. Set these in the ignored mobile `.env` before building:

- `EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY`: restrict to Maps SDK for iOS and the
  bundle identifier `com.manakkusu.makko`.
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`: restrict to Maps SDK for Android,
  your configured Android package and the build's signing certificate SHA-1.
  Configure the Android package when preparing the Android build.

These SDK keys are embedded in the app and require application/API restrictions.
The delivery-address form allows an optional map pin. Enter the street address
manually and select province/ward from the existing administrative list. Selecting
a point only changes coordinates; it does not change address text. Verify both
before saving. Reverse geocoding is deferred; no Google Geocoding API or server
Geocoding key is used. Saving without coordinates stays allowed.
The web version retains manual address entry; the interactive map targets iOS/Android.

Home and Explore automatically read foreground GPS on focus or when returning
from the background if permission is already granted. Automatic reads reuse a fix
for up to 60 seconds to avoid repeated GPS requests when switching tabs. They never
request permission or open Settings; the location button handles explicit permission
requests and forces a fresh fix.
Explore keeps the existing 3 km radius, sorts known distances first, and omits
orders without coordinates while that radius filter is active. Without GPS,
orders are shown without distance. Distances are straight-line estimates, not
road distance or travel time. Tap the location control to update after moving.
No background location tracking is requested.

Device verification still needs configured Google keys and a rebuilt client:
check map taps/marker dragging, manual address save/publication, GPS
permission denial, nearest ordering and account changes.

### Missing ExpoLocation in an existing development client

`Cannot find native module 'ExpoLocation'` means the installed native client
predates the GPS dependency; a Metro reload or Google API key does not add it.
The app checks for the module before loading GPS, so the remaining screens can
still be used. To enable GPS on a physical iPhone, rebuild and install the client:

```bash
npx expo run:ios --device
```

For Android, use `npx expo run:android --device`. GPS works without a Google Maps
key; displaying Google Maps requires a Maps SDK key.
After setting/changing Maps SDK keys, rebuild again so native configuration is
included in the installed app.

### iOS location permission

The first GPS action requests foreground permission through the iOS system dialog.
If permission is already granted, the app reads GPS without asking again. If iOS
reports `canAskAgain: false`, the app offers an Open Settings action instead of
repeatedly requesting permission. Manual address entry remains available.

Native iOS builds must include `NSLocationWhenInUseUsageDescription`. The source
is the `expo-location` plugin in `app.config.js`. When the generated `ios/` folder
already exists, synchronize config changes with `npx expo prebuild --platform ios`
(review generated changes), then rebuild/install the client. Restarting Metro does
not change an installed app's Info.plist or add native modules.

### Hôm nay ăn gì

Trang chủ có lối vào `/today-meal`: chọn bữa (hoặc tự nhập), số người, ngân sách,
món không ăn và nguyên liệu đã có. App gọi FastAPI qua API client hiện có;
Gemini key chỉ ở backend. Chọn một gợi ý sẽ điền danh sách nguyên liệu/tiền
hàng vào luồng `/create/items`, không tự đăng đơn. Nếu đã có danh sách đang
soạn, app hỏi trước khi thay. Địa chỉ được giữ, người dùng kiểm tra lại giờ
nhận, phí đi chợ và thanh toán như luồng hiện tại.

Lỗi gợi ý không xóa kết quả đã có. Không tự gọi AI khi quay lại màn hoặc đăng
nhập tài khoản khác; gợi ý chỉ giữ trong phiên màn hình, không lưu dài hạn.

Ô “Hôm nay bạn muốn ăn kiểu gì?” cho nhập tự do và thêm gợi ý nhanh về món
nước/khô, phong cách ẩm thực hoặc thử món mới. Nội dung được gửi qua trường
`style` tùy chọn; không thay thế các món kiêng hay ngân sách.

### Xem cách nấu

Có thể xem công thức ngay trong gợi ý. Khi đăng đơn, công thức đã chọn được
lưu kèm đơn. Chủ đơn mở lại qua nhãn “Có công thức” trong Đơn đã đăng/Lịch sử
hoặc dòng “Xem cách nấu” trong thẻ tổng hợp Theo dõi đơn. Không thêm lối vào
ở Chi tiết yêu cầu, và không hiển thị cho shopper. Màn công thức dùng lượng
để nấu, còn form tạo yêu cầu dùng quy cách mua kèm ghi chú (hộp/gói nhỏ...).
Công thức là bản gốc đã chọn; việc sửa danh sách mua không tự tạo lại công thức.

Phần xem trước cách nấu dùng native stack `/today-meal/recipe`, không dùng
React Native Modal. Header navigator quản lý safe area phía trên và cử chỉ
quay lại iOS; phần nội dung chỉ nhận inset dưới/hai bên. Gợi ý giữ nguyên khi
pop về `/today-meal`. Dữ liệu xem trước được giới hạn trong navigator theo
tài khoản, không thay danh sách mua cho đến khi người dùng chọn tiếp tục.

### Địa chỉ của tôi

Tài khoản → Địa chỉ của tôi mở `/account/addresses` (có bảo vệ session).
Người dùng thêm nhiều địa chỉ, sửa, xóa và đặt mặc định. Địa chỉ đầu tiên tự làm
mặc định; xóa mặc định cần chọn địa chỉ thay thế nếu còn địa chỉ khác.
Form dùng nhập địa chỉ thủ công, GPS tùy chọn, không tải Google Maps.

Bước giao hàng của yêu cầu mở popup chọn địa chỉ trượt từ dưới lên. Chọn rồi
bấm “Dùng địa chỉ này” chỉ đổi địa chỉ cho yêu cầu đang soạn. Đóng popup không
áp dụng lựa chọn tạm. Có thể thêm địa chỉ mới và dùng ngay; ghi chú đã lưu được
điền khi chọn địa chỉ và vẫn chỉnh được trong yêu cầu. Đơn mới ưu tiên mặc định,
nếu chưa có mặc định dùng địa chỉ tạo gần nhất. Đơn đang chỉnh giữ bản chốt địa
chỉ cũ cho đến khi chủ động chọn địa chỉ khác. Xóa địa chỉ đang chọn ở yêu cầu
chưa đăng buộc chọn lại; đơn đã đăng giữ bản chốt độc lập.

Cache địa chỉ dùng cùng mẫu account/version như danh sách đơn, với freshness
5 phút do sổ địa chỉ ít thay đổi. Tài khoản và popup dùng chung subscription;
thao tác xác nhận cập nhật cache, pull-to-refresh giữ nội dung và lỗi nền có nút
thử lại. Đăng xuất/đổi tài khoản xóa cache và bỏ qua phản hồi cũ. Tạo địa chỉ vẫn
trả một bản ghi theo API cũ, nên cập nhật cục bộ rồi đánh dấu stale để tải metadata
đầy đủ lần đọc kế tiếp. Không tự gửi lại thao tác lưu khi kết quả mạng chưa rõ.

## Weekly ingredient packages

The home entry opens `/weekly-food`. The flow includes package selection (1–4
people; lunch, dinner, both), the published package ingredients, `/weekly-food/checkout`
using the existing saved-address popup and `/weekly-food/[id]` for tracking.
Customer and shopper packages are listed in the shared Orders tab; completed and
cancelled packages are in Account → Order history. Available packages are in
Explore. The old `/weekly-food/orders` list now redirects to the Orders tab;
there is no separate package-list shortcut. Every weekly route is session-guarded.

Reads/writes use `/api/v1/weekly-food` on FastAPI with the current account ID
checked by the shared HTTP client. Only the one-week cash plan is enabled. The
app lists published consumption weeks and defaults once to the earliest one
whose seven-day registration cutoff has not passed. Users can choose a different
week and review its ingredients, deadline and registration cutoff. Each week card opens its own ingredient preview. Weeks past the registration
cutoff are hidden from this picker; stored weeks and existing orders are retained. Refresh
keeps the selection; a removed selected week requires explicit reselection.
Checkout receives and displays the selected week ID/range. Users still select no
delivery day or time. An empty catalogue
shows that registrations are not open, rather than introducing a demo ingredient list.
Publish real ingredient lists with the admin web/API before testing registrations against live data.

The checkout reuses account addresses and validates Da Nang. A deleted selection
requires an explicit replacement. Retried submissions with the same selections
reuse the draft submission key. The server owns prices, cutoff checks and all
state transitions. Long-term plans remain unavailable until online payment exists.

Tracking refreshes every 15 seconds while focused and foregrounded, retaining
content during refresh/errors. Weekly resources reuse the account-scoped,
versioned order cache lifecycle and are cleared on logout. Confirmed mutations
patch known status values, retain server timestamps and invalidate affected reads.

Shopper delivery requires at least one image before “Đã giao hàng & thu tiền”.
Images upload to the explicitly designed private `weekly-food-delivery` Storage
flow; completion still requires a separate customer receipt confirmation. Makko
advance/handover and wage payments remain on the admin web. The fixed pickup
address is not configured yet. Weekly-package ratings have no backend endpoint
and are not submitted by these screens; existing shopping-request ratings remain
unchanged.

Run `npm run typecheck`, `node --test tests/*.test.cjs`, and `npx expo export --platform all` for checks.
Native bundles and web static export can be produced without Google API calls.

Weekly package quantities are published for one person, one meal/day, seven days.
The ingredient sheet multiplies by selected people and by two for both meals.
Saved-order sheets use the order's people/meal choices, including the shopper view.
Free-form legacy quantities show the original text and multiplier instead of an
invented numeric amount; publication should use numeric amounts with units.

Explore now separates **Đơn nhờ đi chợ** and **Gói nguyên liệu** with tabs and
explicit card labels. Weekly cards open a shared ingredient/amount preview first. Only **Xác nhận nhận
giao** calls the existing weekly `accept` API and opens the assigned order. Weekly results
cover Da Nang and do not use the errand keyword/location filters. The two lists
keep their own scroll areas and state; pull-to-refresh applies to the visible
list. Weekly pages reuse the existing account-scoped `available:<page>` cache
(30-second freshness, 25 rows/page), shared with the weekly-orders screen. Server
ownership, cutoff and assignment checks remain authoritative. The weekly-order
card component is shared by both entry points; no sample orders are inserted.

Order lists and Account → Order history now merge errand requests and weekly
packages under their existing customer/shopper tabs, including badge counts.
`delivered` stays active until customer confirmation; completed/cancelled packages
appear in history. The feeds reuse each account's existing errand and weekly
caches. Pull-to-refresh refreshes both sources without clearing usable cards.
Available-package previews show published ingredients scaled to that package,
advance/collection/wage amounts and Da Nang delivery scope; customer contact and
exact address remain restricted to the assigned-order detail. Both Explore and
the weekly-orders entry use the same preview and explicit confirmation.
