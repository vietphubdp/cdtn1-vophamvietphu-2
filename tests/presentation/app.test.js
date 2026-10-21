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
        expect(logger.error.mock.calls[0][1]).toMatchObject({ method: 'GET', url: '/boom', error: err });
    });
});
