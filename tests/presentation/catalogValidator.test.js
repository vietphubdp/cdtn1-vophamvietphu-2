'use strict';

const {
    validateProductCreate,
    validateProductUpdate,
    validateIssueCategoryCreate,
    validateIssueCategoryUpdate,
    parseProductId,
    parseIssueCategoryId,
    parseIncludeInactive,
} = require('../../src/presentation/validators/catalogValidator');
const { ErrorCode } = require('../../src/errors/AppError');

function captureError(fn) {
    try {
        fn();
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

function fieldsOf(fn) {
    const err = captureError(fn);
    expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
    return err.details;
}

describe('catalogValidator – sản phẩm (api-contract mục 5)', () => {
    test('HT2 luồng đúng: POST hợp lệ, tên được bỏ khoảng trắng đầu cuối', () => {
        expect(validateProductCreate({ product_name: '  Oppo A79 ', default_warranty_months: 18 })).toEqual({
            product_name: 'Oppo A79',
            default_warranty_months: 18,
        });
    });

    test('HT2 luồng đúng: POST vắng hoặc null số tháng → để service lấy mặc định', () => {
        expect(validateProductCreate({ product_name: 'Oppo A79' }).default_warranty_months).toBeUndefined();
        expect(validateProductCreate({ product_name: 'Oppo A79', default_warranty_months: null }).default_warranty_months).toBeUndefined();
    });

    test.each([1, 60])('HT2 giá trị biên: default_warranty_months = %p được chấp nhận', (months) => {
        expect(validateProductCreate({ product_name: 'A', default_warranty_months: months }).default_warranty_months).toBe(months);
    });

    test.each([0, 61, 12.5, '12', true])('HT2 giá trị biên: default_warranty_months = %p bị từ chối', (months) => {
        const fields = fieldsOf(() => validateProductCreate({ product_name: 'A', default_warranty_months: months }));
        expect(Object.keys(fields)).toEqual(['default_warranty_months']);
    });

    test('HT2 dữ liệu sai: thiếu tên → fields.product_name', () => {
        const fields = fieldsOf(() => validateProductCreate({ default_warranty_months: 12 }));
        expect(fields).toEqual({ product_name: 'Tên sản phẩm phải có từ 1 đến 120 ký tự' });
    });

    test('HT2 dữ liệu sai: tên chỉ có khoảng trắng hoặc không phải chuỗi → fields.product_name', () => {
        expect(Object.keys(fieldsOf(() => validateProductCreate({ product_name: '   ' })))).toEqual(['product_name']);
        expect(Object.keys(fieldsOf(() => validateProductCreate({ product_name: 123 })))).toEqual(['product_name']);
    });

    test('HT2 giá trị biên: tên 120 ký tự được, 121 ký tự bị từ chối (đếm theo ký tự như char_length)', () => {
        expect(validateProductCreate({ product_name: 'á'.repeat(120) }).product_name).toHaveLength(120);
        expect(validateProductCreate({ product_name: '📱'.repeat(120) }).product_name).toBe('📱'.repeat(120));
        expect(Object.keys(fieldsOf(() => validateProductCreate({ product_name: 'a'.repeat(121) })))).toEqual(['product_name']);
    });

    test('HT2 dữ liệu sai: body rỗng hoặc không phải object → gom đủ lỗi trong một lần', () => {
        expect(Object.keys(fieldsOf(() => validateProductUpdate(undefined))).sort()).toEqual([
            'default_warranty_months',
            'product_name',
        ]);
        expect(Object.keys(fieldsOf(() => validateProductUpdate([])))).toContain('product_name');
    });

    test('HT2 dữ liệu sai: PUT thiếu default_warranty_months → bị từ chối (D9)', () => {
        const fields = fieldsOf(() => validateProductUpdate({ product_name: 'Oppo A78' }));
        expect(Object.keys(fields)).toEqual(['default_warranty_months']);
    });

    test('HT2 luồng đúng: PUT vắng is_active → undefined (giữ nguyên); có boolean → nhận', () => {
        expect(validateProductUpdate({ product_name: 'A', default_warranty_months: 12 }).is_active).toBeUndefined();
        expect(validateProductUpdate({ product_name: 'A', default_warranty_months: 12, is_active: true }).is_active).toBe(true);
    });

    test('HT2 dữ liệu sai: PUT is_active không phải boolean → fields.is_active', () => {
        const fields = fieldsOf(() => validateProductUpdate({ product_name: 'A', default_warranty_months: 12, is_active: 'true' }));
        expect(Object.keys(fields)).toEqual(['is_active']);
    });

    test('HT2 luồng đúng: POST có is_active → bỏ qua (chỉ dùng ở PUT)', () => {
        expect(validateProductCreate({ product_name: 'A', is_active: false })).not.toHaveProperty('is_active');
    });
});

describe('catalogValidator – nhóm sự cố (api-contract mục 5)', () => {
    test('HT2 luồng đúng: POST hợp lệ', () => {
        expect(validateIssueCategoryCreate({ category_name: ' Loa ', default_priority: 'THAP' })).toEqual({
            category_name: 'Loa',
            default_priority: 'THAP',
        });
    });

    test('HT2 dữ liệu sai: thiếu cả hai trường → fields có category_name và default_priority', () => {
        const fields = fieldsOf(() => validateIssueCategoryCreate({}));
        expect(Object.keys(fields).sort()).toEqual(['category_name', 'default_priority']);
    });

    test.each(['', 'cao', 'KHAN_CAP'])('HT2 dữ liệu sai: default_priority = %p bị từ chối', (priority) => {
        const fields = fieldsOf(() => validateIssueCategoryCreate({ category_name: 'Loa', default_priority: priority }));
        expect(Object.keys(fields)).toEqual(['default_priority']);
    });

    test('HT2 giá trị biên: tên nhóm 60 ký tự được, 61 ký tự bị từ chối', () => {
        expect(validateIssueCategoryUpdate({ category_name: 'a'.repeat(60), default_priority: 'CAO' }).category_name).toHaveLength(60);
        const fields = fieldsOf(() => validateIssueCategoryUpdate({ category_name: 'a'.repeat(61), default_priority: 'CAO' }));
        expect(Object.keys(fields)).toEqual(['category_name']);
    });
});

describe('catalogValidator – mã trong đường dẫn và include_inactive', () => {
    test('HT2 luồng đúng: mã số nguyên dương → số', () => {
        expect(parseProductId('5')).toBe(5);
        expect(parseIssueCategoryId('2147483647')).toBe(2147483647);
    });

    test.each(['0', '-1', 'abc', '1.5', '05', '2147483648'])('HT2 dữ liệu sai: mã nhóm sự cố %p → NOT_FOUND', (raw) => {
        expect(captureError(() => parseIssueCategoryId(raw)).code).toBe(ErrorCode.NOT_FOUND);
    });

    test('HT2 giá trị biên: chỉ đúng chuỗi "true" mới bật include_inactive', () => {
        expect(parseIncludeInactive({ include_inactive: 'true' })).toBe(true);
        expect(parseIncludeInactive({ include_inactive: '1' })).toBe(false);
        expect(parseIncludeInactive({})).toBe(false);
    });
});
