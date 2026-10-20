'use strict';

const { loadConfig } = require('./config');
const { createPool, createTransactionRunner } = require('./repositories/db');
const { createApp } = require('./app');

const config = loadConfig();
const pool = createPool(config.db);

const app = createApp({
    repositories: {},
    withTransaction: createTransactionRunner(pool),
});

app.listen(config.port, () => {
    console.log(`Máy chủ chạy tại http://localhost:${config.port} (kiểm tra: /health)`);
});
