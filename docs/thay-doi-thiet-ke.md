# Thay đổi thiết kế so với Bài tập 1

**Sinh viên:** Võ Phạm Việt Phú · 2374802010391 · Track SE · Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành
**Cập nhật lần cuối:** 29/10/2026

Tài liệu liệt kê mọi chỗ thiết kế BT2 khác bản nộp BT1, kèm lý do. Hướng thiết kế không đổi: vẫn phạm vi L2, UC1–UC6, FR1–FR11 và lược đồ `db/schema.sql`. Hai loại thay đổi:

- **Bổ sung (B):** thêm phần BT1 chưa có, chủ yếu để đáp ứng yêu cầu chấm BT2.
- **Làm rõ (R):** BT1 đã có nhưng chưa đủ để hiện thực một cách duy nhất; nghiệp vụ không đổi.

## Tổng quan

| Mã    | Loại | Nội dung                   | Tài liệu đã sửa                                                        |
| ----- | ---- | -------------------------- | ---------------------------------------------------------------------- |
| TĐ-01 | B    | Đăng nhập, đăng xuất (HT1) | `srs.md`, `api-contract.md`, `architecture.drawio`, `wireframe.drawio` |
| TĐ-02 | B    | Sửa phiếu bảo hành khi nhập nhầm (US8, FR12, QT-16), màn hình M4 | `srs.md`, `api-contract.md`, `db/schema.sql`, `README.md` |
| TĐ-03 | B    | Quản lý trung tâm hủy phiếu (US9, FR13, QT-06) và quyết định bảo hành phiếu chưa xác minh (US10, FR14, QT-17) | `srs.md`, `api-contract.md`, `db/schema.sql`, `README.md` |

## Chi tiết

### TĐ-01 · Đăng nhập, đăng xuất (HT1)

- **BT1:** chỉ có endpoint 9 `POST /api/auth/login`; không có đăng xuất, không có service xử lý đăng nhập, wireframe không có trang đăng nhập.
- **BT2:** thêm HT1 vào SRS; thêm endpoint 10 `POST /api/auth/logout` (xóa cookie, 204); thêm **AuthService** (bcrypt, cấp JWT chứa vai trò, trung tâm và `center_name`); thêm trang đăng nhập vào wireframe.
- **Lý do:** cần đăng xuất để kiểm NFR2 (đổi vai trò, so số điện thoại che/đầy đủ); kiểm mật khẩu là logic nên đặt ở service; `center_name` trong JWT giúp hiện tên trung tâm trên mọi trang mà không cần thêm endpoint.
- **Ảnh hưởng:** không đổi CSDL (dùng cột có sẵn của `employee`).
- **Cách lưu token:** JWT nằm trong cookie `HttpOnly; SameSite=Strict`, JavaScript không đọc được nên an toàn hơn `localStorage`. Hạn chế: không thu hồi được token trước khi hết hạn (`JWT_EXPIRES_IN`, mặc định 8h); đăng xuất chỉ xóa cookie ở trình duyệt. Không có biến base URL vì trang EJS và API chạy cùng một máy chủ, `api-client.js` gọi bằng đường dẫn tương đối.

### TĐ-02 · Sửa phiếu bảo hành khi nhập nhầm (US8, FR12, QT-16)

- **BT1:** phiếu lập xong không sửa được. Nhân viên chọn nhầm thiết bị, nhóm sự cố, mức ưu tiên hoặc ghi sai mô tả lỗi thì không có cách nào chỉnh lại.
- **BT2:** thêm US8, FR12 và quy tắc mới QT-16. Nhân viên Tiếp nhận và Quản lý trung tâm sửa được 4 trường: thiết bị (phải thuộc đúng khách của phiếu, QT-03), mô tả lỗi, nhóm sự cố, mức ưu tiên. Mỗi lần sửa bắt buộc nhập lý do (5–255 ký tự).
    - Chỉ sửa được khi phiếu còn trạng thái **Mới** và thuộc trung tâm của người sửa (QT-14). Phiếu đã sang bước sau thuộc luồng L4, L5 nên không sửa ở L2.
    - Đổi thiết bị thì tình trạng bảo hành được tính lại tại **thời điểm tiếp nhận** (QT-05). Đổi mức ưu tiên thì hạn cam kết được tính lại từ thời điểm tiếp nhận, không tính từ lúc sửa (QT-04).
    - Không sửa được mã phiếu, khách hàng, trung tâm, thời điểm tiếp nhận. Sai khách hàng thì Quản lý hủy phiếu (TĐ-03) rồi lập phiếu mới.
    - Gửi lên đúng giá trị cũ → 422 "Không có thay đổi nào", không ghi lịch sử.
