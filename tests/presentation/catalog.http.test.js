'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');

// Test qua HTTP với repository giả, không cần CSDL (D4): validator + service + ErrorMapper
// ghép lại trả đúng mã HTTP và cấu trúc lỗi của api-contract 3.6, 3.11.

async function loginAs(username, deps = createTestDeps()) {
    const agent = request.agent(createApp(deps));
    await agent.post('/api/auth/login').send({ username, password: TEST_PASSWORD }).expect(200);
    return agent;
}

const asReceptionist = (deps) => loginAs('lan.q10', deps);
const asManager = (deps) => loginAs('hung.q10', deps);

describe('Danh mục sản phẩm – API 11–14', () => {
    test('HT2 dữ liệu sai: chưa đăng nhập gọi GET /api/products → 401', async () => {
        const res = await request(createApp(createTestDeps())).get('/api/products');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('HT2 luồng đúng: Tiếp nhận đọc → 200 { items, total }, chỉ mục đang dùng dù gửi include_inactive', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/products?include_inactive=true');

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        expect(res.body.items[0]).toEqual({
            product_id: 1,
            product_name: 'Oppo A78',
            default_warranty_months: 12,
            is_active: true,
        });
    });

    test('HT2 luồng đúng: Quản lý thêm → 201; thêm lại cùng tên → 409 CONFLICT', async () => {
        const agent = await asManager();

        const created = await agent.post('/api/products').send({ product_name: 'Oppo A79', default_warranty_months: 18 });
        const duplicate = await agent.post('/api/products').send({ product_name: ' Oppo A79 ' });

        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({ product_name: 'Oppo A79', default_warranty_months: 18, is_active: true });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.error.code).toBe('CONFLICT');
        expect(duplicate.body.error).not.toHaveProperty('fields');
    });

    test('HT2 dữ liệu sai: Tiếp nhận thêm sản phẩm → 403 FORBIDDEN', async () => {
        const deps = createTestDeps();
        const agent = await asReceptionist(deps);

        const res = await agent.post('/api/products').send({ product_name: 'Oppo A79', default_warranty_months: 12 });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        expect(deps.repositories.product.create).not.toHaveBeenCalled();
    });

    test('HT2 dữ liệu sai: thiếu tên, số tháng 61 → 400, fields có đủ hai trường', async () => {
        const agent = await asManager();

        const res = await agent.post('/api/products').send({ default_warranty_months: 61 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(Object.keys(res.body.error.fields).sort()).toEqual(['default_warranty_months', 'product_name']);
    });

    test('HT2 luồng đúng: PUT sửa → 200; PUT mã không tồn tại → 404; mã không phải số → 404', async () => {
        const agent = await asManager();
        const body = { product_name: 'Oppo A78', default_warranty_months: 24 };

        const updated = await agent.put('/api/products/1').send(body);
        const missing = await agent.put('/api/products/999').send(body);
        const notNumber = await agent.put('/api/products/abc').send(body);

        expect(updated.status).toBe(200);
        expect(updated.body).toMatchObject({ product_id: 1, default_warranty_months: 24 });
        expect(missing.status).toBe(404);
        expect(notNumber.status).toBe(404);
    });

    test('QT-13 luồng đúng: DELETE → 200 is_active false; danh sách mặc định không còn, include_inactive còn', async () => {
        const agent = await asManager();

        const deleted = await agent.delete('/api/products/1');
        const defaultList = await agent.get('/api/products');
        const fullList = await agent.get('/api/products?include_inactive=true');

        expect(deleted.status).toBe(200);
        expect(deleted.body).toMatchObject({ product_id: 1, is_active: false });
        expect(defaultList.body.items.map((p) => p.product_id)).not.toContain(1);
        expect(fullList.body.items.map((p) => p.product_id)).toContain(1);
    });
});

describe('Danh mục nhóm sự cố – API 6, 15–17', () => {
    test('US6 luồng đúng: GET /api/issue-categories → 200 đúng cấu trúc contract 3.6', async () => {
        const agent = await asReceptionist();

        const res = await agent.get('/api/issue-categories');

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(3);
        expect(res.body.items[2]).toEqual({
            category_id: 3,
            category_name: 'Sạc',
            default_priority: 'TRUNG_BINH',
            is_active: true,
        });
    });

    test('NFR5 luồng đúng: Quản lý thêm nhóm (201) → Tiếp nhận thấy ngay ở API 6', async () => {
        const deps = createTestDeps();
        const manager = await asManager(deps);
        const receptionist = await asReceptionist(deps);

        const created = await manager.post('/api/issue-categories').send({ category_name: 'Loa, micro', default_priority: 'THAP' });
        const list = await receptionist.get('/api/issue-categories');

        expect(created.status).toBe(201);
        expect(list.body.items.map((c) => c.category_name)).toContain('Loa, micro');
    });

    test('HT2 dữ liệu sai: Tiếp nhận sửa, ngừng dùng nhóm → 403', async () => {
        const agent = await asReceptionist();

        const updated = await agent.put('/api/issue-categories/1').send({ category_name: 'Màn hình', default_priority: 'THAP' });
        const deleted = await agent.delete('/api/issue-categories/1');

        expect(updated.status).toBe(403);
        expect(deleted.status).toBe(403);
    });

    test('HT2 dữ liệu sai: default_priority sai → 400 fields.default_priority; DELETE mã không tồn tại → 404', async () => {
        const agent = await asManager();

        const invalid = await agent.post('/api/issue-categories').send({ category_name: 'Loa', default_priority: 'GAP' });
        const missing = await agent.delete('/api/issue-categories/999');

        expect(invalid.status).toBe(400);
        expect(Object.keys(invalid.body.error.fields)).toEqual(['default_priority']);
        expect(missing.status).toBe(404);
        expect(missing.body.error.code).toBe('NOT_FOUND');
    });
});
