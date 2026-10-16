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

BT2 yêu cầu ≤ 4 bước:

```bash
cp .env.example .env      # rồi điền giá trị thật
npm install
npm run db:migrate        # tạo bảng theo db/schema.sql
npm run dev               # mở http://localhost:3000/health
```

## 4. Cấu trúc thư mục

Dự kiến, theo sơ đồ kiến trúc (`docs/architecture.drawio`) và mẫu ở slide buổi 5, buổi 7:

```text
docs/                  tài liệu phân tích – thiết kế (BT1)
db/
  schema.sql           tạo bảng, chạy lại không lỗi
  seeds/               dữ liệu mẫu
src/
  app.js               ghép các lớp, không có logic
  presentation/        LỚP TRÌNH BÀY
    controllers/       PageController + API controller
    views/             trang EJS M1–M3
    validators/        kiểm định dạng đầu vào (400)
  public/js/           api-client.js gọi API JSON
  services/            LỚP NGHIỆP VỤ: mọi quy tắc QT-xx
  domain/              thực thể (Ticket, Device…)
  repositories/        LỚP TRUY CẬP DỮ LIỆU
  errors/              AppError mang mã nghiệp vụ
tests/                 unit test lớp services
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

## 7. Trạng thái hiện tại

- [x] Phân tích và thiết kế, nộp BT1 (buổi 6)
- [ ] Khởi tạo project, smoke test `/health` chạy được
- [ ] Module tiếp nhận và lập phiếu: UC1, UC4, UC5 (MUST)
- [ ] Module tạo khách hàng và ghi nhận thiết bị: UC2, UC3 (SHOULD)
- [ ] Module danh sách phiếu của trung tâm: UC6 (SHOULD)
