'use strict';

const { DuplicateKeyError } = require('../../src/errors/DuplicateKeyError');
const { TEST_PRODUCTS } = require('./fakeCatalog');
const { TEST_CREATED_AT } = require('./fakeCustomer');

// DeviceRepository giả, lưu trong bộ nhớ, không cần CSDL (D4).
// Hành vi giống bản thật: serial trùng UNIQUE → DuplicateKeyError, không có dòng → null,
// purchase_date là chuỗi 'YYYY-MM-DD' hoặc null, created_at là Date cố định.
// Mã sản phẩm theo thứ tự TEST_PRODUCTS trong fakeCatalog: 1 Oppo A78 (12 tháng),
// 2 Samsung Galaxy A55 (18 tháng), 3 Nokia 105 (6 tháng, đã ngừng dùng).

const TEST_DEVICES = [
    // US4-AC1/AC2: mua 05/03/2026 + 12 tháng → còn đến hết 05/03/2027.
    { device_id: 3311, customer_id: 1024, product_id: 2, serial_no: 'SN-A55-778901', purchase_date: '2026-03-05', warranty_months: 12 },
    // US4-AC3: thiếu ngày mua → chưa xác minh.
    { device_id: 3350, customer_id: 1024, product_id: 1, serial_no: '358240051111110', purchase_date: null, warranty_months: 12 },
    // Q4: 31/08/2025 + 6 tháng → hết hạn 28/02/2026. Sản phẩm đã ngừng dùng vẫn giữ tham chiếu (QT-13).
    { device_id: 3360, customer_id: 1025, product_id: 3, serial_no: 'NK105-40017', purchase_date: '2025-08-31', warranty_months: 6 },
];

function productNameOf(productId) {
    const product = TEST_PRODUCTS[productId - 1];
    return product ? product.product_name : null;
}

function createFakeDeviceRepository(seedRows = TEST_DEVICES) {
    const rows = seedRows.map((r) => ({ created_at: TEST_CREATED_AT, ...r }));
    let nextId = Math.max(0, ...rows.map((r) => r.device_id)) + 1;

    return {
        rows,
        findById: jest.fn(async (deviceId) => {
            const row = rows.find((r) => r.device_id === deviceId);
            return row ? { ...row } : null;
        }),
        listByCustomer: jest.fn(async (customerId) =>
            rows
                .filter((r) => r.customer_id === customerId)
                .sort((a, b) => a.device_id - b.device_id)
                .map((r) => ({
                    device_id: r.device_id,
                    product_name: productNameOf(r.product_id),
                    serial_no: r.serial_no,
                    purchase_date: r.purchase_date,
                })),
        ),
        create: jest.fn(async (input) => {
            if (rows.some((r) => r.serial_no === input.serial_no)) throw new DuplicateKeyError('device_serial_no_key');
            const row = { device_id: nextId++, ...input, created_at: TEST_CREATED_AT };
            rows.push(row);
            return { ...row };
        }),
    };
}

module.exports = { TEST_DEVICES, createFakeDeviceRepository };
