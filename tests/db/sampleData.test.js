'use strict';

const { readSampleCsv } = require('../../db/tools/csv');
const { normalizePhone } = require('../../src/services/normalizePhone');
const { SERVICE_CENTERS } = require('../../db/seeds/001_service_center');
const { EMPLOYEES } = require('../../db/seeds/002_employee');
const { PRODUCTS } = require('../../db/seeds/003_product');
const { ISSUE_CATEGORIES } = require('../../db/seeds/004_issue_category');
const { CUSTOMERS } = require('../../db/seeds/005_customer');
const { DEVICES } = require('../../db/seeds/006_device');
const { Role } = require('../../src/domain/constants');

// Kiểm data/sample/*.csv (rút từ bộ mẫu Mekong Mobile bằng db/tools/sample-data.js – TĐ-14) thỏa các
// ràng buộc của db/schema.sql và quy tắc nghiệp vụ, để seed không hỏng giữa chừng. Không cần data/raw/
// hay CSDL: người chấm chạy được ngay sau khi clone.

describe('Dữ liệu mẫu data/sample/', () => {
    test('TĐ-14 luồng đúng: 6 trung tâm, 6 nhóm sự cố lấy nguyên từ bộ mẫu, đổi mã nhóm sang tên SRS, Sạc = mã 3', () => {
        expect(SERVICE_CENTERS.map((c) => c.center_name)).toEqual([
            'TTBH Quận 10', 'TTBH Quận Tân Bình', 'TTBH TP. Thủ Đức', 'TTBH Ninh Kiều', 'TTBH Cái Răng', 'TTBH Cầu Giấy',
        ]);
        expect(ISSUE_CATEGORIES.map((c) => [c.category_id, c.category_name, c.default_priority])).toEqual([
            [1, 'Màn hình', 'CAO'], [2, 'Pin', 'TRUNG_BINH'], [3, 'Sạc', 'TRUNG_BINH'],
            [4, 'Phần mềm', 'THAP'], [5, 'Nước vào', 'CAO'], [6, 'Khác', 'TRUNG_BINH'],
        ]);
    });

    test('QT-02 luồng đúng: mọi số điện thoại đã ở dạng chuẩn (chuẩn hóa lại vẫn ra chính nó)', () => {
        for (const c of CUSTOMERS) expect([c.customer_id, normalizePhone(c.phone)]).toEqual([c.customer_id, c.phone]);
    });

    test('QT-01 dữ liệu sai: không có hai khách trùng số điện thoại hay trùng mã', () => {
        expect(new Set(CUSTOMERS.map((c) => c.phone)).size).toBe(CUSTOMERS.length);
        expect(new Set(CUSTOMERS.map((c) => c.customer_id)).size).toBe(CUSTOMERS.length);
    });

    test('TĐ-14 luồng đúng: khách tự bổ sung 0901234567 sở hữu device_id 1 (có ngày mua) và 2 (không có ngày mua) cho lệnh curl trong README', () => {
        const supplemented = readSampleCsv('customers.csv').filter((c) => c.source === 'TU_BO_SUNG');
        expect(supplemented.map((c) => [c.customer_id, c.phone])).toEqual([['100001', '0901234567']]);
        expect(DEVICES[0]).toMatchObject({ device_id: 1, customer_id: 100001, purchase_date: '2026-03-05', warranty_months: 12 });
        expect(DEVICES[1]).toMatchObject({ device_id: 2, customer_id: 100001, purchase_date: null });
        expect(DEVICES[2].customer_id).not.toBe(100001); // device_id 3: lệnh curl 422 (QT-03)
    });

    test('QT-03 dữ liệu sai: serial không trùng, mọi thiết bị trỏ tới khách và sản phẩm có trong mẫu', () => {
        const customerIds = new Set(CUSTOMERS.map((c) => c.customer_id));
        const productIds = new Set(PRODUCTS.map((p) => p.product_id));
        expect(new Set(DEVICES.map((d) => d.serial_no)).size).toBe(DEVICES.length);
        expect(DEVICES.filter((d) => !customerIds.has(d.customer_id) || !productIds.has(d.product_id))).toEqual([]);
    });

    test('FR4 giá trị biên: tên sản phẩm không trùng (UNIQUE), số tháng bảo hành trong 1–60 và khớp sản phẩm của thiết bị', () => {
        expect(new Set(PRODUCTS.map((p) => p.product_name)).size).toBe(PRODUCTS.length);
        expect(PRODUCTS.length).toBeGreaterThanOrEqual(24);
        const monthsById = new Map(PRODUCTS.map((p) => [p.product_id, p.default_warranty_months]));
        for (const d of DEVICES) {
            expect(d.warranty_months).toBeGreaterThanOrEqual(1);
            expect(d.warranty_months).toBeLessThanOrEqual(60);
            expect(d.warranty_months).toBe(monthsById.get(d.product_id));
        }
    });

    test('QT-05 giá trị biên: có 7 thiết bị không có ngày mua (chưa xác minh)', () => {
        expect(DEVICES.filter((d) => d.purchase_date === null)).toHaveLength(7);
    });

    test('QT-14 luồng đúng: tài khoản demo gán theo trung tâm 1–3 mới, mỗi trung tâm 1 Tiếp nhận + 1 Quản lý', () => {
        const byCenter = (id) => EMPLOYEES.filter((e) => e.center_id === id).map((e) => [e.username, e.role]);
        expect(byCenter(1)).toEqual([['lan.q10', Role.TIEP_NHAN], ['hung.q10', Role.QUAN_LY_TRUNG_TAM]]);
        expect(byCenter(2)).toEqual([['mai.tb', Role.TIEP_NHAN], ['tuan.tb', Role.QUAN_LY_TRUNG_TAM]]);
        expect(byCenter(3)).toEqual([['thu.td', Role.TIEP_NHAN], ['khoa.td', Role.QUAN_LY_TRUNG_TAM]]);
    });
});
