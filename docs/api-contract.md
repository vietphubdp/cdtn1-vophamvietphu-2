## Mẫu đặc tả riêng của track SE: Hợp đồng API

> Bản cập nhật cho BT2. Endpoint 1–9 giữ nguyên số thứ tự của bản BT1; endpoint 10–17 là bổ sung. Danh sách thay đổi và lý do ở `docs/thay-doi-thiet-ke.md`.

### 1. Danh sách endpoint

| #   | Phương thức | Đường dẫn                           | Mục đích                                                       | Yêu cầu          | Vai trò gọi được                |
| --- | ----------- | ----------------------------------- | -------------------------------------------------------------- | ---------------- | ------------------------------- |
| 1   | GET         | `/api/customers?phone={phone}`      | Tra cứu khách theo số điện thoại (đã chuẩn hóa)                | US1              | Tiếp nhận, Quản lý              |
| 2   | GET         | `/api/customers/{id}/devices`       | Lấy danh sách thiết bị của khách                               | US1              | Tiếp nhận, Quản lý              |
| 3   | POST        | `/api/customers`                    | Tạo khách hàng mới khi chưa tồn tại                            | US2              | Tiếp nhận                       |
| 4   | POST        | `/api/customers/{id}/devices`       | Ghi nhận thiết bị mới cho khách                                | US3              | Tiếp nhận                       |
| 5   | GET         | `/api/devices/{id}/warranty`        | Xác định tình trạng bảo hành của thiết bị                      | US4              | Tiếp nhận, Quản lý              |
| 6   | GET         | `/api/issue-categories`             | Lấy danh mục nhóm sự cố kèm mức ưu tiên mặc định               | US6, HT2         | Tiếp nhận, Quản lý              |
| 7   | POST        | `/api/tickets`                      | Lập phiếu bảo hành mới                                         | US5, US6         | Tiếp nhận                       |
| 8   | GET         | `/api/tickets?page=&size=`          | Danh sách phiếu của trung tâm, sắp theo hạn cam kết            | US7              | Tiếp nhận, Quản lý              |
| 9   | POST        | `/api/auth/login`                   | Đăng nhập bằng tài khoản mẫu, cấp JWT trong cookie             | HT1 (W13)        | Mọi người dùng (chưa đăng nhập) |
| 10  | POST        | `/api/auth/logout`                  | Đăng xuất, xóa cookie JWT                                      | HT1              | Mọi người dùng                  |
| 11  | GET         | `/api/products`                     | Lấy danh mục sản phẩm (dropdown "Tên máy" ở M2)                | US3, HT2         | Tiếp nhận, Quản lý              |
| 12  | POST        | `/api/products`                     | Thêm sản phẩm                                                  | HT2              | Quản lý                         |
| 13  | PUT         | `/api/products/{id}`                | Sửa sản phẩm (kể cả dùng lại sản phẩm đã ngừng)                | HT2              | Quản lý                         |
| 14  | DELETE      | `/api/products/{id}`                | Ngừng sử dụng sản phẩm (`is_active = false`, QT-13)            | HT2              | Quản lý                         |
| 15  | POST        | `/api/issue-categories`             | Thêm nhóm sự cố                                                | HT2, NFR5        | Quản lý                         |
| 16  | PUT         | `/api/issue-categories/{id}`        | Sửa nhóm sự cố, đổi mức ưu tiên mặc định                       | HT2, NFR5        | Quản lý                         |
| 17  | DELETE      | `/api/issue-categories/{id}`        | Ngừng sử dụng nhóm sự cố (`is_active = false`, QT-13)          | HT2              | Quản lý                         |

### 2. Quy ước chung

