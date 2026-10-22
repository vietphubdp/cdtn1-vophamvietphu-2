'use strict';

const { DuplicateKeyError } = require('../../src/errors/DuplicateKeyError');

// CustomerRepository giả, lưu trong bộ nhớ, không cần CSDL (D4).
// Hành vi giống bản thật: số trùng UNIQUE → DuplicateKeyError, không có dòng → null,
// created_at là Date do "CSDL" đặt (cố định để test không phụ thuộc giờ hiện tại).

// 2026-10-08T07:20:00Z = 14:20 giờ Việt Nam, khớp ví dụ api-contract 3.3.
const TEST_CREATED_AT = new Date('2026-10-08T07:20:00Z');

const TEST_CUSTOMERS = [
    {
        customer_id: 1024,
        full_name: 'Nguyễn Văn An',
        phone: '0901234567',
        email: null,
        address: '12 Nguyễn Tri Phương, Quận 10',
    },
    {
        customer_id: 1025,
        full_name: 'Trần Thị Bích',
        phone: '0912345678',
        email: 'bich.tran@example.com',
        address: '88 Ba Tháng Hai, Quận 10',
    },
];

function createFakeCustomerRepository(seedRows = TEST_CUSTOMERS) {
    const rows = seedRows.map((r) => ({ created_at: TEST_CREATED_AT, ...r }));
    let nextId = Math.max(0, ...rows.map((r) => r.customer_id)) + 1;

    return {
        rows,
        findByPhone: jest.fn(async (phone) => {
            const row = rows.find((r) => r.phone === phone);
            return row ? { ...row } : null;
        }),
        create: jest.fn(async (input) => {
            if (rows.some((r) => r.phone === input.phone)) throw new DuplicateKeyError('customer_phone_key');
            const row = { customer_id: nextId++, ...input, created_at: TEST_CREATED_AT };
            rows.push(row);
            return { ...row };
        }),
    };
}

module.exports = { TEST_CUSTOMERS, TEST_CREATED_AT, createFakeCustomerRepository };
