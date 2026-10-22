'use strict';

// Việt Nam dùng độ lệch cố định +07:00, không có giờ mùa hè. Mọi quy tắc theo ngày và mọi thời gian
// trả ra API tính theo độ lệch này, không theo giờ của máy chủ (api-contract mục 2).
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const VIETNAM_OFFSET_SUFFIX = '+07:00';

/**
 * Định dạng một thời điểm theo giờ Việt Nam, ISO 8601 đến giây: '2026-10-08T14:20:00+07:00'.
 * Dời thời điểm thêm 7 giờ rồi đọc các thành phần UTC, nên không phụ thuộc múi giờ của máy.
 *
 * @param {Date} date
 * @returns {string}
 */
function toVietnamIsoString(date) {
    const shifted = new Date(date.getTime() + VIETNAM_OFFSET_MS);
    // toISOString luôn có dạng 'YYYY-MM-DDTHH:mm:ss.sssZ'; lấy 19 ký tự đầu (bỏ phần nghìn giây và Z).
    return shifted.toISOString().slice(0, 19) + VIETNAM_OFFSET_SUFFIX;
}

module.exports = { toVietnamIsoString, VIETNAM_OFFSET_MS };
