'use strict';

// 6 nhóm sự cố đúng bảng thuật ngữ SRS mục 1.4 (D6). Mức ưu tiên mặc định là dữ liệu
// danh mục, đổi bằng API 16 mà không sửa code (NFR5). Thứ tự chèn giữ "Sạc" = mã 3
// như ví dụ api-contract mục 3.6.
const { Priority } = require('../../src/domain/constants');

const ISSUE_CATEGORIES = [
    { category_name: 'Màn hình', default_priority: Priority.CAO },
    { category_name: 'Pin', default_priority: Priority.TRUNG_BINH },
    { category_name: 'Sạc', default_priority: Priority.TRUNG_BINH },
    { category_name: 'Phần mềm', default_priority: Priority.THAP },
    { category_name: 'Nước vào', default_priority: Priority.CAO },
    { category_name: 'Khác', default_priority: Priority.TRUNG_BINH },
];

async function seed(client) {
    let inserted = 0;
    for (const c of ISSUE_CATEGORIES) {
        const result = await client.query(
            `INSERT INTO issue_category (category_name, default_priority) VALUES ($1, $2)
             ON CONFLICT (category_name) DO NOTHING`,
            [c.category_name, c.default_priority],
        );
        inserted += result.rowCount;
    }
    return inserted;
}

module.exports = { seed, ISSUE_CATEGORIES };
