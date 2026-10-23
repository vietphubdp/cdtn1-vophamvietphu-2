'use strict';

const { validateTicketCreate, validateTicketList } = require('../validators/ticketValidator');

/**
 * API 7 (US5, US6), API 8 (US7): chỉ dịch HTTP ↔ TicketService, TicketQueryService.
 * Lỗi chuyển cho ErrorMapper.
 */
function createTicketController({ ticketService, ticketQueryService, now }) {
    return {
        /** GET /api/tickets?page=&size= → 200 { items, page, size, total } (api-contract 3.8). */
        async list(req, res) {
            const paging = validateTicketList(req.query);
            res.status(200).json(await ticketQueryService.listTickets(req.caller, paging, now()));
        },

        /**
         * POST /api/tickets → 201 phiếu vừa lập; gửi lại cùng Idempotency-Key → 200 phiếu đã lập
         * (api-contract 3.7, Q12).
         */
        async create(req, res) {
            const { input, idempotencyKey } = validateTicketCreate(req.body, req.get('Idempotency-Key'));
            const { ticket, created } = await ticketService.createTicket(req.caller, input, idempotencyKey, now());
            res.status(created ? 201 : 200).json(ticket);
        },
    };
}

module.exports = { createTicketController };
