'use strict';

// Tiện ích dùng chung của bộ test hệ thống: dựng lại CSDL thử, đếm bản ghi, chạy migrate/seed.
// Chỉ dùng trong tests/system, không dùng trong src/.

const path = require('path');
const { spawnSync } = require('child_process');
const { Client, escapeIdentifier } = require('pg');
const { loadDbConfig } = require('../../../src/config');

const ROOT = path.join(__dirname, '..', '..', '..');

/** Xóa hẳn CSDL `name` (nếu có). Chỉ gọi với CSDL thử, không bao giờ với CSDL dev. */
async function dropDatabase(name) {
    if (!/_systest/.test(name)) throw new Error(`Từ chối xóa CSDL không phải CSDL thử: ${name}`);
    const admin = new Client({ ...loadDbConfig(), database: 'postgres' });
    await admin.connect();
    try {
        await admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(name)} WITH (FORCE)`);
    } finally {
        await admin.end();
    }
}

/** Chạy một script npm (db:migrate, db:seed, setup) với DB_NAME chỉ định; trả mã thoát + stdout. */
function runNpmScript(script, dbName) {
    const result = spawnSync('node', [path.join(ROOT, 'db', `${script}.js`)], {
        cwd: ROOT,
        env: { ...process.env, DB_NAME: dbName },
        encoding: 'utf8',
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** npm run setup = db:migrate + db:seed (package.json). */
function runSetup(dbName) {
    const migrate = runNpmScript('migrate', dbName);
    if (migrate.status !== 0) return migrate;
    const seed = runNpmScript('seed', dbName);
    return { status: seed.status, stdout: migrate.stdout + seed.stdout, stderr: migrate.stderr + seed.stderr };
}

/** Client kết nối CSDL thử hiện tại (DB_NAME do jest.system.config.js đặt). */
async function connect(database = process.env.DB_NAME) {
    const client = new Client({ ...loadDbConfig(), database });
    await client.connect();
    return client;
}

/** Đếm bản ghi của một bảng, tùy chọn điều kiện SQL tham số hóa. */
async function count(client, table, where = 'TRUE', params = []) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);
    return rows[0].n;
}

const COUNTED_TABLES = [
    'service_center', 'employee', 'product', 'issue_category', 'customer', 'device', 'ticket',
    'ticket_status_log', 'ticket_edit_log',
];

async function countAll(client) {
    const counts = {};
    for (const table of COUNTED_TABLES) counts[table] = await count(client, table);
    return counts;
}

module.exports = { dropDatabase, runSetup, connect, count, countAll };
