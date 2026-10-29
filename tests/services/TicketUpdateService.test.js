'use strict';

const {
    createTicketUpdateService,
    canEditTicket,
    canCancelTicket,
    canDecideWarranty,
} = require('../../src/services/TicketUpdateService');
const { ErrorCode } = require('../../src/errors/AppError');
const { Role, Priority, TicketStatus, WarrantyStatus } = require('../../src/domain/constants');
const { createFakeDeviceRepository } = require('../helpers/fakeDevice');
const { createFakeIssueCategoryRepository } = require('../helpers/fakeCatalog');
const {
    createFakeTicketRepository,
    createDetailTicket,
    createFakeTicketStatusLogRepository,
    createFakeTicketEditLogRepository,
    createFakeTransactionRunner,
} = require('../helpers/fakeTicket');

// Unit test TicketUpdateService (TĐ-02, TĐ-03: QT-16 sửa phiếu, QT-06 hủy phiếu, QT-17 quyết định bảo hành)
// với repository giả, không cần CSDL. `now` truyền vào. Khẳng định mã nghiệp vụ, không khẳng định mã HTTP.
// Phiếu mặc định (createDetailTicket): 88231 của trung tâm 2, khách 1024, thiết bị 3311 (còn bảo hành), nhóm 3 Sạc,
// Trung bình, tiếp nhận 14:30 thứ Năm 08/10/2026 → hạn 14:30 thứ Hai 12/10/2026.
// Thiết bị giả: 3311, 3350 (không có ngày mua) của khách 1024; 3360 của khách 1025. Nhóm 4 đã ngừng dùng.

const RECEPTIONIST = { employee_id: 7, role: Role.TIEP_NHAN, center_id: 2 };
const MANAGER = { employee_id: 8, role: Role.QUAN_LY_TRUNG_TAM, center_id: 2 };
const OTHER_CENTER_MANAGER = { employee_id: 9, role: Role.QUAN_LY_TRUNG_TAM, center_id: 1 };

const vn = (local) => new Date(`${local}:00+07:00`);
const NOW = vn('2026-10-09T10:00');
const TICKET_ID = 88231;
const REASON = 'Chọn nhầm khi lập phiếu';

function createService(ticketOverrides = {}) {
    const ticketRepository = createFakeTicketRepository([createDetailTicket(ticketOverrides)]);
    const ticketStatusLogRepository = createFakeTicketStatusLogRepository();
    const ticketEditLogRepository = createFakeTicketEditLogRepository();
    const { withTransaction, transactions } = createFakeTransactionRunner();
    const service = createTicketUpdateService({
        ticketRepository,
        ticketStatusLogRepository,
        ticketEditLogRepository,
        deviceRepository: createFakeDeviceRepository(),
        issueCategoryRepository: createFakeIssueCategoryRepository(),
        withTransaction,
    });
    return { service, ticketRepository, ticketStatusLogRepository, ticketEditLogRepository, transactions };
}

