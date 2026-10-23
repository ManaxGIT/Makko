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

Home and Explore use foreground GPS only after the user taps the location control.
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
