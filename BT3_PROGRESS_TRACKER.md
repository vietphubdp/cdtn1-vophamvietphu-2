# HỒ SƠ THEO DÕI TIẾN ĐỘ BÀI TẬP 3 (BT3) – CHUYÊN ĐỀ TỐT NGHIỆP 1

> **MỤC ĐÍCH TỆP NÀY:**  
> Tệp này là **kim chỉ nam duy nhất** lưu trữ toàn bộ ngữ cảnh, yêu cầu, tiến độ và các bước thực hiện của dự án.  
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
- **Kho GitHub:** `https://github.com/vietphubdp/cdtn1-vophamvietphu-2` (**PUBLIC**, đã gắn Tag `v1.0`)
- **Git Tag bài nộp:** `v1.0` (commit `9624ab9`)
- **File nộp trên VLU E-learning:** `BT3_2374802010391_VoPhamVietPhu.pdf` (kèm file Word `.docx`)

---

## 2. QUY CHUẨN ĐÁNH GIÁ BÀI TẬP 3 (10% ĐIỂM HỌC PHẦN)
*(Căn cứ theo Slide Buổi 15, Buổi 16 và Tài liệu tự học Buổi 13, 15)*

### 2.1. Sáu thành phần bắt buộc trong Repo (Tag `v1.0`)
1. **TP1 – Test Plan:** Rút gọn 4 mục (Phạm vi, Loại test & số lượng, Tiêu chí thành công, Môi trường & dữ liệu thử) tại `docs/test-plan.md`.
2. **TP2 – Test Report:** 12 test case đủ 8 cột, đủ 5 loại (luồng đúng, biên, dữ liệu sai, bảo mật/chất lượng dữ liệu, tái lập), có kết quả CHẠY THẬT trên PostgreSQL tại `docs/test-report.md`.
3. **TP3 – Bug Log:** 3 bug ($\ge$ 1 Critical / Major), mỗi bug đủ 7 dòng, có link commit GitHub trỏ đúng tại `docs/bug-log.md`.
4. **TP4 – Gói đóng gói:** Dựng lại được bằng $\le$ 2 lệnh từ thư mục trống (`cp .env.example .env && docker compose up -d --build`). Chạy được `docker compose exec app npm test`.
5. **TP5 – Deployment Guide & Checklist bảo mật:**
   - Deployment Guide tiếng Anh đủ 5 mục bắt buộc (Requirements, Setup steps, Environment variables, Sample data, Verify it works) + Mục 6 Alerts (ALERT-01, ALERT-02) + Mục 7 HTTPS & Production + Mục 8 Troubleshooting tại `docs/deployment-guide.md`.
   - Checklist bảo mật 7 mục OWASP Top 10:2025, tất cả ĐÃ LÀM, mỗi mục có một dòng minh chứng thực tế tại `docs/checklist-bao-mat.md`.
6. **TP6 – Tài liệu kỹ thuật tiếng Anh (Track SE):** API Docs tiếng Anh bao quát toàn bộ 21 endpoints, mỗi endpoint đủ 7 mục kèm ví dụ JSON chạy thật (`docs/api-docs.md`) + file đặc tả chuẩn OpenAPI 3.0.3 (`docs/openapi.yaml`).

### 2.2. Chín tiêu chí kỹ thuật (C1 – C9) - TẤT CẢ ĐÃ ĐẠT 100%
- **C1 (CỐT LÕI - ĐẠT):** Gói dựng lại được từ thư mục trống bằng $\le$ 2 lệnh, theo đúng Deployment Guide, không hỏi sinh viên câu nào.
- **C2 (CỐT LÕI - ĐẠT):** Test Report 12 test case đủ 8 cột, đủ 5 loại trên CSDL PostgreSQL thật.
- **C3 (CỐT LÕI - ĐẠT):** Bộ test PASS bằng 1 lệnh (`npm test` 505/505 PASS, `npm run test:system` 12/12 PASS); 1 test case chọn ngẫu nhiên chạy lại được tại chỗ.
- **C4 (CỐT LÕI - ĐẠT):** Bug Log 3 bug (1 Critical, 1 Major, 1 Minor), mỗi bug 7 dòng, link commit GitHub mở được.
- **C5 (ĐẠT):** Deployment Guide đủ 5 mục chuẩn tiếng Anh, có mục "Verify it works".
- **C6 (ĐẠT):** Checklist bảo mật 7 mục đã điền đủ "ĐÃ LÀM", mỗi mục có minh chứng cụ thể.
- **C7 (ĐẠT):** Không có secret nào trong repo; `.env` chưa từng bị commit vào lịch sử Git (`git log --all --oneline -- .env` rỗng hoàn toàn).
- **C8 (ĐẠT):** Chạy lại lần thứ 2 (`migrate` + `seed`) không lỗi, không nhân đôi dữ liệu (idempotent).
- **C9 (ĐẠT):** Tài liệu kỹ thuật theo track SE mô tả đúng hệ thống thật, không mô tả tính năng chưa có.

