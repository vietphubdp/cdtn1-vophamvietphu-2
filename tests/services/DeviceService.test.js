'use strict';

const { createDeviceService, isPurchaseDateInFuture } = require('../../src/services/DeviceService');
const { ErrorCode } = require('../../src/errors/AppError');
const { Role } = require('../../src/domain/constants');
const { createFakeDeviceRepository } = require('../helpers/fakeDevice');
const { createFakeCustomerRepository } = require('../helpers/fakeCustomer');
const { createFakeProductRepository } = require('../helpers/fakeCatalog');

// Unit test DeviceService (QT-03, FR3, FR4) với repository giả, không cần CSDL. `now` truyền vào.
// Khẳng định mã nghiệp vụ, không khẳng định mã HTTP. Sản phẩm giả: 1 Oppo A78 (12 tháng),
// 2 Samsung Galaxy A55 (18 tháng), 3 Nokia 105 (đã ngừng dùng).

const RECEPTIONIST = { employee_id: 7, role: Role.TIEP_NHAN, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };
const MANAGER = { employee_id: 8, role: Role.QUAN_LY_TRUNG_TAM, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };

/** Thời điểm theo giờ Việt Nam, ví dụ vn('2026-10-08T14:22'). */
const vn = (local) => new Date(`${local}:00+07:00`);
const NOW = vn('2026-10-08T14:22');

const NEW_DEVICE = Object.freeze({ product_id: 1, serial_no: 'OPA78-55120', purchase_date: null, warranty_months: undefined });

function createService() {
    const deviceRepository = createFakeDeviceRepository();
    const customerRepository = createFakeCustomerRepository();
    const productRepository = createFakeProductRepository();
    const deviceService = createDeviceService({ deviceRepository, customerRepository, productRepository });
    return { deviceService, deviceRepository };
}

