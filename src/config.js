'use strict';

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function requireEnv(name) {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(
            `Thiếu biến môi trường ${name}. Chạy "cp .env.example .env" rồi điền giá trị trong .env.`,
        );
    }
    return value;
}

/** Cấu hình kết nối PostgreSQL, dùng chung cho máy chủ web và script migrate/seed. */
function loadDbConfig() {
    return {
        host: requireEnv('DB_HOST'),
        port: Number(requireEnv('DB_PORT')),
        user: requireEnv('DB_USER'),
        password: process.env.DB_PASSWORD || '',
        database: requireEnv('DB_NAME'),
    };
}

function loadConfig() {
    return {
        port: Number(process.env.PORT || 3000),
        logLevel: process.env.LOG_LEVEL || 'info',
        db: loadDbConfig(),
        jwt: {
            secret: requireEnv('JWT_SECRET'),
            expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        },
    };
}

module.exports = { loadConfig, loadDbConfig };
