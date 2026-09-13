# Makko

Makko là ứng dụng cộng đồng giúp người dùng tạo và nhận yêu cầu mua hộ. Repository
gồm ứng dụng Expo/React Native, FastAPI backend và database Supabase.

## Kiến trúc

```text
Expo mobile app
    ├── Supabase Auth (đăng nhập và session)
    └── FastAPI /api/v1 (dữ liệu tính năng)
            └── Supabase PostgreSQL/RPC
```

- `apps/mobile`: ứng dụng Expo cho iOS, Android và web.
- `apps/api`: FastAPI xử lý API, phân quyền và nghiệp vụ.
- `supabase`: migrations và seed data.
- `database`: tài liệu SQL có thể review.
- `packages/shared`: contracts và constants dùng chung.

Mobile không được chứa Supabase secret key. Các truy vấn dữ liệu tính năng đi qua
FastAPI; mobile chỉ dùng Supabase trực tiếp cho Auth và các luồng Realtime/Storage
được thiết kế cho client.

## Yêu cầu hệ thống

Cài đặt trước:

- Git.
- Node.js và npm.
- Python 3.12 trở lên.
- Một Supabase project.
- Xcode để tạo iOS development build hoặc Android Studio để tạo Android
  development build. Hai công cụ này không bắt buộc nếu chỉ chạy bản web.

Điện thoại thật và máy tính cần kết nối cùng mạng Wi-Fi nếu mobile truy cập
FastAPI qua địa chỉ LAN.

## 1. Thiết lập FastAPI backend

Từ thư mục gốc của repository:

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
cp .env.example .env
```

Trên Windows PowerShell, kích hoạt môi trường bằng:

```powershell
.venv\Scripts\Activate.ps1
```

Điền `apps/api/.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_server_only_key
API_CORS_ORIGINS=["http://localhost:8081","http://localhost:19006"]
```

Có thể lấy URL và API keys trong Supabase Dashboard → Project Settings → API
Keys. `SUPABASE_SECRET_KEY` có quyền đặc biệt và chỉ được lưu ở backend; không
commit key này và không sao chép nó sang biến `EXPO_PUBLIC_*`.

Khởi động backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Giữ terminal này chạy. Kiểm tra:

- Health check: <http://localhost:8000/api/v1/health>
- OpenAPI/Swagger: <http://localhost:8000/docs>

Chạy backend tests:

```bash
pytest
```

Mỗi terminal mới cần vào `apps/api` và kích hoạt `.venv` trước khi chạy lệnh
Python.

## 2. Thiết lập Expo mobile app

Mở terminal thứ hai từ thư mục gốc:

```bash
cd apps/mobile
npm install
cp .env.example .env
```

Điền `apps/mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8000
```

Nếu chạy trên điện thoại thật, `EXPO_PUBLIC_API_URL` phải dùng IP LAN của máy
tính, không dùng `localhost`. Trên macOS có thể lấy IP Wi-Fi bằng:

```bash
ipconfig getifaddr en0
```

Ví dụ:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.9:8000
```

Nếu chạy Expo web hoặc iOS Simulator trên cùng máy, dùng:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Android Emulator thường truy cập máy host qua:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

## 3. Khởi động Expo

Khởi động Metro bundler:

```bash
npm start
```

Sau đó dùng menu trong terminal để chọn nền tảng. Hoặc chạy trực tiếp:

```bash
npm run ios
npm run android
npm run web
```

`npm run ios` và `npm run android` tạo/chạy development build. Development build
được khuyến nghị cho các luồng native như Google OAuth và custom URL scheme
`makko://`.

Sau khi thay đổi `.env`, hãy dừng Metro và khởi động lại. Nếu cache gây lỗi:

```bash
npx expo start --clear
```

## 4. Cấu hình Google OAuth

Để đăng nhập Google hoạt động:

1. Bật Google provider trong Supabase Authentication.
2. Điền Google OAuth Client ID và Client Secret vào provider.
3. Thêm Supabase callback URL hiển thị tại provider vào Authorized redirect URIs
   của Google Cloud OAuth client.
4. Thêm `makko://**` vào Supabase Authentication → URL Configuration → Redirect
   URLs.
5. Khi Google OAuth app còn ở chế độ Testing, thêm tài khoản thử nghiệm vào danh
   sách Test users trên Google Cloud.

## Quy trình chạy hằng ngày

Terminal 1 — backend:

```bash
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 — mobile:

```bash
cd apps/mobile
npm start
```

Chạy kiểm tra mobile:

```bash
npm run typecheck
```

## Xử lý lỗi thường gặp

### FastAPI báo thiếu `supabase_url` hoặc API keys

Đảm bảo `apps/api/.env` tồn tại và có đủ `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Chạy Uvicorn từ thư mục
`apps/api` để `.env` được tải đúng.

### Điện thoại không kết nối được backend

- Đảm bảo FastAPI chạy với `--host 0.0.0.0`.
- Đảm bảo điện thoại và máy tính cùng Wi-Fi.
- Dùng IP LAN thay cho `localhost` trong `EXPO_PUBLIC_API_URL`.
- Kiểm tra firewall có cho phép kết nối tới cổng `8000`.
- Mở `http://<computer-lan-ip>:8000/docs` trên điện thoại để kiểm tra kết nối.

### Expo không nhận biến môi trường mới

Dừng Metro, kiểm tra tên biến bắt đầu bằng `EXPO_PUBLIC_`, sau đó chạy lại bằng
`npx expo start --clear`.

## Bảo mật

Các file `.env` đã được Git bỏ qua. Chỉ commit `.env.example` với giá trị mẫu.
Nếu một secret key bị đưa vào commit, log công khai hoặc mobile bundle, hãy thu
hồi key đó trong Supabase và tạo key mới.
