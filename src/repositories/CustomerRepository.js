'use strict';

const { rethrowAsDuplicateKey } = require('./db');

const CUSTOMER_COLUMNS = 'customer_id, full_name, phone, email, address, created_at';

/**
 * Đọc/ghi bảng customer. Chỉ đọc/ghi, không có quy tắc nghiệp vụ.
 * Không có hàm sửa, xóa: L2 không sửa, xóa khách hàng (W8, QT-13).
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createCustomerRepository(pool) {
    return {
        /** Tìm theo số điện thoại đã chuẩn hóa; không có → null. */
        async findByPhone(phone, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT ${CUSTOMER_COLUMNS}
                   FROM customer
                  WHERE phone = $1`,
                [phone],
            );
            return result.rows[0] || null;
        },

        /**
         * Thêm một dòng, trả dòng vừa tạo (created_at là Date do CSDL đặt).
         * Số điện thoại trùng UNIQUE → DuplicateKeyError.
         */
        async create({ full_name, phone, email, address }, tx) {
            const db = tx || pool;
            const result = await db
                .query(
                    `INSERT INTO customer (full_name, phone, email, address)
                     VALUES ($1, $2, $3, $4)
                     RETURNING ${CUSTOMER_COLUMNS}`,
                    [full_name, phone, email, address],
                )
                .catch(rethrowAsDuplicateKey);
            return result.rows[0];
        },
    };
}

module.exports = { createCustomerRepository };
