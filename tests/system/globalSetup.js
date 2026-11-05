'use strict';

// Chạy MỘT lần trước bộ test hệ thống: xóa CSDL thử rồi dựng lại bằng migrate + seed,
// để tiền điều kiện của mọi test case là đúng dữ liệu seed, không phụ thuộc dữ liệu còn sót trên máy.

const { dropDatabase, runSetup } = require('./helpers/systemDb');

module.exports = async function globalSetup() {
    const dbName = process.env.DB_NAME;
    await dropDatabase(dbName);
    const result = runSetup(dbName);
    if (result.status !== 0) {
        throw new Error(`Dựng CSDL thử ${dbName} thất bại:\n${result.stdout}\n${result.stderr}`);
    }
    process.stdout.write(`\n[test:system] Đã dựng lại CSDL thử "${dbName}" bằng migrate + seed.\n`);
};
