'use strict';

const { readTokenCookie } = require('./authCookie');

/**
 * AuthMiddleware cho /api/*: chỉ xác thực JWT và gắn `req.caller` (D3).
 * Thiếu, sai hoặc hết hạn → AuthService ném UNAUTHENTICATED → ErrorMapper trả 401.
 * Không kiểm vai trò: service của từng chức năng tự kiểm và ném FORBIDDEN (D3).
 */
function createApiAuthMiddleware({ authService, now }) {
    return function apiAuthMiddleware(req, res, next) {
        req.caller = authService.verifyToken(readTokenCookie(req), now());
        next();
    };
}

/**
 * Bản cho trang EJS: chưa đăng nhập thì chuyển về trang đăng nhập thay vì trả JSON 401.
 */
function createPageAuthMiddleware({ authService, now }) {
    return function pageAuthMiddleware(req, res, next) {
        try {
            req.caller = authService.verifyToken(readTokenCookie(req), now());
        } catch {
            return res.redirect('/login');
        }
        return next();
    };
}

module.exports = { createApiAuthMiddleware, createPageAuthMiddleware };
