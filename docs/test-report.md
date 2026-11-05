# Test Report – Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành (track SE)

**Sinh viên:** Võ Phạm Việt Phú · 2374802010391 · **Ngày chạy:** 05/11/2026 · Kế hoạch: [`test-plan.md`](test-plan.md)

**Cách chạy lại:** `npm run test:system` (cả 12 TC) hoặc `npm run test:system -- -t TC-05` (một TC). Mỗi lần chạy, CSDL thử `smart_crm_l2_systest` được xóa và dựng lại bằng migrate + seed, nên tiền điều kiện của mọi TC là dữ liệu seed. Mã nguồn các TC: [`tests/system/testCases.test.js`](../tests/system/testCases.test.js). Kết quả thực tế dưới đây chép từ chính output của lệnh (dòng "Kết quả thực tế" trong ảnh).

## Tổng hợp

| Chạy thật | PASS | FAIL | Đủ 5 loại |
| --------- | ---- | ---- | --------- |
| 12 / 12   | 12   | 0    | Có: luồng đúng ×2 · biên ×2 · dữ liệu sai ×4 · bảo mật/chất lượng dữ liệu ×3 · tái lập ×1 |

| Mã    | Loại          | Quy tắc                | Ưu tiên    | Kết quả | Ảnh |
| ----- | ------------- | ---------------------- | ---------- | ------- | --- |
| TC-01 | Luồng đúng    | QT-04, QT-06, US5-AC6  | Cao        | PASS | [TC-01](screenshots/TC-01.png) |
| TC-02 | Luồng đúng    | QT-05, QT-04           | Cao        | PASS | [TC-02](screenshots/TC-02.png) |
| TC-03 | Giá trị biên  | QT-05 (ngày cuối còn)  | Cao        | PASS | [TC-03](screenshots/TC-03.png) |
| TC-04 | Giá trị biên  | QT-05 (ngày đầu hết)   | Cao        | PASS | [TC-04](screenshots/TC-04.png) |
| TC-05 | Dữ liệu sai   | US5-AC2                | Trung bình | PASS | [TC-05](screenshots/TC-05.png) |
| TC-06 | Dữ liệu sai   | US2, QT-02             | Trung bình | PASS | [TC-06](screenshots/TC-06.png) |
| TC-07 | Dữ liệu sai   | QT-03, US5-AC3         | Cao        | PASS | [TC-07](screenshots/TC-07.png) |
| TC-08 | Dữ liệu sai   | QT-03                  | Cao        | PASS | [TC-08](screenshots/TC-08.png) |
| TC-09 | Bảo mật       | QT-14 (OWASP A01)      | Cao        | PASS | [TC-09](screenshots/TC-09.png) |
| TC-10 | Bảo mật       | QT-15, phân quyền      | Cao        | PASS | [TC-10](screenshots/TC-10.png) |
| TC-11 | Chất lượng dữ liệu | NFR4 (không lưu trùng) | Cao  | PASS | [TC-11](screenshots/TC-11.png) |
| TC-12 | Tái lập       | migrate + seed lần hai | Cao        | PASS | [TC-12](screenshots/TC-12.png) |

Ảnh chạy cả 12 TC một lần: [`19-test-system-12-pass.png`](screenshots/19-test-system-12-pass.png). Toàn bộ unit + HTTP test: [`20-npm-test-sau-sua-bug.png`](screenshots/20-npm-test-sau-sua-bug.png) (505/505 PASS).

**Mức ưu tiên:** Cao = quy tắc nghiệp vụ cốt lõi, bảo mật hoặc tái lập (sai thì sai dữ liệu / lộ dữ liệu); Trung bình = kiểm định dạng đầu vào (sai thì người dùng vẫn sửa lại được).

**Ghi chú trung thực:** cả 12 TC PASS ngay lần chạy đầu. Ba bug trong [`bug-log.md`](bug-log.md) được phát hiện trước đó (rà log, tích hợp CSDL, Docker – buổi 11), không phải từ 12 TC này; mỗi bug có test hồi quy riêng trong `npm test`.

---

## Chi tiết 12 test case

