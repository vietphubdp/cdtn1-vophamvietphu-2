'use strict';

const {
    validateTicketCreate,
    validateTicketList,
    validateTicketUpdate,
    validateTicketCancel,
    validateWarrantyDecision,
    parseTicketId,
} = require('../validators/ticketValidator');

/**
 * API 7 (US5, US6), API 8 (US7), API 18–21 (TĐ-02, TĐ-03): chỉ dịch HTTP ↔ TicketService,
 * TicketQueryService, TicketUpdateService. Lỗi chuyển cho ErrorMapper.
 */
function createTicketController({ ticketService, ticketQueryService, ticketUpdateService, now }) {
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

        /** GET /api/tickets/{id} → 200 chi tiết phiếu kèm lịch sử (api-contract 3.12). */
        async detail(req, res) {
            const ticketId = parseTicketId(req.params.id);
            res.status(200).json(await ticketQueryService.getTicketDetail(req.caller, ticketId, now()));
        },

        /** PATCH /api/tickets/{id} → 200 phiếu sau khi sửa (api-contract 3.13, QT-16). */
        async update(req, res) {
            const ticketId = parseTicketId(req.params.id);
            const input = validateTicketUpdate(req.body);
            res.status(200).json(await ticketUpdateService.updateTicket(req.caller, ticketId, input, now()));
        },

        /** POST /api/tickets/{id}/cancel → 200 phiếu ở trạng thái DA_HUY (api-contract 3.14, QT-06). */
        async cancel(req, res) {
            const ticketId = parseTicketId(req.params.id);
            const input = validateTicketCancel(req.body);
            res.status(200).json(await ticketUpdateService.cancelTicket(req.caller, ticketId, input, now()));
        },

        /** POST /api/tickets/{id}/warranty-decision → 200 phiếu với tình trạng bảo hành mới (api-contract 3.15, QT-17). */
        async decideWarranty(req, res) {
            const ticketId = parseTicketId(req.params.id);
            const input = validateWarrantyDecision(req.body);
            res.status(200).json(await ticketUpdateService.decideWarranty(req.caller, ticketId, input, now()));
        },
    };
}

module.exports = { createTicketController };
