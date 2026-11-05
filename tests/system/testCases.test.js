'use strict';

// Test Report – 12 test case chạy THẬT: app thật + PostgreSQL thật (CSDL thử smart_crm_l2_systest,
// dựng lại bằng migrate + seed trước mỗi lần chạy). Mỗi TC khớp một dòng trong docs/test-report.md.
// Đồng hồ cố định theo giờ Việt Nam (+07:00) nên kết quả không phụ thuộc ngày chạy.
//
//   npm run test:system                  chạy cả 12 TC
//   npm run test:system -- -t "TC-05"    chạy riêng một TC

const { randomUUID } = require('crypto');
const request = require('supertest');
const { connect, count, countAll, dropDatabase, runSetup } = require('./helpers/systemDb');
const { createSystemPool, createSystemApp, loginAs, report } = require('./helpers/systemApp');

// Dữ liệu seed dùng làm tiền điều kiện (data/sample, db/seeds)
const CUSTOMER_AN = 100001; // Nguyễn Văn An, 0901234567
const DEVICE_AN_WARRANTY = 1; // của khách 100001, mua 2026-03-05, BH 12 tháng → hết hạn 2027-03-05
const DEVICE_AN_NO_PURCHASE = 2; // của khách 100001, không có ngày mua
const DEVICE_OF_561 = 3; // của khách 561, serial SN973444858560
const SERIAL_OF_561 = 'SN973444858560';
const TICKET_Q10 = 10; // BH000010/2026, trung tâm 1 (Quận 10), trạng thái MOI

let pool;
let db;

beforeAll(async () => {
    pool = createSystemPool();
    db = await connect();
});

afterAll(async () => {
    await db.end();
    await pool.end();
});

const at = (iso) => new Date(iso);

