'use strict';

const { Priority } = require('../../domain/constants');
const { readBody, isAbsent, charLength, throwIfAnyField } = require('./fieldRules');

// Giới hạn theo db/schema.sql và api-contract mục 5.
const ISSUE_DESC_MIN = 10; // CHECK char_length(issue_desc) BETWEEN 10 AND 2000
const ISSUE_DESC_MAX = 2000;
const BIGINT_ID_MAX = Number.MAX_SAFE_INTEGER; // customer_id, device_id BIGINT, đọc ra số (db.js)
const INT_ID_MAX = 2147483647; // category_id INT
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES = Object.freeze({
    customer_id: 'Mã khách hàng phải là số nguyên dương',
    device_id: 'Mã thiết bị phải là số nguyên dương',
    issue_desc: `Mô tả lỗi phải có từ ${ISSUE_DESC_MIN} đến ${ISSUE_DESC_MAX} ký tự`,
    category_id: 'Nhóm sự cố không hợp lệ',
    priority: 'Mức ưu tiên không hợp lệ',
    idempotency_key: 'Thiếu khóa chống trùng: header Idempotency-Key phải là một UUID',
});

const TICKET_INVALID_MESSAGE = 'Thông tin phiếu chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.';

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

module.exports = { validateTicketCreate, MESSAGES, ISSUE_DESC_MIN, ISSUE_DESC_MAX };
