'use strict';

const { AppError, ErrorCode } = require('../../errors/AppError');

const REQUIRED_MESSAGES = Object.freeze({
    username: 'Nhập tên đăng nhập.',
    password: 'Nhập mật khẩu.',
});

function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}

/**
 * Kiểm định dạng body của POST /api/auth/login (api-contract mục 5):
 * `username`, `password` bắt buộc, chuỗi khác rỗng. Gom đủ lỗi rồi ném một lần.
 * @returns {{ username: string, password: string }}
 */
function validateLogin(body) {
    const input = body || {};
    const fields = {};
    for (const name of Object.keys(REQUIRED_MESSAGES)) {
        if (!isNonEmptyString(input[name])) fields[name] = REQUIRED_MESSAGES[name];
    }
    if (Object.keys(fields).length > 0) {
        throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            'Thiếu tên đăng nhập hoặc mật khẩu. Điền đủ hai ô rồi đăng nhập lại.',
            fields,
        );
    }
    return { username: input.username, password: input.password };
}

module.exports = { validateLogin };
