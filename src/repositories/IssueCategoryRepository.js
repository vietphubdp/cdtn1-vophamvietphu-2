'use strict';

const { rethrowAsDuplicateKey } = require('./db');

const CATEGORY_COLUMNS = 'category_id, category_name, default_priority, is_active';

/**
 * Đọc/ghi bảng issue_category. Chỉ đọc/ghi, không có quy tắc nghiệp vụ.
 * Không có hàm xóa: "xóa" là đặt is_active = false (QT-13).
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createIssueCategoryRepository(pool) {
    return {
        /** Danh sách theo thứ tự mã (giữ "Khác" ở cuối như seed); includeInactive = false thì chỉ lấy dòng đang dùng. */
        async list({ includeInactive }, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT ${CATEGORY_COLUMNS}
                   FROM issue_category
                  WHERE $1::boolean OR is_active
                  ORDER BY category_id`,
                [includeInactive],
            );
            return result.rows;
        },

        /** Một nhóm theo mã, kể cả nhóm đã ngừng dùng; không có → null. */
        async findById(categoryId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT ${CATEGORY_COLUMNS}
                   FROM issue_category
                  WHERE category_id = $1`,
                [categoryId],
            );
            return result.rows[0] || null;
        },

        /** Thêm một dòng, trả dòng vừa tạo. Tên trùng → DuplicateKeyError. */
        async create({ category_name, default_priority }, tx) {
            const db = tx || pool;
            const result = await db
                .query(
                    `INSERT INTO issue_category (category_name, default_priority)
                     VALUES ($1, $2)
                     RETURNING ${CATEGORY_COLUMNS}`,
                    [category_name, default_priority],
                )
                .catch(rethrowAsDuplicateKey);
            return result.rows[0];
        },

        /**
         * Sửa tên, mức ưu tiên mặc định; is_active vắng (undefined/null) thì giữ nguyên.
         * Trả dòng sau khi sửa; không có dòng → null. Tên trùng → DuplicateKeyError.
         */
        async update(categoryId, { category_name, default_priority, is_active }, tx) {
            const db = tx || pool;
            const result = await db
                .query(
                    `UPDATE issue_category
                        SET category_name = $2,
                            default_priority = $3,
                            is_active = COALESCE($4::boolean, is_active)
                      WHERE category_id = $1
                      RETURNING ${CATEGORY_COLUMNS}`,
                    [categoryId, category_name, default_priority, is_active ?? null],
                )
                .catch(rethrowAsDuplicateKey);
            return result.rows[0] || null;
        },

        /** Đặt is_active = false (QT-13). Trả dòng sau khi sửa; không có dòng → null. */
        async deactivate(categoryId, tx) {
            const db = tx || pool;
            const result = await db.query(
                `UPDATE issue_category SET is_active = false
                  WHERE category_id = $1
                  RETURNING ${CATEGORY_COLUMNS}`,
                [categoryId],
            );
            return result.rows[0] || null;
        },
    };
}

module.exports = { createIssueCategoryRepository };
