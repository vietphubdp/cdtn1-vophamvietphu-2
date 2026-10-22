'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');

// Test qua HTTP với repository giả, không cần CSDL (D4): validator + service + ErrorMapper
// ghép lại trả đúng mã HTTP và cấu trúc của api-contract 3.1, 3.3.

async function loginAs(username, deps = createTestDeps()) {
    const agent = request.agent(createApp(deps));
    await agent.post('/api/auth/login').send({ username, password: TEST_PASSWORD }).expect(200);
    return agent;
}

const asReceptionist = (deps) => loginAs('lan.q10', deps);
const asManager = (deps) => loginAs('hung.q10', deps);

describe('Tra cứu khách – API 1', () => {
    test('US1 dữ liệu sai: chưa đăng nhập → 401', async () => {
        const res = await request(createApp(createTestDeps())).get('/api/customers?phone=0901234567');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('US1-AC1 luồng đúng: ?phone=%2B84901234567 → 200, Tiếp nhận thấy số đã che', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/customers?phone=%2B84901234567');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            customer_id: 1024,
            full_name: 'Nguyễn Văn An',
            phone: '090****567',
            email: null,
            address: '12 Nguyễn Tri Phương, Quận 10',
        });
    });

    test('QT-15 luồng đúng: Quản lý tra cứu → 200, số đầy đủ', async () => {
        const agent = await asManager();

        const res = await agent.get('/api/customers?phone=0901234567');

        expect(res.status).toBe(200);
        expect(res.body.phone).toBe('0901234567');
    });

    test('US1-AC2 dữ liệu sai: số chưa có → 404 NOT_FOUND', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/customers?phone=0999999999');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy khách hàng' } });
    });

    test('US1-AC3 giá trị biên: số 9 chữ số → 400 kèm fields.phone', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/customers?phone=090123456');

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(res.body.error.fields).toHaveProperty('phone');
    });

    test('US1-AC3 dữ liệu sai: thiếu tham số phone → 400 kèm fields.phone', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/customers');

        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty('phone');
    });
});

describe('Tạo khách – API 3', () => {
    const body = { full_name: 'Lê Văn Cường', phone: '+84 93 123 4888', email: null, address: '45 Lý Thường Kiệt, Quận 10' };

    test('US2 luồng đúng: Tiếp nhận tạo khách → 201, số đã che, created_at giờ Việt Nam', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/customers').send(body);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
            customer_id: 1026,
            full_name: 'Lê Văn Cường',
            phone: '093****888',
            email: null,
            address: '45 Lý Thường Kiệt, Quận 10',
            created_at: '2026-10-08T14:20:00+07:00',
        });
    });

    test('QT-01 dữ liệu sai: số đã tồn tại → 409 kèm details.customer_id, không có fields', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/customers').send({ ...body, phone: '090.123.4567' });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('CONFLICT');
        expect(res.body.error.details).toEqual({ customer_id: 1024 });
        expect(res.body.error).not.toHaveProperty('fields');
    });

    test('US2 dữ liệu sai: thiếu họ tên và số → 400 kèm đủ hai trường', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/customers').send({});

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.error.fields).sort()).toEqual(['full_name', 'phone']);
    });

    test('US2 dữ liệu sai: Quản lý tạo khách → 403 FORBIDDEN, không ghi CSDL', async () => {
        const deps = createTestDeps();
        const agent = await asManager(deps);

        const res = await agent.post('/api/customers').send(body);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        expect(deps.repositories.customer.create).not.toHaveBeenCalled();
    });
});