---

## 3. BẢNG THEO DÕI TIẾN ĐỘ CÁC CÔNG VIỆC

| STT | Hạng mục công việc | Tệp liên quan | Trạng thái | Ghi chú & Chi tiết kỹ thuật |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Rà soát & Sửa `Dockerfile`** | `cdtn1-vophamvietphu-2/Dockerfile` | ✅ HOÀN THÀNH | Đã giữ `node_modules` và thư mục `tests/` trong runtime image. Lệnh `docker compose exec app npm test` chạy hoàn hảo trong container. |
| **2** | **Biên soạn `deployment-guide.md`** | `cdtn1-vophamvietphu-2/docs/deployment-guide.md` | ✅ HOÀN THÀNH | Viết bằng tiếng Anh chuẩn. Đủ 5 mục bắt buộc + Mục 6 Giám sát (ALERT-01 & ALERT-02) + Mục 7 HTTPS + Mục 8 Troubleshooting. |
| **3** | **Biên soạn `checklist-bao-mat.md`** | `cdtn1-vophamvietphu-2/docs/checklist-bao-mat.md` | ✅ HOÀN THÀNH | Đủ 7 mục OWASP Top 10:2025. Tất cả trạng thái ĐÃ LÀM kèm lệnh grep/kết quả test thực tế. |
| **4** | **Biên soạn `api-docs.md` (Track SE)** | `cdtn1-vophamvietphu-2/docs/api-docs.md` | ✅ HOÀN THÀNH | Viết bằng tiếng Anh, bao quát 21 endpoints của L2. Mỗi endpoint đủ 7 mục kèm payload JSON thật từ hệ thống chạy thực tế. |
| **5** | **Tạo file đặc tả `openapi.yaml`** | `cdtn1-vophamvietphu-2/docs/openapi.yaml` | ✅ HOÀN THÀNH | Chuẩn OpenAPI 3.0.3, hợp lệ, mô tả chính xác toàn bộ 21 endpoints. |
| **6** | **Tạo Báo cáo BT3 Word & xuất PDF** | `BT3_2374802010391_VoPhamVietPhu.docx / .pdf` | ✅ HOÀN THÀNH | Đã biên soạn file Word 832 KB chuẩn format Đại học Văn Lang và xuất PDF 20 trang (1.1 MB) có đầy đủ ảnh chụp minh chứng. |
| **7** | **Git Commit & Gắn Tag `v1.0`** | Git repository | ✅ HOÀN THÀNH | Commit `9624ab9`: `feat(bt3): hoan thien dong goi Docker, them Deployment Guide, Checklist bao mat, API docs va OpenAPI spec`. Tag `v1.0` đã được tạo và đẩy lên remote GitHub. |
| **8** | **Đẩy lên GitHub Remote** | GitHub Repo `vietphubdp/cdtn1-vophamvietphu-2` | ✅ HOÀN THÀNH | Đã `git push origin main` và `git push origin v1.0` thành công 100%. Repo ở trạng thái sạch (clean). |

---

## 4. DANH SÁCH TÀI LIỆU VÀ SẢN PHẨM BÀN GIAO HOÀN CHỈNH

1. **File Báo cáo nộp bài trên VLU E-learning:**
   - PDF chính thức: `D:\Docs\ChuyenDeTotNghiep1\BT3_2374802010391_VoPhamVietPhu.pdf` (20 trang, 1.1 MB)
   - Source Word: `D:\Docs\ChuyenDeTotNghiep1\BT3_2374802010391_VoPhamVietPhu.docx` (832 KB)
2. **Kho mã nguồn & Release:**
   - Repo URL: `https://github.com/vietphubdp/cdtn1-vophamvietphu-2`
   - Release Tag: `https://github.com/vietphubdp/cdtn1-vophamvietphu-2/releases/tag/v1.0`
3. **Các tài liệu mới trong repo phục vụ BT3:**
   - `docs/deployment-guide.md`
   - `docs/checklist-bao-mat.md`
   - `docs/api-docs.md`
   - `docs/openapi.yaml`
   - `.github/workflows/ci.yml`
