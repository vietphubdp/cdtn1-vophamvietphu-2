'use strict';

const { Pool, types } = require('pg');

// Kiểu DATE (OID 1082) đọc ra nguyên chuỗi 'YYYY-MM-DD'. Mặc định `pg` đổi thành Date
// lúc 00:00 giờ máy, nên máy chấm không ở UTC+7 sẽ lệch ngày mua (QT-05).
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value) => value);

// Kiểu BIGINT/BIGSERIAL (OID 20) mặc định đọc ra chuỗi để không mất chính xác trên 2^53.
// Mã khóa và count(*) trong hệ thống này nhỏ hơn rất nhiều, nên đọc ra số để JSON
// trả `"center_id": 2` đúng api-contract thay vì `"2"`.
const PG_BIGINT_OID = 20;
types.setTypeParser(PG_BIGINT_OID, (value) => Number.parseInt(value, 10));

/** Tạo pool kết nối từ cấu hình { host, port, user, password, database }. */
function createPool(dbConfig) {
    return new Pool(dbConfig);
}

/**
 * Trả về hàm withTransaction(work) để service mở/đóng giao dịch mà không biết `pg` hay SQL.
 * `work(tx)` nhận một đối tượng giao dịch `tx` và chuyển nó cho các repository;
 * mọi câu lệnh chạy qua `tx` nằm trong cùng một giao dịch (NFR4, QT-06).
 * work thành công → COMMIT, trả kết quả của work; work ném lỗi → ROLLBACK, ném lại lỗi đó.
 */
function createTransactionRunner(pool) {
    return async function withTransaction(work) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await work(client);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                // Giữ lỗi gốc để ErrorMapper ghi log; lỗi rollback đi kèm làm ngữ cảnh.
                err.rollbackError = rollbackErr;
            }
            throw err;
        } finally {
            client.release();
        }
    };
}

module.exports = { createPool, createTransactionRunner };
