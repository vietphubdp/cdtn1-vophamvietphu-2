'use strict';

const { calculateDueDate } = require('../../src/services/DueDateCalculator');
const { toVietnamIsoString } = require('../../src/services/vietnamTime');
const { Priority } = require('../../src/domain/constants');

// Unit test DueDateCalculator (QT-04, FR9, Q5). Hàm thuần: thời điểm tiếp nhận truyền vào,
// không phụ thuộc giờ máy. Lịch tham chiếu tháng 10/2026: thứ Hai 05, thứ Năm 08, thứ Bảy 10,
// Chủ nhật 11, thứ Hai 12.

/** Thời điểm theo giờ Việt Nam, ví dụ vn('2026-10-08T14:30'). */
const vn = (local) => new Date(`${local}:00+07:00`);
const due = (local, priority) => toVietnamIsoString(calculateDueDate(vn(local), priority));

describe('DueDateCalculator – hạn cam kết (QT-04, FR9)', () => {
    test('US5-AC4 luồng đúng: Cao 09:00 thứ Hai → 09:00 thứ Ba', () => {
        expect(due('2026-10-05T09:00', Priority.CAO)).toBe('2026-10-06T09:00:00+07:00');
    });

    test('US5-AC5 luồng đúng: Trung bình 14:30 thứ Năm → 14:30 thứ Hai tuần sau (bỏ qua Chủ nhật)', () => {
        expect(due('2026-10-08T14:30', Priority.TRUNG_BINH)).toBe('2026-10-12T14:30:00+07:00');
    });

    test('US5-AC6 luồng đúng: Cao 10:00 thứ Bảy → 10:00 thứ Hai, không rơi vào Chủ nhật', () => {
        expect(due('2026-10-10T10:00', Priority.CAO)).toBe('2026-10-12T10:00:00+07:00');
    });

    test('QT-04 luồng đúng: Thấp 08:00 thứ Hai → 08:00 thứ Bảy (120 giờ, không chạm Chủ nhật)', () => {
        expect(due('2026-10-05T08:00', Priority.THAP)).toBe('2026-10-10T08:00:00+07:00');
    });

    test('QT-04 luồng đúng: Thấp 10:00 thứ Tư → 10:00 thứ Ba tuần sau (cộng 24 giờ của Chủ nhật)', () => {
        expect(due('2026-10-07T10:00', Priority.THAP)).toBe('2026-10-13T10:00:00+07:00');
    });

    test('QT-04 giá trị biên (Q5): Cao 00:00 thứ Bảy → 00:00 thứ Hai, không phải 00:00 Chủ nhật', () => {
        expect(due('2026-10-10T00:00', Priority.CAO)).toBe('2026-10-12T00:00:00+07:00');
    });

    test('QT-04 giá trị biên (Q5): Thấp 00:00 thứ Ba → đủ 120 giờ đúng 00:00 Chủ nhật → 00:00 thứ Hai', () => {
        expect(due('2026-10-06T00:00', Priority.THAP)).toBe('2026-10-12T00:00:00+07:00');
    });

    test('QT-04 giá trị biên: Cao 23:59 thứ Bảy → 23:59 thứ Hai (1 phút thứ Bảy + 23 giờ 59 phút thứ Hai)', () => {
        expect(due('2026-10-10T23:59', Priority.CAO)).toBe('2026-10-12T23:59:00+07:00');
    });

    test('QT-04 giá trị biên (Q5): tiếp nhận Chủ nhật → đếm từ 00:00 thứ Hai', () => {
        expect(due('2026-10-11T15:00', Priority.CAO)).toBe('2026-10-13T00:00:00+07:00');
        expect(due('2026-10-11T00:00', Priority.TRUNG_BINH)).toBe('2026-10-15T00:00:00+07:00');
        expect(due('2026-10-11T23:59', Priority.THAP)).toBe('2026-10-17T00:00:00+07:00');
    });

    test('QT-04 giá trị biên: qua năm mới, Trung bình 14:30 thứ Năm 31/12/2026 → 14:30 thứ Hai 04/01/2027', () => {
        expect(due('2026-12-31T14:30', Priority.TRUNG_BINH)).toBe('2027-01-04T14:30:00+07:00');
    });

    test('QT-04 giá trị biên: giữ nguyên giây và phần nghìn giây của thời điểm tiếp nhận', () => {
        const receivedAt = new Date('2026-10-05T02:00:15.250Z'); // 09:00:15.250 thứ Hai giờ VN
        expect(calculateDueDate(receivedAt, Priority.CAO).toISOString()).toBe('2026-10-06T02:00:15.250Z');
    });

    test('QT-04 giá trị biên: thứ trong tuần theo giờ Việt Nam, không theo UTC hay giờ máy', () => {
        // 18:00 thứ Bảy UTC = 01:00 Chủ nhật giờ VN → áp quy tắc Chủ nhật, đếm từ 00:00 thứ Hai.
        const sundayInVietnam = new Date('2026-10-10T18:00:00Z');
        expect(toVietnamIsoString(calculateDueDate(sundayInVietnam, Priority.CAO))).toBe('2026-10-13T00:00:00+07:00');
        // 16:59 Chủ nhật UTC = 23:59 Chủ nhật giờ VN; 17:00 Chủ nhật UTC = 00:00 thứ Hai giờ VN.
        expect(toVietnamIsoString(calculateDueDate(new Date('2026-10-11T16:59:00Z'), Priority.CAO))).toBe('2026-10-13T00:00:00+07:00');
        expect(toVietnamIsoString(calculateDueDate(new Date('2026-10-11T17:00:00Z'), Priority.CAO))).toBe('2026-10-13T00:00:00+07:00');
        expect(toVietnamIsoString(calculateDueDate(new Date('2026-10-11T17:01:00Z'), Priority.CAO))).toBe('2026-10-13T00:01:00+07:00');
    });

    test('QT-04 dữ liệu sai: mức ưu tiên lạ → TypeError (lỗi lập trình, validator đã chặn trước)', () => {
        expect(() => calculateDueDate(vn('2026-10-05T09:00'), 'KHAN_CAP')).toThrow(TypeError);
        expect(() => calculateDueDate(vn('2026-10-05T09:00'), undefined)).toThrow(TypeError);
    });
});