- Phạm vi: hợp đồng này áp dụng cho các đường dẫn `/api/*`. Các trang M1–M3 và trang đăng nhập do máy chủ render bằng EJS và trả HTML; dữ liệu trên trang được lấy và gửi qua các API dưới đây bằng lớp client `api-client.js`.
- Định dạng trao đổi: JSON, mã hóa UTF-8. Yêu cầu có body gửi kèm header `Content-Type: application/json`.
- Xác thực: sau khi đăng nhập (endpoint 9), máy chủ cấp JWT trong cookie `HttpOnly; SameSite=Strict`; trình duyệt tự gửi cookie ở mọi yêu cầu tiếp theo. JWT chứa mã nhân viên, họ tên, vai trò (`TIEP_NHAN` hoặc `QUAN_LY_TRUNG_TAM`), mã và tên trung tâm của người dùng (tên trung tâm dùng cho thanh tiêu đề các trang, không phải tra lại CSDL). Mọi endpoint trừ endpoint 9 và 10 trả `401` nếu thiếu hoặc hết hạn JWT.
- Tên trường dùng snake_case, trùng tên cột trong cơ sở dữ liệu (ERD) để dễ truy vết.
- Thời gian dùng chuẩn ISO 8601 kèm múi giờ, ví dụ `2026-10-08T14:30:00+07:00`; ngày dùng `YYYY-MM-DD`. Mọi quy tắc theo ngày (thứ trong tuần ở QT-04, ngày hết bảo hành ở QT-05, ngày mua không ở tương lai, năm trong mã phiếu) tính theo giờ Việt Nam (UTC+7), không theo giờ của máy chủ.
- Số điện thoại nhận vào ở nhiều dạng (QT-02), lưu và trả về dạng 10 chữ số. Với vai trò Tiếp nhận, mọi số điện thoại trả về đều ở dạng che (`090****567`), kể cả trong response của endpoint 3; chỉ vai trò Quản lý nhận số đầy đủ (NFR2, QT-15).
- Phiếu bảo hành chỉ trả theo trung tâm của người gọi (QT-14): endpoint 8 luôn lọc theo trung tâm trong JWT, không nhận trung tâm từ tham số. Khách hàng, thiết bị và danh mục là dữ liệu dùng chung toàn công ty (khách đến trung tâm nào cũng được tiếp nhận), nên không lọc theo trung tâm.
- Danh mục (sản phẩm, nhóm sự cố) không bao giờ bị xóa vật lý (QT-13): `DELETE` chỉ đặt `is_active = false`. Endpoint 6 và 11 mặc định chỉ trả mục đang sử dụng; Quản lý thêm `?include_inactive=true` để xem cả mục đã ngừng.
- `403` chỉ dùng khi vai trò của người gọi không được phép gọi endpoint đó (cột "Vai trò gọi được" ở mục 1).
- Phân trang: `page` (bắt đầu từ 1) và `size` (mặc định 20, tối đa 100). Response kèm `total`.
- Mọi lỗi trả về cùng một cấu trúc: `{ "error": { "code": "...", "message": "...", "fields": {...}, "details": {...} } }`. `fields` (lỗi theo từng trường) chỉ có ở lỗi 400; `details` (dữ liệu bổ sung, ví dụ `customer_id` của hồ sơ đã có) chỉ có khi cần; cả hai đều có thể vắng mặt.
- Mã lỗi dùng chung: `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT`, `422 BUSINESS_RULE_VIOLATION`, `500 INTERNAL_ERROR` (thông báo chung, không lộ stack trace, tên bảng hay câu SQL).

### 3. Chi tiết endpoint

#### 3.1. `GET /api/customers?phone={phone}` · Tra cứu khách · US1

Request: `GET /api/customers?phone=%2B84901234567` (số được chuẩn hóa thành `0901234567` trước khi tra)

**Response 200 OK** (vai trò Tiếp nhận, số điện thoại bị che)

```json
{
    "customer_id": 1024,
    "full_name": "Nguyễn Văn An",
    "phone": "090****567",
    "email": null,
    "address": "12 Nguyễn Tri Phương, Quận 10"
}
```

**Response 400 Bad Request** (số không đủ 10 chữ số sau khi chuẩn hóa, AC3 của US1)

```json
{
    "error": {
        "code": "VALIDATION_FAILED",
        "message": "Số điện thoại không hợp lệ",
        "fields": { "phone": "Phải đủ 10 chữ số sau khi chuẩn hóa" }
    }
}
```

