'use strict';

const { AppError, ErrorCode } = require('../errors/AppError');
const { DuplicateKeyError } = require('../errors/DuplicateKeyError');
const { Role, Priority, TicketStatus } = require('../domain/constants');
const { assertRole } = require('./assertRole');
const { calculateDueDate } = require('./DueDateCalculator');
const { determineWarrantyStatus } = require('./WarrantyService');
const { toVietnamIsoString, toVietnamDateString } = require('./vietnamTime');

// API 7 chỉ vai trò Tiếp nhận gọi được (api-contract mục 1).
const CREATE_ROLES = [Role.TIEP_NHAN];

// FR8: chưa chọn nhóm sự cố thì mức ưu tiên mặc định là Trung bình.
const PRIORITY_WITHOUT_CATEGORY = Priority.TRUNG_BINH;

// Mã phiếu 'BH' + 6 chữ số + '/' + năm (CHECK ticket_code trong db/schema.sql).
const TICKET_NUMBER_DIGITS = 6;

const MESSAGES = Object.freeze({
    createForbidden: 'Chỉ nhân viên Tiếp nhận được lập phiếu bảo hành.',
    customerNotFound: 'Không tìm thấy khách hàng',
    deviceNotFound: 'Không tìm thấy thiết bị',
    deviceNotOwned: 'Thiết bị không thuộc khách hàng này',
    ticketInvalid: 'Thông tin phiếu chưa hợp lệ. Sửa các trường được đánh dấu rồi gửi lại.',
    categoryInvalid: 'Nhóm sự cố không hợp lệ: không có trong danh mục hoặc đã ngừng sử dụng',
    keyUsedByOtherCenter:
        'Khóa chống trùng (Idempotency-Key) đã được dùng cho một phiếu của trung tâm khác. Tạo khóa mới rồi gửi lại.',
});

/**
 * Mã phiếu dạng BH000123/2026 (Q11): số thứ tự lấy từ một sequence chung, không đánh lại theo năm;
 * phần năm là năm của thời điểm tiếp nhận theo giờ Việt Nam (31/12 lúc 23:30 giờ VN vẫn là năm cũ).
 *
 * @param {number} sequenceNumber giá trị của ticket_code_seq (1–999999)
 * @param {Date} receivedAt
 */
function formatTicketCode(sequenceNumber, receivedAt) {
    const year = toVietnamDateString(receivedAt).slice(0, 4);
    return `BH${String(sequenceNumber).padStart(TICKET_NUMBER_DIGITS, '0')}/${year}`;
}

/** FR8: giữ mức nhân viên chọn; không chọn thì lấy mặc định của nhóm, chưa có nhóm thì Trung bình. */
function resolvePriority(requestedPriority, category) {
    if (requestedPriority) return requestedPriority;
    return category ? category.default_priority : PRIORITY_WITHOUT_CATEGORY;
}

/** Phiếu trả cho người gọi (api-contract 3.7); dùng cho cả lần lập mới và lần gửi lại cùng khóa. */
function toTicketDto(ticket) {
    return {
        ticket_id: ticket.ticket_id,
        ticket_code: ticket.ticket_code,
        customer_id: ticket.customer_id,
        device_id: ticket.device_id,
        center_id: ticket.center_id,
        category_id: ticket.category_id,
        priority: ticket.priority,
        status: ticket.status,
        warranty_status: ticket.warranty_status,
        received_at: toVietnamIsoString(ticket.received_at),
        due_date: toVietnamIsoString(ticket.due_date),
    };
}

/**
 * TicketService (sơ đồ kiến trúc): lập phiếu bảo hành – UC5 · API 7 · FR6–FR9 ·
 * QT-03, QT-04, QT-06 · NFR4. Tự kiểm vai trò (D3).
 *
 * @param {object} deps
 * @param {object} deps.ticketRepository          có nextCodeNumber, create, findByIdempotencyKey
 * @param {object} deps.ticketStatusLogRepository có create
 * @param {object} deps.customerRepository        có findById
 * @param {object} deps.deviceRepository          có findById
 * @param {object} deps.issueCategoryRepository   có findById
 * @param {Function} deps.withTransaction         withTransaction(work): work(tx) chạy trong một giao dịch
 */
