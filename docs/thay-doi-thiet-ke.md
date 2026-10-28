# Thay đổi thiết kế so với Bài tập 1

**Sinh viên:** Võ Phạm Việt Phú · 2374802010391 · Track SE · Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành
**Cập nhật lần cuối:** 28/10/2026

Tài liệu liệt kê mọi chỗ thiết kế BT2 khác bản nộp BT1, kèm lý do. Hướng thiết kế không đổi: vẫn phạm vi L2, UC1–UC6, FR1–FR11 và lược đồ `db/schema.sql`. Hai loại thay đổi:

- **Bổ sung (B):** thêm phần BT1 chưa có, chủ yếu để đáp ứng yêu cầu chấm BT2.
- **Làm rõ (R):** BT1 đã có nhưng chưa đủ để hiện thực một cách duy nhất; nghiệp vụ không đổi.

## Tổng quan

| Mã | Loại | Nội dung | Tài liệu đã sửa |
| --- | --- | --- | --- |
| TĐ-01 | B | Đăng nhập, đăng xuất (HT1) | `srs.md`, `api-contract.md`, `architecture.drawio`, `wireframe.drawio` |
| TĐ-02 | B | Quản lý danh mục sản phẩm và nhóm sự cố (HT2) | `srs.md`, `api-contract.md`, `architecture.drawio` |
| TĐ-03 | R | Số tháng bảo hành mặc định theo sản phẩm | `srs.md` (FR4), `api-contract.md` |
| TĐ-04 | R | Hạn cam kết ở biên Chủ nhật, múi giờ | `srs.md` (FR9, QT-04), `api-contract.md` |
| TĐ-05 | R | Ngày hết bảo hành; "có tính phí", "chờ quản lý" | `srs.md` (QT-05, US4), `api-contract.md` |
| TĐ-06 | B | Cấu trúc lỗi thêm `details`, mã 500 | `api-contract.md` |
| TĐ-07 | R | Chống lưu trùng và mã phiếu | `api-contract.md` |
| TĐ-08 | B | Response còn thiếu (endpoint 3, 4, 6, 8) | `api-contract.md` |
| TĐ-09 | R | Phạm vi vai trò (QT-13, 14, 15) | `srs.md`, `wireframe.drawio` |
| TĐ-10 | B | Wireframe sửa được, thêm đăng nhập và 3 trạng thái | `wireframe.drawio`, `wireframe.png` |
| TĐ-11 | B | Sơ đồ kiến trúc thêm thành phần; ánh xạ sơ đồ ↔ `src/` | `architecture.drawio`, `architecture.png` |
| TĐ-12 | R | Làm rõ validation | `api-contract.md` (mục 3.11, 5) |
| TĐ-13 | B | Giao diện Tailwind CSS, khung trang, responsive | tài liệu này |
| TĐ-14 | R | Dữ liệu seed lấy từ bộ mẫu Mekong Mobile | `README.md`, `api-contract.md` (mục 3.9) |
| TĐ-15 | B | Log JSON có `requestId`, che dữ liệu nhạy cảm; lỗi 500 trả mã tra cứu | `api-contract.md` (mục 2), `docs/bug-log.md` (BUG-001) |
| TĐ-16 | B | Đóng gói Docker: Dockerfile hai giai đoạn, compose lấy secret từ `.env`; dừng an toàn, chịu được CSDL khởi động lại | `README.md` (mục 3, cách B), `docs/bug-log.md` (BUG-002, BUG-003) |

## Chi tiết

### TĐ-01 · Đăng nhập, đăng xuất (HT1)

- **BT1:** chỉ có endpoint 9 `POST /api/auth/login`; không có đăng xuất, không có service xử lý đăng nhập, wireframe không có trang đăng nhập.
- **BT2:** thêm HT1 vào SRS; thêm endpoint 10 `POST /api/auth/logout` (xóa cookie, 204); thêm **AuthService** (bcrypt, cấp JWT chứa vai trò, trung tâm và `center_name`); thêm trang đăng nhập vào wireframe.
- **Lý do:** cần đăng xuất để kiểm NFR2 (đổi vai trò, so số điện thoại che/đầy đủ); kiểm mật khẩu là logic nên đặt ở service; `center_name` trong JWT giúp hiện tên trung tâm trên mọi trang mà không cần thêm endpoint.
- **Ảnh hưởng:** không đổi CSDL (dùng cột có sẵn của `employee`).
- **Cách lưu token:** JWT nằm trong cookie `HttpOnly; SameSite=Strict`, JavaScript không đọc được nên an toàn hơn `localStorage`. Hạn chế: không thu hồi được token trước khi hết hạn (`JWT_EXPIRES_IN`, mặc định 8h); đăng xuất chỉ xóa cookie ở trình duyệt. Không có biến base URL vì trang EJS và API chạy cùng một máy chủ, `api-client.js` gọi bằng đường dẫn tương đối.