**Response 404 Not Found** (chưa có khách, AC2 của US1): `{ "error": { "code": "NOT_FOUND", "message": "Không tìm thấy khách hàng" } }`. Giao diện dùng mã này để đề nghị tạo khách mới (endpoint 3).

#### 3.2. `GET /api/customers/{id}/devices` · Danh sách thiết bị · US1

**Response 200 OK**

```json
{
    "items": [
        {
            "device_id": 3311,
            "product_name": "Samsung Galaxy A52",
            "serial_no": "SN-A52-778901",
            "purchase_date": "2026-03-05"
        },
        {
            "device_id": 3350,
            "product_name": "iPhone 13",
            "serial_no": "358240051111110",
            "purchase_date": null
        }
    ],
    "total": 2
}
```

**Response 404 Not Found:** khách không tồn tại. **Response 401 Unauthorized:** chưa đăng nhập hoặc JWT hết hạn.

#### 3.3. `POST /api/customers` · Tạo khách hàng · US2

**Request body:** `{ "full_name": "Lê Văn Cường", "phone": "+84 93 123 4888", "email": null, "address": "45 Lý Thường Kiệt, Quận 10" }`

**Response 201 Created** (vai trò Tiếp nhận nên số bị che): `{ "customer_id": 1031, "full_name": "Lê Văn Cường", "phone": "093****888", "email": null, "address": "45 Lý Thường Kiệt, Quận 10", "created_at": "2026-10-08T14:20:00+07:00" }`

**Response 409 Conflict** (QT-01, số đã tồn tại; giao diện dùng `details.customer_id` để mở hồ sơ có sẵn)

```json
{
    "error": {
        "code": "CONFLICT",
        "message": "Số điện thoại đã tồn tại",
        "details": { "customer_id": 1024 }
    }
}
```

#### 3.4. `POST /api/customers/{id}/devices` · Ghi nhận thiết bị · US3

**Request body:** `{ "product_id": 5, "serial_no": "OPA78-55120", "purchase_date": null, "warranty_months": null }`. Bỏ trống `warranty_months` thì lấy `default_warranty_months` của sản phẩm (FR4).

**Response 201 Created:** `{ "device_id": 3360, "customer_id": 1031, "product_id": 5, "product_name": "Oppo A78", "serial_no": "OPA78-55120", "purchase_date": null, "warranty_months": 12, "created_at": "2026-10-08T14:22:00+07:00" }`

**Response 409 Conflict** (QT-03): `{ "error": { "code": "CONFLICT", "message": "Serial/IMEI đã được ghi nhận cho một thiết bị khác" } }`. Áp dụng cả khi serial đã thuộc chính khách đó (không ghi nhận trùng) và khi thuộc khách khác (một thiết bị chỉ thuộc một khách).

#### 3.5. `GET /api/devices/{id}/warranty` · Xác định tình trạng bảo hành · US4

Tính theo QT-05 tại thời điểm gọi: `warranty_expires_on` = `purchase_date` cộng `warranty_months` tháng (tháng đích không có ngày đó thì lấy ngày cuối tháng); còn bảo hành nếu ngày hiện tại (giờ Việt Nam) ≤ `warranty_expires_on`; thiếu `purchase_date` thì chưa xác minh bảo hành.

**Response 200 OK** (thiết bị mua 2026-03-05, bảo hành 12 tháng, gọi ngày 2026-10-08)

```json
{
    "device_id": 3311,
    "purchase_date": "2026-03-05",
    "warranty_months": 12,
    "warranty_expires_on": "2027-03-05",
    "warranty_status": "CON_BAO_HANH"
}
```

Hai kết quả khác của cùng response 200 (khớp AC2, AC3 của US4):

- `"warranty_status": "HET_BAO_HANH"` khi ngày gọi sau `warranty_expires_on`; giao diện hiện cảnh báo, phiếu vẫn lập được và được ghi là có tính phí.
- `"warranty_status": "CHUA_XAC_MINH"`, `"purchase_date": null`, `"warranty_expires_on": null` khi thiếu ngày mua; giao diện hiện "chờ Quản lý trung tâm quyết định".