async function captureError(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('TicketUpdateService – sửa phiếu (API 19, QT-16)', () => {
    test('QT-16 luồng đúng: Tiếp nhận đổi Trung bình → Cao, hạn cam kết tính lại từ lúc tiếp nhận (QT-04), ghi lịch sử kèm lý do trong cùng giao dịch', async () => {
        const { service, ticketRepository, ticketEditLogRepository, transactions } = createService();

        const result = await service.updateTicket(RECEPTIONIST, TICKET_ID, { priority: Priority.CAO, reason: REASON }, NOW);

        // Cao 24 giờ từ 14:30 thứ Năm → 14:30 thứ Sáu, không tính từ lúc sửa.
        expect(result.priority).toBe('CAO');
        expect(result.due_date).toBe('2026-10-09T14:30:00+07:00');
        expect(result.received_at).toBe('2026-10-08T14:30:00+07:00');
        expect(ticketEditLogRepository.rows).toEqual([
            {
                edit_id: 1,
                ticket_id: TICKET_ID,
                changed_at: NOW,
                changed_by: 7,
                changes: {
                    priority: { from: 'TRUNG_BINH', to: 'CAO' },
                    due_date: { from: '2026-10-12T14:30:00+07:00', to: '2026-10-09T14:30:00+07:00' },
                },
                reason: REASON,
            },
        ]);
        expect(transactions).toHaveLength(1);
        expect(ticketRepository.update.mock.calls[0][2]).toBe(transactions[0]);
        expect(ticketEditLogRepository.create.mock.calls[0][1]).toBe(transactions[0]);
    });

    test('QT-16 luồng đúng: Quản lý trung tâm cũng sửa được mô tả lỗi, mã phiếu và khách không đổi', async () => {
        const { service, ticketRepository } = createService();

        const result = await service.updateTicket(
            MANAGER,
            TICKET_ID,
            { issue_desc: 'Máy không nhận sạc, chân sạc bị lỏng', reason: 'Bổ sung mô tả sau khi kiểm tra' },
            NOW,
        );

        expect(result.ticket_code).toBe('BH000231/2026');
        expect(result.customer_id).toBe(1024);
        expect(ticketRepository.rows[0].issue_desc).toBe('Máy không nhận sạc, chân sạc bị lỏng');
    });

    test('QT-16 + QT-05 luồng đúng: đổi sang thiết bị không có ngày mua → tình trạng tính lại thành Chưa xác minh', async () => {
        const { service, ticketEditLogRepository } = createService();

        const result = await service.updateTicket(RECEPTIONIST, TICKET_ID, { device_id: 3350, reason: REASON }, NOW);

        expect(result.device_id).toBe(3350);
        expect(result.warranty_status).toBe(WarrantyStatus.CHUA_XAC_MINH);
        expect(ticketEditLogRepository.rows[0].changes).toEqual({
            serial_no: { from: 'SN-A55-778901', to: '358240051111110' },
            warranty_status: { from: 'CON_BAO_HANH', to: 'CHUA_XAC_MINH' },
        });
    });

    test('QT-16 luồng đúng: category_id null → bỏ phân loại, lịch sử ghi tên nhóm cũ', async () => {
        const { service, ticketEditLogRepository } = createService();

        const result = await service.updateTicket(RECEPTIONIST, TICKET_ID, { category_id: null, reason: REASON }, NOW);

        expect(result.category_id).toBeNull();
        expect(ticketEditLogRepository.rows[0].changes).toEqual({ category_name: { from: 'Sạc', to: null } });
    });

    test('QT-16 giá trị biên: giữ nguyên nhóm đã ngừng dùng của phiếu (không đổi) vẫn sửa được trường khác', async () => {
        const { service } = createService({ category_id: 4, category_name: 'Nhóm cũ' });

        const result = await service.updateTicket(
            RECEPTIONIST,
            TICKET_ID,
            { category_id: 4, issue_desc: 'Mô tả mới đủ mười ký tự', reason: REASON },
            NOW,
        );

        expect(result.category_id).toBe(4);
    });

    test('QT-16 giá trị biên: phiếu Đã phân công (bước ngay sau Mới) không sửa được, không ghi gì', async () => {
        const { service, ticketRepository, ticketEditLogRepository } = createService({ status: TicketStatus.DA_PHAN_CONG });

        const err = await captureError(service.updateTicket(RECEPTIONIST, TICKET_ID, { priority: Priority.CAO, reason: REASON }, NOW));

        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(err.message).toContain('"Đã phân công"');
        expect(ticketRepository.update).not.toHaveBeenCalled();
        expect(ticketEditLogRepository.rows).toHaveLength(0);
    });

    test('QT-16 dữ liệu sai: gửi lại đúng giá trị hiện tại → báo không có thay đổi, không ghi lịch sử', async () => {
        const { service, ticketEditLogRepository } = createService();

        const err = await captureError(
            service.updateTicket(RECEPTIONIST, TICKET_ID, { priority: Priority.TRUNG_BINH, category_id: 3, device_id: 3311, reason: REASON }, NOW),
        );

        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(ticketEditLogRepository.rows).toHaveLength(0);
    });

    test('QT-03 dữ liệu sai: đổi sang thiết bị của khách khác → BUSINESS_RULE_VIOLATION, phiếu giữ nguyên', async () => {
        const { service, ticketRepository } = createService();

        const err = await captureError(service.updateTicket(RECEPTIONIST, TICKET_ID, { device_id: 3360, reason: REASON }, NOW));

        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(err.message).toBe('Thiết bị không thuộc khách hàng của phiếu này');
        expect(ticketRepository.rows[0].device_id).toBe(3311);
    });

    test('QT-16 dữ liệu sai: thiết bị không tồn tại → NOT_FOUND', async () => {
        const { service } = createService();

        const err = await captureError(service.updateTicket(RECEPTIONIST, TICKET_ID, { device_id: 999999, reason: REASON }, NOW));

        expect(err.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('FR7 dữ liệu sai: đổi sang nhóm đã ngừng dùng → VALIDATION_FAILED kèm fields.category_id', async () => {
        const { service } = createService();

        const err = await captureError(service.updateTicket(RECEPTIONIST, TICKET_ID, { category_id: 4, reason: REASON }, NOW));

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details)).toEqual(['category_id']);
    });

    test('QT-14 dữ liệu sai: phiếu của trung tâm khác hoặc không tồn tại → NOT_FOUND như nhau', async () => {
        const { service } = createService();

        const otherCenter = await captureError(service.updateTicket(OTHER_CENTER_MANAGER, TICKET_ID, { priority: Priority.CAO, reason: REASON }, NOW));
        const missing = await captureError(service.updateTicket(RECEPTIONIST, 1, { priority: Priority.CAO, reason: REASON }, NOW));

        expect(otherCenter.code).toBe(ErrorCode.NOT_FOUND);
        expect(missing.code).toBe(ErrorCode.NOT_FOUND);
        expect(otherCenter.message).toBe(missing.message);
    });
});

describe('TicketUpdateService – hủy phiếu (API 20, QT-06)', () => {
    test('QT-06 luồng đúng: Quản lý hủy phiếu Mới → Đã hủy, ghi một dòng lịch sử trạng thái kèm lý do', async () => {
        const { service, ticketStatusLogRepository, transactions } = createService();

        const result = await service.cancelTicket(MANAGER, TICKET_ID, { reason: 'Khách đổi ý, nhận lại máy' }, NOW);

        expect(result.status).toBe(TicketStatus.DA_HUY);
        expect(ticketStatusLogRepository.rows).toEqual([
            {
                log_id: 1,
                ticket_id: TICKET_ID,
                from_status: 'MOI',
                to_status: 'DA_HUY',
                changed_at: NOW,
                changed_by: 8,
                note: 'Khách đổi ý, nhận lại máy',
            },
        ]);
        expect(ticketStatusLogRepository.create.mock.calls[0][1]).toBe(transactions[0]);
    });

    test('QT-06 giá trị biên: Đã phân công vẫn hủy được; Đang xử lý (bước kế tiếp) thì không', async () => {
        const assigned = createService({ status: TicketStatus.DA_PHAN_CONG });
        const inProgress = createService({ status: TicketStatus.DANG_XU_LY });

        const result = await assigned.service.cancelTicket(MANAGER, TICKET_ID, { reason: REASON }, NOW);
        const err = await captureError(inProgress.service.cancelTicket(MANAGER, TICKET_ID, { reason: REASON }, NOW));

        expect(result.status).toBe(TicketStatus.DA_HUY);
        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(inProgress.ticketStatusLogRepository.rows).toHaveLength(0);
    });

    test('QT-06 dữ liệu sai: hủy lại phiếu đã hủy → BUSINESS_RULE_VIOLATION (không quay lại trạng thái)', async () => {
        const { service } = createService({ status: TicketStatus.DA_HUY });

        const err = await captureError(service.cancelTicket(MANAGER, TICKET_ID, { reason: REASON }, NOW));

        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(err.message).toContain('"Đã hủy"');
    });

    test('TĐ-03 dữ liệu sai: Tiếp nhận không được hủy phiếu → FORBIDDEN', async () => {
        const { service, ticketRepository } = createService();

        const err = await captureError(service.cancelTicket(RECEPTIONIST, TICKET_ID, { reason: REASON }, NOW));

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
        expect(ticketRepository.findByIdForUpdate).not.toHaveBeenCalled();
    });
});

describe('TicketUpdateService – quyết định bảo hành (API 21, QT-17)', () => {
    test('QT-17 luồng đúng: Quản lý quyết định phiếu Chưa xác minh là Còn bảo hành, ghi lịch sử kèm lý do', async () => {
        const { service, ticketEditLogRepository } = createService({ warranty_status: WarrantyStatus.CHUA_XAC_MINH });

        const result = await service.decideWarranty(
            MANAGER,
            TICKET_ID,
            { warranty_status: WarrantyStatus.CON_BAO_HANH, reason: 'Khách xuất trình hóa đơn' },
            NOW,
        );

        expect(result.warranty_status).toBe(WarrantyStatus.CON_BAO_HANH);
        expect(ticketEditLogRepository.rows[0]).toMatchObject({
            changed_by: 8,
            changes: { warranty_status: { from: 'CHUA_XAC_MINH', to: 'CON_BAO_HANH' } },
            reason: 'Khách xuất trình hóa đơn',
        });
    });

    test('QT-17 dữ liệu sai: phiếu đã có tình trạng (Còn bảo hành) → BUSINESS_RULE_VIOLATION, không đổi', async () => {
        const { service, ticketRepository } = createService();

        const err = await captureError(
            service.decideWarranty(MANAGER, TICKET_ID, { warranty_status: WarrantyStatus.HET_BAO_HANH, reason: REASON }, NOW),
        );

        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(ticketRepository.rows[0].warranty_status).toBe(WarrantyStatus.CON_BAO_HANH);
    });

    test('QT-17 dữ liệu sai: phiếu chưa xác minh nhưng đã hủy → BUSINESS_RULE_VIOLATION', async () => {
        const { service } = createService({ warranty_status: WarrantyStatus.CHUA_XAC_MINH, status: TicketStatus.DA_HUY });

        const err = await captureError(
            service.decideWarranty(MANAGER, TICKET_ID, { warranty_status: WarrantyStatus.HET_BAO_HANH, reason: REASON }, NOW),
        );

        expect(err.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
    });

    test('QT-17 dữ liệu sai: Tiếp nhận không được tự quyết định bảo hành → FORBIDDEN', async () => {
        const { service } = createService({ warranty_status: WarrantyStatus.CHUA_XAC_MINH });

        const err = await captureError(
            service.decideWarranty(RECEPTIONIST, TICKET_ID, { warranty_status: WarrantyStatus.CON_BAO_HANH, reason: REASON }, NOW),
        );

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
    });
});

describe('Cờ thao tác của API 18 (hàm thuần)', () => {
    const ticket = createDetailTicket({ warranty_status: WarrantyStatus.CHUA_XAC_MINH });

    test('TĐ-02, TĐ-03 luồng đúng: Tiếp nhận chỉ sửa; Quản lý sửa, hủy và quyết định bảo hành', () => {
        expect([canEditTicket, canCancelTicket, canDecideWarranty].map((can) => can(RECEPTIONIST, ticket))).toEqual([true, false, false]);
        expect([canEditTicket, canCancelTicket, canDecideWarranty].map((can) => can(MANAGER, ticket))).toEqual([true, true, true]);
    });

    test('QT-14 dữ liệu sai: phiếu của trung tâm khác → không có thao tác nào', () => {
        expect([canEditTicket, canCancelTicket, canDecideWarranty].map((can) => can(OTHER_CENTER_MANAGER, ticket))).toEqual([false, false, false]);
    });

    test('QT-06, QT-16 giá trị biên: phiếu Đã hủy → không sửa, không hủy, không quyết định được nữa', () => {
        const cancelled = { ...ticket, status: TicketStatus.DA_HUY };
        expect([canEditTicket, canCancelTicket, canDecideWarranty].map((can) => can(MANAGER, cancelled))).toEqual([false, false, false]);
    });
});
