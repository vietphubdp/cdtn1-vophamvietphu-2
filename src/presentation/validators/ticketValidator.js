'use strict';

const { Priority, WarrantyStatus } = require('../../domain/constants');
const { readBody, isAbsent, charLength, throwIfAnyField, parsePathId } = require('./fieldRules');

// Giới hạn theo db/schema.sql và api-contract mục 5.
const ISSUE_DESC_MIN = 10; // CHECK char_length(issue_desc) BETWEEN 10 AND 2000
const ISSUE_DESC_MAX = 2000;
const BIGINT_ID_MAX = Number.MAX_SAFE_INTEGER; // customer_id, device_id BIGINT, đọc ra số (db.js)
const INT_ID_MAX = 2147483647; // category_id INT
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lý do sửa, hủy phiếu, quyết định bảo hành (CHECK ticket_edit_log.reason, ticket_status_log.note VARCHAR(255)).
const REASON_MIN = 5;
const REASON_MAX = 255;

// API 21 (QT-17): Quản lý chỉ chọn một trong hai kết quả.
const WARRANTY_DECISIONS = [WarrantyStatus.CON_BAO_HANH, WarrantyStatus.HET_BAO_HANH];

// Các trường sửa được ở API 19 (QT-16).
const EDITABLE_FIELDS = ['device_id', 'issue_desc', 'category_id', 'priority'];

// Phân trang API 8 (api-contract mục 2, mục 5).
const PAGE_DEFAULT = 1;
const SIZE_DEFAULT = 20; // FR10: 20 dòng mỗi trang
const SIZE_MAX = 100;

const MESSAGES = Object.freeze({
    customer_id: 'Mã khách hàng phải là số nguyên dương',
    device_id: 'Mã thiết bị phải là số nguyên dương',
    issue_desc: `Mô tả lỗi phải có từ ${ISSUE_DESC_MIN} đến ${ISSUE_DESC_MAX} ký tự`,
    category_id: 'Nhóm sự cố không hợp lệ',
    priority: 'Mức ưu tiên không hợp lệ',
    idempotency_key: 'Thiếu khóa chống trùng: header Idempotency-Key phải là một UUID',
    page: 'Trang phải là số nguyên từ 1',
    size: `Số dòng mỗi trang phải từ 1 đến ${SIZE_MAX}`,
    reason: `Lý do phải có từ ${REASON_MIN} đến ${REASON_MAX} ký tự`,
    noEditableField: 'Gửi ít nhất một trường cần sửa: device_id, issue_desc, category_id hoặc priority',
    warranty_status: 'Chọn Còn bảo hành (CON_BAO_HANH) hoặc Hết bảo hành – có tính phí (HET_BAO_HANH)',
});

const TICKET_INVALID_MESSAGE = 'Thông tin phiếu chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.';
const LIST_INVALID_MESSAGE = 'Tham số phân trang không hợp lệ';
const CANCEL_INVALID_MESSAGE = 'Chưa hủy được phiếu. Nhập lý do hủy rồi gửi lại.';
const DECISION_INVALID_MESSAGE = 'Chưa lưu được quyết định bảo hành. Sửa các trường được đánh dấu rồi gửi lại.';

const PRIORITIES = Object.values(Priority);

function isIdInRange(value, max) {
    return Number.isSafeInteger(value) && value >= 1 && value <= max;
}

/** D8: bỏ khoảng trắng đầu cuối rồi mới đếm 10–2000 ký tự; trả bản đã cắt, sai → null. */
function toIssueDesc(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    const length = charLength(trimmed);
    return length >= ISSUE_DESC_MIN && length <= ISSUE_DESC_MAX ? trimmed : null;
}

/**
 * API 7: body lập phiếu và header Idempotency-Key (api-contract mục 5), gom đủ lỗi rồi ném một lần.
 * Chỉ kiểm định dạng; khách, thiết bị, nhóm sự cố có tồn tại hay không do TicketService kiểm.
 * D7: category_id, priority vắng hoặc null → null (service lấy mặc định); chuỗi rỗng, giá trị lạ → lỗi.
 * Không đọc warranty_status, center_id từ body: hệ thống tự tính / lấy từ JWT (TĐ-07).
 *
 * @param {object} body
 * @param {string|undefined} idempotencyKeyHeader giá trị header Idempotency-Key
 * @returns {{ input: object, idempotencyKey: string }} khóa đổi về chữ thường
 */
function validateTicketCreate(body, idempotencyKeyHeader) {
    const raw = readBody(body);
    const fields = {};
    const input = {};

    if (!isIdInRange(raw.customer_id, BIGINT_ID_MAX)) fields.customer_id = MESSAGES.customer_id;
    else input.customer_id = raw.customer_id;

    if (!isIdInRange(raw.device_id, BIGINT_ID_MAX)) fields.device_id = MESSAGES.device_id;
    else input.device_id = raw.device_id;

    const issueDesc = toIssueDesc(raw.issue_desc);
    if (issueDesc === null) fields.issue_desc = MESSAGES.issue_desc;
    else input.issue_desc = issueDesc;

    if (isAbsent(raw.category_id)) input.category_id = null;
    else if (!isIdInRange(raw.category_id, INT_ID_MAX)) fields.category_id = MESSAGES.category_id;
    else input.category_id = raw.category_id;

    if (isAbsent(raw.priority)) input.priority = null;
    else if (!PRIORITIES.includes(raw.priority)) fields.priority = MESSAGES.priority;
    else input.priority = raw.priority;

    const keyIsValid = typeof idempotencyKeyHeader === 'string' && UUID_PATTERN.test(idempotencyKeyHeader);
    if (!keyIsValid) fields.idempotency_key = MESSAGES.idempotency_key;

    throwIfAnyField(fields, TICKET_INVALID_MESSAGE);
    return { input, idempotencyKey: idempotencyKeyHeader.toLowerCase() };
}

