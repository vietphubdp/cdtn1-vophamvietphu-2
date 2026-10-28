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

- Node.js 20 LTS trở lên, npm 10 trở lên
- PostgreSQL 16 trở lên; tài khoản CSDL cần quyền CREATEDB (tài khoản `postgres` mặc định có sẵn quyền này)
- Biến môi trường (ý nghĩa và giá trị mẫu xem `.env.example`; không ghi giá trị thật vào repo):

| Biến | Dùng để |
| --- | --- |
| `PORT` | Cổng máy chủ web (mặc định 3000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Kết nối PostgreSQL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Khóa ký và thời hạn phiên đăng nhập |
| `LOG_LEVEL` | Mức log tối thiểu: `debug`, `info` (mặc định), `warn`, `error` |

## 3. Hướng dẫn chạy

### Cách A – chạy trực tiếp (Node.js + PostgreSQL trên máy)

Bốn bước, mỗi bước một lệnh:

```bash
cp .env.example .env      # rồi sửa DB_PASSWORD (và DB_USER nếu khác) cho khớp PostgreSQL trên máy
npm install
npm run setup             # = db:migrate + db:seed: tự tạo CSDL nếu chưa có, tạo bảng, nạp dữ liệu mẫu
npm run dev               # mở http://localhost:3000 → trang đăng nhập (kiểm nhanh: /health → {"status":"ok"})
```

Lệnh `cp` chạy được trên Git Bash, PowerShell, macOS, Linux; nếu dùng Command Prompt (cmd) của Windows thì thay bằng `copy .env.example .env`. Đăng nhập bằng một tài khoản ở mục [Tài khoản demo](#tài-khoản-demo).

`npm run dev` và `npm start` tự dựng CSS giao diện (Tailwind CSS qua CLI, không cần mạng) trước khi chạy máy chủ. Khi sửa giao diện, chạy thêm `npm run watch:css` ở cửa sổ khác để CSS tự dựng lại.

Các lệnh lẻ (đã gộp trong `npm run setup`):

| Lệnh                 | Việc làm                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:migrate` | Tạo CSDL `DB_NAME` nếu chưa có (cần quyền CREATEDB), rồi chạy `db/schema.sql`. Mọi lệnh dùng `IF NOT EXISTS` nên chạy lại không lỗi.                                                     |
| `npm run db:seed`    | Chạy lần lượt `db/seeds/001_*.js` → `007_*.js` theo số đầu tên file, trong một giao dịch. Chèn bằng `ON CONFLICT DO NOTHING` nên chạy lại không nhân đôi (lần hai in "thêm mới 0 dòng"). |
| `npm start`          | Chạy máy chủ không tự khởi động lại khi sửa code.                                                                                                                                        |
| `npm test`           | Chạy toàn bộ test, không cần CSDL (mục 5).                                                                                                                                               |

### Cách B – chạy bằng Docker (chỉ cần Docker Desktop / Docker Engine có Compose)

Không cần cài Node.js hay PostgreSQL. Hai lệnh:

```bash
cp .env.example .env            # giá trị mẫu dùng được ngay cho Docker
docker compose up -d --build    # dựng ảnh, chờ CSDL sẵn sàng, migrate + seed, mở http://localhost:3000
```

Kiểm tra: `docker compose ps` thấy `db` và `app` đều **healthy**; `docker compose logs app --tail 20` xem log JSON. Dừng: `docker compose down` (thêm `-v` để xóa luôn dữ liệu CSDL, hệ thống trở về trống).

- `docker-compose.yml` có hai dịch vụ: `db` (PostgreSQL 16, dữ liệu giữ trong volume `db-data`) và `app` (trang EJS và API chạy cùng một máy chủ). `app` chỉ khởi động khi `db` đã healthy.
- `Dockerfile` hai giai đoạn: giai đoạn 1 `npm ci` theo `package-lock.json` và dựng CSS; ảnh chạy chỉ có thư viện production, chạy bằng người dùng không đặc quyền `node`, có `HEALTHCHECK` gọi `/health`.
- Mật khẩu CSDL và `JWT_SECRET` lấy từ `.env`, không ghi cứng trong tệp compose. Thiếu `.env` thì compose báo "Thiếu .env – chạy cp .env.example .env".
- Mỗi lần `app` khởi động đều chạy migrate + seed rồi mới chạy máy chủ; chạy lại không lỗi, không nhân đôi dữ liệu (lần hai in "thêm mới 0 dòng").
- Cổng 5432 của `db` không mở ra máy nên không đụng PostgreSQL đã cài sẵn. Cổng 3000 đã bận thì đổi `PORT` trong `.env`.
- Đã chạy Docker trước ngày 28/10/2026 (khi compose còn ghi cứng mật khẩu) mà `.env` đặt `DB_PASSWORD` khác `postgres` thì chạy `docker compose down -v` một lần trước, vì PostgreSQL chỉ đặt mật khẩu khi volume còn trống.
- Tài khoản demo và dữ liệu mẫu giống cách A. `npm test` vẫn chạy trên máy (mục 5), không cần Docker.

### Dữ liệu mẫu

Dữ liệu seed lấy từ **bộ dữ liệu mẫu Mekong Mobile** của học phần (doanh nghiệp mô phỏng, sinh bằng `gen_dataset.py`, seed `20260901`). Bộ đầy đủ tải từ VLU e-learning, giải nén vào `data/raw/` (đã gitignore, không commit theo quy định của bộ dữ liệu). Mẫu nhỏ rút ra nằm ở `data/sample/*.csv` (có commit); `npm run db:seed` chỉ đọc `data/sample/`, **không cần** `data/raw/`.

| Bảng                | Số dòng | Nguồn và quy tắc rút mẫu                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `service_center`    | 6       | Nguyên `service_centers.csv` (giữ `center_id`, `center_name`): 1 TTBH Quận 10 · 2 TTBH Quận Tân Bình · 3 TTBH TP. Thủ Đức · 4 TTBH Ninh Kiều · 5 TTBH Cái Răng · 6 TTBH Cầu Giấy                                                                                                                                                                                                                                                                             |
| `issue_category`    | 6       | Nguyên `issue_categories.csv`, giữ `category_id` và `default_priority`; mã đổi sang tên của bảng thuật ngữ SRS: `MAN_HINH` → Màn hình, `PIN` → Pin, `SAC` → Sạc (mã 3), `PHAN_MEM` → Phần mềm, `NUOC_VAO` → Nước vào, `KHAC` → Khác                                                                                                                                                                                                                          |
| `ticket`            | 30      | Rút từ `tickets_history.csv`: 10 phiếu mỗi trung tâm 1–3, chọn theo thứ tự xáo trộn có seed; bỏ phiếu của khách không có số điện thoại, phiếu làm trùng số (QT-01) hoặc trùng tên sản phẩm. Giữ khách, sản phẩm, serial, trung tâm, mô tả lỗi, nhóm, mức ưu tiên; **đặt lại** trạng thái MỚI, thời điểm tiếp nhận tính lùi từ lúc seed, hạn cam kết và tình trạng bảo hành tính lại bằng code (QT-04, QT-05). 15 phiếu quá hạn, 15 chưa quá hạn tại lúc seed |
| `ticket_status_log` | 30      | Mỗi phiếu 1 dòng lịch sử đầu tiên (MỚI, QT-06), do Tiếp nhận của trung tâm ghi                                                                                                                                                                                                                                                                                                                                                                               |
| `customer`          | 31      | 30 khách mà phiếu tham chiếu (`customer_id` = `record_id` của `customers_raw.csv`), số chuẩn hóa bằng `normalizePhone` (QT-02), tên chuẩn hóa khoảng trắng (giữ nguyên chữ hoa/thường, dấu như bộ mẫu). **Tự bổ sung:** khách `100001` · `0901234567` của ví dụ hợp đồng API và lệnh curl                                                                                                                                                                    |
| `product`           | 27      | Các sản phẩm mà phiếu tham chiếu (giữ `product_id`, `product_name`, `warranty_months` → số tháng mặc định); đã ≥ 24 nên không phải bổ sung                                                                                                                                                                                                                                                                                                                   |
| `device`            | 38      | Bộ mẫu không có bảng thiết bị: 30 thiết bị dựng từ (`customer_id`, `product_id`, `serial_no`) của phiếu, **ngày mua tự sinh** cho khớp `is_warranty` của phiếu gốc (20 còn · 10 hết bảo hành). **Tự bổ sung:** `device_id` 1 (còn bảo hành, mua 05/03/2026) và 2 (không có ngày mua) của khách `100001`, thêm 6 thiết bị không có ngày mua → 7 thiết bị chưa xác minh                                                                                        |
| `employee`          | 6       | Tự soạn (bộ mẫu không có nhân viên tiếp nhận): 1 Tiếp nhận + 1 Quản lý ở mỗi trung tâm 1–3                                                                                                                                                                                                                                                                                                                                                                   |

Ba bảng danh mục/tổ chức ít hơn 20 dòng **có chủ ý**: số nhóm sự cố và số trung tâm là dữ kiện của bộ mẫu; `employee` chỉ là tài khoản mẫu (W13).

Giới hạn đã biết: phiếu mẫu chỉ có `is_warranty` đúng/sai nên phiếu seed chỉ có "còn" và "hết bảo hành"; "chưa xác minh" xem bằng thiết bị không có ngày mua (ví dụ `device_id` 2 của khách `0901234567`) khi lập phiếu ở M1. Tên khách giữ nguyên dạng của bộ mẫu nên có tên viết thường hoặc không dấu.

**Rút lại mẫu** (người chạy hệ thống không cần làm; chỉ dùng khi đổi quy tắc rút mẫu, cần `data/raw/`): `node db/tools/sample-data.js` đọc `data/raw/` và ghi đè `data/sample/*.csv`. Script dùng seed cố định `20261026`, không đọc giờ máy, nên chạy lại ra đúng các file cũ.

Thời điểm tiếp nhận của phiếu seed tính **lùi từ lúc chạy seed** (1 đến 230 giờ trước), nên chạy ngày nào cũng có cả phiếu quá hạn lẫn chưa quá hạn. Chạy seed lại không làm mới các phiếu đã có; muốn làm mới thì xóa CSDL rồi setup lại (tắt `npm run dev` trước; mất cả phiếu đã lập tay):

```bash
node -e "require('dotenv').config({quiet:true});const {Client}=require('pg');const c=new Client({host:process.env.DB_HOST,port:+process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'postgres'});c.connect().then(()=>c.query('DROP DATABASE '+process.env.DB_NAME+' WITH (FORCE)')).then(()=>console.log('Đã xóa')).finally(()=>c.end())"
npm run setup
```

### Tài khoản demo

Mật khẩu chung: `Demo@2026` (chỉ lưu dạng băm bcrypt trong CSDL).

| Tên đăng nhập | Vai trò           | Trung tâm              |
| ------------- | ----------------- | ---------------------- |
| `lan.q10`     | Tiếp nhận         | 1 · TTBH Quận 10       |
| `hung.q10`    | Quản lý trung tâm | 1 · TTBH Quận 10       |
| `mai.tb`      | Tiếp nhận         | 2 · TTBH Quận Tân Bình |
| `tuan.tb`     | Quản lý trung tâm | 2 · TTBH Quận Tân Bình |
| `thu.td`      | Tiếp nhận         | 3 · TTBH TP. Thủ Đức   |
| `khoa.td`     | Quản lý trung tâm | 3 · TTBH TP. Thủ Đức   |

## 4. Cấu trúc thư mục

Theo sơ đồ kiến trúc (`docs/architecture.drawio`) và mẫu ở slide buổi 5, buổi 7:

```text
docs/                  tài liệu phân tích – thiết kế; screenshots/ ảnh minh chứng (mục 7)
db/
  schema.sql           tạo bảng, chạy lại không lỗi
  migrate.js           npm run db:migrate
  seed.js              npm run db:seed
  seeds/               nạp data/sample/*.csv, chạy theo số thứ tự 001_, 002_…
  tools/               sample-data.js rút mẫu từ data/raw/; csv.js đọc/ghi CSV
src/
  server.js            điểm khởi động: đọc .env, tạo pool, gọi createApp
  shutdown.js          dừng an toàn khi nhận SIGTERM/SIGINT: đóng HTTP, đóng pool, thoát
  config.js            đọc biến môi trường
  app.js               createApp(deps): ghép các lớp, không có logic
  presentation/        LỚP TRÌNH BÀY
    controllers/       PageController + API controller + ErrorMapper (log lỗi một chỗ) + RequestLogger (requestId)
    views/             trang EJS M1–M3, partials/ khung navbar · sidebar · footer
    styles/            tailwind.css: nguồn CSS, npm run build:css dựng ra public/css/app.css
    validators/        kiểm định dạng đầu vào (400)
  public/js/           api-client.js gọi API JSON; script từng trang (ticket-create.js = M1, customer-create.js = M2, ticket-list.js = M3)
  services/            LỚP NGHIỆP VỤ: mọi quy tắc QT-xx
  domain/              hằng số danh mục dùng chung (MOI, CAO, CON_BAO_HANH…)
  repositories/        LỚP TRUY CẬP DỮ LIỆU
  errors/              AppError mang mã nghiệp vụ
  logging/             logger.js: log JSON ra stdout, che mật khẩu, token, số điện thoại
tests/                 unit test lớp services, test HTTP qua createApp với repository giả
data/
  raw/                 bộ dữ liệu Mekong Mobile đầy đủ (gitignore, tải từ VLU e-learning)
  sample/              mẫu nhỏ rút bằng db/tools/sample-data.js, seed đọc từ đây
Dockerfile             ảnh máy chủ web (cách B)
docker-compose.yml     db PostgreSQL 16 + app (cách B)
```

Phụ thuộc một chiều: `presentation` → `services` → `repositories`; lớp dưới không gọi ngược lên lớp trên.

## 5. Kiểm thử

```bash
npm test                  # hiển thị số test PASS
```

Test không cần PostgreSQL: lớp service dùng repository giả, test HTTP gọi `createApp(deps)` qua `supertest`. Tên test bắt đầu bằng mã yêu cầu (QT-xx, USx-ACy, FRx, NFRx…) để truy vết.

### Kiểm nhanh API lập phiếu bằng `curl`

Cần `npm run dev` đang chạy và dữ liệu mẫu. Chạy trong **Git Bash** (Windows) hoặc terminal macOS/Linux, ở một thư mục ngoài repo vì `lan.txt` chứa cookie đăng nhập. Trên PowerShell 5.1, `curl` là tên khác của `Invoke-WebRequest` nên phải gõ `curl.exe`. Body ghi ra file UTF-8 rồi gửi bằng `--data-binary` để giữ đúng tiếng Việt. Mỗi lần gửi dùng một `Idempotency-Key` khác (gửi lại cùng khóa trả phiếu cũ với mã 200).

```bash
# Đăng nhập, lưu cookie vào lan.txt
curl -c lan.txt -H "Content-Type: application/json" -d '{"username":"lan.q10","password":"Demo@2026"}' http://localhost:3000/api/auth/login

# Ghi body ra ticket.json (thay bằng body ở từng dòng của bảng dưới)
cat > ticket.json <<'EOF'
{"customer_id":100001,"device_id":1,"issue_desc":"Máy không nhận sạc, cắm sạc báo lỗi phụ kiện","category_id":3,"priority":"TRUNG_BINH"}
EOF
```

| Body                                                                                                                                       | Kết quả mong đợi                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `{"customer_id":100001,"device_id":1,"issue_desc":"Máy không nhận sạc, cắm sạc báo lỗi phụ kiện","category_id":3,"priority":"TRUNG_BINH"}` | `201`, mã phiếu `BH…/năm`, `status` `MOI`, `warranty_status` `CON_BAO_HANH`, hạn cam kết +72 giờ bỏ qua Chủ nhật |
| `{"customer_id":100001,"device_id":1,"issue_desc":"hỏng","priority":""}`                                                                   | `400 VALIDATION_FAILED`, `fields` nêu cả `issue_desc` và `priority`                                              |
| `{"customer_id":100001,"device_id":3,"issue_desc":"Màn hình bị sọc xanh sau khi rơi"}`                                                     | `422 BUSINESS_RULE_VIOLATION` "Thiết bị không thuộc khách hàng này" (QT-03)                                      |

```bash
# Mỗi lần gửi đổi khóa: $(node -e "console.log(crypto.randomUUID())") sinh một UUID mới
curl -i -b lan.txt -H "Content-Type: application/json" -H "Idempotency-Key: $(node -e "console.log(crypto.randomUUID())")" --data-binary @ticket.json http://localhost:3000/api/tickets
```

### Kiểm bằng tay: lưu phiếu và lịch sử trong một giao dịch (NFR4)

`npm test` chỉ kiểm được rằng ghi phiếu và ghi lịch sử nằm trong cùng một lần `withTransaction`. Rollback thật trên PostgreSQL kiểm bằng tay như sau (cần `npm run dev` đang chạy, đã đăng nhập `lan.q10` và lưu cookie vào `lan.txt`):

1. Trong `psql` (CSDL `smart_crm_l2`), gắn trigger tạm làm bước ghi lịch sử luôn lỗi:

    ```sql
    CREATE FUNCTION nfr4_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'NFR4 thu loi'; END $$;
    CREATE TRIGGER nfr4_fail BEFORE INSERT ON ticket_status_log FOR EACH ROW EXECUTE FUNCTION nfr4_fail();
    ```

2. Lập phiếu với một khóa mới (body ghi ra file UTF-8 `ticket.json`, ví dụ `{"customer_id":100001,"device_id":1,"issue_desc":"Máy không nhận sạc nữa"}`):

    ```bash
    curl -b lan.txt -H "Content-Type: application/json" -H "Idempotency-Key: 11111111-2222-4333-8444-555555555555" --data-binary @ticket.json http://localhost:3000/api/tickets
    ```

    Kết quả mong đợi: `500 INTERNAL_ERROR`, thông báo chung.

3. Kiểm không có phiếu nào được lưu dở:

    ```sql
    SELECT count(*) FROM ticket WHERE idempotency_key = '11111111-2222-4333-8444-555555555555';  -- 0
    SELECT count(*) FROM ticket t WHERE NOT EXISTS
        (SELECT 1 FROM ticket_status_log l WHERE l.ticket_id = t.ticket_id);                  -- 0
    ```

4. Gỡ trigger rồi gửi lại đúng lệnh `curl` ở bước 2 (như nhân viên bấm "Thử lưu lại"): `201`, phiếu có đúng 1 dòng lịch sử. Gửi thêm lần nữa: `200`, cùng phiếu, không lập phiếu thứ hai.

    ```sql
    DROP TRIGGER nfr4_fail ON ticket_status_log;
    DROP FUNCTION nfr4_fail();
    ```

Mã phiếu ở bước 4 có thể nhảy một số (sequence không quay lui khi rollback); NFR4 chỉ đòi không trùng mã.

## 6. Trạng thái hiện tại

- [x] Phân tích và thiết kế, nộp BT1 (buổi 6)
- [x] Khởi tạo project, migrate + seed chạy lại được, smoke test `/health` chạy được
- [x] Đăng nhập, đăng xuất (HT1)
- [x] API danh mục sản phẩm và nhóm sự cố: đọc, thêm, sửa, ngừng dùng – chỉ Quản lý được ghi (HT2, API 6, 11–17)
- [x] API khách hàng, thiết bị, tình trạng bảo hành (API 1–5)
- [x] API lập phiếu: mã phiếu, hạn cam kết, lịch sử đầu tiên, chống lưu trùng (API 7)
- [x] Màn hình M1 tiếp nhận và lập phiếu: UC1, UC4, UC5 (MUST) – giao diện Tailwind, khung navbar · sidebar · footer
- [x] Màn hình M2 tạo khách hàng và ghi nhận thiết bị: UC2, UC3 (SHOULD) – mở từ M1, lưu xong quay lại M1
- [x] Màn hình M3 danh sách phiếu của trung tâm: UC6 (SHOULD) – tô đỏ và nhãn QUÁ HẠN, phân trang 20 dòng
- [x] Phép thử thư mục trống: clone mới → 4 bước README → `npm test` PASS → `npm run setup` lần hai không lỗi, không nhân đôi dữ liệu
- [x] Dockerfile hai giai đoạn, người dùng không đặc quyền, HEALTHCHECK; compose lấy secret từ `.env`: `cp .env.example .env` rồi `docker compose up -d --build` (TĐ-16)
- [x] Ảnh minh chứng chạy toàn luồng trên dữ liệu mẫu, lưu ở `docs/screenshots/` (mục 7)
- [x] Log JSON ra stdout có `requestId`, không ghi số điện thoại; lỗi 500 trả mã tra cứu (TĐ-15, BUG-001)
- [x] Bug Log `docs/bug-log.md` theo mẫu 7 dòng: BUG-001 log lộ số điện thoại · BUG-002 máy chủ sập khi CSDL khởi động lại · BUG-003 container bị giết cứng khi dừng

## 7. Tài liệu và minh chứng

| Tài liệu                     | File                        |
| ---------------------------- | --------------------------- |
| Đặc tả yêu cầu (SRS rút gọn) | `docs/srs.md`               |
| Hợp đồng API                 | `docs/api-contract.md`      |
| Use Case Diagram             | `docs/usecase.drawio`       |
| Sơ đồ kiến trúc              | `docs/architecture.drawio`  |
| ERD                          | `docs/erd.drawio`           |
| SQL DDL                      | `db/schema.sql`             |
| Wireframe 3 màn hình         | `docs/wireframe.png`        |
| Thay đổi thiết kế so với BT1 | `docs/thay-doi-thiet-ke.md` |
| Khai báo sử dụng AI          | `docs/ai-disclosure.md`     |
| Bug Log                      | `docs/bug-log.md`           |

Ảnh minh chứng trong `docs/screenshots/`:

| Ảnh | Chứng minh |
| --- | --- |
| `01-npm-test-pass.png`, `02-npm-test-verbose.png` | `npm test` PASS toàn bộ; test thuộc ba loại luồng đúng · giá trị biên · dữ liệu sai |
| `03-setup-lan-1.png`, `04-setup-lan-2.png` | `npm run setup` từ CSDL trống tạo CSDL và nạp dữ liệu mẫu; chạy lần hai không lỗi, thêm mới 0 dòng |
| `05-curl-201-lap-phieu.png`, `06-curl-400-sai-dinh-dang.png`, `07-curl-422-qt03.png` | Lập phiếu thành công · sai định dạng nêu tên trường · vi phạm quy tắc QT-03 |
| `08` → `10` (`login-…`) | Đăng nhập thành công vào M1 và đăng nhập sai mật khẩu |
| `11` → `15` (`m1-…`, `m2-…`, `m3-…`) | Luồng chính: tra khách → lập phiếu → tạo khách và thiết bị → danh sách phiếu; Quản lý thấy số không che (QT-15) |
| `16-trang-thai-dang-tai.png`, `17-trang-thai-rong.png`, `18-trang-thai-loi-thu-lai.png` | Ba trạng thái đang tải · rỗng · lỗi kèm nút Thử lại |
