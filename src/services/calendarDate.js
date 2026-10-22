'use strict';

// Hàm thuần cho ngày lịch dạng chuỗi 'YYYY-MM-DD' (kiểu DATE của `pg`, xem repositories/db.js).
// Làm trên số năm/tháng/ngày, không tạo Date theo giờ máy, nên không lệch ngày khi máy khác múi giờ.

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Số ngày của tháng `month` (1–12) trong năm `year`, tính cả năm nhuận. */
function daysInMonth(year, month) {
    const date = new Date(0);
    date.setUTCFullYear(year, month, 0); // ngày 0 của tháng sau = ngày cuối của tháng này
    return date.getUTCDate();
}

/**
 * Tách 'YYYY-MM-DD' thành { year, month, day }; chuỗi sai dạng hoặc ngày không có thật
 * (30/02, tháng 13, năm 0000) → null.
 *
 * @param {string} text
 * @returns {{ year: number, month: number, day: number } | null}
 */
function parseCalendarDate(text) {
    const match = typeof text === 'string' ? CALENDAR_DATE_PATTERN.exec(text) : null;
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
    return { year, month, day };
}

/** { year, month, day } → 'YYYY-MM-DD'. */
function formatCalendarDate({ year, month, day }) {
    const pad = (value, width) => String(value).padStart(width, '0');
    return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

module.exports = { parseCalendarDate, formatCalendarDate, daysInMonth };
