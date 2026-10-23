# Makko — Figma import board

Bộ giao diện mobile 390 × 844 px, gồm 10 màn hình. Riêng chức năng Tạo yêu cầu có luồng hoàn chỉnh 5 màn hình: Thông tin cơ bản, Danh sách món, Giao hàng & chi phí, Kiểm tra lại và Xác nhận thành công.

Trang `create-request.html` là prototype tương tác mới gồm 3 bước: chọn món,
giao hàng & chi phí, kiểm tra và đăng; có trạng thái thành công mô phỏng.
Không lưu nháp và không gửi dữ liệu lên hệ thống. Luồng 5 màn hình cũ vẫn ở `index.html?flow=create`.

Trang `auth.html` chứa riêng 6 màn hình của luồng Đăng nhập và Đăng ký.

Trang `order-tracking.html` chứa thiết kế màn hình Theo dõi đơn dành cho người
đi chợ, với hành trình 4 giai đoạn và các hành động chuyển bước/huỷ nhận đơn.

Trang `create-request-flow.html` hiển thị đồng thời bốn màn hình của luồng đăng
yêu cầu để duyệt toàn bộ thiết kế. Mỗi khung vẫn có thể thao tác thử.

## Xem trên máy

Trang `receipt.html` là prototype xác nhận hàng đã mua: nhập thành tiền từng món,
đánh dấu món không mua được, tự cộng tiền hàng và tách riêng phí đi chợ.
Ảnh hóa đơn là tùy chọn. Giá điền sẵn là dữ liệu minh họa để duyệt giao diện. Xem tại `http://localhost:4173/receipt.html`.
Biểu mẫu chỉ kiểm tra dữ liệu trong trình duyệt, chưa lưu dữ liệu lên hệ thống.

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


## Minh chứng mua hàng — bản đề xuất mới

`purchase-proof.html` mô phỏng chốt tiền khi đăng yêu cầu và luồng người đi chợ:
Theo dõi đơn → Kiểm tra hàng → Thêm ảnh → Xác nhận giao hàng.
Tiền mua hàng đã thỏa thuận và phí đi chợ hiển thị riêng; không yêu cầu nhập giá
thực mua. Người nhận giữ phần tiết kiệm và chịu phần vượt khi mua đủ, đúng yêu cầu.
Trường hợp thiếu/thay món chặn tiếp tục; luồng hai bên xác nhận điều chỉnh chưa
được mô phỏng. Phí 25.000đ giữ từ mẫu trước, không phải mức phí mới được chốt.
Ảnh minh họa được ghi nhãn. Không tải lên server, đăng đơn hoặc thanh toán thật.
Mở tại `http://127.0.0.1:4173/purchase-proof.html`.

## Trang chủ và Hôm nay ăn gì

`today-meal.html` gồm ba khung trang chủ, nhu cầu và chọn món. Chọn món rồi
bấm “Tiếp tục tạo yêu cầu” để chuyển nguyên liệu theo khẩu phần và giá gợi ý
vào `create-request.html` qua URL fragment. Tái sử dụng luồng sửa danh sách,
giao hàng & chi phí, kiểm tra và đăng hiện có; không có màn đăng riêng cho AI.
Dữ liệu minh họa, chưa gọi Gemini, tạo đơn thật hoặc triển khai vào mobile.

Bước xác nhận cuối trong `create-request.html?step=3` dùng bố cục tổng hợp
chỉ đọc: món, ghi chú/thay thế, giao hàng, thanh toán và chi phí. Không có nút
sửa hay ô nhập tại bước này; quay lại bước trước để chỉnh. Tổng và nút đăng
được giữ ở chân màn hình. Đây vẫn là prototype, chưa cập nhật mobile.
