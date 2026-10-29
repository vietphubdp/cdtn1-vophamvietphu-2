'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');
const { Role, TicketStatus, TicketStatusLabel, WarrantyStatus } = require('../domain/constants');
const { assertRole } = require('./assertRole');
const { calculateDueDate } = require('./DueDateCalculator');
const { determineWarrantyStatus } = require('./WarrantyService');
const { toTicketDto } = require('./TicketService');
const { toVietnamIsoString } = require('./vietnamTime');

// API 19: cả hai vai trò sửa được phiếu của trung tâm mình (TĐ-02).
const EDIT_ROLES = [Role.TIEP_NHAN, Role.QUAN_LY_TRUNG_TAM];
// API 20, 21: chỉ Quản lý trung tâm (TĐ-03).
const MANAGER_ROLES = [Role.QUAN_LY_TRUNG_TAM];

// QT-16: chỉ sửa được phiếu còn MỚI; phiếu đã chuyển bước sau thuộc luồng L4, L5.
const EDITABLE_STATUSES = [TicketStatus.MOI];
// QT-06 (Hình 6.2 case study): khách hủy khi phiếu MỚI hoặc ĐÃ PHÂN CÔNG.
const CANCELLABLE_STATUSES = [TicketStatus.MOI, TicketStatus.DA_PHAN_CONG];

const MESSAGES = Object.freeze({
    editForbidden: 'Bạn không có quyền sửa phiếu bảo hành.',
    managerOnly: 'Chỉ Quản lý trung tâm được hủy phiếu và quyết định bảo hành.',
    ticketNotFound: 'Không tìm thấy phiếu bảo hành trong trung tâm của bạn',
    deviceNotFound: 'Không tìm thấy thiết bị',
    deviceNotOwned: 'Thiết bị không thuộc khách hàng của phiếu này',
    ticketInvalid: 'Thông tin phiếu chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.',
    categoryInvalid: 'Nhóm sự cố không hợp lệ: không có trong danh mục hoặc đã ngừng sử dụng',
    noChanges: 'Không có thay đổi nào so với phiếu hiện tại. Sửa ít nhất một trường rồi lưu lại.',
    warrantyAlreadyDecided: 'Phiếu này đã có tình trạng bảo hành, không còn chờ quyết định.',
    ticketCancelled: 'Phiếu đã hủy, không quyết định bảo hành được nữa.',
});

function statusLabel(status) {
    return TicketStatusLabel[status] || status;
}

function isOwnCenter(caller, ticket) {
    return Boolean(caller) && ticket.center_id === caller.center_id;
}

/** QT-16: người gọi có sửa được phiếu này không. Hàm thuần, dùng chung cho API 19 và cờ can_edit của API 18. */
function canEditTicket(caller, ticket) {
    return isOwnCenter(caller, ticket) && EDIT_ROLES.includes(caller.role) && EDITABLE_STATUSES.includes(ticket.status);
}

/** QT-06: Quản lý hủy được phiếu MỚI hoặc ĐÃ PHÂN CÔNG của trung tâm mình (cờ can_cancel). */
function canCancelTicket(caller, ticket) {
    return isOwnCenter(caller, ticket) && MANAGER_ROLES.includes(caller.role) && CANCELLABLE_STATUSES.includes(ticket.status);
}

/** QT-17: Quản lý quyết định được khi phiếu chưa hủy và đang chờ xác minh bảo hành (cờ can_decide_warranty). */
function canDecideWarranty(caller, ticket) {
    return (
        isOwnCenter(caller, ticket) &&
        MANAGER_ROLES.includes(caller.role) &&
        ticket.status !== TicketStatus.DA_HUY &&
        ticket.warranty_status === WarrantyStatus.CHUA_XAC_MINH
    );
}

/** 7 cột được phép đổi sau khi lập (TicketRepository.update). */
function editableColumns(ticket) {
    return {
        device_id: ticket.device_id,
        category_id: ticket.category_id,
        issue_desc: ticket.issue_desc,
        priority: ticket.priority,
        status: ticket.status,
        warranty_status: ticket.warranty_status,
        due_date: ticket.due_date,
    };
}

/**
 * TicketUpdateService: sửa phiếu (QT-16), hủy phiếu (QT-06), quyết định bảo hành (QT-17) – API 19–21.
 * Mỗi thao tác chạy trong MỘT giao dịch: khóa dòng phiếu, kiểm quy tắc, ghi phiếu và ghi lịch sử;
 * lỗi ở bất kỳ bước nào thì không có gì được lưu. Tự kiểm vai trò (D3).
 *
 * @param {object} deps
 * @param {object} deps.ticketRepository          có findByIdForUpdate, update
 * @param {object} deps.ticketStatusLogRepository có create
 * @param {object} deps.ticketEditLogRepository   có create
 * @param {object} deps.deviceRepository          có findById
 * @param {object} deps.issueCategoryRepository   có findById
 * @param {Function} deps.withTransaction
 */
