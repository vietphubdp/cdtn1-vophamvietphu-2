'use strict';

const DEFAULT_TIMEOUT_MS = 8000; // ngắn hơn 10 giây Docker chờ trước khi giết cứng

/**
 * Hàm dừng máy chủ an toàn khi nhận SIGTERM/SIGINT (BUG-003): ngừng nhận yêu cầu mới,
 * chờ yêu cầu đang chạy xong, đóng pool CSDL rồi thoát. Yêu cầu treo quá `timeoutMs`
 * thì thoát cưỡng bức để Docker không phải giết cứng. Gọi nhiều lần chỉ dừng một lần.
 *
 * @param {object} deps
 * @param {object} deps.server   http.Server từ app.listen
 * @param {object} deps.pool     pool `pg`
 * @param {object} deps.logger
 * @param {Function} [deps.exit] mặc định process.exit; test truyền hàm giả
 * @param {number} [deps.timeoutMs]
 */
function createShutdownHandler({ server, pool, logger, exit = process.exit, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    let stopping = null;

    return function shutdown(signal) {
        if (stopping) return stopping;
        logger.info(`nhận ${signal}, đang dừng máy chủ`, { signal });

        const timer = setTimeout(() => {
            logger.error('quá thời hạn dừng máy chủ, thoát cưỡng bức', { signal, timeout_ms: timeoutMs });
            exit(1);
        }, timeoutMs);
        timer.unref?.();

        stopping = new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        })
            .then(() => pool.end())
            .then(() => {
                clearTimeout(timer);
                logger.info('đã dừng máy chủ', { signal });
                exit(0);
            })
            .catch((err) => {
                clearTimeout(timer);
                logger.error('lỗi khi dừng máy chủ', { signal, error: err });
                exit(1);
            });
        return stopping;
    };
}

module.exports = { createShutdownHandler };
