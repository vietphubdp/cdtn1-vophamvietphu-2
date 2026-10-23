'use strict';

const { DuplicateKeyError } = require('../../src/errors/DuplicateKeyError');

// TicketRepository, TicketStatusLogRepository và withTransaction giả, lưu trong bộ nhớ,
// không cần CSDL (D4). Hành vi giống bản thật: idempotency_key trùng UNIQUE → DuplicateKeyError,
// không có dòng → null, sequence mã phiếu chỉ tăng.

// Sequence đang ở 230 → phiếu lập tiếp theo nhận số 231, khớp ví dụ BH000231/2026 của api-contract 3.7.
const TEST_SEQUENCE_START = 230;

function createFakeTicketRepository(seedRows = []) {
    const rows = seedRows.map((r) => ({ ...r }));
    let nextId = Math.max(88230, ...rows.map((r) => r.ticket_id)) + 1;
    let sequence = TEST_SEQUENCE_START;

    return {
        rows,
        nextCodeNumber: jest.fn(async () => {
            sequence += 1;
            return sequence;
        }),
        create: jest.fn(async (ticket) => {
            if (rows.some((r) => r.idempotency_key === ticket.idempotency_key)) {
                throw new DuplicateKeyError('ticket_idempotency_key_key');
            }
            const row = { ticket_id: nextId++, ...ticket };
            rows.push(row);
            return { ...row };
        }),
        findByIdempotencyKey: jest.fn(async (key) => {
            const row = rows.find((r) => r.idempotency_key === key);
            return row ? { ...row } : null;
        }),
        // API 8: như bản thật, lọc theo trung tâm, sắp due_date rồi ticket_id, cắt theo limit/offset.
        // Bản giả không JOIN: dòng seed tự mang customer_name, phone, product_name… (xem createListTicket).
        listByCenter: jest.fn(async (centerId, { limit, offset }) =>
            rows
                .filter((r) => r.center_id === centerId)
                .sort((a, b) => a.due_date - b.due_date || a.ticket_id - b.ticket_id)
                .slice(offset, offset + limit)
                .map((r) => ({ ...r })),
        ),
        countByCenter: jest.fn(async (centerId) => rows.filter((r) => r.center_id === centerId).length),
    };
}

/**
 * Một dòng phiếu đã JOIN như TicketRepository.listByCenter trả về, mặc định khớp ví dụ
 * api-contract 3.8 (trung tâm 2, hạn 08:10 ngày 10/10/2026). Ghi đè từng trường qua `overrides`.
 */
function createListTicket(overrides = {}) {
    return {
        ticket_id: 88198,
        ticket_code: 'BH000198/2026',
        center_id: 2,
        customer_name: 'Trần Thị Bình',
        phone: '0912345321',
        product_name: 'iPhone 13',
        serial_no: '358240051111110',
        category_name: 'Pin',
        priority: 'CAO',
        warranty_status: 'CON_BAO_HANH',
        status: 'DANG_XU_LY',
        received_at: new Date('2026-10-09T08:10:00+07:00'),
        due_date: new Date('2026-10-10T08:10:00+07:00'),
        ...overrides,
    };
}

function createFakeTicketStatusLogRepository() {
    const rows = [];
    let nextId = 1;
    return {
        rows,
        create: jest.fn(async (log) => {
            const row = { log_id: nextId++, ...log };
            rows.push(row);
            return { ...row };
        }),
    };
}

/**
 * withTransaction giả: mỗi lần gọi tạo một đối tượng `tx` mới và ghi lại vào `transactions`,
 * để test khẳng định các lần ghi cùng nằm trong một giao dịch. Lỗi trong work được ném ra ngoài
 * như bản thật (rollback thật kiểm ở tests/repositories/transaction.test.js và bằng tay theo README).
 */
function createFakeTransactionRunner() {
    const transactions = [];
    const withTransaction = jest.fn(async (work) => {
        const tx = { id: transactions.length + 1 };
        transactions.push(tx);
        return work(tx);
    });
    return { withTransaction, transactions };
}

module.exports = {
    TEST_SEQUENCE_START,
    createFakeTicketRepository,
    createListTicket,
    createFakeTicketStatusLogRepository,
    createFakeTransactionRunner,
};
