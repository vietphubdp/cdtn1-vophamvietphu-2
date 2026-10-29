'use strict';

const { DuplicateKeyError } = require('../../src/errors/DuplicateKeyError');

// TicketRepository, TicketStatusLogRepository và withTransaction giả, lưu trong bộ nhớ,
// không cần CSDL (D4). Hành vi giống bản thật: idempotency_key trùng UNIQUE → DuplicateKeyError,
// không có dòng → null, sequence mã phiếu chỉ tăng.

// Họ tên người thực hiện trong lịch sử (bản thật JOIN employee); khớp TEST_EMPLOYEES của fakeAuth.
const TEST_EMPLOYEE_NAMES = Object.freeze({ 7: 'Trần Thị Lan', 8: 'Đỗ Quốc Hùng' });

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
        // API 18: bản giả không JOIN, dòng seed tự mang customer_name, phone, product_name… (createDetailTicket).
        findDetailById: jest.fn(async (ticketId) => {
            const row = rows.find((r) => r.ticket_id === ticketId);
            return row ? { ...row } : null;
        }),
        // Bản thật khóa dòng bằng FOR UPDATE trong giao dịch; bản giả chỉ đọc.
        findByIdForUpdate: jest.fn(async (ticketId) => {
            const row = rows.find((r) => r.ticket_id === ticketId);
            return row ? { ...row } : null;
        }),
        update: jest.fn(async (ticketId, ticket) => {
            const row = rows.find((r) => r.ticket_id === ticketId);
            Object.assign(row, ticket);
            return { ...row };
        }),
    };
}

/**
 * Một phiếu MOI đầy đủ cột như bảng ticket, kèm các trường JOIN của API 18. Mặc định: trung tâm 2,
 * khách 1024, thiết bị 3311 (còn bảo hành), nhóm 3 Sạc, Trung bình, tiếp nhận 14:30 thứ Năm 08/10/2026
 * nên hạn cam kết 14:30 thứ Hai 12/10/2026 (US5-AC5). Ghi đè từng trường qua `overrides`.
 */
function createDetailTicket(overrides = {}) {
    return {
        ticket_id: 88231,
        ticket_code: 'BH000231/2026',
        customer_id: 1024,
        customer_name: 'Nguyễn Văn An',
        phone: '0901234567',
        device_id: 3311,
        product_name: 'Samsung Galaxy A55',
        serial_no: 'SN-A55-778901',
        center_id: 2,
        category_id: 3,
        category_name: 'Sạc',
        issue_desc: 'Máy không nhận sạc, cắm sạc báo lỗi phụ kiện',
        priority: 'TRUNG_BINH',
        status: 'MOI',
        warranty_status: 'CON_BAO_HANH',
        received_at: new Date('2026-10-08T14:30:00+07:00'),
        due_date: new Date('2026-10-12T14:30:00+07:00'),
        idempotency_key: '7f3c2a10-9b4e-4c1d-8a2f-5e6d7c8b9a01',
        ...overrides,
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

function createFakeTicketStatusLogRepository(seedRows = []) {
    const rows = seedRows.map((r) => ({ ...r }));
    let nextId = rows.length + 1;
    return {
        rows,
        create: jest.fn(async (log) => {
            const row = { log_id: nextId++, ...log };
            rows.push(row);
            return { ...row };
        }),
        listByTicket: jest.fn(async (ticketId) =>
            rows
                .filter((r) => r.ticket_id === ticketId)
                .sort((a, b) => a.changed_at - b.changed_at || a.log_id - b.log_id)
                .map(({ changed_by, ticket_id: _ticketId, ...r }) => ({ ...r, changed_by_name: TEST_EMPLOYEE_NAMES[changed_by] })),
        ),
    };
}

/** TicketEditLogRepository giả (QT-16, QT-17): chỉ ghi thêm; listByTicket trả kèm họ tên người sửa như bản thật. */
function createFakeTicketEditLogRepository(seedRows = []) {
    const rows = seedRows.map((r) => ({ ...r }));
    let nextId = rows.length + 1;
    return {
        rows,
        create: jest.fn(async (log) => {
            const row = { edit_id: nextId++, ...log };
            rows.push(row);
            return { ...row };
        }),
        listByTicket: jest.fn(async (ticketId) =>
            rows
                .filter((r) => r.ticket_id === ticketId)
                .sort((a, b) => a.changed_at - b.changed_at || a.edit_id - b.edit_id)
                .map(({ changed_by, ticket_id: _ticketId, ...r }) => ({ ...r, changed_by_name: TEST_EMPLOYEE_NAMES[changed_by] })),
        ),
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
    createDetailTicket,
    createFakeTicketStatusLogRepository,
    createFakeTicketEditLogRepository,
    createFakeTransactionRunner,
};
