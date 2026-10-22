'use strict';

const bcrypt = require('bcrypt');
const { Role } = require('../../src/domain/constants');
const { createFakeProductRepository, createFakeIssueCategoryRepository } = require('./fakeCatalog');

// Dữ liệu giả cho test đăng nhập, không cần CSDL (D4).
const TEST_PASSWORD = 'Demo@2026';
const TEST_JWT = Object.freeze({ secret: 'khoa-chi-dung-cho-test', expiresIn: '8h' });
const BCRYPT_TEST_COST = 4; // cost thấp nhất để test chạy nhanh; bcrypt.compare đọc cost từ chính mã băm

const TEST_EMPLOYEES = [
    {
        employee_id: 7,
        username: 'lan.q10',
        full_name: 'Trần Thị Lan',
        role: Role.TIEP_NHAN,
        center_id: 2,
        center_name: 'Trung tâm bảo hành Quận 10',
    },
    {
        employee_id: 8,
        username: 'hung.q10',
        full_name: 'Đỗ Quốc Hùng',
        role: Role.QUAN_LY_TRUNG_TAM,
        center_id: 2,
        center_name: 'Trung tâm bảo hành Quận 10',
    },
];

/** EmployeeRepository giả: giống bản thật, trả cả password_hash; không có → null. */
function createFakeEmployeeRepository() {
    const passwordHash = bcrypt.hashSync(TEST_PASSWORD, BCRYPT_TEST_COST);
    const rows = TEST_EMPLOYEES.map((e) => ({ ...e, password_hash: passwordHash }));
    return {
        findByUsername: jest.fn(async (username) => {
            const row = rows.find((r) => r.username === username);
            if (!row) return null;
            const { username: _ignored, ...employee } = row;
            return employee;
        }),
    };
}

function createSilentLogger() {
    return { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() };
}

/** deps cho createApp với repository giả; ghi đè từng phần qua `overrides`. */
function createTestDeps(overrides = {}) {
    return {
        repositories: {
            employee: createFakeEmployeeRepository(),
            product: createFakeProductRepository(),
            issueCategory: createFakeIssueCategoryRepository(),
        },
        jwt: TEST_JWT,
        logger: createSilentLogger(),
        ...overrides,
    };
}

module.exports = {
    TEST_PASSWORD,
    TEST_JWT,
    TEST_EMPLOYEES,
    createFakeEmployeeRepository,
    createSilentLogger,
    createTestDeps,
};
