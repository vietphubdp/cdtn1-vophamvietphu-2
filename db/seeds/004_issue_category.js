'use strict';

// 6 nhóm sự cố lấy từ bộ mẫu Mekong Mobile (data/sample/issue_categories.csv – TĐ-14). Mã nhóm của
// bộ mẫu (MAN_HINH, SAC…) đã đổi sang tên theo bảng thuật ngữ SRS mục 1.4; giữ category_id và
// default_priority của bộ mẫu ("Sạc" = mã 3 như ví dụ api-contract mục 3.6). Mức ưu tiên mặc định
// là dữ liệu danh mục, đổi bằng API 16 mà không sửa code (NFR5).
const { readSampleCsv } = require('../tools/csv');

const ISSUE_CATEGORIES = readSampleCsv('issue_categories.csv').map((c) => ({
    category_id: Number(c.category_id),
    category_name: c.category_name,
    default_priority: c.default_priority,
}));

async function seed(client) {
    let inserted = 0;
    for (const c of ISSUE_CATEGORIES) {
        const result = await client.query(
            `INSERT INTO issue_category (category_id, category_name, default_priority) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [c.category_id, c.category_name, c.default_priority],
        );
        inserted += result.rowCount;
    }
    // Nhóm thêm qua API 15 nhận mã tiếp theo, không đụng mã đã seed.
    await client.query(
        `SELECT setval(pg_get_serial_sequence('issue_category', 'category_id'),
                       GREATEST((SELECT MAX(category_id) FROM issue_category), 1))`,
    );
    return inserted;
}

module.exports = { seed, ISSUE_CATEGORIES };
