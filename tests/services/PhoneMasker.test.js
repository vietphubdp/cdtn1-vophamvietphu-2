'use strict';

const { maskPhone, phoneForCaller } = require('../../src/services/PhoneMasker');
const { Role } = require('../../src/domain/constants');

describe('PhoneMasker (QT-15, NFR2)', () => {
    test('QT-15 luồng đúng: che 4 số giữa, giữ 3 số đầu và 3 số cuối', () => {
        expect(maskPhone('0901234567')).toBe('090****567');
        expect(maskPhone('0931234888')).toBe('093****888');
    });

    test('QT-15 luồng đúng: Tiếp nhận nhận số đã che', () => {
        expect(phoneForCaller({ role: Role.TIEP_NHAN }, '0901234567')).toBe('090****567');
    });

    test('QT-15 luồng đúng: Quản lý trung tâm nhận số đầy đủ', () => {
        expect(phoneForCaller({ role: Role.QUAN_LY_TRUNG_TAM }, '0901234567')).toBe('0901234567');
    });

    test('QT-15 dữ liệu sai: vai trò lạ hoặc không có người gọi → vẫn che', () => {
        expect(phoneForCaller({ role: 'BAN_GIAM_DOC' }, '0901234567')).toBe('090****567');
        expect(phoneForCaller(undefined, '0901234567')).toBe('090****567');
    });
});
