# RESTful API Technical Documentation — Mekong Mobile Smart CRM (Flow L2)

**Track:** Software Engineering (SE)  
**Flow:** L2 – Warranty Intake and Classification  
**Target System:** Mekong Mobile Smart CRM  
**Author:** Vo Pham Viet Phu (Student ID: `2374802010391`)  
**Specification Version:** `1.0.0` (Assignment 3 — Buoi 15/16)  
**Base URL:** `http://localhost:3000/api` (or internal network service `http://app:3000/api`)  

---

## 1. Architectural Conventions & Common Specifications

### 1.1. Data Formats & Protocols
- **Protocol:** HTTP/1.1 over TCP / TLS (HTTPS in production environments).
- **Encoding & Media Type:** UTF-8 encoded JSON (`Content-Type: application/json`).
- **Date & Time Standards:** ISO 8601 strings with explicit timezones (e.g. `2026-11-11T14:30:00+07:00`). Vietnam standard time (UTC+7) is strictly enforced for business rules (business hours, SLA deadlines, warranty expiry).
- **Field Naming:** Consistent `snake_case` field names matching physical database schema columns.

### 1.2. Authentication & Session Security
- Authentication is token-based using HMAC-SHA256 signed JSON Web Tokens (JWT).
- Tokens are delivered and maintained via browser-managed HTTP cookies with `HttpOnly: true` and `SameSite: Strict` flags to prevent Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF).
- Supported Roles:
  - `TIEP_NHAN` (Intake Staff): Customer lookup, customer creation, device registration, ticket issuance and ticket editing while still in status `MOI`. Customer phone numbers are masked (`090****567`).
  - `QUAN_LY_TRUNG_TAM` (Centre Manager): Unmasked customer phone access, ticket cancellation, warranty eligibility determination, and master catalog administration.

### 1.3. Multi-Tenant Service Centre Isolation (Rule QT-14)
All warranty tickets are strictly scoped to the `center_id` embedded within the caller's verified JWT token:
- Intake staff and managers can only view or modify tickets belonging to their own assigned service centre.
- Requests attempting to read or alter tickets from another service centre immediately return HTTP `404 NOT_FOUND` to prevent cross-centre ticket enumeration.
- Customers, devices, and product catalogs are global enterprise data accessible across all centres.

### 1.4. Standard Error Response Envelope
All error responses adhere to a unified JSON schema containing a unique tracing request identifier:
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Dữ liệu yêu cầu không hợp lệ.",
    "fields": {
      "issue_desc": "Mô tả sự cố phải có ít nhất 10 ký tự."
    },
    "details": {}
  }
}
```
Every response header carries `X-Request-Id: <UUID>` correlating with backend structured logs.

---

## 2. API Endpoints Specification

---

### Endpoint 1: GET /api/customers?phone={phone}
**1. Method & Path:** `GET /api/customers?phone={phone}`  
**2. Description:** Looks up existing customer profile by standardized Vietnamese phone number.  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Query Parameter: `phone` (string, required): Phone number in various input formats (`0901234567`, `+84901234567`, `090.123.4567`). Normalized to 10 digits before lookup.
- Request Body: None.
- Real Request Example: `GET /api/customers?phone=0901234567`  
**5. Success Response (200 OK):**
```json
{
  "customer_id": 100001,
  "full_name": "Nguyễn Văn An",
  "phone": "090****567",
  "email": "an.nguyen@example.com",
  "address": "123 Cách Mạng Tháng 8, P. 7, Q. 10, TP. HCM",
  "created_at": "2026-03-01T08:00:00+07:00"
}
```
*(Note: Full phone `0901234567` returned for `QUAN_LY_TRUNG_TAM` role).*  
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Phone parameter missing or contains invalid characters. |
| `401` | `UNAUTHENTICATED` | Missing, expired, or invalid session cookie. |
| `404` | `NOT_FOUND` | No customer profile matches the normalized phone. |
**7. Limits & Special Behaviour:**
Normalizes input through `normalizePhone` (QT-02). Intake officers always receive masked phone representation (`090****567`) per Rule QT-15 and NFR2.

---

### Endpoint 2: GET /api/customers/{id}/devices
**1. Method & Path:** `GET /api/customers/{id}/devices`  
**2. Description:** Retrieves all registered electronic devices owned by a given customer.  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Path Parameter: `id` (integer, required): Customer ID.
- Request Body: None.  
**5. Success Response (200 OK):**
```json
[
  {
    "device_id": 1,
    "product_id": 1,
    "product_name": "iPhone 15 Pro Max 256GB",
    "serial_no": "SN973444858557",
    "purchase_date": "2026-03-05",
    "warranty_months": 12,
    "warranty_expires_on": "2027-03-05",
    "warranty_status": "CON_BAO_HANH"
  },
  {
    "device_id": 2,
    "product_id": 4,
    "product_name": "MacBook Air M2 16GB 256GB",
    "serial_no": "SN973444858558",
    "purchase_date": null,
    "warranty_months": 12,
    "warranty_expires_on": null,
    "warranty_status": "CHUA_XAC_MINH"
  }
]
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Customer ID is not a positive integer. |
| `401` | `UNAUTHENTICATED` | Session missing or expired. |
| `404` | `NOT_FOUND` | Customer profile does not exist. |
**7. Limits & Special Behaviour:**
Automatically dynamically evaluates warranty status for every device at query time using Rule QT-05. Returns empty array `[]` if customer has no registered devices.