describe('DueDateCalculator – đối chiếu với câu chữ FR9 (TĐ-04)', () => {
    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;
    const OFFSET_MS = 7 * HOUR_MS;
    const HOURS = { [Priority.CAO]: 24, [Priority.TRUNG_BINH]: 72, [Priority.THAP]: 120 };

    /**
     * Cài đặt thẳng theo câu chữ FR9, độc lập với DueDateCalculator: tiếp nhận Chủ nhật thì tính từ
     * 00:00 thứ Hai; hạn = bắt đầu + N giờ; mỗi 00:00 Chủ nhật nằm trong (bắt đầu, hạn] thì cộng thêm
     * 24 giờ (lặp tới khi không còn Chủ nhật mới) — hạn đúng 00:00 Chủ nhật cũng bị đẩy sang thứ Hai.
     */
    function dueByFr9Wording(receivedAt, priority) {
        let start = receivedAt.getTime() + OFFSET_MS;
        if (new Date(start).getUTCDay() === 0) start = Math.floor(start / DAY_MS) * DAY_MS + DAY_MS;
        let end = start + HOURS[priority] * HOUR_MS;
        let counted = 0;
        for (;;) {
            let sundays = 0;
            for (let day = Math.floor(start / DAY_MS) * DAY_MS + DAY_MS; day <= end; day += DAY_MS) {
                if (new Date(day).getUTCDay() === 0) sundays += 1;
            }
            if (sundays === counted) break;
            end += (sundays - counted) * DAY_MS;
            counted = sundays;
        }
        return new Date(end - OFFSET_MS);
    }

    test('FR9 luồng đúng: trùng kết quả với câu chữ FR9 ở mọi phút trong một tuần, cả 3 mức (30.240 trường hợp)', () => {
        const weekStart = vn('2026-10-05T00:00').getTime(); // 00:00 thứ Hai
        const mismatches = [];
        for (let minute = 0; minute < 7 * 24 * 60; minute += 1) {
            const receivedAt = new Date(weekStart + minute * 60 * 1000);
            for (const priority of Object.values(Priority)) {
                const actual = calculateDueDate(receivedAt, priority).getTime();
                const expected = dueByFr9Wording(receivedAt, priority).getTime();
                if (actual !== expected) mismatches.push({ receivedAt: toVietnamIsoString(receivedAt), priority });
            }
        }
        expect(mismatches).toEqual([]);
    });

    test('QT-04 luồng đúng: không hạn nào rơi vào Chủ nhật và hạn luôn sau thời điểm tiếp nhận ≥ N giờ', () => {
        const weekStart = vn('2026-10-05T00:00').getTime();
        for (let minute = 0; minute < 7 * 24 * 60; minute += 15) {
            const receivedAt = new Date(weekStart + minute * 60 * 1000);
            for (const priority of Object.values(Priority)) {
                const dueDate = calculateDueDate(receivedAt, priority);
                expect(new Date(dueDate.getTime() + OFFSET_MS).getUTCDay()).not.toBe(0);
                expect(dueDate.getTime() - receivedAt.getTime()).toBeGreaterThanOrEqual(HOURS[priority] * HOUR_MS);
            }
        }
    });
});
