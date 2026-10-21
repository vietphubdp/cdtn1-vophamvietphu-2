'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');

// Test qua HTTP với repository giả, không cần CSDL (D4).
const NOW = new Date('2026-10-08T08:00:00+07:00');
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

function createClock(start) {
    let current = start;
    return {
        now: () => current,
        advance(ms) {
            current = new Date(current.getTime() + ms);
        },
    };
}

function findTokenCookie(res) {
    return (res.headers['set-cookie'] || []).find((c) => c.startsWith('token='));
}

describe('POST /api/auth/login – API 9', () => {
    test('HT1 luồng đúng: 200, body đúng contract 3.9, cookie token HttpOnly; SameSite=Strict; Path=/', async () => {
        const res = await request(createApp(createTestDeps({ now: () => NOW })))
            .post('/api/auth/login')
            .send({ username: 'lan.q10', password: TEST_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            employee_id: 7,
            full_name: 'Trần Thị Lan',
            role: 'TIEP_NHAN',
            center_id: 2,
            center_name: 'Trung tâm bảo hành Quận 10',
        });
        const cookie = findTokenCookie(res);
        expect(cookie).toMatch(/^token=[^;]+;/);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Strict');
        expect(cookie).toContain('Path=/');
    });

    test('HT1 dữ liệu sai: thiếu cả hai trường → 400 VALIDATION_FAILED, fields có username và password', async () => {
        const res = await request(createApp(createTestDeps())).post('/api/auth/login').send({});

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(Object.keys(res.body.error.fields).sort()).toEqual(['password', 'username']);
        expect(findTokenCookie(res)).toBeUndefined();
    });

    test('HT1 dữ liệu sai: sai mật khẩu → 401 đúng thông báo contract, không cấp cookie', async () => {
        const res = await request(createApp(createTestDeps()))
            .post('/api/auth/login')
            .send({ username: 'lan.q10', password: 'sai' });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({
            error: { code: 'UNAUTHENTICATED', message: 'Sai tên đăng nhập hoặc mật khẩu' },
        });
        expect(findTokenCookie(res)).toBeUndefined();
    });

    test('HT1 dữ liệu sai: lỗi CSDL khi đăng nhập → 500 chung, không lộ chi tiết', async () => {
        const deps = createTestDeps();
        deps.repositories.employee.findByUsername.mockRejectedValue(new Error('relation "employee" does not exist'));

        const res = await request(createApp(deps))
            .post('/api/auth/login')
            .send({ username: 'lan.q10', password: TEST_PASSWORD });

        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain('employee');
    });
});

describe('POST /api/auth/logout – API 10 và AuthMiddleware', () => {
    test('HT1 luồng đúng: 204, cookie token bị xóa bằng Max-Age=0', async () => {
        const res = await request(createApp(createTestDeps())).post('/api/auth/logout');

        expect(res.status).toBe(204);
        const cookie = findTokenCookie(res);
        expect(cookie).toMatch(/^token=;/);
        expect(cookie).toContain('Max-Age=0');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Strict');
    });

    test('HT1 luồng đúng: đăng nhập → gọi API qua được AuthMiddleware → đăng xuất → gọi lại API bị 401', async () => {
        const agent = request.agent(createApp(createTestDeps()));

        await agent.post('/api/auth/login').send({ username: 'lan.q10', password: TEST_PASSWORD }).expect(200);
        // Chưa có endpoint nghiệp vụ ở GĐ 1: 404 nghĩa là đã qua AuthMiddleware.
        await agent.get('/api/khong-co').expect(404);

        await agent.post('/api/auth/logout').expect(204);

        const res = await agent.get('/api/khong-co');
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('HT1 dữ liệu sai: gọi API không có cookie → 401', async () => {
        const res = await request(createApp(createTestDeps())).get('/api/tickets');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('HT1 giá trị biên: JWT vừa hết 8 giờ → API trả 401', async () => {
        const clock = createClock(NOW);
        const agent = request.agent(createApp(createTestDeps({ now: clock.now })));
        await agent.post('/api/auth/login').send({ username: 'lan.q10', password: TEST_PASSWORD }).expect(200);

        clock.advance(EIGHT_HOURS_MS - 1000);
        await agent.get('/api/khong-co').expect(404);

        clock.advance(1000);
        await agent.get('/api/khong-co').expect(401);
    });
});

describe('Trang đăng nhập và thanh tiêu đề (D5)', () => {
    test('HT1 luồng đúng: GET /login chưa đăng nhập → 200 có form đăng nhập', async () => {
        const res = await request(createApp(createTestDeps())).get('/login');

        expect(res.status).toBe(200);
        expect(res.text).toContain('id="login-form"');
        expect(res.text).toContain('Tên đăng nhập');
    });

    test('HT1 dữ liệu sai: vào trang chủ khi chưa đăng nhập → chuyển về /login', async () => {
        const res = await request(createApp(createTestDeps())).get('/');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    test('HT1 luồng đúng: đã đăng nhập → thanh tiêu đề có tên trung tâm, họ tên, vai trò từ JWT; /login chuyển về /', async () => {
        const deps = createTestDeps();
        const agent = request.agent(createApp(deps));
        await agent.post('/api/auth/login').send({ username: 'lan.q10', password: TEST_PASSWORD }).expect(200);
        deps.repositories.employee.findByUsername.mockClear();

        const home = await agent.get('/');
        expect(home.status).toBe(200);
        expect(home.text).toContain('Trung tâm bảo hành Quận 10 · Trần Thị Lan (Tiếp nhận)');
        expect(home.text).toContain('Đăng xuất');
        expect(deps.repositories.employee.findByUsername).not.toHaveBeenCalled(); // không tra CSDL (D5)

        const login = await agent.get('/login');
        expect(login.status).toBe(302);
        expect(login.headers.location).toBe('/');
    });
});
