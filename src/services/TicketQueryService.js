'use strict';

const { Role, TicketStatus } = require('../domain/constants');
const { assertRole } = require('./assertRole');
const { phoneForCaller } = require('./PhoneMasker');
const { toVietnamIsoString } = require('./vietnamTime');

// API 8 cả hai vai trò gọi được (api-contract mục 1, UC6).
const LIST_ROLES = [Role.TIEP_NHAN, Role.QUAN_LY_TRUNG_TAM];

// FR11 (Q9): chỉ phiếu Hoàn tất hoặc Đã đóng mới không bị tính quá hạn.
const CLOSED_STATUSES = [TicketStatus.HOAN_TAT, TicketStatus.DA_DONG];

const MESSAGES = Object.freeze({
    listForbidden: 'Bạn không có quyền xem danh sách phiếu.',
});

/**
 * FR11: phiếu quá hạn khi hạn cam kết sớm hơn thời điểm hiện tại và chưa Hoàn tất, Đã đóng.
 * Tính khi truy vấn, không lưu (bảng thuật ngữ SRS). Hạn đúng bằng `now` chưa quá hạn.
 *
 * @param {{ status: string, due_date: Date }} ticket
 * @param {Date} now
 */
function isOverdue(ticket, now) {
    return ticket.due_date.getTime() < now.getTime() && !CLOSED_STATUSES.includes(ticket.status);
}

/** Một dòng của danh sách (api-contract 3.8, khớp cột wireframe M3). */
function toTicketListItem(caller, ticket, now) {
    return {
        ticket_id: ticket.ticket_id,
        ticket_code: ticket.ticket_code,
        customer_name: ticket.customer_name,
        phone: phoneForCaller(caller, ticket.phone), // QT-15
        product_name: ticket.product_name,
        serial_no: ticket.serial_no,
        category_name: ticket.category_name, // null khi chưa phân loại
        priority: ticket.priority,
        warranty_status: ticket.warranty_status,
        status: ticket.status,
        received_at: toVietnamIsoString(ticket.received_at),
        due_date: toVietnamIsoString(ticket.due_date),
        is_overdue: isOverdue(ticket, now),
    };
}

/**
 * TicketQueryService (sơ đồ kiến trúc): danh sách phiếu – UC6 · API 8 · FR10, FR11 · QT-14, QT-15.
 * Tự kiểm vai trò (D3).
 *
 * @param {object} deps
 * @param {object} deps.ticketRepository có listByCenter, countByCenter
 */
function createTicketQueryService({ ticketRepository }) {
    return {
        /**
         * API 8 · UC6: một trang phiếu của trung tâm người gọi, sắp theo hạn cam kết (FR10).
         * QT-14: trung tâm luôn lấy từ JWT (`caller.center_id`), không nhận từ tham số.
         * Phân trang ở CSDL; trang vượt quá số phiếu trả items rỗng, total vẫn đúng.
         *
         * @param {object} caller { role, center_id, ... } từ JWT
         * @param {{ page: number, size: number }} paging đã qua validator
         * @param {Date} now thời điểm truy vấn, dùng cho cờ quá hạn (FR11)
         * @returns {{ items: object[], page: number, size: number, total: number }}
         */
        async listTickets(caller, { page, size }, now) {
            assertRole(caller, LIST_ROLES, MESSAGES.listForbidden);

            const centerId = caller.center_id;
            const [rows, total] = await Promise.all([
                ticketRepository.listByCenter(centerId, { limit: size, offset: (page - 1) * size }),
                ticketRepository.countByCenter(centerId),
            ]);

            return {
                items: rows.map((row) => toTicketListItem(caller, row, now)),
                page,
                size,
                total,
            };
        },
    };
}

module.exports = { createTicketQueryService, isOverdue, MESSAGES };