### TĐ-02 · Quản lý danh mục sản phẩm và nhóm sự cố (HT2)

- **BT1:** không thực thể nào đủ CRUD (W8 cấm sửa/xóa khách, QT-13 cấm xóa vật lý); không có API danh sách sản phẩm cho ô "Tên máy" của M2; W11 ghi danh mục cập nhật "bằng dữ liệu cấu hình".
- **BT2:** thêm HT2: Quản lý thêm, xem, sửa, ngừng dùng `product` và `issue_category` qua endpoint 11–14 (`/api/products`), 15–17 (`/api/issue-categories`), endpoint 6 là phần đọc. "Xóa" = `is_active = false` (QT-13 mở rộng cho danh mục). Tiếp nhận chỉ đọc. Thêm ProductController, CatalogService vào sơ đồ. Vẫn không làm màn hình quản trị (W11) và không sửa/xóa khách (W8).
- **Lý do:** đáp ứng S1 (≥ 2 thực thể đủ CRUD) mà không đổi schema — hai bảng đã có cột `is_active`; endpoint 11 lấp chỗ thiếu của M2; NFR5 vẫn đúng.
- **Ảnh hưởng:** không đổi CSDL.

### TĐ-03 · Số tháng bảo hành mặc định theo sản phẩm

- **BT1:** FR4 ghi "điền sẵn theo sản phẩm", bảng validation endpoint 4 lại ghi "mặc định 12" — mâu thuẫn.
- **BT2:** theo FR4: bỏ trống `warranty_months` thì lấy `product.default_warranty_months`; sản phẩm mới mặc định 12.
- **Lý do:** FR4 là yêu cầu gốc; cột `default_warranty_months` có sẵn trong ERD cho đúng việc này.

### TĐ-04 · Hạn cam kết ở biên Chủ nhật và múi giờ

- **BT1:** FR9 "mỗi Chủ nhật trong khoảng tính cộng thêm 24 giờ" chưa nói hạn rơi đúng 00:00 Chủ nhật thì sao, và tính theo múi giờ nào.
- **BT2:** hạn không bao giờ rơi vào Chủ nhật (đúng 00:00 Chủ nhật → 00:00 thứ Hai); tính theo giờ Việt Nam (UTC+7); QT-04 hiện thực bằng cách đếm đủ số giờ trong thứ Hai–thứ Bảy.
- **Lý do:** cần một kết quả duy nhất để viết DueDateCalculator và test. Đã so tự động với cách tính của FR9 trên 30.240 trường hợp (mọi phút trong tuần × 3 mức): trùng nhau, AC4–AC6 của US5 đều đúng.

### TĐ-05 · Ngày hết bảo hành; "có tính phí" và "chờ quản lý quyết định"

- **BT1:** QT-05 chưa rõ khi mua cuối tháng (31/01 + 1 tháng = ?); US4 cần "có tính phí", "chờ Quản lý quyết định" nhưng ERD không có cột riêng.
- **BT2:** ngày hết hạn = ngày mua + số tháng, tháng đích thiếu ngày thì lấy ngày cuối tháng; còn bảo hành nếu ngày tiếp nhận ≤ ngày hết hạn (giờ Việt Nam). Dùng `ticket.warranty_status` có sẵn: `HET_BAO_HANH` = có tính phí, `CHUA_XAC_MINH` = chờ quản lý.
- **Lý do:** AC1/AC2 của US4 vẫn đúng (05/03/2026 + 12 tháng: còn 05/03/2027, hết 06/03/2027); `warranty_status` đã phi chuẩn hóa có chủ ý ở BT1 cho mục đích này.

### TĐ-06 · Cấu trúc lỗi

