'use strict';

const LOG_COLUMNS = 'log_id, ticket_id, from_status, to_status, changed_at, changed_by, note';

/**
 * Đọc/ghi bảng ticket_status_log (lịch sử trạng thái phiếu, QT-06). Chỉ ghi thêm:
 * lịch sử không bao giờ bị sửa hay xóa.
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createTicketStatusLogRepository(pool) {
    return {
        /** Thêm một dòng lịch sử, trả dòng vừa tạo. changed_at do service truyền vào. */
        async create({ ticket_id, from_status, to_status, changed_at, changed_by, note }, tx) {
            const db = tx || pool;
            const result = await db.query(
                `INSERT INTO ticket_status_log (ticket_id, from_status, to_status, changed_at, changed_by, note)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING ${LOG_COLUMNS}`,
                [ticket_id, from_status, to_status, changed_at, changed_by, note],
            );
            return result.rows[0];
        },

        /** Lịch sử trạng thái của một phiếu, cũ trước mới sau, kèm họ tên người thực hiện (API 18). */
        async listByTicket(ticketId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT l.log_id, l.from_status, l.to_status, l.changed_at, e.full_name AS changed_by_name, l.note
                   FROM ticket_status_log l
                   JOIN employee e ON e.employee_id = l.changed_by
                  WHERE l.ticket_id = $1
                  ORDER BY l.changed_at, l.log_id`,
                [ticketId],
            );
            return result.rows;
        },
    };
}

module.exports = { createTicketStatusLogRepository };
