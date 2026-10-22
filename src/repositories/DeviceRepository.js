'use strict';

const { rethrowAsDuplicateKey } = require('./db');

const DEVICE_COLUMNS = 'device_id, customer_id, product_id, serial_no, purchase_date, warranty_months, created_at';

/**
 * Đọc/ghi bảng device. Chỉ đọc/ghi, không có quy tắc nghiệp vụ.
 * Không có hàm sửa, xóa: L2 không chuyển chủ thiết bị, không xóa vật lý (QT-13).
 * purchase_date đọc ra chuỗi 'YYYY-MM-DD' hoặc null (type parser trong db.js).
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createDeviceRepository(pool) {
    return {
        /** Một thiết bị theo mã; không có → null. */
        async findById(deviceId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT ${DEVICE_COLUMNS}
                   FROM device
                  WHERE device_id = $1`,
                [deviceId],
            );
            return result.rows[0] || null;
        },

        /**
         * Thiết bị của một khách kèm tên máy (api-contract 3.2), sắp theo thứ tự ghi nhận.
         * Lấy cả thiết bị có sản phẩm đã ngừng dùng: QT-13 giữ tham chiếu cũ.
         */
        async listByCustomer(customerId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT d.device_id, p.product_name, d.serial_no, d.purchase_date
                   FROM device d
                   JOIN product p ON p.product_id = d.product_id
                  WHERE d.customer_id = $1
                  ORDER BY d.device_id`,
                [customerId],
            );
            return result.rows;
        },

        /**
         * Thêm một dòng, trả dòng vừa tạo (created_at là Date do CSDL đặt).
         * Serial trùng UNIQUE → DuplicateKeyError.
         */
        async create({ customer_id, product_id, serial_no, purchase_date, warranty_months }, tx) {
            const db = tx || pool;
            const result = await db
                .query(
                    `INSERT INTO device (customer_id, product_id, serial_no, purchase_date, warranty_months)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING ${DEVICE_COLUMNS}`,
                    [customer_id, product_id, serial_no, purchase_date, warranty_months],
                )
                .catch(rethrowAsDuplicateKey);
            return result.rows[0];
        },
    };
}

module.exports = { createDeviceRepository };
