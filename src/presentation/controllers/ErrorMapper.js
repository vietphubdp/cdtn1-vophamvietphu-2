'use strict';

const { AppError, ErrorCode } = require('../../errors/AppError');

// Bản đồ mã nghiệp vụ → mã HTTP (api-contract mục 2). Chỉ nơi này biết mã HTTP của lỗi.
const HTTP_STATUS_BY_CODE = Object.freeze({
    [ErrorCode.VALIDATION_FAILED]: 400,
    [ErrorCode.UNAUTHENTICATED]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.CONFLICT]: 409,
    [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
});

const INTERNAL_ERROR_MESSAGE =
    'Hệ thống đang gặp sự cố nên yêu cầu chưa được xử lý. Vui lòng thử lại sau ít phút; nếu vẫn lỗi, báo quản trị viên.';

const INVALID_JSON_MESSAGE =
    'Nội dung gửi lên không phải JSON hợp lệ. Kiểm tra lại dấu ngoặc, dấu phẩy rồi gửi lại.';

function isEmpty(obj) {
    return obj === undefined || obj === null || Object.keys(obj).length === 0;
}

/** Lỗi người dùng = AppError mang mã có trong bản đồ. Mọi lỗi khác là lỗi hệ thống. */
function isUserError(err) {
    return err instanceof AppError && err.code in HTTP_STATUS_BY_CODE;
}

/** express.json() báo body sai cú pháp JSON: lỗi người dùng, trả 400. */
function isInvalidJsonBody(err) {
    return err && err.type === 'entity.parse.failed';
}

/**
 * Dịch một lỗi bất kỳ thành { status, body } đúng cấu trúc
 * { error: { code, message, fields?, details? } } (api-contract mục 2, TĐ-06).
 * Lỗi hệ thống chỉ trả thông báo chung: không stack trace, tên bảng hay câu SQL.
 */
function toHttpError(err) {
    if (isInvalidJsonBody(err)) {
        return {
            status: 400,
            body: { error: { code: ErrorCode.VALIDATION_FAILED, message: INVALID_JSON_MESSAGE } },
        };
    }

    if (!isUserError(err)) {
        return {
            status: 500,
            body: { error: { code: ErrorCode.INTERNAL_ERROR, message: INTERNAL_ERROR_MESSAGE } },
        };
    }

    const error = { code: err.code, message: err.message };
    if (!isEmpty(err.details)) {
        // `fields` chỉ có ở lỗi 400; mã khác dùng `details` (Q8).
        const key = err.code === ErrorCode.VALIDATION_FAILED ? 'fields' : 'details';
        error[key] = err.details;
    }
    return { status: HTTP_STATUS_BY_CODE[err.code], body: { error } };
}

/**
 * Middleware xử lý lỗi cuối chuỗi Express.
 * Lỗi người dùng: không ghi log mức error. Lỗi hệ thống: ghi log đủ ngữ cảnh, trả 500 chung.
 */
function createErrorMiddleware(logger = console) {
    // Express nhận ra middleware xử lý lỗi nhờ đủ 4 tham số.
    // eslint-disable-next-line no-unused-vars
    return function errorMiddleware(err, req, res, next) {
        const { status, body } = toHttpError(err);
        if (status === 500) {
            logger.error('[500]', {
                method: req.method,
                url: req.originalUrl,
                employee_id: req.caller ? req.caller.employee_id : undefined,
                error: err,
            });
        }
        res.status(status).json(body);
    };
}

module.exports = { toHttpError, createErrorMiddleware, HTTP_STATUS_BY_CODE };
