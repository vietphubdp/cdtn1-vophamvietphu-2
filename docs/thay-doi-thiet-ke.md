# Thay đổi thiết kế so với Bài tập 1

**Sinh viên:** Võ Phạm Việt Phú · 2374802010391 · Track SE · Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành
**Cập nhật lần cuối:** 26/10/2026

Tài liệu này liệt kê mọi chỗ thiết kế BT2 khác bản đã nộp ở BT1, kèm lý do. Hướng thiết kế không đổi: vẫn phạm vi L2, 6 use case UC1–UC6, 11 yêu cầu chức năng FR1–FR11 và lược đồ CSDL `db/schema.sql`. Các thay đổi chia làm hai loại:

- **Bổ sung (B):** thêm phần BT1 chưa có, chủ yếu để đáp ứng yêu cầu chấm BT2.
- **Làm rõ (R):** BT1 đã có nhưng viết chưa đủ để hiện thực một cách duy nhất; nghiệp vụ không đổi.

## Tổng quan

| Mã | Loại | Nội dung | Tài liệu đã sửa |
| --- | --- | --- | --- |
| TĐ-01 | B | Đăng nhập, đăng xuất (yêu cầu hỗ trợ HT1) | `srs.md`, `api-contract.md`, `architecture.drawio`, `wireframe.drawio` |
| TĐ-02 | B | Quản lý danh mục sản phẩm và nhóm sự cố (yêu cầu hỗ trợ HT2) | `srs.md`, `api-contract.md`, `architecture.drawio` |
| TĐ-03 | R | Số tháng bảo hành mặc định lấy theo sản phẩm | `srs.md` (FR4), `api-contract.md` |
| TĐ-04 | R | Cách tính hạn cam kết ở biên Chủ nhật, múi giờ | `srs.md` (FR9, QT-04), `api-contract.md` |
| TĐ-05 | R | Cách tính ngày hết bảo hành; ý nghĩa "có tính phí", "chờ quản lý" | `srs.md` (QT-05, US4), `api-contract.md` |
| TĐ-06 | B | Cấu trúc lỗi thêm `details`, thêm mã 500 | `api-contract.md` |
| TĐ-07 | R | Chống lưu trùng và mã phiếu khi lập phiếu | `api-contract.md` |
| TĐ-08 | B | Định nghĩa response còn thiếu (endpoint 3, 4, 6, 8) | `api-contract.md` |
| TĐ-09 | R | Phạm vi vai trò: QT-13, QT-14, QT-15, bảng vai trò | `srs.md`, `wireframe.drawio` |
| TĐ-10 | B | Wireframe bản sửa được, thêm trang đăng nhập và 3 trạng thái màn hình | `wireframe.drawio`, `wireframe.png` |
| TĐ-11 | B | Sơ đồ kiến trúc thêm thành phần mới, sửa tham chiếu; bảng ánh xạ sơ đồ ↔ thư mục `src/` | `architecture.drawio`, `architecture.png`, tài liệu này |
| TĐ-12 | R | Làm rõ validation: chuẩn hóa số điện thoại, trường tùy chọn để rỗng, mô tả lỗi, `PUT` danh mục | `api-contract.md` (mục 3.11, 5) |
| TĐ-13 | B | Phong cách giao diện bằng Tailwind CSS; khung trang navbar · sidebar · footer, responsive | tài liệu này (wireframe giữ nguyên nội dung) |
| TĐ-14 | R | Dữ liệu seed lấy từ bộ mẫu Mekong Mobile thay cho dữ liệu tự soạn; sửa tên 6 trung tâm, gán lại tài khoản demo | `README.md` (mục 3), `api-contract.md` (mục 3.9) |

## Chi tiết

### TĐ-01 · Đăng nhập, đăng xuất (HT1)

- **BT1:** W13 chỉ ghi "đăng nhập bằng tài khoản mẫu"; hợp đồng API có endpoint 9 `POST /api/auth/login`; không có đăng xuất; sơ đồ kiến trúc có AuthController nhưng không có service xử lý; wireframe không có trang đăng nhập.
- **BT2:**
  - Thêm mục 3.1a "Yêu cầu hỗ trợ" trong SRS với **HT1**: đăng nhập và đăng xuất.
  - Thêm endpoint 10 `POST /api/auth/logout`: xóa cookie, trả 204.
  - Thêm **AuthService**: kiểm mật khẩu bằng bcrypt, cấp JWT chứa vai trò và trung tâm.
  - JWT và response của endpoint 9 có thêm `center_name` (họ tên đã có).
  - Thêm trang đăng nhập vào wireframe.
