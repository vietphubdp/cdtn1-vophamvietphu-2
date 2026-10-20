'use strict';

// npm run db:migrate
// 1) Tạo CSDL DB_NAME nếu chưa có (Q6: người chấm không phải gõ thêm lệnh).
// 2) Chạy db/schema.sql. Mọi lệnh trong schema dùng IF NOT EXISTS nên chạy lại không lỗi.

const fs = require('fs');
const path = require('path');
const { Client, escapeIdentifier } = require('pg');
const { loadDbConfig } = require('../src/config');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const PG_DUPLICATE_DATABASE = '42P04';

async function createDatabaseIfMissing(dbConfig) {
    // Kết nối vào CSDL quản trị mặc định "postgres" để kiểm tra / tạo CSDL đích.
    const admin = new Client({ ...dbConfig, database: 'postgres' });
    await admin.connect();
    try {
        const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbConfig.database]);
        if (found.rowCount > 0) {
            console.log(`CSDL "${dbConfig.database}" đã có, bỏ qua bước tạo.`);
            return;
        }
        // Tên CSDL không truyền được bằng tham số $1 nên phải escape định danh.
        // UTF8 + template0 để lưu được tiếng Việt kể cả khi máy chủ mặc định mã khác.
        await admin.query(
            `CREATE DATABASE ${escapeIdentifier(dbConfig.database)} ENCODING 'UTF8' TEMPLATE template0`,
        );
        console.log(`Đã tạo CSDL "${dbConfig.database}".`);
    } catch (err) {
        if (err.code !== PG_DUPLICATE_DATABASE) throw err; // tạo đồng thời ở nơi khác: coi như đã có
    } finally {
        await admin.end();
    }
}

async function runSchema(dbConfig) {
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const client = new Client(dbConfig);
    await client.connect();
    try {
        await client.query(sql);
        console.log('Đã chạy db/schema.sql.');
    } finally {
        await client.end();
    }
}

async function main() {
    const dbConfig = loadDbConfig();
    await createDatabaseIfMissing(dbConfig);
    await runSchema(dbConfig);
}

main().catch((err) => {
    console.error('Migrate thất bại:', err.message);
    process.exitCode = 1;
});
