'use strict';

const { validateLogin } = require('../../src/presentation/validators/authValidator');
const { ErrorCode } = require('../../src/errors/AppError');

function captureError(fn) {
    try {
        fn();
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('validateLogin – body của POST /api/auth/login (HT1, api-contract mục 5)', () => {
    test('HT1 luồng đúng: đủ username và password → trả lại đúng hai trường', () => {
        expect(validateLogin({ username: 'lan.q10', password: 'Demo@2026', thua: 1 }))
            .toEqual({ username: 'lan.q10', password: 'Demo@2026' });
    });

    test('HT1 dữ liệu sai: thiếu cả hai trường → báo đủ cả hai tên trường trong một lần', () => {
        const err = captureError(() => validateLogin({}));

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details).sort()).toEqual(['password', 'username']);
    });

    test('HT1 dữ liệu sai: không có body → báo đủ cả hai tên trường', () => {
        const err = captureError(() => validateLogin(undefined));

        expect(Object.keys(err.details).sort()).toEqual(['password', 'username']);
    });

    test('HT1 giá trị biên: chuỗi rỗng bị từ chối, chuỗi 1 ký tự được nhận', () => {
        const err = captureError(() => validateLogin({ username: '', password: 'x' }));

        expect(Object.keys(err.details)).toEqual(['username']);
        expect(validateLogin({ username: 'a', password: 'x' })).toEqual({ username: 'a', password: 'x' });
    });

    test('HT1 dữ liệu sai: password không phải chuỗi (số, null) → báo fields.password', () => {
        expect(Object.keys(captureError(() => validateLogin({ username: 'lan.q10', password: 123456 })).details))
            .toEqual(['password']);
        expect(Object.keys(captureError(() => validateLogin({ username: 'lan.q10', password: null })).details))
            .toEqual(['password']);
    });
});