- **BT1:** lỗi dạng `{ "error": { "code", "message", "fields" } }`, nhưng lỗi 409 trùng số lại cần trả `customer_id` — không có chỗ đặt.
- **BT2:** thêm khóa tùy chọn `details` (ví dụ `"details": { "customer_id": 1024 }`); `fields` chỉ dùng cho 400; thêm `500 INTERNAL_ERROR`.
- **Lý do:** gỡ mâu thuẫn trong hợp đồng API. `details` là tham số thứ ba của `AppError(code, message, details)`, tương ứng `chiTiet` trong mẫu buổi 7, đặt tên tiếng Anh cho nhất quán.

### TĐ-07 · Lập phiếu: chống lưu trùng và mã phiếu

- **BT1:** chưa nói khóa chống trùng thuộc trung tâm khác thì sao, mã phiếu có đánh lại theo năm không, ai tính `warranty_status`.
- **BT2:** cùng khóa, cùng trung tâm → trả phiếu cũ (200); khóa của trung tâm khác → 409. Mã phiếu dùng một sequence chung, phần năm theo `received_at`. `warranty_status` do hệ thống tính (QT-05), không nhận từ request.
- **Lý do:** giữ QT-14 (không lộ phiếu trung tâm khác); định dạng `BH000123/2026` đã đủ cho NFR4 mà không cần thêm bảng hay sequence theo năm.

### TĐ-08 · Response còn thiếu trong hợp đồng API

- **BT1:** chỉ endpoint của story MUST có ví dụ; endpoint 3, 4, 6, 8 chưa có.
- **BT2:** thêm ví dụ endpoint 3, 4, 6; định nghĩa đủ endpoint 8 theo cột M3, có `is_overdue` theo FR11, sắp theo `due_date` rồi `ticket_id`. Ghi rõ: số điện thoại ở endpoint 3 cũng bị che; serial đã ghi nhận → 409; quy tắc theo ngày dùng giờ Việt Nam; `Content-Type` chỉ bắt buộc khi có body.
- **Lý do:** cần đủ để hiện thực và viết test; bám cột wireframe M3 và ERD.

### TĐ-09 · Phạm vi vai trò (QT-13, QT-14, QT-15)

- **BT1:** QT-14 ghi "toàn bộ đơn vị phụ trách"; QT-15 nhắc "Ban giám đốc" (không có trong L2); chưa nói Quản lý có lập phiếu không.
- **BT2:** Quản lý xem phiếu của trung tâm mình; khách và thiết bị dùng chung. Ghi chú Ban giám đốc ngoài L2. Quản lý không lập phiếu, tạo khách hay ghi nhận thiết bị — M1, M2 cho Tiếp nhận, Quản lý dùng M3. QT-13 mở rộng cho danh mục (TĐ-02).
- **Lý do:** khớp sơ đồ use case, ERD (2 vai trò, một `center_id`) và API (endpoint 3, 4, 7 trả 403 với Quản lý).

### TĐ-10 · Wireframe

- **BT1:** chỉ có `wireframe.png`, không có file gốc.
- **BT2:** dựng lại `wireframe.drawio`, giữ bố cục và số thứ tự trường. Bổ sung (viền tím): trang đăng nhập, thanh tiêu đề có Đăng xuất, trạng thái đang tải · rỗng · lỗi cho cả 3 màn hình. Chỉnh: nhóm sự cố hiện tên thay mã; M2 ghi nguồn sản phẩm (endpoint 11); chú thích trỏ tới `srs.md`, `erd.drawio`.
- **Lý do:** đáp ứng S4 và để sửa tiếp được ở các bài sau.

### TĐ-11 · Sơ đồ kiến trúc

