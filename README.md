# cdtn1-vophamvietphu-2

# Tra cứu khách theo số điện thoại, ghi nhận thiết bị, xác định tình trạng bảo hành, lập phiếu có mã và hạn cam kết, xem danh sách phiếu của trung tâm

- **Sinh viên:** Võ Phạm Việt Phú – 2374802010391 – Track SE
- **Học phần:** Chuyên đề Tốt nghiệp 1, HK1 2026–2027
- **Luồng nghiệp vụ:** L2 – Tiếp nhận và phân loại yêu cầu bảo hành

## 1. Mục tiêu

Hệ thống giúp nhân viên tiếp nhận và quản lý trung tâm bảo hành của Mekong Mobile giải quyết hai vấn đề:

- Yêu cầu bảo hành được ghi trên phiếu giấy, mỗi trung tâm lưu một cách, nên không biết phiếu đang ở bước nào và đã quá hạn cam kết chưa (V2).
- Mô tả lỗi do khách kể được ghi tự do, không phân nhóm, nên không thống kê được nguyên nhân bảo hành (V8).

Chi tiết và các mục không làm ở `docs/srs.md`.

## 2. Yêu cầu môi trường

- Node.js 20 LTS
- PostgreSQL 16 trở lên
- Biến môi trường: xem `.env.example`

## 3. Hướng dẫn chạy

Bốn bước, mỗi bước một lệnh:

```bash
cp .env.example .env      # rồi sửa DB_PASSWORD (và DB_USER nếu khác) cho khớp PostgreSQL trên máy
npm install
npm run setup             # = db:migrate + db:seed: tự tạo CSDL nếu chưa có, tạo bảng, nạp dữ liệu mẫu
npm run dev               # mở http://localhost:3000/health → {"status":"ok"}
```

Các lệnh lẻ (đã gộp trong `npm run setup`):

| Lệnh | Việc làm |
| --- | --- |
| `npm run db:migrate` | Tạo CSDL `DB_NAME` nếu chưa có (cần quyền CREATEDB), rồi chạy `db/schema.sql`. Mọi lệnh dùng `IF NOT EXISTS` nên chạy lại không lỗi. |
| `npm run db:seed` | Chạy lần lượt `db/seeds/001_*.js` → `006_*.js` theo số đầu tên file, trong một giao dịch. Chèn bằng `ON CONFLICT DO NOTHING` nên chạy lại không nhân đôi (lần hai in "thêm mới 0 dòng"). |
| `npm start` | Chạy máy chủ không tự khởi động lại khi sửa code. |
| `npm test` | Chạy toàn bộ test, không cần CSDL (mục 6). |

### Dữ liệu mẫu

Dữ liệu giả lập, không phải dữ liệu thật (họ tên, số điện thoại, serial đều tự soạn).

| Bảng | Số dòng | Ghi chú |
| --- | --- | --- |
| `customer` | 25 | Có khách `0901234567` trùng ví dụ trong `docs/api-contract.md` |
| `device` | 30 | 14 còn bảo hành · 9 hết bảo hành · 7 không có ngày mua (chưa xác minh) |
| `product` | 24 | Khớp ví dụ `total: 24` của hợp đồng API |
| `issue_category` | 6 | Đúng 6 nhóm trong bảng thuật ngữ SRS: Màn hình, Pin, Sạc, Phần mềm, Nước vào, Khác |
| `service_center` | 6 | Đúng 6 trung tâm của case study Mekong Mobile |
| `employee` | 6 | 1 Tiếp nhận + 1 Quản lý ở mỗi trung tâm 1–3 |
| `ticket`, `ticket_status_log` | – | Seed ở giai đoạn lập phiếu (hạn cam kết và tình trạng bảo hành phải tính bằng chính code nghiệp vụ) |

