'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');
const { Role, TicketStatus } = require('../domain/constants');
const { assertRole } = require('./assertRole');
const { canEditTicket, canCancelTicket, canDecideWarranty } = require('./TicketUpdateService');
const { phoneForCaller } = require('./PhoneMasker');
const { toVietnamIsoString } = require('./vietnamTime');

// API 8 cả hai vai trò gọi được (api-contract mục 1, UC6).
const LIST_ROLES = [Role.TIEP_NHAN, Role.QUAN_LY_TRUNG_TAM];

// FR11: phiếu Hoàn tất, Đã đóng, Đã hủy không bị tính quá hạn. Đã hủy thêm ở TĐ-03 vì Quản lý hủy được phiếu
// (trước đó L2 không có phiếu Đã hủy nên Q9 chỉ loại hai trạng thái).
const CLOSED_STATUSES = [TicketStatus.HOAN_TAT, TicketStatus.DA_DONG, TicketStatus.DA_HUY];

const MESSAGES = Object.freeze({
    listForbidden: 'Bạn không có quyền xem danh sách phiếu.',
    ticketNotFound: 'Không tìm thấy phiếu bảo hành trong trung tâm của bạn',
});

/**
 * FR11: phiếu quá hạn khi hạn cam kết sớm hơn thời điểm hiện tại và chưa Hoàn tất, Đã đóng, Đã hủy.
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

/** Chi tiết một phiếu kèm lịch sử và các thao tác người gọi được làm (API 18, TĐ-02, TĐ-03). */
function toTicketDetail(caller, ticket, statusLogs, editLogs, now) {
    return {
        ticket_id: ticket.ticket_id,
        ticket_code: ticket.ticket_code,
        customer_id: ticket.customer_id,
        customer_name: ticket.customer_name,
        phone: phoneForCaller(caller, ticket.phone), // QT-15
        device_id: ticket.device_id,
        product_name: ticket.product_name,
        serial_no: ticket.serial_no,
        category_id: ticket.category_id,
        category_name: ticket.category_name,
        issue_desc: ticket.issue_desc,
        priority: ticket.priority,
        status: ticket.status,
        warranty_status: ticket.warranty_status,
        received_at: toVietnamIsoString(ticket.received_at),
        due_date: toVietnamIsoString(ticket.due_date),
        is_overdue: isOverdue(ticket, now),
        // Giao diện chỉ ẩn/hiện nút theo ba cờ này; quy tắc nằm ở TicketUpdateService (QT-06, QT-16, QT-17).
        can_edit: canEditTicket(caller, ticket),
        can_cancel: canCancelTicket(caller, ticket),
        can_decide_warranty: canDecideWarranty(caller, ticket),
        status_history: statusLogs.map((log) => ({
            from_status: log.from_status,
            to_status: log.to_status,
            changed_at: toVietnamIsoString(log.changed_at),
            changed_by_name: log.changed_by_name,
            note: log.note,
        })),
        edit_history: editLogs.map((log) => ({
            changed_at: toVietnamIsoString(log.changed_at),
            changed_by_name: log.changed_by_name,
            changes: log.changes,
            reason: log.reason,
        })),
    };
}

/**
 * TicketQueryService (sơ đồ kiến trúc): danh sách phiếu – UC6 · API 8 · FR10, FR11 · QT-14, QT-15.
 * Tự kiểm vai trò (D3).
 *
 * @param {object} deps
 * @param {object} deps.ticketRepository          có listByCenter, countByCenter, findDetailById
 * @param {object} [deps.ticketStatusLogRepository] có listByTicket (API 18)
 * @param {object} [deps.ticketEditLogRepository]   có listByTicket (API 18)
 */
function createTicketQueryService({ ticketRepository, ticketStatusLogRepository, ticketEditLogRepository }) {
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

        /**
         * API 18: chi tiết một phiếu kèm lịch sử trạng thái, lịch sử sửa và cờ thao tác được phép.
         * QT-14: phiếu không có hoặc thuộc trung tâm khác đều trả NOT_FOUND (không lộ phiếu trung tâm khác).
         *
         * @param {object} caller
         * @param {number} ticketId đã qua validator
         * @param {Date} now cho cờ quá hạn (FR11)
         */
        async getTicketDetail(caller, ticketId, now) {
            assertRole(caller, LIST_ROLES, MESSAGES.listForbidden);

            const ticket = await ticketRepository.findDetailById(ticketId);
            if (!ticket || ticket.center_id !== caller.center_id) {
                throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.ticketNotFound);
            }
            const [statusLogs, editLogs] = await Promise.all([
                ticketStatusLogRepository.listByTicket(ticketId),
                ticketEditLogRepository.listByTicket(ticketId),
            ]);
            return toTicketDetail(caller, ticket, statusLogs, editLogs, now);
        },
    };
}

module.exports = { createTicketQueryService, isOverdue, MESSAGES };
