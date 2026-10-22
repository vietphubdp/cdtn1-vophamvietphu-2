'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');

// Test qua HTTP với repository giả, không cần CSDL (D4): validator + service + ErrorMapper
// ghép lại trả đúng mã HTTP và cấu trúc của api-contract 3.2, 3.4, 3.5.
// Đồng hồ cố định 14:22 ngày 08/10/2026 giờ Việt Nam để không phụ thuộc ngày chạy test.

const NOW = new Date('2026-10-08T14:22:00+07:00');

function createDeps() {
    return createTestDeps({ now: () => NOW });
}

async function loginAs(username, deps = createDeps()) {
    const agent = request.agent(createApp(deps));
    await agent.post('/api/auth/login').send({ username, password: TEST_PASSWORD }).expect(200);
    return agent;
}

const asReceptionist = (deps) => loginAs('lan.q10', deps);
const asManager = (deps) => loginAs('hung.q10', deps);

describe('Danh sách thiết bị – API 2', () => {
    test('US1 dữ liệu sai: chưa đăng nhập → 401', async () => {
        const res = await request(createApp(createDeps())).get('/api/customers/1024/devices');

        expect(res.status).toBe(401);
    });

    test('US1-AC1 luồng đúng: khách 1024 → 200 { items, total }', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/customers/1024/devices');

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        expect(res.body.items[0]).toEqual({
            device_id: 3311,
            product_name: 'Samsung Galaxy A55',
            serial_no: 'SN-A55-778901',
            purchase_date: '2026-03-05',
        });
    });

    test('US1 dữ liệu sai: khách không tồn tại hoặc mã sai dạng → 404 NOT_FOUND', async () => {
        const agent = await asManager();

        for (const id of ['9999', 'abc']) {
            const res = await agent.get(`/api/customers/${id}/devices`);
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        }
    });
});

describe('Ghi nhận thiết bị – API 4', () => {
    const body = { product_id: 1, serial_no: 'OPA78-55120', purchase_date: null, warranty_months: null };

    test('US3 luồng đúng: Tiếp nhận ghi nhận thiết bị → 201 đúng dạng api-contract 3.4', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/customers/1025/devices').send(body);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
            device_id: 3361,
            customer_id: 1025,
            product_id: 1,
            product_name: 'Oppo A78',
            serial_no: 'OPA78-55120',
            purchase_date: null,
            warranty_months: 12,
            created_at: '2026-10-08T14:20:00+07:00',
        });
    });

    test('QT-03 dữ liệu sai: serial đã được ghi nhận → 409 CONFLICT', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/customers/1025/devices').send({ ...body, serial_no: ' SN-A55-778901 ' });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({
            error: { code: 'CONFLICT', message: 'Serial/IMEI đã được ghi nhận cho một thiết bị khác' },
        });
    });

    test('FR4 dữ liệu sai: thiếu serial, ngày mua ngày mai, số tháng 61 → 400 kèm đủ ba trường', async () => {
        const agent = await asReceptionist();

        const res = await agent
            .post('/api/customers/1025/devices')
            .send({ product_id: 1, purchase_date: '2026-10-09', warranty_months: 61 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(Object.keys(res.body.error.fields).sort()).toEqual(['purchase_date', 'serial_no', 'warranty_months']);
    });

    test('HT2 dữ liệu sai: sản phẩm đã ngừng dùng → 400 kèm fields.product_id', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/customers/1025/devices').send({ ...body, product_id: 3 });

        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty('product_id');
    });

    test('US3 dữ liệu sai: khách không tồn tại → 404', async () => {
        const agent = await asReceptionist();

        const res = await agent.post('/api/customers/9999/devices').send(body);

        expect(res.status).toBe(404);
    });

    test('US3 dữ liệu sai: Quản lý ghi nhận thiết bị → 403 FORBIDDEN, không ghi CSDL', async () => {
        const deps = createDeps();
        const agent = await asManager(deps);

        const res = await agent.post('/api/customers/1025/devices').send(body);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        expect(deps.repositories.device.create).not.toHaveBeenCalled();
    });
});

describe('Tình trạng bảo hành – API 5', () => {
    test('US4-AC1 luồng đúng: thiết bị 3311 → 200 đúng ví dụ api-contract 3.5', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/devices/3311/warranty');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            device_id: 3311,
            purchase_date: '2026-03-05',
            warranty_months: 12,
            warranty_expires_on: '2027-03-05',
            warranty_status: 'CON_BAO_HANH',
        });
    });

    test('US4-AC2, AC3 luồng đúng: hết bảo hành và chưa xác minh', async () => {
        const agent = await asManager();

        const expired = await agent.get('/api/devices/3360/warranty');
        const unverified = await agent.get('/api/devices/3350/warranty');

        expect(expired.body.warranty_status).toBe('HET_BAO_HANH');
        expect(unverified.body).toMatchObject({ purchase_date: null, warranty_expires_on: null, warranty_status: 'CHUA_XAC_MINH' });
    });

    test('US4 dữ liệu sai: thiết bị không tồn tại → 404; chưa đăng nhập → 401', async () => {
        const agent = await asReceptionist();

        expect((await agent.get('/api/devices/9999/warranty')).status).toBe(404);
        expect((await request(createApp(createDeps())).get('/api/devices/3311/warranty')).status).toBe(401);
    });
});
