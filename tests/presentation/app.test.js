'use strict';

const express = require('express');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { AppError, ErrorCode } = require('../../src/errors/AppError');
const { createErrorMiddleware } = require('../../src/presentation/controllers/ErrorMapper');
const { TEST_PASSWORD, createSilentLogger, createTestDeps } = require('../helpers/fakeAuth');

// Test qua HTTP với createApp(deps), không cần CSDL (D4).

describe('createApp – khung ứng dụng', () => {
    test('A6 smoke test: GET /health → 200 { status: "ok" }', async () => {
        const res = await request(createApp(createTestDeps())).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });

    test('TĐ-06 dữ liệu sai: endpoint /api không tồn tại (đã đăng nhập) → 404 đúng cấu trúc lỗi', async () => {
        const agent = request.agent(createApp(createTestDeps()));
        await agent.post('/api/auth/login').send({ username: 'lan.q10', password: TEST_PASSWORD }).expect(200);

        const res = await agent.get('/api/khong-co');

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('TĐ-06 dữ liệu sai: body JSON hỏng → 400, không ghi log mức error (lỗi người dùng)', async () => {
        const logger = createSilentLogger();

        const res = await request(createApp(createTestDeps({ logger })))
            .post('/api/khong-co')
            .set('Content-Type', 'application/json')
            .send('{"phone": ');

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(logger.error).not.toHaveBeenCalled();
    });
});

describe('Middleware lỗi – phân biệt lỗi người dùng và lỗi hệ thống', () => {
    // App nhỏ có một route ném lỗi, đi qua đúng middleware lỗi dùng trong createApp.
    function appThrowing(err, logger) {
        const app = express();
        app.get('/boom', () => {
            throw err;
        });
        app.use(createErrorMiddleware(logger));
        return app;
    }

    test('TĐ-06 luồng đúng: lỗi người dùng (CONFLICT) → 409 kèm details, không ghi log error', async () => {
        const logger = createSilentLogger();
        const err = new AppError(ErrorCode.CONFLICT, 'Số điện thoại đã tồn tại', { customer_id: 1024 });

        const res = await request(appThrowing(err, logger)).get('/boom');

        expect(res.status).toBe(409);
        expect(res.body).toEqual({
            error: { code: 'CONFLICT', message: 'Số điện thoại đã tồn tại', details: { customer_id: 1024 } },
        });
        expect(logger.error).not.toHaveBeenCalled();
    });

    test('TĐ-06 dữ liệu sai: lỗi hệ thống → 500 chung, có ghi log kèm ngữ cảnh yêu cầu', async () => {
        const logger = createSilentLogger();
        const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');

        const res = await request(appThrowing(err, logger)).get('/boom');

        expect(res.status).toBe(500);
        expect(res.body.error.code).toBe('INTERNAL_ERROR');
        expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error.mock.calls[0][1]).toMatchObject({ method: 'GET', path: '/boom', error: err });
    });
});

describe('BUG-001 – log lỗi hệ thống không chứa số điện thoại khách (QT-15)', () => {
    // Tái lập: tra cứu khách (API 1) mà CSDL lỗi → middleware ghi log URL kèm ?phone=0901234567.
    function depsWithBrokenCustomerLookup() {
        const logger = createSilentLogger();
        const deps = createTestDeps({ logger });
        deps.repositories.customer.findByPhone = jest.fn(async () => {
            throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
        });
        return { deps, logger };
    }

    async function lookupAsReception(deps) {
        const agent = request.agent(createApp(deps));
        await agent.post('/api/auth/login').send({ username: 'lan.q10', password: TEST_PASSWORD }).expect(200);
        return agent.get('/api/customers?phone=0901234567');
    }

    test('BUG-001 dữ liệu sai: lỗi CSDL khi tra cứu → log lỗi ghi đường dẫn, không ghi số điện thoại', async () => {
        const { deps, logger } = depsWithBrokenCustomerLookup();

        const res = await lookupAsReception(deps);

        expect(res.status).toBe(500);
        expect(logger.error).toHaveBeenCalledTimes(1);
        const logged = JSON.stringify(logger.error.mock.calls[0][1]);
        expect(logged).toContain('/api/customers');
        expect(logged).not.toMatch(/0901234567|901234567/);
    });

    test('BUG-001 luồng đúng: lỗi 500 trả mã tra cứu trùng requestId trong log và header X-Request-Id', async () => {
        const { deps, logger } = depsWithBrokenCustomerLookup();

        const res = await lookupAsReception(deps);
        const requestId = res.headers['x-request-id'];

        expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
        expect(res.body.error.message).toContain(`Mã tra cứu: ${requestId}`);
        expect(logger.error.mock.calls[0][1].requestId).toBe(requestId);
    });

    test('TĐ-15 luồng đúng: lỗi người dùng (404 không tìm thấy khách) → log INFO kèm mã lỗi, không có ERROR, không có số', async () => {
        const logger = createSilentLogger();
        const agent = request.agent(createApp(createTestDeps({ logger })));
        await agent.post('/api/auth/login').send({ username: 'lan.q10', password: TEST_PASSWORD }).expect(200);

        const res = await agent.get('/api/customers?phone=0999999999');

        expect(res.status).toBe(404);
        expect(logger.error).not.toHaveBeenCalled();
        const entry = logger.info.mock.calls.map((c) => c[1]).find((c) => c.path === '/api/customers');
        expect(entry).toMatchObject({ method: 'GET', status: 404, error_code: 'NOT_FOUND', requestId: res.headers['x-request-id'] });
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain('0999999999');
    });

    test('TĐ-15 giá trị biên: X-Request-Id gửi kèm có ký tự lạ → bỏ, sinh mã mới', async () => {
        const res = await request(createApp(createTestDeps()))
            .get('/api/khong-co')
            .set('X-Request-Id', 'abc12345 {"level":"error"}');

        expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
});
