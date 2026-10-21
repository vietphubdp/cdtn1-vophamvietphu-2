'use strict';

/**
 * Đọc bảng employee (kèm tên trung tâm từ service_center). Chỉ đọc/ghi, không có quy tắc nghiệp vụ.
 * Mỗi hàm nhận `tx` tùy chọn: có thì chạy trong giao dịch đó, không thì dùng pool.
 */
function createEmployeeRepository(pool) {
    return {
        /** Tài khoản theo tên đăng nhập, gồm cả password_hash để AuthService so khớp; không có → null. */
        async findByUsername(username, tx) {
            const db = tx || pool;
            const result = await db.query(
                `SELECT e.employee_id, e.full_name, e.role, e.center_id, c.center_name, e.password_hash
                   FROM employee e
                   JOIN service_center c ON c.center_id = e.center_id
                  WHERE e.username = $1`,
                [username],
            );
            return result.rows[0] || null;
        },
    };
}

module.exports = { createEmployeeRepository };
