'use strict';

const { createCatalogService } = require('../../src/services/CatalogService');
const { ErrorCode } = require('../../src/errors/AppError');
const { Role, Priority } = require('../../src/domain/constants');
const { createFakeProductRepository, createFakeIssueCategoryRepository } = require('../helpers/fakeCatalog');

// Unit test CatalogService với repository giả, không cần CSDL. Khẳng định mã nghiệp vụ,
// không khẳng định mã HTTP (việc đó thuộc test ErrorMapper và test HTTP).

const RECEPTIONIST = { employee_id: 7, role: Role.TIEP_NHAN, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };
const MANAGER = { employee_id: 8, role: Role.QUAN_LY_TRUNG_TAM, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };

function createService() {
    const productRepository = createFakeProductRepository();
    const issueCategoryRepository = createFakeIssueCategoryRepository();
    const catalogService = createCatalogService({ productRepository, issueCategoryRepository });
    return { catalogService, productRepository, issueCategoryRepository };
}

async function captureError(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

function names(result, field) {
    return result.items.map((item) => item[field]);
}

describe('CatalogService – sản phẩm (HT2)', () => {
    test('HT2 luồng đúng: Quản lý thêm sản phẩm → trả bản ghi đang dùng', async () => {
        const { catalogService } = createService();

        const created = await catalogService.createProduct(MANAGER, {
            product_name: 'Oppo A79',
            default_warranty_months: 18,
        });

        expect(created).toEqual({
            product_id: expect.any(Number),
            product_name: 'Oppo A79',
            default_warranty_months: 18,
            is_active: true,
        });
    });

    test('HT2 luồng đúng: không gửi số tháng bảo hành → lấy mặc định 12', async () => {
        const { catalogService, productRepository } = createService();

        const created = await catalogService.createProduct(MANAGER, { product_name: 'Xiaomi Redmi 14' });

        expect(created.default_warranty_months).toBe(12);
        expect(productRepository.create).toHaveBeenCalledWith({
            product_name: 'Xiaomi Redmi 14',
            default_warranty_months: 12,
        });
    });

    test('HT2 dữ liệu sai: tên sản phẩm đã tồn tại → CONFLICT', async () => {
        const { catalogService } = createService();

        const err = await captureError(
            catalogService.createProduct(MANAGER, { product_name: 'Oppo A78', default_warranty_months: 12 }),
        );

        expect(err.code).toBe(ErrorCode.CONFLICT);
        expect(err.message).toContain('Oppo A78');
    });

    test('HT2 dữ liệu sai: sửa sang tên của sản phẩm khác → CONFLICT', async () => {
        const { catalogService } = createService();

        const err = await captureError(
            catalogService.updateProduct(MANAGER, 1, { product_name: 'Samsung Galaxy A55', default_warranty_months: 12 }),
        );

        expect(err.code).toBe(ErrorCode.CONFLICT);
    });

    test('HT2 luồng đúng: sửa giữ nguyên tên của chính nó không bị coi là trùng', async () => {
        const { catalogService } = createService();

        const updated = await catalogService.updateProduct(MANAGER, 1, {
            product_name: 'Oppo A78',
            default_warranty_months: 24,
        });

        expect(updated).toMatchObject({ product_id: 1, product_name: 'Oppo A78', default_warranty_months: 24 });
    });

    test('HT2 dữ liệu sai: Tiếp nhận thêm, sửa, ngừng dùng sản phẩm → FORBIDDEN, không gọi repository ghi', async () => {
        const { catalogService, productRepository } = createService();
        const input = { product_name: 'Oppo A79', default_warranty_months: 12 };

        const errors = await Promise.all([
            captureError(catalogService.createProduct(RECEPTIONIST, input)),
            captureError(catalogService.updateProduct(RECEPTIONIST, 1, input)),
            captureError(catalogService.deactivateProduct(RECEPTIONIST, 1)),
        ]);

        expect(errors.map((e) => e.code)).toEqual([ErrorCode.FORBIDDEN, ErrorCode.FORBIDDEN, ErrorCode.FORBIDDEN]);
        expect(productRepository.create).not.toHaveBeenCalled();
        expect(productRepository.update).not.toHaveBeenCalled();
        expect(productRepository.deactivate).not.toHaveBeenCalled();
    });

    test('HT2 dữ liệu sai: không có caller (chưa xác thực) → FORBIDDEN', async () => {
        const { catalogService } = createService();

        const err = await captureError(catalogService.listProducts(undefined));

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
    });

    test('HT2 dữ liệu sai: sửa, ngừng dùng sản phẩm không tồn tại → NOT_FOUND', async () => {
        const { catalogService } = createService();

        const errors = await Promise.all([
            captureError(catalogService.updateProduct(MANAGER, 999, { product_name: 'X', default_warranty_months: 12 })),
            captureError(catalogService.deactivateProduct(MANAGER, 999)),
        ]);

        expect(errors.map((e) => e.code)).toEqual([ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND]);
    });

    test('QT-13 luồng đúng: ngừng dùng xong không còn trong danh sách mặc định, vẫn còn khi Quản lý xem cả mục ngừng', async () => {
        const { catalogService, productRepository } = createService();

        const deactivated = await catalogService.deactivateProduct(MANAGER, 1);
        const defaultList = await catalogService.listProducts(MANAGER);
        const fullList = await catalogService.listProducts(MANAGER, { includeInactive: true });

        expect(deactivated).toMatchObject({ product_id: 1, is_active: false });
        expect(names(defaultList, 'product_name')).not.toContain('Oppo A78');
        expect(names(fullList, 'product_name')).toContain('Oppo A78');
        // Không xóa vật lý: dòng vẫn còn trong kho dữ liệu.
        expect(productRepository.rows.find((r) => r.product_id === 1)).toBeDefined();
    });

    test('QT-13 giá trị biên: ngừng dùng sản phẩm đã ngừng → vẫn trả bản ghi is_active = false', async () => {
        const { catalogService } = createService();
        const inactiveId = 3; // Nokia 105 trong dữ liệu giả

        const result = await catalogService.deactivateProduct(MANAGER, inactiveId);

        expect(result).toMatchObject({ product_id: inactiveId, is_active: false });
    });

    test('HT2 luồng đúng: PUT kèm is_active = true dùng lại sản phẩm đã ngừng', async () => {
        const { catalogService } = createService();

        const updated = await catalogService.updateProduct(MANAGER, 3, {
            product_name: 'Nokia 105',
            default_warranty_months: 6,
            is_active: true,
        });
        const defaultList = await catalogService.listProducts(MANAGER);

        expect(updated.is_active).toBe(true);
        expect(names(defaultList, 'product_name')).toContain('Nokia 105');
    });

    test('HT2 giá trị biên: PUT vắng is_active giữ nguyên trạng thái ngừng dùng', async () => {
        const { catalogService } = createService();

        const updated = await catalogService.updateProduct(MANAGER, 3, {
            product_name: 'Nokia 105 (2023)',
            default_warranty_months: 6,
            is_active: undefined,
        });

        expect(updated.is_active).toBe(false);
    });

    test('HT2 luồng đúng: danh sách trả { items, total } với total = số mục trả về', async () => {
        const { catalogService } = createService();

        const result = await catalogService.listProducts(RECEPTIONIST);

        expect(result.total).toBe(result.items.length);
        expect(names(result, 'product_name')).toEqual(['Oppo A78', 'Samsung Galaxy A55']);
    });

    test('HT2 giá trị biên: Tiếp nhận gửi includeInactive → bị bỏ qua, chỉ thấy mục đang dùng (không báo lỗi)', async () => {
        const { catalogService, productRepository } = createService();

        const result = await catalogService.listProducts(RECEPTIONIST, { includeInactive: true });

        expect(names(result, 'product_name')).not.toContain('Nokia 105');
        expect(productRepository.list).toHaveBeenCalledWith({ includeInactive: false });
    });

    test('HT2 dữ liệu sai: lỗi hệ thống từ repository được ném nguyên, không bị đổi thành CONFLICT', async () => {
        const { catalogService, productRepository } = createService();
        const dbError = new Error('connection terminated');
        productRepository.create.mockRejectedValueOnce(dbError);

        const err = await captureError(
            catalogService.createProduct(MANAGER, { product_name: 'Oppo A79', default_warranty_months: 12 }),
        );

        expect(err).toBe(dbError);
    });
});

describe('CatalogService – nhóm sự cố (HT2, NFR5)', () => {
    test('NFR5 luồng đúng: Quản lý thêm nhóm mới → xuất hiện trong danh sách đọc của Tiếp nhận (không sửa code)', async () => {
        const { catalogService } = createService();

        await catalogService.createIssueCategory(MANAGER, {
            category_name: 'Loa, micro',
            default_priority: Priority.THAP,
        });
        const result = await catalogService.listIssueCategories(RECEPTIONIST);

        expect(result.items).toContainEqual({
            category_id: expect.any(Number),
            category_name: 'Loa, micro',
            default_priority: Priority.THAP,
            is_active: true,
        });
    });

    test('NFR5 luồng đúng: đổi mức ưu tiên mặc định của nhóm bằng PUT', async () => {
        const { catalogService } = createService();

        const updated = await catalogService.updateIssueCategory(MANAGER, 2, {
            category_name: 'Pin',
            default_priority: Priority.CAO,
        });

        expect(updated).toMatchObject({ category_id: 2, default_priority: Priority.CAO, is_active: true });
    });

    test('HT2 dữ liệu sai: tên nhóm sự cố đã tồn tại → CONFLICT', async () => {
        const { catalogService } = createService();

        const err = await captureError(
            catalogService.createIssueCategory(MANAGER, { category_name: 'Sạc', default_priority: Priority.THAP }),
        );

        expect(err.code).toBe(ErrorCode.CONFLICT);
    });

    test('HT2 dữ liệu sai: Tiếp nhận thêm nhóm sự cố → FORBIDDEN', async () => {
        const { catalogService } = createService();

        const err = await captureError(
            catalogService.createIssueCategory(RECEPTIONIST, { category_name: 'Loa', default_priority: Priority.THAP }),
        );

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
    });

    test('QT-13 luồng đúng: ngừng dùng nhóm → mất khỏi danh sách mặc định, còn khi include_inactive', async () => {
        const { catalogService } = createService();

        await catalogService.deactivateIssueCategory(MANAGER, 3);
        const defaultList = await catalogService.listIssueCategories(MANAGER);
        const fullList = await catalogService.listIssueCategories(MANAGER, { includeInactive: true });

        expect(names(defaultList, 'category_name')).toEqual(['Màn hình', 'Pin']);
        expect(names(fullList, 'category_name')).toEqual(['Màn hình', 'Pin', 'Sạc', 'Nhóm cũ']);
        expect(fullList.total).toBe(4);
    });

    test('HT2 dữ liệu sai: ngừng dùng nhóm không tồn tại → NOT_FOUND', async () => {
        const { catalogService } = createService();

        const err = await captureError(catalogService.deactivateIssueCategory(MANAGER, 999));

        expect(err.code).toBe(ErrorCode.NOT_FOUND);
    });
});
