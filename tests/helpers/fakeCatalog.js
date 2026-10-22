'use strict';

const { DuplicateKeyError } = require('../../src/errors/DuplicateKeyError');
const { Priority } = require('../../src/domain/constants');

// Repository giả cho hai danh mục, lưu trong bộ nhớ, không cần CSDL (D4).
// Hành vi giống bản thật: tên trùng (phân biệt hoa thường như UNIQUE) → DuplicateKeyError,
// không có dòng → null, list sắp như câu SQL.

const TEST_PRODUCTS = [
    { product_name: 'Oppo A78', default_warranty_months: 12, is_active: true },
    { product_name: 'Samsung Galaxy A55', default_warranty_months: 18, is_active: true },
    { product_name: 'Nokia 105', default_warranty_months: 6, is_active: false },
];

const TEST_CATEGORIES = [
    { category_name: 'Màn hình', default_priority: Priority.CAO, is_active: true },
    { category_name: 'Pin', default_priority: Priority.TRUNG_BINH, is_active: true },
    { category_name: 'Sạc', default_priority: Priority.TRUNG_BINH, is_active: true },
    { category_name: 'Nhóm cũ', default_priority: Priority.THAP, is_active: false },
];

function createInMemoryCatalogRepository({ idField, nameField, seedRows, sortBy }) {
    let nextId = 1;
    const rows = seedRows.map((r) => ({ [idField]: nextId++, ...r }));

    function assertNameFree(name, exceptId) {
        if (rows.some((r) => r[nameField] === name && r[idField] !== exceptId)) {
            throw new DuplicateKeyError(`${nameField}_key`);
        }
    }

    return {
        rows,
        list: jest.fn(async ({ includeInactive }) =>
            rows
                .filter((r) => includeInactive || r.is_active)
                .sort(sortBy)
                .map((r) => ({ ...r })),
        ),
        create: jest.fn(async (input) => {
            assertNameFree(input[nameField]);
            const row = { [idField]: nextId++, ...input, is_active: true };
            rows.push(row);
            return { ...row };
        }),
        update: jest.fn(async (id, input) => {
            const row = rows.find((r) => r[idField] === id);
            if (!row) return null;
            assertNameFree(input[nameField], id);
            const { is_active: isActive, ...rest } = input;
            Object.assign(row, rest);
            if (isActive !== undefined && isActive !== null) row.is_active = isActive;
            return { ...row };
        }),
        deactivate: jest.fn(async (id) => {
            const row = rows.find((r) => r[idField] === id);
            if (!row) return null;
            row.is_active = false;
            return { ...row };
        }),
    };
}

function createFakeProductRepository(seedRows = TEST_PRODUCTS) {
    return createInMemoryCatalogRepository({
        idField: 'product_id',
        nameField: 'product_name',
        seedRows,
        sortBy: (a, b) => a.product_name.localeCompare(b.product_name) || a.product_id - b.product_id,
    });
}

function createFakeIssueCategoryRepository(seedRows = TEST_CATEGORIES) {
    return createInMemoryCatalogRepository({
        idField: 'category_id',
        nameField: 'category_name',
        seedRows,
        sortBy: (a, b) => a.category_id - b.category_id,
    });
}

module.exports = { TEST_PRODUCTS, TEST_CATEGORIES, createFakeProductRepository, createFakeIssueCategoryRepository };
