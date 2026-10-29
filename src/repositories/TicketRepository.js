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

        /**
         * Một trang phiếu của một trung tâm kèm tên khách, số điện thoại (chưa che), tên máy, serial,
         * tên nhóm sự cố (api-contract 3.8). Sắp due_date rồi ticket_id tăng dần để phân trang ổn định;
         * dùng index idx_ticket_center_due. Phiếu chưa phân loại có category_name = null (LEFT JOIN).
         */
        async listByCenter(centerId, { limit, offset }, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT t.ticket_id, t.ticket_code, c.full_name AS customer_name, c.phone,
                        p.product_name, d.serial_no, ic.category_name, t.priority,
                        t.warranty_status, t.status, t.received_at, t.due_date
                   FROM ticket t
                   JOIN customer c ON c.customer_id = t.customer_id
                   JOIN device d ON d.device_id = t.device_id
                   JOIN product p ON p.product_id = d.product_id
                   LEFT JOIN issue_category ic ON ic.category_id = t.category_id
                  WHERE t.center_id = $1
                  ORDER BY t.due_date, t.ticket_id
                  LIMIT $2 OFFSET $3`,
                [centerId, limit, offset],
            );
            return result.rows;
        },

        /**
         * Một phiếu kèm tên khách, số điện thoại (chưa che), tên máy, serial, tên nhóm sự cố (API 18).
         * Không lọc trung tâm: TicketQueryService so trung tâm với người gọi (QT-14). Không có → null.
         */
        async findDetailById(ticketId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT t.ticket_id, t.ticket_code, t.customer_id, c.full_name AS customer_name, c.phone,
                        t.device_id, p.product_name, d.serial_no, t.center_id, t.category_id, ic.category_name,
                        t.issue_desc, t.priority, t.status, t.warranty_status, t.received_at, t.due_date
                   FROM ticket t
                   JOIN customer c ON c.customer_id = t.customer_id
                   JOIN device d ON d.device_id = t.device_id
                   JOIN product p ON p.product_id = d.product_id
                   LEFT JOIN issue_category ic ON ic.category_id = t.category_id
                  WHERE t.ticket_id = $1`,
                [ticketId],
            );
            return result.rows[0] || null;
        },

        /**
         * Đọc phiếu và khóa dòng tới hết giao dịch (SELECT … FOR UPDATE) để hai người sửa, hủy cùng
         * một phiếu không ghi đè nhau: người sau chờ người trước commit rồi đọc bản mới. Cần `tx`.
         */
        async findByIdForUpdate(ticketId, tx) {
            const result = await tx.query(
                `SELECT ${TICKET_COLUMNS}
                   FROM ticket
                  WHERE ticket_id = $1
                    FOR UPDATE`,
                [ticketId],
            );
            return result.rows[0] || null;
        },

        /**
         * Ghi các cột được phép đổi sau khi lập (API 19–21). Service truyền đủ giá trị mới của cả 7 cột;
         * mã phiếu, khách, trung tâm, thời điểm tiếp nhận, khóa chống trùng không bao giờ đổi.
         */
        async update(ticketId, ticket, tx) {
            const db = tx || pool;
            const result = await db.query(
                `UPDATE ticket
                    SET device_id = $2, category_id = $3, issue_desc = $4, priority = $5,
                        status = $6, warranty_status = $7, due_date = $8
                  WHERE ticket_id = $1
                 RETURNING ${TICKET_COLUMNS}`,
                [
                    ticketId,
                    ticket.device_id,
                    ticket.category_id,
                    ticket.issue_desc,
                    ticket.priority,
                    ticket.status,
                    ticket.warranty_status,
                    ticket.due_date,
                ],
            );
            return result.rows[0];
        },

        /** Tổng số phiếu của một trung tâm (trường `total` của API 8). */
        async countByCenter(centerId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT count(*) AS total
                   FROM ticket
                  WHERE center_id = $1`,
                [centerId],
            );
            return result.rows[0].total;
        },
    };
}

module.exports = { createTicketRepository };
