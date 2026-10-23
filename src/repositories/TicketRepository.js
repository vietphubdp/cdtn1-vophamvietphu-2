'use strict';

const { rethrowAsDuplicateKey } = require('./db');

const TICKET_COLUMNS = `ticket_id, ticket_code, customer_id, device_id, center_id, category_id, issue_desc,
       priority, status, warranty_status, received_at, due_date, idempotency_key`;

/**
 * Đọc/ghi bảng ticket. Chỉ đọc/ghi, không có quy tắc nghiệp vụ.
 * Không có hàm xóa (QT-13). received_at, due_date đọc ra Date.
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createTicketRepository(pool) {
    return {
        /** Số tiếp theo của sequence chung cho mã phiếu (Q11). */
        async nextCodeNumber(tx) {
            const db = tx || pool;
            const result = await db.query(`SELECT nextval('ticket_code_seq') AS value`);
            return result.rows[0].value;
        },

        /**
         * Thêm một phiếu với đủ giá trị service truyền vào (kể cả received_at, status:
         * không dựa vào DEFAULT của CSDL). Trùng UNIQUE (idempotency_key, ticket_code) → DuplicateKeyError.
         */
        async create(ticket, tx) {
            const db = tx || pool;
            const result = await db
                .query(
                    `INSERT INTO ticket (ticket_code, customer_id, device_id, center_id, category_id, issue_desc,
                                         priority, status, warranty_status, received_at, due_date, idempotency_key)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                     RETURNING ${TICKET_COLUMNS}`,
                    [
                        ticket.ticket_code,
                        ticket.customer_id,
                        ticket.device_id,
                        ticket.center_id,
                        ticket.category_id,
                        ticket.issue_desc,
                        ticket.priority,
                        ticket.status,
                        ticket.warranty_status,
                        ticket.received_at,
                        ticket.due_date,
                        ticket.idempotency_key,
                    ],
                )
                .catch(rethrowAsDuplicateKey);
            return result.rows[0];
        },

        /** Phiếu đã lập với khóa chống trùng này (NFR4); không có → null. */
        async findByIdempotencyKey(idempotencyKey, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT ${TICKET_COLUMNS}
                   FROM ticket
                  WHERE idempotency_key = $1`,
                [idempotencyKey],
            );
            return result.rows[0] || null;
        },
    };
}

module.exports = { createTicketRepository };
