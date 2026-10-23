'use strict';

const { validateTicketCreate } = require('../validators/ticketValidator');

/** API 7 (US5, US6): chỉ dịch HTTP ↔ TicketService. Lỗi chuyển cho ErrorMapper. */
function createTicketController({ ticketService, now }) {
    return {
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