### TC-01 · Luồng đúng · QT-04, QT-06 – Cao lúc 10:00 thứ Bảy → hạn 10:00 thứ Hai

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-01 |
| 2. Tiền điều kiện | CSDL vừa seed: 30 phiếu, 30 dòng `ticket_status_log`. Khách 100001 (Nguyễn Văn An) có thiết bị 1 (mua 05/03/2026, BH 12 tháng). Đăng nhập `lan.q10` (Tiếp nhận, TT Quận 10). Đồng hồ: 10:00 thứ Bảy 07/11/2026 (+07:00) |
| 3. Các bước | 1. `POST /api/tickets` kèm `Idempotency-Key` mới · 2. Đếm bảng `ticket` và dòng lịch sử MOI của phiếu vừa lập |
| 4. Dữ liệu thử | `{ customer_id: 100001, device_id: 1, issue_desc: "Màn hình sọc xanh sau khi cập nhật phần mềm", category_id: 1, priority: "CAO" }` |
| 5. Kết quả mong đợi | 201; `ticket_code` dạng `BHxxxxxx/2026`; `status = MOI`; `warranty_status = CON_BAO_HANH`; `due_date = 2026-11-09T10:00:00+07:00` (24 giờ, bỏ qua Chủ nhật 08/11); bảng `ticket` +1; đúng 1 dòng lịch sử MOI |
| 6. Mức ưu tiên | Cao – quy tắc cốt lõi QT-04, QT-06 |
| 7. Kết quả thực tế | HTTP 201 · `ticket_code=BH000031/2026` · `status=MOI` · `warranty_status=CON_BAO_HANH` · `received_at=2026-11-07T10:00:00+07:00` · `due_date=2026-11-09T10:00:00+07:00` · bảng `ticket`: 30 → 31 · lịch sử MOI của phiếu: 1 dòng (tổng 30 → 31) |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-01.png](screenshots/TC-01.png) |

### TC-02 · Luồng đúng · QT-05, QT-04 – Thiết bị thiếu ngày mua → phiếu CHUA_XAC_MINH, Thấp 120 giờ

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-02 |
| 2. Tiền điều kiện | CSDL vừa seed. Thiết bị 2 của khách 100001 **không có ngày mua**. Đăng nhập `lan.q10`. Đồng hồ: 09:00 thứ Hai 02/11/2026 |
| 3. Các bước | 1. `POST /api/tickets` · 2. Đọc lại dòng phiếu trong bảng `ticket` |
| 4. Dữ liệu thử | `{ customer_id: 100001, device_id: 2, issue_desc: "Ứng dụng tự thoát liên tục khi mở camera", category_id: 4, priority: "THAP" }` |
| 5. Kết quả mong đợi | 201; `warranty_status = CHUA_XAC_MINH` cả trong response và trong CSDL; `due_date = 2026-11-07T09:00:00+07:00` (120 giờ = 5 ngày thứ Hai–thứ Bảy, không chạm Chủ nhật) |
| 6. Mức ưu tiên | Cao – nhánh "chưa xác minh" của QT-05 quyết định có tính phí hay không |
| 7. Kết quả thực tế | HTTP 201 · `ticket_code=BH000031/2026` (chạy riêng; khi chạy cả 12 TC là `BH000032/2026` vì TC-01 lập trước) · `warranty_status=CHUA_XAC_MINH` · `due_date=2026-11-07T09:00:00+07:00` · trong CSDL: `warranty_status=CHUA_XAC_MINH`, `status=MOI`, `due_date=2026-11-07T02:00:00.000Z` (= 09:00 +07:00) |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-02.png](screenshots/TC-02.png) |

### TC-03 · Giá trị biên · QT-05 – 23:59 đúng ngày hết hạn → vẫn còn bảo hành

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-03 |
| 2. Tiền điều kiện | Thiết bị 1 mua 05/03/2026, BH 12 tháng → ngày hết hạn tính tay 05/03/2027. Đăng nhập `lan.q10`. Đồng hồ: **23:59 ngày 05/03/2027** (+07:00) |
| 3. Các bước | 1. `GET /api/devices/1/warranty` |
| 4. Dữ liệu thử | `device_id = 1`, thời điểm `2027-03-05T23:59:00+07:00` |
| 5. Kết quả mong đợi | 200; `warranty_expires_on = 2027-03-05`; `warranty_status = CON_BAO_HANH` (quy tắc "ngày tiếp nhận ≤ ngày hết hạn") |
| 6. Mức ưu tiên | Cao – sai biên là tính phí nhầm khách còn bảo hành |
| 7. Kết quả thực tế | HTTP 200 · `purchase_date=2026-03-05` · `warranty_months=12` · `warranty_expires_on=2027-03-05` · `warranty_status=CON_BAO_HANH` |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-03.png](screenshots/TC-03.png) |