- **BT1:** 5 controller, 5 service; khung "Ngoài phạm vi" tham chiếu sai mục SRS.
- **BT2:** thêm ProductController, CatalogService (TĐ-02), AuthService (TĐ-01); sửa tham chiếu thành "SRS Mục 1.3", thêm W11. Lớp repository và lưu trữ không đổi.
- **Lý do:** sơ đồ phải ánh xạ một–một với thư mục `src/`. Bảng dưới cho biết thư mục, hàm phụ trợ không có hộp riêng thuộc lớp nào:

  | Thư mục | Lớp | Gồm |
  | --- | --- | --- |
  | `src/presentation/controllers/` | 1 · Trình bày | PageController, API controller, AuthMiddleware, ErrorMapper |
  | `src/presentation/views/`, `styles/` | 1 · Trình bày | trang M1–M3, đăng nhập, khung chung `partials/`; nguồn Tailwind (TĐ-13) |
  | `src/presentation/validators/` | 1 · Trình bày | kiểm định dạng đầu vào; `fieldRules.js` dùng chung |
  | `src/public/js/` | Trình duyệt | `api-client.js` (gọi API, gắn `Idempotency-Key`); script từng trang; `format.js` định dạng hiển thị; không có quy tắc nghiệp vụ |
  | `src/services/` | 2 · Nghiệp vụ | 7 service + hàm thuần DueDateCalculator, PhoneMasker, `normalizePhone`, `vietnamTime`, `calendarDate`, `assertRole` |
  | `src/domain/` | 2 · Nghiệp vụ | hằng số danh mục (`MOI`, `CAO`, `CON_BAO_HANH`…) |
  | `src/errors/` | dùng chung | `AppError` (service ném, ErrorMapper dịch sang HTTP); `DuplicateKeyError` (repository ném, service quyết định `CONFLICT`) |
  | `src/logging/` | dùng chung | `logger.js` ghi JSON ra stdout (TĐ-15); chỉ lớp trình bày (RequestLogger, ErrorMapper) và `server.js` gọi logger |
  | `src/repositories/` | 3 · Truy cập dữ liệu | 7 repository, `withTransaction`; `createPool` bắt buộc có `onIdleError` (BUG-002) |
  | `src/server.js`, `src/shutdown.js` | điểm khởi động | ghép cấu hình, pool, logger, `createApp`; dừng an toàn khi nhận SIGTERM/SIGINT (BUG-003) |
  | `db/schema.sql`, `db/seeds/`, `db/tools/` | 4 · Lưu trữ | seed đọc `data/sample/*.csv`, gọi hàm lớp 2 để hạn cam kết, bảo hành, mã phiếu đúng QT-04, QT-05; `tools/` rút mẫu từ `data/raw/` (TĐ-14) |

### TĐ-12 · Làm rõ validation

- **BT1:** bốn chỗ chưa có kết quả duy nhất: dạng số điện thoại ngoài danh sách QT-02; `priority`, `category_id` gửi chuỗi rỗng; `issue_desc` toàn khoảng trắng; `PUT` danh mục quên `default_warranty_months` sẽ âm thầm về 12.
- **BT2:**
  - Số điện thoại: chỉ bỏ dấu cách, dấu chấm, đổi `+84`/`84` thành `0`; dạng khác → 400.
  - `priority`, `category_id`: vắng hoặc `null` mới là bỏ trống; chuỗi rỗng, giá trị lạ → 400 kèm tên trường.
  - `issue_desc`: cắt khoảng trắng đầu cuối rồi mới đếm 10–2000 ký tự.
  - `PUT /api/products/{id}`: `default_warranty_months` bắt buộc; `is_active` vắng thì giữ nguyên.
- **Lý do:** giữ đúng QT-02, không mở rộng nghiệp vụ; chuỗi rỗng thường do lỗi giao diện nên chặn sớm; mô tả toàn khoảng trắng trái AC2 của US5; `PUT` ghi đè toàn bộ nên trường phải bắt buộc.
- **Ảnh hưởng:** không đổi CSDL, FR, QT.

### TĐ-13 · Phong cách giao diện và khung trang

