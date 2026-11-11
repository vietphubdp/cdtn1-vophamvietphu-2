# Ảnh máy chủ web Smart CRM – L2, phục vụ đóng gói và kiểm thử BT3 (README mục 3, cách B; TĐ-16).
# node:20-slim (Debian) khớp engines >=20; bcrypt có sẵn bản dựng cho glibc.

# ---------- Giai đoạn 1: cài thư viện, dựng CSS ----------
FROM node:20-slim AS build
WORKDIR /app

# Chép tệp khóa trước để Docker giữ lớp cache khi chỉ sửa code.
# Cần cả devDependencies vì Tailwind CLI dựng CSS ở bước này (UI1) và Jest chạy test trong container (BT3).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Dựng CSS xong bằng Tailwind CLI
RUN npm run build:css

# ---------- Giai đoạn 2: ảnh chạy và kiểm thử ----------
FROM node:20-slim AS runtime
WORKDIR /app

# Sao chép các tệp cần thiết; giữ node_modules và thư mục tests để chạy `docker compose exec app npm test` (BT3 Slide 15-16).
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/db ./db
COPY --from=build /app/data/sample ./data/sample
COPY --from=build /app/tests ./tests
COPY --from=build /app/jest.system.config.js ./

# Chạy bằng người dùng không đặc quyền `node` có sẵn trong ảnh nền.
USER node
EXPOSE 3000

# Compose dựa vào đây để biết máy chủ đã thật sự nhận yêu cầu, không chỉ container đã chạy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
    CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Mỗi lần khởi động: migrate + seed (chạy lại không lỗi, không nhân đôi – C8) rồi chạy máy chủ.
# `exec` thay tiến trình sh bằng node (PID 1) để node nhận SIGTERM khi docker stop (BUG-003).
CMD ["sh", "-c", "node db/migrate.js && node db/seed.js && exec node src/server.js"]
