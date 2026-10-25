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

describe('toApiDate – ngày mua gõ dd/mm/yyyy trên M2 → YYYY-MM-DD gửi API 4', () => {
    test('US3 luồng đúng: "05/03/2026" → "2026-03-05", khoảng trắng đầu cuối được bỏ', () => {
        expect(format.toApiDate('05/03/2026')).toBe('2026-03-05');
        expect(format.toApiDate('  05/03/2026 ')).toBe('2026-03-05');
    });

    test('US3 giá trị biên: ngày, tháng một chữ số "5/3/2026" được thêm số 0', () => {
        expect(format.toApiDate('5/3/2026')).toBe('2026-03-05');
    });

    test('US4-AC3 giá trị biên: để trống (khách không nhớ ngày mua) → null', () => {
        expect(format.toApiDate('')).toBeNull();
        expect(format.toApiDate('   ')).toBeNull();
        expect(format.toApiDate(null)).toBeNull();
    });

    test('US3 dữ liệu sai: không đúng dạng dd/mm/yyyy → gửi nguyên chuỗi để API báo lỗi trường purchase_date', () => {
        expect(format.toApiDate('2026-03-05')).toBe('2026-03-05');
        expect(format.toApiDate('05-03-2026')).toBe('05-03-2026');
        expect(format.toApiDate('hôm qua')).toBe('hôm qua');
    });

    test('US3 dữ liệu sai: ngày không có thật "31/02/2026" chỉ đổi dạng, việc kiểm ngày có thật để API làm', () => {
        expect(format.toApiDate('31/02/2026')).toBe('2026-02-31');
    });
});

describe('warrantyStatusLabel – cột (8) Tình trạng bảo hành trên M3', () => {
    test('QT-05 luồng đúng: ba giá trị hiện đúng câu chữ wireframe', () => {
        expect(format.warrantyStatusLabel('CON_BAO_HANH')).toBe('Còn bảo hành');
        expect(format.warrantyStatusLabel('HET_BAO_HANH')).toBe('Hết bảo hành (có tính phí)');
        expect(format.warrantyStatusLabel('CHUA_XAC_MINH')).toBe('Chưa xác minh bảo hành (chờ quản lý)');
    });

    test('QT-05 dữ liệu sai: giá trị lạ hiện nguyên giá trị', () => {
        expect(format.warrantyStatusLabel('LA')).toBe('LA');
    });
});
