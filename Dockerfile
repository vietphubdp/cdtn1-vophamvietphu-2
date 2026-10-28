# Ảnh máy chủ web Smart CRM – L2, hai giai đoạn (README mục 3, cách B; TĐ-16).
# node:20-slim (Debian) khớp engines >=20; bcrypt và Tailwind CLI có sẵn bản dựng cho glibc.

# ---------- Giai đoạn 1: cài thư viện, dựng CSS ----------
FROM node:20-slim AS build
WORKDIR /app

# Chép tệp khóa trước để Docker giữ lớp cache khi chỉ sửa code.
# Cần cả devDependencies vì Tailwind CLI dựng CSS ở bước này (UI1).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Dựng CSS xong thì bỏ devDependencies: ảnh chạy không chứa Tailwind, Jest.
RUN npm run build:css && npm prune --omit=dev

# ---------- Giai đoạn 2: ảnh chạy ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Chỉ chép thứ máy chủ và migrate/seed cần; không có .env, tests, docs, data/raw.
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/db ./db
COPY --from=build /app/data/sample ./data/sample

# Chạy bằng người dùng không đặc quyền `node` có sẵn trong ảnh nền.
USER node
EXPOSE 3000

# Compose dựa vào đây để biết máy chủ đã thật sự nhận yêu cầu, không chỉ container đã chạy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
    CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Mỗi lần khởi động: migrate + seed (chạy lại không lỗi, không nhân đôi – C5) rồi chạy máy chủ.
# `exec` thay tiến trình sh bằng node (PID 1) để node nhận SIGTERM khi docker stop (BUG-003).
CMD ["sh", "-c", "node db/migrate.js && node db/seed.js && exec node src/server.js"]
