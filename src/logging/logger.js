'use strict';

/**
 * Logger ghi mỗi sự kiện thành MỘT dòng JSON ra stdout (đọc được bằng `docker compose logs`).
 * Mỗi dòng có thời điểm ISO, mức log, mô tả và ngữ cảnh; mức tối thiểu lấy từ LOG_LEVEL.
 * Không bao giờ ghi mật khẩu, token, cookie hay số điện thoại khách (QT-15, NFR2).
 */

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const DEFAULT_LEVEL = 'info';
const MASK = '***';

// Khóa có chứa một trong các chuỗi này thì thay giá trị bằng ***.
const SENSITIVE_KEYS = ['password', 'token', 'jwt', 'secret', 'authorization', 'cookie', 'phone'];

// Số điện thoại Việt Nam nằm lẫn trong chuỗi (URL, thông báo lỗi): 0xxxxxxxxx, 84xxxxxxxxx, +84xxxxxxxxx.
const PHONE_IN_TEXT = /(?<!\d)(?:\+?84|0)\d{9}(?!\d)/g;

function isSensitiveKey(key) {
    const lower = key.toLowerCase();
    return SENSITIVE_KEYS.some((part) => lower.includes(part));
}

/** Bản sao đã che của một giá trị bất kỳ; Error chỉ giữ tên, thông báo, stack. */
function redact(value) {
    if (typeof value === 'string') return value.replace(PHONE_IN_TEXT, MASK);
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
        return { name: value.name, message: redact(value.message), stack: redact(value.stack || '') };
    }
    if (Array.isArray(value)) return value.map(redact);

    const out = {};
    for (const [key, v] of Object.entries(value)) {
        out[key] = isSensitiveKey(key) ? MASK : redact(v);
    }
    return out;
}

/** LOG_LEVEL lạ hoặc bỏ trống → mức mặc định info, không làm hỏng việc khởi động. */
function resolveLevel(level) {
    const name = String(level || '').toLowerCase();
    return name in LEVELS ? name : DEFAULT_LEVEL;
}

/**
 * @param {object} [options]
 * @param {string} [options.level]  debug | info | warn | error (mặc định info)
 * @param {Function} [options.write] nơi ghi một dòng; mặc định process.stdout; test truyền hàm giả
 * @param {Function} [options.now]   đồng hồ; test truyền giờ cố định
 */
function createLogger({ level, write = (line) => process.stdout.write(line), now = () => new Date() } = {}) {
    const minimum = LEVELS[resolveLevel(level)];

    function log(levelName, message, context = {}) {
        if (LEVELS[levelName] < minimum) return;
        const entry = { time: now().toISOString(), level: levelName, message: redact(message), ...redact(context) };
        write(`${JSON.stringify(entry)}\n`);
    }

    return {
        debug: (message, context) => log('debug', message, context),
        info: (message, context) => log('info', message, context),
        warn: (message, context) => log('warn', message, context),
        error: (message, context) => log('error', message, context),
    };
}

module.exports = { createLogger, redact, resolveLevel, LEVELS };