### TC-04 · Giá trị biên · QT-05 – 00:00 ngày đầu sau hạn → hết bảo hành

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-04 |
| 2. Tiền điều kiện | Như TC-03. Đồng hồ: **00:00 ngày 06/03/2027** (+07:00), bên kia ranh giới của TC-03 |
| 3. Các bước | 1. `GET /api/devices/1/warranty` |
| 4. Dữ liệu thử | `device_id = 1`, thời điểm `2027-03-06T00:00:00+07:00` |
| 5. Kết quả mong đợi | 200; `warranty_expires_on = 2027-03-05`; `warranty_status = HET_BAO_HANH` |
| 6. Mức ưu tiên | Cao |
| 7. Kết quả thực tế | HTTP 200 · `purchase_date=2026-03-05` · `warranty_months=12` · `warranty_expires_on=2027-03-05` · `warranty_status=HET_BAO_HANH` |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-04.png](screenshots/TC-04.png) |

### TC-05 · Dữ liệu sai · US5-AC2 – Mô tả lỗi 9 ký tự

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-05 |
| 2. Tiền điều kiện | CSDL vừa seed (30 phiếu). Đăng nhập `lan.q10` |
| 3. Các bước | 1. Đếm bảng `ticket` · 2. `POST /api/tickets` · 3. Đếm lại bảng `ticket` |
| 4. Dữ liệu thử | `{ customer_id: 100001, device_id: 1, issue_desc: "Lỗi sạc!!" (9 ký tự), category_id: 3, priority: "TRUNG_BINH" }` |
| 5. Kết quả mong đợi | 400; `error.code = VALIDATION_FAILED`; `error.fields.issue_desc = "Mô tả lỗi phải có từ 10 đến 2000 ký tự"`; bảng `ticket` không đổi |
| 6. Mức ưu tiên | Trung bình – kiểm định dạng, người dùng sửa lại được |
| 7. Kết quả thực tế | HTTP 400 · `{"code":"VALIDATION_FAILED","message":"Thông tin phiếu chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.","fields":{"issue_desc":"Mô tả lỗi phải có từ 10 đến 2000 ký tự"}}` · bảng `ticket`: 30 → 30 |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-05.png](screenshots/TC-05.png) |

### TC-06 · Dữ liệu sai · US2, QT-02 – Tạo khách thiếu họ tên và số điện thoại sai

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-06 |
| 2. Tiền điều kiện | CSDL vừa seed (31 khách). Đăng nhập `lan.q10` |
| 3. Các bước | 1. Đếm bảng `customer` · 2. `POST /api/customers` · 3. Đếm lại |
| 4. Dữ liệu thử | `{ full_name: "   ", phone: "12345", email: null, address: null }` |
| 5. Kết quả mong đợi | 400 `VALIDATION_FAILED`; `fields` gom **cả hai** lỗi `full_name` và `phone` trong một response; bảng `customer` không đổi |
| 6. Mức ưu tiên | Trung bình |
| 7. Kết quả thực tế | HTTP 400 · `fields = { full_name: "Họ tên phải có từ 1 đến 120 ký tự", phone: "Phải đủ 10 chữ số, bắt đầu bằng 0 sau khi chuẩn hóa (chấp nhận +84, 84, dấu cách, dấu chấm)" }` · bảng `customer`: 31 → 31 |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-06.png](screenshots/TC-06.png) |

