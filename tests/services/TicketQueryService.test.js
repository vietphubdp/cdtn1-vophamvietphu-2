'use strict';

const { createTicketQueryService, isOverdue } = require('../../src/services/TicketQueryService');
const { ErrorCode } = require('../../src/errors/AppError');
const { Role, TicketStatus } = require('../../src/domain/constants');
const { createFakeTicketRepository, createListTicket } = require('../helpers/fakeTicket');

// Unit test TicketQueryService (UC6: FR10, FR11, QT-14, QT-15, Q9) với repository giả, không cần CSDL.
// `now` truyền vào. Khẳng định mã nghiệp vụ, không khẳng định mã HTTP.

const RECEPTIONIST = { employee_id: 7, role: Role.TIEP_NHAN, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };
const MANAGER = { employee_id: 8, role: Role.QUAN_LY_TRUNG_TAM, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };

/** Thời điểm theo giờ Việt Nam, ví dụ vn('2026-10-10T08:10'). */
const vn = (local) => new Date(`${local}:00+07:00`);
const NOW = vn('2026-10-10T09:00'); // sau hạn của phiếu ví dụ api-contract 3.8 (08:10 ngày 10/10)
const PAGING = Object.freeze({ page: 1, size: 20 });

function createService(rows = [createListTicket()]) {
    const ticketRepository = createFakeTicketRepository(rows);
    return { service: createTicketQueryService({ ticketRepository }), ticketRepository };
}

/** n phiếu của trung tâm 2, hạn cách nhau một giờ, mã 1..n. */
function manyTickets(n) {
    return Array.from({ length: n }, (_, i) =>
        createListTicket({
            ticket_id: i + 1,
            ticket_code: `BH${String(i + 1).padStart(6, '0')}/2026`,
            due_date: new Date(vn('2026-10-12T08:00').getTime() + i * 3600 * 1000),
        }),
    );
}

describe('isOverdue – FR11', () => {
    const dueAt = vn('2026-10-10T08:10');

    test('FR11 luồng đúng: hạn đã qua, phiếu đang xử lý → quá hạn', () => {
        expect(isOverdue({ status: TicketStatus.DANG_XU_LY, due_date: dueAt }, NOW)).toBe(true);
    });

    test('FR11 giá trị biên: hạn đúng bằng thời điểm hiện tại → chưa quá hạn; trễ 1 ms → quá hạn', () => {
        const ticket = { status: TicketStatus.MOI, due_date: dueAt };

        expect(isOverdue(ticket, dueAt)).toBe(false);
        expect(isOverdue(ticket, new Date(dueAt.getTime() + 1))).toBe(true);
        expect(isOverdue(ticket, new Date(dueAt.getTime() - 1))).toBe(false);
    });

    test('FR11 luồng đúng: Hoàn tất, Đã đóng không bị đánh dấu dù đã qua hạn', () => {
        for (const status of [TicketStatus.HOAN_TAT, TicketStatus.DA_DONG]) {
            expect(isOverdue({ status, due_date: dueAt }, NOW)).toBe(false);
        }
    });

    test('Q9 luồng đúng: mọi trạng thái còn lại (kể cả DA_HUY) qua hạn đều bị đánh dấu, đúng câu chữ FR11', () => {
        const open = [
            TicketStatus.MOI,
            TicketStatus.DA_PHAN_CONG,
            TicketStatus.DANG_XU_LY,
            TicketStatus.CHO_LINH_KIEN,
            TicketStatus.DA_HUY,
        ];
        for (const status of open) {
            expect(isOverdue({ status, due_date: dueAt }, NOW)).toBe(true);
        }
    });
});

