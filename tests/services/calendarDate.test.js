'use strict';

const { parseCalendarDate, formatCalendarDate, daysInMonth } = require('../../src/services/calendarDate');

// Ngày lịch dạng 'YYYY-MM-DD' (kiểu DATE), nền cho QT-05 và kiểm ngày mua ở FR4.

describe('calendarDate', () => {
    test('QT-05 luồng đúng: tách và ghép lại đúng chuỗi ban đầu', () => {
        expect(parseCalendarDate('2026-03-05')).toEqual({ year: 2026, month: 3, day: 5 });
        expect(formatCalendarDate({ year: 2026, month: 3, day: 5 })).toBe('2026-03-05');
    });

    test('QT-05 giá trị biên: số ngày tháng 2 năm thường, năm nhuận, năm chia hết cho 100', () => {
        expect(daysInMonth(2026, 2)).toBe(28);
        expect(daysInMonth(2028, 2)).toBe(29);
        expect(daysInMonth(2100, 2)).toBe(28);
        expect(daysInMonth(2000, 2)).toBe(29);
    });

    test('FR4 giá trị biên: 29/02 chỉ có ở năm nhuận, 31/04 không có', () => {
        expect(parseCalendarDate('2028-02-29')).not.toBeNull();
        expect(parseCalendarDate('2026-02-29')).toBeNull();
        expect(parseCalendarDate('2026-04-31')).toBeNull();
    });

    test.each([['2026-13-01'], ['2026-00-10'], ['0000-01-01'], ['2026/03/05'], ['05-03-2026'], ['2026-3-5'], [''], [20260305], [null]])(
        'FR4 dữ liệu sai: %p không phải ngày hợp lệ → null',
        (text) => {
            expect(parseCalendarDate(text)).toBeNull();
        },
    );
});
