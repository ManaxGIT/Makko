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

`order-recipe.html` là bản mẫu nhãn “Có công thức” cho người đăng trên
danh sách Đơn hàng/Lịch sử, dòng “Xem cách nấu” trong thẻ tổng hợp của màn
Theo dõi đơn hiện có, và màn Cách nấu mới. Chi tiết yêu cầu không được thêm
công thức. Có thể chuyển vai trò để thử ẩn nhãn; nội dung chỉ minh họa, chưa
triển khai mobile, API hay lưu công thức.

## Sổ địa chỉ và chọn địa chỉ nhận

`saved-addresses.html` gồm ba khung 390 × 844: danh sách địa chỉ tài khoản,
form thêm/sửa và popup chọn địa chỉ trượt từ dưới lên trên màn đăng yêu cầu. Các khung dùng chung dữ liệu mẫu
trong bộ nhớ; tải lại trang sẽ khôi phục dữ liệu, chưa gọi API hay lưu tài khoản.
Có thể thử đặt mặc định, chọn riêng cho một yêu cầu, mô phỏng yêu cầu mới,
xóa mặc định với địa chỉ thay thế và trạng thái chưa có địa chỉ. Xóa địa chỉ
đang dùng buộc chọn lại. Địa chỉ đầu tiên tự làm mặc định.
Danh sách hành chính chỉ là dữ liệu mẫu hai thành phố; nút GPS chỉ giải thích
hành vi, không xin quyền hoặc đọc vị trí thật. Phần cuối form có thể cuộn.
Mở tại `http://127.0.0.1:4173/saved-addresses.html`; ảnh duyệt ở
`saved-addresses-preview.jpg`, ảnh riêng popup ở `saved-addresses-popup-preview.jpg`.
Popup có nút đóng, chạm nền để đóng và chỉ áp dụng địa chỉ khi xác nhận.
Thiết kế đã được duyệt và được triển khai trong mobile/API; trang này vẫn chỉ
là prototype dữ liệu mẫu để tham chiếu, không kết nối tài khoản thật.

## Gói nguyên liệu tuần — bản mẫu để duyệt

`weekly-food.html` gồm năm khung: trang chủ đã duyệt, chọn gói, đăng ký, theo dõi và nhận giao. Có nút chuyển nhanh giữa các khung.
Chạy server từ gốc repository rồi mở
`http://127.0.0.1:4173/design/figma-import/weekly-food.html`.
Chọn số người/bữa ăn, xem thực đơn và xác nhận đăng ký; dùng “Thời điểm minh họa”
để đi qua hạn hủy, mở nhận giao và đến ngày giao. Phần điều khiển phía Makko
ở cuối trang mô phỏng thu tiền ứng/bàn giao và trả công sau xác nhận của khách.
Ảnh bàn giao chỉ được chọn cục bộ, không tải lên. Font được đóng gói cục bộ.

Bản mẫu minh họa một đơn mỗi lần; “Làm lại bản mẫu” khôi phục dữ liệu ban đầu.
Sản phẩm dự kiến cho phép nhiều gói. Bản mẫu nhúng trực tiếp popup và form
trong `saved-addresses.html?embedded-picker=1`: chọn, đóng bỏ lựa chọn tạm,
xác nhận hoặc thêm địa chỉ. Chọn địa chỉ chỉ áp dụng cho gói, không đổi mặc định.
Trang chủ dùng `home-weekly-food.html?embed=1` để giữ cùng thiết kế đã duyệt.
Giao sớm nhất có thể, chậm nhất Chủ nhật; khách không chọn ngày hoặc giờ.
Mốc đăng ký và hủy tính theo Chủ nhật hạn chót (mẫu 15/11 cho tuần 16–22/11). Các mốc hủy hiển thị
theo ngày; mốc 00:00 trong mã chỉ phục vụ mô phỏng, chưa phải quyết định về
giờ chốt hạn sau khi bỏ khung giờ giao. Thực đơn, định lượng và ngày tháng là dữ liệu mẫu;
địa chỉ điểm nhận hàng Makko chưa được thiết lập. Chỉ mở kỳ hạn một tuần,
thanh toán tiền mặt; chưa có dữ liệu bền vững, API, thanh toán thật hoặc mã mobile.

## Web quản lý Makko — bản mẫu

Mở `makko-admin.html` để xem danh sách chung cho gói nguyên liệu tuần và đơn
nhờ đi chợ. Có tìm kiếm, lọc loại đơn/trạng thái, chi tiết đơn, hàng chờ bàn giao
và hàng chờ trả công. Chọn GT-0018 để thử xác nhận thu tiền ứng/bàn giao;
GT-0017 để thử trả công sau khi khách đã nhận. Đơn nhờ đi chợ chỉ theo dõi,
không thay người dùng xác nhận trạng thái.

Dữ liệu mẫu độc lập với `weekly-food.html`, chỉ lưu trong phiên trang; tải lại
hoặc khôi phục sẽ đặt lại. Chưa có đăng nhập quản trị, API hoặc thao tác tiền thật.

`weekly-delivery-review.html` minh họa hai thay đổi: gói nguyên liệu nằm chung
trong Đơn đã đăng/Đơn đã nhận với nhãn loại riêng, và phần xem nguyên liệu, tiền
ứng, tiền công trước nút xác nhận nhận giao. Đây là dữ liệu mẫu, không ghi đơn
thật. Các luồng tương ứng đã được triển khai trong mobile; phần chân xác nhận
được giữ ngoài vùng cuộn để người dùng chủ động xác nhận sau khi xem.

`weekly-week-selection.html` minh họa chọn giữa nhiều tuần đã công bố, xem đúng
nguyên liệu và hạn đăng ký của từng tuần. Tuần khóa vẫn xem được nhưng không
đăng ký được. Có tuần minh họa thêm để duyệt thiết kế; không tạo dữ liệu thật.

`admin-weekly-packages.html` previews the approved admin published-package list,
ingredient details and deletion confirmation. It uses illustrative data only;
packages with any order have deletion disabled. The implemented version lives
in `apps/admin/src/WeeklyPackageList.tsx` and uses FastAPI, not mock writes.
