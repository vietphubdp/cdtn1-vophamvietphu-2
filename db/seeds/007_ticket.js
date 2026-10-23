'use strict';

// 25 phiếu bảo hành giả lập + 25 dòng lịch sử đầu tiên (D6). Hạn cam kết và tình trạng bảo hành
// tính bằng chính code nghiệp vụ (DueDateCalculator – QT-04, WarrantyService – QT-05), không viết tay.
//
// Thời điểm tiếp nhận tính LÙI từ lúc chạy seed (làm tròn xuống giờ), không cố định theo lịch:
// nhờ vậy chạy seed ngày nào cũng có cả phiếu quá hạn lẫn phiếu chưa quá hạn để demo M3 (FR11).
//   - chưa quá hạn: tiếp nhận cách đây < N giờ (N = số giờ cam kết), vì hạn luôn ≥ tiếp nhận + N;
//   - quá hạn:      tiếp nhận cách đây ≥ N + 48 giờ, vì hạn luôn ≤ tiếp nhận + N + 24 (bỏ qua tối đa
//     một Chủ nhật, kể cả khi tiếp nhận vào Chủ nhật).
// Mọi phiếu ở trạng thái MOI với đúng 1 dòng lịch sử MOI (QT-06): trong L2 phiếu chưa chuyển trạng thái
// nên không có phiếu HOAN_TAT, DA_DONG hay DA_HUY (Q9).
// Chạy lại không nhân đôi: idempotency_key cố định, ON CONFLICT DO NOTHING; phiếu đã có thì bỏ qua
// cả dòng lịch sử. Sau khi chèn, đặt ticket_code_seq ≥ số lớn nhất đã dùng để phiếu mới không trùng mã.
// Khách của phiếu lấy theo chủ của thiết bị nên luôn đúng QT-03.

const { Priority, TicketStatus } = require('../../src/domain/constants');
const { calculateDueDate } = require('../../src/services/DueDateCalculator');
const { determineWarrantyStatus } = require('../../src/services/WarrantyService');
const { formatTicketCode, resolvePriority } = require('../../src/services/TicketService');
const { DEVICES } = require('./006_device');
const { ISSUE_CATEGORIES } = require('./004_issue_category');
const { EMPLOYEES } = require('./002_employee');

const HOUR_MS = 60 * 60 * 1000;

// Nhân viên Tiếp nhận lập phiếu ở mỗi trung tâm (changed_by của dòng lịch sử đầu tiên).
const RECEPTIONIST_BY_CENTER = { 1: 'mai.nk', 2: 'lan.q10', 3: 'thu.vl' };

// warranty (nhãn để người đọc đối chiếu, tính thật bằng WarrantyService): CON / HET / NULL theo 006_device.
// priority: null = lấy mặc định theo nhóm (FR8); có giá trị = nhân viên đã đổi mức.
const TICKETS = [
    // Trung tâm 2 · Quận 10
    { center_id: 2, serial_no: 'SN-A52-778901', category: 'Sạc', priority: null, hours_ago: 150, issue_desc: 'Máy không nhận sạc, cắm sạc báo lỗi phụ kiện' },
    { center_id: 2, serial_no: '358240051111110', category: 'Màn hình', priority: null, hours_ago: 100, issue_desc: 'Màn hình bị sọc xanh sau khi rơi nhẹ' },
    { center_id: 2, serial_no: '356789104422331', category: 'Pin', priority: null, hours_ago: 60, issue_desc: 'Pin tụt nhanh, sạc đầy chỉ dùng được khoảng 3 giờ' },
    { center_id: 2, serial_no: 'OPA18-20931', category: 'Phần mềm', priority: null, hours_ago: 230, issue_desc: 'Máy tự khởi động lại nhiều lần trong ngày' },
    { center_id: 2, serial_no: 'R5CX30AB12K', category: 'Nước vào', priority: null, hours_ago: 2, issue_desc: 'Máy bị rơi xuống nước, không lên nguồn' },
    { center_id: 2, serial_no: 'XMRN13-660172', category: null, priority: null, hours_ago: 26, issue_desc: 'Loa ngoài rè khi mở âm lượng lớn' },
    { center_id: 2, serial_no: 'VVY17S-118340', category: 'Khác', priority: null, hours_ago: 130, issue_desc: 'Nút nguồn bị kẹt, bấm không ăn' },
    { center_id: 2, serial_no: 'R9TA06-554120', category: 'Màn hình', priority: Priority.TRUNG_BINH, hours_ago: 3, issue_desc: 'Cảm ứng bị loạn ở góc trên màn hình' },
    { center_id: 2, serial_no: 'OPA78-40017', category: 'Pin', priority: Priority.CAO, hours_ago: 80, issue_desc: 'Pin phồng làm hở nắp lưng' },
    { center_id: 2, serial_no: '359112260078415', category: 'Phần mềm', priority: null, hours_ago: 48, issue_desc: 'Không cập nhật được phần mềm, báo lỗi tải về' },
    // Trung tâm 1 · Ninh Kiều
    { center_id: 1, serial_no: 'R5CXA35-90021', category: 'Màn hình', priority: null, hours_ago: 20, issue_desc: 'Màn hình tối đen nhưng máy vẫn có tiếng chuông' },
    { center_id: 1, serial_no: 'RMC67-773190', category: 'Sạc', priority: null, hours_ago: 200, issue_desc: 'Cổng sạc lỏng, phải giữ dây mới sạc được' },
    { center_id: 1, serial_no: '353918113366720', category: 'Pin', priority: null, hours_ago: 50, issue_desc: 'Máy nóng nhiều khi sạc, pin sụt nhanh' },
    { center_id: 1, serial_no: 'XM14T-208455', category: null, priority: null, hours_ago: 140, issue_desc: 'Camera sau bị mờ, không lấy nét được' },
    { center_id: 1, serial_no: 'R9TA16-310877', category: 'Phần mềm', priority: null, hours_ago: 180, issue_desc: 'Ứng dụng tự thoát, máy chạy chậm bất thường' },
    { center_id: 1, serial_no: 'OPRN11-56702', category: 'Nước vào', priority: null, hours_ago: 6, issue_desc: 'Máy dính nước mưa, màn hình chập chờn' },
    { center_id: 1, serial_no: '357260147788019', category: 'Khác', priority: null, hours_ago: 10, issue_desc: 'Rung không hoạt động khi có cuộc gọi đến' },
    { center_id: 1, serial_no: 'XMR13C-994410', category: 'Màn hình', priority: null, hours_ago: 90, issue_desc: 'Kính màn hình nứt góc, cảm ứng còn dùng được' },
    // Trung tâm 3 · Vĩnh Long
    { center_id: 3, serial_no: 'R3CZF6-120588', category: 'Màn hình', priority: null, hours_ago: 75, issue_desc: 'Màn hình gập có vệt sáng ở nếp gấp' },
    { center_id: 3, serial_no: 'VVV30-447163', category: 'Sạc', priority: null, hours_ago: 30, issue_desc: 'Sạc nhanh không hoạt động, chỉ sạc thường' },
    { center_id: 3, serial_no: 'R5CXA55-62290', category: 'Pin', priority: Priority.THAP, hours_ago: 98, issue_desc: 'Pin báo sai phần trăm, đang 30% thì tắt nguồn' },
    { center_id: 3, serial_no: 'OPN3F-00381', category: 'Phần mềm', priority: null, hours_ago: 170, issue_desc: 'Máy treo ở logo khi khởi động' },
    { center_id: 3, serial_no: 'R5CS23F-71504', category: null, priority: null, hours_ago: 160, issue_desc: 'Micro không thu tiếng khi gọi điện' },
    { center_id: 3, serial_no: '358240053344121', category: 'Khác', priority: null, hours_ago: 15, issue_desc: 'Khay sim bị kẹt, không lấy ra được' },
    { center_id: 3, serial_no: 'R5CXS24U-8812', category: 'Nước vào', priority: null, hours_ago: 120, issue_desc: 'Máy rơi vào bồn nước, loa và micro không hoạt động' },
];

