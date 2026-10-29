'use strict';

const {
    validateTicketUpdate,
    validateTicketCancel,
    validateWarrantyDecision,
    parseTicketId,
} = require('../../src/presentation/validators/ticketValidator');
const { ErrorCode } = require('../../src/errors/AppError');

// Validator API 19–21 (TĐ-02, TĐ-03): chỉ kiểm định dạng, gom đủ lỗi rồi ném một lần, trả bản đã chuẩn hóa.

function captureError(fn) {
    try {
        fn();
    } catch (err) {
        return err;
    }
    throw new Error('Mong đợi ném lỗi nhưng không có lỗi');
}

describe('validateTicketUpdate (API 19)', () => {
    test('QT-16 luồng đúng: chỉ trả các trường được gửi, mô tả và lý do đã bỏ khoảng trắng đầu cuối', () => {
        expect(validateTicketUpdate({ issue_desc: '  Màn hình bị sọc xanh  ', reason: '  Ghi thiếu  ' })).toEqual({
            issue_desc: 'Màn hình bị sọc xanh',
            reason: 'Ghi thiếu',
        });
    });

    test('FR7 luồng đúng: category_id null nghĩa là bỏ phân loại', () => {
        expect(validateTicketUpdate({ category_id: null, reason: 'Chọn nhầm nhóm' })).toEqual({ category_id: null, reason: 'Chọn nhầm nhóm' });
    });

    test('QT-16 giá trị biên: lý do đúng 5 ký tự hợp lệ, 4 ký tự bị từ chối', () => {
        expect(validateTicketUpdate({ priority: 'CAO', reason: 'abcde' }).reason).toBe('abcde');
        const err = captureError(() => validateTicketUpdate({ priority: 'CAO', reason: 'abcd' }));
        expect(err.details).toEqual({ reason: 'Lý do phải có từ 5 đến 255 ký tự' });
    });

    test('QT-16 dữ liệu sai: không gửi trường nào để sửa và thiếu lý do → gom cả hai lỗi một lần', () => {
        const err = captureError(() => validateTicketUpdate({ customer_id: 1025 }));

        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details).sort()).toEqual(['body', 'reason']);
    });

    test('FR8 dữ liệu sai: priority null, mô tả quá ngắn, thiết bị không phải số → báo đủ từng trường', () => {
        const err = captureError(() => validateTicketUpdate({ priority: null, issue_desc: 'hỏng', device_id: '3311', reason: 'Sửa lại cho đúng' }));

        expect(Object.keys(err.details).sort()).toEqual(['device_id', 'issue_desc', 'priority']);
    });
});

describe('validateTicketCancel, validateWarrantyDecision (API 20, 21)', () => {
    test('QT-06 luồng đúng: lý do hủy đã bỏ khoảng trắng', () => {
        expect(validateTicketCancel({ reason: '  Khách đổi ý  ' })).toEqual({ reason: 'Khách đổi ý' });
    });

    test('QT-06 dữ liệu sai: thiếu lý do hủy → 400 fields.reason', () => {
        const err = captureError(() => validateTicketCancel({}));
        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(Object.keys(err.details)).toEqual(['reason']);
    });

    test('QT-17 dữ liệu sai: không được chọn lại Chưa xác minh, thiếu lý do → gom hai lỗi', () => {
        const err = captureError(() => validateWarrantyDecision({ warranty_status: 'CHUA_XAC_MINH' }));
        expect(Object.keys(err.details).sort()).toEqual(['reason', 'warranty_status']);
    });

    test('QT-17 luồng đúng: chọn Hết bảo hành kèm lý do', () => {
        expect(validateWarrantyDecision({ warranty_status: 'HET_BAO_HANH', reason: 'Hóa đơn quá 12 tháng' })).toEqual({
            warranty_status: 'HET_BAO_HANH',
            reason: 'Hóa đơn quá 12 tháng',
        });
    });
});

describe('parseTicketId', () => {
    test('luồng đúng: "88231" → 88231; dữ liệu sai: "0", "abc" → NOT_FOUND', () => {
        expect(parseTicketId('88231')).toBe(88231);
        expect(captureError(() => parseTicketId('0')).code).toBe(ErrorCode.NOT_FOUND);
        expect(captureError(() => parseTicketId('abc')).code).toBe(ErrorCode.NOT_FOUND);
    });
});