function createTicketUpdateService({
    ticketRepository,
    ticketStatusLogRepository,
    ticketEditLogRepository,
    deviceRepository,
    issueCategoryRepository,
    withTransaction,
}) {
    /**
     * QT-14: phiếu không có hoặc thuộc trung tâm khác đều trả NOT_FOUND, không để lộ phiếu của trung tâm khác.
     * Đọc kèm khóa dòng (FOR UPDATE) nên hai người thao tác cùng phiếu sẽ lần lượt, không ghi đè nhau.
     */
    async function requireOwnTicket(caller, ticketId, tx) {
        const ticket = await ticketRepository.findByIdForUpdate(ticketId, tx);
        if (!ticket || !isOwnCenter(caller, ticket)) {
            throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.ticketNotFound);
        }
        return ticket;
    }

    /** QT-03: thiết bị mới phải tồn tại (404) và thuộc đúng khách của phiếu (422). */
    async function requireDeviceOfCustomer(deviceId, customerId, tx) {
        const device = await deviceRepository.findById(deviceId, tx);
        if (!device) throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.deviceNotFound);
        if (device.customer_id !== customerId) {
            throw new AppError(ErrorCode.BUSINESS_RULE_VIOLATION, MESSAGES.deviceNotOwned);
        }
        return device;
    }

    /** FR7: nhóm mới phải có và đang dùng (400 fields.category_id); null = bỏ phân loại. */
    async function resolveNewCategory(categoryId, tx) {
        if (categoryId === null) return null;
        const category = await issueCategoryRepository.findById(categoryId, tx);
        if (!category || !category.is_active) {
            throw new AppError(ErrorCode.VALIDATION_FAILED, MESSAGES.ticketInvalid, {
                category_id: MESSAGES.categoryInvalid,
            });
        }
        return category;
    }

    async function categoryNameOf(categoryId, tx) {
        if (categoryId === null) return null;
        const category = await issueCategoryRepository.findById(categoryId, tx);
        return category ? category.category_name : null;
    }

    /**
     * Áp các trường người dùng gửi lên phiếu hiện tại, kèm các giá trị suy ra:
     * đổi thiết bị → tính lại tình trạng bảo hành tại thời điểm tiếp nhận (QT-05);
     * đổi mức ưu tiên → tính lại hạn cam kết từ thời điểm tiếp nhận (QT-04).
     * Trả { next, changes }: changes ghi theo tên hiển thị (serial, tên nhóm…) để lịch sử đọc được
     * kể cả khi danh mục đổi tên về sau.
     */
    async function applyEdits(ticket, input, tx) {
        const next = editableColumns(ticket);
        const changes = {};
        const record = (field, from, to) => {
            if (from !== to) changes[field] = { from, to };
        };

        if (input.device_id !== undefined && input.device_id !== ticket.device_id) {
            const device = await requireDeviceOfCustomer(input.device_id, ticket.customer_id, tx);
            const oldDevice = await deviceRepository.findById(ticket.device_id, tx);
            next.device_id = device.device_id;
            next.warranty_status = determineWarrantyStatus(device, ticket.received_at).warranty_status;
            record('serial_no', oldDevice ? oldDevice.serial_no : null, device.serial_no);
            record('warranty_status', ticket.warranty_status, next.warranty_status);
        }

        if (input.issue_desc !== undefined) {
            next.issue_desc = input.issue_desc;
            record('issue_desc', ticket.issue_desc, next.issue_desc);
        }

        if (input.category_id !== undefined && input.category_id !== ticket.category_id) {
            const category = await resolveNewCategory(input.category_id, tx);
            next.category_id = category ? category.category_id : null;
            record('category_name', await categoryNameOf(ticket.category_id, tx), category ? category.category_name : null);
        }

        if (input.priority !== undefined && input.priority !== ticket.priority) {
            next.priority = input.priority;
            next.due_date = calculateDueDate(ticket.received_at, input.priority);
            record('priority', ticket.priority, next.priority);
            record('due_date', toVietnamIsoString(ticket.due_date), toVietnamIsoString(next.due_date));
        }

        return { next, changes };
    }

    return {
        /**
         * API 19 · QT-16: sửa thiết bị, mô tả lỗi, nhóm sự cố, mức ưu tiên của phiếu còn MỚI, bắt buộc có lý do.
         * Mã phiếu, khách hàng, trung tâm, thời điểm tiếp nhận không bao giờ đổi.
         *
         * Thứ tự kiểm: vai trò (FORBIDDEN) → phiếu của trung tâm mình (NOT_FOUND) → còn MỚI (BUSINESS_RULE_VIOLATION)
         * → thiết bị (NOT_FOUND / BUSINESS_RULE_VIOLATION QT-03) → nhóm sự cố (VALIDATION_FAILED)
         * → có thay đổi thật (BUSINESS_RULE_VIOLATION).
         *
         * @param {object} caller
         * @param {number} ticketId
         * @param {{ device_id?: number, issue_desc?: string, category_id?: number|null,
         *           priority?: string, reason: string }} input đã qua validator; chỉ có các trường được gửi
         * @param {Date} now thời điểm sửa, ghi vào lịch sử
         */
        async updateTicket(caller, ticketId, input, now) {
            assertRole(caller, EDIT_ROLES, MESSAGES.editForbidden);

            return withTransaction(async (tx) => {
                const ticket = await requireOwnTicket(caller, ticketId, tx);
                if (!EDITABLE_STATUSES.includes(ticket.status)) {
                    throw new AppError(
                        ErrorCode.BUSINESS_RULE_VIOLATION,
                        `Chỉ sửa được phiếu đang ở trạng thái Mới; phiếu này đang ở trạng thái "${statusLabel(ticket.status)}".`,
                    );
                }

                const { next, changes } = await applyEdits(ticket, input, tx);
                if (Object.keys(changes).length === 0) {
                    throw new AppError(ErrorCode.BUSINESS_RULE_VIOLATION, MESSAGES.noChanges);
                }

                const updated = await ticketRepository.update(ticket.ticket_id, next, tx);
                await ticketEditLogRepository.create(
                    { ticket_id: ticket.ticket_id, changed_at: now, changed_by: caller.employee_id, changes, reason: input.reason },
                    tx,
                );
                return toTicketDto(updated);
            });
        },

        /**
         * API 20 · QT-06: Quản lý hủy phiếu theo yêu cầu của khách. Chỉ từ MỚI hoặc ĐÃ PHÂN CÔNG sang ĐÃ HỦY
         * (Hình 6.2), ghi một dòng lịch sử trạng thái với lý do ở cột note. Không xóa phiếu (QT-13).
         */
        async cancelTicket(caller, ticketId, { reason }, now) {
            assertRole(caller, MANAGER_ROLES, MESSAGES.managerOnly);

            return withTransaction(async (tx) => {
                const ticket = await requireOwnTicket(caller, ticketId, tx);
                if (!CANCELLABLE_STATUSES.includes(ticket.status)) {
                    throw new AppError(
                        ErrorCode.BUSINESS_RULE_VIOLATION,
                        `Chỉ hủy được phiếu đang ở trạng thái Mới hoặc Đã phân công; phiếu này đang ở trạng thái "${statusLabel(ticket.status)}".`,
                    );
                }

                const updated = await ticketRepository.update(
                    ticket.ticket_id,
                    { ...editableColumns(ticket), status: TicketStatus.DA_HUY },
                    tx,
                );
                await ticketStatusLogRepository.create(
                    {
                        ticket_id: ticket.ticket_id,
                        from_status: ticket.status,
                        to_status: TicketStatus.DA_HUY,
                        changed_at: now,
                        changed_by: caller.employee_id,
                        note: reason,
                    },
                    tx,
                );
                return toTicketDto(updated);
            });
        },

        /**
         * API 21 · QT-17: Quản lý quyết định phiếu "chưa xác minh bảo hành" là còn bảo hành (miễn phí)
         * hay hết bảo hành (có tính phí), bắt buộc có lý do; ghi vào lịch sử sửa phiếu.
         *
         * @param {{ warranty_status: 'CON_BAO_HANH'|'HET_BAO_HANH', reason: string }} input đã qua validator
         */
        async decideWarranty(caller, ticketId, input, now) {
            assertRole(caller, MANAGER_ROLES, MESSAGES.managerOnly);

            return withTransaction(async (tx) => {
                const ticket = await requireOwnTicket(caller, ticketId, tx);
                if (ticket.status === TicketStatus.DA_HUY) {
                    throw new AppError(ErrorCode.BUSINESS_RULE_VIOLATION, MESSAGES.ticketCancelled);
                }
                if (ticket.warranty_status !== WarrantyStatus.CHUA_XAC_MINH) {
                    throw new AppError(ErrorCode.BUSINESS_RULE_VIOLATION, MESSAGES.warrantyAlreadyDecided);
                }

                const updated = await ticketRepository.update(
                    ticket.ticket_id,
                    { ...editableColumns(ticket), warranty_status: input.warranty_status },
                    tx,
                );
                await ticketEditLogRepository.create(
                    {
                        ticket_id: ticket.ticket_id,
                        changed_at: now,
                        changed_by: caller.employee_id,
                        changes: { warranty_status: { from: ticket.warranty_status, to: input.warranty_status } },
                        reason: input.reason,
                    },
                    tx,
                );
                return toTicketDto(updated);
            });
        },
    };
}

module.exports = { createTicketUpdateService, canEditTicket, canCancelTicket, canDecideWarranty, MESSAGES };
