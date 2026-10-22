'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');

/**
 * Kiểm vai trò của người gọi ở lớp service (D3). Vai trò không nằm trong `allowedRoles`
 * (hoặc không có caller) → AppError FORBIDDEN, ErrorMapper dịch thành 403.
 *
 * @param {object} caller        { employee_id, role, center_id, ... } lấy từ JWT
 * @param {string[]} allowedRoles các giá trị trong Role
 * @param {string} message       thông báo cho người dùng, nói rõ ai được làm việc này
 */
function assertRole(caller, allowedRoles, message) {
    if (!caller || !allowedRoles.includes(caller.role)) {
        throw new AppError(ErrorCode.FORBIDDEN, message);
    }
}

module.exports = { assertRole };