**Response 404 Not Found:** thiết bị không tồn tại. **Response 401 Unauthorized:** chưa đăng nhập hoặc JWT hết hạn.

#### 3.6. `GET /api/issue-categories` · Danh mục nhóm sự cố · US6

**Response 200 OK:** `{ "items": [ { "category_id": 3, "category_name": "Sạc", "default_priority": "TRUNG_BINH", "is_active": true } ], "total": 6 }`

#### 3.7. `POST /api/tickets` · Lập phiếu bảo hành · US5, US6

Header bổ sung: `Idempotency-Key: <uuid>`. Cùng một khóa gửi lại sau khi mất kết nối (ngoại lệ 9c, NFR4) trả về phiếu đã lập với mã 200, không lập phiếu trùng và không so sánh lại body. Nếu khóa đã dùng cho phiếu của trung tâm khác thì trả 409.

**Request body**

```json
{
    "customer_id": 1024,
    "device_id": 3311,
    "issue_desc": "Máy không nhận sạc, cắm sạc báo lỗi phụ kiện",
    "category_id": 3,
    "priority": "TRUNG_BINH"
}
```

`warranty_status` không nhận từ body: hệ thống tính theo QT-05 tại `received_at` và lưu vào phiếu (`HET_BAO_HANH` = có tính phí, `CHUA_XAC_MINH` = chờ Quản lý quyết định). Mã phiếu dạng `BH` + 6 chữ số từ một sequence chung (không đánh lại theo năm) + `/` + năm của `received_at`.

**Response 201 Created** (tiếp nhận lúc 14:30 thứ Năm, Trung bình 72 giờ, bỏ qua Chủ nhật, khớp AC5 của US5)

```json
{
    "ticket_id": 88231,
    "ticket_code": "BH000231/2026",
    "customer_id": 1024,
    "device_id": 3311,
    "center_id": 2,
    "category_id": 3,
    "priority": "TRUNG_BINH",
    "status": "MOI",
    "warranty_status": "CON_BAO_HANH",
    "received_at": "2026-10-08T14:30:00+07:00",
    "due_date": "2026-10-12T14:30:00+07:00"
}
```

**Response 400 Bad Request** (AC2 của US5)

```json
{
    "error": {
        "code": "VALIDATION_FAILED",
        "message": "Dữ liệu không hợp lệ",
        "fields": { "issue_desc": "Mô tả lỗi phải có từ 10 đến 2000 ký tự" }
    }
}
```

**Response 404 Not Found:** `customer_id` hoặc `device_id` không tồn tại.
**Response 422 Unprocessable Entity** (AC3 của US5, QT-03): `{ "error": { "code": "BUSINESS_RULE_VIOLATION", "message": "Thiết bị không thuộc khách hàng này" } }`.
**Response 403 Forbidden:** người gọi không có vai trò Tiếp nhận (ví dụ Quản lý trung tâm).

#### 3.8. `GET /api/tickets?page=1&size=20` · Danh sách phiếu · US7

Lọc theo trung tâm trong JWT (QT-14), sắp theo `due_date` tăng dần rồi `ticket_id` tăng dần. `is_overdue` tính khi truy vấn (FR11): `due_date` < thời điểm hiện tại và `status` không phải `HOAN_TAT`, `DA_DONG`. Số điện thoại che theo vai trò (QT-15).

**Response 200 OK** (vai trò Tiếp nhận)

```json
{
    "items": [
        {
            "ticket_id": 88198,
            "ticket_code": "BH000198/2026",
            "customer_name": "Trần Thị Bình",
            "phone": "091****321",
            "product_name": "iPhone 13",
            "serial_no": "358240051111110",
            "category_name": "Pin",
            "priority": "CAO",
            "warranty_status": "CON_BAO_HANH",
            "status": "DANG_XU_LY",
            "received_at": "2026-10-09T08:10:00+07:00",
            "due_date": "2026-10-10T08:10:00+07:00",
            "is_overdue": true
        }
    ],
    "page": 1,
    "size": 20,
    "total": 236
}
```

`category_name` là `null` khi phiếu chưa phân loại.

#### 3.9. `POST /api/auth/login` · Đăng nhập · HT1 (W13)

