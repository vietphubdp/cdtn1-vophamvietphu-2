'use strict';

const { loadConfig } = require('./config');
const { createPool, createTransactionRunner } = require('./repositories/db');
const { createEmployeeRepository } = require('./repositories/EmployeeRepository');
const { createProductRepository } = require('./repositories/ProductRepository');
const { createIssueCategoryRepository } = require('./repositories/IssueCategoryRepository');
const { createCustomerRepository } = require('./repositories/CustomerRepository');
const { createDeviceRepository } = require('./repositories/DeviceRepository');
const { createTicketRepository } = require('./repositories/TicketRepository');
const { createTicketStatusLogRepository } = require('./repositories/TicketStatusLogRepository');
const { createTicketEditLogRepository } = require('./repositories/TicketEditLogRepository');
const { createLogger } = require('./logging/logger');
const { createApp } = require('./app');
const { createShutdownHandler } = require('./shutdown');

const config = loadConfig();
const logger = createLogger({ level: config.logLevel });
const pool = createPool(config.db, {
    // BUG-002: ghi log rồi chạy tiếp; yêu cầu sau pool tự mở kết nối mới.
    onIdleError: (err) => logger.error('CSDL ngắt một kết nối đang rảnh; yêu cầu sau sẽ mở kết nối mới', { error: err }),
});

const app = createApp({
    logger,
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
});

const server = app.listen(config.port, () => {
    logger.info(`máy chủ chạy tại http://localhost:${config.port} (kiểm tra: /health)`, { port: config.port });
});

// BUG-003: docker compose stop/down gửi SIGTERM; Ctrl+C gửi SIGINT.
const shutdown = createShutdownHandler({ server, pool, logger });
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
