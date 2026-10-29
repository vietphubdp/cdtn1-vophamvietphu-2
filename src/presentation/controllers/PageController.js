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

// Mã phiếu trên đường dẫn M4: chỉ chữ số. Sai thì về M3 thay vì render trang cho mã không có.
const TICKET_ID_PATTERN = /^[1-9][0-9]{0,15}$/;

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

        /**
         * M2 – Tạo khách hàng mới / Ghi nhận thiết bị mới (UC2, UC3). Chỉ mở từ M1 nên sidebar vẫn sáng mục M1.
         * Tham số ?phone=, ?customer_id= do M1 truyền (3a, 4a) được đọc bằng customer-create.js, không đọc ở đây.
         * M1, M2 chỉ dành cho Tiếp nhận (wireframe) → Quản lý chuyển về M3.
         */
        customerCreate(req, res) {
            if (!canCreateTicket(req.caller)) return res.redirect(PAGE_PATH.M3);
            return res.render('customer-create', layoutLocals(req.caller, 'M1'));
        },

        /** M3 – Danh sách phiếu của trung tâm (UC6) cho cả hai vai trò; trang và số trang do ticket-list.js đọc từ ?page=. */
        ticketList(req, res) {
            res.render('ticket-list', layoutLocals(req.caller, 'M3'));
        },

        /**
         * M4 – Chi tiết phiếu: sửa phiếu (QT-16) cho cả hai vai trò; hủy phiếu (QT-06), quyết định bảo hành (QT-17)
         * cho Quản lý. Chỉ mở từ M3 nên sidebar vẫn sáng mục M3. Dữ liệu và quyền thao tác lấy qua API 18.
         */
        ticketDetail(req, res) {
            if (!TICKET_ID_PATTERN.test(req.params.id)) return res.redirect(PAGE_PATH.M3);
            return res.render('ticket-detail', { ...layoutLocals(req.caller, 'M3'), ticketId: req.params.id });
        },
    };
}

module.exports = { createPageController, PAGE_PATH };
