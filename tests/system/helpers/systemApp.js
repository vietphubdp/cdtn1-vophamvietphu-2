'use strict';

// Dựng app THẬT (repository PostgreSQL thật, giống src/server.js) với đồng hồ cố định,
// đăng nhập bằng tài khoản seed và in kết quả thực tế của từng test case ra terminal.

const request = require('supertest');
const { loadConfig } = require('../../../src/config');
const { createPool, createTransactionRunner } = require('../../../src/repositories/db');
const { createEmployeeRepository } = require('../../../src/repositories/EmployeeRepository');
const { createProductRepository } = require('../../../src/repositories/ProductRepository');
const { createIssueCategoryRepository } = require('../../../src/repositories/IssueCategoryRepository');
const { createCustomerRepository } = require('../../../src/repositories/CustomerRepository');
const { createDeviceRepository } = require('../../../src/repositories/DeviceRepository');
const { createTicketRepository } = require('../../../src/repositories/TicketRepository');
const { createTicketStatusLogRepository } = require('../../../src/repositories/TicketStatusLogRepository');
const { createTicketEditLogRepository } = require('../../../src/repositories/TicketEditLogRepository');
const { createLogger } = require('../../../src/logging/logger');
const { createApp } = require('../../../src/app');
const { DEMO_PASSWORD } = require('../../../db/seeds/002_employee');

function createSystemPool() {
    const config = loadConfig();
    return createPool(config.db, { onIdleError: () => {} });
}

/** App thật, đồng hồ cố định `now` (giờ VN). Log chỉ ghi mức error để terminal gọn. */
function createSystemApp(pool, now) {
    const config = loadConfig();
    return createApp({
        logger: createLogger({ level: 'error' }),
        repositories: {
            employee: createEmployeeRepository(pool),
            product: createProductRepository(pool),
            issueCategory: createIssueCategoryRepository(pool),
            customer: createCustomerRepository(pool),
            device: createDeviceRepository(pool),
            ticket: createTicketRepository(pool),
            ticketStatusLog: createTicketStatusLogRepository(pool),
            ticketEditLog: createTicketEditLogRepository(pool),
        },
        jwt: config.jwt,
        withTransaction: createTransactionRunner(pool),
        now: () => now,
    });
}

async function loginAs(app, username) {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username, password: DEMO_PASSWORD }).expect(200);
    return agent;
}

/** In "kết quả thực tế" của test case ra terminal (cột 7 của Test Report). */
function report(tcId, lines) {
    const body = lines.map((line) => `    ${line}`).join('\n');
    process.stdout.write(`\n  ${tcId} · Kết quả thực tế\n${body}\n`);
}

module.exports = { createSystemPool, createSystemApp, loginAs, report };
