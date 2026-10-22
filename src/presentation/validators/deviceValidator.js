'use strict';

const { WARRANTY_MONTHS_MIN, WARRANTY_MONTHS_MAX } = require('../../domain/constants');
const { parseCalendarDate } = require('../../services/calendarDate');
const { isPurchaseDateInFuture } = require('../../services/DeviceService');
const { readBody, isAbsent, toTrimmedName, throwIfAnyField, parsePathId } = require('./fieldRules');

// Giới hạn theo db/schema.sql và api-contract mục 5.
const SERIAL_NO_MAX = 50; // device.serial_no VARCHAR(50)
const ID_MAX = Number.MAX_SAFE_INTEGER; // customer_id, device_id, product_id BIGSERIAL, đọc ra số (db.js)

const MESSAGES = Object.freeze({
    product_id: 'Sản phẩm không hợp lệ: chọn một sản phẩm trong danh mục',
    serial_no: `Serial/IMEI bắt buộc, từ 1 đến ${SERIAL_NO_MAX} ký tự`,
    purchase_date: 'Ngày mua không hợp lệ (dạng YYYY-MM-DD, là ngày có thật)',
    purchase_date_future: 'Ngày mua không được sau ngày hôm nay',
    warranty_months: `Số tháng bảo hành phải là số nguyên từ ${WARRANTY_MONTHS_MIN} đến ${WARRANTY_MONTHS_MAX}`,
});

const DEVICE_INVALID_MESSAGE = 'Thông tin thiết bị chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.';

function isPositiveId(value) {
    return Number.isSafeInteger(value) && value >= 1;
}

function isWarrantyMonths(value) {
    return Number.isInteger(value) && value >= WARRANTY_MONTHS_MIN && value <= WARRANTY_MONTHS_MAX;
}

/**
 * purchase_date không bắt buộc: vắng hoặc null → null (chưa xác minh bảo hành, QT-05).
 * Có gửi thì phải là ngày có thật dạng 'YYYY-MM-DD' và không sau hôm nay theo giờ Việt Nam
 * (gọi chung hàm của DeviceService để lỗi này báo cùng lúc với các trường khác, như D2).
 * Chuỗi rỗng → lỗi (giống D7: client muốn bỏ trống thì gửi null).
 */
function readPurchaseDate(value, now, fields, result) {
    if (isAbsent(value)) {
        result.purchase_date = null;
        return;
    }
    if (!parseCalendarDate(value)) fields.purchase_date = MESSAGES.purchase_date;
    else if (isPurchaseDateInFuture(value, now)) fields.purchase_date = MESSAGES.purchase_date_future;
    else result.purchase_date = value;
}

/**
 * API 4: body ghi nhận thiết bị (api-contract mục 5), gom đủ lỗi rồi ném một lần.
 * Chỉ kiểm định dạng; sản phẩm có tồn tại và đang dùng hay không do DeviceService kiểm.
 * Trả: serial đã cắt khoảng trắng (phân biệt hoa thường); purchase_date bỏ trống → null;
 * warranty_months bỏ trống → undefined (service lấy theo sản phẩm, FR4).
 *
 * @param {object} body
 * @param {Date} now thời điểm nhận yêu cầu, để so ngày mua với hôm nay
 */
function validateDeviceCreate(body, now) {
    const input = readBody(body);
    const fields = {};
    const result = {};

    if (!isPositiveId(input.product_id)) fields.product_id = MESSAGES.product_id;
    else result.product_id = input.product_id;

    const serialNo = toTrimmedName(input.serial_no, SERIAL_NO_MAX);
    if (serialNo === null) fields.serial_no = MESSAGES.serial_no;
    else result.serial_no = serialNo;

    readPurchaseDate(input.purchase_date, now, fields, result);

    const months = input.warranty_months;
    if (isAbsent(months)) result.warranty_months = undefined;
    else if (!isWarrantyMonths(months)) fields.warranty_months = MESSAGES.warranty_months;
    else result.warranty_months = months;

    throwIfAnyField(fields, DEVICE_INVALID_MESSAGE);
    return result;
}

module.exports = {
    validateDeviceCreate,
    // Mã sai định dạng → NOT_FOUND (contract endpoint 2, 4, 5 chỉ liệt kê 404).
    parseCustomerId: (raw) => parsePathId(raw, ID_MAX, 'khách hàng'),
    parseDeviceId: (raw) => parsePathId(raw, ID_MAX, 'thiết bị'),
    MESSAGES,
};
