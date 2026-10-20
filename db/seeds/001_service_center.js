'use strict';

// 6 trung tâm bảo hành, khớp case study Mekong Mobile (D6). Dữ liệu giả lập.
// service_center không có cột UNIQUE ngoài khóa chính → chèn với center_id cố định
// để chạy lại không nhân đôi, rồi đặt lại sequence của BIGSERIAL.
const SERVICE_CENTERS = [
    { center_id: 1, center_name: 'Trung tâm bảo hành Ninh Kiều' },
    { center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' },
    { center_id: 3, center_name: 'Trung tâm bảo hành Vĩnh Long' },
    { center_id: 4, center_name: 'Trung tâm bảo hành Long Xuyên' },
    { center_id: 5, center_name: 'Trung tâm bảo hành Mỹ Tho' },
    { center_id: 6, center_name: 'Trung tâm bảo hành Bến Tre' },
];

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