**Request body**

```json
{ "username": "lan.q10", "password": "••••••••" }
```

**Response 200 OK:** header `Set-Cookie: token=<JWT>; HttpOnly; SameSite=Strict; Path=/`, body:

```json
{
    "employee_id": 7,
    "full_name": "Trần Thị Lan",
    "role": "TIEP_NHAN",
    "center_id": 2,
    "center_name": "Trung tâm bảo hành Quận 10"
}
```

**Response 400 Bad Request:** thiếu `username` hoặc `password`. **Response 401 Unauthorized:** sai tên đăng nhập hoặc mật khẩu (`{ "error": { "code": "UNAUTHENTICATED", "message": "Sai tên đăng nhập hoặc mật khẩu" } }`; không nói rõ sai phần nào).

#### 3.10. `POST /api/auth/logout` · Đăng xuất · HT1

**Response 204 No Content:** header `Set-Cookie: token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`. Gọi khi chưa đăng nhập cũng trả 204.

#### 3.11. Danh mục sản phẩm (endpoint 11–14) và nhóm sự cố (endpoint 6, 15–17) · HT2

Hai danh mục dùng cùng một khuôn:

| Thao tác | Request | Response thành công |
| --- | --- | --- |
| Đọc | `GET /api/products` (`?include_inactive=true` nếu là Quản lý) | 200 `{ "items": [ { "product_id": 5, "product_name": "Oppo A78", "default_warranty_months": 12, "is_active": true } ], "total": 24 }` |
| Thêm | `POST /api/products` body `{ "product_name": "Oppo A79", "default_warranty_months": 18 }` | 201, trả bản ghi vừa tạo |
| Sửa | `PUT /api/products/5` body gửi đủ `product_name` và `default_warranty_months` (cả hai bắt buộc ở `PUT`), có thể kèm `"is_active": true` để dùng lại; vắng `is_active` thì giữ nguyên | 200, trả bản ghi sau khi sửa |
| Ngừng dùng | `DELETE /api/products/5` | 200, trả bản ghi với `"is_active": false` |

Nhóm sự cố: thay đường dẫn bằng `/api/issue-categories`, trường là `category_name`, `default_priority`, `is_active`.

Lỗi: 400 sai định dạng (mục 5) · 404 không tồn tại · 409 tên đã tồn tại · 403 không phải vai trò Quản lý (thêm, sửa, ngừng dùng) · 401.

### 4. Mã trạng thái của toàn bộ endpoint

| #     | Thành công                   | Lỗi (ít nhất hai)                                                                                                                                                              |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | 200                          | 400 số không hợp lệ · 404 không tìm thấy khách · 401                                                                                                                           |
| 2     | 200                          | 404 khách không tồn tại · 401                                                                                                                                                  |
| 3     | 201                          | 400 thiếu hoặc sai trường · 409 số điện thoại đã tồn tại (QT-01, `details.customer_id` là hồ sơ có sẵn) · 403 không phải vai trò Tiếp nhận · 401                             |
| 4     | 201                          | 400 thiếu serial hoặc tên máy, sản phẩm không tồn tại hoặc ngừng dùng, ngày mua ở tương lai, số tháng ngoài 1–60 · 409 serial đã được ghi nhận (QT-03) · 404 khách không tồn tại · 403 không phải vai trò Tiếp nhận · 401 |
| 5     | 200                          | 404 thiết bị không tồn tại · 401                                                                                                                                               |
| 6     | 200                          | 401 chưa đăng nhập · 500 lỗi hệ thống (thông báo chung, không lộ chi tiết)                                                                                                     |
| 7     | 201 (gửi lại cùng khóa: 200) | 400 · 404 · 409 khóa chống trùng đã dùng ở trung tâm khác · 422 thiết bị không thuộc khách (QT-03) · 403 không phải vai trò Tiếp nhận · 401                                     |
| 8     | 200                          | 400 `size` vượt 100 hoặc `page` < 1 · 401                                                                                                                                      |
| 9     | 200                          | 400 thiếu trường · 401 sai tên đăng nhập hoặc mật khẩu                                                                                                                         |
| 10    | 204                          | (không có lỗi nghiệp vụ) · 500 lỗi hệ thống                                                                                                                                    |
| 11    | 200                          | 401 · 500 lỗi hệ thống                                                                                                                                                         |
| 12, 15 | 201                         | 400 thiếu hoặc sai trường · 409 tên đã tồn tại · 403 không phải vai trò Quản lý · 401                                                                                          |
| 13, 16 | 200                         | 400 · 404 không tồn tại · 409 tên đã tồn tại · 403 · 401                                                                                                                       |
| 14, 17 | 200                         | 404 không tồn tại · 403 · 401                                                                                                                                                  |