- **BT1:** wireframe chỉ quy định nội dung, thứ tự trường và thông báo; không quy định màu, phông, hiển thị trên điện thoại.
- **BT2:** Tailwind CSS, tối giản trắng đen; đỏ/cam/xanh chỉ để báo trạng thái đúng chú thích wireframe. Khung chung: navbar (trung tâm · người dùng, Đăng xuất), sidebar (M1 · M3, thành ngăn kéo trên điện thoại), footer. Responsive: màn hình hẹp xếp một cột, bảng cuộn ngang.
- **Lý do:** wireframe là khung thô nên không vẽ lại; giao diện cần dùng được trên máy tính bảng ở quầy. Tailwind dựng bằng CLI lúc `npm run dev`/`npm start`, không cần mạng, README vẫn 4 bước.
- **Ảnh hưởng:** không đổi CSDL, API, FR/QT hay luồng màn hình; không thêm biểu đồ, thống kê, tìm kiếm (W9); thêm devDependency `tailwindcss`, `@tailwindcss/cli`; M3 hiện ngày dạng `dd/mm/yyyy hh:mm` (thêm năm để không nhầm phiếu cuối năm).
- **Mã trình bày** (ghi trong chú thích code giao diện để truy vết):

  | Mã | Nội dung |
  | --- | --- |
  | UI1 | Tailwind 4 dựng bằng CLI, không CDN; `app.css` là file sinh, không commit |
  | UI2 | Trắng đen; đỏ = lỗi/quá hạn/hết BH · cam = cảnh báo/chưa xác minh · xanh = thành công/còn BH |
  | UI3 | Lớp thành phần (`.card`, `.btn-primary`, `.input`…); lớp gắn bằng JS viết đủ tên |
  | UI4 | Mỗi khung một nút chính; nút đang lưu bị khóa, đổi chữ "Đang lưu…" |
  | UI5 | Khung navbar · sidebar · footer; trang đăng nhập không có sidebar |
  | UI6 | Mobile trước; bảng cuộn ngang, trang không cuộn ngang |
  | UI7 | Ba trạng thái đang tải · rỗng · lỗi (có nút "Thử lại") |
  | UI8 | `label` cho mọi ô, `aria-invalid`, vòng tiêu điểm rõ, không báo trạng thái chỉ bằng màu |
  | UI9 | Phông hệ thống, không tải từ mạng |
  | UI10 | Biểu tượng SVG nội tuyến (kiểu Lucide, giấy phép ISC), không thêm thư viện |
  | UI11 | Chỉ mượn phong cách; không thêm thành phần ngoài SRS |

### TĐ-14 · Dữ liệu mẫu lấy từ bộ dữ liệu Mekong Mobile

- **Trước đây:** seed là dữ liệu tự soạn trong `db/seeds/*.js`; tên 6 trung tâm tự đặt, **sai** so với case study.
- **BT2:**
  - Script `db/tools/sample-data.js` rút mẫu từ bộ dữ liệu học phần (`data/raw/`, không commit) ra `data/sample/*.csv` (có commit); seed cố định `20261026`, ngày neo `2026-10-26`, chạy lại ra đúng file cũ. Seed đọc `data/sample/`, vẫn `ON CONFLICT DO NOTHING`.
  - Giữ nguyên mã và dữ liệu của bộ mẫu: 6 trung tâm, 6 nhóm sự cố, 30 phiếu (10 phiếu mỗi trung tâm 1–3) cùng khách, sản phẩm, serial, mô tả lỗi.
  - Tên trung tâm theo bộ mẫu (1 Quận 10 · 2 Tân Bình · 3 Thủ Đức · 4 Ninh Kiều · 5 Cái Răng · 6 Cầu Giấy); 6 tài khoản demo gán lại cho trung tâm 1–3.
  - Làm sạch: mã nhóm đổi sang tên theo thuật ngữ SRS; chuẩn hóa số (QT-02); bỏ phiếu thiếu số, trùng số (QT-01), trùng tên sản phẩm.
  - Phiếu đặt lại trạng thái MỚI (L2 dừng ở QT-06); thời điểm tiếp nhận tính lùi từ lúc seed; hạn cam kết, bảo hành, mã phiếu tính lại bằng code (QT-04, QT-05).
  - Bộ mẫu không có thiết bị và ngày mua: thiết bị dựng từ phiếu, ngày mua sinh cho khớp `is_warranty` gốc (có test).
  - Tự bổ sung (đánh dấu `TU_BO_SUNG`): khách `100001` · `0901234567` cùng thiết bị 1 (còn BH) và 2 (không có ngày mua) dùng cho ví dụ API và lệnh curl; 6 thiết bị chưa xác minh; 6 tài khoản demo.
- **Lý do:** slide buổi 8, 10 và README bộ dữ liệu yêu cầu nạp danh mục và chạy luồng chính trên dữ liệu mẫu thật; tên trung tâm cũ sai case study.
- **Ảnh hưởng:** không đổi CSDL, API, FR/QT; sequence đặt lại sau seed nên bản ghi thêm qua API nhận mã tiếp theo. Lệnh curl dùng `customer_id` 100001; ví dụ api-contract 3.9 đổi sang "TTBH Quận 10". Phiếu seed chỉ có "còn"/"hết bảo hành"; "chưa xác minh" thử bằng thiết bị không có ngày mua. CSDL seed bằng dữ liệu cũ phải xóa rồi `npm run setup` lại.

