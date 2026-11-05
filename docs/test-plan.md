# Test Plan – Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành (track SE)

**Sinh viên:** Võ Phạm Việt Phú · 2374802010391 · **Cập nhật:** 05/11/2026 · Kết quả chạy: [`test-report.md`](test-report.md)

## 1. Phạm vi

**Kiểm:** các quy tắc đã hiện thực ở module cốt lõi, qua API thật và PostgreSQL thật:

- Lập phiếu: mã phiếu, trạng thái MOI + một dòng lịch sử trong cùng giao dịch (QT-06), hạn cam kết bỏ qua Chủ nhật (QT-04), chống lưu trùng bằng `Idempotency-Key` (NFR4).
- Tình trạng bảo hành còn / hết / chưa xác minh (QT-05), có kiểm ngay tại ngày hết hạn.
- Thiết bị phải thuộc khách, serial duy nhất (QT-03); kiểm định dạng đầu vào và chuẩn hóa số điện thoại (US2, US5-AC2, QT-02).
- Bảo mật: chỉ thấy và sửa phiếu của trung tâm mình (QT-14, OWASP A01), che số điện thoại theo vai trò (QT-15), Quản lý không lập phiếu (403), chưa đăng nhập (401).
- Tái lập: `npm run setup` chạy hai lần trên CSDL trống không lỗi, không nhân đôi dữ liệu.

**Cố ý KHÔNG kiểm trong Test Report** (kèm lý do):

- Giao diện EJS (M1–M4): không chứa quy tắc nghiệp vụ, dữ liệu lấy qua chính các API đã kiểm; ba trạng thái đang tải / rỗng / lỗi đã có ảnh chụp tay (`screenshots/16`–`18`).
- CRUD danh mục sản phẩm, nhóm sự cố (HT2): chỉ đọc/ghi đơn giản, không nằm trong luồng lập phiếu; đã có unit test và test HTTP trong `npm test`.
- Hiệu năng, tải, nhiều người dùng đồng thời: thuộc Chuyên đề tốt nghiệp 2.
- Luồng sau tiếp nhận (phân công kỹ thuật viên, sửa chữa, đóng phiếu): thuộc L4, L5, ngoài phạm vi L2 (W1).

## 2. Loại test và số lượng

| Tầng                                 | Số lượng      | Công cụ, lệnh                                                                  |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------------ |
| Unit (service, hàm thuần, repository, seed, log) | 21 tệp test | Jest, repository giả – `npm test`                                  |
| API qua HTTP + validator, repository giả | 17 tệp test | Jest + Supertest – `npm test` (tổng 38 tệp, 505 test)                      |
| **Hệ thống: API + PostgreSQL thật**  | **12 TC**     | Jest + Supertest – `npm run test:system` (các TC của Test Report)              |

12 TC của Test Report đủ năm loại BT3:

| Loại                          | TC                    | Số |
| ----------------------------- | --------------------- | -- |
| Luồng đúng                    | TC-01, TC-02          | 2  |
| Giá trị biên (hai bên 1 ranh giới) | TC-03, TC-04     | 2  |
| Dữ liệu sai                   | TC-05, TC-06, TC-07, TC-08 | 4 |
| Bảo mật / chất lượng dữ liệu  | TC-09, TC-10, TC-11   | 3  |
| Tái lập                       | TC-12                 | 1  |

**Kỹ thuật chọn dữ liệu:**

- **Giá trị biên** – QT-05: thiết bị mua 05/03/2026, bảo hành 12 tháng → ngày hết hạn 05/03/2027. Thử 23:59 ngày 05/03/2027 (vẫn còn, vì quy tắc là "≤") và 00:00 ngày 06/03/2027 (hết). Mô tả lỗi 10–2000 ký tự: thử 9 ký tự (sát dưới ngưỡng). QT-04: phiếu Cao nhận 10:00 thứ Bảy phải vượt qua Chủ nhật.
- **Phân vùng tương đương** – tình trạng bảo hành có ba vùng (còn / hết / thiếu ngày mua), mỗi vùng một đại diện (TC-03, TC-04, TC-02). Số điện thoại: vùng hợp lệ (chuẩn hóa được) và vùng không hợp lệ ("12345", TC-06). Người gọi: cùng trung tâm / khác trung tâm / chưa đăng nhập; vai trò Tiếp nhận / Quản lý.
- Mọi kết quả mong đợi được **tính tay** từ SRS, không lấy từ chính hàm cần kiểm; mỗi TC kiểm cả **tác dụng phụ** (đếm bản ghi trước/sau).

## 3. Tiêu chí thành công (đặt trước khi chạy)

- 12/12 TC có kết quả thực tế ghi bằng số cụ thể và ảnh chụp `docs/screenshots/TC-xx.png`.
- Mỗi quy tắc QT-03, QT-04, QT-05, QT-06, QT-14, QT-15 có ≥ 1 TC; QT-05 có 2 TC biên ở hai bên ngày hết hạn.
- Mọi TC lỗi kiểm cả mã HTTP, mã lỗi, **và** số bản ghi không đổi.
- `npm test` PASS toàn bộ bằng một lệnh; không còn bug Critical đang mở trong [`bug-log.md`](bug-log.md).

## 4. Môi trường và dữ liệu thử

- **Máy:** Windows 11, Node.js 24 (dự án yêu cầu ≥ 20), PostgreSQL 18 cài trên máy (tương thích ≥ 16 như Docker compose).
- **CSDL thử riêng** `smart_crm_l2_systest` (không đụng CSDL dev `smart_crm_l2`). Trước mỗi lần chạy `npm run test:system`, `tests/system/globalSetup.js` **xóa và dựng lại** CSDL này bằng `db:migrate` + `db:seed` → tiền điều kiện luôn là dữ liệu seed: 6 trung tâm, 6 tài khoản, 27 sản phẩm, 6 nhóm sự cố, 31 khách, 38 thiết bị, 30 phiếu. TC-12 dùng thêm CSDL `smart_crm_l2_systest_repro` và xóa nó sau khi chạy.
- **Tài khoản seed:** `lan.q10` (Tiếp nhận, TT 1), `hung.q10` (Quản lý, TT 1), `mai.tb` (Tiếp nhận, TT 2); mật khẩu `Demo@2026`.
- **Đồng hồ cố định:** mỗi TC truyền `now` theo giờ Việt Nam (+07:00) vào `createApp`, nên kết quả không phụ thuộc ngày chạy.
- **Lệnh:** cần `.env` có thông tin kết nối PostgreSQL (`cp .env.example .env`), rồi:

```bash
npm install
npm test                               # 505 unit + HTTP test, không cần CSDL
npm run test:system                    # 12 TC trên PostgreSQL thật
npm run test:system -- -t TC-05        # chạy lại riêng một TC
```