async function captureError(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('DeviceService – danh sách thiết bị của khách (API 2, FR3)', () => {
    test('US1-AC1 luồng đúng: khách 1024 → 2 thiết bị kèm tên máy, serial, ngày mua', async () => {
        const { deviceService } = createService();

        const result = await deviceService.listByCustomer(RECEPTIONIST, 1024);

        expect(result).toEqual({
            items: [
                { device_id: 3311, product_name: 'Samsung Galaxy A55', serial_no: 'SN-A55-778901', purchase_date: '2026-03-05' },
                { device_id: 3350, product_name: 'Oppo A78', serial_no: '358240051111110', purchase_date: null },
            ],
            total: 2,
        });
    });

    test('QT-13 luồng đúng: thiết bị có sản phẩm đã ngừng dùng vẫn hiện trong danh sách', async () => {
        const { deviceService } = createService();

        const result = await deviceService.listByCustomer(MANAGER, 1025);

        expect(result.items.map((d) => d.product_name)).toEqual(['Nokia 105']);
    });

    test('FR3 giá trị biên: khách chưa có thiết bị → danh sách rỗng, total 0', async () => {
        const { deviceService, deviceRepository } = createService();
        deviceRepository.rows.length = 0;

        expect(await deviceService.listByCustomer(RECEPTIONIST, 1024)).toEqual({ items: [], total: 0 });
    });

    test('FR3 dữ liệu sai: khách không tồn tại → NOT_FOUND, không đọc thiết bị', async () => {
        const { deviceService, deviceRepository } = createService();

        const err = await captureError(deviceService.listByCustomer(RECEPTIONIST, 9999));

        expect(err.code).toBe(ErrorCode.NOT_FOUND);
        expect(deviceRepository.listByCustomer).not.toHaveBeenCalled();
    });

    test('FR3 dữ liệu sai: không có người gọi → FORBIDDEN', async () => {
        const { deviceService } = createService();

        const err = await captureError(deviceService.listByCustomer(undefined, 1024));

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
    });
});

describe('DeviceService – ghi nhận thiết bị (API 4, UC3, FR4)', () => {
    test('US3 luồng đúng: ghi nhận thiết bị → đúng dạng api-contract 3.4, created_at giờ Việt Nam', async () => {
        const { deviceService } = createService();

        const created = await deviceService.createDevice(RECEPTIONIST, 1025, NEW_DEVICE, NOW);

        expect(created).toEqual({
            device_id: 3361,
            customer_id: 1025,
            product_id: 1,
            product_name: 'Oppo A78',
            serial_no: 'OPA78-55120',
            purchase_date: null,
            warranty_months: 12,
            created_at: '2026-10-08T14:20:00+07:00',
        });
    });

    test('FR4 luồng đúng: bỏ trống số tháng → lấy default_warranty_months của sản phẩm (18, Q2)', async () => {
        const { deviceService, deviceRepository } = createService();

        await deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, product_id: 2 }, NOW);

        expect(deviceRepository.create).toHaveBeenCalledWith(expect.objectContaining({ product_id: 2, warranty_months: 18 }));
    });

    test('FR4 luồng đúng: nhân viên nhập số tháng riêng (24) → giữ số đã nhập, không lấy theo sản phẩm', async () => {
        const { deviceService, deviceRepository } = createService();

        await deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, product_id: 2, warranty_months: 24 }, NOW);

        expect(deviceRepository.create).toHaveBeenCalledWith(expect.objectContaining({ warranty_months: 24 }));
    });

    test('FR4 giá trị biên: ngày mua đúng hôm nay theo giờ VN được chấp nhận', async () => {
        const { deviceService } = createService();

        const created = await deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, purchase_date: '2026-10-08' }, NOW);

        expect(created.purchase_date).toBe('2026-10-08');
    });

    test('FR4 giá trị biên: 00:30 ngày 09/10 giờ VN (17:30 UTC ngày 08/10) → ngày mua 09/10 không bị coi là tương lai', async () => {
        const { deviceService } = createService();
        const now = new Date('2026-10-08T17:30:00Z');

        const created = await deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, purchase_date: '2026-10-09' }, now);

        expect(created.purchase_date).toBe('2026-10-09');
    });

    test('FR4 dữ liệu sai: ngày mua là ngày mai → VALIDATION_FAILED kèm purchase_date, không ghi CSDL', async () => {
        const { deviceService, deviceRepository } = createService();

        const err = await captureError(
            deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, purchase_date: '2026-10-09' }, NOW),
        );

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details)).toEqual(['purchase_date']);
        expect(deviceRepository.create).not.toHaveBeenCalled();
    });

    test('QT-03 dữ liệu sai: serial đã thuộc khách khác → CONFLICT, không thêm dòng', async () => {
        const { deviceService, deviceRepository } = createService();
        const before = deviceRepository.rows.length;

        const err = await captureError(
            deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, serial_no: 'SN-A55-778901' }, NOW),
        );

        expect(err.code).toBe(ErrorCode.CONFLICT);
        expect(deviceRepository.rows).toHaveLength(before);
    });

    test('QT-03 dữ liệu sai: serial đã thuộc chính khách này → vẫn CONFLICT (không ghi nhận trùng)', async () => {
        const { deviceService } = createService();

        const err = await captureError(
            deviceService.createDevice(RECEPTIONIST, 1024, { ...NEW_DEVICE, serial_no: 'SN-A55-778901' }, NOW),
        );

        expect(err.code).toBe(ErrorCode.CONFLICT);
    });

    test('HT2 dữ liệu sai: sản phẩm đã ngừng dùng → VALIDATION_FAILED kèm product_id', async () => {
        const { deviceService, deviceRepository } = createService();

        const err = await captureError(deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, product_id: 3 }, NOW));

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(err.details).toHaveProperty('product_id');
        expect(deviceRepository.create).not.toHaveBeenCalled();
    });

    test('FR4 dữ liệu sai: sản phẩm không tồn tại và ngày mua ở tương lai → gom cả hai lỗi một lần', async () => {
        const { deviceService } = createService();

        const err = await captureError(
            deviceService.createDevice(RECEPTIONIST, 1025, { ...NEW_DEVICE, product_id: 99, purchase_date: '2027-01-01' }, NOW),
        );

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details).sort()).toEqual(['product_id', 'purchase_date']);
    });

    test('US3 dữ liệu sai: khách không tồn tại → NOT_FOUND, không ghi CSDL', async () => {
        const { deviceService, deviceRepository } = createService();

        const err = await captureError(deviceService.createDevice(RECEPTIONIST, 9999, NEW_DEVICE, NOW));

        expect(err.code).toBe(ErrorCode.NOT_FOUND);
        expect(deviceRepository.create).not.toHaveBeenCalled();
    });

    test('US3 dữ liệu sai: Quản lý ghi nhận thiết bị → FORBIDDEN, không ghi CSDL (D3)', async () => {
        const { deviceService, deviceRepository } = createService();

        const err = await captureError(deviceService.createDevice(MANAGER, 1025, NEW_DEVICE, NOW));

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
        expect(deviceRepository.create).not.toHaveBeenCalled();
    });

    test('US3 dữ liệu sai: lỗi CSDL không phải trùng serial → ném lại nguyên lỗi (thành 500 ở ErrorMapper)', async () => {
        const { deviceService, deviceRepository } = createService();
        const dbError = new Error('connection terminated');
        deviceRepository.create.mockRejectedValueOnce(dbError);

        const err = await captureError(deviceService.createDevice(RECEPTIONIST, 1025, NEW_DEVICE, NOW));

        expect(err).toBe(dbError);
    });
});

describe('isPurchaseDateInFuture (FR4)', () => {
    test.each([
        ['2026-10-07', false],
        ['2026-10-08', false],
        ['2026-10-09', true],
    ])('FR4 giá trị biên: ngày mua %s so với 08/10/2026 giờ VN → tương lai = %s', (date, expected) => {
        expect(isPurchaseDateInFuture(date, NOW)).toBe(expected);
    });
});
