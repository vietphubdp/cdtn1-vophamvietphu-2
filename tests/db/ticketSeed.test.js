'use strict';

const { buildSeedTickets, TICKETS } = require('../../db/seeds/007_ticket');
const { DEVICES } = require('../../db/seeds/006_device');
const { calculateDueDate } = require('../../src/services/DueDateCalculator');
const { determineWarrantyStatus } = require('../../src/services/WarrantyService');
const { toVietnamDateString } = require('../../src/services/vietnamTime');
const { TicketStatus, WarrantyStatus } = require('../../src/domain/constants');
const { readSampleCsv } = require('../../db/tools/csv');

// Kiểm dữ liệu seed phiếu (GĐ 5, đổi sang bộ mẫu ở TĐ-14) mà không cần CSDL: buildSeedTickets là hàm thuần nhận thời điểm neo.
// Hạn cam kết, tình trạng bảo hành phải khớp code nghiệp vụ; đủ trường hợp để demo QT-14, FR11.

const HOUR_MS = 60 * 60 * 1000;
const ANCHOR = new Date('2026-10-26T10:20:00+07:00'); // thứ Hai, ngày neo của db/tools/sample-data.js
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** FR11: phiếu chưa HOAN_TAT / DA_DONG và đã qua hạn cam kết. */
const isOverdue = (ticket, now) =>
    ![TicketStatus.HOAN_TAT, TicketStatus.DA_DONG].includes(ticket.status) && ticket.due_date < now;

describe('Seed phiếu – db/seeds/007_ticket.js', () => {
    const tickets = buildSeedTickets(ANCHOR);

    test('TĐ-14 luồng đúng: 30 phiếu từ bộ mẫu, mã và khóa chống trùng không trùng nhau, đúng định dạng', () => {
        expect(tickets).toHaveLength(30);
        expect(new Set(tickets.map((t) => t.ticket_code)).size).toBe(30);
        expect(new Set(tickets.map((t) => t.idempotency_key)).size).toBe(30);
        for (const t of tickets) {
            expect(t.ticket_code).toMatch(/^BH[0-9]{6}\/[0-9]{4}$/);
            expect(t.idempotency_key).toMatch(UUID_PATTERN);
            expect(t.issue_desc.trim().length).toBeGreaterThanOrEqual(10);
        }
    });

    test('Q11 luồng đúng: số thứ tự mã 1–30 tăng theo thời điểm tiếp nhận', () => {
        const numbers = tickets.map((t) => Number(t.ticket_code.slice(2, 8)));
        expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
        for (let i = 1; i < tickets.length; i += 1) {
            expect(tickets[i].received_at.getTime()).toBeGreaterThan(tickets[i - 1].received_at.getTime());
        }
    });

    test('QT-06 luồng đúng: mọi phiếu đặt lại trạng thái MOI dù phiếu gốc đã ở trạng thái khác, không có DA_HUY (Q9)', () => {
        expect(new Set(tickets.map((t) => t.status))).toEqual(new Set([TicketStatus.MOI]));
    });

    test('QT-04, QT-05 luồng đúng: hạn cam kết và tình trạng bảo hành tính bằng code nghiệp vụ tại received_at', () => {
        const devicesBySerial = new Map(DEVICES.map((d) => [d.serial_no, d]));
        for (const t of tickets) {
            expect(t.due_date).toEqual(calculateDueDate(t.received_at, t.priority));
            expect(t.warranty_status).toBe(determineWarrantyStatus(devicesBySerial.get(t.serial_no), t.received_at).warranty_status);
        }
    });

    test('QT-05 luồng đúng: tình trạng bảo hành khớp is_warranty của phiếu gốc, mỗi trung tâm có cả còn và hết bảo hành', () => {
        const expected = { true: WarrantyStatus.CON_BAO_HANH, false: WarrantyStatus.HET_BAO_HANH };
        const sourceBySerial = new Map(readSampleCsv('tickets.csv').map((t) => [t.serial_no, t.is_warranty]));
        for (const t of tickets) {
            expect([t.serial_no, t.warranty_status]).toEqual([t.serial_no, expected[sourceBySerial.get(t.serial_no)]]);
        }
        for (const centerId of [1, 2, 3]) {
            const statuses = new Set(tickets.filter((t) => t.center_id === centerId).map((t) => t.warranty_status));
            expect(statuses).toEqual(new Set([WarrantyStatus.CON_BAO_HANH, WarrantyStatus.HET_BAO_HANH]));
        }
    });

    test('QT-14 luồng đúng: phiếu thuộc 3 trung tâm có tài khoản mẫu', () => {
        const counts = {};
        for (const t of tickets) counts[t.center_id] = (counts[t.center_id] || 0) + 1;
        expect(counts).toEqual({ 1: 10, 2: 10, 3: 10 });
    });

    test('FR11 giá trị biên: chạy seed vào bất kỳ giờ nào trong tuần cũng có 15 phiếu quá hạn và 15 phiếu chưa quá hạn', () => {
        const weekStart = new Date('2026-10-19T00:00:00+07:00').getTime(); // thứ Hai
        for (let hour = 0; hour < 7 * 24; hour += 1) {
            const now = new Date(weekStart + hour * HOUR_MS + 25 * 60 * 1000); // lệch 25 phút khỏi giờ chẵn
            const overdue = buildSeedTickets(now).filter((t) => isOverdue(t, now));
            expect(overdue).toHaveLength(15);
        }
    });

    test('QT-05 giá trị biên: không phiếu nào tiếp nhận trước ngày mua của thiết bị', () => {
        const devicesBySerial = new Map(DEVICES.map((d) => [d.serial_no, d]));
        for (const t of tickets) {
            const purchaseDate = devicesBySerial.get(t.serial_no).purchase_date;
            if (purchaseDate) expect(toVietnamDateString(t.received_at) >= purchaseDate).toBe(true);
        }
    });

    test('QT-03 dữ liệu sai: thiết bị của mọi phiếu seed có thật và thuộc đúng khách của phiếu', () => {
        const ownerBySerial = new Map(DEVICES.map((d) => [d.serial_no, d.customer_id]));
        expect(TICKETS.filter((t) => ownerBySerial.get(t.serial_no) !== t.customer_id)).toEqual([]);
    });
});
