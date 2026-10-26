'use strict';

// Dòng máy lấy từ bộ mẫu Mekong Mobile (data/sample/products.csv – TĐ-14): các sản phẩm mà phiếu mẫu
// tham chiếu, bổ sung từ data/raw/products.csv cho đủ ít nhất 24 dòng. Giữ product_id và
// warranty_months của bộ mẫu (→ default_warranty_months, FR4).
// Chèn với product_id của bộ mẫu; ON CONFLICT không chỉ cột nên bỏ qua cả trùng mã lẫn trùng tên
// (product_name UNIQUE) → chạy lại không nhân đôi. Sau đó đặt sequence để sản phẩm thêm qua API 12
// nhận mã tiếp theo.
const { readSampleCsv } = require('../tools/csv');

const PRODUCTS = readSampleCsv('products.csv').map((p) => ({
    product_id: Number(p.product_id),
    product_name: p.product_name,
    default_warranty_months: Number(p.default_warranty_months),
}));

async function seed(client) {
    let inserted = 0;
    for (const p of PRODUCTS) {
        const result = await client.query(
            `INSERT INTO product (product_id, product_name, default_warranty_months) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [p.product_id, p.product_name, p.default_warranty_months],
        );
        inserted += result.rowCount;
    }
    await client.query(
        `SELECT setval(pg_get_serial_sequence('product', 'product_id'),
                       GREATEST((SELECT MAX(product_id) FROM product), 1))`,
    );
    return inserted;
}

module.exports = { seed, PRODUCTS };
