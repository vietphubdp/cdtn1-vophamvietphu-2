'use strict';

// Tài khoản mẫu (W13, HT1): 1 Tiếp nhận + 1 Quản lý ở mỗi trung tâm trong 3 trung tâm đầu (D6).
// Mật khẩu chỉ lưu dạng băm bcrypt; mật khẩu demo ghi trong README.
const bcrypt = require('bcrypt');
const { Role } = require('../../src/domain/constants');

const DEMO_PASSWORD = 'Demo@2026';
const BCRYPT_COST = 10;

const EMPLOYEES = [
    { username: 'mai.nk', full_name: 'Phạm Thị Mai', role: Role.TIEP_NHAN, center_id: 1 },
    { username: 'tuan.nk', full_name: 'Huỳnh Minh Tuấn', role: Role.QUAN_LY_TRUNG_TAM, center_id: 1 },
    { username: 'lan.q10', full_name: 'Trần Thị Lan', role: Role.TIEP_NHAN, center_id: 2 },
    { username: 'hung.q10', full_name: 'Đỗ Quốc Hùng', role: Role.QUAN_LY_TRUNG_TAM, center_id: 2 },
    { username: 'thu.vl', full_name: 'Lý Ngọc Thư', role: Role.TIEP_NHAN, center_id: 3 },
    { username: 'khoa.vl', full_name: 'Trương Đăng Khoa', role: Role.QUAN_LY_TRUNG_TAM, center_id: 3 },
];

async function seed(client) {
    let inserted = 0;
    for (const e of EMPLOYEES) {
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
        const result = await client.query(
            `INSERT INTO employee (full_name, role, center_id, username, password_hash)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (username) DO NOTHING`,
            [e.full_name, e.role, e.center_id, e.username, passwordHash],
        );
        inserted += result.rowCount;
    }
    return inserted;
}

module.exports = { seed, EMPLOYEES, DEMO_PASSWORD };
