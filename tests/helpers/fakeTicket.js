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
    createFakeTicketStatusLogRepository,
    createFakeTransactionRunner,
};
