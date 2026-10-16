## Mẫu đặc tả riêng của track SE: Hợp đồng API

### 1. Danh sách endpoint

| #   | Phương thức | Đường dẫn                      | Mục đích                                            | User Story       | Vai trò gọi được                |
| --- | ----------- | ------------------------------ | --------------------------------------------------- | ---------------- | ------------------------------- |
| 1   | GET         | `/api/customers?phone={phone}` | Tra cứu khách theo số điện thoại (đã chuẩn hóa)     | US1              | Tiếp nhận, Quản lý              |
| 2   | GET         | `/api/customers/{id}/devices`  | Lấy danh sách thiết bị của khách                    | US1              | Tiếp nhận, Quản lý              |
| 3   | POST        | `/api/customers`               | Tạo khách hàng mới khi chưa tồn tại                 | US2              | Tiếp nhận                       |
| 4   | POST        | `/api/customers/{id}/devices`  | Ghi nhận thiết bị mới cho khách                     | US3              | Tiếp nhận                       |
| 5   | GET         | `/api/devices/{id}/warranty`   | Xác định tình trạng bảo hành của thiết bị           | US4              | Tiếp nhận, Quản lý              |
| 6   | GET         | `/api/issue-categories`        | Lấy danh mục nhóm sự cố kèm mức ưu tiên mặc định    | US6              | Tiếp nhận, Quản lý              |
| 7   | POST        | `/api/tickets`                 | Lập phiếu bảo hành mới                              | US5, US6         | Tiếp nhận                       |
| 8   | GET         | `/api/tickets?page=&size=`     | Danh sách phiếu của trung tâm, sắp theo hạn cam kết | US7              | Tiếp nhận, Quản lý              |
| 9   | POST        | `/api/auth/login`              | Đăng nhập bằng tài khoản mẫu, cấp JWT trong cookie  | — (hạ tầng, W13) | Mọi người dùng (chưa đăng nhập) |

### 2. Quy ước chung

- Phạm vi: hợp đồng này áp dụng cho các đường dẫn `/api/*`. Các trang M1–M3 do máy chủ render bằng EJS và trả HTML; dữ liệu trên trang được lấy và gửi qua các API dưới đây bằng lớp client `api-client.js`.
- Định dạng trao đổi: JSON, mã hóa UTF-8. Header bắt buộc: `Content-Type: application/json`.
- Xác thực: sau khi đăng nhập (endpoint 9), máy chủ cấp JWT trong cookie `HttpOnly; SameSite=Strict`; trình duyệt tự gửi cookie ở mọi yêu cầu tiếp theo. JWT chứa vai trò (Tiếp nhận hoặc Quản lý) và trung tâm của người dùng. Mọi endpoint trừ endpoint 9 trả `401` nếu thiếu hoặc hết hạn JWT.
- Tên trường dùng snake_case, trùng tên cột trong cơ sở dữ liệu (ERD) để dễ truy vết.
- Thời gian dùng chuẩn ISO 8601 kèm múi giờ, ví dụ `2026-10-08T14:30:00+07:00`; ngày dùng `YYYY-MM-DD`.
- Số điện thoại nhận vào ở nhiều dạng (QT-02), lưu và trả về dạng 10 chữ số. Với vai trò Tiếp nhận, mọi số điện thoại trả về đều ở dạng che (`090****567`); chỉ vai trò Quản lý nhận số đầy đủ (NFR2, QT-15).
- Phiếu bảo hành chỉ trả theo trung tâm của người gọi (QT-14): endpoint 8 luôn lọc theo trung tâm trong JWT, không nhận trung tâm từ tham số. Khách hàng và thiết bị là dữ liệu dùng chung toàn công ty (khách đến trung tâm nào cũng được tiếp nhận), nên không lọc theo trung tâm.
- `403` chỉ dùng khi vai trò của người gọi không được phép gọi endpoint đó (cột "Vai trò gọi được" ở mục 1).
- Phân trang: `page` (bắt đầu từ 1) và `size` (mặc định 20, tối đa 100). Response kèm `total`.
- Mọi lỗi trả về cùng một cấu trúc: `{ "error": { "code": "...", "message": "...", "fields": {...} } }`.
- Mã lỗi dùng chung: `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT`, `422 BUSINESS_RULE_VIOLATION`.

### 3. Chi tiết endpoint của các User Story MUST

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

#### 3.3. `POST /api/tickets` · Lập phiếu bảo hành · US5, US6

Header bổ sung: `Idempotency-Key: <uuid>`. Cùng một khóa gửi lại sau khi mất kết nối (ngoại lệ 9c, NFR4) trả về phiếu đã lập, không lập phiếu trùng.

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

#### 3.4. `GET /api/devices/{id}/warranty` · Xác định tình trạng bảo hành · US4

Tính theo QT-05 tại thời điểm gọi: còn bảo hành nếu (ngày hiện tại − `purchase_date`) ≤ `warranty_months`; thiếu `purchase_date` thì chưa xác minh bảo hành.

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