/** Khóa chống trùng cố định của phiếu seed thứ `index` (0-based): 5eed0000-0000-4000-8000-0000000000NN. */
function seedIdempotencyKey(index) {
    return `5eed0000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

/** Bắt lỗi gõ nhầm serial / tên nhóm / trung tâm trước khi chèn (INSERT … SELECT sẽ bỏ qua im lặng). */
function assertReferencesExist() {
    const serials = new Set(DEVICES.map((d) => d.serial_no));
    const categoryNames = new Set(ISSUE_CATEGORIES.map((c) => c.category_name));
    const usernames = new Set(EMPLOYEES.map((e) => e.username));
    for (const t of TICKETS) {
        if (!serials.has(t.serial_no)) throw new Error(`Seed ticket: không có thiết bị ${t.serial_no}`);
        if (t.category !== null && !categoryNames.has(t.category)) throw new Error(`Seed ticket: không có nhóm ${t.category}`);
        if (!usernames.has(RECEPTIONIST_BY_CENTER[t.center_id])) throw new Error(`Seed ticket: trung tâm ${t.center_id} chưa có Tiếp nhận`);
    }
}

/**
 * Dựng 25 phiếu từ thời điểm neo `now` (hàm thuần, test được không cần CSDL).
 * Số thứ tự mã phiếu đánh theo thời điểm tiếp nhận tăng dần, như khi lập thật bằng sequence.
 *
 * @param {Date} now thời điểm chạy seed
 * @returns {object[]} các phiếu kèm ticket_code, priority, warranty_status, received_at, due_date
 */
function buildSeedTickets(now) {
    const anchor = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS; // giờ VN lệch giờ UTC đúng 7 giờ chẵn
    const devicesBySerial = new Map(DEVICES.map((d) => [d.serial_no, d]));
    const categoriesByName = new Map(ISSUE_CATEGORIES.map((c) => [c.category_name, c]));

    return TICKETS.map((t, index) => ({ ...t, idempotency_key: seedIdempotencyKey(index) }))
        .sort((a, b) => b.hours_ago - a.hours_ago)
        .map((t, order) => {
            const receivedAt = new Date(anchor - t.hours_ago * HOUR_MS);
            const priority = resolvePriority(t.priority, categoriesByName.get(t.category) || null);
            return {
                ticket_code: formatTicketCode(order + 1, receivedAt),
                center_id: t.center_id,
                serial_no: t.serial_no,
                category: t.category,
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
             SELECT $1, d.customer_id, d.device_id, $3,
                    (SELECT category_id FROM issue_category WHERE category_name = $4),
                    $5, $6, $7, $8, $9, $10, $11
               FROM device d
              WHERE d.serial_no = $2
             ON CONFLICT DO NOTHING
             RETURNING ticket_id`,
            [
                t.ticket_code, t.serial_no, t.center_id, t.category, t.issue_desc, t.priority,
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
