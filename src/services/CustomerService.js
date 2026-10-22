'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');
const { DuplicateKeyError } = require('../errors/DuplicateKeyError');
const { Role } = require('../domain/constants');
const { assertRole } = require('./assertRole');
const { normalizePhone, PHONE_INVALID_MESSAGE } = require('./normalizePhone');
const { phoneForCaller } = require('./PhoneMasker');
const { toVietnamIsoString } = require('./vietnamTime');

// Vai trò gọi được (api-contract mục 1): API 1 cho cả hai vai trò, API 3 chỉ Tiếp nhận.
const LOOKUP_ROLES = [Role.TIEP_NHAN, Role.QUAN_LY_TRUNG_TAM];
const CREATE_ROLES = [Role.TIEP_NHAN];

const MESSAGES = Object.freeze({
    lookupForbidden: 'Vai trò của bạn không được tra cứu khách hàng.',
    createForbidden: 'Chỉ nhân viên Tiếp nhận được tạo hồ sơ khách hàng (lúc tiếp nhận yêu cầu bảo hành).',
    phoneInvalid: 'Số điện thoại không hợp lệ',
    notFound: 'Không tìm thấy khách hàng',
    phoneTaken:
        'Số điện thoại đã tồn tại. Mỗi số chỉ thuộc một hồ sơ khách; mở hồ sơ có sẵn theo customer_id thay vì tạo mới.',
});

/**
 * QT-02: chuẩn hóa lại số điện thoại ở service, không tin dữ liệu từ lớp trên (D2).
 * Không hợp lệ → VALIDATION_FAILED kèm lỗi trường `phone` (400).
 */
function requireNormalizedPhone(raw) {
    const phone = normalizePhone(raw);
    if (phone === null) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, MESSAGES.phoneInvalid, { phone: PHONE_INVALID_MESSAGE });
    }
    return phone;
}

/** Hồ sơ khách trả cho người gọi (api-contract 3.1); số điện thoại che theo vai trò (QT-15). */
function toCustomerDto(caller, customer) {
    return {
        customer_id: customer.customer_id,
        full_name: customer.full_name,
        phone: phoneForCaller(caller, customer.phone),
        email: customer.email,
        address: customer.address,
    };
}

/**
 * CustomerService (sơ đồ kiến trúc): tra cứu khách, chuẩn hóa số điện thoại, tạo khách,
 * che số theo vai trò – QT-01, QT-02, QT-15 · UC1, UC2. Tự kiểm vai trò (D3).
 *
 * @param {object} deps
 * @param {object} deps.customerRepository có findByPhone, create
 */
function createCustomerService({ customerRepository }) {
    return {
        /**
         * UC1 / API 1: tra cứu khách theo số điện thoại (US1). Số nhập ở dạng nào cũng được
         * chuẩn hóa trước khi tra (QT-02, US1-AC1). Không có → NOT_FOUND (US1-AC2).
         */
        async findByPhone(caller, rawPhone) {
            assertRole(caller, LOOKUP_ROLES, MESSAGES.lookupForbidden);
            const phone = requireNormalizedPhone(rawPhone);
            const customer = await customerRepository.findByPhone(phone);
            if (!customer) throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.notFound);
            return toCustomerDto(caller, customer);
        },

        /**
         * UC2 / API 3: tạo hồ sơ khách (US2). Nhận dữ liệu đã qua validator.
         * QT-01: số đã tồn tại → CONFLICT kèm customer_id của hồ sơ có sẵn (Q8), không tạo mới.
         * Không kiểm trước bằng SELECT: dựa vào UNIQUE của CSDL nên hai yêu cầu đồng thời
         * cùng số vẫn ra CONFLICT, không ra lỗi hệ thống.
         */
        async createCustomer(caller, input) {
            assertRole(caller, CREATE_ROLES, MESSAGES.createForbidden);
            const phone = requireNormalizedPhone(input.phone);

            let created;
            try {
                created = await customerRepository.create({
                    full_name: input.full_name,
                    phone,
                    email: input.email ?? null,
                    address: input.address ?? null,
                });
            } catch (err) {
                if (err instanceof DuplicateKeyError) {
                    const existing = await customerRepository.findByPhone(phone);
                    throw new AppError(
                        ErrorCode.CONFLICT,
                        MESSAGES.phoneTaken,
                        existing ? { customer_id: existing.customer_id } : undefined,
                    );
                }
                throw err;
            }

            return { ...toCustomerDto(caller, created), created_at: toVietnamIsoString(created.created_at) };
        },
    };
}

module.exports = { createCustomerService, MESSAGES };
