'use strict';

// npm run db:seed
// Chạy lần lượt các file db/seeds/NNN_*.js theo số thứ tự đầu tên file, trong MỘT giao dịch:
// lỗi ở bất kỳ bước nào thì không bảng nào bị nạp dở.
// Mỗi file chèn bằng ON CONFLICT DO NOTHING theo cột UNIQUE nên chạy lại không nhân đôi.
// Không có lệnh DELETE/TRUNCATE nào (QT-13).

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { loadDbConfig } = require('../src/config');

const SEEDS_DIR = path.join(__dirname, 'seeds');
const COUNTED_TABLES = ['service_center', 'employee', 'product', 'issue_category', 'customer', 'device'];

function listSeedFiles() {
    return fs
        .readdirSync(SEEDS_DIR)
        .filter((name) => /^\d{3}_.+\.js$/.test(name))
        .sort();
}

async function printCounts(client) {
    for (const table of COUNTED_TABLES) {
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
        console.log(`  ${table.padEnd(16)} ${rows[0].n} dòng`);
    }
}

async function main() {
    const client = new Client(loadDbConfig());
    await client.connect();
    try {
        await client.query('BEGIN');
        for (const file of listSeedFiles()) {
            const { seed } = require(path.join(SEEDS_DIR, file));
            const inserted = await seed(client);
            console.log(`${file}: thêm mới ${inserted} dòng`);
        }
        await client.query('COMMIT');
        console.log('Seed xong. Số dòng hiện có:');
        await printCounts(client);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Seed thất bại, đã hoàn tác toàn bộ:', err.message);
    console.error('Kiểm tra đã chạy "npm run db:migrate" chưa.');
    process.exitCode = 1;
});
