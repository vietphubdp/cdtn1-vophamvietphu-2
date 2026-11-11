# HỒ SƠ THEO DÕI TIẾN ĐỘ BÀI TẬP 3 (BT3) – CHUYÊN ĐỀ TỐT NGHIỆP 1

> **MỤC ĐÍCH TỆP NÀY:**  
> Tệp này là **kim chỉ nam duy nhất** lưu trữ toàn bộ ngữ cảnh, yêu cầu, tiến độ và các bước đang thực hiện của dự án.  
> **KHI MỞ PHIÊN LÀM VIỆC MỚI:** Đọc tệp này đầu tiên để nắm ngay trạng thái hiện tại, không làm lệch hướng, không làm sót tiêu chí của giảng viên.

---

## 1. THÔNG TIN CHUNG DỰ ÁN

- **Sinh viên:** Võ Phạm Việt Phú
- **MSSV:** 2374802010391
- **Chuyên ngành (Track):** Kỹ thuật phần mềm (SE - Software Engineering)
- **Học phần:** Chuyên đề Tốt nghiệp 1 (HK1, Năm học 2026–2027) – Khoa CNTT, Đại học Văn Lang
- **Giảng viên chính:** TS. Nguyễn Trí Hải / ThS. Nguyễn Minh Tân / ThS. Trần Công Thanh
- **Đề tài / Case Study:** Smart CRM – Mekong Mobile
- **Phân hệ / Luồng nghiệp vụ:** **Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành**
- **Thư mục mã nguồn:** `d:\Docs\ChuyenDeTotNghiep1\cdtn1-vophamvietphu-2`
- **Kho GitHub:** `https://github.com/vietphubdp/cdtn1-vophamvietphu-2` (Phải để chế độ **PUBLIC**)
- **Git Tag bài nộp:** `v1.0`
- **File nộp trên VLU E-learning:** `BT3_2374802010391_VoPhamVietPhu.pdf` (kèm file Word `.docx`)

---

## 2. QUY CHUẨN ĐÁNH GIÁ BÀI TẬP 3 (10% ĐIỂM HỌC PHẦN)
*(Căn cứ theo Slide Buổi 15, Buổi 16 và Tài liệu tự học Buổi 13, 15)*

### 2.1. Sáu thành phần bắt buộc trong Repo (Tag `v1.0`)
1. **TP1 – Test Plan:** Rút gọn 4 mục (Phạm vi, Loại test & số lượng, Tiêu chí thành công, Môi trường & dữ liệu thử).
2. **TP2 – Test Report:** 10–12 test case đủ 8 cột, đủ 5 loại (luồng đúng, biên, dữ liệu sai, bảo mật/chất lượng dữ liệu, tái lập), có kết quả CHẠY THẬT.
3. **TP3 – Bug Log:** $\ge$ 3 bug ($\ge$ 1 Critical hoặc Major), mỗi bug đủ 7 dòng, có link commit GitHub trỏ đúng.
4. **TP4 – Gói đóng gói:** Dựng lại được bằng $\le$ 2 lệnh từ thư mục trống (`cp .env.example .env && docker compose up -d --build`).
5. **TP5 – Deployment Guide & Checklist bảo mật:**
   - Deployment Guide tiếng Anh đủ 5 mục (Requirements, Setup steps, Environment variables, Sample data, Verify it works).
   - Checklist bảo mật 7 mục OWASP Top 10:2025, mỗi mục có một dòng minh chứng thực tế.
6. **TP6 – Tài liệu kỹ thuật tiếng Anh (Track SE):** API Docs tiếng Anh bao quát mọi endpoint (21 endpoints), mỗi endpoint đủ 7 mục kèm ví dụ JSON chạy thật + file đặc tả `openapi.yaml`.

