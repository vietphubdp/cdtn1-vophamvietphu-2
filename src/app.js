'use strict';

const path = require('path');
const express = require('express');
const { AppError, ErrorCode } = require('./errors/AppError');
const { createErrorMiddleware } = require('./presentation/controllers/ErrorMapper');

/**
 * Ghép các lớp thành ứng dụng Express, không chứa logic nghiệp vụ.
 * `deps` cho phép test truyền repository giả, không cần CSDL (D4).
 *
 * @param {object} [deps]
 * @param {object} [deps.repositories]   repository thật hoặc giả (dùng từ giai đoạn 1)
 * @param {Function} [deps.withTransaction] helper giao dịch (dùng từ giai đoạn 5)
 * @param {object} [deps.logger]         mặc định console
 */
function createApp(deps = {}) {
    const logger = deps.logger || console;
    const app = express();
    app.disable('x-powered-by'); // không lộ công nghệ máy chủ

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'presentation', 'views'));

    app.use(express.json());
    app.use('/public', express.static(path.join(__dirname, 'public')));

    // Smoke test: máy chủ đang chạy.
    app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
    });

    // Đường dẫn /api/* không tồn tại → lỗi đúng cấu trúc của contract.
    app.use('/api', (req, res, next) => {
        next(new AppError(ErrorCode.NOT_FOUND, `Không có endpoint ${req.method} ${req.originalUrl}. Xem danh sách endpoint trong docs/api-contract.md.`));
    });

    app.use(createErrorMiddleware(logger));
    return app;
}

module.exports = { createApp };
