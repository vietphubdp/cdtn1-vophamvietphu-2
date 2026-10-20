'use strict';

// 24 dòng máy (khớp ví dụ `total: 24` của api-contract mục 3.11). Số tháng bảo hành mặc định
// là cấu hình giả lập, không phải chính sách thật của hãng.
const PRODUCTS = [
    { product_name: 'Samsung Galaxy A06', default_warranty_months: 12 },
    { product_name: 'Samsung Galaxy A16', default_warranty_months: 12 },
    { product_name: 'Samsung Galaxy A35', default_warranty_months: 12 },
    { product_name: 'Samsung Galaxy A52', default_warranty_months: 12 },
    { product_name: 'Samsung Galaxy A55', default_warranty_months: 12 },
    { product_name: 'Samsung Galaxy S23 FE', default_warranty_months: 12 },
    { product_name: 'Samsung Galaxy S24', default_warranty_months: 24 },
    { product_name: 'Samsung Galaxy S24 Ultra', default_warranty_months: 24 },
    { product_name: 'Samsung Galaxy Z Flip6', default_warranty_months: 24 },
    { product_name: 'iPhone 13', default_warranty_months: 12 },
    { product_name: 'iPhone 14', default_warranty_months: 12 },
    { product_name: 'iPhone 15', default_warranty_months: 12 },
    { product_name: 'iPhone 15 Pro', default_warranty_months: 12 },
    { product_name: 'iPhone 16', default_warranty_months: 12 },
    { product_name: 'Oppo A18', default_warranty_months: 12 },
    { product_name: 'Oppo A78', default_warranty_months: 12 },
    { product_name: 'Oppo Reno11', default_warranty_months: 18 },
    { product_name: 'Oppo Find N3 Flip', default_warranty_months: 18 },
    { product_name: 'Xiaomi Redmi 13C', default_warranty_months: 18 },
    { product_name: 'Xiaomi Redmi Note 13', default_warranty_months: 18 },
    { product_name: 'Xiaomi 14T', default_warranty_months: 18 },
    { product_name: 'vivo Y17s', default_warranty_months: 12 },
    { product_name: 'vivo V30', default_warranty_months: 12 },
    { product_name: 'realme C67', default_warranty_months: 12 },
];

async function seed(client) {
    let inserted = 0;
    for (const p of PRODUCTS) {
        const result = await client.query(
            `INSERT INTO product (product_name, default_warranty_months) VALUES ($1, $2)
             ON CONFLICT (product_name) DO NOTHING`,
            [p.product_name, p.default_warranty_months],
        );
        inserted += result.rowCount;
    }
    return inserted;
}

module.exports = { seed, PRODUCTS };
