'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');
const { DuplicateKeyError } = require('../errors/DuplicateKeyError');
const { Role, DEFAULT_WARRANTY_MONTHS } = require('../domain/constants');
const { assertRole } = require('./assertRole');

const ALL_ROLES = [Role.TIEP_NHAN, Role.QUAN_LY_TRUNG_TAM];
const CATALOG_WRITERS = [Role.QUAN_LY_TRUNG_TAM];
const CATALOG_WRITE_FORBIDDEN_MESSAGE =
    'Chỉ Quản lý trung tâm được thêm, sửa hoặc ngừng dùng danh mục sản phẩm và nhóm sự cố.';
const CATALOG_READ_FORBIDDEN_MESSAGE = 'Vai trò của bạn không được xem danh mục.';

function isManager(caller) {
    return Boolean(caller) && caller.role === Role.QUAN_LY_TRUNG_TAM;
}

/**
 * Bốn thao tác đọc · thêm · sửa · ngừng dùng dùng chung cho hai danh mục (HT2).
 * Hai danh mục cùng một khuôn (api-contract 3.11), chỉ khác repository và câu chữ.
 *
 * @param {object} config
 * @param {object} config.repository  có list, create, update, deactivate
 * @param {string} config.nameField   trường tên duy nhất: 'product_name' | 'category_name'
 * @param {string} config.label       tên danh mục trong thông báo: 'sản phẩm' | 'nhóm sự cố'
 */
function createCatalogOperations({ repository, nameField, label }) {
    function notFound(id) {
        return new AppError(ErrorCode.NOT_FOUND, `Không tìm thấy ${label} có mã ${id}. Tải lại danh mục rồi chọn lại.`);
    }

    /** Repository báo trùng UNIQUE → CONFLICT (409): tên đã tồn tại (api-contract 3.11). */
    async function failOnDuplicateName(work, name) {
        try {
            return await work();
        } catch (err) {
            if (err instanceof DuplicateKeyError) {
                throw new AppError(
                    ErrorCode.CONFLICT,
                    `Tên ${label} "${name}" đã tồn tại. Đặt tên khác, hoặc sửa ${label} có sẵn nếu muốn dùng lại.`,
                );
            }
            throw err;
        }
    }

    return {
        /**
         * Đọc danh mục: mặc định chỉ mục đang dùng (QT-13). Chỉ Quản lý được xem cả mục đã ngừng;
         * vai trò khác gửi includeInactive thì bỏ qua, không báo 403 (plan: mặc định đã dùng).
         * @returns {{ items: object[], total: number }}
         */
        async list(caller, { includeInactive = false } = {}) {
            assertRole(caller, ALL_ROLES, CATALOG_READ_FORBIDDEN_MESSAGE);
            const items = await repository.list({ includeInactive: includeInactive === true && isManager(caller) });
            return { items, total: items.length };
        },

        /** Thêm mục mới (đang dùng). Chỉ Quản lý (D3). Tên trùng → CONFLICT. */
        async create(caller, input) {
            assertRole(caller, CATALOG_WRITERS, CATALOG_WRITE_FORBIDDEN_MESSAGE);
            return failOnDuplicateName(() => repository.create(input), input[nameField]);
        },

        /** Sửa mục; có thể dùng lại mục đã ngừng bằng is_active = true. Không có → NOT_FOUND. */
        async update(caller, id, input) {
            assertRole(caller, CATALOG_WRITERS, CATALOG_WRITE_FORBIDDEN_MESSAGE);
            const updated = await failOnDuplicateName(() => repository.update(id, input), input[nameField]);
            if (!updated) throw notFound(id);
            return updated;
        },

        /**
         * QT-13: "xóa" chỉ đặt is_active = false, không xóa vật lý; thiết bị, phiếu cũ vẫn giữ tham chiếu.
         * Mục đã ngừng thì vẫn trả bản ghi is_active = false (plan: mặc định đã dùng).
         */
        async deactivate(caller, id) {
            assertRole(caller, CATALOG_WRITERS, CATALOG_WRITE_FORBIDDEN_MESSAGE);
            const deactivated = await repository.deactivate(id);
            if (!deactivated) throw notFound(id);
            return deactivated;
        },
    };
}

/**
 * CatalogService (sơ đồ kiến trúc): danh mục sản phẩm và nhóm sự cố – thêm, sửa, ngừng dùng,
 * không xóa vật lý (QT-13, NFR5, HT2). Nhận dữ liệu đã qua validator; tự kiểm vai trò (D3).
 *
 * @param {object} deps
 * @param {object} deps.productRepository
 * @param {object} deps.issueCategoryRepository
 */
function createCatalogService({ productRepository, issueCategoryRepository }) {
    const products = createCatalogOperations({
        repository: productRepository,
        nameField: 'product_name',
        label: 'sản phẩm',
    });
    const issueCategories = createCatalogOperations({
        repository: issueCategoryRepository,
        nameField: 'category_name',
        label: 'nhóm sự cố',
    });

    return {
        listProducts: products.list,

        /** Thêm sản phẩm; không gửi số tháng bảo hành thì lấy mặc định 12 (api-contract mục 5). */
        createProduct(caller, input) {
            return products.create(caller, {
                ...input,
                default_warranty_months: input.default_warranty_months ?? DEFAULT_WARRANTY_MONTHS,
            });
        },

        updateProduct: products.update,
        deactivateProduct: products.deactivate,

        listIssueCategories: issueCategories.list,
        createIssueCategory: issueCategories.create,
        updateIssueCategory: issueCategories.update,
        deactivateIssueCategory: issueCategories.deactivate,
    };
}

module.exports = { createCatalogService, CATALOG_WRITE_FORBIDDEN_MESSAGE };
