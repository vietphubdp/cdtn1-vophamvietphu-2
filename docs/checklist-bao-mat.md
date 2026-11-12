# Bảng kiểm tra an toàn thông tin (Security Checklist)
## Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành — Mekong Mobile Smart CRM

**Sinh viên thực hiện:** Võ Phạm Việt Phú  
**MSSV:** 2374802010391  
**Track:** Kỹ thuật phần mềm (SE)  
**Tiêu chuẩn đánh giá:** OWASP Top 10:2025 (Căn cứ theo Slide Buổi 15 và Tài liệu tự học Buổi 15)  

---

### BẢNG TỰ ĐÁNH GIÁ 7 MỤC AN TOÀN THÔNG TIN BẮT BUỘC

| STT | Yêu cầu kiểm tra an toàn | Nhóm rủi ro OWASP Top 10:2025 | Trạng thái | Minh chứng thực tế & Cách kiểm tra |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Không có secret nào trong repo** (mật khẩu, khóa API, chuỗi kết nối, token) | **A02:2025 – Security Misconfiguration** | **ĐÃ LÀM** | • Lệnh kiểm tra lịch sử Git: `git log --all --oneline -- .env` $\rightarrow$ Kết quả **rỗng hoàn toàn**.<br>• Tệp `.env` đã được khai báo nghiêm ngặt trong cả `.gitignore` và `.dockerignore`.<br>• Kho GitHub chỉ lưu tệp mẫu `.env.example` chứa các giá trị placeholder an toàn.<br>• Mô-đun `src/config/db.js` và `src/middleware/auth.js` chỉ đọc cấu hình từ biến môi trường, không ghi cứng secret. |
| **2** | **Dữ liệu vào được kiểm tra ở tầng ứng dụng**, không chỉ dựa vào ràng buộc CSDL | **A05:2025 – Injection** | **ĐÃ LÀM** | • 100% câu truy vấn CSDL được tham số hóa dạng `$1, $2, ...` qua thư viện `pg`, tuyệt đối không ghép chuỗi SQL.<br>• Chạy 3 lệnh grep kiểm tra chống injection theo Slide 6 Buổi 15:<br>  1. `grep -rnE '(SELECT\|INSERT\|UPDATE\|DELETE).*(\+ *[a-zA-Z_]\|\$\{)' src/` $\rightarrow$ Kết quả rỗng.<br>  2. `grep -rnE "innerHTML\|dangerouslySetInnerHTML\|v-html" src/` $\rightarrow$ Kết quả rỗng.<br>  3. `grep -rnE 'exec\(|execSync|spawn\(|os\.system|shell=True' src/` $\rightarrow$ Kết quả rỗng.<br>• Test case **TC-08** gửi chuỗi SQL Injection `' OR 1=1 --` bị validator chặn và trả về lỗi `400 Bad Request`. |
| **3** | **Kiểm soát truy cập theo chủ sở hữu** (người dùng chỉ đọc/sửa dữ liệu thuộc quyền) | **A01:2025 – Broken Access Control** | **ĐÃ LÀM** | • Hệ thống phân quyền chặt chẽ theo 2 lớp: Role-based (RBAC) và Tenant-based (Service Centre Isolation – Quy tắc QT-14).<br>• Nhân viên Tiếp nhận không có quyền Hủy phiếu hoặc Quyết định bảo hành (gọi API trả về `403 Forbidden`).<br>• Nhân viên Trung tâm Tân Bình không thể xem hoặc sửa phiếu của Trung tâm Quận 10 (truy cập trả về `404 Not Found` để không làm lộ sự tồn tại của phiếu – Test case **TC-09 PASS**). |
| **4** | **Mật khẩu và dữ liệu nhạy cảm được băm hoặc mã hóa**, không lưu dạng đọc được | **A04:2025 – Cryptographic Failures** & **A07:2025 – Identification & Auth Failures** | **ĐÃ LÀM** | • Mật khẩu tài khoản nhân viên được băm bằng thuật toán `bcrypt` với cost factor = 10 (`$2b$10$...`). Kiểm tra qua query: `SELECT password_hash FROM employee LIMIT 1;`.<br>• Số điện thoại khách hàng hiển thị trên giao diện Tiếp nhận (M1, M3) được che 4 số giữa dạng `090****567` (Quy tắc QT-15, kiểm chứng qua Test case **TC-10 PASS**). Quản lý mới được xem đầy đủ số điện thoại. |
| **5** | **Thông báo lỗi không để lộ cấu trúc bên trong** (vết ngăn xếp, tên bảng, chuỗi kết nối) | **A10:2025 – Mishandling of Exceptional Conditions** & **A02:2025** | **ĐÃ LÀM** | • Mô-đun xử lý lỗi tập trung `errorHandler` chặn mọi ngoại lệ 500, trả về cấu trúc JSON chuẩn: `{"error":{"code":"INTERNAL_SERVER_ERROR","message":"Đã có lỗi xảy ra. Vui lòng thử lại sau.","requestId":"..."}}`.<br>• Chi tiết lỗi và stack trace chỉ ghi vào nhật ký máy chủ (server logs), tuyệt đối không gửi về phía client.<br>• Khi cố tình tắt CSDL PostgreSQL và gọi API, hệ thống trả về mã lỗi 503/500 kèm `requestId`, không làm lộ chuỗi kết nối PostgreSQL. |
| **6** | **Nhật ký hệ thống không ghi mật khẩu, token hay dữ liệu cá nhân không cần thiết** | **A09:2025 – Security Logging and Alerting Failures** | **ĐÃ LÀM** | • Mô-đun `logger.js` tự động lọc bỏ (mask) các trường nhạy cảm `password`, `token`, `secret` và che số điện thoại khách hàng trước khi ghi log ra stdout/file.<br>• Nhật ký chỉ lưu Request ID, HTTP Method, Path, Status Code và thời gian xử lý (ms).<br>• Kiểm tra bằng lệnh: `docker compose logs app \| grep -iE "password\|token\|0[0-9]{9}"` $\rightarrow$ Kết quả không chứa dữ liệu nhạy cảm. |
| **7** | **Phụ thuộc bên ngoài được ghim phiên bản và đã kiểm tra cảnh báo lỗ hổng** | **A03:2025 – Software Supply Chain Failures** | **ĐÃ LÀM** | • Toàn bộ thư viện phụ thuộc được khóa phiên bản chính xác thông qua tệp `package-lock.json` và được commit vào Git repo.<br>• Chạy lệnh kiểm tra an ninh thư viện: `npm audit --omit=dev` $\rightarrow$ **found 0 vulnerabilities** (0 lỗ hổng bảo mật trên toàn bộ các gói thư viện production). |

---

### KẾT LUẬN TỰ ĐÁNH GIÁ

Hệ thống phân hệ L2 đã thực hiện đầy đủ **7/7 hạng mục an toàn thông tin** theo tiêu chuẩn của học phần Chuyên đề Tốt nghiệp 1 và OWASP Top 10:2025, có đầy đủ minh chứng chạy thật trên mã nguồn và cơ sở dữ liệu.
