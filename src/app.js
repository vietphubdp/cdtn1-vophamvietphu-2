'use strict';

const path = require('path');
const express = require('express');
const { AppError, ErrorCode } = require('./errors/AppError');
const { createErrorMiddleware } = require('./presentation/controllers/ErrorMapper');
const { createAuthService } = require('./services/AuthService');
const { createAuthController } = require('./presentation/controllers/AuthController');
const { createPageController } = require('./presentation/controllers/PageController');
const {
    createApiAuthMiddleware,
    createPageAuthMiddleware,
} = require('./presentation/controllers/AuthMiddleware');

/**
 * Ghép các lớp thành ứng dụng Express, không chứa logic nghiệp vụ.
 * `deps` cho phép test truyền repository giả, không cần CSDL (D4).
 *
 * @param {object} deps
 * @param {object} deps.repositories     repository thật hoặc giả: { employee }
 * @param {object} deps.jwt              { secret, expiresIn }
 * @param {Function} [deps.withTransaction] helper giao dịch (dùng từ giai đoạn 5)
 * @param {Function} [deps.now]          đồng hồ, mặc định () => new Date(); test truyền giờ cố định
 * @param {object} [deps.logger]         mặc định console
 */
function createApp(deps) {
    const logger = deps.logger || console;
    const now = deps.now || (() => new Date());
    const { repositories } = deps;

    const authService = createAuthService({ employeeRepository: repositories.employee, jwt: deps.jwt });

    const authController = createAuthController({ authService, now });
    const pageController = createPageController({ authService, now });
    const requireApiLogin = createApiAuthMiddleware({ authService, now });
    const requirePageLogin = createPageAuthMiddleware({ authService, now });

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

    // Trang EJS
    app.get('/login', pageController.login);
    app.get('/', requirePageLogin, pageController.home);

    // API 9, 10 không cần JWT (api-contract mục 2).
    app.post('/api/auth/login', authController.login);
    app.post('/api/auth/logout', authController.logout);

    // Mọi /api/* còn lại cần JWT hợp lệ; thiếu hoặc hết hạn → 401.
    app.use('/api', requireApiLogin);

    // Đường dẫn /api/* không tồn tại → lỗi đúng cấu trúc của contract.
    app.use('/api', (req, res, next) => {
        next(new AppError(ErrorCode.NOT_FOUND, `Không có endpoint ${req.method} ${req.originalUrl}. Xem danh sách endpoint trong docs/api-contract.md.`));
    });

    app.use(createErrorMiddleware(logger));
    return app;
}

module.exports = { createApp };
