'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');
const {
    createFakeTicketRepository,
    createDetailTicket,
    createFakeTicketStatusLogRepository,
} = require('../helpers/fakeTicket');

// Test qua HTTP với repository giả, không cần CSDL (D4): API 18–21 (TĐ-02, TĐ-03) và trang M4.
// validator + TicketQueryService / TicketUpdateService + ErrorMapper trả đúng mã HTTP và cấu trúc lỗi.
// Tài khoản giả lan.q10 (Tiếp nhận) và hung.q10 (Quản lý) cùng trung tâm 2 với phiếu 88231.

const NOW = new Date('2026-10-09T10:00:00+07:00');

function createDeps(ticketOverrides = {}) {
    const deps = createTestDeps({ now: () => NOW });
    deps.repositories.ticket = createFakeTicketRepository([createDetailTicket(ticketOverrides)]);
    deps.repositories.ticketStatusLog = createFakeTicketStatusLogRepository([
        {
            log_id: 1,
            ticket_id: 88231,
            from_status: null,
            to_status: 'MOI',
            changed_at: new Date('2026-10-08T14:30:00+07:00'),
            changed_by: 7,
            note: null,
        },
    ]);
    return deps;
}

async function loginAs(username, deps = createDeps()) {
    const agent = request.agent(createApp(deps));
    await agent.post('/api/auth/login').send({ username, password: TEST_PASSWORD }).expect(200);
    return agent;
}

const asReceptionist = (deps) => loginAs('lan.q10', deps);
const asManager = (deps) => loginAs('hung.q10', deps);

describe('Chi tiết phiếu – API 18', () => {
    test('TĐ-02 luồng đúng: Tiếp nhận thấy số bị che, chỉ được sửa, có dòng lịch sử đầu tiên', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets/88231');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            ticket_code: 'BH000231/2026',
            phone: '090****567',
            category_name: 'Sạc',
            due_date: '2026-10-12T14:30:00+07:00',
            is_overdue: false,
            can_edit: true,
            can_cancel: false,
            can_decide_warranty: false,
            edit_history: [],
        });
        expect(res.body.status_history).toEqual([
            { from_status: null, to_status: 'MOI', changed_at: '2026-10-08T14:30:00+07:00', changed_by_name: 'Trần Thị Lan', note: null },
        ]);
    });

    test('TĐ-03 luồng đúng: Quản lý thấy số đầy đủ và được hủy phiếu', async () => {
        const agent = await asManager();

        const res = await agent.get('/api/tickets/88231');

        expect(res.body.phone).toBe('0901234567');
        expect(res.body.can_cancel).toBe(true);
    });

    test('QT-14 dữ liệu sai: phiếu không thuộc trung tâm mình → 404; mã sai định dạng → 404', async () => {
        const agent = await asReceptionist(createDeps({ center_id: 1 }));

        expect((await agent.get('/api/tickets/88231')).status).toBe(404);
        expect((await agent.get('/api/tickets/abc')).status).toBe(404);
    });
});

describe('Sửa phiếu – API 19 (QT-16)', () => {
    test('QT-16 luồng đúng: PATCH đổi mức ưu tiên → 200, chi tiết có lịch sử sửa kèm người sửa và lý do', async () => {
        const agent = await asReceptionist();

        const res = await agent.patch('/api/tickets/88231').send({ priority: 'CAO', reason: 'Khách cần gấp' });
        const detail = await agent.get('/api/tickets/88231');

        expect(res.status).toBe(200);
        expect(res.body.due_date).toBe('2026-10-09T14:30:00+07:00');
        expect(detail.body.edit_history).toEqual([
            {
                changed_at: '2026-10-09T10:00:00+07:00',
                changed_by_name: 'Trần Thị Lan',
                changes: {
                    priority: { from: 'TRUNG_BINH', to: 'CAO' },
                    due_date: { from: '2026-10-12T14:30:00+07:00', to: '2026-10-09T14:30:00+07:00' },
                },
                reason: 'Khách cần gấp',
            },
        ]);
    });

    test('QT-16 dữ liệu sai: thiếu lý do và mô tả quá ngắn → 400 kèm fields', async () => {
        const agent = await asReceptionist();

        const res = await agent.patch('/api/tickets/88231').send({ issue_desc: 'hỏng' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(Object.keys(res.body.error.fields).sort()).toEqual(['issue_desc', 'reason']);
    });

    test('QT-16 giá trị biên: phiếu không còn ở trạng thái Mới → 422', async () => {
        const agent = await asReceptionist(createDeps({ status: 'DA_PHAN_CONG' }));

        const res = await agent.patch('/api/tickets/88231').send({ priority: 'CAO', reason: 'Khách cần gấp' });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    test('QT-03 dữ liệu sai: đổi sang thiết bị của khách khác → 422', async () => {
        const agent = await asReceptionist();

        const res = await agent.patch('/api/tickets/88231').send({ device_id: 3360, reason: 'Chọn nhầm thiết bị' });

        expect(res.status).toBe(422);
        expect(res.body.error.message).toBe('Thiết bị không thuộc khách hàng của phiếu này');
    });
});

describe('Hủy phiếu – API 20 (QT-06), quyết định bảo hành – API 21 (QT-17)', () => {
    test('QT-06 luồng đúng: Quản lý hủy → 200 DA_HUY; hủy lần hai → 422', async () => {
        const agent = await asManager();

        const first = await agent.post('/api/tickets/88231/cancel').send({ reason: 'Khách đổi ý' });
        const second = await agent.post('/api/tickets/88231/cancel').send({ reason: 'Khách đổi ý' });

        expect(first.status).toBe(200);
        expect(first.body.status).toBe('DA_HUY');
        expect(second.status).toBe(422);
    });

    test('TĐ-03 dữ liệu sai: Tiếp nhận gọi hủy phiếu → 403', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/tickets/88231/cancel').send({ reason: 'Khách đổi ý' });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('QT-17 luồng đúng: Quản lý quyết định phiếu chưa xác minh là Hết bảo hành → 200', async () => {
        const agent = await asManager(createDeps({ warranty_status: 'CHUA_XAC_MINH' }));

        const res = await agent.post('/api/tickets/88231/warranty-decision').send({ warranty_status: 'HET_BAO_HANH', reason: 'Hóa đơn quá hạn' });

        expect(res.status).toBe(200);
        expect(res.body.warranty_status).toBe('HET_BAO_HANH');
    });

    test('QT-17 dữ liệu sai: kết quả không hợp lệ → 400 fields.warranty_status', async () => {
        const agent = await asManager(createDeps({ warranty_status: 'CHUA_XAC_MINH' }));

        const res = await agent.post('/api/tickets/88231/warranty-decision').send({ warranty_status: 'MIEN_PHI', reason: 'Hóa đơn quá hạn' });

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.error.fields)).toEqual(['warranty_status']);
    });
});

describe('Trang M4 – chi tiết phiếu', () => {
    test('TĐ-02 luồng đúng: /tickets/88231 render khung trang; mã sai định dạng → về M3', async () => {
        const agent = await asReceptionist();

        const page = await agent.get('/tickets/88231');
        const invalid = await agent.get('/tickets/abc');

        expect(page.status).toBe(200);
        expect(page.text).toContain('data-ticket-id="88231"');
        expect(page.text).toContain('/public/js/ticket-detail.js');
        expect(invalid.status).toBe(302);
        expect(invalid.headers.location).toBe('/tickets');
    });
});
