'use strict';

const { rethrowAsDuplicateKey } = require('./db');

const PRODUCT_COLUMNS = 'product_id, product_name, default_warranty_months, is_active';

/**
 * Đọc/ghi bảng product. Chỉ đọc/ghi, không có quy tắc nghiệp vụ.
 * Không có hàm xóa: "xóa" là đặt is_active = false (QT-13).
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createProductRepository(pool) {
    return {
        /** Danh sách sắp theo tên; includeInactive = false thì chỉ lấy dòng đang dùng. */
        async list({ includeInactive }, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT ${PRODUCT_COLUMNS}
                   FROM product
                  WHERE $1::boolean OR is_active
                  ORDER BY product_name, product_id`,
                [includeInactive],
            );
            return result.rows;
        },

        /** Thêm một dòng, trả dòng vừa tạo. Tên trùng → DuplicateKeyError. */
        async create({ product_name, default_warranty_months }, tx) {
            const db = tx || pool;
            const result = await db
                .query(
                    `INSERT INTO product (product_name, default_warranty_months)
                     VALUES ($1, $2)
                     RETURNING ${PRODUCT_COLUMNS}`,
                    [product_name, default_warranty_months],
                )
                .catch(rethrowAsDuplicateKey);
            return result.rows[0];
        },

        /**
         * Sửa tên, số tháng; is_active vắng (undefined/null) thì giữ nguyên.
         * Trả dòng sau khi sửa; không có dòng → null. Tên trùng → DuplicateKeyError.
         */
        async update(productId, { product_name, default_warranty_months, is_active }, tx) {
            const db = tx || pool;
            const result = await db
                .query(
                    `UPDATE product
                        SET product_name = $2,
                            default_warranty_months = $3,
                            is_active = COALESCE($4::boolean, is_active)
                      WHERE product_id = $1
                      RETURNING ${PRODUCT_COLUMNS}`,
                    [productId, product_name, default_warranty_months, is_active ?? null],
                )
                .catch(rethrowAsDuplicateKey);
            return result.rows[0] || null;
        },

        /** Đặt is_active = false (QT-13). Trả dòng sau khi sửa; không có dòng → null. */
        async deactivate(productId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `UPDATE product SET is_active = false
                  WHERE product_id = $1
                  RETURNING ${PRODUCT_COLUMNS}`,
                [productId],
            );
            return result.rows[0] || null;
        },
    };
}

module.exports = { createProductRepository };