### TC-07 · Dữ liệu sai · QT-03, US5-AC3 – Lập phiếu với thiết bị của khách khác

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-07 |
| 2. Tiền điều kiện | CSDL vừa seed. Thiết bị 3 thuộc khách **561**, không thuộc khách 100001. Đăng nhập `lan.q10` |
| 3. Các bước | 1. Đếm `ticket`, `ticket_status_log` · 2. `POST /api/tickets` · 3. Đếm lại |
| 4. Dữ liệu thử | `{ customer_id: 100001, device_id: 3, issue_desc: "Máy không nhận sạc, cắm sạc báo lỗi phụ kiện", category_id: 3, priority: "TRUNG_BINH" }` |
| 5. Kết quả mong đợi | 422; `error.code = BUSINESS_RULE_VIOLATION`; message "Thiết bị không thuộc khách hàng này"; cả hai bảng không đổi |
| 6. Mức ưu tiên | Cao – sai thì phiếu gắn nhầm thiết bị của người khác |
| 7. Kết quả thực tế | HTTP 422 · `{"code":"BUSINESS_RULE_VIOLATION","message":"Thiết bị không thuộc khách hàng này"}` · `ticket`: 30 → 30 · `ticket_status_log`: 30 → 30 |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-07.png](screenshots/TC-07.png) |

### TC-08 · Dữ liệu sai · QT-03 – Ghi nhận thiết bị với serial đã thuộc khách khác

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-08 |
| 2. Tiền điều kiện | CSDL vừa seed (38 thiết bị). Serial `SN973444858560` đã thuộc khách 561. Đăng nhập `lan.q10` |
| 3. Các bước | 1. Đếm `device` · 2. `POST /api/customers/100001/devices` · 3. Đếm lại, đọc chủ của serial |
| 4. Dữ liệu thử | `{ product_id: 1, serial_no: "SN973444858560", purchase_date: null, warranty_months: null }` |
| 5. Kết quả mong đợi | 409 `CONFLICT`; bảng `device` không đổi; serial vẫn thuộc khách 561 |
| 6. Mức ưu tiên | Cao – một thiết bị chỉ thuộc một khách |
| 7. Kết quả thực tế | HTTP 409 · `{"code":"CONFLICT","message":"Serial/IMEI đã được ghi nhận cho một thiết bị khác"}` · `device`: 38 → 38 · serial vẫn thuộc `customer_id=561` |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-08.png](screenshots/TC-08.png) |

### TC-09 · Bảo mật · QT-14 (OWASP A01) – Nhân viên trung tâm khác xem/sửa phiếu

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-09 |
| 2. Tiền điều kiện | CSDL vừa seed. Phiếu 10 (`BH000010/2026`) thuộc **TT Quận 10**, trạng thái MOI, ưu tiên TRUNG_BINH, 0 dòng `ticket_edit_log`. Đăng nhập `mai.tb` (Tiếp nhận, **TT Tân Bình**) |
| 3. Các bước | 1. `GET /api/tickets/10` · 2. `PATCH /api/tickets/10` · 3. Đọc lại phiếu 10 và `ticket_edit_log` |
| 4. Dữ liệu thử | PATCH `{ issue_desc: "Sửa trái phép mô tả lỗi của trung tâm khác", priority: "THAP", reason: "Thử sửa phiếu không thuộc trung tâm mình" }` |
| 5. Kết quả mong đợi | Cả hai yêu cầu 404 `NOT_FOUND` (không để lộ phiếu có tồn tại); phiếu 10 giữ nguyên; `ticket_edit_log` không thêm dòng |
| 6. Mức ưu tiên | Cao – lỗ hổng phân quyền là Critical |
| 7. Kết quả thực tế | GET → HTTP 404 `NOT_FOUND` · PATCH → HTTP 404 `NOT_FOUND` · phiếu 10 (`center_id=1`): priority TRUNG_BINH → TRUNG_BINH, `issue_desc` giữ nguyên · `ticket_edit_log`: 0 → 0 |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-09.png](screenshots/TC-09.png) |

