# Bug Log – Smart CRM, luồng L2

Ghi **ngay khi gỡ xong** một lỗi theo bốn bước: tái lập → khoanh vùng → sửa nguyên nhân → xác nhận bằng test (slide buổi 11). Mỗi mục đủ bảy dòng. BT3 yêu cầu ≥ 3 mục, có ít nhất một mục Critical hoặc Major, link commit mở được.

**Mức độ**

| Mức      | Dùng khi (theo phạm vi L2)                                                        |
| -------- | --------------------------------------------------------------------------------- |
| Critical | Mất hoặc sai dữ liệu, lộ dữ liệu cá nhân, không lập được phiếu cho mọi khách      |
| Major    | Một chức năng MUST/SHOULD hỏng với một nhóm trường hợp; vi phạm một quy tắc QT-xx |
| Minor    | Sai hiển thị, câu thông báo, không ảnh hưởng dữ liệu hay quy tắc                  |

**Ba lỗi khiến một mục không được tính:** dòng 5 ghi triệu chứng thay vì nguyên nhân · link commit chết hoặc không liên quan · không có test FAIL trước khi sửa, PASS sau khi sửa.

## Mục lục

| Mã      | Mức      | Tóm tắt                                                                          | Trạng thái |
| ------- | -------- | -------------------------------------------------------------------------------- | ---------- |
| BUG-001 | Major    | Log lỗi hệ thống ghi số điện thoại khách (trái QT-15)                            | Đã sửa     |
| BUG-002 | Critical | Máy chủ sập khi PostgreSQL ngắt một kết nối đang rảnh                            | Đã sửa     |
| BUG-003 | Minor    | Container không tự dừng khi `docker compose stop/down`, bị giết cứng sau 10 giây | Đã sửa     |

---

## BUG-001 · Major – Log lỗi hệ thống ghi số điện thoại khách

| Dòng                  | Nội dung                                                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Mã và mức độ       | BUG-001 · Major – lộ dữ liệu cá nhân vào log, vi phạm QT-15 (che số điện thoại)                                                                                                                                                                                                                                |
| 2. Phát hiện bởi      | Rà checklist D4 tài liệu tự học buổi 11 ("log không chứa số điện thoại khách"), đọc `createErrorMiddleware`                                                                                                                                                                                                    |
| 3. Triệu chứng        | Khi tra cứu khách (API 1) gặp lỗi hệ thống, dòng log lỗi có `"url":"/api/customers?phone=0901234567"`; phản hồi 500 không có mã tra cứu để đối chiếu log                                                                                                                                                       |
| 4. Cách tái lập       | Test `BUG-001 dữ liệu sai` trong `tests/presentation/app.test.js`: repository giả ném `ECONNREFUSED` ở `findByPhone`, đăng nhập `lan.q10`, gọi `GET /api/customers?phone=0901234567` → log chứa `0901234567`                                                                                                   |
| 5. Nguyên nhân        | `createErrorMiddleware` ghi nguyên `req.originalUrl` (gồm query string) vào log; API 1 nhận số điện thoại qua query nên số đi thẳng vào log. Log không có `requestId` nên cũng không trả được mã tra cứu cho người dùng                                                                                        |
| 6. Cách sửa           | Chỉ ghi đường dẫn không kèm query (`requestPath`) ở lớp trình bày – nơi duy nhất ghi log lỗi; thêm logger JSON che khóa nhạy cảm và số điện thoại lẫn trong chuỗi (`src/logging/logger.js`); gắn `requestId` cho mỗi yêu cầu, trả trong header `X-Request-Id` và trong thông báo 500 ("Mã tra cứu: …") – TĐ-15 |
| 7. Commit và xác nhận | Commit: `<dán link commit sửa lỗi, ví dụ https://github.com/vietphubdp/cdtn1-vophamvietphu-2/commit/xxxxxxx>` · 2 test `BUG-001` FAIL trước khi sửa (log có `?phone=0901234567`, không có mã tra cứu), PASS sau khi sửa; `npm test` 455/455 PASS                                                               |

---

## BUG-002 · Critical – Máy chủ sập khi PostgreSQL ngắt một kết nối đang rảnh

