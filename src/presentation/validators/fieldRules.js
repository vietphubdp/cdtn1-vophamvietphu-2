'use strict';

const { AppError, ErrorCode } = require('../../errors/AppError');

// Các hàm kiểm định dạng dùng chung cho mọi validator. Không tra CSDL, không có quy tắc nghiệp vụ.

/** Body phải là object JSON; dạng khác (mảng, chuỗi, rỗng) coi như object rỗng để báo thiếu trường. */
function readBody(body) {
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

/** `null` ở trường không bắt buộc coi như vắng. */
function isAbsent(value) {
    return value === undefined || value === null;
}

/** Đếm theo ký tự như char_length của PostgreSQL (emoji tính 1, không phải 2 đơn vị UTF-16). */
function charLength(text) {
    return [...text].length;
}

/** Chuỗi bỏ khoảng trắng đầu cuối, dài 1..maxLength ký tự → bản đã cắt; sai → null. */
function toTrimmedName(value, maxLength) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    const length = charLength(trimmed);
    return length >= 1 && length <= maxLength ? trimmed : null;
}

/** Có ít nhất một lỗi trường → ném VALIDATION_FAILED một lần với đủ các trường (gom lỗi). */
function throwIfAnyField(fields, message) {
    if (Object.keys(fields).length > 0) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, message, fields);
    }
}

/**
 * Mã trong đường dẫn `/{id}`: số nguyên dương trong giới hạn của cột khóa.
 * Sai định dạng thì chắc chắn không có bản ghi nào → NOT_FOUND (contract chỉ liệt kê 404
 * cho trường hợp này), đồng thời không gửi giá trị lạ xuống CSDL.
 *
 * @param {string} raw   giá trị trong đường dẫn
 * @param {number} max   giá trị lớn nhất của cột khóa
 * @param {string} label tên bản ghi trong thông báo: 'sản phẩm', 'khách hàng'…
 */
function parsePathId(raw, max, label) {
    const text = String(raw);
    const id = /^[1-9][0-9]*$/.test(text) ? Number(text) : NaN;
    if (!Number.isSafeInteger(id) || id > max) {
        throw new AppError(ErrorCode.NOT_FOUND, `Không tìm thấy ${label} với mã đã gửi. Mã phải là số nguyên dương.`);
    }
    return id;
}

module.exports = { readBody, isAbsent, charLength, toTrimmedName, throwIfAnyField, parsePathId };
