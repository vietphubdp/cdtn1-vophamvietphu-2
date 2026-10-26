'use strict';

// Khách hàng lấy từ bộ mẫu Mekong Mobile (data/sample/customers.csv – TĐ-14): chỉ các khách mà phiếu
// mẫu tham chiếu, customer_id = record_id của data/raw/customers_raw.csv. Số điện thoại đã chuẩn hóa
// bằng normalizePhone (QT-02), không trùng nhau (QT-01); tên đã chuẩn hóa khoảng trắng.
// Một khách tự bổ sung (source = TU_BO_SUNG, mã 100001, số 0901234567) cho ví dụ api-contract 3.1 và
// lệnh curl trong README. Không seed số 0931234888 (ví dụ tạo khách ở mục 3.3) để demo được 201.
// ON CONFLICT không chỉ cột: bỏ qua cả trùng mã lẫn trùng số → chạy lại không nhân đôi.
const { readSampleCsv } = require('../tools/csv');

const CUSTOMERS = readSampleCsv('customers.csv').map((c) => ({
    customer_id: Number(c.customer_id),
    full_name: c.full_name,
    phone: c.phone,
    email: c.email || null,
    address: c.address || null,
}));

async function seed(client) {
    let inserted = 0;
    for (const c of CUSTOMERS) {
        const result = await client.query(
            `INSERT INTO customer (customer_id, full_name, phone, email, address) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [c.customer_id, c.full_name, c.phone, c.email, c.address],
        );
        inserted += result.rowCount;
    }
    // Khách tạo qua API 3 nhận mã sau mã lớn nhất đã có, không trùng mã của bộ mẫu.
    await client.query(
        `SELECT setval(pg_get_serial_sequence('customer', 'customer_id'),
                       GREATEST((SELECT MAX(customer_id) FROM customer), 1))`,
    );
    return inserted;
}

module.exports = { seed, CUSTOMERS };