- **Lý do:**
  - Cần đăng xuất để kiểm NFR2 (đăng nhập lần lượt hai vai trò rồi so số điện thoại che hay đầy đủ).
  - Kiểm mật khẩu là logic, theo kiến trúc phải nằm ở lớp service; controller chỉ dịch HTTP.
  - Trang đăng nhập là lối vào bắt buộc của 3 màn hình M1–M3.
  - Wireframe hiện tên trung tâm ở trường (1) của M1 và thanh tiêu đề, nhưng BT1 không có endpoint nào trả tên trung tâm. Đưa `center_name` vào JWT lúc đăng nhập thì trang hiện được tên mà không cần thêm endpoint hay tra CSDL mỗi lần tải trang.
- **Ảnh hưởng:** không đổi CSDL; dùng các cột `username`, `password_hash`, `role`, `center_id` đã có trong bảng `employee` và `center_name` của `service_center`.

### TĐ-02 · Quản lý danh mục sản phẩm và nhóm sự cố (HT2)

- **BT1:**
  - Không có thực thể nào được đủ tạo, đọc, sửa, xóa: W8 loại việc sửa và xóa khách hàng, QT-13 cấm xóa vật lý.
  - Hợp đồng API không có endpoint trả danh sách sản phẩm, trong khi màn hình M2 cần ô chọn "Tên máy".
  - W11 ghi danh mục được cập nhật "bằng dữ liệu cấu hình".
- **BT2:**
  - Thêm **HT2**: Quản lý trung tâm được thêm, xem, sửa và ngừng dùng `product` và `issue_category` qua API.
  - Thêm các endpoint:
    - 11–14: `GET/POST/PUT/DELETE /api/products`;
    - 15–17: `POST/PUT/DELETE /api/issue-categories`;
    - endpoint 6 giữ nguyên, làm phần "đọc" của nhóm sự cố.
  - "Xóa" là đặt `is_active = false`. QT-13 được mở rộng cho cả danh mục.
  - Vai trò Tiếp nhận chỉ được đọc; mục đã ngừng dùng không hiện để chọn ở FR4, FR7.
  - Sơ đồ kiến trúc thêm **ProductController** và **CatalogService**; CategoryController phụ trách thêm endpoint 15–17.
  - Bảng vai trò và W11 sửa cho khớp. Vẫn **không** làm màn hình quản trị danh mục (giữ W11) và **không** làm sửa, xóa khách hàng (giữ W8).
- **Lý do:**
  - Yêu cầu chấm S1 của BT2 đòi ≥ 2 thực thể đủ CRUD.
  - Chọn hai bảng danh mục vì chúng đã có sẵn cột `is_active` trong DDL BT1. Như vậy đạt S1 mà không phải đổi schema hay trái W8, QT-13.
  - Endpoint 11 cũng lấp chỗ thiếu dữ liệu cho M2.
  - NFR5 (thêm nhóm sự cố chỉ cần thêm một dòng dữ liệu) vẫn đúng.
- **Ảnh hưởng:** không đổi CSDL. Lựa chọn này sẽ được xác nhận với giảng viên ở buổi 8.

### TĐ-03 · Số tháng bảo hành mặc định theo sản phẩm

- **BT1:** FR4 ghi "số tháng bảo hành điền sẵn theo sản phẩm (mặc định 12)", nhưng bảng validation của endpoint 4 ghi "mặc định 12". Hai chỗ mâu thuẫn nhau.
- **BT2:** sửa hợp đồng API theo FR4. Bỏ trống `warranty_months` thì lấy `product.default_warranty_months`; sản phẩm mới tạo mặc định 12. Câu chữ FR4 viết rõ hơn.
- **Lý do:** FR4 là yêu cầu gốc, cột `default_warranty_months` có sẵn trong ERD để phục vụ đúng việc này.

### TĐ-04 · Hạn cam kết ở biên Chủ nhật và múi giờ

- **BT1:** FR9 ghi "mỗi Chủ nhật nằm trong khoảng tính được cộng thêm 24 giờ", nhưng không nói rõ:
  - trường hợp hạn rơi **đúng** 00:00 Chủ nhật (ví dụ mức Cao, tiếp nhận 00:00 thứ Bảy);
  - "Chủ nhật" tính theo múi giờ nào.