### 5. Bảng validation

**`POST /api/customers`**

| Trường    | Bắt buộc | Kiểu / ràng buộc                                                | Thông báo lỗi khi vi phạm               |
| --------- | -------- | --------------------------------------------------------------- | --------------------------------------- |
| full_name | Có       | Chuỗi, 1–120 ký tự, bỏ khoảng trắng đầu cuối                    | Họ tên phải có từ 1 đến 120 ký tự       |
| phone     | Có       | Chuẩn hóa về 10 chữ số bắt đầu bằng 0 (QT-02); duy nhất (QT-01) | Số điện thoại không hợp lệ / đã tồn tại |
| email     | Không    | Địa chỉ thư điện tử hợp lệ, tối đa 120 ký tự                    | Email không hợp lệ                      |
| address   | Không    | Chuỗi, tối đa 255 ký tự                                         | Địa chỉ tối đa 255 ký tự                |

**Chuẩn hóa số điện thoại (QT-02)** — áp cho `phone` ở endpoint 1 và 3. Thứ tự: bỏ dấu cách và dấu chấm → nếu bắt đầu bằng `+84` hoặc `84` và phần còn lại đủ 9 chữ số thì thay tiền tố bằng `0` → kết quả phải đúng 10 chữ số, bắt đầu bằng `0`. Ký tự khác (gạch ngang, ngoặc, chữ cái) không được chấp nhận. Lỗi validation được gom cùng các trường khác trong một response 400.

| Nhập vào | Kết quả |
| --- | --- |
| `0901234567`, `0901 234 567`, `090.123.4567` | `0901234567` |
| `+84901234567`, `+84 90 123 4567`, `84901234567` | `0901234567` |
| `090123456` (9 số), `09012345678` (11 số), `901234567` (thiếu 0 đầu) | 400 |
| `0901-234-567`, `(+84) 901234567`, `090abc4567` | 400 |

**`POST /api/customers/{id}/devices`**

| Trường          | Bắt buộc | Kiểu / ràng buộc                                                              | Thông báo lỗi khi vi phạm                |
| --------------- | -------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| product_id      | Có       | Số nguyên dương, phải tồn tại trong danh mục sản phẩm và đang sử dụng         | Sản phẩm không hợp lệ                    |
| serial_no       | Có       | Chuỗi 1–50 ký tự, bỏ khoảng trắng đầu cuối; duy nhất toàn hệ thống (QT-03)    | Serial/IMEI bắt buộc và không được trùng |
| purchase_date   | Không    | Ngày `YYYY-MM-DD`, không sau ngày hiện tại (giờ Việt Nam)                     | Ngày mua không hợp lệ                    |
| warranty_months | Không    | Số nguyên 1–60; bỏ trống thì lấy `default_warranty_months` của sản phẩm (FR4) | Số tháng bảo hành không hợp lệ           |

**`POST /api/tickets`**

