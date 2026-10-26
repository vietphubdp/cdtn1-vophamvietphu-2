'use strict';

// 30 phiếu bảo hành lấy từ bộ mẫu Mekong Mobile + 30 dòng lịch sử đầu tiên (data/sample/tickets.csv – TĐ-14):
// 10 phiếu mỗi trung tâm 1–3, rút từ data/raw/tickets_history.csv bằng db/tools/sample-data.js; giữ khách,
// thiết bị (serial), trung tâm, mô tả lỗi, nhóm sự cố, mức ưu tiên của phiếu gốc.
// Không giữ trạng thái, thời điểm, hạn và mã phiếu gốc: hạn cam kết và tình trạng bảo hành tính lại bằng
// chính code nghiệp vụ (DueDateCalculator – QT-04, WarrantyService – QT-05), không viết tay; due_date
// của bộ mẫu chưa bỏ qua Chủ nhật (README bộ dữ liệu mục 5).
//
// Thời điểm tiếp nhận tính LÙI hours_ago giờ từ lúc chạy seed (làm tròn xuống giờ), không cố định theo lịch:
// nhờ vậy chạy seed ngày nào cũng có cả phiếu quá hạn lẫn phiếu chưa quá hạn để demo M3 (FR11).
//   - chưa quá hạn: tiếp nhận cách đây < N giờ (N = số giờ cam kết), vì hạn luôn ≥ tiếp nhận + N;
//   - quá hạn:      tiếp nhận cách đây ≥ N + 48 giờ, vì hạn luôn ≤ tiếp nhận + N + 24 (bỏ qua tối đa
//     một Chủ nhật, kể cả khi tiếp nhận vào Chủ nhật).
// Mọi phiếu đặt lại trạng thái MOI với đúng 1 dòng lịch sử MOI (QT-06): trong L2 phiếu chưa chuyển trạng
// thái nên không có phiếu HOAN_TAT, DA_DONG hay DA_HUY (Q9), dù phiếu gốc đã ở trạng thái khác.
// Chạy lại không nhân đôi: idempotency_key cố định, ON CONFLICT DO NOTHING; phiếu đã có thì bỏ qua
// cả dòng lịch sử. Sau khi chèn, đặt ticket_code_seq ≥ số lớn nhất đã dùng để phiếu mới không trùng mã.
// Khách của phiếu lấy theo chủ của thiết bị nên luôn đúng QT-03.

const { TicketStatus } = require('../../src/domain/constants');
const { calculateDueDate } = require('../../src/services/DueDateCalculator');
const { determineWarrantyStatus } = require('../../src/services/WarrantyService');
const { formatTicketCode, resolvePriority } = require('../../src/services/TicketService');
const { readSampleCsv } = require('../tools/csv');
const { DEVICES } = require('./006_device');
const { ISSUE_CATEGORIES } = require('./004_issue_category');
const { EMPLOYEES } = require('./002_employee');

const HOUR_MS = 60 * 60 * 1000;

// Nhân viên Tiếp nhận lập phiếu ở mỗi trung tâm (changed_by của dòng lịch sử đầu tiên).
const RECEPTIONIST_BY_CENTER = { 1: 'lan.q10', 2: 'mai.tb', 3: 'thu.td' };

// priority: mức của phiếu gốc (giữ nguyên, như nhân viên đã chọn – FR8); hours_ago do sample-data.js sinh:
// nửa số phiếu mỗi trung tâm chắc chắn quá hạn, nửa chắc chắn chưa quá hạn ở mọi giờ chạy seed.
const TICKETS = readSampleCsv('tickets.csv').map((t) => ({
    source_ticket_id: Number(t.source_ticket_id),
    center_id: Number(t.center_id),
    customer_id: Number(t.customer_id),
    serial_no: t.serial_no,
    category_id: t.category_id === '' ? null : Number(t.category_id),
    priority: t.priority || null,
    hours_ago: Number(t.hours_ago),
    issue_desc: t.issue_desc,
}));

