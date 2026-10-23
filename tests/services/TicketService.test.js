'use strict';

const { createTicketService, formatTicketCode, resolvePriority } = require('../../src/services/TicketService');
const { ErrorCode } = require('../../src/errors/AppError');
const { DuplicateKeyError } = require('../../src/errors/DuplicateKeyError');
const { Role, Priority, TicketStatus, WarrantyStatus } = require('../../src/domain/constants');
const { createFakeCustomerRepository } = require('../helpers/fakeCustomer');
const { createFakeDeviceRepository } = require('../helpers/fakeDevice');
const { createFakeIssueCategoryRepository } = require('../helpers/fakeCatalog');
const {
    createFakeTicketRepository,
    createFakeTicketStatusLogRepository,
    createFakeTransactionRunner,
} = require('../helpers/fakeTicket');

// Unit test TicketService (UC5: QT-03, QT-04, QT-05, QT-06, NFR4, FR6–FR9, Q3, Q10–Q12) với repository
// giả, không cần CSDL. `now` truyền vào. Khẳng định mã nghiệp vụ, không khẳng định mã HTTP.
// Dữ liệu giả: khách 1024 có thiết bị 3311 (mua 05/03/2026, 12 tháng) và 3350 (không có ngày mua);
// khách 1025 có thiết bị 3360 (hết hạn 28/02/2026). Nhóm sự cố: 1 Màn hình (CAO), 2 Pin (TB),
// 3 Sạc (TB), 4 Nhóm cũ (THAP, đã ngừng dùng).

const RECEPTIONIST = { employee_id: 7, role: Role.TIEP_NHAN, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };
const OTHER_CENTER_RECEPTIONIST = { employee_id: 1, role: Role.TIEP_NHAN, center_id: 1, center_name: 'Trung tâm bảo hành Ninh Kiều' };
const MANAGER = { employee_id: 8, role: Role.QUAN_LY_TRUNG_TAM, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };

/** Thời điểm theo giờ Việt Nam, ví dụ vn('2026-10-08T14:30'). */
const vn = (local) => new Date(`${local}:00+07:00`);
const NOW = vn('2026-10-08T14:30'); // thứ Năm, khớp ví dụ api-contract 3.7

const KEY = '7f3c2a10-9b4e-4c1d-8a2f-5e6d7c8b9a01';
const OTHER_KEY = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

// Ví dụ request của api-contract 3.7 (đã qua validator).
const INPUT = Object.freeze({
    customer_id: 1024,
    device_id: 3311,
    issue_desc: 'Máy không nhận sạc, cắm sạc báo lỗi phụ kiện',
    category_id: 3,
    priority: Priority.TRUNG_BINH,
});

function createService() {
    const ticketRepository = createFakeTicketRepository();
    const ticketStatusLogRepository = createFakeTicketStatusLogRepository();
    const { withTransaction, transactions } = createFakeTransactionRunner();
    const ticketService = createTicketService({
        ticketRepository,
        ticketStatusLogRepository,
        customerRepository: createFakeCustomerRepository(),
        deviceRepository: createFakeDeviceRepository(),
        issueCategoryRepository: createFakeIssueCategoryRepository(),
        withTransaction,
    });
    return { ticketService, ticketRepository, ticketStatusLogRepository, withTransaction, transactions };
}