### 2.2. Chín tiêu chí kỹ thuật (C1 – C9)
- **C1 (CỐT LÕI):** Gói dựng lại được từ thư mục trống bằng $\le$ 2 lệnh, theo đúng Deployment Guide, không hỏi sinh viên câu nào.
- **C2 (CỐT LÕI):** Test Report 10–12 test case đủ 8 cột, đủ 5 loại.
- **C3 (CỐT LÕI):** Bộ test PASS bằng 1 lệnh; 1 test case chọn ngẫu nhiên chạy lại được tại chỗ.
- **C4 (CỐT LÕI):** Bug Log $\ge$ 3 bug ($\ge$ 1 Critical/Major), mỗi bug 7 dòng, link commit mở được.
- **C5:** Deployment Guide đủ 5 mục, có mục "Verify it works".
- **C6:** Checklist bảo mật 7 mục đã điền đủ, mỗi mục có minh chứng cụ thể.
- **C7:** Không có secret nào trong repo; `.env` chưa từng bị commit vào lịch sử Git (`git log --all --oneline -- .env` rỗng).
- **C8:** Chạy lại lần thứ 2 (`migrate` + `seed`) không lỗi, không nhân đôi dữ liệu.
- **C9:** Tài liệu kỹ thuật theo track mô tả đúng hệ thống thật, không mô tả tính năng chưa có.
> **LƯU Ý:** Thiếu 1 mục cốt lõi (C1–C4) $\rightarrow$ Tiêu chí Chất lượng kỹ thuật về mức Yếu, không bù được bằng mục khác!

### 2.3. Cấu trúc bắt buộc của File Báo cáo PDF (`BT3_2374802010391_VoPhamVietPhu.pdf`)
- **Trang bìa:** Link repo + tag `v1.0`, track SE, mã luồng L2; thông tin sinh viên; link deploy thử nếu có.
- **Mục 1:** Test Plan
- **Mục 2:** Test Report
- **Mục 3:** Bug Log
- **Mục 4:** Deployment Guide (tiếng Anh) + Cảnh báo giám sát ALERT-01, ALERT-02
- **Mục 5:** Checklist bảo mật (7 mục)
- **Mục 6:** Tài liệu kỹ thuật API Docs (tiếng Anh)
- **Mục 7:** ẢNH CHỤP MINH CHỨNG: Test PASS, hệ thống lên được (`docker compose ps` healthy, `/health`), phép thử máy trắng, 3 lệnh grep bảo mật.
- **Phụ lục (bắt buộc):** Bảng khai báo sử dụng công cụ AI (4 cột) cho Giai đoạn 3 (Buổi 13–16).

---

## 3. BẢNG THEO DÕI TIẾN ĐỘ CÁC CÔNG VIỆC

