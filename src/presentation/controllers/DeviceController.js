'use strict';

const { validateDeviceCreate, parseCustomerId, parseDeviceId } = require('../validators/deviceValidator');

/** API 2, 4, 5 (US1, US3, US4): chỉ dịch HTTP ↔ DeviceService, WarrantyService. Lỗi chuyển cho ErrorMapper. */
function createDeviceController({ deviceService, warrantyService, now }) {
    return {
        /** GET /api/customers/{id}/devices → 200 { items, total } (api-contract 3.2). */
        async listByCustomer(req, res) {
            const customerId = parseCustomerId(req.params.id);
            res.status(200).json(await deviceService.listByCustomer(req.caller, customerId));
        },

        /** POST /api/customers/{id}/devices → 201 thiết bị vừa ghi nhận (api-contract 3.4). */
        async create(req, res) {
            const customerId = parseCustomerId(req.params.id);
            const requestTime = now();
            const input = validateDeviceCreate(req.body, requestTime);
            res.status(201).json(await deviceService.createDevice(req.caller, customerId, input, requestTime));
        },

        /** GET /api/devices/{id}/warranty → 200 tình trạng bảo hành tại thời điểm gọi (api-contract 3.5). */
        async getWarranty(req, res) {
            const deviceId = parseDeviceId(req.params.id);
            res.status(200).json(await warrantyService.getWarranty(req.caller, deviceId, now()));
        },
    };
}

module.exports = { createDeviceController };