async function captureError(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('TicketService – lập phiếu (API 7, UC5)', () => {
    test('US5-AC1 luồng đúng: lưu phiếu MOI có mã, thời điểm tiếp nhận, hạn cam kết; trả đúng ví dụ api-contract 3.7', async () => {
        const { ticketService, ticketRepository } = createService();

        const result = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW);

        expect(result).toEqual({
            created: true,
            ticket: {
                ticket_id: 88231,
                ticket_code: 'BH000231/2026',
                customer_id: 1024,
                device_id: 3311,
                center_id: 2,
                category_id: 3,
                priority: 'TRUNG_BINH',
                status: 'MOI',
                warranty_status: 'CON_BAO_HANH',
                received_at: '2026-10-08T14:30:00+07:00',
                due_date: '2026-10-12T14:30:00+07:00',
            },
        });
        expect(ticketRepository.rows).toHaveLength(1);
        expect(ticketRepository.rows[0]).toMatchObject({
            issue_desc: INPUT.issue_desc,
            idempotency_key: KEY,
            received_at: NOW, // service truyền vào, không để CSDL tự DEFAULT now()
        });
    });

    test('QT-06 luồng đúng: ghi đúng một dòng lịch sử đầu tiên NULL → MOI, do người lập, cùng thời điểm tiếp nhận', async () => {
        const { ticketService, ticketStatusLogRepository } = createService();

        const { ticket } = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW);

        expect(ticketStatusLogRepository.rows).toEqual([
            {
                log_id: 1,
                ticket_id: ticket.ticket_id,
                from_status: null,
                to_status: TicketStatus.MOI,
                changed_at: NOW,
                changed_by: RECEPTIONIST.employee_id,
                note: null,
            },
        ]);
    });

    test('NFR4 luồng đúng: lấy số mã, ghi phiếu, ghi lịch sử đều trong cùng MỘT lần withTransaction', async () => {
        const { ticketService, ticketRepository, ticketStatusLogRepository, withTransaction, transactions } = createService();

        await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW);

        expect(withTransaction).toHaveBeenCalledTimes(1);
        const [tx] = transactions;
        expect(ticketRepository.nextCodeNumber).toHaveBeenCalledWith(tx);
        expect(ticketRepository.create).toHaveBeenCalledWith(expect.any(Object), tx);
        expect(ticketStatusLogRepository.create).toHaveBeenCalledWith(expect.any(Object), tx);
    });

    test('NFR4 dữ liệu sai: lỗi ở bước ghi lịch sử được ném ra khỏi giao dịch (để withTransaction rollback)', async () => {
        const { ticketService, ticketStatusLogRepository, withTransaction } = createService();
        const failure = new Error('mất kết nối khi ghi lịch sử');
        ticketStatusLogRepository.create.mockRejectedValueOnce(failure);

        const err = await captureError(ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW));

        expect(err).toBe(failure);
        expect(withTransaction).toHaveBeenCalledTimes(1);
        await expect(withTransaction.mock.results[0].value).rejects.toBe(failure);
    });

    test('QT-14 luồng đúng: trung tâm của phiếu lấy từ JWT người gọi', async () => {
        const { ticketService } = createService();

        const { ticket } = await ticketService.createTicket(OTHER_CENTER_RECEPTIONIST, INPUT, KEY, NOW);

        expect(ticket.center_id).toBe(1);
    });

    test('US5-AC6 luồng đúng: Cao 10:00 thứ Bảy → hạn 10:00 thứ Hai', async () => {
        const { ticketService } = createService();

        const { ticket } = await ticketService.createTicket(
            RECEPTIONIST,
            { ...INPUT, priority: Priority.CAO },
            KEY,
            vn('2026-10-10T10:00'),
        );

        expect(ticket.due_date).toBe('2026-10-12T10:00:00+07:00');
    });
});

describe('TicketService – nhóm sự cố và mức ưu tiên (FR7, FR8, Q10)', () => {
    test('FR8 luồng đúng: không chọn mức → lấy mặc định của nhóm (Màn hình = CAO, hạn 24 giờ)', async () => {
        const { ticketService } = createService();

        const { ticket } = await ticketService.createTicket(RECEPTIONIST, { ...INPUT, category_id: 1, priority: null }, KEY, NOW);

        expect(ticket.priority).toBe(Priority.CAO);
        expect(ticket.due_date).toBe('2026-10-09T14:30:00+07:00');
    });

    test('FR8 luồng đúng: nhân viên đổi mức → giữ mức đã chọn, không lấy mặc định của nhóm', async () => {
        const { ticketService } = createService();

        const { ticket } = await ticketService.createTicket(RECEPTIONIST, { ...INPUT, category_id: 1, priority: Priority.THAP }, KEY, NOW);

        expect(ticket.priority).toBe(Priority.THAP);
    });

    test('FR7 giá trị biên: không chọn nhóm → chưa phân loại (null), mức Trung bình', async () => {
        const { ticketService } = createService();

        const { ticket } = await ticketService.createTicket(RECEPTIONIST, { ...INPUT, category_id: null, priority: null }, KEY, NOW);

        expect(ticket.category_id).toBeNull();
        expect(ticket.priority).toBe(Priority.TRUNG_BINH);
    });

    test('FR8 luồng đúng: resolvePriority – chọn mức > mặc định của nhóm > Trung bình', () => {
        expect(resolvePriority(Priority.THAP, { default_priority: Priority.CAO })).toBe(Priority.THAP);
        expect(resolvePriority(null, { default_priority: Priority.CAO })).toBe(Priority.CAO);
        expect(resolvePriority(null, null)).toBe(Priority.TRUNG_BINH);
    });

    test('Q10 dữ liệu sai: nhóm đã ngừng dùng hoặc không tồn tại → VALIDATION_FAILED kèm category_id, không ghi phiếu', async () => {
        const { ticketService, ticketRepository } = createService();

        for (const categoryId of [4, 999]) {
            const err = await captureError(ticketService.createTicket(RECEPTIONIST, { ...INPUT, category_id: categoryId }, KEY, NOW));
            expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
            expect(Object.keys(err.details)).toEqual(['category_id']);
        }
        expect(ticketRepository.create).not.toHaveBeenCalled();
    });
});

