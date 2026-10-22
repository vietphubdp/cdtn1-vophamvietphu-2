'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');
const { DuplicateKeyError } = require('../errors/DuplicateKeyError');
const { Role } = require('../domain/constants');
const { assertRole } = require('./assertRole');
const { toVietnamIsoString, toVietnamDateString } = require('./vietnamTime');

// Vai trò gọi được (api-contract mục 1): API 2 cho cả hai vai trò, API 4 chỉ Tiếp nhận.
const LIST_ROLES = [Role.TIEP_NHAN, Role.QUAN_LY_TRUNG_TAM];
const CREATE_ROLES = [Role.TIEP_NHAN];

const MESSAGES = Object.freeze({
    listForbidden: 'Vai trò của bạn không được xem danh sách thiết bị.',
    createForbidden: 'Chỉ nhân viên Tiếp nhận được ghi nhận thiết bị (lúc tiếp nhận yêu cầu bảo hành).',
    customerNotFound: 'Không tìm thấy khách hàng',
    deviceInvalid: 'Thông tin thiết bị chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.',
    productInvalid: 'Sản phẩm không hợp lệ: không có trong danh mục hoặc đã ngừng sử dụng',
    purchaseDateInFuture: 'Ngày mua không được sau ngày hôm nay',
    serialTaken: 'Serial/IMEI đã được ghi nhận cho một thiết bị khác',
});

/**
 * FR4: ngày mua không được ở tương lai, so với ngày hôm nay theo giờ Việt Nam (không theo giờ máy).
 * Ngày mua đúng bằng hôm nay là hợp lệ. Validator gọi chung hàm này để gom lỗi một lần (như D2).
 *
 * @param {string} purchaseDate 'YYYY-MM-DD' đã đúng dạng
 * @param {Date} now
 */
function isPurchaseDateInFuture(purchaseDate, now) {
    return purchaseDate > toVietnamDateString(now);
}

/** Thiết bị vừa tạo trả cho người gọi (api-contract 3.4). */
function toCreatedDeviceDto(device, product) {
    return {
        device_id: device.device_id,
        customer_id: device.customer_id,
        product_id: device.product_id,
        product_name: product.product_name,
        serial_no: device.serial_no,
        purchase_date: device.purchase_date,
        warranty_months: device.warranty_months,
        created_at: toVietnamIsoString(device.created_at),
    };
}

/**
 * DeviceService (sơ đồ kiến trúc): danh sách thiết bị của khách, ghi nhận thiết bị,
 * kiểm serial/IMEI, số tháng theo sản phẩm – QT-03 · FR3, FR4 · UC1, UC3. Tự kiểm vai trò (D3).
 * Khách và thiết bị dùng chung toàn công ty, không lọc theo trung tâm (QT-14).
 *
 * @param {object} deps
 * @param {object} deps.deviceRepository   có listByCustomer, create
 * @param {object} deps.customerRepository có findById
 * @param {object} deps.productRepository  có findById
 */
function createDeviceService({ deviceRepository, customerRepository, productRepository }) {
    async function requireCustomer(customerId) {
        const customer = await customerRepository.findById(customerId);
        if (!customer) throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.customerNotFound);
        return customer;
    }

    /**
     * Kiểm lại các quy tắc cần CSDL hoặc đồng hồ, gom lỗi rồi ném một lần (400):
     * sản phẩm phải có và đang dùng (FR4, HT2); ngày mua không ở tương lai (FR4).
     * Kiểm lại ngày mua dù validator đã kiểm: service không tin dữ liệu từ lớp trên (D2).
     */
    async function requireValidDeviceInput(input, now) {
        const fields = {};
        const product = await productRepository.findById(input.product_id);
        if (!product || !product.is_active) fields.product_id = MESSAGES.productInvalid;
        if (input.purchase_date && isPurchaseDateInFuture(input.purchase_date, now)) {
            fields.purchase_date = MESSAGES.purchaseDateInFuture;
        }
        if (Object.keys(fields).length > 0) {
            throw new AppError(ErrorCode.VALIDATION_FAILED, MESSAGES.deviceInvalid, fields);
        }
        return product;
    }

    return {
        /**
         * API 2 · FR3: thiết bị của khách (tên máy, serial/IMEI, ngày mua) để chọn lập phiếu.
         * Khách không tồn tại → NOT_FOUND; khách chưa có thiết bị → danh sách rỗng.
         * @returns {{ items: object[], total: number }}
         */
        async listByCustomer(caller, customerId) {
            assertRole(caller, LIST_ROLES, MESSAGES.listForbidden);
            await requireCustomer(customerId);
            const items = await deviceRepository.listByCustomer(customerId);
            return { items, total: items.length };
        },

        /**
         * API 4 · UC3 · FR4: ghi nhận thiết bị mới cho khách. Nhận dữ liệu đã qua validator.
         * - `warranty_months` vắng → lấy `default_warranty_months` của sản phẩm (FR4, Q2).
         * - QT-03: serial/IMEI duy nhất toàn hệ thống → trùng thì CONFLICT, kể cả khi serial đã
         *   thuộc chính khách này. Không kiểm trước bằng SELECT: dựa vào UNIQUE của CSDL nên
         *   hai yêu cầu đồng thời cùng serial vẫn ra CONFLICT, không ra lỗi hệ thống.
         *
         * @param {Date} now thời điểm ghi nhận, để so ngày mua với hôm nay (giờ Việt Nam)
         */
        async createDevice(caller, customerId, input, now) {
            assertRole(caller, CREATE_ROLES, MESSAGES.createForbidden);
            await requireCustomer(customerId);
            const product = await requireValidDeviceInput(input, now);

            let created;
            try {
                created = await deviceRepository.create({
                    customer_id: customerId,
                    product_id: product.product_id,
                    serial_no: input.serial_no,
                    purchase_date: input.purchase_date ?? null,
                    warranty_months: input.warranty_months ?? product.default_warranty_months,
                });
            } catch (err) {
                if (err instanceof DuplicateKeyError) throw new AppError(ErrorCode.CONFLICT, MESSAGES.serialTaken);
                throw err;
            }

            return toCreatedDeviceDto(created, product);
        },
    };
}

module.exports = { createDeviceService, isPurchaseDateInFuture, MESSAGES };