### TC-10 · Bảo mật · QT-15, phân quyền – Che số theo vai trò, 403, 401

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-10 |
| 2. Tiền điều kiện | CSDL vừa seed, TT Quận 10 có 10 phiếu. Đăng nhập `lan.q10` (Tiếp nhận) và `hung.q10` (Quản lý) cùng TT Quận 10 |
| 3. Các bước | 1. `lan.q10` `GET /api/tickets?page=1&size=100` · 2. `hung.q10` gọi như bước 1 · 3. `hung.q10` `POST /api/tickets` · 4. `GET /api/tickets` không có cookie |
| 4. Dữ liệu thử | Bước 3: `{ customer_id: 100001, device_id: 1, issue_desc: "Quản lý thử lập phiếu bảo hành", category_id: 1, priority: "CAO" }` |
| 5. Kết quả mong đợi | Bước 1: mọi `phone` dạng `ddd****ddd`. Bước 2: mọi `phone` đủ 10 số. Bước 3: 403 `FORBIDDEN`, bảng `ticket` không đổi. Bước 4: 401 `UNAUTHENTICATED` |
| 6. Mức ưu tiên | Cao – lộ dữ liệu cá nhân là Critical |
| 7. Kết quả thực tế | Bước 1: HTTP 200, 10 phiếu, ví dụ `079****965`, tất cả đều che · Bước 2: HTTP 200, 10 phiếu, ví dụ `0793573965`, tất cả đủ 10 số · Bước 3: HTTP 403 `FORBIDDEN`, `ticket`: 30 → 30 · Bước 4: HTTP 401 `UNAUTHENTICATED` (số liệu theo lần chạy riêng TC-10 trong ảnh; khi chạy cả 12 TC, TC-01 và TC-02 đã thêm 2 phiếu nên là 12 phiếu, 32 → 32) |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-10.png](screenshots/TC-10.png) |

### TC-11 · Chất lượng dữ liệu · NFR4 – Gửi lại cùng Idempotency-Key không tạo phiếu trùng

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-11 |
| 2. Tiền điều kiện | CSDL vừa seed (30 phiếu). Đăng nhập `lan.q10`. Một khóa UUID mới |
| 3. Các bước | 1. Đếm `ticket` · 2. `POST /api/tickets` với khóa K · 3. Gửi lại y hệt với cùng khóa K (giả lập mất mạng rồi bấm lại) · 4. Đếm lại |
| 4. Dữ liệu thử | `{ customer_id: 100001, device_id: 1, issue_desc: "Pin tụt nhanh, sạc đầy chỉ dùng được 2 giờ", category_id: 2, priority: "TRUNG_BINH" }` |
| 5. Kết quả mong đợi | Lần 1: 201. Lần 2: 200, cùng `ticket_id` và `ticket_code`. Bảng `ticket` chỉ +1 |
| 6. Mức ưu tiên | Cao – phiếu trùng là sai dữ liệu |
| 7. Kết quả thực tế | Lần 1: HTTP 201, `ticket_id=31`, `BH000031/2026` · Lần 2: HTTP 200, `ticket_id=31`, `BH000031/2026` · `ticket`: 30 → 31 (chạy riêng; khi chạy cả 12 TC là `ticket_id=33`, 32 → 33) |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-11.png](screenshots/TC-11.png) |

### TC-12 · Tái lập – `npm run setup` hai lần trên CSDL trống

| Cột | Nội dung |
| --- | --- |
| 1. Mã | TC-12 |
| 2. Tiền điều kiện | CSDL `smart_crm_l2_systest_repro` **không tồn tại** (test tự xóa trước khi chạy) |
| 3. Các bước | 1. Chạy migrate + seed (lần 1) · 2. Đếm 9 bảng · 3. Chạy migrate + seed (lần 2) · 4. Đếm lại · 5. Xóa CSDL thử |
| 4. Dữ liệu thử | `db/schema.sql`, `db/seeds/001`–`007`, dữ liệu `data/sample/*.csv` |
| 5. Kết quả mong đợi | Cả hai lần mã thoát 0; lần 2 mọi seed "thêm mới 0 dòng"; số dòng 9 bảng sau lần 2 bằng đúng sau lần 1 |
| 6. Mức ưu tiên | Cao – người chấm phải dựng lại được hệ thống |
| 7. Kết quả thực tế | Lần 1: mã thoát 0, thêm 6 / 6 / 27 / 6 / 31 / 38 / 30 dòng · Lần 2: mã thoát 0, thêm 0 ở cả 7 seed · Số dòng sau lần 1 và lần 2 giống hệt: `service_center 6, employee 6, product 27, issue_category 6, customer 31, device 38, ticket 30, ticket_status_log 30, ticket_edit_log 0` |
| 8. PASS / FAIL | **PASS** – [screenshots/TC-12.png](screenshots/TC-12.png) |