describe('TicketService – tình trạng bảo hành lưu vào phiếu (QT-05, Q3)', () => {
    test('US4-AC3 luồng đúng: thiết bị không có ngày mua → CHUA_XAC_MINH (chờ Quản lý quyết định)', async () => {
        const { ticketService } = createService();

        const { ticket } = await ticketService.createTicket(RECEPTIONIST, { ...INPUT, device_id: 3350 }, KEY, NOW);

        expect(ticket.warranty_status).toBe(WarrantyStatus.CHUA_XAC_MINH);
    });

    test('US4-AC2 luồng đúng: thiết bị hết hạn → vẫn lập được phiếu, HET_BAO_HANH (có tính phí)', async () => {
        const { ticketService } = createService();

        const { ticket } = await ticketService.createTicket(RECEPTIONIST, { ...INPUT, customer_id: 1025, device_id: 3360 }, KEY, NOW);

        expect(ticket.warranty_status).toBe(WarrantyStatus.HET_BAO_HANH);
    });

    test('US4-AC1 giá trị biên: tính tại thời điểm tiếp nhận – 23:59 ngày 05/03/2027 còn, 00:00 ngày 06/03/2027 hết', async () => {
        const first = createService();
        const second = createService();

        const stillCovered = await first.ticketService.createTicket(RECEPTIONIST, INPUT, KEY, vn('2027-03-05T23:59'));
        const expired = await second.ticketService.createTicket(RECEPTIONIST, INPUT, KEY, vn('2027-03-06T00:00'));

        expect(stillCovered.ticket.warranty_status).toBe(WarrantyStatus.CON_BAO_HANH);
        expect(expired.ticket.warranty_status).toBe(WarrantyStatus.HET_BAO_HANH);
    });
});

describe('TicketService – khách, thiết bị, vai trò (QT-03, D3)', () => {
    test('US5-AC3 dữ liệu sai: thiết bị không thuộc khách → BUSINESS_RULE_VIOLATION, không ghi phiếu', async () => {
        const { ticketService, ticketRepository } = createService();

        const err = await captureError(ticketService.createTicket(RECEPTIONIST, { ...INPUT, customer_id: 1025 }, KEY, NOW));

        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(err.message).toBe('Thiết bị không thuộc khách hàng này');
        expect(ticketRepository.create).not.toHaveBeenCalled();
    });

    test('FR6 dữ liệu sai: khách hoặc thiết bị không tồn tại → NOT_FOUND', async () => {
        const { ticketService } = createService();

        const noCustomer = await captureError(ticketService.createTicket(RECEPTIONIST, { ...INPUT, customer_id: 9999 }, KEY, NOW));
        const noDevice = await captureError(ticketService.createTicket(RECEPTIONIST, { ...INPUT, device_id: 9999 }, KEY, NOW));

        expect(noCustomer.code).toBe(ErrorCode.NOT_FOUND);
        expect(noCustomer.message).toBe('Không tìm thấy khách hàng');
        expect(noDevice.code).toBe(ErrorCode.NOT_FOUND);
        expect(noDevice.message).toBe('Không tìm thấy thiết bị');
    });

    test('FR6 dữ liệu sai: Quản lý hoặc không có người gọi → FORBIDDEN, không đọc khóa chống trùng', async () => {
        const { ticketService, ticketRepository } = createService();

        for (const caller of [MANAGER, undefined]) {
            const err = await captureError(ticketService.createTicket(caller, INPUT, KEY, NOW));
            expect(err.code).toBe(ErrorCode.FORBIDDEN);
        }
        expect(ticketRepository.findByIdempotencyKey).not.toHaveBeenCalled();
    });
});

