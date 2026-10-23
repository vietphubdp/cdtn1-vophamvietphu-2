'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');
const { createFakeTicketRepository, createListTicket } = require('../helpers/fakeTicket');

// Test qua HTTP với repository giả, không cần CSDL (D4): validator + TicketQueryService + ErrorMapper
// ghép lại trả đúng mã HTTP và cấu trúc của api-contract 3.8, mục 4.
// Đồng hồ cố định 09:00 ngày 10/10/2026 giờ Việt Nam, sau hạn của phiếu ví dụ 3.8.

const NOW = new Date('2026-10-10T09:00:00+07:00');

function createDeps(rows = [createListTicket()]) {
    const deps = createTestDeps({ now: () => NOW });
    deps.repositories.ticket = createFakeTicketRepository(rows);
    return deps;
}

async function loginAs(username, deps = createDeps()) {
    const agent = request.agent(createApp(deps));
    await agent.post('/api/auth/login').send({ username, password: TEST_PASSWORD }).expect(200);
    return agent;
}

const asReceptionist = (deps) => loginAs('lan.q10', deps);
const asManager = (deps) => loginAs('hung.q10', deps);

describe('Danh sách phiếu – API 8', () => {
    test('US7 dữ liệu sai: chưa đăng nhập → 401', async () => {
        const res = await request(createApp(createDeps())).get('/api/tickets');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('US7 luồng đúng: Tiếp nhận → 200 đúng ví dụ api-contract 3.8, số bị che', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets?page=1&size=20');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            items: [
                {
                    ticket_id: 88198,
                    ticket_code: 'BH000198/2026',
                    customer_name: 'Trần Thị Bình',
                    phone: '091****321',
                    product_name: 'iPhone 13',
                    serial_no: '358240051111110',
                    category_name: 'Pin',
                    priority: 'CAO',
                    warranty_status: 'CON_BAO_HANH',
                    status: 'DANG_XU_LY',
                    received_at: '2026-10-09T08:10:00+07:00',
                    due_date: '2026-10-10T08:10:00+07:00',
                    is_overdue: true,
                },
            ],
            page: 1,
            size: 20,
            total: 1,
        });
    });

    test('QT-15 luồng đúng: Quản lý trung tâm → số điện thoại đầy đủ', async () => {
        const agent = await asManager();

        const res = await agent.get('/api/tickets');

        expect(res.status).toBe(200);
        expect(res.body.items[0].phone).toBe('0912345321');
    });

    test('QT-14 luồng đúng: không lẫn phiếu trung tâm khác; tham số center_id bị bỏ qua', async () => {
        const deps = createDeps([
            createListTicket({ ticket_id: 1, center_id: 2 }),
            createListTicket({ ticket_id: 2, center_id: 1 }),
        ]);
        const agent = await asReceptionist(deps);

        const res = await agent.get('/api/tickets?center_id=1');

        expect(res.status).toBe(200);
        expect(res.body.items.map((t) => t.ticket_id)).toEqual([1]);
        expect(res.body.total).toBe(1);
        expect(deps.repositories.ticket.listByCenter).toHaveBeenCalledWith(2, { limit: 20, offset: 0 });
    });

    test('FR10 luồng đúng: không gửi page, size → mặc định page 1, size 20', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets');

        expect(res.body).toMatchObject({ page: 1, size: 20, total: 1 });
    });

    test('FR10 giá trị biên: size = 100 → 200', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets?size=100');

        expect(res.status).toBe(200);
        expect(res.body.size).toBe(100);
    });

    test('FR10 giá trị biên: size = 101 → 400 kèm fields.size', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets?size=101');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatchObject({
            code: 'VALIDATION_FAILED',
            fields: { size: 'Số dòng mỗi trang phải từ 1 đến 100' },
        });
    });

    test('FR10 giá trị biên: page = 0 → 400 kèm fields.page', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets?page=0');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatchObject({
            code: 'VALIDATION_FAILED',
            fields: { page: 'Trang phải là số nguyên từ 1' },
        });
    });

    test('FR10 dữ liệu sai: page chữ và size vượt cùng lúc → một 400 gom cả hai trường', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets?page=abc&size=500');

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.error.fields).sort()).toEqual(['page', 'size']);
    });

    test('FR10 dữ liệu sai: gửi page hai lần → 400', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/tickets?page=1&page=2');

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.error.fields)).toEqual(['page']);
    });

    test('FR11 luồng đúng: phiếu quá hạn đánh dấu đúng theo đồng hồ máy chủ, Hoàn tất không đánh dấu', async () => {
        const deps = createDeps([
            createListTicket({ ticket_id: 1, status: 'MOI' }),
            createListTicket({ ticket_id: 2, status: 'HOAN_TAT' }),
            createListTicket({ ticket_id: 3, status: 'MOI', due_date: new Date('2026-10-12T08:10:00+07:00') }),
        ]);
        const agent = await asManager(deps);

        const res = await agent.get('/api/tickets');

        expect(res.body.items.map((t) => [t.ticket_id, t.is_overdue])).toEqual([
            [1, true],
            [2, false],
            [3, false],
        ]);
    });

    test('A6 dữ liệu sai: lỗi CSDL → 500 thông báo chung, không lộ chi tiết', async () => {
        const deps = createDeps();
        deps.repositories.ticket.listByCenter.mockRejectedValueOnce(new Error('relation "ticket" does not exist'));
        const agent = await asReceptionist(deps);

        const res = await agent.get('/api/tickets');

        expect(res.status).toBe(500);
        expect(res.body.error.code).toBe('INTERNAL_ERROR');
        expect(JSON.stringify(res.body)).not.toContain('relation');
    });
});
