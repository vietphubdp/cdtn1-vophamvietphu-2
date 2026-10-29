'use strict';

const EDIT_LOG_COLUMNS = 'edit_id, ticket_id, changed_at, changed_by, changes, reason';

/**
 * Đọc/ghi bảng ticket_edit_log (lịch sử sửa phiếu QT-16, quyết định bảo hành QT-17). Chỉ ghi thêm:
 * lịch sử không bao giờ bị sửa hay xóa. Cột JSONB `changes` đọc ra object.
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createTicketEditLogRepository(pool) {
    return {
        /** Thêm một dòng lịch sử sửa, trả dòng vừa tạo. changed_at do service truyền vào. */
        async create({ ticket_id, changed_at, changed_by, changes, reason }, tx) {
            const db = tx || pool;
            const result = await db.query(
                `INSERT INTO ticket_edit_log (ticket_id, changed_at, changed_by, changes, reason)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING ${EDIT_LOG_COLUMNS}`,
                [ticket_id, changed_at, changed_by, JSON.stringify(changes), reason],
            );
            return result.rows[0];
        },

        /** Lịch sử sửa của một phiếu, cũ trước mới sau, kèm họ tên người sửa (API 18). */
        async listByTicket(ticketId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT l.edit_id, l.changed_at, e.full_name AS changed_by_name, l.changes, l.reason
                   FROM ticket_edit_log l
                   JOIN employee e ON e.employee_id = l.changed_by
                  WHERE l.ticket_id = $1
                  ORDER BY l.changed_at, l.edit_id`,
                [ticketId],
            );
            return result.rows;
        },
    };
}

module.exports = { createTicketEditLogRepository };