describe('TicketService – chống lưu trùng bằng Idempotency-Key (NFR4, Q12)', () => {
    test('NFR4 luồng đúng: gửi lại cùng khóa → trả phiếu cũ (created = false), không lập phiếu thứ hai', async () => {
        const { ticketService, ticketRepository, ticketStatusLogRepository } = createService();
        const first = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW);

        const second = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, vn('2026-10-08T14:31'));

        expect(second).toEqual({ created: false, ticket: first.ticket });
        expect(ticketRepository.rows).toHaveLength(1);
        expect(ticketStatusLogRepository.rows).toHaveLength(1);
        expect(ticketRepository.nextCodeNumber).toHaveBeenCalledTimes(1);
    });

    test('Q12 giá trị biên: gửi lại cùng khóa với body khác → vẫn trả phiếu cũ, không so lại body', async () => {
        const { ticketService, ticketRepository } = createService();
        const first = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW);

        const second = await ticketService.createTicket(RECEPTIONIST, { ...INPUT, customer_id: 1025, device_id: 9999 }, KEY, NOW);

        expect(second.ticket).toEqual(first.ticket);
        expect(ticketRepository.rows).toHaveLength(1);
    });

    test('Q12 dữ liệu sai: khóa đã dùng cho phiếu của trung tâm khác → CONFLICT, không lộ phiếu đó', async () => {
        const { ticketService, ticketRepository } = createService();
        await ticketService.createTicket(OTHER_CENTER_RECEPTIONIST, INPUT, KEY, NOW);

        const err = await captureError(ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW));

        expect(err.code).toBe(ErrorCode.CONFLICT);
        expect(err.details).toBeUndefined();
        expect(ticketRepository.rows).toHaveLength(1);
    });

    test('NFR4 giá trị biên: hai yêu cầu cùng khóa đồng thời – lần ghi sau vướng UNIQUE → đọc lại, trả phiếu đã lập', async () => {
        const { ticketService, ticketRepository } = createService();
        const winner = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW);
        // Yêu cầu thứ hai đọc khóa trước khi yêu cầu thứ nhất commit nên chưa thấy phiếu.
        ticketRepository.findByIdempotencyKey.mockResolvedValueOnce(null);

        const loser = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW);

        expect(loser).toEqual({ created: false, ticket: winner.ticket });
        expect(ticketRepository.rows).toHaveLength(1);
    });

    test('Q12 giá trị biên: đồng thời cùng khóa nhưng phiếu thắng thuộc trung tâm khác → CONFLICT', async () => {
        const { ticketService, ticketRepository } = createService();
        await ticketService.createTicket(OTHER_CENTER_RECEPTIONIST, INPUT, KEY, NOW);
        ticketRepository.findByIdempotencyKey.mockResolvedValueOnce(null);

        const err = await captureError(ticketService.createTicket(RECEPTIONIST, INPUT, KEY, NOW));

        expect(err.code).toBe(ErrorCode.CONFLICT);
    });

    test('NFR4 dữ liệu sai: trùng UNIQUE khác (không có phiếu nào mang khóa này) → ném lại lỗi gốc', async () => {
        const { ticketService, ticketRepository } = createService();
        const duplicateCode = new DuplicateKeyError('ticket_ticket_code_key');
        ticketRepository.create.mockRejectedValueOnce(duplicateCode);

        const err = await captureError(ticketService.createTicket(RECEPTIONIST, INPUT, OTHER_KEY, NOW));

        expect(err).toBe(duplicateCode);
    });
});

describe('formatTicketCode – mã phiếu (Q11)', () => {
    test('Q11 luồng đúng: BH + 6 chữ số + / + năm tiếp nhận', () => {
        expect(formatTicketCode(231, NOW)).toBe('BH000231/2026');
    });

    test('Q11 giá trị biên: số 1 và 999999 vẫn đủ 6 chữ số', () => {
        expect(formatTicketCode(1, NOW)).toBe('BH000001/2026');
        expect(formatTicketCode(999999, NOW)).toBe('BH999999/2026');
    });

    test('Q11 giá trị biên: năm theo giờ Việt Nam – 23:59 ngày 31/12 là năm cũ, 00:00 ngày 01/01 là năm mới', () => {
        expect(formatTicketCode(301, vn('2026-12-31T23:59'))).toBe('BH000301/2026');
        // 17:00 ngày 31/12 UTC đã là 00:00 ngày 01/01/2027 ở Việt Nam.
        expect(formatTicketCode(302, new Date('2026-12-31T17:00:00Z'))).toBe('BH000302/2027');
    });

    test('Q11 luồng đúng: sequence chung không đánh lại theo năm – phiếu đầu năm 2027 nối tiếp số cuối năm 2026', async () => {
        const { ticketService } = createService();

        const last2026 = await ticketService.createTicket(RECEPTIONIST, INPUT, KEY, vn('2026-12-31T16:00'));
        const first2027 = await ticketService.createTicket(RECEPTIONIST, INPUT, OTHER_KEY, vn('2027-01-02T08:00'));

        expect(last2026.ticket.ticket_code).toBe('BH000231/2026');
        expect(first2027.ticket.ticket_code).toBe('BH000232/2027');
    });
});