Ba bảng danh mục/tổ chức ít hơn 20 dòng **có chủ ý**: số nhóm sự cố và số trung tâm là dữ kiện của nghiệp vụ, seed thêm cho đủ 20 sẽ sai case study; `employee` chỉ là tài khoản mẫu (W13). Các bảng chính (`customer`, `device`, `product`, sau này `ticket`) đủ 20–30 dòng.

### Tài khoản demo

Mật khẩu chung: `Demo@2026` (chỉ lưu dạng băm bcrypt trong CSDL).

| Tên đăng nhập | Vai trò | Trung tâm |
| --- | --- | --- |
| `mai.nk` | Tiếp nhận | 1 · Ninh Kiều |
| `tuan.nk` | Quản lý trung tâm | 1 · Ninh Kiều |
| `lan.q10` | Tiếp nhận | 2 · Quận 10 |
| `hung.q10` | Quản lý trung tâm | 2 · Quận 10 |
| `thu.vl` | Tiếp nhận | 3 · Vĩnh Long |
| `khoa.vl` | Quản lý trung tâm | 3 · Vĩnh Long |

## 4. Cấu trúc thư mục

Theo sơ đồ kiến trúc (`docs/architecture.drawio`) và mẫu ở slide buổi 5, buổi 7:

```text
docs/                  tài liệu phân tích – thiết kế (BT1)
db/
  schema.sql           tạo bảng, chạy lại không lỗi
  migrate.js           npm run db:migrate
  seed.js              npm run db:seed
  seeds/               dữ liệu mẫu, chạy theo số thứ tự 001_, 002_…
src/
  server.js            điểm khởi động: đọc .env, tạo pool, gọi createApp
  config.js            đọc biến môi trường
  app.js               createApp(deps): ghép các lớp, không có logic
  presentation/        LỚP TRÌNH BÀY
    controllers/       PageController + API controller + ErrorMapper
    views/             trang EJS M1–M3
    validators/        kiểm định dạng đầu vào (400)
  public/js/           api-client.js gọi API JSON
  services/            LỚP NGHIỆP VỤ: mọi quy tắc QT-xx
  domain/              thực thể (Ticket, Device…)
  repositories/        LỚP TRUY CẬP DỮ LIỆU
  errors/              AppError mang mã nghiệp vụ
tests/                 unit test lớp services, test HTTP qua createApp với repository giả
data/                  mẫu nhỏ, không commit dữ liệu thật
```

Phụ thuộc một chiều: `presentation` → `services` → `repositories`; lớp dưới không gọi ngược lên lớp trên.

## 5. Tài liệu thiết kế (BT1)

| Tài liệu                     | File                       |
| ---------------------------- | -------------------------- |
| Đặc tả yêu cầu (SRS rút gọn) | `docs/srs.md`              |
| Hợp đồng API                 | `docs/api-contract.md`     |
| Use Case Diagram             | `docs/usecase.drawio`      |
| Sơ đồ kiến trúc              | `docs/architecture.drawio` |
| ERD                          | `docs/erd.drawio`          |
| SQL DDL                      | `db/schema.sql`            |
| Wireframe 3 màn hình         | `docs/wireframe.png`       |
| Khai báo sử dụng AI          | `docs/ai-disclosure.md`    |

## 6. Kiểm thử

```bash
npm test                  # hiển thị số test PASS
```

Test không cần PostgreSQL: lớp service dùng repository giả, test HTTP gọi `createApp(deps)` qua `supertest`. Tên test bắt đầu bằng mã yêu cầu (QT-xx, USx-ACy, FRx, NFRx…) để truy vết.

## 7. Trạng thái hiện tại

- [x] Phân tích và thiết kế, nộp BT1 (buổi 6)
- [x] Khởi tạo project, migrate + seed chạy lại được, smoke test `/health` chạy được
- [ ] Module tiếp nhận và lập phiếu: UC1, UC4, UC5 (MUST)
- [ ] Module tạo khách hàng và ghi nhận thiết bị: UC2, UC3 (SHOULD)
- [ ] Module danh sách phiếu của trung tâm: UC6 (SHOULD)
