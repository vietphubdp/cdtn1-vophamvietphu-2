'use strict';

const { validateCustomerLookup, validateCustomerCreate } = require('../validators/customerValidator');

/** API 1, 3 (US1, US2): chỉ dịch HTTP ↔ CustomerService. Lỗi chuyển cho ErrorMapper. */
function createCustomerController({ customerService }) {
    return {
        /** GET /api/customers?phone= → 200 hồ sơ khách (api-contract 3.1). */
        async findByPhone(req, res) {
            const { phone } = validateCustomerLookup(req.query);
            res.status(200).json(await customerService.findByPhone(req.caller, phone));
        },

        /** POST /api/customers → 201 hồ sơ vừa tạo (api-contract 3.3). */
        async create(req, res) {
            const input = validateCustomerCreate(req.body);
            res.status(201).json(await customerService.createCustomer(req.caller, input));
        },
    };
}

module.exports = { createCustomerController };