/** Lý do bỏ khoảng trắng đầu cuối, dài 5–255 ký tự → bản đã cắt; sai → null. */
function toReason(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    const length = charLength(trimmed);
    return length >= REASON_MIN && length <= REASON_MAX ? trimmed : null;
}

/** Mã phiếu trong đường dẫn `/api/tickets/{id}` (API 18–21); sai định dạng → 404. */
function parseTicketId(raw) {
    return parsePathId(raw, BIGINT_ID_MAX, 'phiếu bảo hành');
}

/**
 * API 19 (QT-16): body sửa phiếu, gom đủ lỗi rồi ném một lần. Chỉ trường nào được gửi mới có trong `input`.
 * category_id = null nghĩa là bỏ phân loại; priority không nhận null (phiếu luôn có mức ưu tiên).
 * Bắt buộc có `reason` và ít nhất một trường cần sửa. Không đọc customer_id, center_id, status, ticket_code:
 * các trường này không sửa được.
 *
 * @returns {object} { device_id?, issue_desc?, category_id?, priority?, reason }
 */
function validateTicketUpdate(body) {
    const raw = readBody(body);
    const fields = {};
    const input = {};

    if (!EDITABLE_FIELDS.some((name) => raw[name] !== undefined)) fields.body = MESSAGES.noEditableField;

    if (raw.device_id !== undefined) {
        if (!isIdInRange(raw.device_id, BIGINT_ID_MAX)) fields.device_id = MESSAGES.device_id;
        else input.device_id = raw.device_id;
    }

    if (raw.issue_desc !== undefined) {
        const issueDesc = toIssueDesc(raw.issue_desc);
        if (issueDesc === null) fields.issue_desc = MESSAGES.issue_desc;
        else input.issue_desc = issueDesc;
    }

    if (raw.category_id !== undefined) {
        if (raw.category_id === null) input.category_id = null;
        else if (!isIdInRange(raw.category_id, INT_ID_MAX)) fields.category_id = MESSAGES.category_id;
        else input.category_id = raw.category_id;
    }

    if (raw.priority !== undefined) {
        if (!PRIORITIES.includes(raw.priority)) fields.priority = MESSAGES.priority;
        else input.priority = raw.priority;
    }

    const reason = toReason(raw.reason);
    if (reason === null) fields.reason = MESSAGES.reason;
    else input.reason = reason;

    throwIfAnyField(fields, TICKET_INVALID_MESSAGE);
    return input;
}

/** API 20 (QT-06): body hủy phiếu `{ reason }`. */
function validateTicketCancel(body) {
    const reason = toReason(readBody(body).reason);
    throwIfAnyField(reason === null ? { reason: MESSAGES.reason } : {}, CANCEL_INVALID_MESSAGE);
    return { reason };
}

/** API 21 (QT-17): body quyết định bảo hành `{ warranty_status, reason }`, gom đủ lỗi rồi ném một lần. */
function validateWarrantyDecision(body) {
    const raw = readBody(body);
    const fields = {};

    if (!WARRANTY_DECISIONS.includes(raw.warranty_status)) fields.warranty_status = MESSAGES.warranty_status;
    const reason = toReason(raw.reason);
    if (reason === null) fields.reason = MESSAGES.reason;

    throwIfAnyField(fields, DECISION_INVALID_MESSAGE);
    return { warranty_status: raw.warranty_status, reason };
}

/**
 * Tham số phân trang trong query: vắng → giá trị mặc định; chuỗi chỉ gồm chữ số và nằm trong
 * [min, max] → số; còn lại (rỗng, '1.5', '-1', 'abc', gửi hai lần thành mảng) → null.
 */
function toPagingNumber(value, defaultValue, min, max) {
    if (value === undefined) return defaultValue;
    if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

/**
 * API 8: `?page=&size=` (api-contract mục 5), gom đủ lỗi rồi ném một lần.
 * page ≥ 1, mặc định 1 (trang vượt quá số phiếu vẫn hợp lệ, trả danh sách rỗng);
 * size 1–100, mặc định 20 (FR10).
 *
 * @returns {{ page: number, size: number }}
 */
function validateTicketList(query) {
    const raw = readBody(query);
    const fields = {};

    const page = toPagingNumber(raw.page, PAGE_DEFAULT, 1, Number.MAX_SAFE_INTEGER);
    if (page === null) fields.page = MESSAGES.page;

    const size = toPagingNumber(raw.size, SIZE_DEFAULT, 1, SIZE_MAX);
    if (size === null) fields.size = MESSAGES.size;

    throwIfAnyField(fields, LIST_INVALID_MESSAGE);
    return { page, size };
}

module.exports = {
    validateTicketCreate,
    validateTicketList,
    validateTicketUpdate,
    validateTicketCancel,
    validateWarrantyDecision,
    parseTicketId,
    REASON_MIN,
    REASON_MAX,
    MESSAGES,
    ISSUE_DESC_MIN,
    ISSUE_DESC_MAX,
    SIZE_DEFAULT,
    SIZE_MAX,
};
