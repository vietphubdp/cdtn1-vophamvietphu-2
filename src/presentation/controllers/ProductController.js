'use strict';

const {
    validateProductCreate,
    validateProductUpdate,
    parseProductId,
    parseIncludeInactive,
} = require('../validators/catalogValidator');

/** API 11–14 (HT2): chỉ dịch HTTP ↔ CatalogService. Lỗi chuyển cho ErrorMapper. */
function createProductController({ catalogService }) {
    return {
        /** GET /api/products[?include_inactive=true] → 200 { items, total } (api-contract 3.11). */
        async list(req, res) {
            const includeInactive = parseIncludeInactive(req.query);
            res.status(200).json(await catalogService.listProducts(req.caller, { includeInactive }));
        },

        /** POST /api/products → 201, bản ghi vừa tạo. */
        async create(req, res) {
            const input = validateProductCreate(req.body);
            res.status(201).json(await catalogService.createProduct(req.caller, input));
        },

        /** PUT /api/products/{id} → 200, bản ghi sau khi sửa. */
        async update(req, res) {
            const id = parseProductId(req.params.id);
            const input = validateProductUpdate(req.body);
            res.status(200).json(await catalogService.updateProduct(req.caller, id, input));
        },

        /** DELETE /api/products/{id} → 200, bản ghi với is_active = false (QT-13). */
        async deactivate(req, res) {
            const id = parseProductId(req.params.id);
            res.status(200).json(await catalogService.deactivateProduct(req.caller, id));
        },
    };
}

module.exports = { createProductController };
