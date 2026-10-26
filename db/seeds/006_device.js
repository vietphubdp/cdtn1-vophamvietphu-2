'use strict';

// Thiết bị (data/sample/devices.csv – TĐ-14). Bộ mẫu không có bảng thiết bị nên dựng từ cặp
// (customer_id, product_id, serial_no) của phiếu mẫu, đúng gợi ý README bộ dữ liệu mục 5.
// Ngày mua không có trong bộ mẫu: db/tools/sample-data.js sinh theo seed cố định sao cho
// WarrantyService (QT-05) cho đúng is_warranty của phiếu gốc từ 26/10/2026 tới 01/03/2027.
// Thêm 7 thiết bị tự bổ sung không có ngày mua (chưa xác minh); device_id 1, 2 thuộc khách 100001.
// Nhãn is_warranty (true / false / trống) chỉ để đối chiếu, không ghi vào CSDL; tình trạng thật do
// WarrantyService tính (test "dữ liệu seed khớp nhãn" trong tests/services/WarrantyService.test.js).
const { readSampleCsv } = require('../tools/csv');
const { CUSTOMERS } = require('./005_customer');
const { PRODUCTS } = require('./003_product');

const DEVICES = readSampleCsv('devices.csv').map((d) => ({
    device_id: Number(d.device_id),
    customer_id: Number(d.customer_id),
    product_id: Number(d.product_id),
    serial_no: d.serial_no,
    purchase_date: d.purchase_date || null,
    warranty_months: Number(d.warranty_months),
    is_warranty: d.is_warranty,
}));

/** Bắt lỗi tham chiếu sai trước khi chèn (khóa ngoại sẽ làm hỏng cả giao dịch seed). */
function assertReferencesExist() {
    const customerIds = new Set(CUSTOMERS.map((c) => c.customer_id));
    const productIds = new Set(PRODUCTS.map((p) => p.product_id));
    for (const d of DEVICES) {
        if (!customerIds.has(d.customer_id)) throw new Error(`Seed device ${d.serial_no}: không có khách ${d.customer_id}`);
        if (!productIds.has(d.product_id)) throw new Error(`Seed device ${d.serial_no}: không có sản phẩm ${d.product_id}`);
    }
}

async function seed(client) {
    assertReferencesExist();
    let inserted = 0;
    for (const d of DEVICES) {
        const result = await client.query(
            `INSERT INTO device (device_id, customer_id, product_id, serial_no, purchase_date, warranty_months)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [d.device_id, d.customer_id, d.product_id, d.serial_no, d.purchase_date, d.warranty_months],
        );
        inserted += result.rowCount;
    }
    // Thiết bị ghi nhận qua API 4 nhận mã tiếp theo.
    await client.query(
        `SELECT setval(pg_get_serial_sequence('device', 'device_id'),
                       GREATEST((SELECT MAX(device_id) FROM device), 1))`,
    );
    return inserted;
}

module.exports = { seed, DEVICES };
