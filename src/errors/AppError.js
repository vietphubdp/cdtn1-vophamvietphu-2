'use strict';

/**
 * Mã nghiệp vụ dùng chung (api-contract mục 2). Service chỉ ném các mã này;
 * việc dịch sang mã HTTP nằm ở ErrorMapper (lớp trình bày).
 */
const ErrorCode = Object.freeze({
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
});

/**
 * Lỗi có chủ đích do lớp nghiệp vụ hoặc validator ném ra (D11).
 *
 * @param {string} code    một giá trị trong ErrorCode
 * @param {string} message thông báo cho người dùng (tiếng Việt)
 * @param {object} [details] dữ liệu bổ sung – tương ứng `chiTiet` trong mẫu buổi 7.
 *   Với VALIDATION_FAILED: lỗi theo từng trường, ví dụ { phone: 'Phải đủ 10 chữ số…' },
 *   ErrorMapper đưa ra khóa `fields`. Với mã khác: ErrorMapper đưa ra khóa `details`,
 *   ví dụ { customer_id: 1024 } khi trùng số điện thoại (Q8).
 */
class AppError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
    }
}

module.exports = { AppError, ErrorCode };
