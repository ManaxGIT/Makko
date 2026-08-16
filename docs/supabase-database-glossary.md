# Makko — Cẩm nang thuật ngữ Supabase và Database

Tài liệu này giải thích các thuật ngữ được sử dụng trong database Makko. Có thể hình dung hệ thống như một tòa nhà:

- **Database** là toàn bộ tòa nhà.
- **Table** là từng căn phòng.
- **Row** là một hồ sơ trong phòng.
- **RLS và policy** là bảo vệ quyết định ai được vào và xem hồ sơ nào.
- **RPC** là quầy dịch vụ thực hiện một quy trình có kiểm soát.
- **Trigger** là cảm biến tự chạy khi có sự kiện.
- **Migration** là bản vẽ ghi lại từng lần thay đổi tòa nhà.

## Mục lục

1. [Database, schema, table và row](#1-database-schema-table-và-row)
2. [Primary key và foreign key](#2-primary-key-và-foreign-key)
3. [Constraint và enum](#3-constraint-và-enum)
4. [Index](#4-index)
5. [RLS và access policy](#5-rls-và-access-policy)
6. [GRANT và database role](#6-grant-và-database-role)
7. [RPC và function](#7-rpc-và-function)
8. [Trigger](#8-trigger)
9. [Transaction](#9-transaction)
10. [Migration](#10-migration)
11. [Data API, JWT và auth.uid()](#11-data-api-jwt-và-authuid)
12. [SECURITY DEFINER](#12-security-definer)
13. [Tra cứu nhanh](#13-tra-cứu-nhanh)

## 1. Database, schema, table và row

### Database

Database là nơi lưu toàn bộ dữ liệu của Makko. Supabase cung cấp một database PostgreSQL chứa người dùng, địa chỉ, yêu cầu đi chợ, mặt hàng, tin nhắn, hóa đơn, đánh giá và thông báo.

### Schema

Schema là vùng chứa dùng để tổ chức table và function. Makko sử dụng:

- `public`: các bảng và RPC có thể được cung cấp qua Data API.
- `auth`: dữ liệu đăng nhập do Supabase Auth quản lý.
- `private`: các function nội bộ không cho ứng dụng gọi trực tiếp.

Ví dụ tên đầy đủ của một đối tượng:

```text
public.shopping_requests
auth.users
private.is_request_participant()
```

### Table

Table là nơi lưu một loại dữ liệu, tương tự bảng Excel nhưng có kiểu dữ liệu, quan hệ và quy tắc chặt chẽ.

Ví dụ bảng `shopping_requests`:

| id | customer_id | title | status |
|---|---|---|---|
| `req-001` | `user-a` | Mua thực phẩm | `open` |
| `req-002` | `user-b` | Mua thuốc | `shopping` |

### Row hoặc record

Mỗi dòng trong table là một row/record. Một row trong `shopping_requests` đại diện cho một yêu cầu đi chợ.

## 2. Primary key và foreign key

### Primary key — khóa chính

Primary key là giá trị định danh duy nhất của mỗi row:

```sql
id uuid primary key
```

Makko chủ yếu dùng UUID vì khó đoán, phù hợp để gửi ra ứng dụng và tương thích với `auth.users.id` của Supabase.

### Foreign key — khóa ngoại

Foreign key tạo quan hệ giữa hai bảng:

```sql
customer_id uuid references public.profiles(id)
```

Quy tắc này đảm bảo `customer_id` phải trỏ tới một profile tồn tại. Một số quan hệ của Makko:

```text
profiles
└── shopping_requests
    ├── request_items
    ├── request_assignments
    ├── messages
    └── receipts
```

## 3. Constraint và enum

### Constraint — ràng buộc

Constraint bảo đảm dữ liệu hợp lệ ngay trong database:

```sql
check (rating between 1 and 5)
check (delivery_fee >= 0)
check (quantity > 0)
unique (request_id, reviewer_id, reviewee_id)
```

Ngay cả khi frontend có lỗi, database vẫn từ chối dữ liệu vi phạm quy tắc.

### Enum

Enum là tập giá trị được định nghĩa trước. Trạng thái yêu cầu của Makko gồm:

```text
draft → open → accepted → shopping → delivering → completed
                          ↘ cancelled / disputed
```

Database sẽ từ chối trạng thái không thuộc danh sách. Điều này giúp dữ liệu và code TypeScript nhất quán.

## 4. Index

Index giống mục lục cuối sách: giúp PostgreSQL tìm dữ liệu nhanh mà không đọc toàn bộ bảng.

Ví dụ trang “Yêu cầu của tôi” thường lọc theo người đăng và sắp xếp theo thời gian:

```sql
select *
from public.shopping_requests
where customer_id = ...
order by created_at desc;
```

Index phù hợp là:

```sql
(customer_id, created_at desc)
```

Makko còn dùng partial index chỉ chứa yêu cầu đang mở:

```sql
create index ...
on public.shopping_requests(created_at desc)
where status = 'open';
```

Index cải thiện tốc độ đọc nhưng tốn dung lượng và làm thao tác ghi đắt hơn. Vì vậy chỉ nên tạo theo nhu cầu truy vấn thực tế.

## 5. RLS và access policy

### RLS — Row Level Security

RLS là bảo mật theo từng dòng dữ liệu. Khi bật RLS cho `addresses`, mỗi người chỉ có thể nhìn thấy địa chỉ của mình.

Nếu người A gọi:

```sql
select * from public.addresses;
```

Policy khiến truy vấn có ý nghĩa tương đương:

```sql
select *
from public.addresses
where owner_id = 'id-cua-nguoi-A';
```

RLS chạy trong PostgreSQL nên người dùng không thể bỏ qua bằng cách sửa frontend. Database Makko đã bật RLS cho toàn bộ 11 bảng trong schema `public`.

### Access policy — chính sách truy cập

RLS bật cơ chế bảo vệ; policy định nghĩa chính xác ai được làm gì:

- `SELECT`: ai được đọc?
- `INSERT`: ai được tạo?
- `UPDATE`: ai được sửa?
- `DELETE`: ai được xóa?

Ví dụ policy địa chỉ:

```sql
create policy addresses_all_own
on public.addresses
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
```

Trong đó:

- `USING` kiểm tra row hiện tại có được đọc/sửa/xóa không.
- `WITH CHECK` kiểm tra dữ liệu mới sau khi insert/update có hợp lệ không.

Các quy tắc quan trọng của Makko:

- Người ngoài không đọc được địa chỉ chính xác.
- Customer đọc được yêu cầu mình đăng.
- Shopper đọc được yêu cầu mình đang nhận.
- Chỉ hai bên của yêu cầu đọc được chat và hóa đơn.
- Mỗi người chỉ đọc được thông báo của mình.

## 6. GRANT và database role

### GRANT

`GRANT` quyết định một role có được truy cập table/function hay không. RLS policy quyết định role đó được thao tác trên những row nào.

```sql
grant select on public.messages to authenticated;
```

Luồng kiểm tra:

```text
Request → GRANT cho phép truy cập đối tượng → RLS lọc từng row
```

Nếu thiếu `GRANT`, request bị từ chối ngay cả khi policy đúng. Nếu có `GRANT` nhưng policy không cho phép, người dùng không nhận được row tương ứng.

### Database role

| Role | Ý nghĩa |
|---|---|
| `anon` | Request chưa đăng nhập hoặc không có JWT hợp lệ |
| `authenticated` | Người dùng đã đăng nhập bằng Supabase Auth |
| `service_role` | Backend đặc quyền, có thể bỏ qua RLS |
| `postgres` | Chủ database với quyền quản trị cao nhất |

Không bao giờ đặt `service_role` key hoặc mật khẩu PostgreSQL trong ứng dụng Expo/frontend. Frontend chỉ sử dụng publishable key cùng JWT người dùng.

## 7. RPC và function

### Function

Database function là đoạn logic chạy bên trong PostgreSQL. Function nội bộ của Makko gồm:

```text
private.is_request_participant()
private.is_active_shopper()
private.owns_editable_request()
```

Chúng giúp policies kiểm tra quyền sở hữu và quan hệ với một yêu cầu.

### RPC — Remote Procedure Call

RPC là database function được ứng dụng gọi như một API:

```ts
const { data, error } = await supabase.rpc('accept_request', {
  target_request_id: requestId,
});
```

RPC `accept_request` thực hiện toàn bộ quy trình nhận yêu cầu trong database:

1. Kiểm tra người dùng đã đăng nhập.
2. Kiểm tra đơn vẫn là `open`.
3. Kiểm tra người nhận không phải customer.
4. Chuyển đơn thành `accepted`.
5. Tạo `request_assignment`.
6. Trigger ghi lịch sử trạng thái.

Các RPC hiện có:

| RPC | Công dụng |
|---|---|
| `get_public_profile` | Lấy hồ sơ công khai, không trả số điện thoại |
| `list_open_requests` | Lấy yêu cầu mở, ẩn địa chỉ chính xác |
| `publish_request` | Đăng một bản nháp |
| `accept_request` | Nhận yêu cầu nguyên tử |
| `transition_request` | Chuyển trạng thái theo đúng quy tắc |

## 8. Trigger

Trigger là logic tự chạy khi một sự kiện database xảy ra.

### Tạo profile tự động

```text
INSERT auth.users
    ↓ on_auth_user_created
INSERT public.profiles
```

Khi Supabase Auth tạo tài khoản, trigger tự tạo profile Makko tương ứng.

### Cập nhật thời gian

Khi một row được sửa, trigger tự cập nhật `updated_at = now()`.

### Audit trạng thái

Khi yêu cầu đổi từ `open` sang `accepted`, trigger tự thêm một row vào `request_status_history`, lưu trạng thái cũ, trạng thái mới, người thực hiện và thời gian.

## 9. Transaction

Transaction đảm bảo một nhóm thao tác hoặc thành công toàn bộ, hoặc được hoàn tác toàn bộ.

Ví dụ nhận đơn gồm:

```text
1. shopping_requests: open → accepted
2. request_assignments: tạo shopper đang nhận
```

Nếu bước 2 lỗi, bước 1 cũng bị hoàn tác. Database không rơi vào trạng thái đơn đã `accepted` nhưng không có shopper.

RPC `accept_request` chạy trong một transaction ngắn. Khi hai shopper nhận cùng lúc, điều kiện update và unique index bảo đảm chỉ một người thành công.

## 10. Migration

Migration là file SQL ghi lại một lần thay đổi cấu trúc database. Migration đầu tiên của Makko là:

```text
supabase/migrations/20260815201706_init_makko_mvp.sql
```

Nó tạo bảng, enum, constraint, foreign key, index, RLS, policies, RPC, triggers và quyền truy cập.

Migration giúp:

- Theo dõi lịch sử thay đổi trong Git.
- Tạo lại database ở môi trường khác.
- Đồng bộ development, staging và production.
- Review và triển khai thay đổi theo đúng thứ tự.

Không sửa một migration đã chạy trên database chung. Khi thêm tính năng, tạo migration mới:

```text
20260815201706_init_makko_mvp.sql
20260820100000_add_payment_tables.sql
20260825140000_add_storage_policies.sql
```

## 11. Data API, JWT và auth.uid()

### Data API

Supabase cung cấp REST API dựa trên table và function PostgreSQL. Frontend có thể gọi:

```ts
supabase.from('addresses').select();
supabase.rpc('accept_request', { target_request_id: requestId });
```

Luồng xử lý:

```text
Ứng dụng Expo
    ↓ publishable key + JWT
Supabase Data API
    ↓ xác định database role
GRANT
    ↓ kiểm tra quyền đối tượng
RLS policy hoặc RPC
    ↓
PostgreSQL
```

### JWT

JWT là bằng chứng danh tính được Supabase ký sau khi người dùng đăng nhập. Client gửi JWT trong mỗi request cần xác thực.

### `auth.uid()`

Trong PostgreSQL, `(select auth.uid())` trả về UUID của người đang đăng nhập. Policy sử dụng nó để kiểm tra quyền sở hữu:

```sql
(select auth.uid()) = owner_id
```

Không nhận `user_id` từ frontend rồi tin trực tiếp, vì client có thể sửa request để giả mạo người khác.

## 12. SECURITY DEFINER

Mặc định function chạy với quyền của người gọi, gọi là `SECURITY INVOKER`.

`SECURITY DEFINER` khiến function chạy với quyền của người tạo function. Makko sử dụng nó cho những RPC cần thực hiện một quy trình đặc quyền nhưng có kiểm tra chặt chẽ, ví dụ `accept_request`.

Shopper không được tùy ý update yêu cầu của customer, nhưng RPC có thể:

1. Xác minh `auth.uid()`.
2. Kiểm tra trạng thái và quyền.
3. Thực hiện đúng thay đổi được cho phép.

Vì đây là cơ chế mạnh, RPC Makko được bảo vệ bằng cách:

- Kiểm tra người dùng đã đăng nhập.
- Chỉ cấp `EXECUTE` cho `authenticated`.
- Thu hồi quyền của `anon` và `public`.
- Đặt `search_path = ''`.
- Dùng tên schema đầy đủ trong function.
- Kiểm tra trạng thái và quan hệ trong chính function.

## 13. Tra cứu nhanh

| Thuật ngữ | Ý nghĩa |
|---|---|
| Database | Toàn bộ kho dữ liệu PostgreSQL |
| Schema | Vùng tổ chức table và function |
| Table | Nơi lưu một loại dữ liệu |
| Row/record | Một bản ghi trong table |
| Primary key | ID duy nhất của mỗi row |
| Foreign key | Quan hệ giữa các table |
| Constraint | Quy tắc bảo đảm dữ liệu hợp lệ |
| Enum | Danh sách giá trị cố định |
| Index | Cấu trúc tăng tốc truy vấn |
| RLS | Bảo vệ theo từng row |
| Policy | Quy định ai được làm gì với row nào |
| GRANT | Cho role quyền truy cập table/function |
| RPC | Gọi quy trình database như API |
| Function | Logic chạy trong PostgreSQL |
| Trigger | Logic tự chạy khi có sự kiện |
| Transaction | Thành công hoặc hoàn tác toàn bộ |
| Migration | Lịch sử thay đổi cấu trúc database |
| Data API | API tự động trên table/function |
| JWT | Bằng chứng danh tính người đăng nhập |
| `auth.uid()` | ID của người dùng hiện tại trong database |
| `SECURITY DEFINER` | Function chạy với quyền của người tạo |

## Tài liệu liên quan trong Makko

- [User flow](user-flow.md)
- [Thiết kế database](database-design.md)
- [Migration database đầu tiên](../supabase/migrations/20260815201706_init_makko_mvp.sql)