function createTicketService({
    ticketRepository,
    ticketStatusLogRepository,
    customerRepository,
    deviceRepository,
    issueCategoryRepository,
    withTransaction,
}) {
    /**
     * Q12: khóa đã có phiếu → cùng trung tâm thì trả phiếu cũ (không so lại body);
     * phiếu của trung tâm khác → CONFLICT, không lộ phiếu đó (QT-14). Chưa có → null.
     */
    async function findReplayedTicket(caller, idempotencyKey) {
        const existing = await ticketRepository.findByIdempotencyKey(idempotencyKey);
        if (!existing) return null;
        if (existing.center_id !== caller.center_id) {
            throw new AppError(ErrorCode.CONFLICT, MESSAGES.keyUsedByOtherCenter);
        }
        return { ticket: toTicketDto(existing), created: false };
    }

    /** QT-03: khách và thiết bị phải tồn tại (404), thiết bị phải thuộc đúng khách này (422). */
    async function requireOwnedDevice(customerId, deviceId) {
        const customer = await customerRepository.findById(customerId);
        if (!customer) throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.customerNotFound);

        const device = await deviceRepository.findById(deviceId);
        if (!device) throw new AppError(ErrorCode.NOT_FOUND, MESSAGES.deviceNotFound);
        if (device.customer_id !== customer.customer_id) {
            throw new AppError(ErrorCode.BUSINESS_RULE_VIOLATION, MESSAGES.deviceNotOwned);
        }
        return device;
    }

    /**
     * FR7 (Q10): không chọn nhóm → null (chưa phân loại). Có chọn thì nhóm phải có và đang dùng,
     * nếu không → VALIDATION_FAILED kèm fields.category_id (400).
     */
    async function resolveCategory(categoryId) {
        if (categoryId === null || categoryId === undefined) return null;
        const category = await issueCategoryRepository.findById(categoryId);
        if (!category || !category.is_active) {
            throw new AppError(ErrorCode.VALIDATION_FAILED, MESSAGES.ticketInvalid, {
                category_id: MESSAGES.categoryInvalid,
            });
        }
        return category;
    }

    /**
     * QT-06 · NFR4: ghi phiếu MOI và dòng lịch sử đầu tiên trong MỘT giao dịch. Lỗi ở bất kỳ bước nào
     * → withTransaction rollback cả hai rồi ném lại, nên không có phiếu thiếu lịch sử.
     * Số thứ tự mã phiếu lấy từ sequence trong cùng giao dịch; sequence không quay lui khi rollback
     * nên mã có thể nhảy số, nhưng không bao giờ trùng.
     */
    async function insertTicketWithFirstLog(ticket, changedBy) {
        return withTransaction(async (tx) => {
            const sequenceNumber = await ticketRepository.nextCodeNumber(tx);
            const created = await ticketRepository.create(
                { ...ticket, ticket_code: formatTicketCode(sequenceNumber, ticket.received_at) },
                tx,
            );
            await ticketStatusLogRepository.create(
                {
                    ticket_id: created.ticket_id,
                    from_status: null, // dòng đầu tiên chưa có trạng thái trước (FR6)
                    to_status: TicketStatus.MOI,
                    changed_at: ticket.received_at,
                    changed_by: changedBy,
                    note: null,
                },
                tx,
            );
            return created;
        });
    }

    return {
        /**
         * API 7 · UC5: lập phiếu bảo hành. Nhận dữ liệu đã qua validator.
         * Mọi giá trị theo thời gian dùng chung một `now` = thời điểm tiếp nhận: received_at,
         * hạn cam kết (QT-04), tình trạng bảo hành (QT-05), năm trong mã phiếu, changed_at của lịch sử.
         * Trung tâm lấy từ JWT của người gọi, không nhận từ body (QT-14).
         *
         * Thứ tự kiểm: vai trò (FORBIDDEN) → khóa đã dùng (Q12) → khách, thiết bị (NOT_FOUND)
         * → thiết bị thuộc khách (BUSINESS_RULE_VIOLATION) → nhóm sự cố (VALIDATION_FAILED).
         *
         * @param {object} caller  { employee_id, role, center_id, ... } từ JWT
         * @param {{ customer_id: number, device_id: number, issue_desc: string,
         *           category_id: number|null, priority: string|null }} input
         * @param {string} idempotencyKey UUID trong header Idempotency-Key (NFR4)
         * @param {Date} now thời điểm tiếp nhận
         * @returns {{ ticket: object, created: boolean }} created = false khi gửi lại cùng khóa
         */
        async createTicket(caller, input, idempotencyKey, now) {
            assertRole(caller, CREATE_ROLES, MESSAGES.createForbidden);

            const replayed = await findReplayedTicket(caller, idempotencyKey);
            if (replayed) return replayed;

            const device = await requireOwnedDevice(input.customer_id, input.device_id);
            const category = await resolveCategory(input.category_id);
            const priority = resolvePriority(input.priority, category);

            const ticket = {
                customer_id: input.customer_id,
                device_id: device.device_id,
                center_id: caller.center_id,
                category_id: category ? category.category_id : null,
                issue_desc: input.issue_desc,
                priority,
                status: TicketStatus.MOI, // QT-06: phiếu mới luôn ở trạng thái MỚI
                // Q3: HET_BAO_HANH = có tính phí, CHUA_XAC_MINH = chờ Quản lý quyết định.
                warranty_status: determineWarrantyStatus(device, now).warranty_status,
                received_at: now,
                due_date: calculateDueDate(now, priority),
                idempotency_key: idempotencyKey,
            };

            try {
                const created = await insertTicketWithFirstLog(ticket, caller.employee_id);
                return { ticket: toTicketDto(created), created: true };
            } catch (err) {
                // Hai yêu cầu cùng khóa gửi đồng thời: lần ghi sau vướng UNIQUE idempotency_key.
                // Đọc lại theo khóa (giao dịch kia đã commit) rồi áp Q12 như lần gửi lại bình thường.
                if (err instanceof DuplicateKeyError) {
                    const replayedAfterRace = await findReplayedTicket(caller, idempotencyKey);
                    if (replayedAfterRace) return replayedAfterRace;
                }
                throw err;
            }
        },
    };
}

module.exports = { createTicketService, formatTicketCode, resolvePriority, MESSAGES };
