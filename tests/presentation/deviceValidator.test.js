'use strict';

const {
    validateDeviceCreate,
    parseCustomerId,
    parseDeviceId,
    MESSAGES,
} = require('../../src/presentation/validators/deviceValidator');
const { ErrorCode } = require('../../src/errors/AppError');

const NOW = new Date('2026-10-08T14:22:00+07:00');
const VALID = Object.freeze({ product_id: 5, serial_no: 'OPA78-55120', purchase_date: null, warranty_months: null });

function captureError(fn) {
    try {
        fn();
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('deviceValidator – ghi nhận thiết bị (API 4)', () => {
    test('US3 luồng đúng: đúng ví dụ api-contract 3.4 → ngày mua null, số tháng để service lấy theo sản phẩm', () => {
        expect(validateDeviceCreate(VALID, NOW)).toEqual({
            product_id: 5,
            serial_no: 'OPA78-55120',
            purchase_date: null,
            warranty_months: undefined,
        });
    });

    test('QT-03 luồng đúng: serial cắt khoảng trắng đầu cuối, giữ hoa thường', () => {
        const input = validateDeviceCreate({ ...VALID, serial_no: '  opA78-55120 ', purchase_date: '2026-03-05', warranty_months: 24 }, NOW);

        expect(input.serial_no).toBe('opA78-55120');
        expect(input.purchase_date).toBe('2026-03-05');
        expect(input.warranty_months).toBe(24);
    });

    test('US3 dữ liệu sai: body rỗng → gom đủ lỗi product_id và serial_no trong một lần', () => {
        const err = captureError(() => validateDeviceCreate({}, NOW));

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details).sort()).toEqual(['product_id', 'serial_no']);
    });

    test.each([[0], [-1], [1.5], ['5'], [true]])('FR4 dữ liệu sai: product_id = %p → fields.product_id', (productId) => {
        const err = captureError(() => validateDeviceCreate({ ...VALID, product_id: productId }, NOW));

        expect(err.details).toEqual({ product_id: MESSAGES.product_id });
    });

    test('QT-03 giá trị biên: serial 50 ký tự được, 51 ký tự hoặc chỉ khoảng trắng bị từ chối', () => {
        expect(validateDeviceCreate({ ...VALID, serial_no: 'S'.repeat(50) }, NOW).serial_no).toHaveLength(50);
        expect(captureError(() => validateDeviceCreate({ ...VALID, serial_no: 'S'.repeat(51) }, NOW)).details).toEqual({
            serial_no: MESSAGES.serial_no,
        });
        expect(captureError(() => validateDeviceCreate({ ...VALID, serial_no: '   ' }, NOW)).details).toHaveProperty('serial_no');
    });

    test('FR4 giá trị biên: số tháng 1 và 60 được; 0, 61, 12.5, "12" bị từ chối', () => {
        expect(validateDeviceCreate({ ...VALID, warranty_months: 1 }, NOW).warranty_months).toBe(1);
        expect(validateDeviceCreate({ ...VALID, warranty_months: 60 }, NOW).warranty_months).toBe(60);
        for (const months of [0, 61, 12.5, '12']) {
            const err = captureError(() => validateDeviceCreate({ ...VALID, warranty_months: months }, NOW));
            expect(err.details).toEqual({ warranty_months: MESSAGES.warranty_months });
        }
    });

    test('FR4 giá trị biên: ngày mua hôm nay được, ngày mai bị từ chối (giờ Việt Nam)', () => {
        expect(validateDeviceCreate({ ...VALID, purchase_date: '2026-10-08' }, NOW).purchase_date).toBe('2026-10-08');

        const err = captureError(() => validateDeviceCreate({ ...VALID, purchase_date: '2026-10-09' }, NOW));
        expect(err.details).toEqual({ purchase_date: MESSAGES.purchase_date_future });
    });

    test.each([['2026-02-30'], ['08/10/2026'], [''], [20260305]])('FR4 dữ liệu sai: purchase_date = %p → sai định dạng', (date) => {
        const err = captureError(() => validateDeviceCreate({ ...VALID, purchase_date: date }, NOW));

        expect(err.details).toEqual({ purchase_date: MESSAGES.purchase_date });
    });

    test('US3 dữ liệu sai: nhiều trường sai cùng lúc → báo đủ các trường', () => {
        const err = captureError(() =>
            validateDeviceCreate({ product_id: 'x', serial_no: '', purchase_date: '2099-01-01', warranty_months: 0 }, NOW),
        );

        expect(Object.keys(err.details).sort()).toEqual(['product_id', 'purchase_date', 'serial_no', 'warranty_months']);
    });
});

describe('deviceValidator – mã trong đường dẫn (API 2, 4, 5)', () => {
    test('US1 luồng đúng: "1024" → 1024', () => {
        expect(parseCustomerId('1024')).toBe(1024);
        expect(parseDeviceId('3311')).toBe(3311);
    });

    test.each([['0'], ['-1'], ['abc'], ['1.5'], ['99999999999999999999']])('US4 dữ liệu sai: mã "%s" → NOT_FOUND', (raw) => {
        expect(captureError(() => parseDeviceId(raw)).code).toBe(ErrorCode.NOT_FOUND);
    });
});
