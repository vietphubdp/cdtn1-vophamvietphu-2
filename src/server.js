'use strict';

const { loadConfig } = require('./config');
const { createPool, createTransactionRunner } = require('./repositories/db');
const { createEmployeeRepository } = require('./repositories/EmployeeRepository');
const { createProductRepository } = require('./repositories/ProductRepository');
const { createIssueCategoryRepository } = require('./repositories/IssueCategoryRepository');
const { createCustomerRepository } = require('./repositories/CustomerRepository');
const { createDeviceRepository } = require('./repositories/DeviceRepository');
const { createApp } = require('./app');

const config = loadConfig();
const pool = createPool(config.db);

const app = createApp({
    repositories: {
        employee: createEmployeeRepository(pool),
        product: createProductRepository(pool),
        issueCategory: createIssueCategoryRepository(pool),
        customer: createCustomerRepository(pool),
        device: createDeviceRepository(pool),
    },
    jwt: config.jwt,
    withTransaction: createTransactionRunner(pool),
});

app.listen(config.port, () => {
    console.log(`Máy chủ chạy tại http://localhost:${config.port} (kiểm tra: /health)`);
});
