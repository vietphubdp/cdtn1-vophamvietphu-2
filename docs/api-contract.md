## Mẫu đặc tả riêng của track SE: Hợp đồng API

### 1. Danh sách endpoint

| #  | Phương thức | Đường dẫn                                | Mục đích                                                    | User Story    | Vai trò gọi được            |
| -- | ----------- | ---------------------------------------- | ----------------------------------------------------------- | ------------- | --------------------------- |
| 1  | GET         | `/api/customers?phone={phone}`           | Tra cứu khách theo số điện thoại (đã chuẩn hóa)             | US1           | Tiếp nhận, Quản lý          |
| 2  | GET         | `/api/customers/{id}/devices`            | Lấy danh sách thiết bị của khách                            | US1           | Tiếp nhận, Quản lý          |
| 3  | POST        | `/api/customers`                         | Tạo khách hàng mới khi chưa tồn tại                         | US2           | Tiếp nhận                   |
| 4  | POST        | `/api/customers/{id}/devices`            | Ghi nhận thiết bị mới cho khách                             | US3           | Tiếp nhận                   |
| 5  | GET         | `/api/devices/{id}/warranty`             | Xác định tình trạng bảo hành của thiết bị                   | US4           | Tiếp nhận, Quản lý          |
| 6  | GET         | `/api/issue-categories`                  | Lấy danh mục nhóm sự cố kèm mức ưu tiên mặc định            | US6           | Tiếp nhận, Quản lý          |
| 7  | POST        | `/api/tickets`                           | Lập phiếu bảo hành mới                                      | US5, US6      | Tiếp nhận                   |
| 8  | GET         | `/api/tickets?page=&size=`               | Danh sách phiếu của trung tâm, sắp theo hạn cam kết         | US7           | Tiếp nhận, Quản lý          |

### 2. Quy ước chung

- Định dạng trao đổi: JSON, mã hóa UTF-8. Header bắt buộc: `Content-Type: application/json`.
- Xác thực: mọi endpoint yêu cầu header `Authorization: Bearer <token>`; token xác định vai trò (Tiếp nhận hoặc Quản lý) và trung tâm của người dùng.
- Tên trường dùng snake_case, trùng tên cột trong cơ sở dữ liệu (ERD) để dễ truy vết.
- Thời gian dùng chuẩn ISO 8601 kèm múi giờ, ví dụ `2026-10-08T14:30:00+07:00`; ngày dùng `YYYY-MM-DD`.
- Số điện thoại nhận vào ở nhiều dạng (QT-02), lưu và trả về dạng 10 chữ số. Với vai trò Tiếp nhận, mọi số điện thoại trả về đều ở dạng che (`090****567`); chỉ vai trò Quản lý nhận số đầy đủ (NFR2, QT-15).
- Chỉ trả dữ liệu của trung tâm mà người gọi thuộc về (QT-14); truy cập dữ liệu trung tâm khác trả `403`.
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

**Response 404 Not Found:** khách không tồn tại. **Response 403 Forbidden:** khách thuộc dữ liệu của trung tâm khác (QT-14).

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
**Response 403 Forbidden:** khách hoặc thiết bị thuộc dữ liệu của trung tâm khác.

### 4. Mã trạng thái của toàn bộ endpoint

| #  | Thành công | Lỗi (ít nhất hai)                                                                                        |
| -- | ---------- | -------------------------------------------------------------------------------------------------------- |
| 1  | 200        | 400 số không hợp lệ · 404 không tìm thấy khách · 401                                                     |
| 2  | 200        | 404 khách không tồn tại · 403 khác trung tâm · 401                                                       |
| 3  | 201        | 400 thiếu hoặc sai trường · 409 số điện thoại đã tồn tại (QT-01, kèm `customer_id` của hồ sơ có sẵn)     |
| 4  | 201        | 400 thiếu serial hoặc tên máy · 409 serial đã thuộc khách khác (QT-03) · 404 khách không tồn tại         |
| 5  | 200        | 404 thiết bị không tồn tại · 403 khác trung tâm · 401                                                    |
| 6  | 200        | 401 chưa đăng nhập · 403 không có quyền                                                                  |
| 7  | 201 (gửi lại cùng khóa: 200) | 400 · 404 · 422 thiết bị không thuộc khách · 403                                       |
| 8  | 200        | 400 `size` vượt 100 · 401 · 403                                                                          |

