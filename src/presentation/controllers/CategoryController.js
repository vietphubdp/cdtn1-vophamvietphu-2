'use strict';

const {
    validateIssueCategoryCreate,
    validateIssueCategoryUpdate,
    parseIssueCategoryId,
    parseIncludeInactive,
} = require('../validators/catalogValidator');

/** API 6, 15–17 (US6, HT2, NFR5): chỉ dịch HTTP ↔ CatalogService. Lỗi chuyển cho ErrorMapper. */
function createCategoryController({ catalogService }) {
    return {
        /** GET /api/issue-categories[?include_inactive=true] → 200 { items, total } (api-contract 3.6). */
        async list(req, res) {
            const includeInactive = parseIncludeInactive(req.query);
            res.status(200).json(await catalogService.listIssueCategories(req.caller, { includeInactive }));
        },

        /** POST /api/issue-categories → 201, bản ghi vừa tạo. */
        async create(req, res) {
            const input = validateIssueCategoryCreate(req.body);
            res.status(201).json(await catalogService.createIssueCategory(req.caller, input));
        },

        /** PUT /api/issue-categories/{id} → 200, bản ghi sau khi sửa. */
        async update(req, res) {
            const id = parseIssueCategoryId(req.params.id);
            const input = validateIssueCategoryUpdate(req.body);
            res.status(200).json(await catalogService.updateIssueCategory(req.caller, id, input));
        },

        /** DELETE /api/issue-categories/{id} → 200, bản ghi với is_active = false (QT-13). */
        async deactivate(req, res) {
            const id = parseIssueCategoryId(req.params.id);
            res.status(200).json(await catalogService.deactivateIssueCategory(req.caller, id));
        },
    };
}

module.exports = { createCategoryController };