| Dòng                  | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Mã và mức độ       | BUG-002 · Critical – cả tiến trình máy chủ dừng, mọi nhân viên ở mọi trung tâm mất hệ thống tới khi có người chạy lại                                                                                                                                                                                                                                                                                     |
| 2. Phát hiện bởi      | Tìm lỗi tích hợp theo slide buổi 11 ("lỗi nằm ở chỗ các module gặp nhau"): đọc `createPool` trong `src/repositories/db.js`, thấy pool không có bộ nghe sự kiện `error`                                                                                                                                                                                                                                    |
| 3. Triệu chứng        | Sau khi PostgreSQL khởi động lại (dịch vụ Windows, container `db` restart), máy chủ Node thoát với `Unhandled 'error' event … terminating connection due to administrator command`; `/health` không trả lời, trình duyệt báo không kết nối được                                                                                                                                                           |
| 4. Cách tái lập       | CSDL thử riêng: `DB_NAME=smart_crm_l2_bugtest npm run setup`, chạy `DB_NAME=smart_crm_l2_bugtest PORT=3095 node src/server.js`, đăng nhập một lần (pool giữ một kết nối rảnh), rồi ở psql: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='smart_crm_l2_bugtest' AND pid<>pg_backend_pid();` → máy chủ thoát ngay. Tự động: test `BUG-002` trong `tests/repositories/pool.test.js` |
| 5. Nguyên nhân        | Kết nối đang rảnh trong pool `pg` bị CSDL ngắt thì pool phát sự kiện `error`; `createPool` không đăng ký bộ nghe nên Node coi là lỗi không xử lý và thoát tiến trình. Lỗi không đi qua middleware vì nó không gắn với yêu cầu HTTP nào                                                                                                                                                                    |
| 6. Cách sửa           | `createPool(dbConfig, { onIdleError })` bắt buộc truyền hàm xử lý và gắn `pool.on('error', …)`; thiếu thì báo ngay lúc khởi động. `server.js` truyền hàm ghi log ERROR rồi chạy tiếp – pool đã tự bỏ kết nối hỏng và mở kết nối mới ở yêu cầu sau. Sửa ở nơi tạo pool vì đó là chỗ duy nhất biết vòng đời kết nối                                                                                         |
| 7. Commit và xác nhận | Commit: `<dán link commit sửa lỗi>` · 2 test `BUG-002` FAIL trước khi sửa (`Unhandled error`), PASS sau; chạy lại bước 4: máy chủ còn sống, log một dòng ERROR, `/health` 200, `GET /api/tickets` trả đủ dữ liệu; `npm test` 461/461 PASS                                                                                                                                                                 |

---

## BUG-003 · Minor – Container không tự dừng, bị giết cứng sau 10 giây

| Dòng                  | Nội dung                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Mã và mức độ       | BUG-003 · Minor – không mất dữ liệu (giao dịch dở bị CSDL hoàn tác), nhưng mỗi lần dừng/khởi động lại chậm 10 giây và yêu cầu đang chạy bị cắt ngang                                                                                                                                                               |
| 2. Phát hiện bởi      | Phép thử tự kiểm Docker (tài liệu tự học buổi 11, A4): `docker compose down` chậm bất thường; kiểm mã thoát container                                                                                                                                                                                              |
| 3. Triệu chứng        | `docker stop -t 10` mất 10,3 giây; container thoát mã 137 (bị SIGKILL); log không có dòng nào cho biết máy chủ đang dừng                                                                                                                                                                                           |
| 4. Cách tái lập       | `PORT=3094 docker compose -p bt2bug3 up -d --build`, chờ healthy, `docker exec bt2bug3-app-1 cat /proc/1/cmdline` → `sh -c … node src/server.js`; đo `docker stop -t 10 bt2bug3-app-1` → 10,3 giây, `docker inspect -f '{{.State.ExitCode}}'` → 137. Tự động: test `BUG-003` trong `tests/server/shutdown.test.js` |
| 5. Nguyên nhân        | Hai chỗ: (1) `CMD sh -c "… && node src/server.js"` làm `sh` thành PID 1, `sh` không chuyển SIGTERM cho `node`; (2) `server.js` không xử lý SIGTERM/SIGINT nên dù nhận được cũng không đóng kết nối HTTP và pool                                                                                                    |
| 6. Cách sửa           | `Dockerfile` dùng `exec node src/server.js` để `node` là PID 1; thêm `src/shutdown.js` (`createShutdownHandler`): ngừng nhận yêu cầu mới, chờ yêu cầu đang chạy, đóng pool, thoát mã 0; quá 8 giây thì thoát cưỡng bức mã 1; `server.js` gắn hàm này cho SIGTERM, SIGINT                                           |
| 7. Commit và xác nhận | Commit: `<dán link commit sửa lỗi>` · 4 test `BUG-003` FAIL trước khi sửa (chưa có `src/shutdown.js`), PASS sau; chạy lại bước 4: PID 1 là `node src/server.js`, `docker stop` 0,3 giây, mã thoát 0, log có "nhận SIGTERM, đang dừng máy chủ" và "đã dừng máy chủ"                                                 |

---
