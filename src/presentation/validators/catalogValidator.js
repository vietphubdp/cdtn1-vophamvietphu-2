'use strict';

const { AppError, ErrorCode } = require('../../errors/AppError');
const { Priority, WARRANTY_MONTHS_MIN, WARRANTY_MONTHS_MAX } = require('../../domain/constants');
const { readBody, isAbsent, toTrimmedName, throwIfAnyField } = require('./fieldRules');

// Giới hạn theo db/schema.sql và api-contract mục 5.
const PRODUCT_NAME_MAX = 120; // product.product_name VARCHAR(120)
const CATEGORY_NAME_MAX = 60; // issue_category.category_name VARCHAR(60)
const PRODUCT_ID_MAX = Number.MAX_SAFE_INTEGER; // product_id BIGSERIAL, đọc ra số (db.js)
const CATEGORY_ID_MAX = 2147483647; // category_id SERIAL (INT 4 byte)

const MESSAGES = Object.freeze({
    product_name: `Tên sản phẩm phải có từ 1 đến ${PRODUCT_NAME_MAX} ký tự`,
    default_warranty_months: `Số tháng bảo hành phải từ ${WARRANTY_MONTHS_MIN} đến ${WARRANTY_MONTHS_MAX}`,
    category_name: `Tên nhóm sự cố phải có từ 1 đến ${CATEGORY_NAME_MAX} ký tự`,
    default_priority: 'Mức ưu tiên không hợp lệ (chọn CAO, TRUNG_BINH hoặc THAP)',
    is_active: 'Trạng thái sử dụng không hợp lệ (true hoặc false)',
});

const PRODUCT_INVALID_MESSAGE = 'Thông tin sản phẩm chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.';
const CATEGORY_INVALID_MESSAGE = 'Thông tin nhóm sự cố chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.';

function isWarrantyMonths(value) {
    return Number.isInteger(value) && value >= WARRANTY_MONTHS_MIN && value <= WARRANTY_MONTHS_MAX;
}

function isPriority(value) {
    return Object.values(Priority).includes(value);
}

/**
 * Kiểm body sản phẩm (api-contract mục 5), gom đủ lỗi rồi ném một lần.
 * POST: default_warranty_months không bắt buộc (vắng/null → undefined, service lấy mặc định 12);
 *       is_active bị bỏ qua (chỉ dùng ở PUT).
 * PUT:  default_warranty_months bắt buộc (D9); is_active vắng/null → undefined = giữ nguyên.
 */
function validateProduct(body, { isUpdate }) {
    const input = readBody(body);
    const fields = {};
    const result = {};

    const name = toTrimmedName(input.product_name, PRODUCT_NAME_MAX);
    if (name === null) fields.product_name = MESSAGES.product_name;
    else result.product_name = name;

    const months = input.default_warranty_months;
    if (isAbsent(months) && !isUpdate) result.default_warranty_months = undefined;
    else if (!isWarrantyMonths(months)) fields.default_warranty_months = MESSAGES.default_warranty_months;
    else result.default_warranty_months = months;

    if (isUpdate) readIsActive(input, fields, result);

    throwIfAnyField(fields, PRODUCT_INVALID_MESSAGE);
    return result;
}

/**
 * Kiểm body nhóm sự cố (api-contract mục 5), gom đủ lỗi rồi ném một lần.
 * category_name, default_priority bắt buộc ở cả POST và PUT; is_active chỉ đọc ở PUT.
 */
function validateIssueCategory(body, { isUpdate }) {
    const input = readBody(body);
    const fields = {};
    const result = {};

    const name = toTrimmedName(input.category_name, CATEGORY_NAME_MAX);
    if (name === null) fields.category_name = MESSAGES.category_name;
    else result.category_name = name;

    if (!isPriority(input.default_priority)) fields.default_priority = MESSAGES.default_priority;
    else result.default_priority = input.default_priority;

    if (isUpdate) readIsActive(input, fields, result);

    throwIfAnyField(fields, CATEGORY_INVALID_MESSAGE);
    return result;
}

function readIsActive(input, fields, result) {
    if (isAbsent(input.is_active)) result.is_active = undefined;
    else if (typeof input.is_active !== 'boolean') fields.is_active = MESSAGES.is_active;
    else result.is_active = input.is_active;
}

/**
 * Mã trong đường dẫn `/{id}`: số nguyên dương trong giới hạn của cột khóa.
 * Sai định dạng thì chắc chắn không có bản ghi nào → NOT_FOUND (contract endpoint 13, 14, 16, 17
 * chỉ liệt kê 404 cho trường hợp này), đồng thời không gửi giá trị lạ xuống CSDL.
 */
function parseId(raw, max, label) {
    const text = String(raw);
    const id = /^[1-9][0-9]*$/.test(text) ? Number(text) : NaN;
    if (!Number.isSafeInteger(id) || id > max) {
        throw new AppError(ErrorCode.NOT_FOUND, `Không tìm thấy ${label} với mã đã gửi. Mã phải là số nguyên dương.`);
    }
    return id;
}

/** `?include_inactive=true` (đúng chữ "true") mới tính; giá trị khác coi như không gửi. */
function parseIncludeInactive(query) {
    return Boolean(query) && query.include_inactive === 'true';
}

module.exports = {
    validateProductCreate: (body) => validateProduct(body, { isUpdate: false }),
    validateProductUpdate: (body) => validateProduct(body, { isUpdate: true }),
    validateIssueCategoryCreate: (body) => validateIssueCategory(body, { isUpdate: false }),
    validateIssueCategoryUpdate: (body) => validateIssueCategory(body, { isUpdate: true }),
    parseProductId: (raw) => parseId(raw, PRODUCT_ID_MAX, 'sản phẩm'),
    parseIssueCategoryId: (raw) => parseId(raw, CATEGORY_ID_MAX, 'nhóm sự cố'),
    parseIncludeInactive,
    MESSAGES,
};