- **BT2:**
  - Hạn cam kết không bao giờ rơi vào Chủ nhật: kết thúc đúng 00:00 Chủ nhật thì hạn là 00:00 thứ Hai.
  - Ngày giờ tính theo giờ Việt Nam (UTC+7), không theo đồng hồ máy chủ.
  - QT-04 ghi thêm cách hiện thực: đếm đủ số giờ chỉ trong thứ Hai–thứ Bảy.
- **Lý do:** cần một kết quả duy nhất để viết DueDateCalculator và test. Cách đếm giờ đã được so tự động với cách tính của FR9 trên 30.240 trường hợp (mọi phút trong một tuần, cả 3 mức ưu tiên): kết quả trùng nhau, và AC4–AC6 của US5 đều đúng.

### TĐ-05 · Ngày hết bảo hành; "có tính phí" và "chờ quản lý quyết định"

- **BT1:**
  - QT-05 ghi "(ngày tiếp nhận − ngày mua) ≤ số tháng bảo hành", chưa rõ khi mua vào cuối tháng (31/01 + 1 tháng = ?).
  - AC2, AC3 của US4 yêu cầu phiếu "được ghi là có tính phí" và "đánh dấu chờ Quản lý quyết định", nhưng ERD không có cột riêng cho hai ý này.
- **BT2:**
  - Ngày hết hạn = ngày mua cộng số tháng; nếu tháng đích không có ngày đó thì lấy ngày cuối tháng (31/01 + 1 tháng = 28/02 hoặc 29/02).
  - Còn bảo hành nếu ngày tiếp nhận ≤ ngày hết hạn, tính theo giờ Việt Nam.
  - Hai ý trên được biểu diễn bằng cột `ticket.warranty_status` đã có: `HET_BAO_HANH` = có tính phí, `CHUA_XAC_MINH` = chờ quản lý quyết định.
- **Lý do:** AC1/AC2 của US4 (05/03/2026 + 12 tháng: còn ngày 05/03/2027, hết ngày 06/03/2027) vẫn đúng. Không thêm cột vì `warranty_status` đã được phi chuẩn hóa có chủ ý ở BT1 đúng cho mục đích này.

### TĐ-06 · Cấu trúc lỗi

- **BT1:**
  - Mọi lỗi có dạng `{ "error": { "code", "message", "fields" } }`.
  - Bảng mã trạng thái lại yêu cầu lỗi 409 trùng số điện thoại "kèm `customer_id` của hồ sơ có sẵn", nhưng cấu trúc trên không có chỗ để đặt.
- **BT2:**
  - Thêm khóa tùy chọn `details`, ví dụ `{ "error": { "code": "CONFLICT", "message": "Số điện thoại đã tồn tại", "details": { "customer_id": 1024 } } }`.
  - `fields` chỉ dùng cho lỗi 400.
  - Bổ sung mã `500 INTERNAL_ERROR` vào danh sách mã dùng chung.
- **Lý do:** giải quyết mâu thuẫn trong chính hợp đồng API. `details` lấy từ tham số thứ ba của `AppError(code, message, details)`, tương ứng `chiTiet` trong mẫu ở tài liệu tự học buổi 7; đặt tên tiếng Anh cho nhất quán với quy ước đặt tên toàn repo.

### TĐ-07 · Lập phiếu: chống lưu trùng và mã phiếu

- **BT1:**
  - Endpoint 7 ghi "cùng một khóa gửi lại trả về phiếu đã lập", chưa nói trường hợp khóa đó thuộc phiếu của trung tâm khác.
  - Mã phiếu dùng sequence, chưa nói có đánh lại từ 1 mỗi năm hay không.
  - `warranty_status` chưa nói ai tính.
- **BT2:**
  - Gửi lại cùng khóa ở cùng trung tâm → trả phiếu cũ (200), không so lại body. Khóa đã dùng ở trung tâm khác → 409 (thêm vào bảng mã trạng thái).
  - Mã phiếu dùng một sequence chung, không đánh lại theo năm; phần năm lấy theo năm của `received_at` (giờ Việt Nam).
  - `warranty_status` do hệ thống tính theo QT-05 tại thời điểm tiếp nhận, không nhận từ request.
- **Lý do:**
  - Giữ QT-14: không trả phiếu của trung tâm khác.
  - Đánh lại số theo năm sẽ cần thêm bảng hoặc sequence, trong khi đúng định dạng `BH000123/2026` đã đủ cho NFR4 (0 phiếu trùng mã).

