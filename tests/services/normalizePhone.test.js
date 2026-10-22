'use strict';

const { normalizePhone } = require('../../src/services/normalizePhone');

// Bảng ví dụ chuẩn hóa số điện thoại ở api-contract mục 5 (QT-02, D10).

describe('normalizePhone (QT-02)', () => {
    test.each([
        ['0901234567'],
        ['0901 234 567'],
        ['090.123.4567'],
        ['+84901234567'],
        ['+84 90 123 4567'],
        ['84901234567'],
        [' 0901234567 '],
    ])('QT-02 luồng đúng: "%s" → 0901234567', (raw) => {
        expect(normalizePhone(raw)).toBe('0901234567');
    });

    test('QT-02 luồng đúng: số bắt đầu bằng 084 không bị coi là mã nước', () => {
        expect(normalizePhone('0841234567')).toBe('0841234567');
    });

    test.each([
        ['090123456', '9 chữ số'],
        ['09012345678', '11 chữ số'],
        ['+8490123456', '+84 kèm 8 chữ số'],
        ['+849012345678', '+84 kèm 10 chữ số'],
    ])('QT-02 giá trị biên: "%s" (%s) bị từ chối', (raw) => {
        expect(normalizePhone(raw)).toBeNull();
    });

    test.each([
        ['901234567', 'thiếu số 0 đầu'],
        ['0901-234-567', 'gạch ngang'],
        ['(+84) 901234567', 'ngoặc'],
        ['090abc4567', 'chữ cái'],
        ['', 'chuỗi rỗng'],
        ['   ', 'chỉ khoảng trắng'],
    ])('QT-02 dữ liệu sai: "%s" (%s) bị từ chối', (raw) => {
        expect(normalizePhone(raw)).toBeNull();
    });

    test.each([[undefined], [null], [901234567], [['0901234567']]])(
        'QT-02 dữ liệu sai: giá trị không phải chuỗi (%p) bị từ chối',
        (raw) => {
            expect(normalizePhone(raw)).toBeNull();
        },
    );
});
