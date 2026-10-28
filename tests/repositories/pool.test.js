'use strict';

const { createPool } = require('../../src/repositories/db');

// BUG-002: PostgreSQL ngắt một kết nối đang rảnh (khởi động lại dịch vụ, container db restart)
// → pool phát sự kiện 'error'; không ai nghe thì cả tiến trình máy chủ sập.
// Tạo Pool không mở kết nối nào, nên test không cần PostgreSQL.
const TEST_DB = { host: 'localhost', port: 5432, user: 'test', password: 'test', database: 'test' };

function terminatedByServer() {
    const err = new Error('terminating connection due to administrator command');
    err.code = '57P01'; // SQLSTATE admin_shutdown
    return err;
}

describe('createPool – lỗi của kết nối đang rảnh không làm sập máy chủ (BUG-002)', () => {
    let pool;
    afterEach(async () => {
        if (pool) await pool.end();
        pool = undefined;
    });

    test('BUG-002 dữ liệu sai: CSDL ngắt kết nối đang rảnh → không ném lỗi ra ngoài, gọi onIdleError đúng một lần', () => {
        const onIdleError = jest.fn();
        pool = createPool(TEST_DB, { onIdleError });
        const err = terminatedByServer();

        expect(() => pool.emit('error', err, {})).not.toThrow();
        expect(onIdleError).toHaveBeenCalledTimes(1);
        expect(onIdleError).toHaveBeenCalledWith(err);
    });

    test('BUG-002 dữ liệu sai: quên truyền onIdleError → báo ngay lúc tạo pool, không để lỗi xảy ra lúc chạy', () => {
        expect(() => createPool(TEST_DB)).toThrow(/onIdleError/);
    });
});
