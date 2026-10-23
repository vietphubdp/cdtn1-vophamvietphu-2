'use strict';

const { RoleLabel } = require('../../domain/constants');
const { canCreateTicket } = require('../../services/TicketService');
const { readTokenCookie } = require('./authCookie');

// Đường dẫn các trang. M2 chỉ mở từ M1 (ngoại lệ 3a, 4a).
const PAGE_PATH = Object.freeze({
    M1: '/tickets/new',
    M2: '/customers/new',
    M3: '/tickets',
});

/**
 * Chỉ render khung trang EJS; dữ liệu trên trang lấy qua API JSON bằng api-client.js.
 * Navbar, sidebar lấy tên trung tâm, họ tên, vai trò từ JWT (req.caller), không tra CSDL (D5).
 * Ai được lập phiếu do TicketService.canCreateTicket quyết định (cùng quy tắc với API 7).
 */
function createPageController({ authService, now }) {
    /** Biến chung cho navbar, sidebar (UI5). */
    function layoutLocals(caller, active) {
        return {
            caller,
            roleLabel: RoleLabel[caller.role],
            active,
            canCreateTicket: canCreateTicket(caller),
        };
    }

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

        /** Trang chủ: Tiếp nhận vào M1, Quản lý trung tâm vào M3. */
        home(req, res) {
            res.redirect(canCreateTicket(req.caller) ? PAGE_PATH.M1 : PAGE_PATH.M3);
        },

        /** M1 – Lập phiếu bảo hành (UC5). Quản lý không dùng M1 → chuyển về M3 (wireframe.drawio). */
        ticketCreate(req, res) {
            if (!canCreateTicket(req.caller)) return res.redirect(PAGE_PATH.M3);
            return res.render('ticket-create', layoutLocals(req.caller, 'M1'));
        },

        /** M2 – Tạo khách / ghi nhận thiết bị: làm ở GĐ 8, tạm hiện trang chờ để liên kết 3a, 4a của M1 không lỗi. */
        customerCreate(req, res) {
            if (!canCreateTicket(req.caller)) return res.redirect(PAGE_PATH.M3);
            return res.render('coming-soon', { ...layoutLocals(req.caller, 'M1'), title: 'Tạo khách hàng mới / Ghi nhận thiết bị mới', screen: 'M2', backPath: PAGE_PATH.M1 });
        },

        /** M3 – Danh sách phiếu: làm ở GĐ 8, tạm hiện trang chờ. */
        ticketList(req, res) {
            res.render('coming-soon', { ...layoutLocals(req.caller, 'M3'), title: 'Danh sách phiếu của trung tâm', screen: 'M3', backPath: null });
        },
    };
}

module.exports = { createPageController, PAGE_PATH };
