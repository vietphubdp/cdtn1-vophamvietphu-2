'use strict';

const { Priority } = require('../domain/constants');
const { VIETNAM_OFFSET_MS } = require('./vietnamTime');

// QT-04 · FR9: số giờ cam kết theo mức ưu tiên.
const COMMITMENT_HOURS = Object.freeze({
    [Priority.CAO]: 24,
    [Priority.TRUNG_BINH]: 72,
    [Priority.THAP]: 120,
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SUNDAY = 0; // getUTCDay(): 0 = Chủ nhật, 1 = thứ Hai … 6 = thứ Bảy

/** 00:00 của ngày chứa `shiftedMs` (thời điểm đã dời sang giờ Việt Nam, đọc như UTC). */
function startOfDay(shiftedMs) {
    return Math.floor(shiftedMs / DAY_MS) * DAY_MS;
}

/** 00:00 Chủ nhật kế tiếp, tính từ một thời điểm thứ Hai–thứ Bảy (đã dời sang giờ Việt Nam). */
function nextSundayStart(shiftedMs) {
    const weekday = new Date(shiftedMs).getUTCDay();
    return startOfDay(shiftedMs) + (7 - weekday) * DAY_MS;
}

/**
 * QT-04 · FR9 (Q5): hạn cam kết = thời điểm tiếp nhận + đủ N giờ, chỉ đếm giờ thuộc thứ Hai–thứ Bảy.
 * - Tiếp nhận vào Chủ nhật → bắt đầu đếm từ 00:00 thứ Hai.
 * - Đếm vừa hết đúng 00:00 Chủ nhật → hạn là 00:00 thứ Hai (hạn không rơi vào Chủ nhật).
 * - Thứ trong tuần tính theo giờ Việt Nam (+07:00): dời thời điểm thêm 7 giờ rồi đọc như UTC,
 *   nên kết quả không phụ thuộc múi giờ của máy chủ.
 * Cách đếm này cho cùng kết quả với câu chữ FR9 ("mỗi Chủ nhật trong khoảng tính cộng thêm 24 giờ"),
 * xem test đối chiếu trong tests/services/DueDateCalculator.test.js.
 *
 * @param {Date} receivedAt thời điểm tiếp nhận
 * @param {string} priority CAO | TRUNG_BINH | THAP
 * @returns {Date} hạn cam kết
 */
function calculateDueDate(receivedAt, priority) {
    const hours = COMMITMENT_HOURS[priority];
    if (hours === undefined) throw new TypeError(`Mức ưu tiên không hợp lệ: ${priority}`);

    let cursor = receivedAt.getTime() + VIETNAM_OFFSET_MS;
    let remaining = hours * HOUR_MS;
    if (new Date(cursor).getUTCDay() === SUNDAY) cursor = startOfDay(cursor) + DAY_MS;

    while (remaining > 0) {
        const sundayStart = nextSundayStart(cursor);
        const workingUntilSunday = sundayStart - cursor;
        if (remaining < workingUntilSunday) {
            cursor += remaining;
            remaining = 0;
        } else {
            // Dùng hết phần còn lại của tuần (kể cả trường hợp vừa đủ, kết thúc 00:00 Chủ nhật),
            // bỏ qua trọn Chủ nhật, tiếp tục từ 00:00 thứ Hai.
            remaining -= workingUntilSunday;
            cursor = sundayStart + DAY_MS;
        }
    }

    return new Date(cursor - VIETNAM_OFFSET_MS);
}

module.exports = { calculateDueDate, COMMITMENT_HOURS };
