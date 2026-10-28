'use strict';

const { createShutdownHandler } = require('../../src/shutdown');

// BUG-003: `docker compose stop/down` gửi SIGTERM; máy chủ không xử lý nên Docker chờ hết 10 giây
// rồi giết cứng (mã thoát 137), yêu cầu đang chạy bị cắt ngang. Test dùng server, pool, exit giả.
function fakes({ closeError, endError } = {}) {
    return {
        server: { close: jest.fn((cb) => cb(closeError)) },
        pool: { end: jest.fn(async () => { if (endError) throw endError; }) },
        logger: { info: jest.fn(), error: jest.fn() },
        exit: jest.fn(),
    };
}

describe('createShutdownHandler – dừng máy chủ khi nhận SIGTERM (BUG-003)', () => {
    test('BUG-003 luồng đúng: SIGTERM → ngừng nhận yêu cầu mới, đóng pool, thoát mã 0, có log', async () => {
        const deps = fakes();
        const shutdown = createShutdownHandler(deps);

        await shutdown('SIGTERM');

        expect(deps.server.close).toHaveBeenCalledTimes(1);
        expect(deps.pool.end).toHaveBeenCalledTimes(1);
        expect(deps.server.close.mock.invocationCallOrder[0]).toBeLessThan(deps.pool.end.mock.invocationCallOrder[0]);
        expect(deps.exit).toHaveBeenCalledWith(0);
        expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining('SIGTERM'), expect.any(Object));
    });

    test('BUG-003 giá trị biên: nhận tín hiệu lần hai trong lúc đang dừng → không đóng lại lần nữa', async () => {
        const deps = fakes();
        const shutdown = createShutdownHandler(deps);

        await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);

        expect(deps.server.close).toHaveBeenCalledTimes(1);
        expect(deps.pool.end).toHaveBeenCalledTimes(1);
        expect(deps.exit).toHaveBeenCalledTimes(1);
    });

    test('BUG-003 dữ liệu sai: đóng pool lỗi → ghi log ERROR, vẫn thoát (mã 1), không treo', async () => {
        const deps = fakes({ endError: new Error('pool đã đóng') });
        const shutdown = createShutdownHandler(deps);

        await shutdown('SIGTERM');

        expect(deps.logger.error).toHaveBeenCalledTimes(1);
        expect(deps.exit).toHaveBeenCalledWith(1);
    });

    test('BUG-003 giá trị biên: yêu cầu đang chạy không xong trong thời hạn → thoát cưỡng bức mã 1', async () => {
        jest.useFakeTimers();
        try {
            const deps = fakes();
            deps.server.close = jest.fn(); // không bao giờ gọi callback: còn yêu cầu treo
            const shutdown = createShutdownHandler({ ...deps, timeoutMs: 8000 });

            shutdown('SIGTERM');
            jest.advanceTimersByTime(7999);
            expect(deps.exit).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1);

            expect(deps.exit).toHaveBeenCalledWith(1);
            expect(deps.logger.error).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });
});
