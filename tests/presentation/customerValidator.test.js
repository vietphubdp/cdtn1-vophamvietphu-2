'use strict';

const { validateCustomerLookup, validateCustomerCreate, MESSAGES } = require('../../src/presentation/validators/customerValidator');
const { ErrorCode } = require('../../src/errors/AppError');

function captureError(fn) {
    try {
        fn();
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('customerValidator – tra cứu (API 1)', () => {
    test('US1-AC1 luồng đúng: trả số đã chuẩn hóa', () => {
        expect(validateCustomerLookup({ phone: '+84 90 123 4567' })).toEqual({ phone: '0901234567' });
    });

    test('US1-AC3 dữ liệu sai: thiếu phone → VALIDATION_FAILED, fields.phone báo bắt buộc', () => {
        const err = captureError(() => validateCustomerLookup({}));

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(err.details).toEqual({ phone: MESSAGES.phone_required });
    });

    test('US1-AC3 giá trị biên: 9 chữ số → fields.phone báo chưa đủ 10 chữ số', () => {
        const err = captureError(() => validateCustomerLookup({ phone: '090123456' }));

        expect(err.details).toEqual({ phone: MESSAGES.phone_invalid });
    });

    test('US1-AC3 dữ liệu sai: gửi phone hai lần (mảng) → fields.phone', () => {
        const err = captureError(() => validateCustomerLookup({ phone: ['0901234567', '0912345678'] }));

        expect(err.details).toHaveProperty('phone');
    });
});

describe('customerValidator – tạo khách (API 3)', () => {
    test('US2 luồng đúng: cắt khoảng trắng, chuẩn hóa số, email/địa chỉ bỏ trống → null', () => {
        const input = validateCustomerCreate({
            full_name: '  Lê Văn Cường ',
            phone: '+84 93 123 4888',
            email: '   ',
            address: '',
        });

        expect(input).toEqual({ full_name: 'Lê Văn Cường', phone: '0931234888', email: null, address: null });
    });

    test('US2 luồng đúng: email, địa chỉ có nội dung được cắt khoảng trắng', () => {
        const input = validateCustomerCreate({
            full_name: 'Lê Văn Cường',
            phone: '0931234888',
            email: ' cuong.le@example.com ',
            address: ' 45 Lý Thường Kiệt ',
        });

        expect(input.email).toBe('cuong.le@example.com');
        expect(input.address).toBe('45 Lý Thường Kiệt');
    });

    test('US2 dữ liệu sai: body rỗng → gom đủ lỗi full_name và phone trong một lần (D2)', () => {
        const err = captureError(() => validateCustomerCreate({}));

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details).sort()).toEqual(['full_name', 'phone']);
    });

    test('US2 dữ liệu sai: tên trống và số sai cùng lúc → báo cả hai trường', () => {
        const err = captureError(() => validateCustomerCreate({ full_name: '   ', phone: '0901-234-567' }));

        expect(err.details).toEqual({ full_name: MESSAGES.full_name, phone: MESSAGES.phone_invalid });
    });

    test('US2 giá trị biên: họ tên 120 ký tự được, 121 ký tự bị từ chối', () => {
        const ok = validateCustomerCreate({ full_name: 'a'.repeat(120), phone: '0931234888' });
        const err = captureError(() => validateCustomerCreate({ full_name: 'a'.repeat(121), phone: '0931234888' }));

        expect(ok.full_name).toHaveLength(120);
        expect(err.details).toEqual({ full_name: MESSAGES.full_name });
    });

    test('US2 giá trị biên: địa chỉ 255 ký tự được, 256 ký tự bị từ chối', () => {
        const base = { full_name: 'Lê Văn Cường', phone: '0931234888' };

        const ok = validateCustomerCreate({ ...base, address: 'x'.repeat(255) });
        const err = captureError(() => validateCustomerCreate({ ...base, address: 'x'.repeat(256) }));

        expect(ok.address).toHaveLength(255);
        expect(err.details).toEqual({ address: MESSAGES.address });
    });

    test('US2 giá trị biên: email 120 ký tự được, 121 ký tự bị từ chối', () => {
        const base = { full_name: 'Lê Văn Cường', phone: '0931234888' };
        const email120 = `${'a'.repeat(108)}@example.com`; // 108 + 12 = 120

        const ok = validateCustomerCreate({ ...base, email: email120 });
        const err = captureError(() => validateCustomerCreate({ ...base, email: `a${email120}` }));

        expect(ok.email).toBe(email120);
        expect(err.details).toEqual({ email: MESSAGES.email });
    });

    test.each([['cuong.le'], ['cuong@'], ['cuong le@example.com'], ['cuong@example'], [123]])(
        'US2 dữ liệu sai: email %p → fields.email',
        (email) => {
            const err = captureError(() =>
                validateCustomerCreate({ full_name: 'Lê Văn Cường', phone: '0931234888', email }),
            );

            expect(err.details).toEqual({ email: MESSAGES.email });
        },
    );
});
