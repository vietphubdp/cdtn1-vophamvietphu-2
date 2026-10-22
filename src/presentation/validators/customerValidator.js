'use strict';

const { normalizePhone, PHONE_INVALID_MESSAGE } = require('../../services/normalizePhone');
const { readBody, isAbsent, charLength, toTrimmedName, throwIfAnyField } = require('./fieldRules');

// Giới hạn theo db/schema.sql và api-contract mục 5.
const FULL_NAME_MAX = 120; // customer.full_name VARCHAR(120)
const EMAIL_MAX = 120; // customer.email VARCHAR(120)
const ADDRESS_MAX = 255; // customer.address VARCHAR(255)

// Kiểm dạng thư điện tử ở mức tối thiểu: phần tên @ tên miền có dấu chấm, không khoảng trắng.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MESSAGES = Object.freeze({
    full_name: `Họ tên phải có từ 1 đến ${FULL_NAME_MAX} ký tự`,
    phone_required: 'Số điện thoại bắt buộc',
    phone_invalid: PHONE_INVALID_MESSAGE,
    email: `Email không hợp lệ (dạng ten@mien.vn, tối đa ${EMAIL_MAX} ký tự)`,
    address: `Địa chỉ tối đa ${ADDRESS_MAX} ký tự`,
});

const LOOKUP_INVALID_MESSAGE = 'Số điện thoại không hợp lệ';
const CUSTOMER_INVALID_MESSAGE = 'Thông tin khách hàng chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.';

/**
 * QT-02 ở validator (D2): gọi chung hàm normalizePhone của lớp service để lỗi `phone`
 * được báo cùng lúc với các trường khác. Đúng → ghi số đã chuẩn hóa vào result.
 */
function readPhone(value, fields, result) {
    if (isAbsent(value) || (typeof value === 'string' && value.trim() === '')) {
        fields.phone = MESSAGES.phone_required;
        return;
    }
    const phone = normalizePhone(value);
    if (phone === null) fields.phone = MESSAGES.phone_invalid;
    else result.phone = phone;
}

/**
 * Trường chuỗi không bắt buộc: vắng, null hoặc chỉ có khoảng trắng → null (không có thông tin);
 * có nội dung thì cắt khoảng trắng đầu cuối rồi kiểm. Không phải chuỗi → lỗi.
 *
 * @returns {{ ok: boolean, value: string|null }}
 */
function readOptionalText(value, isValid) {
    if (isAbsent(value)) return { ok: true, value: null };
    if (typeof value !== 'string') return { ok: false, value: null };
    const trimmed = value.trim();
    if (trimmed === '') return { ok: true, value: null };
    return { ok: isValid(trimmed), value: trimmed };
}

function isEmail(text) {
    return charLength(text) <= EMAIL_MAX && EMAIL_PATTERN.test(text);
}

function isAddress(text) {
    return charLength(text) <= ADDRESS_MAX;
}

/** API 1: `?phone=` bắt buộc, chuẩn hóa được (US1-AC3). Trả { phone } đã chuẩn hóa. */
function validateCustomerLookup(query) {
    const fields = {};
    const result = {};
    readPhone(readBody(query).phone, fields, result);
    throwIfAnyField(fields, LOOKUP_INVALID_MESSAGE);
    return result;
}

/**
 * API 3: body tạo khách (api-contract mục 5), gom đủ lỗi rồi ném một lần.
 * Trả dữ liệu đã chuẩn hóa: tên, email, địa chỉ đã cắt khoảng trắng; số đã chuẩn hóa (QT-02);
 * email, địa chỉ bỏ trống → null.
 */
function validateCustomerCreate(body) {
    const input = readBody(body);
    const fields = {};
    const result = {};

    const fullName = toTrimmedName(input.full_name, FULL_NAME_MAX);
    if (fullName === null) fields.full_name = MESSAGES.full_name;
    else result.full_name = fullName;

    readPhone(input.phone, fields, result);

    const email = readOptionalText(input.email, isEmail);
    if (!email.ok) fields.email = MESSAGES.email;
    else result.email = email.value;

    const address = readOptionalText(input.address, isAddress);
    if (!address.ok) fields.address = MESSAGES.address;
    else result.address = address.value;

    throwIfAnyField(fields, CUSTOMER_INVALID_MESSAGE);
    return result;
}

module.exports = { validateCustomerLookup, validateCustomerCreate, MESSAGES };
