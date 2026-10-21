'use strict';

const { RoleLabel } = require('../../domain/constants');
const { readTokenCookie } = require('./authCookie');

/**
 * Chỉ render khung trang EJS; dữ liệu trên trang lấy qua API JSON bằng api-client.js.
 * Thanh tiêu đề lấy tên trung tâm, họ tên, vai trò từ JWT (req.caller), không tra CSDL (D5).
 */
function createPageController({ authService, now }) {
    return {
        /** Trang đăng nhập. Đã đăng nhập (JWT còn hạn) thì về trang chủ. */
        login(req, res) {
            try {
                authService.verifyToken(readTokenCookie(req), now());
                return res.redirect('/');
            } catch {
                return res.render('login');
            }
        },

        /** Trang chủ tạm (GĐ 1): chỉ có thanh tiêu đề. GĐ 7–8 đổi thành chuyển tới M1/M3 theo vai trò. */
        home(req, res) {
            res.render('home', { caller: req.caller, roleLabel: RoleLabel[req.caller.role] });
        },
    };
}

module.exports = { createPageController };