#### 3.5. `POST /api/auth/login` · Đăng nhập · hạ tầng (W13)

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
    "center_id": 2
}
```

**Response 400 Bad Request:** thiếu `username` hoặc `password`. **Response 401 Unauthorized:** sai tên đăng nhập hoặc mật khẩu (`{ "error": { "code": "UNAUTHENTICATED", "message": "Sai tên đăng nhập hoặc mật khẩu" } }`; không nói rõ sai phần nào).

### 4. Mã trạng thái của toàn bộ endpoint

| #   | Thành công                   | Lỗi (ít nhất hai)                                                                                                                                                              |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 200                          | 400 số không hợp lệ · 404 không tìm thấy khách · 401                                                                                                                           |
| 2   | 200                          | 404 khách không tồn tại · 401                                                                                                                                                  |
| 3   | 201                          | 400 thiếu hoặc sai trường · 409 số điện thoại đã tồn tại (QT-01, kèm `customer_id` của hồ sơ có sẵn) · 403 không phải vai trò Tiếp nhận                                        |
| 4   | 201                          | 400 thiếu serial hoặc tên máy, ngày mua ở tương lai, số tháng ngoài 1–60 · 409 serial đã thuộc khách khác (QT-03) · 404 khách không tồn tại · 403 không phải vai trò Tiếp nhận |
| 5   | 200                          | 404 thiết bị không tồn tại · 401                                                                                                                                               |
| 6   | 200                          | 401 chưa đăng nhập · 500 lỗi hệ thống (thông báo chung, không lộ chi tiết)                                                                                                     |
| 7   | 201 (gửi lại cùng khóa: 200) | 400 · 404 · 422 thiết bị không thuộc khách (QT-03) · 403 không phải vai trò Tiếp nhận · 401                                                                                    |
| 8   | 200                          | 400 `size` vượt 100 hoặc `page` < 1 · 401                                                                                                                                      |
| 9   | 200                          | 400 thiếu trường · 401 sai tên đăng nhập hoặc mật khẩu                                                                                                                         |

### 5. Bảng validation

**`POST /api/customers`**

| Trường    | Bắt buộc | Kiểu / ràng buộc                                                | Thông báo lỗi khi vi phạm               |
| --------- | -------- | --------------------------------------------------------------- | --------------------------------------- |
| full_name | Có       | Chuỗi, 1–120 ký tự, bỏ khoảng trắng đầu cuối                    | Họ tên phải có từ 1 đến 120 ký tự       |
| phone     | Có       | Chuẩn hóa về 10 chữ số bắt đầu bằng 0 (QT-02); duy nhất (QT-01) | Số điện thoại không hợp lệ / đã tồn tại |
| email     | Không    | Địa chỉ thư điện tử hợp lệ, tối đa 120 ký tự                    | Email không hợp lệ                      |
| address   | Không    | Chuỗi, tối đa 255 ký tự                                         | Địa chỉ tối đa 255 ký tự                |

**`POST /api/customers/{id}/devices`**

| Trường          | Bắt buộc | Kiểu / ràng buộc                                      | Thông báo lỗi khi vi phạm                |
| --------------- | -------- | ----------------------------------------------------- | ---------------------------------------- |
| product_id      | Có       | Số nguyên dương, phải tồn tại trong danh mục sản phẩm | Sản phẩm không hợp lệ                    |
| serial_no       | Có       | Chuỗi 1–50 ký tự; duy nhất toàn hệ thống (QT-03)      | Serial/IMEI bắt buộc và không được trùng |
| purchase_date   | Không    | Ngày `YYYY-MM-DD`, không ở tương lai                  | Ngày mua không hợp lệ                    |
| warranty_months | Không    | Số nguyên 1–60, mặc định 12                           | Số tháng bảo hành không hợp lệ           |

**`POST /api/tickets`**

| Trường      | Bắt buộc | Kiểu / ràng buộc                                                                                      | Thông báo lỗi khi vi phạm              |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| customer_id | Có       | Số nguyên dương, phải tồn tại trong bảng customer                                                     | Không tìm thấy khách hàng              |
| device_id   | Có       | Số nguyên dương, phải thuộc về `customer_id` (QT-03)                                                  | Thiết bị không thuộc khách hàng này    |
| issue_desc  | Có       | Chuỗi, độ dài 10–2000 ký tự                                                                           | Mô tả lỗi phải có từ 10 đến 2000 ký tự |
| category_id | Không    | Số nguyên dương, phải tồn tại và đang sử dụng; để trống nghĩa là chưa phân loại                       | Nhóm sự cố không hợp lệ                |
| priority    | Không    | Một trong CAO / TRUNG_BINH / THAP; mặc định theo nhóm, Trung bình nếu chưa có nhóm                    | Mức ưu tiên không hợp lệ               |
| (hệ thống)  | —        | `center_id` lấy từ JWT của nhân viên, không nhận từ body; `Idempotency-Key` là UUID bắt buộc ở header | Thiếu khóa chống trùng                 |

### 6. Tự kiểm hợp đồng API

- Mỗi endpoint nghiệp vụ nối được về ít nhất một User Story (cột "User Story" ở mục 1); endpoint 9 là hạ tầng đăng nhập, phục vụ QT-14 và NFR2 cho mọi User Story.
- Mỗi endpoint có ít nhất một response thành công và hai response lỗi (mục 4).
- Mọi endpoint của User Story MUST (US1, US4, US5) có chi tiết request/response ở mục 3.
- Các quy tắc QT-01, QT-02, QT-03, QT-04, QT-05, QT-14, QT-15 đã xuất hiện trong bảng validation, mã lỗi hoặc quy ước chung.
- Tên trường đã đối chiếu với ERD (`erd.drawio`, `schema.sql`), kể cả `warranty_status`.
