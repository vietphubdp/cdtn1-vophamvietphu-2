'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');
const { Role, WarrantyStatus } = require('../domain/constants');
const { assertRole } = require('./assertRole');
const { parseCalendarDate, formatCalendarDate, daysInMonth } = require('./calendarDate');
const { toVietnamDateString } = require('./vietnamTime');

// API 5: cả hai vai trò đều xem được (api-contract mục 1).
const READ_ROLES = [Role.TIEP_NHAN, Role.QUAN_LY_TRUNG_TAM];

const MESSAGES = Object.freeze({
    readForbidden: 'Vai trò của bạn không được xem tình trạng bảo hành.',
    notFound: 'Không tìm thấy thiết bị',
});

/**
 * QT-05 (Q4): ngày hết bảo hành = ngày mua cộng `months` tháng; tháng đích không có ngày đó
 * thì lấy ngày cuối tháng (31/01 + 1 tháng → 28/02, hoặc 29/02 năm nhuận).
 *
 * @param {string} purchaseDate 'YYYY-MM-DD'
 * @param {number} months       1–60
 * @returns {string} 'YYYY-MM-DD'
 */
function calculateWarrantyExpiry(purchaseDate, months) {
    const purchase = parseCalendarDate(purchaseDate);
    if (!purchase) throw new TypeError(`Ngày mua không hợp lệ: ${purchaseDate}`);

    const monthIndex = purchase.month - 1 + months; // đếm tháng từ 0 để chia năm cho dễ
    const year = purchase.year + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const day = Math.min(purchase.day, daysInMonth(year, month));
    return formatCalendarDate({ year, month, day });
}

/**
 * QT-05 · FR5 · US4: tình trạng bảo hành của thiết bị tại thời điểm `now`.
 * - Thiếu ngày mua → CHUA_XAC_MINH, chờ Quản lý quyết định (US4-AC3).
 * - Ngày hôm nay theo giờ Việt Nam ≤ ngày hết hạn → CON_BAO_HANH (US4-AC1: ngày hết hạn vẫn còn).
 * - Sau ngày hết hạn → HET_BAO_HANH, có tính phí (US4-AC2).
 * Hàm thuần: GĐ 5 (TicketService) gọi lại với `now` = thời điểm tiếp nhận.
 *
 * @param {{ purchase_date: string|null, warranty_months: number }} device
 * @param {Date} now
 * @returns {{ warranty_expires_on: string|null, warranty_status: string }}
 */
function determineWarrantyStatus(device, now) {
    if (device.purchase_date === null || device.purchase_date === undefined) {
        return { warranty_expires_on: null, warranty_status: WarrantyStatus.CHUA_XAC_MINH };
    }
    const expiresOn = calculateWarrantyExpiry(device.purchase_date, device.warranty_months);
    // Hai chuỗi 'YYYY-MM-DD' cùng độ dài so theo thứ tự chữ đúng bằng so theo ngày.
    const today = toVietnamDateString(now);
    const status = today <= expiresOn ? WarrantyStatus.CON_BAO_HANH : WarrantyStatus.HET_BAO_HANH;
    return { warranty_expires_on: expiresOn, warranty_status: status };
}

/**
 * WarrantyService (sơ đồ kiến trúc): xác định tình trạng bảo hành – QT-05 · UC4 · API 5.
 *
 * @param {object} deps
 * @param {object} deps.deviceRepository có findById
 */
function createWarrantyService({ deviceRepository }) {
    return {
        /** API 5: tình trạng bảo hành tính tại thời điểm gọi `now` (api-contract 3.5). */
        async getWarranty(caller, deviceId, now) {
            assertRole(caller, READ_ROLES, MESSAGES.readForbidden);
            const device = await deviceRepository.findById(deviceId);
            if (!device) throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.notFound);
            return {
                device_id: device.device_id,
                purchase_date: device.purchase_date,
                warranty_months: device.warranty_months,
                ...determineWarrantyStatus(device, now),
            };
        },
    };
}

module.exports = { createWarrantyService, calculateWarrantyExpiry, determineWarrantyStatus, MESSAGES };