describe('Test Report L2 – chạy thật trên PostgreSQL', () => {
    test('TC-01 [Luồng đúng] QT-04, QT-06: Cao lúc 10:00 thứ Bảy → hạn 10:00 thứ Hai, phiếu MOI + 1 dòng lịch sử', async () => {
        const app = createSystemApp(pool, at('2026-11-07T10:00:00+07:00')); // thứ Bảy
        const lan = await loginAs(app, 'lan.q10');
        const ticketsBefore = await count(db, 'ticket');
        const logsBefore = await count(db, 'ticket_status_log');

        const res = await lan.post('/api/tickets').set('Idempotency-Key', randomUUID()).send({
            customer_id: CUSTOMER_AN,
            device_id: DEVICE_AN_WARRANTY,
            issue_desc: 'Màn hình sọc xanh sau khi cập nhật phần mềm',
            category_id: 1,
            priority: 'CAO',
        });

        const ticketsAfter = await count(db, 'ticket');
        const logRows = await count(db, 'ticket_status_log', 'ticket_id = $1 AND to_status = $2', [res.body.ticket_id, 'MOI']);
        report('TC-01', [
            `HTTP ${res.status} · ticket_code=${res.body.ticket_code} · status=${res.body.status} · warranty_status=${res.body.warranty_status}`,
            `received_at=${res.body.received_at} · due_date=${res.body.due_date}`,
            `Bảng ticket: ${ticketsBefore} → ${ticketsAfter} · ticket_status_log của phiếu (MOI): ${logRows} dòng (tổng ${logsBefore} → ${await count(db, 'ticket_status_log')})`,
        ]);

        expect(res.status).toBe(201);
        expect(res.body.ticket_code).toMatch(/^BH\d{6}\/2026$/);
        expect(res.body.status).toBe('MOI');
        expect(res.body.warranty_status).toBe('CON_BAO_HANH');
        expect(new Date(res.body.due_date).getTime()).toBe(at('2026-11-09T10:00:00+07:00').getTime());
        expect(ticketsAfter).toBe(ticketsBefore + 1);
        expect(logRows).toBe(1);
    });

    test('TC-02 [Luồng đúng] QT-05, QT-04: thiết bị thiếu ngày mua → phiếu CHUA_XAC_MINH, Thấp 120 giờ', async () => {
        const app = createSystemApp(pool, at('2026-11-02T09:00:00+07:00')); // thứ Hai
        const lan = await loginAs(app, 'lan.q10');

        const res = await lan.post('/api/tickets').set('Idempotency-Key', randomUUID()).send({
            customer_id: CUSTOMER_AN,
            device_id: DEVICE_AN_NO_PURCHASE,
            issue_desc: 'Ứng dụng tự thoát liên tục khi mở camera',
            category_id: 4,
            priority: 'THAP',
        });

        const { rows } = await db.query('SELECT warranty_status, status, due_date FROM ticket WHERE ticket_id = $1', [res.body.ticket_id]);
        report('TC-02', [
            `HTTP ${res.status} · ticket_code=${res.body.ticket_code} · warranty_status=${res.body.warranty_status} · due_date=${res.body.due_date}`,
            `Dòng trong CSDL: warranty_status=${rows[0] && rows[0].warranty_status} · status=${rows[0] && rows[0].status} · due_date=${rows[0] && rows[0].due_date.toISOString()}`,
        ]);

        expect(res.status).toBe(201);
        expect(res.body.warranty_status).toBe('CHUA_XAC_MINH');
        expect(rows[0].warranty_status).toBe('CHUA_XAC_MINH');
        // Thấp 120 giờ từ 09:00 thứ Hai, không chạm Chủ nhật → 09:00 thứ Bảy
        expect(new Date(res.body.due_date).getTime()).toBe(at('2026-11-07T09:00:00+07:00').getTime());
    });

    test('TC-03 [Giá trị biên] QT-05: 23:59 ngày hết hạn 05/03/2027 → vẫn CON_BAO_HANH', async () => {
        const app = createSystemApp(pool, at('2027-03-05T23:59:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');

        const res = await lan.get(`/api/devices/${DEVICE_AN_WARRANTY}/warranty`);
        report('TC-03', [
            `HTTP ${res.status} · purchase_date=${res.body.purchase_date} · warranty_months=${res.body.warranty_months}`,
            `warranty_expires_on=${res.body.warranty_expires_on} · warranty_status=${res.body.warranty_status}`,
        ]);

        expect(res.status).toBe(200);
        expect(res.body.warranty_expires_on).toBe('2027-03-05');
        expect(res.body.warranty_status).toBe('CON_BAO_HANH');
    });

    test('TC-04 [Giá trị biên] QT-05: 00:00 ngày 06/03/2027 (ngày đầu sau hạn) → HET_BAO_HANH', async () => {
        const app = createSystemApp(pool, at('2027-03-06T00:00:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');

        const res = await lan.get(`/api/devices/${DEVICE_AN_WARRANTY}/warranty`);
        report('TC-04', [
            `HTTP ${res.status} · purchase_date=${res.body.purchase_date} · warranty_months=${res.body.warranty_months}`,
            `warranty_expires_on=${res.body.warranty_expires_on} · warranty_status=${res.body.warranty_status}`,
        ]);

        expect(res.status).toBe(200);
        expect(res.body.warranty_expires_on).toBe('2027-03-05');
        expect(res.body.warranty_status).toBe('HET_BAO_HANH');
    });

    test('TC-05 [Dữ liệu sai] US5-AC2: mô tả lỗi 9 ký tự → 400 nêu trường issue_desc, không thêm phiếu', async () => {
        const app = createSystemApp(pool, at('2026-11-05T09:00:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');
        const before = await count(db, 'ticket');

        const res = await lan.post('/api/tickets').set('Idempotency-Key', randomUUID()).send({
            customer_id: CUSTOMER_AN,
            device_id: DEVICE_AN_WARRANTY,
            issue_desc: 'Lỗi sạc!!', // 9 ký tự, dưới ngưỡng 10
            category_id: 3,
            priority: 'TRUNG_BINH',
        });

        const after = await count(db, 'ticket');
        report('TC-05', [
            `HTTP ${res.status} · error=${JSON.stringify(res.body.error)}`,
            `Bảng ticket: ${before} → ${after}`,
        ]);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(res.body.error.fields.issue_desc).toBe('Mô tả lỗi phải có từ 10 đến 2000 ký tự');
        expect(after).toBe(before);
    });

    test('TC-06 [Dữ liệu sai] US2, QT-02: tạo khách thiếu họ tên và số "12345" → 400 gom đủ 2 trường, không thêm khách', async () => {
        const app = createSystemApp(pool, at('2026-11-05T09:00:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');
        const before = await count(db, 'customer');

        const res = await lan.post('/api/customers').send({ full_name: '   ', phone: '12345', email: null, address: null });

        const after = await count(db, 'customer');
        report('TC-06', [
            `HTTP ${res.status} · error=${JSON.stringify(res.body.error)}`,
            `Bảng customer: ${before} → ${after}`,
        ]);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(Object.keys(res.body.error.fields).sort()).toEqual(['full_name', 'phone']);
        expect(after).toBe(before);
    });

    test('TC-07 [Dữ liệu sai] QT-03, US5-AC3: lập phiếu với thiết bị của khách khác → 422, không thêm phiếu và lịch sử', async () => {
        const app = createSystemApp(pool, at('2026-11-05T09:00:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');
        const ticketsBefore = await count(db, 'ticket');
        const logsBefore = await count(db, 'ticket_status_log');

        const res = await lan.post('/api/tickets').set('Idempotency-Key', randomUUID()).send({
            customer_id: CUSTOMER_AN,
            device_id: DEVICE_OF_561,
            issue_desc: 'Máy không nhận sạc, cắm sạc báo lỗi phụ kiện',
            category_id: 3,
            priority: 'TRUNG_BINH',
        });

        const ticketsAfter = await count(db, 'ticket');
        const logsAfter = await count(db, 'ticket_status_log');
        report('TC-07', [
            `HTTP ${res.status} · error=${JSON.stringify(res.body.error)}`,
            `Bảng ticket: ${ticketsBefore} → ${ticketsAfter} · ticket_status_log: ${logsBefore} → ${logsAfter}`,
        ]);

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
        expect(res.body.error.message).toBe('Thiết bị không thuộc khách hàng này');
        expect(ticketsAfter).toBe(ticketsBefore);
        expect(logsAfter).toBe(logsBefore);
    });

    test('TC-08 [Dữ liệu sai] QT-03: ghi nhận thiết bị với serial đã thuộc khách khác → 409, không thêm thiết bị', async () => {
        const app = createSystemApp(pool, at('2026-11-05T09:00:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');
        const before = await count(db, 'device');

        const res = await lan.post(`/api/customers/${CUSTOMER_AN}/devices`).send({
            product_id: 1,
            serial_no: SERIAL_OF_561,
            purchase_date: null,
            warranty_months: null,
        });

        const after = await count(db, 'device');
        const { rows } = await db.query('SELECT customer_id FROM device WHERE serial_no = $1', [SERIAL_OF_561]);
        report('TC-08', [
            `HTTP ${res.status} · error=${JSON.stringify(res.body.error)}`,
            `Bảng device: ${before} → ${after} · serial ${SERIAL_OF_561} vẫn thuộc customer_id=${rows[0].customer_id}`,
        ]);

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('CONFLICT');
        expect(after).toBe(before);
        expect(Number(rows[0].customer_id)).toBe(561);
    });

    test('TC-09 [Bảo mật] QT-14 (OWASP A01): nhân viên trung tâm khác sửa phiếu → 404, phiếu không đổi', async () => {
        const app = createSystemApp(pool, at('2026-11-05T09:00:00+07:00'));
        const mai = await loginAs(app, 'mai.tb'); // Tiếp nhận, trung tâm 2 (Tân Bình)
        const read = 'SELECT center_id, issue_desc, priority, due_date FROM ticket WHERE ticket_id = $1';
        const before = (await db.query(read, [TICKET_Q10])).rows[0];
        const editLogBefore = await count(db, 'ticket_edit_log', 'ticket_id = $1', [TICKET_Q10]);

        const getRes = await mai.get(`/api/tickets/${TICKET_Q10}`);
        const patchRes = await mai.patch(`/api/tickets/${TICKET_Q10}`).send({
            issue_desc: 'Sửa trái phép mô tả lỗi của trung tâm khác',
            priority: 'THAP',
            reason: 'Thử sửa phiếu không thuộc trung tâm mình',
        });

        const after = (await db.query(read, [TICKET_Q10])).rows[0];
        const editLogAfter = await count(db, 'ticket_edit_log', 'ticket_id = $1', [TICKET_Q10]);
        report('TC-09', [
            `GET  /api/tickets/${TICKET_Q10} → HTTP ${getRes.status} · error.code=${getRes.body.error && getRes.body.error.code}`,
            `PATCH /api/tickets/${TICKET_Q10} → HTTP ${patchRes.status} · error.code=${patchRes.body.error && patchRes.body.error.code}`,
            `Phiếu ${TICKET_Q10} (center_id=${before.center_id}): priority ${before.priority} → ${after.priority} · issue_desc giữ nguyên: ${before.issue_desc === after.issue_desc} · ticket_edit_log: ${editLogBefore} → ${editLogAfter}`,
        ]);

        expect(getRes.status).toBe(404);
        expect(patchRes.status).toBe(404);
        expect(patchRes.body.error.code).toBe('NOT_FOUND');
        expect(after).toEqual(before);
        expect(editLogAfter).toBe(editLogBefore);
    });

    test('TC-10 [Bảo mật] QT-15, phân quyền: Tiếp nhận thấy số che, Quản lý thấy số đầy đủ; Quản lý lập phiếu → 403; không đăng nhập → 401', async () => {
        const app = createSystemApp(pool, at('2026-11-05T09:00:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');
        const hung = await loginAs(app, 'hung.q10');

        const lanList = await lan.get('/api/tickets?page=1&size=100');
        const hungList = await hung.get('/api/tickets?page=1&size=100');
        const before = await count(db, 'ticket');
        const forbidden = await hung.post('/api/tickets').set('Idempotency-Key', randomUUID()).send({
            customer_id: CUSTOMER_AN,
            device_id: DEVICE_AN_WARRANTY,
            issue_desc: 'Quản lý thử lập phiếu bảo hành',
            category_id: 1,
            priority: 'CAO',
        });
        const after = await count(db, 'ticket');
        const anonymous = await request(app).get('/api/tickets');

        const lanPhones = lanList.body.items.map((t) => t.phone);
        const hungPhones = hungList.body.items.map((t) => t.phone);
        report('TC-10', [
            `lan.q10 (Tiếp nhận)  GET /api/tickets → HTTP ${lanList.status} · ${lanPhones.length} phiếu · ví dụ phone=${lanPhones[0]} · tất cả dạng 3 số + **** + 3 số: ${lanPhones.every((p) => /^\d{3}\*{4}\d{3}$/.test(p))}`,
            `hung.q10 (Quản lý)   GET /api/tickets → HTTP ${hungList.status} · ${hungPhones.length} phiếu · ví dụ phone=${hungPhones[0]} · tất cả đủ 10 số: ${hungPhones.every((p) => /^0\d{9}$/.test(p))}`,
            `hung.q10 POST /api/tickets → HTTP ${forbidden.status} · error.code=${forbidden.body.error && forbidden.body.error.code} · bảng ticket: ${before} → ${after}`,
            `Không cookie GET /api/tickets → HTTP ${anonymous.status} · error.code=${anonymous.body.error && anonymous.body.error.code}`,
        ]);

        expect(lanList.status).toBe(200);
        expect(lanPhones.length).toBeGreaterThan(0);
        expect(lanPhones.every((p) => /^\d{3}\*{4}\d{3}$/.test(p))).toBe(true);
        expect(hungPhones.every((p) => /^0\d{9}$/.test(p))).toBe(true);
        expect(forbidden.status).toBe(403);
        expect(forbidden.body.error.code).toBe('FORBIDDEN');
        expect(after).toBe(before);
        expect(anonymous.status).toBe(401);
    });

    test('TC-11 [Chất lượng dữ liệu] NFR4: gửi lại cùng Idempotency-Key → 200 cùng phiếu, CSDL chỉ thêm 1 phiếu', async () => {
        const app = createSystemApp(pool, at('2026-11-05T14:30:00+07:00'));
        const lan = await loginAs(app, 'lan.q10');
        const key = randomUUID();
        const body = {
            customer_id: CUSTOMER_AN,
            device_id: DEVICE_AN_WARRANTY,
            issue_desc: 'Pin tụt nhanh, sạc đầy chỉ dùng được 2 giờ',
            category_id: 2,
            priority: 'TRUNG_BINH',
        };
        const before = await count(db, 'ticket');

        const first = await lan.post('/api/tickets').set('Idempotency-Key', key).send(body);
        const second = await lan.post('/api/tickets').set('Idempotency-Key', key).send(body);

        const after = await count(db, 'ticket');
        report('TC-11', [
            `Lần 1 → HTTP ${first.status} · ticket_id=${first.body.ticket_id} · ${first.body.ticket_code}`,
            `Lần 2 (cùng khóa) → HTTP ${second.status} · ticket_id=${second.body.ticket_id} · ${second.body.ticket_code}`,
            `Bảng ticket: ${before} → ${after}`,
        ]);

        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        expect(second.body.ticket_id).toBe(first.body.ticket_id);
        expect(after).toBe(before + 1);
    });

    test('TC-12 [Tái lập] Q6: chạy npm run setup (migrate + seed) hai lần trên CSDL trống → không lỗi, không nhân đôi dữ liệu', async () => {
        const reproDb = 'smart_crm_l2_systest_repro';
        await dropDatabase(reproDb);

        const run1 = runSetup(reproDb);
        const c1 = await connect(reproDb);
        const counts1 = await countAll(c1);
        await c1.end();

        const run2 = runSetup(reproDb);
        const c2 = await connect(reproDb);
        const counts2 = await countAll(c2);
        await c2.end();

        const insertedLines = (out) => out.split('\n').filter((l) => /thêm mới/.test(l)).map((l) => l.replace(/\.js: thêm mới /, ':+').replace(' dòng', '')).join(' ');
        report('TC-12', [
            `Lần 1: mã thoát ${run1.status} · ${insertedLines(run1.stdout)}`,
            `Lần 2: mã thoát ${run2.status} · ${insertedLines(run2.stdout)}`,
            `Số dòng sau lần 1: ${JSON.stringify(counts1)}`,
            `Số dòng sau lần 2: ${JSON.stringify(counts2)}`,
        ]);

        expect(run1.status).toBe(0);
        expect(run2.status).toBe(0);
        expect(counts1.ticket).toBeGreaterThan(0);
        expect(counts2).toEqual(counts1);

        await dropDatabase(reproDb);
    });
});
