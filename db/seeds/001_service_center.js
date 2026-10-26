'use strict';

// 6 trung tâm bảo hành lấy nguyên từ bộ mẫu Mekong Mobile (data/sample/service_centers.csv,
// rút từ data/raw/service_centers.csv bằng db/tools/sample-data.js – TĐ-14).
// service_center không có cột UNIQUE ngoài khóa chính → chèn với center_id của bộ mẫu
// để chạy lại không nhân đôi, rồi đặt lại sequence của BIGSERIAL.
const { readSampleCsv } = require('../tools/csv');

const SERVICE_CENTERS = readSampleCsv('service_centers.csv').map((c) => ({
    center_id: Number(c.center_id),
    center_name: c.center_name,
}));

async function seed(client) {
    let inserted = 0;
    for (const c of SERVICE_CENTERS) {
        const result = await client.query(
            `INSERT INTO service_center (center_id, center_name) VALUES ($1, $2)
             ON CONFLICT (center_id) DO NOTHING`,
            [c.center_id, c.center_name],
        );
        inserted += result.rowCount;
    }
    // Trung tâm thêm sau này (nếu có) nhận mã tiếp theo, không đụng mã đã seed.
    await client.query(
        `SELECT setval(pg_get_serial_sequence('service_center', 'center_id'),
                       (SELECT MAX(center_id) FROM service_center))`,
    );
    return inserted;
}

module.exports = { seed, SERVICE_CENTERS };