### TĐ-08 · Response còn thiếu trong hợp đồng API

- **BT1:** chỉ endpoint của User Story MUST có ví dụ request/response; endpoint 3, 4, 6, 8 chưa có.
- **BT2:**
  - Thêm ví dụ cho endpoint 3, 4, 6.
  - Định nghĩa đầy đủ response của endpoint 8 theo các cột của màn hình M3, gồm `is_overdue` tính theo đúng FR11. Danh sách sắp theo `due_date` rồi `ticket_id` để phân trang ổn định.
  - Ghi rõ thêm:
    - số điện thoại trong response của endpoint 3 cũng bị che theo vai trò;
    - serial đã ghi nhận (kể cả cho chính khách đó) → 409;
    - quy tắc theo ngày tính theo giờ Việt Nam;
    - `Content-Type` chỉ bắt buộc khi có body.
  - Bảng validation thêm phần cho `GET /api/tickets`, đăng nhập và danh mục (chi tiết làm rõ thêm ở TĐ-12).
- **Lý do:** cần đủ để hiện thực và viết test; nội dung bám sát cột của wireframe M3 và ERD đã nộp.

### TĐ-09 · Phạm vi vai trò (QT-13, QT-14, QT-15)

- **BT1:**
  - QT-14 ghi "quản lý xem toàn bộ đơn vị phụ trách".
  - QT-15 nhắc vai trò "Ban giám đốc", không có trong L2.
  - Bảng vai trò không nói Quản lý có lập phiếu hay không, dù sơ đồ use case chỉ gán UC6 cho Quản lý.
- **BT2:**
  - QT-14: quản lý xem toàn bộ phiếu của trung tâm mình (mỗi người chỉ thuộc một trung tâm, đúng bảng thuật ngữ và ERD); khách hàng và thiết bị là dữ liệu dùng chung.
  - QT-15 ghi chú vai trò Ban giám đốc không có trong L2.
  - Bảng vai trò ghi rõ Quản lý không lập phiếu, tạo khách hay ghi nhận thiết bị. M1, M2 chỉ dành cho Tiếp nhận; Quản lý dùng M3.
  - QT-13 mở rộng cho danh mục (xem TĐ-02).
- **Lý do:** cho khớp sơ đồ use case, ERD (bảng `employee` chỉ có 2 vai trò và một `center_id`) và hợp đồng API (endpoint 3, 4, 7 trả 403 với Quản lý).

### TĐ-10 · Wireframe

- **BT1:** chỉ có `wireframe.png` (M1, M2, M3), không có file gốc để sửa.
- **BT2:**
  - Dựng lại thành `docs/wireframe.drawio`, giữ nguyên bố cục, dữ liệu mẫu và số thứ tự trường.
  - Phần bổ sung tô viền tím:
    - trang đăng nhập;
    - thanh tiêu đề có nút Đăng xuất;
    - trạng thái đang tải · rỗng · lỗi cho cả 3 màn hình.
  - Các chỗ chỉnh:
    - nhóm sự cố hiện tên ("Sạc", "Pin") thay vì mã (`SAC`, `PIN`), vì bảng `issue_category` chỉ có `category_name`;
    - M2 ghi nguồn danh sách sản phẩm (endpoint 11) và số tháng điền theo sản phẩm (TĐ-03);
    - chú thích trỏ tới `srs.md` Phụ lục B.3 và `docs/erd.drawio` thay cho "Mục 2.5", "Mục 4" của file PDF BT1.
- **Lý do:** yêu cầu S4 của BT2 (đủ 3 trạng thái màn hình) và để tài liệu sửa tiếp được trong các bài sau.

### TĐ-11 · Sơ đồ kiến trúc

- **BT1:** lớp trình bày có 5 controller; lớp nghiệp vụ có 5 service; khung "Ngoài phạm vi" tham chiếu "SRS Mục 1.1.4".
- **BT2:**
  - Thêm ProductController và CatalogService (TĐ-02), AuthService và đăng xuất (TĐ-01).
  - Khung "Ngoài phạm vi" sửa tham chiếu thành "SRS Mục 1.3" (đúng số mục trong `srs.md`) và thêm W11.
  - Lớp repository và lớp lưu trữ không đổi.
