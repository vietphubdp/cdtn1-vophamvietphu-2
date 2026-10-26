# Ảnh máy chủ web Smart CRM – L2. Dùng cùng docker-compose.yml (README mục 3, cách B).
# node:20-slim (Debian) khớp engines >=20; bcrypt và Tailwind CLI có sẵn bản dựng cho glibc.
FROM node:20-slim

WORKDIR /app

# Cài theo package-lock.json trước để Docker giữ lớp cache khi chỉ sửa code.
# Cần cả devDependencies vì Tailwind CLI dựng CSS ngay trong ảnh (UI1).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:css

ENV NODE_ENV=production
EXPOSE 3000

# Mỗi lần khởi động: migrate + seed (chạy lại không lỗi, không nhân đôi – C5) rồi chạy máy chủ.
# Gọi node trực tiếp thay cho npm start để không dựng CSS lại lần nữa.
CMD ["sh", "-c", "npm run setup && node src/server.js"]
