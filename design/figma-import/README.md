# Makko — Figma import board

Bộ giao diện mobile 390 × 844 px, gồm 10 màn hình. Riêng chức năng Tạo yêu cầu có luồng hoàn chỉnh 5 màn hình: Thông tin cơ bản, Danh sách món, Giao hàng & chi phí, Kiểm tra lại và Xác nhận thành công.

Trang `create-request.html` chứa riêng 5 màn hình của luồng Tạo yêu cầu để xem và import độc lập vào Figma.

Trang `auth.html` chứa riêng 6 màn hình của luồng Đăng nhập và Đăng ký.

## Xem trên máy

Mở `index.html` trực tiếp trong trình duyệt, hoặc chạy một static server trong thư mục này.

## Import vào Figma

1. Chạy trang bằng local server, ví dụ với VS Code Live Server hoặc `python3 -m http.server 4173`.
2. Trong Figma, cài plugin **html.to.design**.
3. Dán URL `http://localhost:4173` vào plugin và chọn khung desktop tối thiểu 1320 px.
4. Import; mỗi `.phone` sẽ trở thành một nhóm màn hình có thể chỉnh sửa. Nếu plugin không tải được Google Fonts, chọn toàn bộ text và đổi sang **Be Vietnam Pro** trong Figma.

## Design tokens

- Cam Makko: `#F4A261`
- Nắng sớm: `#FFF2D6`
- Lá đậm: `#213A2F`
- Gạch chợ: `#D95D39`
- Giấy gói: `#FBF8F0`
- Body: Be Vietnam Pro
- Display: Fraunces