- **Lý do:** sơ đồ phải ánh xạ một–một với cấu trúc thư mục `src/` của BT2.
- **Ánh xạ sơ đồ ↔ thư mục.** Một số thư mục, hàm phụ trợ không có hộp riêng trên sơ đồ; bảng dưới cho biết chúng thuộc lớp nào:

  | Thư mục / thành phần | Lớp trên sơ đồ | Ghi chú |
  | --- | --- | --- |
  | `src/presentation/controllers/` | 1 · Trình bày | PageController, các API controller, AuthMiddleware, ErrorMapper |
  | `src/presentation/views/` | 1 · Trình bày | View M1–M3, trang đăng nhập; `partials/` là khung trang chung navbar · sidebar · footer (TĐ-13) |
  | `src/presentation/styles/` | 1 · Trình bày | nguồn Tailwind CSS (TĐ-13); `npm run build:css` dựng ra `src/public/css/app.css` (không commit) |
  | `src/presentation/validators/` | 1 · Trình bày | phần "kiểm tra định dạng đầu vào" trong dòng trách nhiệm của lớp 1; `fieldRules.js` là các hàm kiểm dùng chung giữa các validator (kể cả `parsePathId` đọc mã trong đường dẫn) |
  | `src/public/js/api-client.js` | Người dùng (trình duyệt) | ghi trong hộp trên cùng; tự gắn `Idempotency-Key` và giữ khóa khi thử lưu lại (NFR4) |
  | `src/public/js/` (còn lại) | Người dùng (trình duyệt) | script từng trang (`ticket-create.js` = M1, `customer-create.js` = M2, `ticket-list.js` = M3), `layout.js` mở/đóng sidebar, `format.js` định dạng ngày giờ hiển thị và đổi ngày dd/mm/yyyy của form sang `YYYY-MM-DD`; không chứa quy tắc nghiệp vụ |
  | `src/services/` | 2 · Nghiệp vụ | 7 service; DueDateCalculator, PhoneMasker, `normalizePhone` là hàm thuần đi kèm (dòng trách nhiệm của lớp 2); `assertRole` là hàm kiểm vai trò dùng chung, ném `FORBIDDEN` (D3); `vietnamTime` là hàm thuần đổi thời điểm sang giờ Việt Nam (`…+07:00`, ngày hôm nay); `calendarDate` là hàm thuần đọc/ghi ngày `YYYY-MM-DD` cho QT-05 và kiểm ngày mua |
  | `src/domain/` | 2 · Nghiệp vụ | "đối tượng miền" trên mũi tên lớp 2 ↔ 3; hằng số danh mục (`MOI`, `CAO`, `CON_BAO_HANH`…) |
  | `src/errors/` | dùng chung lớp 1–3 | `AppError` do service ném, ErrorMapper ở lớp 1 dịch sang HTTP; `DuplicateKeyError` do repository ném khi trùng UNIQUE, service quyết định thành `CONFLICT` (repository không tự quyết nghiệp vụ) |
  | `src/repositories/` | 3 · Truy cập dữ liệu | 7 repository; `withTransaction` để service mở/đóng giao dịch mà không biết SQL |
  | `db/schema.sql`, `db/seeds/` | 4 · Lưu trữ | seed đọc `data/sample/*.csv` (TĐ-14); `007_ticket.js` gọi DueDateCalculator, WarrantyService, `formatTicketCode` của lớp 2 để hạn cam kết, tình trạng bảo hành, mã phiếu của dữ liệu mẫu khớp đúng quy tắc QT-04, QT-05 |
  | `db/tools/` | 4 · Lưu trữ (công cụ, không chạy cùng máy chủ) | `sample-data.js` rút `data/sample/` từ `data/raw/`, gọi `normalizePhone` (QT-02) và WarrantyService (QT-05) của lớp 2 để tự kiểm mẫu; `csv.js` đọc/ghi CSV dùng chung với seed |

### TĐ-12 · Làm rõ validation

- **BT1:** bảng validation của hợp đồng API chưa đủ để hiện thực một cách duy nhất ở bốn chỗ:
  - QT-02 nêu "chấp nhận +84…, 84…, dấu cách, dấu chấm" nhưng chưa nói dạng khác (gạch ngang, ngoặc, thiếu số 0 đầu) xử lý thế nào;
  - `priority`, `category_id` không bắt buộc, nhưng chưa nói gửi chuỗi rỗng thì là "bỏ trống" hay "sai";
  - `issue_desc` 10–2000 ký tự chưa nói có tính khoảng trắng đầu cuối không (10 dấu cách vẫn qua);
  - `PUT` danh mục "gửi đủ các trường như khi thêm", nhưng `default_warranty_months` không bắt buộc và mặc định 12, nên quên gửi sẽ âm thầm đặt lại 12.
