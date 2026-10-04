# cdtn1-vophamvietphu-2

# <Tên phạm vi bằng một câu>

Sinh viên:
Võ Phạm Việt Phú - 2374802010391 - Track SE
Học phần:
Chuyên đề Tốt nghiệp 1, HK1 2026-2027
Luồng nghiệp vụ:
L2 – Tiếp nhận và phân loại yêu cầu bảo hành

## 1. Mục tiêu

Hệ thống này giải quyết các vấn đề cho nhân viên tiếp nhận và quản lý trung tâm cho các vấn đề:
Yêu cầu bảo hành được ghi trên phiếu giấy, mỗi trung tâm lưu một cách.
Mô tả lỗi do khách kể được ghi tự do bằng chữ, không phân nhóm.

## 2. Yêu cầu môi trường

Node.js 20 LTS (hoặc: Python 3.11 / JDK 21)
PostgreSQL 16
Biến môi trường: xem .env.example

## 3. Hướng dẫn chạy

(BT2 yêu cầu ≤ 4 bước)
cp .env.example .env và điền giá trị
npm install
npm run db:migrate
npm run dev → mở http://localhost:3000/health

## 4. Cấu trúc thư mục

Giải thích ngắn mỗi thư mục làm gì.

## 5. Kiểm thử

npm test → hiển thị số test PASS

## 6. Trạng thái hiện tại

 Khởi tạo project, smoke test chạy được (buổi 2)
□ Module tiếp nhận yêu cầu (buổi 8–10)
□ Module phân công kỹ thuật viên (buổi 10–12)
