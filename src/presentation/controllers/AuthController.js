'use strict';

const { validateLogin } = require('../validators/authValidator');
const { TOKEN_COOKIE, TOKEN_COOKIE_OPTIONS } = require('./authCookie');

/** API 9, 10 (HT1): chỉ dịch HTTP ↔ AuthService. Lỗi chuyển cho ErrorMapper. */
function createAuthController({ authService, now }) {
    return {
        /** POST /api/auth/login → 200 + Set-Cookie token (api-contract 3.9). */
        async login(req, res) {
            const credentials = validateLogin(req.body);
            const { token, caller } = await authService.login(credentials, now());
            res.cookie(TOKEN_COOKIE, token, TOKEN_COOKIE_OPTIONS);
            res.status(200).json(caller);
        },

        /** POST /api/auth/logout → 204, xóa cookie bằng Max-Age=0; chưa đăng nhập cũng 204 (Q7, 3.10). */
        logout(req, res) {
            res.cookie(TOKEN_COOKIE, '', { ...TOKEN_COOKIE_OPTIONS, maxAge: 0 });
            res.status(204).end();
        },
    };
}

module.exports = { createAuthController };