- **BT2:**
  - Chuẩn hóa số: chỉ bỏ dấu cách, dấu chấm, đổi tiền tố `+84`/`84` thành `0`; dạng khác → 400. Bảng ví dụ ở mục 5 của hợp đồng API.
  - `priority`, `category_id`: vắng hoặc `null` mới là bỏ trống (lấy mặc định / chưa phân loại); chuỗi rỗng hay giá trị lạ → 400 kèm tên trường.
  - `issue_desc`: bỏ khoảng trắng đầu cuối rồi mới đếm, lưu bản đã bỏ.
  - `PUT /api/products/{id}`: `default_warranty_months` bắt buộc; `is_active` vắng thì giữ nguyên.
- **Lý do:**
  - Giữ đúng câu chữ QT-02, không tự mở rộng nghiệp vụ; mỗi dạng nhập có đúng một kết quả để viết test.
  - Chuỗi rỗng thường do lỗi giao diện; chặn sớm với thông báo rõ tốt hơn lặng lẽ lấy mặc định.
  - Mô tả toàn khoảng trắng không có nội dung, trái ý AC2 của US5 ("để trống hoặc dưới 10 ký tự").
  - `PUT` là ghi đè toàn bộ; bắt buộc trường thì không mất dữ liệu ngoài ý muốn.
- **Ảnh hưởng:** không đổi CSDL, không đổi FR/QT; chỉ thêm chi tiết vào bảng validation.

### TĐ-13 · Phong cách giao diện và khung trang

- **BT1:** wireframe M1–M3 là khung dây đen trắng, chỉ quy định nội dung, thứ tự trường và thông báo. Bản BT2 (viền tím) thêm thanh tiêu đề chung gồm tên trung tâm, người dùng (vai trò), hai nút "M1 Lập phiếu · M3 Danh sách" và nút Đăng xuất. Không quy định màu, phông chữ hay cách hiển thị trên điện thoại.
- **BT2:**
  - Trình bày bằng Tailwind CSS theo phong cách tối giản trắng đen: thẻ bo tròn lớn, nút và ô nhập dạng viên thuốc. Màu đỏ, cam, xanh chỉ dùng để báo trạng thái, đúng chú thích màu của wireframe.
  - Khung trang chung cho M1–M3:
    - **navbar:** tên hệ thống, tên trung tâm · người dùng (vai trò), nút Đăng xuất;
    - **sidebar:** thay hai nút "M1 Lập phiếu · M3 Danh sách", Quản lý không thấy mục M1; trên điện thoại thành ngăn kéo;
    - **footer:** chỉ có chữ tên hệ thống.
  - Responsive: trên màn hình hẹp các trường xếp một cột và bảng cuộn ngang.
- **Lý do:** wireframe là khung thô, dùng để xác định mỗi màn hình có những form, trường và thông báo gì, không quy định bố cục hay cách trình bày; vì vậy không vẽ lại wireframe. Người dùng yêu cầu giao diện thống nhất, dùng được trên điện thoại và máy tính bảng ở quầy tiếp nhận. Sidebar giữ đúng hai lối đi M1, M3 của thanh tiêu đề wireframe, chỉ đổi vị trí đặt. Tailwind được dựng bằng CLI lúc chạy `npm run dev`/`npm start`, không cần mạng, nên vẫn tái lập được theo đúng 4 bước của README.
- **Ảnh hưởng:**
  - Không đổi CSDL, API, FR/QT hay luồng màn hình.
  - Nội dung, thứ tự trường, câu thông báo và 3 trạng thái của từng màn hình vẫn theo `wireframe.png`.
  - Không thêm chức năng mới: không có biểu đồ, thẻ thống kê hay ô tìm kiếm (giữ W9).
  - Thêm devDependency `tailwindcss`, `@tailwindcss/cli`.
  - M3 hiện ngày tiếp nhận và hạn cam kết dạng `dd/mm/yyyy hh:mm` (wireframe ghi `dd/mm hh:mm`): thêm năm để không nhầm phiếu cuối năm với đầu năm sau; dữ liệu API không đổi.