describe('TicketQueryService.listTickets – API 8', () => {
    test('US7 luồng đúng: Tiếp nhận nhận đúng ví dụ api-contract 3.8 (số bị che, quá hạn)', async () => {
        const { service } = createService();

        const result = await service.listTickets(RECEPTIONIST, PAGING, NOW);

        expect(result).toEqual({
            items: [
                {
                    ticket_id: 88198,
                    ticket_code: 'BH000198/2026',
                    customer_name: 'Trần Thị Bình',
                    phone: '091****321',
                    product_name: 'iPhone 13',
                    serial_no: '358240051111110',
                    category_name: 'Pin',
                    priority: 'CAO',
                    warranty_status: 'CON_BAO_HANH',
                    status: 'DANG_XU_LY',
                    received_at: '2026-10-09T08:10:00+07:00',
                    due_date: '2026-10-10T08:10:00+07:00',
                    is_overdue: true,
                },
            ],
            page: 1,
            size: 20,
            total: 1,
        });
    });

    test('QT-15 luồng đúng: Quản lý trung tâm thấy số điện thoại đầy đủ', async () => {
        const { service } = createService();

        const result = await service.listTickets(MANAGER, PAGING, NOW);

        expect(result.items[0].phone).toBe('0912345321');
    });

    test('QT-14 luồng đúng: chỉ trả phiếu của trung tâm trong JWT, total chỉ đếm trung tâm đó', async () => {
        const { service, ticketRepository } = createService([
            createListTicket({ ticket_id: 1, center_id: 2 }),
            createListTicket({ ticket_id: 2, center_id: 1 }),
            createListTicket({ ticket_id: 3, center_id: 3 }),
            createListTicket({ ticket_id: 4, center_id: 2 }),
        ]);

        const result = await service.listTickets(RECEPTIONIST, PAGING, NOW);

        expect(result.items.map((t) => t.ticket_id)).toEqual([1, 4]);
        expect(result.total).toBe(2);
        expect(ticketRepository.listByCenter).toHaveBeenCalledWith(2, { limit: 20, offset: 0 });
        expect(ticketRepository.countByCenter).toHaveBeenCalledWith(2);
    });

    test('QT-14 luồng đúng: người gọi ở trung tâm khác không thấy phiếu của trung tâm 2', async () => {
        const { service } = createService();
        const otherCenter = { ...MANAGER, center_id: 1 };

        const result = await service.listTickets(otherCenter, PAGING, NOW);

        expect(result).toEqual({ items: [], page: 1, size: 20, total: 0 });
    });

    test('FR11 luồng đúng: cờ quá hạn tính theo `now` truyền vào, không theo giờ máy', async () => {
        const { service } = createService();

        const before = await service.listTickets(RECEPTIONIST, PAGING, vn('2026-10-10T08:00'));
        const after = await service.listTickets(RECEPTIONIST, PAGING, vn('2026-10-10T08:20'));

        expect(before.items[0].is_overdue).toBe(false);
        expect(after.items[0].is_overdue).toBe(true);
    });

    test('FR11 luồng đúng: trong cùng trang, phiếu Hoàn tất qua hạn không đỏ, phiếu Mới qua hạn đỏ', async () => {
        const { service } = createService([
            createListTicket({ ticket_id: 1, status: TicketStatus.HOAN_TAT }),
            createListTicket({ ticket_id: 2, status: TicketStatus.MOI }),
            createListTicket({ ticket_id: 3, status: TicketStatus.MOI, due_date: vn('2026-10-12T08:10') }),
        ]);

        const result = await service.listTickets(RECEPTIONIST, PAGING, NOW);

        expect(result.items.map((t) => [t.ticket_id, t.is_overdue])).toEqual([
            [1, false],
            [2, true],
            [3, false],
        ]);
    });

    test('FR10 luồng đúng: sắp theo hạn cam kết tăng dần, cùng hạn thì theo ticket_id', async () => {
        const { service } = createService([
            createListTicket({ ticket_id: 30, due_date: vn('2026-10-12T08:00') }),
            createListTicket({ ticket_id: 20, due_date: vn('2026-10-11T08:00') }),
            createListTicket({ ticket_id: 12, due_date: vn('2026-10-12T08:00') }),
        ]);

        const result = await service.listTickets(RECEPTIONIST, PAGING, NOW);

        expect(result.items.map((t) => t.ticket_id)).toEqual([20, 12, 30]);
    });

    test('FR10 luồng đúng: trang 2 cỡ 20 lấy offset 20, total là tổng mọi trang', async () => {
        const { service, ticketRepository } = createService(manyTickets(45));

        const result = await service.listTickets(RECEPTIONIST, { page: 2, size: 20 }, NOW);

        expect(ticketRepository.listByCenter).toHaveBeenCalledWith(2, { limit: 20, offset: 20 });
        expect(result.items.map((t) => t.ticket_id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 21));
        expect(result).toMatchObject({ page: 2, size: 20, total: 45 });
    });

    test('FR10 giá trị biên: trang cuối thiếu dòng trả phần còn lại; trang vượt quá trả items rỗng', async () => {
        const { service } = createService(manyTickets(45));

        const last = await service.listTickets(RECEPTIONIST, { page: 3, size: 20 }, NOW);
        const beyond = await service.listTickets(RECEPTIONIST, { page: 4, size: 20 }, NOW);

        expect(last.items.map((t) => t.ticket_id)).toEqual([41, 42, 43, 44, 45]);
        expect(beyond).toEqual({ items: [], page: 4, size: 20, total: 45 });
    });

    test('FR10 giá trị biên: size 100 trả tối đa 100 dòng một trang', async () => {
        const { service } = createService(manyTickets(120));

        const result = await service.listTickets(RECEPTIONIST, { page: 1, size: 100 }, NOW);

        expect(result.items).toHaveLength(100);
        expect(result.total).toBe(120);
    });

    test('FR10 luồng đúng: trung tâm chưa có phiếu → items rỗng, total 0', async () => {
        const { service } = createService([]);

        expect(await service.listTickets(RECEPTIONIST, PAGING, NOW)).toEqual({ items: [], page: 1, size: 20, total: 0 });
    });

    test('FR10 luồng đúng: phiếu chưa phân loại có category_name = null', async () => {
        const { service } = createService([createListTicket({ category_name: null })]);

        const result = await service.listTickets(RECEPTIONIST, PAGING, NOW);

        expect(result.items[0].category_name).toBeNull();
    });

    test('NFR2 luồng đúng: thời gian trả dạng giờ Việt Nam …+07:00 dù lưu theo UTC', async () => {
        const { service } = createService([
            createListTicket({
                received_at: new Date('2026-10-08T17:30:00Z'), // 00:30 ngày 09/10 giờ VN
                due_date: new Date('2026-10-09T17:30:00Z'),
            }),
        ]);

        const result = await service.listTickets(RECEPTIONIST, PAGING, NOW);

        expect(result.items[0].received_at).toBe('2026-10-09T00:30:00+07:00');
        expect(result.items[0].due_date).toBe('2026-10-10T00:30:00+07:00');
    });

    test('D3 dữ liệu sai: không có caller hoặc vai trò lạ → FORBIDDEN, không đọc CSDL', async () => {
        const { service, ticketRepository } = createService();

        for (const caller of [undefined, { ...RECEPTIONIST, role: 'KHACH' }]) {
            await expect(service.listTickets(caller, PAGING, NOW)).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
        }
        expect(ticketRepository.listByCenter).not.toHaveBeenCalled();
    });
});
