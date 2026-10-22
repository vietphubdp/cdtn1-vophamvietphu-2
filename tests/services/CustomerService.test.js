'use strict';

const { createCustomerService } = require('../../src/services/CustomerService');
const { ErrorCode } = require('../../src/errors/AppError');
const { Role } = require('../../src/domain/constants');
const { createFakeCustomerRepository } = require('../helpers/fakeCustomer');

// Unit test CustomerService với repository giả, không cần CSDL. Khẳng định mã nghiệp vụ,
// không khẳng định mã HTTP (việc đó thuộc test ErrorMapper và test HTTP).

const RECEPTIONIST = { employee_id: 7, role: Role.TIEP_NHAN, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };
const MANAGER = { employee_id: 8, role: Role.QUAN_LY_TRUNG_TAM, center_id: 2, center_name: 'Trung tâm bảo hành Quận 10' };

const NEW_CUSTOMER = Object.freeze({
    full_name: 'Lê Văn Cường',
    phone: '0931234888',
    email: null,
    address: '45 Lý Thường Kiệt, Quận 10',
});

function createService() {
    const customerRepository = createFakeCustomerRepository();
    const customerService = createCustomerService({ customerRepository });
    return { customerService, customerRepository };
}

async function captureError(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('CustomerService – tra cứu khách (UC1, API 1)', () => {
    test('US1-AC1 luồng đúng: số 0901234567 có sẵn → hồ sơ khách, Tiếp nhận thấy số đã che', async () => {
        const { customerService } = createService();

        const customer = await customerService.findByPhone(RECEPTIONIST, '0901234567');

        expect(customer).toEqual({
            customer_id: 1024,
            full_name: 'Nguyễn Văn An',
            phone: '090****567',
            email: null,
            address: '12 Nguyễn Tri Phương, Quận 10',
        });
    });

    test('US1-AC1 luồng đúng: nhập +84901234567 → chuẩn hóa rồi tra đúng hồ sơ (QT-02)', async () => {
        const { customerService, customerRepository } = createService();

        const customer = await customerService.findByPhone(RECEPTIONIST, '+84 90 123 4567');

        expect(customer.customer_id).toBe(1024);
        expect(customerRepository.findByPhone).toHaveBeenCalledWith('0901234567');
    });

    test('QT-15 luồng đúng: Quản lý tra cứu → số điện thoại đầy đủ', async () => {
        const { customerService } = createService();

        const customer = await customerService.findByPhone(MANAGER, '0901234567');

        expect(customer.phone).toBe('0901234567');
    });

    test('US1-AC2 dữ liệu sai: số chưa có trong hệ thống → NOT_FOUND', async () => {
        const { customerService } = createService();

        const err = await captureError(customerService.findByPhone(RECEPTIONIST, '0999999999'));

        expect(err.code).toBe(ErrorCode.NOT_FOUND);
    });

    test.each([['090123456'], ['09012345678']])(
        'US1-AC3 giá trị biên: "%s" không đủ 10 chữ số sau chuẩn hóa → VALIDATION_FAILED kèm phone, không tra CSDL',
        async (raw) => {
            const { customerService, customerRepository } = createService();

            const err = await captureError(customerService.findByPhone(RECEPTIONIST, raw));

            expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
            expect(err.details).toHaveProperty('phone');
            expect(customerRepository.findByPhone).not.toHaveBeenCalled();
        },
    );

    test('US1 dữ liệu sai: không có người gọi → FORBIDDEN', async () => {
        const { customerService } = createService();

        const err = await captureError(customerService.findByPhone(undefined, '0901234567'));

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
    });
});

describe('CustomerService – tạo khách (UC2, API 3)', () => {
    test('US2 luồng đúng: Tiếp nhận tạo khách → hồ sơ mới, số đã che, created_at giờ Việt Nam', async () => {
        const { customerService, customerRepository } = createService();

        const created = await customerService.createCustomer(RECEPTIONIST, NEW_CUSTOMER);

        expect(created).toEqual({
            customer_id: 1026,
            full_name: 'Lê Văn Cường',
            phone: '093****888',
            email: null,
            address: '45 Lý Thường Kiệt, Quận 10',
            created_at: '2026-10-08T14:20:00+07:00',
        });
        expect(customerRepository.rows.at(-1).phone).toBe('0931234888'); // lưu số đầy đủ, chỉ che khi trả ra
    });

    test('QT-02 luồng đúng: service chuẩn hóa lại số trước khi lưu, không tin lớp trên', async () => {
        const { customerService, customerRepository } = createService();

        await customerService.createCustomer(RECEPTIONIST, { ...NEW_CUSTOMER, phone: '+84 93 123 4888' });

        expect(customerRepository.create).toHaveBeenCalledWith(expect.objectContaining({ phone: '0931234888' }));
    });

    test('US2 luồng đúng: email, địa chỉ vắng → lưu null', async () => {
        const { customerService, customerRepository } = createService();

        await customerService.createCustomer(RECEPTIONIST, { full_name: 'Lê Văn Cường', phone: '0931234888' });

        expect(customerRepository.create).toHaveBeenCalledWith({
            full_name: 'Lê Văn Cường',
            phone: '0931234888',
            email: null,
            address: null,
        });
    });

    test('QT-01 dữ liệu sai: số đã tồn tại → CONFLICT kèm customer_id của hồ sơ có sẵn, không tạo mới', async () => {
        const { customerService, customerRepository } = createService();
        const before = customerRepository.rows.length;

        const err = await captureError(
            customerService.createCustomer(RECEPTIONIST, { ...NEW_CUSTOMER, phone: '+84901234567' }),
        );

        expect(err.code).toBe(ErrorCode.CONFLICT);
        expect(err.details).toEqual({ customer_id: 1024 });
        expect(customerRepository.rows).toHaveLength(before);
    });

    test('QT-02 giá trị biên: số 9 chữ số → VALIDATION_FAILED kèm phone, không ghi CSDL', async () => {
        const { customerService, customerRepository } = createService();

        const err = await captureError(
            customerService.createCustomer(RECEPTIONIST, { ...NEW_CUSTOMER, phone: '093123488' }),
        );

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(err.details).toHaveProperty('phone');
        expect(customerRepository.create).not.toHaveBeenCalled();
    });

    test('US2 dữ liệu sai: Quản lý tạo khách → FORBIDDEN, không ghi CSDL (D3)', async () => {
        const { customerService, customerRepository } = createService();

        const err = await captureError(customerService.createCustomer(MANAGER, NEW_CUSTOMER));

        expect(err.code).toBe(ErrorCode.FORBIDDEN);
        expect(customerRepository.create).not.toHaveBeenCalled();
    });

    test('US2 dữ liệu sai: lỗi CSDL không phải trùng số → ném lại nguyên lỗi (thành 500 ở ErrorMapper)', async () => {
        const { customerService, customerRepository } = createService();
        const dbError = new Error('connection terminated');
        customerRepository.create.mockRejectedValueOnce(dbError);

        const err = await captureError(customerService.createCustomer(RECEPTIONIST, NEW_CUSTOMER));

        expect(err).toBe(dbError);
    });
});