- **Mã quyết định trình bày UI1–UI11** (chú thích trong code giao diện ghi các mã này để truy vết):

  | Mã | Nội dung | Hiện thực ở |
  | --- | --- | --- |
  | UI1 | Tailwind CSS 4 dựng bằng CLI (devDependency), không dùng CDN; `app.css` là file sinh, không commit | `package.json` (`build:css`, `predev`, `prestart`), `src/presentation/styles/tailwind.css` |
  | UI2 | Chủ đạo trắng đen (thang `neutral`); đỏ = lỗi, quá hạn, hết bảo hành · cam = cảnh báo, chưa xác minh · xanh = thành công, còn bảo hành | `tailwind.css` |
  | UI3 | Mẫu lặp lại khai báo một lần thành lớp thành phần (`.card`, `.btn-primary`, `.input`, `.alert-error`…); lớp gắn bằng JS viết đủ tên | `tailwind.css`, `src/public/js/` |
  | UI4 | Mỗi khung một nút chính; nút đang lưu bị khóa và đổi chữ ("Đang lưu…") | `views/`, script trang |
  | UI5 | Khung chung navbar · sidebar (ngăn kéo trên điện thoại) · footer chỉ có chữ; trang đăng nhập không có sidebar | `views/partials/`, `public/js/layout.js` |
  | UI6 | Mobile trước: một cột dưới 640 px, hai cột từ `md`, sidebar cố định từ `lg`; bảng cuộn ngang, trang không cuộn ngang | `views/` |
  | UI7 | Ba trạng thái đang tải · rỗng · lỗi, chữ lấy theo wireframe, lỗi có nút "Thử lại" | script trang M1–M3 |
  | UI8 | Truy cập được: `label` cho mọi ô, `aria-invalid` + `aria-describedby` khi lỗi, vòng tiêu điểm rõ, không báo trạng thái chỉ bằng màu (nhãn "QUÁ HẠN") | `views/`, script trang |
  | UI9 | Phông hệ thống, không tải phông từ mạng | `tailwind.css` |
  | UI10 | Biểu tượng SVG nội tuyến (nét kiểu Lucide, giấy phép ISC), không thêm thư viện | `views/partials/icon.ejs` |
  | UI11 | Chỉ mượn phong cách; không thêm biểu đồ, thẻ thống kê, ô tìm kiếm hay thành phần ngoài SRS | toàn bộ giao diện |

### TĐ-14 · Dữ liệu mẫu lấy từ bộ dữ liệu Mekong Mobile

