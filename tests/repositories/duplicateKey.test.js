'use strict';

const { rethrowAsDuplicateKey } = require('../../src/repositories/db');
const { DuplicateKeyError } = require('../../src/errors/DuplicateKeyError');

// Dịch lỗi UNIQUE của PostgreSQL ở lớp repository, không cần CSDL thật.

function capture(fn) {
    try {
        fn();
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('rethrowAsDuplicateKey', () => {
    test('HT2 luồng đúng: lỗi pg mã 23505 → DuplicateKeyError mang tên ràng buộc', () => {
        const pgError = Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505',
            constraint: 'product_product_name_key',
        });

        const err = capture(() => rethrowAsDuplicateKey(pgError));

        expect(err).toBeInstanceOf(DuplicateKeyError);
        expect(err.constraint).toBe('product_product_name_key');
    });

    test('HT2 dữ liệu sai: lỗi pg khác (vi phạm CHECK 23514) → ném lại nguyên lỗi gốc', () => {
        const pgError = Object.assign(new Error('violates check constraint'), { code: '23514' });

        expect(capture(() => rethrowAsDuplicateKey(pgError))).toBe(pgError);
    });
});
