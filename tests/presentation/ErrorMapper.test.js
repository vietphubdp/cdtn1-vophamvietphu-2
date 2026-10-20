'use strict';

const { AppError, ErrorCode } = require('../../src/errors/AppError');
const { toHttpError } = require('../../src/presentation/controllers/ErrorMapper');

// Cấu trúc lỗi theo api-contract mục 2 và TĐ-06.
describe('ErrorMapper – dịch mã nghiệp vụ sang mã HTTP', () => {
    test.each([
        [ErrorCode.VALIDATION_FAILED, 400],
        [ErrorCode.UNAUTHENTICATED, 401],
        [ErrorCode.FORBIDDEN, 403],
        [ErrorCode.NOT_FOUND, 404],
        [ErrorCode.CONFLICT, 409],
        [ErrorCode.BUSINESS_RULE_VIOLATION, 422],
    ])('TĐ-06 luồng đúng: %s → %i, giữ nguyên mã và thông báo', (code, status) => {
        const result = toHttpError(new AppError(code, 'Thông báo cho người dùng'));

        expect(result.status).toBe(status);
        expect(result.body).toEqual({ error: { code, message: 'Thông báo cho người dùng' } });
    });

    test('TĐ-06 luồng đúng: VALIDATION_FAILED đưa lỗi theo trường ra khóa `fields`', () => {
        const err = new AppError(ErrorCode.VALIDATION_FAILED, 'Số điện thoại không hợp lệ', {
            phone: 'Phải đủ 10 chữ số sau khi chuẩn hóa',
        });

        const { status, body } = toHttpError(err);

        expect(status).toBe(400);
        expect(body.error.fields).toEqual({ phone: 'Phải đủ 10 chữ số sau khi chuẩn hóa' });
        expect(body.error).not.toHaveProperty('details');
    });

    test('TĐ-06 luồng đúng: CONFLICT đưa dữ liệu bổ sung ra khóa `details` (Q8)', () => {
        const err = new AppError(ErrorCode.CONFLICT, 'Số điện thoại đã tồn tại', { customer_id: 1024 });

        const { status, body } = toHttpError(err);

        expect(status).toBe(409);
        expect(body.error.details).toEqual({ customer_id: 1024 });
        expect(body.error).not.toHaveProperty('fields');
    });

    test.each([
        ['không truyền', undefined],
        ['null', null],
        ['đối tượng rỗng', {}],
    ])('TĐ-06 giá trị biên: details %s → không có khóa `details`, `fields`', (_label, details) => {
        const { body } = toHttpError(new AppError(ErrorCode.NOT_FOUND, 'Không tìm thấy khách hàng', details));

        expect(Object.keys(body.error).sort()).toEqual(['code', 'message']);
    });

    test('TĐ-06 dữ liệu sai: lỗi lạ (lỗi SQL) → 500 thông báo chung, không lộ stack, tên bảng, câu SQL', () => {
        const err = new Error('duplicate key value violates unique constraint "customer_phone_key"');
        err.stack = 'Error: ...\n    at Query (node_modules/pg/lib/query.js:1:1)';
        err.detail = 'Key (phone)=(0901234567) already exists.';

        const { status, body } = toHttpError(err);
        const text = JSON.stringify(body);

        expect(status).toBe(500);
        expect(body.error.code).toBe('INTERNAL_ERROR');
        expect(Object.keys(body.error).sort()).toEqual(['code', 'message']);
        expect(text).not.toMatch(/customer|phone_key|node_modules|query\.js|Key \(phone\)/);
    });

    test('TĐ-06 dữ liệu sai: AppError mang mã không có trong bản đồ → 500, không trả mã lạ', () => {
        const { status, body } = toHttpError(new AppError('MA_LA', 'chi tiết nội bộ'));

        expect(status).toBe(500);
        expect(body.error.code).toBe('INTERNAL_ERROR');
        expect(body.error.message).not.toContain('chi tiết nội bộ');
    });

    test('TĐ-06 dữ liệu sai: body không phải JSON hợp lệ → 400 VALIDATION_FAILED', () => {
        const err = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' });

        const { status, body } = toHttpError(err);

        expect(status).toBe(400);
        expect(body.error.code).toBe('VALIDATION_FAILED');
    });
});
