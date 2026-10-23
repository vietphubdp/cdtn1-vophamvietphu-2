'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');
const { createFakeTicketRepository } = require('../helpers/fakeTicket');

// Test qua HTTP với repository giả, không cần CSDL (D4): validator + TicketService + ErrorMapper
// ghép lại trả đúng mã HTTP và cấu trúc của api-contract 3.7, mục 4.
// Đồng hồ cố định 14:30 thứ Năm 08/10/2026 giờ Việt Nam, khớp ví dụ của contract.

const NOW = new Date('2026-10-08T14:30:00+07:00');
const KEY = '7f3c2a10-9b4e-4c1d-8a2f-5e6d7c8b9a01';
const BODY = Object.freeze({
    customer_id: 1024,
    device_id: 3311,
    issue_desc: 'Máy không nhận sạc, cắm sạc báo lỗi phụ kiện',
    category_id: 3,
    priority: 'TRUNG_BINH',
});

function createDeps(overrides) {
    return createTestDeps({ now: () => NOW, ...overrides });
}

async function loginAs(username, deps = createDeps()) {
    const agent = request.agent(createApp(deps));
    await agent.post('/api/auth/login').send({ username, password: TEST_PASSWORD }).expect(200);
    return agent;
}

const asReceptionist = (deps) => loginAs('lan.q10', deps);

describe('Lập phiếu – API 7', () => {
    test('US5 dữ liệu sai: chưa đăng nhập → 401', async () => {
        const res = await request(createApp(createDeps())).post('/api/tickets').set('Idempotency-Key', KEY).send(BODY);

        expect(res.status).toBe(401);
    });

    test('US5-AC1 luồng đúng: Tiếp nhận lập phiếu → 201 đúng ví dụ api-contract 3.7', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send(BODY);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
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
        });
    });

    test('NFR4 luồng đúng (ngoại lệ 9c): gửi lại cùng Idempotency-Key → 200, cùng phiếu, không lập phiếu thứ hai', async () => {
        const deps = createDeps();
        const agent = await asReceptionist(deps);
        const first = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send(BODY);

        const retry = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send(BODY);

        expect(retry.status).toBe(200);
        expect(retry.body).toEqual(first.body);
        expect(deps.repositories.ticket.rows).toHaveLength(1);
    });

    test('Q12 dữ liệu sai: khóa đã dùng cho phiếu của trung tâm khác → 409 CONFLICT', async () => {
        const ticket = createFakeTicketRepository([{ ticket_id: 5001, center_id: 1, idempotency_key: KEY }]);
        const deps = createDeps();
        deps.repositories.ticket = ticket;
        const agent = await asReceptionist(deps);

        const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send(BODY);

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('CONFLICT');
        expect(JSON.stringify(res.body)).not.toContain('5001');
    });

    test('US5-AC2 dữ liệu sai: mô tả dưới 10 ký tự → 400, nêu rõ trường issue_desc', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send({ ...BODY, issue_desc: 'Hỏng loa' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatchObject({
            code: 'VALIDATION_FAILED',
            fields: { issue_desc: 'Mô tả lỗi phải có từ 10 đến 2000 ký tự' },
        });
    });

    test('NFR4 dữ liệu sai: thiếu Idempotency-Key → 400 kèm fields.idempotency_key', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/tickets').send(BODY);

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.error.fields)).toEqual(['idempotency_key']);
    });

    test('Q10 dữ liệu sai: nhóm sự cố đã ngừng dùng → 400 kèm fields.category_id', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send({ ...BODY, category_id: 4 });

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.error.fields)).toEqual(['category_id']);
    });

    test('US5-AC3 dữ liệu sai: thiết bị không thuộc khách → 422 BUSINESS_RULE_VIOLATION', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send({ ...BODY, customer_id: 1025 });

        expect(res.status).toBe(422);
        expect(res.body).toEqual({
            error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Thiết bị không thuộc khách hàng này' },
        });
    });

    test('FR6 dữ liệu sai: khách hoặc thiết bị không tồn tại → 404 NOT_FOUND', async () => {
        const agent = await asReceptionist();

        for (const body of [{ ...BODY, customer_id: 9999 }, { ...BODY, device_id: 9999 }]) {
            const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send(body);
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        }
    });

    test('FR6 dữ liệu sai: Quản lý lập phiếu → 403 FORBIDDEN', async () => {
        const agent = await loginAs('hung.q10');

        const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send(BODY);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('NFR4 dữ liệu sai: lỗi khi ghi lịch sử → 500 thông báo chung, không lộ chi tiết, lỗi được ghi log', async () => {
        const deps = createDeps();
        deps.repositories.ticketStatusLog.create.mockRejectedValueOnce(new Error('relation "ticket_status_log" lỗi giả'));
        const agent = await asReceptionist(deps);

        const res = await agent.post('/api/tickets').set('Idempotency-Key', KEY).send(BODY);

        expect(res.status).toBe(500);
        expect(res.body.error.code).toBe('INTERNAL_ERROR');
        expect(JSON.stringify(res.body)).not.toContain('ticket_status_log');
        expect(deps.logger.error).toHaveBeenCalled();
    });
});
