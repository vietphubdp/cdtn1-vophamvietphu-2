'use strict';

const { createLogger, redact, resolveLevel } = require('../../src/logging/logger');

// Logger JSON ra stdout (TĐ-15): test bằng hàm ghi giả và đồng hồ cố định, không đụng stdout thật.
const FIXED_NOW = () => new Date('2026-10-28T07:30:00Z');

function captureLogger(level) {
    const lines = [];
    const logger = createLogger({ level, write: (line) => lines.push(line), now: FIXED_NOW });
    return { logger, lines, entries: () => lines.map((l) => JSON.parse(l)) };
}

describe('Logger – mỗi sự kiện một dòng JSON có thời điểm, mức, ngữ cảnh', () => {
    test('TĐ-15 luồng đúng: ghi một dòng JSON có time ISO, level, message và ngữ cảnh', () => {
        const { logger, lines, entries } = captureLogger('info');

        logger.info('đã lập phiếu', { requestId: 'abc-12345', ticket_code: 'BH000031/2026' });

        expect(lines).toHaveLength(1);
        expect(lines[0].endsWith('\n')).toBe(true);
        expect(entries()[0]).toEqual({
            time: '2026-10-28T07:30:00.000Z',
            level: 'info',
            message: 'đã lập phiếu',
            requestId: 'abc-12345',
            ticket_code: 'BH000031/2026',
        });
    });

    test('TĐ-15 giá trị biên: mức thấp hơn LOG_LEVEL bị bỏ, đúng bằng LOG_LEVEL thì ghi', () => {
        const { logger, entries } = captureLogger('warn');

        logger.info('bỏ qua');
        logger.warn('đúng ngưỡng');
        logger.error('cao hơn ngưỡng');

        expect(entries().map((e) => e.level)).toEqual(['warn', 'error']);
    });

    test.each([
        ['không đặt', undefined],
        ['chuỗi rỗng', ''],
        ['giá trị lạ', 'verbose'],
    ])('TĐ-15 dữ liệu sai: LOG_LEVEL %s → dùng mức info, không làm hỏng khởi động', (_label, level) => {
        expect(resolveLevel(level)).toBe('info');
    });

    test('TĐ-15 giá trị biên: LOG_LEVEL viết hoa vẫn nhận', () => {
        expect(resolveLevel('DEBUG')).toBe('debug');
    });
});

describe('Logger – không ghi dữ liệu nhạy cảm (QT-15, NFR2)', () => {
    test('QT-15 dữ liệu sai: khóa password, token, cookie, phone bị thay bằng ***', () => {
        const out = redact({
            username: 'lan.q10',
            password: 'Demo@2026',
            headers: { authorization: 'Bearer x.y.z', cookie: 'token=abc' },
            customer: { phone: '0901234567', full_name: 'Nguyễn Văn An' },
        });

        expect(out).toEqual({
            username: 'lan.q10',
            password: '***',
            headers: { authorization: '***', cookie: '***' },
            customer: { phone: '***', full_name: 'Nguyễn Văn An' },
        });
    });

    test.each([
        ['0901234567', '/api/customers?phone=0901234567', '/api/customers?phone=***'],
        ['+84901234567', 'tra số +84901234567 thất bại', 'tra số *** thất bại'],
        ['84901234567', 'phone=84901234567&x=1', 'phone=***&x=1'],
    ])('QT-15 dữ liệu sai: số %s nằm lẫn trong chuỗi bị che', (_phone, text, expected) => {
        expect(redact(text)).toBe(expected);
    });

    test.each([
        ['mã phiếu', 'BH000031/2026'],
        ['serial 12 chữ số', 'SN202610260001'],
        ['mã khách 6 chữ số', 'customer 100001'],
        ['9 chữ số (không đủ một số điện thoại)', '090123456'],
    ])('QT-15 giá trị biên: %s không bị che nhầm', (_label, text) => {
        expect(redact(text)).toBe(text);
    });

    test('TĐ-15 luồng đúng: Error chỉ giữ name, message, stack (đã che), không giữ thuộc tính khác của pg', () => {
        const err = new Error('duplicate key value violates unique constraint "customer_phone_key"');
        err.detail = 'Key (phone)=(0901234567) already exists.';

        const out = redact({ error: err });

        expect(Object.keys(out.error).sort()).toEqual(['message', 'name', 'stack']);
        expect(JSON.stringify(out)).not.toContain('0901234567');
    });
});
