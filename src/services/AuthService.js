'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { AppError, ErrorCode } = require('../errors/AppError');

// Sai tên đăng nhập và sai mật khẩu dùng chung một thông báo (api-contract 3.9),
// không cho người ngoài dò tên đăng nhập nào có thật.
const INVALID_CREDENTIALS_MESSAGE = 'Sai tên đăng nhập hoặc mật khẩu';
const MISSING_TOKEN_MESSAGE = 'Bạn chưa đăng nhập. Đăng nhập rồi thử lại.';
const INVALID_TOKEN_MESSAGE = 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Đăng nhập lại rồi thử lại.';

// Mã băm bcrypt (cost 10, như seed) của một chuỗi không phải mật khẩu của ai.
// Khi không có tên đăng nhập, vẫn so khớp với mã này để thời gian trả lời
// giống trường hợp sai mật khẩu (không dò được tên đăng nhập qua thời gian).
const DUMMY_PASSWORD_HASH = '$2b$10$/5h0JG9.2PL2LRPSvEOreeUG8hfRnqVq/G/Fskf3NcX9MMniNnu6W';

const JWT_ALGORITHM = 'HS256';

function toUnixSeconds(date) {
    return Math.floor(date.getTime() / 1000);
}

/** Thông tin người dùng đưa vào JWT và response endpoint 9 (D5: có center_name). */
function toCaller(employee) {
    return {
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        role: employee.role,
        center_id: employee.center_id,
        center_name: employee.center_name,
    };
}

/**
 * Đăng nhập bằng tài khoản mẫu (HT1, W13) và kiểm JWT của các yêu cầu sau.
 * Không biết HTTP hay cookie: controller lo phần đó.
 *
 * @param {object} deps
 * @param {object} deps.employeeRepository có findByUsername(username)
 * @param {object} deps.jwt { secret, expiresIn }
 */
function createAuthService({ employeeRepository, jwt: jwtConfig }) {
    if (!jwtConfig || !jwtConfig.secret) {
        throw new Error('AuthService cần jwt.secret (biến môi trường JWT_SECRET).');
    }

    /**
     * Kiểm tên đăng nhập + mật khẩu; đúng thì ký JWT.
     * `now` truyền vào để test không phụ thuộc giờ máy; dùng làm `iat`, `exp` = now + expiresIn.
     * @returns {{ token: string, caller: object }}
     */
    async function login({ username, password }, now = new Date()) {
        const employee = await employeeRepository.findByUsername(username);
        const passwordMatches = await bcrypt.compare(
            password,
            employee ? employee.password_hash : DUMMY_PASSWORD_HASH,
        );
        if (!employee || !passwordMatches) {
            throw new AppError(ErrorCode.UNAUTHENTICATED, INVALID_CREDENTIALS_MESSAGE);
        }

        const caller = toCaller(employee);
        const token = jwt.sign({ ...caller, iat: toUnixSeconds(now) }, jwtConfig.secret, {
            algorithm: JWT_ALGORITHM,
            expiresIn: jwtConfig.expiresIn,
        });
        return { token, caller };
    }

    /**
     * Kiểm JWT: thiếu, sai chữ ký hoặc hết hạn (tính theo `now`) → UNAUTHENTICATED.
     * Hợp lệ → caller = { employee_id, full_name, role, center_id, center_name } (D3).
     * Không kiểm vai trò ở đây: service của từng chức năng tự kiểm (D3).
     */
    function verifyToken(token, now = new Date()) {
        if (!token) {
            throw new AppError(ErrorCode.UNAUTHENTICATED, MISSING_TOKEN_MESSAGE);
        }
        let payload;
        try {
            payload = jwt.verify(token, jwtConfig.secret, {
                algorithms: [JWT_ALGORITHM],
                clockTimestamp: toUnixSeconds(now),
            });
        } catch {
            throw new AppError(ErrorCode.UNAUTHENTICATED, INVALID_TOKEN_MESSAGE);
        }
        return toCaller(payload);
    }

    return { login, verifyToken };
}

module.exports = { createAuthService, INVALID_CREDENTIALS_MESSAGE };