| Trường      | Bắt buộc | Kiểu / ràng buộc                                                                                      | Thông báo lỗi khi vi phạm              |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| customer_id | Có       | Số nguyên dương, phải tồn tại trong bảng customer (không tồn tại → 404)                              | Không tìm thấy khách hàng              |
| device_id   | Có       | Số nguyên dương, phải tồn tại (→ 404) và thuộc về `customer_id` (QT-03, → 422)                        | Thiết bị không thuộc khách hàng này    |
| issue_desc  | Có       | Chuỗi, bỏ khoảng trắng đầu cuối rồi mới đếm, độ dài 10–2000 ký tự; lưu bản đã bỏ khoảng trắng         | Mô tả lỗi phải có từ 10 đến 2000 ký tự |
| category_id | Không    | Số nguyên dương, phải tồn tại và đang sử dụng (→ 400); vắng hoặc `null` nghĩa là chưa phân loại; chuỗi rỗng hay giá trị khác → 400 | Nhóm sự cố không hợp lệ                |
| priority    | Không    | Một trong CAO / TRUNG_BINH / THAP; vắng hoặc `null` thì mặc định theo nhóm, Trung bình nếu chưa có nhóm; chuỗi rỗng hay giá trị khác → 400 | Mức ưu tiên không hợp lệ               |
| (hệ thống)  | —        | `center_id` lấy từ JWT của nhân viên, không nhận từ body; `Idempotency-Key` là UUID bắt buộc ở header | Thiếu khóa chống trùng                 |

**`GET /api/tickets`**

| Tham số | Bắt buộc | Kiểu / ràng buộc           | Thông báo lỗi khi vi phạm              |
| ------- | -------- | -------------------------- | -------------------------------------- |
| page    | Không    | Số nguyên ≥ 1, mặc định 1  | Trang phải là số nguyên từ 1           |
| size    | Không    | Số nguyên 1–100, mặc định 20 | Số dòng mỗi trang phải từ 1 đến 100  |

**`POST /api/auth/login`:** `username`, `password` bắt buộc, chuỗi khác rỗng.

**`POST` / `PUT /api/products`**

| Trường                  | Bắt buộc | Kiểu / ràng buộc                              | Thông báo lỗi khi vi phạm                     |
| ----------------------- | -------- | --------------------------------------------- | --------------------------------------------- |
| product_name            | Có       | Chuỗi 1–120 ký tự, bỏ khoảng trắng đầu cuối; duy nhất | Tên sản phẩm phải có từ 1 đến 120 ký tự / đã tồn tại |
| default_warranty_months | `POST`: không · `PUT`: có | Số nguyên 1–60; ở `POST` vắng thì mặc định 12 | Số tháng bảo hành phải từ 1 đến 60            |
| is_active               | Không    | Chỉ ở `PUT`, kiểu boolean                     | Trạng thái sử dụng không hợp lệ               |

**`POST` / `PUT /api/issue-categories`**

| Trường           | Bắt buộc | Kiểu / ràng buộc                             | Thông báo lỗi khi vi phạm                     |
| ---------------- | -------- | -------------------------------------------- | --------------------------------------------- |
| category_name    | Có       | Chuỗi 1–60 ký tự, bỏ khoảng trắng đầu cuối; duy nhất | Tên nhóm sự cố phải có từ 1 đến 60 ký tự / đã tồn tại |
| default_priority | Có       | Một trong CAO / TRUNG_BINH / THAP            | Mức ưu tiên không hợp lệ                      |
| is_active        | Không    | Chỉ ở `PUT`, kiểu boolean                    | Trạng thái sử dụng không hợp lệ               |

### 6. Tự kiểm hợp đồng API

- Mỗi endpoint nghiệp vụ nối được về ít nhất một User Story; endpoint 9, 10 (HT1) và 11–17 (HT2) là yêu cầu hỗ trợ ghi ở Mục 3.1a của SRS.
- Mỗi endpoint có ít nhất một response thành công và hai response lỗi (mục 4); endpoint 10 chỉ có một lỗi có thể xảy ra (500) vì đăng xuất luôn thành công.
- Mọi endpoint của User Story MUST (US1, US4, US5) có chi tiết request/response ở mục 3.
- Các quy tắc QT-01, QT-02, QT-03, QT-04, QT-05, QT-13, QT-14, QT-15 đã xuất hiện trong bảng validation, mã lỗi hoặc quy ước chung.
- Tên trường đã đối chiếu với ERD (`docs/erd.drawio`, `db/schema.sql`), kể cả `warranty_status`; trường tính khi truy vấn (`warranty_expires_on`, `is_overdue`, `product_name`, `customer_name`, `category_name`) không có cột riêng.
