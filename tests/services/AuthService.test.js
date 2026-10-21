'use strict';

const jwt = require('jsonwebtoken');
const { createAuthService, INVALID_CREDENTIALS_MESSAGE } = require('../../src/services/AuthService');
const { ErrorCode } = require('../../src/errors/AppError');
const { TEST_PASSWORD, TEST_JWT, createFakeEmployeeRepository } = require('../helpers/fakeAuth');

// Giờ cố định, không phụ thuộc giờ máy: 08:00 thứ Năm 08/10/2026 giờ Việt Nam.
const NOW = new Date('2026-10-08T08:00:00+07:00');
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

function createService() {
    const employeeRepository = createFakeEmployeeRepository();
    return { employeeRepository, authService: createAuthService({ employeeRepository, jwt: TEST_JWT }) };
}

async function captureError(promiseOrFn) {
    try {
        await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('AuthService.login – đăng nhập bằng tài khoản mẫu (HT1)', () => {
    test('HT1 luồng đúng: đúng tên đăng nhập + mật khẩu → trả vai trò, trung tâm và JWT', async () => {
        const { authService } = createService();

        const { token, caller } = await authService.login({ username: 'lan.q10', password: TEST_PASSWORD }, NOW);

        expect(caller).toEqual({
            employee_id: 7,
            full_name: 'Trần Thị Lan',
            role: 'TIEP_NHAN',
            center_id: 2,
            center_name: 'Trung tâm bảo hành Quận 10',
        });
        expect(caller).not.toHaveProperty('password_hash');
        expect(jwt.decode(token)).toMatchObject({ ...caller, iat: Math.floor(NOW.getTime() / 1000) });
    });

    test('HT1 luồng đúng: tài khoản Quản lý nhận đúng vai trò QUAN_LY_TRUNG_TAM', async () => {
        const { authService } = createService();

        const { caller } = await authService.login({ username: 'hung.q10', password: TEST_PASSWORD }, NOW);

        expect(caller.role).toBe('QUAN_LY_TRUNG_TAM');
        expect(caller.center_id).toBe(2);
    });

    test('HT1 dữ liệu sai: sai mật khẩu → UNAUTHENTICATED', async () => {
        const { authService } = createService();

        const err = await captureError(authService.login({ username: 'lan.q10', password: 'sai-mat-khau' }, NOW));

        expect(err.code).toBe(ErrorCode.UNAUTHENTICATED);
        expect(err.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    });

    test('HT1 dữ liệu sai: sai tên đăng nhập và sai mật khẩu cùng mã, cùng thông báo (không lộ phần nào sai)', async () => {
        const { authService } = createService();

        const wrongUser = await captureError(authService.login({ username: 'khong.co', password: TEST_PASSWORD }, NOW));
        const wrongPassword = await captureError(authService.login({ username: 'lan.q10', password: 'sai' }, NOW));

        expect(wrongUser.code).toBe(ErrorCode.UNAUTHENTICATED);
        expect({ code: wrongUser.code, message: wrongUser.message, details: wrongUser.details })
            .toEqual({ code: wrongPassword.code, message: wrongPassword.message, details: wrongPassword.details });
    });

    test('HT1 giá trị biên: mật khẩu khác đúng một ký tự hoa/thường → bị từ chối', async () => {
        const { authService } = createService();

        const err = await captureError(authService.login({ username: 'lan.q10', password: TEST_PASSWORD.toLowerCase() }, NOW));

        expect(err.code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    test('HT1 dữ liệu sai: thiếu jwt.secret → không tạo được service (cấu hình sai, không chạy ngầm)', () => {
        expect(() => createAuthService({ employeeRepository: createFakeEmployeeRepository(), jwt: { secret: '' } }))
            .toThrow('JWT_SECRET');
    });
});

describe('AuthService.verifyToken – xác thực JWT, tạo caller (HT1, D3)', () => {
    async function loginAsLan(authService) {
        const { token } = await authService.login({ username: 'lan.q10', password: TEST_PASSWORD }, NOW);
        return token;
    }

    test('HT1 luồng đúng: JWT hợp lệ → caller có vai trò và trung tâm (chuẩn bị QT-14)', async () => {
        const { authService } = createService();
        const token = await loginAsLan(authService);

        expect(authService.verifyToken(token, NOW)).toEqual({
            employee_id: 7,
            full_name: 'Trần Thị Lan',
            role: 'TIEP_NHAN',
            center_id: 2,
            center_name: 'Trung tâm bảo hành Quận 10',
        });
    });

    test('HT1 giá trị biên: 1 giây trước khi hết 8 giờ → còn hiệu lực', async () => {
        const { authService } = createService();
        const token = await loginAsLan(authService);

        const oneSecondBefore = new Date(NOW.getTime() + EIGHT_HOURS_MS - 1000);

        expect(authService.verifyToken(token, oneSecondBefore).employee_id).toBe(7);
    });

    test('HT1 giá trị biên: đúng thời điểm hết 8 giờ → UNAUTHENTICATED', async () => {
        const { authService } = createService();
        const token = await loginAsLan(authService);

        const expiredAt = new Date(NOW.getTime() + EIGHT_HOURS_MS);

        const err = await captureError(() => authService.verifyToken(token, expiredAt));

        expect(err.code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    test.each([
        ['thiếu token', undefined],
        ['chuỗi rỗng', ''],
        ['không phải JWT', 'abc.def.ghi'],
        ['ký bằng khóa khác', jwt.sign({ employee_id: 7, role: 'QUAN_LY_TRUNG_TAM' }, 'khoa-gia-mao')],
    ])('HT1 dữ liệu sai: %s → UNAUTHENTICATED', async (_label, token) => {
        const { authService } = createService();

        const err = await captureError(() => authService.verifyToken(token, NOW));

        expect(err.code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    test('HT1 dữ liệu sai: JWT dùng thuật toán "none" (không chữ ký) → UNAUTHENTICATED', async () => {
        const { authService } = createService();
        const unsigned = jwt.sign({ employee_id: 7, role: 'QUAN_LY_TRUNG_TAM' }, null, { algorithm: 'none' });

        const err = await captureError(() => authService.verifyToken(unsigned, NOW));

        expect(err.code).toBe(ErrorCode.UNAUTHENTICATED);
    });
});
