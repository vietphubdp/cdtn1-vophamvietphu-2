'use strict';

// Cấu hình Jest cho bộ test hệ thống TC-01…TC-12 (Test Report, docs/test-report.md).
// Khác `npm test`: chạy qua HTTP (Supertest) vào app thật + PostgreSQL thật, trên một CSDL thử
// riêng (mặc định smart_crm_l2_systest) để không đụng CSDL dev. CSDL thử bị xóa và dựng lại
// bằng migrate + seed trước mỗi lần chạy (tests/system/globalSetup.js).
//
//   npm run test:system                      chạy cả 12 test case
//   npm run test:system -- -t "TC-05"        chạy riêng một test case

process.env.DB_NAME = process.env.SYSTEST_DB_NAME || 'smart_crm_l2_systest';

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests/system'],
    globalSetup: '<rootDir>/tests/system/globalSetup.js',
    testTimeout: 60000,
    verbose: true,
};