- **Hiện thực:** endpoint 18 `GET /api/tickets/{id}` (chi tiết + lịch sử + cờ `can_edit`, `can_cancel`, `can_decide_warranty`), endpoint 19 `PATCH /api/tickets/{id}`. Service mới **TicketUpdateService**; `TicketQueryService.getTicketDetail`. Màn hình mới **M4 – Chi tiết phiếu** (`/tickets/{id}`), mở bằng cách bấm mã phiếu ở M3.
- **CSDL:** thêm bảng `ticket_edit_log` (ticket_id, changed_at, changed_by, changes JSONB, reason) và index `idx_edit_log_ticket`. Bảng chỉ ghi thêm, không sửa, không xóa. `changes` lưu giá trị cũ → mới theo tên hiển thị (serial, tên nhóm…), nên lịch sử vẫn đọc đúng khi danh mục đổi tên về sau. Không dùng `ticket_status_log` vì bảng đó chỉ dành cho chuyển trạng thái (QT-06), cột `to_status` bắt buộc.
- **Lý do:** phản hồi của giảng viên khi xem demo buổi 12 (29/10/2026): nhân viên tiếp nhận cần sửa được phiếu khi nhập nhầm.
- **Ảnh hưởng:** ghi phiếu và ghi lịch sử nằm trong một giao dịch. Dòng phiếu được khóa (`SELECT … FOR UPDATE`) nên hai người sửa cùng lúc không ghi đè nhau. Migration chạy lại không lỗi (`CREATE TABLE IF NOT EXISTS`), CSDL cũ chỉ cần chạy `npm run db:migrate`.

### TĐ-03 · Quyền mới của Quản lý trung tâm: hủy phiếu (US9, FR13, QT-06) và quyết định bảo hành (US10, FR14, QT-17)

- **BT1:** Quản lý trung tâm chỉ xem danh sách phiếu. Hủy phiếu nằm trong danh sách không làm (W8). Phiếu "chưa xác minh bảo hành" chỉ được đánh dấu "chờ quản lý quyết định", nhưng chức năng quyết định để ngoài phạm vi (W12).
- **BT2:**
    - **Hủy phiếu (US9, FR13):** Quản lý hủy phiếu ở trạng thái Mới hoặc Đã phân công, bắt buộc nhập lý do. Phiếu chuyển sang **Đã hủy** theo đúng vòng đời Hình 6.2 của case study, và ghi một dòng `ticket_status_log` với lý do ở cột `note` (QT-06). Phiếu không bị xóa (QT-13), hủy rồi không mở lại, không sửa được nữa.
    - **Quyết định bảo hành (US10, FR14, QT-17 mới):** với phiếu "chưa xác minh bảo hành" chưa bị hủy, Quản lý chọn **Còn bảo hành (miễn phí)** hoặc **Hết bảo hành (có tính phí)**, bắt buộc nhập lý do. Kết quả ghi vào `ticket_edit_log`. Phiếu đã có tình trạng thì không quyết định lại được.
    - Tiếp nhận gọi hai API này → 403. Tiếp nhận vẫn không được tự ghi "còn bảo hành" cho phiếu chưa xác minh (giữ nguyên SRS mục 2).
- **Hiện thực:** endpoint 20 `POST /api/tickets/{id}/cancel`, endpoint 21 `POST /api/tickets/{id}/warranty-decision`, cùng nằm trong **TicketUpdateService**. Trên M4, khối "Quyết định bảo hành" và "Hủy phiếu" chỉ hiện khi API 18 trả cờ tương ứng; quyền thật vẫn do service kiểm lại ở từng API.
- **Lý do:** phản hồi của giảng viên khi xem demo buổi 12 (29/10/2026): Quản lý trung tâm chỉ có quyền xem phiếu là quá ít. Hai quyền được chọn vì đều nằm trong luồng L2 theo case study: "khách hủy" là nhánh `MỚI → ĐÃ HỦY` của Hình 6.2, và QT-05 ghi phiếu chưa xác minh "cần quản lý phê duyệt". Phân công kỹ thuật viên **không** thêm vì thuộc luồng L4 (W1).
- **Ảnh hưởng:** bỏ "hủy phiếu" khỏi W8 và bỏ W12 khỏi danh sách không làm. FR11 sửa thành "chưa ở trạng thái Hoàn tất, Đã đóng **hoặc Đã hủy**": phiếu đã hủy không còn bị tô đỏ QUÁ HẠN ở M3. Trước đây L2 không có phiếu Đã hủy nên FR11 chỉ loại hai trạng thái.