| STT | Hạng mục công việc | Tệp liên quan | Trạng thái | Ghi chú & Chi tiết kỹ thuật |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Rà soát & Sửa `Dockerfile`** | `cdtn1-vophamvietphu-2/Dockerfile` | 🔲 CẦN LÀM | Slide 8 B15 & Slide 6 B16: Giảng viên sẽ chạy `docker compose exec app npm test` trong container. Cần giữ `devDependencies` (jest, supertest) và copy `tests/` vào runtime image. |
| **2** | **Biên soạn `deployment-guide.md`** | `cdtn1-vophamvietphu-2/docs/deployment-guide.md` | 🔲 CẦN LÀM | Viết bằng tiếng Anh chuẩn. Đủ 5 mục bắt buộc: 1. Requirements, 2. Setup steps, 3. Environment variables, 4. Sample data, 5. Verify it works + Mục 6 Cảnh báo giám sát (ALERT-01 & ALERT-02) + Mục 7 HTTPS & Production. |
| **3** | **Biên soạn `checklist-bao-mat.md`** | `cdtn1-vophamvietphu-2/docs/checklist-bao-mat.md` | 🔲 CẦN LÀM | Đủ 7 mục OWASP Top 10:2025. Trạng thái ĐÃ LÀM + một dòng minh chứng thực tế (kết quả lệnh grep, commit hash, test case ID). |
| **4** | **Biên soạn `api-docs.md` (Track SE)** | `cdtn1-vophamvietphu-2/docs/api-docs.md` | 🔲 CẦN LÀM | Viết bằng tiếng Anh, bao quát 21 endpoints của L2. Mỗi endpoint đủ 7 mục: Method & Path, 1-line business description, Auth & role, Params & body (JSON thật), Success response (JSON thật), Error codes table, Notes on special rules. |
| **5** | **Tạo file đặc tả `openapi.yaml`** | `cdtn1-vophamvietphu-2/docs/openapi.yaml` | 🔲 CẦN LÀM | Chuẩn OpenAPI 3.0, mở được trên Swagger Editor không lỗi, mô tả chính xác 21 endpoints. |
| **6** | **Cập nhật `thay-doi-thiet-ke.md`** | `cdtn1-vophamvietphu-2/docs/thay-doi-thiet-ke.md` | 🔲 CẦN LÀM | Hoàn thiện mục `## Phản hồi Bài tập 2 và quyết định xử lý` và cập nhật các thay đổi TĐ của giai đoạn BT3 (TĐ-15 đến TĐ-18). |
| **7** | **Cập nhật `ai-disclosure.md`** | `cdtn1-vophamvietphu-2/docs/ai-disclosure.md` | 🔲 CẦN LÀM | Bổ sung bảng khai báo sử dụng AI cho Giai đoạn 3 (Buổi 13–16: kiểm thử hệ thống, đóng gói Docker, viết tài liệu). |
| **8** | **Cập nhật `README.md` & `package.json`** | `cdtn1-vophamvietphu-2/README.md`, `package.json` | 🔲 CẦN LÀM | Nâng version package lên `1.0.0`; cập nhật README đồng bộ liên kết tài liệu mới và hướng dẫn 2 lệnh chạy. |
| **9** | **Thực hiện Phép thử máy trắng & Chụp ảnh** | `docs/screenshots/` | 🔲 CẦN LÀM | Chạy 3 lệnh grep bảo mật, quét secret git history, kiểm tra docker compose ps healthy, /health ok, thu thập minh chứng. |
| **10**| **Tạo Báo cáo BT3 Word & xuất PDF** | `BT3_2374802010391_VoPhamVietPhu.docx / .pdf` | 🔲 CẦN LÀM | Đủ 7 mục + Phụ lục khai báo AI. Định dạng chuẩn Văn Lang. |
| **11**| **Git Commit & Gắn Tag `v1.0`** | Git repository | 🔲 CẦN LÀM | Commit sạch sẽ, không có secret, tag `v1.0` có chú thích. |

---

## 4. GHI CHÚ KỸ THUẬT QUAN TRỌNG KHI CHẠY LỆNH TRÊN MÁY DEV

1. **Về việc chạy `npm test` trên Windows:**
   - Trong môi trường sandbox Windows, lệnh Supertest khởi tạo ephemeral HTTP server trên `127.0.0.1:port` sẽ gặp lỗi `connect EACCES 127.0.0.1:...` nếu bị chặn quyền mạng loopback.
   - Khi chạy lệnh kiểm thử tích hợp HTTP (`npm test` hoặc `npm run test:system`), cần sử dụng `BypassSandbox: true` để cấp quyền loopback socket, khi đó 505 unit/HTTP test và 12 system test sẽ PASS 100%.
2. **Về tài khoản Demo và dữ liệu mẫu:**
   - Tiếp nhận (TT Quận 10): `lan.q10` / `Demo@2026`
   - Quản lý (TT Quận 10): `hung.q10` / `Demo@2026`
   - Tiếp nhận (TT Tân Bình): `mai.tb` / `Demo@2026`
3. **Lệnh kiểm tra Secret trong Git:**
   - `git log --all --oneline -- .env` $\rightarrow$ Phải KHÔNG ra dòng nào.
   - `git check-ignore -v .env` $\rightarrow$ Phải hiển thị dòng `.gitignore` chặn `.env`.

---

## 5. HÀNH ĐỘNG TIẾP THEO (NEXT ACTIONS)
1. Cập nhật `Dockerfile` trong `cdtn1-vophamvietphu-2` (giữ tests & devDependencies trong image runtime).
2. Tạo file `docs/deployment-guide.md` tiếng Anh chuẩn.
3. Tạo file `docs/checklist-bao-mat.md`.
4. Tạo file `docs/api-docs.md` & `docs/openapi.yaml`.
5. Cập nhật `docs/thay-doi-thiet-ke.md`, `docs/ai-disclosure.md`, `README.md`, `package.json`.
6. Chạy các lệnh kiểm thử và chụp ảnh minh chứng.
7. Tạo file báo cáo Word/PDF và gắn git tag `v1.0`.