### 5. Bảng validation

**`POST /api/customers`**

| Trường    | Bắt buộc | Kiểu / ràng buộc                                              | Thông báo lỗi khi vi phạm                       |
| --------- | -------- | ------------------------------------------------------------- | ----------------------------------------------- |
| full_name | Có       | Chuỗi, 1–120 ký tự, bỏ khoảng trắng đầu cuối                  | Họ tên phải có từ 1 đến 120 ký tự               |
| phone     | Có       | Chuẩn hóa về 10 chữ số bắt đầu bằng 0 (QT-02); duy nhất (QT-01) | Số điện thoại không hợp lệ / đã tồn tại         |
| email     | Không    | Địa chỉ thư điện tử hợp lệ, tối đa 120 ký tự                   | Email không hợp lệ                              |
| address   | Không    | Chuỗi, tối đa 255 ký tự                                       | Địa chỉ tối đa 255 ký tự                        |

**`POST /api/customers/{id}/devices`**

| Trường          | Bắt buộc | Kiểu / ràng buộc                                              | Thông báo lỗi khi vi phạm                  |
| --------------- | -------- | ------------------------------------------------------------- | ------------------------------------------ |
| product_id      | Có       | Số nguyên dương, phải tồn tại trong danh mục sản phẩm          | Sản phẩm không hợp lệ                      |
| serial_no       | Có       | Chuỗi 1–50 ký tự; duy nhất toàn hệ thống (QT-03)               | Serial/IMEI bắt buộc và không được trùng   |
| purchase_date   | Không    | Ngày `YYYY-MM-DD`, không ở tương lai                           | Ngày mua không hợp lệ                      |
| warranty_months | Không    | Số nguyên 1–60, mặc định 12                                    | Số tháng bảo hành không hợp lệ             |

**`POST /api/tickets`**

| Trường      | Bắt buộc | Kiểu / ràng buộc                                                                 | Thông báo lỗi khi vi phạm                      |
| ----------- | -------- | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| customer_id | Có       | Số nguyên dương, phải tồn tại trong bảng customer                                 | Không tìm thấy khách hàng                      |
| device_id   | Có       | Số nguyên dương, phải thuộc về `customer_id` (QT-03)                              | Thiết bị không thuộc khách hàng này            |
| issue_desc  | Có       | Chuỗi, độ dài 10–2000 ký tự                                                       | Mô tả lỗi phải có từ 10 đến 2000 ký tự         |
| category_id | Không    | Số nguyên dương, phải tồn tại và đang sử dụng; để trống nghĩa là chưa phân loại    | Nhóm sự cố không hợp lệ                        |
| priority    | Không    | Một trong CAO / TRUNG_BINH / THAP; mặc định theo nhóm, Trung bình nếu chưa có nhóm | Mức ưu tiên không hợp lệ                       |
| (hệ thống)  | —        | `center_id` lấy từ token của nhân viên, không nhận từ body; `Idempotency-Key` là UUID bắt buộc ở header | Thiếu khóa chống trùng |

### 6. Tự kiểm hợp đồng API

- Mỗi endpoint nối được về ít nhất một User Story (cột "User Story" ở C.1).
- Mỗi endpoint có ít nhất một response thành công và hai response lỗi (C.4).
- Các quy tắc QT-01, QT-02, QT-03, QT-04, QT-14, QT-15 đã xuất hiện trong bảng validation, mã lỗi hoặc quy ước chung.
- Tên trường đã đối chiếu với ERD (`erd.drawio`, `schema.sql`), kể cả `warranty_status`.