- **BT1 / GĐ 0–9:** seed là dữ liệu giả lập tự soạn (D6), viết thành mảng trong `db/seeds/*.js`. Sáu trung tâm tự đặt tên (Ninh Kiều, Quận 10, Vĩnh Long, Long Xuyên, Mỹ Tho, Bến Tre) **sai** so với case study; tài khoản demo gán theo các trung tâm đó.
- **BT2:**
  - **Nguồn dữ liệu.** Bộ dữ liệu mẫu Mekong Mobile của học phần (`data/raw/`, không commit). Script `db/tools/sample-data.js` rút mẫu nhỏ ra `data/sample/*.csv` (có commit), quy tắc cố định, bộ sinh số ngẫu nhiên seed `20261026`, ngày neo `2026-10-26`, không đọc giờ máy. Seed đọc `data/sample/`, giữ `ON CONFLICT DO NOTHING` nên chạy lại không nhân đôi.
  - **Giữ nguyên từ bộ mẫu:** 6 trung tâm, 6 nhóm sự cố (kèm mã và mức ưu tiên mặc định), 30 phiếu từ `tickets_history.csv` (10 phiếu mỗi trung tâm 1–3) cùng khách, sản phẩm, serial, mô tả lỗi, nhóm, mức ưu tiên của phiếu. `center_id`, `category_id`, `product_id` và `customer_id` (= `record_id` của `customers_raw.csv`) giữ đúng mã của bộ mẫu.
  - **Sửa tên trung tâm** theo bộ mẫu: 1 TTBH Quận 10 · 2 TTBH Quận Tân Bình · 3 TTBH TP. Thủ Đức · 4 TTBH Ninh Kiều · 5 TTBH Cái Răng · 6 TTBH Cầu Giấy. Tài khoản demo gán lại theo trung tâm 1–3 mới: `lan.q10`, `hung.q10` (Quận 10, nay là mã 1); `mai.tb`, `tuan.tb` (Tân Bình); `thu.td`, `khoa.td` (Thủ Đức).
  - **Làm sạch có quy tắc:** mã nhóm sự cố (`MAN_HINH`…) đổi sang tên của bảng thuật ngữ SRS; số điện thoại chuẩn hóa bằng `normalizePhone` (QT-02); bỏ phiếu của khách không có số, phiếu làm trùng số với hồ sơ khác (QT-01) và phiếu có sản phẩm trùng tên với sản phẩm khác mã (`product.product_name` là UNIQUE, bộ mẫu có 49 tên trùng); tên khách chỉ chuẩn hóa khoảng trắng.
  - **Đặt lại trạng thái MỚI.** Phiếu gốc ở nhiều trạng thái (phần lớn `DA_DONG`), nhưng L2 dừng ở lúc lưu phiếu MỚI (QT-06) và không có chức năng chuyển trạng thái. Mọi phiếu seed đặt lại MỚI với 1 dòng lịch sử; thời điểm tiếp nhận tính lùi từ lúc seed; hạn cam kết và tình trạng bảo hành tính lại bằng DueDateCalculator (QT-04) và WarrantyService (QT-05). Không dùng `due_date` của bộ mẫu vì chưa bỏ qua Chủ nhật (README bộ dữ liệu mục 5). Mã phiếu đánh lại `BH000001/2026`… theo định dạng của `ticket.ticket_code` (Q11).
  - **Ngày mua tự sinh.** Bộ mẫu không có bảng thiết bị và ngày mua. Thiết bị dựng từ (`customer_id`, `product_id`, `serial_no`) của phiếu; ngày mua sinh theo seed sao cho WarrantyService cho đúng `is_warranty` của phiếu gốc từ 26/10/2026 tới 01/03/2027 (script tự kiểm, có test).
  - **Phần tự bổ sung** (đánh dấu `source = TU_BO_SUNG` trong CSV): khách `100001` · `0901234567` (ví dụ api-contract 3.1, lệnh curl trong README; mã ngoài dải `record_id` 1–67037); thiết bị `device_id` 1 (còn bảo hành, mua 05/03/2026 như ví dụ US4-AC1) và 2 (không có ngày mua) của khách đó; 6 thiết bị không có ngày mua khác (chưa xác minh) với serial dạng `SN` + 12 chữ số như bộ mẫu; 6 tài khoản demo.
- **Lý do:** slide buổi 8 trang 8 và README bộ dữ liệu (mục 4) yêu cầu track SE nạp danh mục từ bộ mẫu; slide buổi 10 yêu cầu luồng chính chạy trên dữ liệu mẫu thật, không phải dữ liệu tự gõ. Tên trung tâm tự đặt sai case study.
- **Ảnh hưởng:**
  - Không đổi CSDL, API, FR/QT. Seed chèn với mã của bộ mẫu rồi đặt lại sequence, nên khách, thiết bị, sản phẩm, nhóm thêm qua API nhận mã tiếp theo.
  - Lệnh curl trong README dùng `customer_id` 100001 thay cho 1; ví dụ đăng nhập ở api-contract 3.9 đổi thành `center_id` 1, "TTBH Quận 10". Wireframe giữ chữ "Trung tâm bảo hành Quận 10" (cùng trung tâm, chỉ khác cách viết tắt).
  - Phiếu seed chỉ có "còn" và "hết bảo hành" (bộ mẫu chỉ có `is_warranty` đúng/sai); "chưa xác minh" thử bằng thiết bị không có ngày mua ở M1.
  - CSDL đã seed bằng dữ liệu cũ phải xóa rồi `npm run setup` lại (seed không sửa dòng đã có).

## Những gì không thay đổi

- **CSDL:** `db/schema.sql` và `docs/erd.drawio` giữ nguyên toàn bộ bảng, cột, ràng buộc, index. Mọi thay đổi ở trên đều dùng cột có sẵn (`is_active`, `default_warranty_months`, `warranty_status`, `idempotency_key`).
- **Use case:** `docs/usecase.drawio` giữ nguyên UC1–UC6. HT1, HT2 là yêu cầu hỗ trợ, không thêm use case.
- **Yêu cầu:** FR1–FR11 giữ nguyên nội dung (FR4, FR7, FR9 chỉ viết rõ hơn); **FR11 giữ đúng nguyên văn** (quá hạn = chưa Hoàn tất hoặc Đã đóng). US1–US7, AC, NFR1–NFR5, các mục WON'T W1–W13 giữ nguyên; W11, W13 chỉ thêm ghi chú.
