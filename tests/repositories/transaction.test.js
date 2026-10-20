'use strict';

const { createTransactionRunner } = require('../../src/repositories/db');

// Pool giả: ghi lại các câu lệnh điều khiển giao dịch, không cần PostgreSQL.
function createFakePool({ failOn } = {}) {
    const client = {
        statements: [],
        released: false,
        async query(sql) {
            this.statements.push(sql);
            if (sql === failOn) throw new Error(`lỗi giả ở ${sql}`);
            return { rows: [], rowCount: 0 };
        },
        release() {
            this.released = true;
        },
    };
    return { client, pool: { connect: async () => client } };
}

describe('withTransaction – helper giao dịch cho lớp service', () => {
    test('NFR4 luồng đúng: work thành công → BEGIN, các lệnh, COMMIT; trả kết quả; trả kết nối', async () => {
        const { pool, client } = createFakePool();
        const withTransaction = createTransactionRunner(pool);

        const result = await withTransaction(async (tx) => {
            await tx.query('INSERT ticket');
            await tx.query('INSERT ticket_status_log');
            return { ticket_id: 1 };
        });

        expect(result).toEqual({ ticket_id: 1 });
        expect(client.statements).toEqual(['BEGIN', 'INSERT ticket', 'INSERT ticket_status_log', 'COMMIT']);
        expect(client.released).toBe(true);
    });

    test('NFR4 dữ liệu sai: lỗi ở bước ghi lịch sử → ROLLBACK, không COMMIT, ném lại đúng lỗi gốc', async () => {
        const { pool, client } = createFakePool({ failOn: 'INSERT ticket_status_log' });
        const withTransaction = createTransactionRunner(pool);

        const run = withTransaction(async (tx) => {
            await tx.query('INSERT ticket');
            await tx.query('INSERT ticket_status_log');
        });

        await expect(run).rejects.toThrow('lỗi giả ở INSERT ticket_status_log');
        expect(client.statements).toEqual(['BEGIN', 'INSERT ticket', 'INSERT ticket_status_log', 'ROLLBACK']);
        expect(client.released).toBe(true);
    });

    test('NFR4 giá trị biên: ROLLBACK cũng lỗi (mất kết nối) → vẫn ném lỗi gốc và trả kết nối', async () => {
        const { pool, client } = createFakePool({ failOn: 'ROLLBACK' });
        const withTransaction = createTransactionRunner(pool);
        const original = new Error('lỗi nghiệp vụ');

        const run = withTransaction(async () => {
            throw original;
        });

        await expect(run).rejects.toBe(original);
        expect(original.rollbackError).toBeInstanceOf(Error);
        expect(client.released).toBe(true);
    });
});

describe('Kết nối pg – đọc kiểu dữ liệu', () => {
    const { types } = require('pg');

    test('QT-05 giá trị biên: DATE đọc ra nguyên chuỗi YYYY-MM-DD, không lệch ngày theo giờ máy', () => {
        expect(types.getTypeParser(1082)('2026-03-05')).toBe('2026-03-05');
    });

    test('TĐ-06 luồng đúng: BIGINT (mã khóa, count) đọc ra số như api-contract', () => {
        expect(types.getTypeParser(20)('1024')).toBe(1024);
    });
});