---

### Endpoint 3: POST /api/customers
**1. Method & Path:** `POST /api/customers`  
**2. Description:** Registers a new customer profile into the central CRM database.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `TIEP_NHAN`.  
**4. Parameters & Body:**
- Request Body Schema:
  - `full_name` (string, required): 2–100 characters.
  - `phone` (string, required): Standard Vietnamese phone format.
  - `email` (string, optional): Valid email syntax.
  - `address` (string, optional): Maximum 255 characters.
- Real Request Body Example:
```json
{
  "full_name": "Trần Thị Mai",
  "phone": "0987654321",
  "email": "mai.tran@gmail.com",
  "address": "456 Lê Duẩn, P. Bến Nghé, Quận 1, TP. HCM"
}
```
**5. Success Response (201 Created):**
```json
{
  "customer_id": 100032,
  "full_name": "Trần Thị Mai",
  "phone": "098****321",
  "email": "mai.tran@gmail.com",
  "address": "456 Lê Duẩn, P. Bến Nghé, Quận 1, TP. HCM",
  "created_at": "2026-11-12T10:15:00+07:00"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Missing name or invalid phone number syntax. |
| `401` | `UNAUTHENTICATED` | Unauthenticated request. |
| `403` | `FORBIDDEN` | Caller is not an Intake Officer (`TIEP_NHAN`). |
| `409` | `CONFLICT` | Phone number already registered to another customer. |
**7. Limits & Special Behaviour:**
Normalizes whitespace in names. Phone uniqueness is enforced via unique index `idx_customer_phone_unique`. Conflict response returns existing customer ID in `details.existing_customer_id`.

---

### Endpoint 4: POST /api/customers/{id}/devices
**1. Method & Path:** `POST /api/customers/{id}/devices`  
**2. Description:** Registers a newly presented device under an existing customer profile.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `TIEP_NHAN`.  
**4. Parameters & Body:**
- Path Parameter: `id` (integer, required): Customer ID.
- Request Body Schema:
  - `product_id` (integer, required): Catalog product model ID.
  - `serial_no` (string, required): 6–30 alphanumeric characters.
  - `purchase_date` (string, optional): Format `YYYY-MM-DD`, cannot be in the future.
- Real Request Body Example:
```json
{
  "product_id": 1,
  "serial_no": "SN973444859999",
  "purchase_date": "2026-05-10"
}
```
**5. Success Response (201 Created):**
```json
{
  "device_id": 39,
  "customer_id": 100001,
  "product_id": 1,
  "product_name": "iPhone 15 Pro Max 256GB",
  "serial_no": "SN973444859999",
  "purchase_date": "2026-05-10",
  "warranty_months": 12,
  "warranty_expires_on": "2027-05-10",
  "warranty_status": "CON_BAO_HANH"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Serial format invalid or purchase date in future. |
| `404` | `NOT_FOUND` | Customer or product model not found. |
| `409` | `CONFLICT` | Serial number already registered in the system. |
| `422` | `BUSINESS_RULE_VIOLATION` | Selected product model has been discontinued (`is_active = false`). |
**7. Limits & Special Behaviour:**
Serial numbers are uppercased and trimmed. Enforces serial uniqueness globally.

---

### Endpoint 5: GET /api/devices/{id}/warranty
**1. Method & Path:** `GET /api/devices/{id}/warranty?at={timestamp}`  
**2. Description:** Accurately evaluates device warranty status (Under Warranty, Expired, Unverified).  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Path Parameter: `id` (integer, required): Device ID.
- Query Parameter: `at` (string, optional): ISO timestamp evaluation point (defaults to current server time).
- Request Body: None.  
**5. Success Response (200 OK):**
```json
{
  "device_id": 1,
  "serial_no": "SN973444858557",
  "purchase_date": "2026-03-05",
  "warranty_months": 12,
  "warranty_expires_on": "2027-03-05",
  "evaluation_time": "2026-11-12T14:00:00+07:00",
  "warranty_status": "CON_BAO_HANH"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Invalid device ID or invalid timestamp format. |
| `404` | `NOT_FOUND` | Device ID not found. |
**7. Limits & Special Behaviour:**
Boundary enforcement (Rule QT-05, TC-03 & TC-04): At `23:59:59` on the expiry date, status remains `CON_BAO_HANH`. At `00:00:00` on the following day, status strictly transitions to `HET_BAO_HANH`. Devices lacking purchase dates return `CHUA_XAC_MINH`.

---

### Endpoint 6: GET /api/issue-categories
**1. Method & Path:** `GET /api/issue-categories?include_inactive={boolean}`  
**2. Description:** Retrieves standardized catalog of device issue categories with default priority tiers.  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Query Parameter: `include_inactive` (boolean, optional, default false). Only Centre Managers may view inactive categories.  
**5. Success Response (200 OK):**
```json
[
  {"category_id": 1, "category_name": "Màn hình", "code": "MAN_HINH", "default_priority": "CAO", "is_active": true},
  {"category_id": 2, "category_name": "Pin", "code": "PIN", "default_priority": "TRUNG_BINH", "is_active": true},
  {"category_id": 3, "category_name": "Sạc", "code": "SAC", "default_priority": "THAP", "is_active": true},
  {"category_id": 4, "category_name": "Phần mềm", "code": "PHAN_MEM", "default_priority": "THAP", "is_active": true},
  {"category_id": 5, "category_name": "Nước vào", "code": "NUOC_VAO", "default_priority": "KHAN_CAP", "is_active": true},
  {"category_id": 6, "category_name": "Khác", "code": "KHAC", "default_priority": "TRUNG_BINH", "is_active": true}
]
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `401` | `UNAUTHENTICATED` | Session missing or expired. |
**7. Limits & Special Behaviour:**
Results are cached in memory for high-performance dropdown population in intake UI.

---

### Endpoint 7: POST /api/tickets
**1. Method & Path:** `POST /api/tickets`  
**2. Description:** Creates a new warranty service ticket, generates sequential ticket code, calculates SLA deadline, and records initial status log atomically.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `TIEP_NHAN`.  
**4. Parameters & Body:**
- Header: `Idempotency-Key` (string, optional UUID): Idempotency key preventing duplicate ticket issuance.
- Request Body Schema:
  - `customer_id` (integer, required): Customer ID.
  - `device_id` (integer, required): Registered device ID.
  - `category_id` (integer, required): Selected issue category ID.
  - `priority` (string, required): `KHAN_CAP`, `CAO`, `TRUNG_BINH`, `THAP`.
  - `issue_desc` (string, required): 10–1000 characters.
  - `received_at` (string, optional): ISO timestamp (defaults to current time).
- Real Request Body Example:
```json
{
  "customer_id": 100001,
  "device_id": 1,
  "category_id": 1,
  "priority": "CAO",
  "issue_desc": "Màn hình xuất hiện sọc xanh dọc sau khi rơi nhẹ",
  "received_at": "2026-11-12T14:40:00+07:00"
}
```
**5. Success Response (201 Created):**
```json
{
  "ticket_id": 31,
  "ticket_code": "BH000031/2026",
  "center_id": 1,
  "customer_id": 100001,
  "device_id": 1,
  "category_id": 1,
  "priority": "CAO",
  "status": "MOI",
  "warranty_status": "CON_BAO_HANH",
  "received_at": "2026-11-12T14:40:00+07:00",
  "due_date": "2026-11-13T14:40:00+07:00",
  "issue_desc": "Màn hình xuất hiện sọc xanh dọc sau khi rơi nhẹ"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Issue description shorter than 10 characters or invalid priority enum. |
| `403` | `FORBIDDEN` | Caller is not an Intake Officer (`TIEP_NHAN`). |
| `404` | `NOT_FOUND` | Customer, device, or category not found. |
| `409` | `CONFLICT` | Device currently has an unresolved ticket in progress. |
| `422` | `BUSINESS_RULE_VIOLATION` | Device does not belong to specified customer (Rule QT-03). |
**7. Limits & Special Behaviour:**
- Sunday exclusion in SLA computation (Rule QT-04, TC-01): Tickets received Saturday morning roll past Sunday into Monday.
- Idempotency (NFR4, TC-11): Repeating request with identical `Idempotency-Key` returns the previously created ticket with HTTP `200 OK`.

---

### Endpoint 8: GET /api/tickets
**1. Method & Path:** `GET /api/tickets?page={page}&size={size}&status={status}&priority={priority}&overdue={boolean}`  
**2. Description:** Retrieves paginated warranty tickets belonging strictly to caller's service centre.  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Query Parameters: `page` (default 1), `size` (default 20, max 100), `status`, `priority`, `overdue`.
- Request Body: None.  
**5. Success Response (200 OK):**
```json
{
  "items": [
    {
      "ticket_id": 31,
      "ticket_code": "BH000031/2026",
      "customer_id": 100001,
      "customer_name": "Nguyễn Văn An",
      "customer_phone": "090****567",
      "product_name": "iPhone 15 Pro Max 256GB",
      "category_name": "Màn hình",
      "priority": "CAO",
      "status": "MOI",
      "warranty_status": "CON_BAO_HANH",
      "received_at": "2026-11-12T14:40:00+07:00",
      "due_date": "2026-11-13T14:40:00+07:00",
      "is_overdue": false
    }
  ],
  "total": 31,
  "page": 1,
  "size": 20,
  "total_pages": 2
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | `page` < 1 or `size` > 100. |
| `401` | `UNAUTHENTICATED` | Session missing or expired. |
**7. Limits & Special Behaviour:**
- Centre Scoping (QT-14): Scoped to JWT `center_id`.
- Phone Masking (QT-15, NFR2): Masked for Intake staff (`090****567`); full phone visible to Manager.
- Overdue evaluation: `is_overdue = true` when current time exceeds `due_date` and status is not `HOAN_TAT`, `DA_DONG`, or `DA_HUY`.

---

### Endpoint 9: POST /api/auth/login
**1. Method & Path:** `POST /api/auth/login`  
**2. Description:** Authenticates staff user with username and password; sets secure JWT cookie.  
**3. Authentication & Permission:** Public endpoint (no token required).  
**4. Parameters & Body:**
- Request Body Schema: `username` (string, required), `password` (string, required).
- Real Request Body Example:
```json
{
  "username": "lan.q10",
  "password": "Demo@2026"
}
```
**5. Success Response (200 OK):**
Set-Cookie Header: `token=<JWT>; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800`
```json
{
  "user_id": 1,
  "username": "lan.q10",
  "full_name": "Nguyễn Thị Lan",
  "role": "TIEP_NHAN",
  "center_id": 1,
  "center_name": "TTBH Quận 10"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Missing username or password. |
| `401` | `INVALID_CREDENTIALS` | Incorrect username or wrong password. |
| `403` | `ACCOUNT_INACTIVE` | Staff account has been deactivated. |
**7. Limits & Special Behaviour:**
Password validated via `bcrypt.compare`. Does not disclose whether username or password was incorrect.

---

### Endpoint 10: POST /api/auth/logout
**1. Method & Path:** `POST /api/auth/logout`  
**2. Description:** Logs out user and clears the JWT authentication cookie.  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: All authenticated users.  
**4. Parameters & Body:** None.  
**5. Success Response (204 No Content):**
Set-Cookie Header: `token=; Path=/api; Expires=Thu, 01 Jan 1970 00:00:00 GMT`  
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `401` | `UNAUTHENTICATED` | Caller is not currently logged in. |
**7. Limits & Special Behaviour:**
Immediately invalidates cookie at the browser client level.

---

### Endpoint 11: GET /api/products
**1. Method & Path:** `GET /api/products?include_inactive={boolean}`  
**2. Description:** Returns device product models catalog for device registration dropdowns.  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:** Query param `include_inactive` (boolean, default false).  
**5. Success Response (200 OK):**
```json
[
  {"product_id": 1, "product_name": "iPhone 15 Pro Max 256GB", "category": "Dien thoai", "warranty_months": 12, "is_active": true},
  {"product_id": 2, "product_name": "Samsung Galaxy S24 Ultra", "category": "Dien thoai", "warranty_months": 12, "is_active": true}
]
```
**6. Error Codes Table:** `401 UNAUTHENTICATED`.  
**7. Limits & Special Behaviour:** Inactive models hidden from Intake officers.

---

### Endpoint 12: POST /api/products
**1. Method & Path:** `POST /api/products`  
**2. Description:** Adds a new product model to the catalog.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
```json
{
  "product_name": "iPad Air M2 11-inch",
  "category": "May tinh bang",
  "warranty_months": 12
}
```
**5. Success Response (201 Created):**
```json
{
  "product_id": 28,
  "product_name": "iPad Air M2 11-inch",
  "category": "May tinh bang",
  "warranty_months": 12,
  "is_active": true
}
```
**6. Error Codes Table:** `400 VALIDATION_FAILED`, `403 FORBIDDEN` (Intake role), `409 CONFLICT` (Duplicate product name).  
**7. Limits & Special Behaviour:** Product name uniqueness enforced.

---

### Endpoint 13: PUT /api/products/{id}
**1. Method & Path:** `PUT /api/products/{id}`  
**2. Description:** Updates catalog product name or default warranty months.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:** Path param `id`. Body: `{"product_name":"iPad Air M2 11-inch (2026)","warranty_months":24,"is_active":true}`.  
**5. Success Response (200 OK):** Updated product object.  
**6. Error Codes Table:** `400 VALIDATION_FAILED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT`.  
**7. Limits & Special Behaviour:** Can reactivate previously discontinued product models.

---

### Endpoint 14: DELETE /api/products/{id}
**1. Method & Path:** `DELETE /api/products/{id}`  
**2. Description:** Soft-deletes a product model by setting `is_active = false`.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:** Path param `id`.  
**5. Success Response (200 OK):** `{"message":"Ngừng sử dụng sản phẩm thành công","product_id":28,"is_active":false}`.  
**6. Error Codes Table:** `403 FORBIDDEN`, `404 NOT_FOUND`.  
**7. Limits & Special Behaviour:** Physical row is never deleted (Rule QT-13). Historical devices keep reference integrity.

---

### Endpoint 15: POST /api/issue-categories
**1. Method & Path:** `POST /api/issue-categories`  
**2. Description:** Adds a new standardized issue category.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:** `{"category_name":"Hư Camera","code":"CAMERA","default_priority":"CAO"}`.  
**5. Success Response (201 Created):** New category object.  
**6. Error Codes Table:** `400 VALIDATION_FAILED`, `403 FORBIDDEN`, `409 CONFLICT`.  
**7. Limits & Special Behaviour:** Enforces unique category code.

---

### Endpoint 16: PUT /api/issue-categories/{id}
**1. Method & Path:** `PUT /api/issue-categories/{id}`  
**2. Description:** Modifies issue category name or default priority tier.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:** `{"category_name":"Hư Camera & Cảm biến","default_priority":"KHAN_CAP","is_active":true}`.  
**5. Success Response (200 OK):** Updated category object.  
**6. Error Codes Table:** `400 VALIDATION_FAILED`, `403 FORBIDDEN`, `404 NOT_FOUND`.  
**7. Limits & Special Behaviour:** Updates affect newly created tickets only; existing tickets retain historical priority.

---

### Endpoint 17: DELETE /api/issue-categories/{id}
**1. Method & Path:** `DELETE /api/issue-categories/{id}`  
**2. Description:** Soft-deletes an issue category (`is_active = false`).  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:** Path param `id`.  
**5. Success Response (200 OK):** `{"message":"Ngừng sử dụng nhóm sự cố thành công","category_id":7,"is_active":false}`.  
**6. Error Codes Table:** `403 FORBIDDEN`, `404 NOT_FOUND`.  
**7. Limits & Special Behaviour:** Never physically deleted (Rule QT-13).

---

### Endpoint 18: GET /api/tickets/{id}
**1. Method & Path:** `GET /api/tickets/{id}`  
**2. Description:** Retrieves detailed ticket record, status logs, edit logs, and contextual action permissions (`can_edit`, `can_cancel`, `can_decide_warranty`).  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:** Path param `id` (integer).  
**5. Success Response (200 OK):**
```json
{
  "ticket_id": 31,
  "ticket_code": "BH000031/2026",
  "center_id": 1,
  "customer": {"customer_id": 100001, "full_name": "Nguyễn Văn An", "phone": "090****567"},
  "device": {"device_id": 1, "product_name": "iPhone 15 Pro Max 256GB", "serial_no": "SN973444858557"},
  "priority": "CAO",
  "status": "MOI",
  "warranty_status": "CON_BAO_HANH",
  "received_at": "2026-11-12T14:40:00+07:00",
  "due_date": "2026-11-13T14:40:00+07:00",
  "can_edit": true,
  "can_cancel": false,
  "can_decide_warranty": false,
  "status_history": [
    {"from_status": null, "to_status": "MOI", "changed_at": "2026-11-12T14:40:00+07:00", "note": "Tiếp nhận lập phiếu"}
  ],
  "edit_history": []
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `401` | `UNAUTHENTICATED` | Session missing or expired. |
| `404` | `NOT_FOUND` | Ticket does not exist or belongs to another service centre (QT-14). |
**7. Limits & Special Behaviour:**
Masks customer phone for Intake staff. Enforces centre isolation. Computes action flags based on caller role and ticket lifecycle state.

---

### Endpoint 19: PATCH /api/tickets/{id}
**1. Method & Path:** `PATCH /api/tickets/{id}`  
**2. Description:** Corrects intake mistakes on a ticket while still in status `MOI`; writes audit record to `ticket_edit_log`.  
**3. Authentication & Permission:** JWT Cookie required. Allowed roles: `TIEP_NHAN`, `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Path Parameter: `id` (integer).
- Request Body Schema:
  - `priority` (string, optional)
  - `category_id` (integer, optional)
  - `device_id` (integer, optional, must belong to same customer)
  - `issue_desc` (string, optional)
  - `reason` (string, required): 5–255 characters explaining the correction.
- Real Request Body Example:
```json
{
  "priority": "KHAN_CAP",
  "reason": "Khách hàng yêu cầu xử lý khẩn cấp do cần máy đi công tác"
}
```
**5. Success Response (200 OK):**
```json
{
  "ticket_id": 31,
  "ticket_code": "BH000031/2026",
  "priority": "KHAN_CAP",
  "due_date": "2026-11-13T02:40:00+07:00",
  "message": "Cập nhật phiếu bảo hành thành công"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Reason is missing or shorter than 5 characters. |
| `404` | `NOT_FOUND` | Ticket missing or belongs to another service centre (QT-14). |
| `422` | `BUSINESS_RULE_VIOLATION` | Ticket has progressed beyond `MOI`, or no fields changed. |
**7. Limits & Special Behaviour:**
Concurrency control via `SELECT ... FOR UPDATE` row locking. Modifying priority recalculates due date from the original `received_at` timestamp (Rule QT-04, TĐ-02).

---

### Endpoint 20: POST /api/tickets/{id}/cancel
**1. Method & Path:** `POST /api/tickets/{id}/cancel`  
**2. Description:** Cancels a warranty ticket and appends a cancellation entry into `ticket_status_log`.  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Path Parameter: `id` (integer).
- Request Body Schema: `reason` (string, required): 5–255 characters.
- Real Request Body Example:
```json
{
  "reason": "Khách hàng đổi ý muốn tự sửa chữa bên ngoài"
}
```
**5. Success Response (200 OK):**
```json
{
  "ticket_id": 31,
  "ticket_code": "BH000031/2026",
  "status": "DA_HUY",
  "message": "Hủy phiếu bảo hành thành công"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Reason missing or under 5 characters. |
| `403` | `FORBIDDEN` | Caller is not a Centre Manager. |
| `404` | `NOT_FOUND` | Ticket does not exist or belongs to another centre (QT-14). |
| `422` | `BUSINESS_RULE_VIOLATION` | Ticket is already closed or completed. |
**7. Limits & Special Behaviour:**
Once cancelled, ticket cannot be reopened or edited. Excluded from SLA overdue warnings.

---

### Endpoint 21: POST /api/tickets/{id}/warranty-decision
**1. Method & Path:** `POST /api/tickets/{id}/warranty-decision`  
**2. Description:** Centre Manager formally approves warranty status for unverified tickets (`CHUA_XAC_MINH`).  
**3. Authentication & Permission:** JWT Cookie required. Allowed role: `QUAN_LY_TRUNG_TAM`.  
**4. Parameters & Body:**
- Path Parameter: `id` (integer).
- Request Body Schema:
  - `decision` (string, required): `CON_BAO_HANH` or `HET_BAO_HANH`.
  - `reason` (string, required): 5–255 characters.
- Real Request Body Example:
```json
{
  "decision": "CON_BAO_HANH",
  "reason": "Khách xuất trình hóa đơn VAT hợp lệ mua tại đại lý ủy quyền"
}
```
**5. Success Response (200 OK):**
```json
{
  "ticket_id": 31,
  "ticket_code": "BH000031/2026",
  "warranty_status": "CON_BAO_HANH",
  "message": "Phê duyệt quyết định bảo hành thành công"
}
```
**6. Error Codes Table:**
| HTTP Code | Error Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `VALIDATION_FAILED` | Decision enum invalid or reason missing. |
| `403` | `FORBIDDEN` | Caller is not a Centre Manager. |
| `404` | `NOT_FOUND` | Ticket missing or belongs to another centre. |
| `422` | `BUSINESS_RULE_VIOLATION` | Ticket warranty status is already verified. |
**7. Limits & Special Behaviour:**
Can only be executed once per ticket. Decision and audit reasoning are logged permanently in `ticket_edit_log`.

