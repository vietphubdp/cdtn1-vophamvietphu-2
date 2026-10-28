'use strict';

const { randomUUID } = require('crypto');

// Mã tương quan nhận từ header chỉ gồm chữ, số, gạch; khác thì sinh mới (không để chèn ký tự lạ vào log).
const INCOMING_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Đường dẫn không kèm query string. Query có thể chứa số điện thoại khách
 * (API 1: /api/customers?phone=…) nên không bao giờ đưa vào log (QT-15, BUG-001).
 */
function requestPath(req) {
    return (req.originalUrl || req.url || '').split('?')[0];
}

/**
 * Middleware gắn requestId cho mỗi yêu cầu (trả lại qua header X-Request-Id) và ghi
 * một dòng log INFO khi yêu cầu kết thúc. Lỗi người dùng (4xx) chỉ hiện ở dòng này,
 * kèm mã lỗi nghiệp vụ do ErrorMapper đặt vào res.locals.errorCode.
 */
function createRequestLogger({ logger }) {
    return function requestLogger(req, res, next) {
        const incoming = req.get('X-Request-Id');
        req.requestId = incoming && INCOMING_REQUEST_ID.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', req.requestId);

        const startedAt = Date.now();
        res.on('finish', () => {
            logger.info('yêu cầu hoàn tất', {
                requestId: req.requestId,
                method: req.method,
                path: requestPath(req),
                status: res.statusCode,
                duration_ms: Date.now() - startedAt,
                employee_id: req.caller ? req.caller.employee_id : undefined,
                error_code: res.locals.errorCode,
            });
        });
        next();
    };
}

module.exports = { createRequestLogger, requestPath };