/** Khóa chống trùng cố định của phiếu seed thứ `index` (0-based): 5eed0000-0000-4000-8000-0000000000NN. */
function seedIdempotencyKey(index) {
    return `5eed0000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

/** Bắt lỗi tham chiếu sai serial / nhóm / trung tâm trước khi chèn (INSERT … SELECT sẽ bỏ qua im lặng). */
function assertReferencesExist() {
    const ownerBySerial = new Map(DEVICES.map((d) => [d.serial_no, d.customer_id]));
    const categoryIds = new Set(ISSUE_CATEGORIES.map((c) => c.category_id));
    const usernames = new Set(EMPLOYEES.map((e) => e.username));
    for (const t of TICKETS) {
        if (!ownerBySerial.has(t.serial_no)) throw new Error(`Seed ticket: không có thiết bị ${t.serial_no}`);
        if (ownerBySerial.get(t.serial_no) !== t.customer_id) throw new Error(`Seed ticket: thiết bị ${t.serial_no} không thuộc khách ${t.customer_id} (QT-03)`);
        if (t.category_id !== null && !categoryIds.has(t.category_id)) throw new Error(`Seed ticket: không có nhóm ${t.category_id}`);
        if (!usernames.has(RECEPTIONIST_BY_CENTER[t.center_id])) throw new Error(`Seed ticket: trung tâm ${t.center_id} chưa có Tiếp nhận`);
    }
}

/**
 * Dựng các phiếu seed từ thời điểm neo `now` (hàm thuần, test được không cần CSDL).
 * Số thứ tự mã phiếu đánh theo thời điểm tiếp nhận tăng dần, như khi lập thật bằng sequence.
 *
 * @param {Date} now thời điểm chạy seed
 * @returns {object[]} các phiếu kèm ticket_code, priority, warranty_status, received_at, due_date
 */
function buildSeedTickets(now) {
    const anchor = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS; // giờ VN lệch giờ UTC đúng 7 giờ chẵn
    const devicesBySerial = new Map(DEVICES.map((d) => [d.serial_no, d]));
    const categoriesById = new Map(ISSUE_CATEGORIES.map((c) => [c.category_id, c]));

    return TICKETS.map((t, index) => ({ ...t, idempotency_key: seedIdempotencyKey(index) }))
        .sort((a, b) => b.hours_ago - a.hours_ago)
        .map((t, order) => {
            const receivedAt = new Date(anchor - t.hours_ago * HOUR_MS);
            const priority = resolvePriority(t.priority, categoriesById.get(t.category_id) || null);
            return {
                ticket_code: formatTicketCode(order + 1, receivedAt),
                center_id: t.center_id,
                serial_no: t.serial_no,
                category_id: t.category_id,
                issue_desc: t.issue_desc,
                priority,
                status: TicketStatus.MOI,
                warranty_status: determineWarrantyStatus(devicesBySerial.get(t.serial_no), receivedAt).warranty_status,
                received_at: receivedAt,
                due_date: calculateDueDate(receivedAt, priority),
                idempotency_key: t.idempotency_key,
                changed_by_username: RECEPTIONIST_BY_CENTER[t.center_id],
            };
        });
}

async function seed(client) {
    assertReferencesExist();
    let inserted = 0;
    for (const t of buildSeedTickets(new Date())) {
        const ticketResult = await client.query(
            `INSERT INTO ticket (ticket_code, customer_id, device_id, center_id, category_id, issue_desc,
                                 priority, status, warranty_status, received_at, due_date, idempotency_key)
             SELECT $1, d.customer_id, d.device_id, $3, $4, $5, $6, $7, $8, $9, $10, $11
               FROM device d
              WHERE d.serial_no = $2
             ON CONFLICT DO NOTHING
             RETURNING ticket_id`,
            [
                t.ticket_code, t.serial_no, t.center_id, t.category_id, t.issue_desc, t.priority,
                t.status, t.warranty_status, t.received_at, t.due_date, t.idempotency_key,
            ],
        );
        if (ticketResult.rowCount === 0) continue; // phiếu đã có từ lần seed trước

        // QT-06: dòng lịch sử đầu tiên, cùng giao dịch với phiếu (seed.js chạy mọi file trong một giao dịch).
        await client.query(
            `INSERT INTO ticket_status_log (ticket_id, from_status, to_status, changed_at, changed_by, note)
             SELECT $1, NULL, $2, $3, e.employee_id, NULL
               FROM employee e
              WHERE e.username = $4`,
            [ticketResult.rows[0].ticket_id, t.status, t.received_at, t.changed_by_username],
        );
        inserted += 1;
    }

    // Q11: phiếu lập mới lấy số tiếp theo, không trùng mã seed; không bao giờ kéo sequence lùi lại.
    await client.query(
        `SELECT setval('ticket_code_seq', GREATEST(
             (SELECT COALESCE(MAX(substring(ticket_code FROM 3 FOR 6)::int), 1) FROM ticket),
             (SELECT last_value FROM ticket_code_seq)))`,
    );
    return inserted;
}

module.exports = { seed, TICKETS, buildSeedTickets };
