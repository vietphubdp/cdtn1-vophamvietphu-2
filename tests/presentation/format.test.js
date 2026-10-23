'use strict';

const format = require('../../src/public/js/format');

// Hàm hiển thị của trang (public/js/format.js): đọc thẳng chuỗi API, không phụ thuộc múi giờ của máy.

describe('formatDateTime – hạn cam kết trên thông báo lập phiếu thành công (M1)', () => {
    test('US5-AC5 luồng đúng: hạn 14:30 thứ Hai 12/10/2026 hiện "12/10/2026 14:30" như wireframe', () => {
        expect(format.formatDateTime('2026-10-12T14:30:00+07:00')).toBe('12/10/2026 14:30');
    });

    test('FR9 giá trị biên: 00:00 thứ Hai (hạn rơi đúng nửa đêm) hiện "00:00", không lệch ngày theo giờ máy', () => {
        expect(format.formatDateTime('2026-10-19T00:00:00+07:00')).toBe('19/10/2026 00:00');
    });

    test('FR9 dữ liệu sai: chuỗi không đúng dạng ISO trả nguyên, rỗng trả chuỗi rỗng', () => {
        expect(format.formatDateTime('không phải ngày')).toBe('không phải ngày');
        expect(format.formatDateTime(null)).toBe('');
    });
});

describe('formatDate – ngày mua trong bảng thiết bị M1', () => {
    test('US1 luồng đúng: 2026-03-05 hiện 05/03/2026', () => {
        expect(format.formatDate('2026-03-05')).toBe('05/03/2026');
    });

    test('US4-AC3 giá trị biên: thiếu ngày mua hiện "(trống)" như wireframe', () => {
        expect(format.formatDate(null)).toBe('(trống)');
        expect(format.formatDate('')).toBe('(trống)');
    });
});

describe('Nhãn hiển thị giá trị danh mục', () => {
    test('FR6 luồng đúng: trạng thái MOI hiện "Mới", mức ưu tiên hiện tiếng Việt', () => {
        expect(format.ticketStatusLabel('MOI')).toBe('Mới');
        expect(format.priorityLabel('TRUNG_BINH')).toBe('Trung bình');
    });

    test('FR6 dữ liệu sai: giá trị lạ hiện nguyên giá trị', () => {
        expect(format.ticketStatusLabel('LA')).toBe('LA');
    });
});