### TĐ-15 · Log có cấu trúc và mã tra cứu

- **BT1:** sơ đồ kiến trúc không nói về log; ErrorMapper ghi lỗi 500 bằng `console.error` kèm nguyên URL, không có thời điểm hay mã tương quan.
- **BT2:**
  - `src/logging/logger.js`: mỗi sự kiện một dòng JSON ra stdout gồm `time` (ISO), `level`, `message` và ngữ cảnh; mức tối thiểu từ biến `LOG_LEVEL`. Khóa có chữ `password`, `token`, `jwt`, `secret`, `authorization`, `cookie`, `phone` bị thay bằng `***`; số điện thoại lẫn trong chuỗi cũng bị che.
  - `RequestLogger`: gắn `requestId` cho mỗi yêu cầu, trả lại qua header `X-Request-Id`, ghi một dòng INFO khi yêu cầu kết thúc (phương thức, đường dẫn **không kèm query**, mã trạng thái, thời gian, mã nhân viên, mã lỗi nếu có).
  - ErrorMapper vẫn là nơi duy nhất ghi log lỗi: lỗi người dùng (4xx) không ghi ERROR, chỉ hiện ở dòng INFO; lỗi hệ thống ghi ERROR một lần kèm `requestId`, thông báo 500 có thêm "Mã tra cứu: …".
- **Lý do:** checklist buổi 11 yêu cầu log có thời điểm, ngữ cảnh, không chứa số điện thoại khách, và lỗi hệ thống trả mã tra cứu. Bản cũ ghi cả query string nên lộ số điện thoại của API 1 – ghi thành BUG-001 trong `docs/bug-log.md`.
- **Ảnh hưởng:** không đổi CSDL, FR/QT hay cấu trúc lỗi `{ error: { code, message, … } }`; chỉ thêm câu mã tra cứu vào `message` của lỗi 500 và header `X-Request-Id`. Không thêm thư viện (không dùng pino).

### TĐ-16 · Đóng gói Docker

- **BT1:** không có; BT2 chỉ coi Docker là điểm cộng, BT3 bắt buộc chạy được bằng ≤ 2 lệnh.
- **BT2:** `Dockerfile` hai giai đoạn (cài + dựng CSS, rồi ảnh chạy chỉ có thư viện production), chạy bằng người dùng `node`, có `HEALTHCHECK` gọi `/health`; `node` là PID 1 (`exec`) và `src/shutdown.js` dừng an toàn khi nhận SIGTERM (BUG-003). Pool CSDL bắt buộc có bộ xử lý lỗi kết nối rảnh, CSDL khởi động lại thì máy chủ không sập (BUG-002). `docker-compose.yml` gồm `db` và `app`; `app` chờ `db` healthy; mật khẩu và `JWT_SECRET` lấy từ `.env`, không ghi cứng. Chạy: `cp .env.example .env` rồi `docker compose up -d --build`.
- **Lý do:** theo tài liệu tự học buổi 11 phần A1–A4. Compose có hai dịch vụ thay vì ba (`db · api · web`) vì trang EJS và API chạy cùng một máy chủ Express (sơ đồ kiến trúc BT1).
- **Ảnh hưởng:** không đổi mã nghiệp vụ. Volume tạo trước thay đổi này dùng mật khẩu `postgres`; đổi `DB_PASSWORD` thì phải `docker compose down -v` một lần.

## Những gì không thay đổi

- **CSDL:** `db/schema.sql` và `erd.drawio` giữ nguyên; mọi thay đổi dùng cột có sẵn (`is_active`, `default_warranty_months`, `warranty_status`, `idempotency_key`).
- **Use case:** giữ UC1–UC6; HT1, HT2 là yêu cầu hỗ trợ, không thêm use case.
- **Yêu cầu:** FR1–FR11 giữ nội dung (FR4, FR7, FR9 chỉ viết rõ hơn; FR11 giữ nguyên văn); US1–US7, AC, NFR1–NFR5, W1–W13 giữ nguyên, W11 và W13 chỉ thêm ghi chú.
