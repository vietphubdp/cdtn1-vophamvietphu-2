'use strict';

const {
    createWarrantyService,
    calculateWarrantyExpiry,
    determineWarrantyStatus,
} = require('../../src/services/WarrantyService');
const { ErrorCode } = require('../../src/errors/AppError');
const { Role, WarrantyStatus } = require('../../src/domain/constants');
const { createFakeDeviceRepository } = require('../helpers/fakeDevice');
const { DEVICES: SEED_DEVICES } = require('../../db/seeds/006_device');

// Unit test WarrantyService (QT-05) với repository giả, không cần CSDL. `now` truyền vào,
// không phụ thuộc ngày giờ hiện tại. Khẳng định mã nghiệp vụ, không khẳng định mã HTTP.

const RECEPTIONIST = { employee_id: 7, role: Role.TIEP_NHAN, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };
const MANAGER = { employee_id: 8, role: Role.QUAN_LY_TRUNG_TAM, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };

/** Thời điểm theo giờ Việt Nam, ví dụ vn('2027-03-05T10:00'). */
const vn = (local) => new Date(`${local}:00+07:00`);

const DEVICE_AC = { purchase_date: '2026-03-05', warranty_months: 12 };

async function captureError(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('calculateWarrantyExpiry – ngày hết bảo hành (QT-05, Q4)', () => {
    test('US4-AC1 luồng đúng: 05/03/2026 + 12 tháng → 05/03/2027', () => {
        expect(calculateWarrantyExpiry('2026-03-05', 12)).toBe('2027-03-05');
    });

    test('QT-05 giá trị biên: 31/01/2026 + 1 tháng → ngày cuối tháng 2 (28/02/2026)', () => {
        expect(calculateWarrantyExpiry('2026-01-31', 1)).toBe('2026-02-28');
    });

    test('QT-05 giá trị biên: 31/01/2028 + 1 tháng → 29/02/2028 (năm nhuận)', () => {
        expect(calculateWarrantyExpiry('2028-01-31', 1)).toBe('2028-02-29');
    });

    test('QT-05 giá trị biên: 29/02/2028 + 12 tháng → 28/02/2029', () => {
        expect(calculateWarrantyExpiry('2028-02-29', 12)).toBe('2029-02-28');
    });

    test('QT-05 giá trị biên: 31/08/2025 + 6 tháng qua năm mới → 28/02/2026', () => {
        expect(calculateWarrantyExpiry('2025-08-31', 6)).toBe('2026-02-28');
    });

    test('QT-05 giá trị biên: 31/03/2026 + 1 tháng → 30/04/2026', () => {
        expect(calculateWarrantyExpiry('2026-03-31', 1)).toBe('2026-04-30');
    });

    test('QT-05 giá trị biên: 15/12/2026 + 60 tháng (tối đa) → 15/12/2031', () => {
        expect(calculateWarrantyExpiry('2026-12-15', 60)).toBe('2031-12-15');
    });

    test('QT-05 dữ liệu sai: ngày mua không có thật → ném TypeError (lỗi lập trình, không phải lỗi người dùng)', () => {
        expect(() => calculateWarrantyExpiry('2026-02-30', 12)).toThrow(TypeError);
    });
});

describe('determineWarrantyStatus – tình trạng bảo hành (QT-05, FR5)', () => {
    test('US4-AC1 giá trị biên: tiếp nhận ngày 05/03/2027 (ngày hết hạn) → còn bảo hành', () => {
        expect(determineWarrantyStatus(DEVICE_AC, vn('2027-03-05T10:00'))).toEqual({
            warranty_expires_on: '2027-03-05',
            warranty_status: WarrantyStatus.CON_BAO_HANH,
        });
    });

    test('US4-AC2 giá trị biên: tiếp nhận ngày 06/03/2027 → hết bảo hành (có tính phí)', () => {
        expect(determineWarrantyStatus(DEVICE_AC, vn('2027-03-06T08:00'))).toEqual({
            warranty_expires_on: '2027-03-05',
            warranty_status: WarrantyStatus.HET_BAO_HANH,
        });
    });

    test('US4-AC3 luồng đúng: thiếu ngày mua → chưa xác minh, không có ngày hết hạn', () => {
        expect(determineWarrantyStatus({ purchase_date: null, warranty_months: 12 }, vn('2026-10-08T14:30'))).toEqual({
            warranty_expires_on: null,
            warranty_status: WarrantyStatus.CHUA_XAC_MINH,
        });
    });

    test('QT-05 giá trị biên: 23:59:59 ngày 05/03/2027 giờ VN (16:59:59 UTC) vẫn còn bảo hành', () => {
        const now = new Date('2027-03-05T16:59:59Z');

        expect(determineWarrantyStatus(DEVICE_AC, now).warranty_status).toBe(WarrantyStatus.CON_BAO_HANH);
    });

    test('QT-05 giá trị biên: 00:00 ngày 06/03/2027 giờ VN (17:00 UTC ngày 05/03) đã hết bảo hành', () => {
        const now = new Date('2027-03-05T17:00:00Z');

        expect(determineWarrantyStatus(DEVICE_AC, now).warranty_status).toBe(WarrantyStatus.HET_BAO_HANH);
    });

    test('QT-05 giá trị biên: mua 31/01/2026 + 1 tháng → 28/02 còn, 01/03 hết', () => {
        const device = { purchase_date: '2026-01-31', warranty_months: 1 };

        expect(determineWarrantyStatus(device, vn('2026-02-28T12:00')).warranty_status).toBe(WarrantyStatus.CON_BAO_HANH);
        expect(determineWarrantyStatus(device, vn('2026-03-01T12:00')).warranty_status).toBe(WarrantyStatus.HET_BAO_HANH);
    });

    test('QT-05 luồng đúng: dữ liệu seed khớp nhãn CON/HET/NULL trong suốt kỳ chấm BT2 (07/2026–03/2027)', () => {
        const expected = { CON: WarrantyStatus.CON_BAO_HANH, HET: WarrantyStatus.HET_BAO_HANH, NULL: WarrantyStatus.CHUA_XAC_MINH };

        for (const now of [vn('2026-07-01T00:00'), vn('2026-11-01T09:00'), vn('2027-03-01T23:59')]) {
            for (const device of SEED_DEVICES) {
                expect([device.serial_no, determineWarrantyStatus(device, now).warranty_status]).toEqual([
                    device.serial_no,
                    expected[device.case],
                ]);
            }
        }
    });
});

describe('WarrantyService.getWarranty – API 5 (UC4)', () => {
    function createService() {
        const deviceRepository = createFakeDeviceRepository();
        return { warrantyService: createWarrantyService({ deviceRepository }), deviceRepository };
    }

    test('US4-AC1 luồng đúng: thiết bị mua 05/03/2026, gọi ngày 08/10/2026 → đúng ví dụ api-contract 3.5', async () => {
        const { warrantyService } = createService();

        const result = await warrantyService.getWarranty(RECEPTIONIST, 3311, vn('2026-10-08T14:30'));

        expect(result).toEqual({
            device_id: 3311,
            purchase_date: '2026-03-05',
            warranty_months: 12,
            warranty_expires_on: '2027-03-05',
            warranty_status: WarrantyStatus.CON_BAO_HANH,
        });
    });

    test('US4-AC3 luồng đúng: Quản lý xem thiết bị thiếu ngày mua → CHUA_XAC_MINH, ngày null', async () => {
        const { warrantyService } = createService();

        const result = await warrantyService.getWarranty(MANAGER, 3350, vn('2026-10-08T14:30'));

        expect(result).toEqual({
            device_id: 3350,
            purchase_date: null,
            warranty_months: 12,
            warranty_expires_on: null,
            warranty_status: WarrantyStatus.CHUA_XAC_MINH,
        });
    });

    test('US4-AC2 luồng đúng: thiết bị đã hết hạn 28/02/2026 → HET_BAO_HANH', async () => {
        const { warrantyService } = createService();

        const result = await warrantyService.getWarranty(RECEPTIONIST, 3360, vn('2026-10-08T14:30'));

        expect(result.warranty_expires_on).toBe('2026-02-28');
        expect(result.warranty_status).toBe(WarrantyStatus.HET_BAO_HANH);
    });

    test('US4 dữ liệu sai: thiết bị không tồn tại → NOT_FOUND', async () => {
        const { warrantyService } = createService();

        const err = await captureError(warrantyService.getWarranty(RECEPTIONIST, 9999, vn('2026-10-08T14:30')));

        expect(err.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('US4 dữ liệu sai: không có người gọi → FORBIDDEN, không đọc CSDL', async () => {
        const { warrantyService, deviceRepository } = createService();

        const err = await captureError(warrantyService.getWarranty(undefined, 3311, vn('2026-10-08T14:30')));

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
        expect(deviceRepository.findById).not.toHaveBeenCalled();
    });
});
