'use strict';

const { validateTicketCreate, MESSAGES } = require('../../src/presentation/validators/ticketValidator');
const { ErrorCode } = require('../../src/errors/AppError');

// Unit test validator lập phiếu (api-contract mục 5, D7, D8): chỉ kiểm định dạng, gom đủ lỗi một lần.

const KEY = '7f3c2a10-9b4e-4c1d-8a2f-5e6d7c8b9a01';
const BODY = Object.freeze({
    customer_id: 1024,
    device_id: 3311,
    issue_desc: 'Máy không nhận sạc, cắm sạc báo lỗi phụ kiện',
    category_id: 3,
    priority: 'TRUNG_BINH',
});

/** Lỗi theo trường; không truyền `key` thì dùng KEY hợp lệ (truyền `undefined` = thiếu header). */
function fieldsOf(body, ...keyArg) {
    const key = keyArg.length > 0 ? keyArg[0] : KEY;
    try {
        validateTicketCreate(body, key);
    } catch (err) {
        expect(err.code).toBe(ErrorCode.VALIDATION_FAILED);
        return err.details;
    }
    return {};
}

describe('ticketValidator – lập phiếu (API 7)', () => {
    test('FR6 luồng đúng: body hợp lệ → trả dữ liệu đã chuẩn hóa và khóa chống trùng', () => {
        expect(validateTicketCreate(BODY, KEY)).toEqual({ input: { ...BODY }, idempotencyKey: KEY });
    });

    test('TĐ-07 luồng đúng: bỏ qua warranty_status, center_id, status gửi kèm body', () => {
        const { input } = validateTicketCreate({ ...BODY, warranty_status: 'CON_BAO_HANH', center_id: 5, status: 'HOAN_TAT' }, KEY);

        expect(Object.keys(input).sort()).toEqual(['category_id', 'customer_id', 'device_id', 'issue_desc', 'priority']);
    });

    test('US5-AC2 dữ liệu sai: thiếu mô tả, mô tả rỗng hoặc toàn khoảng trắng → issue_desc', () => {
        for (const issueDesc of [undefined, null, '', '            ', 1234567890]) {
            expect(fieldsOf({ ...BODY, issue_desc: issueDesc })).toEqual({ issue_desc: MESSAGES.issue_desc });
        }
        expect(MESSAGES.issue_desc).toBe('Mô tả lỗi phải có từ 10 đến 2000 ký tự');
    });

    test('US5-AC2 giá trị biên: mô tả 9 ký tự bị từ chối, 10 ký tự được', () => {
        expect(fieldsOf({ ...BODY, issue_desc: 'Hỏng loa!' })).toEqual({ issue_desc: MESSAGES.issue_desc });
        expect(validateTicketCreate({ ...BODY, issue_desc: 'Hỏng loa 1' }, KEY).input.issue_desc).toBe('Hỏng loa 1');
    });

    test('US5-AC2 giá trị biên: mô tả 2000 ký tự được, 2001 ký tự bị từ chối', () => {
        expect(validateTicketCreate({ ...BODY, issue_desc: 'a'.repeat(2000) }, KEY).input.issue_desc).toHaveLength(2000);
        expect(fieldsOf({ ...BODY, issue_desc: 'a'.repeat(2001) })).toEqual({ issue_desc: MESSAGES.issue_desc });
    });

    test('D8 giá trị biên: cắt khoảng trắng đầu cuối rồi mới đếm – 9 ký tự kèm dấu cách bị từ chối; lưu bản đã cắt', () => {
        expect(fieldsOf({ ...BODY, issue_desc: '   Hỏng loa!   ' })).toEqual({ issue_desc: MESSAGES.issue_desc });
        expect(validateTicketCreate({ ...BODY, issue_desc: '  Hỏng loa 1 \n' }, KEY).input.issue_desc).toBe('Hỏng loa 1');
    });

    test('D7 luồng đúng: category_id, priority vắng hoặc null → null (service lấy mặc định)', () => {
        const { customer_id, device_id, issue_desc } = BODY;
        expect(validateTicketCreate({ customer_id, device_id, issue_desc }, KEY).input).toMatchObject({ category_id: null, priority: null });
        expect(validateTicketCreate({ ...BODY, category_id: null, priority: null }, KEY).input).toMatchObject({ category_id: null, priority: null });
    });

    test('D7 dữ liệu sai: priority chuỗi rỗng, viết thường hoặc giá trị lạ → priority', () => {
        for (const priority of ['', 'cao', 'KHAN_CAP', 1]) {
            expect(fieldsOf({ ...BODY, priority })).toEqual({ priority: MESSAGES.priority });
        }
    });

    test('D7 dữ liệu sai: category_id chuỗi rỗng, chuỗi số, 0, số lẻ, vượt kiểu INT → category_id', () => {
        for (const categoryId of ['', '3', 0, -1, 2.5, 2147483648]) {
            expect(fieldsOf({ ...BODY, category_id: categoryId })).toEqual({ category_id: MESSAGES.category_id });
        }
        expect(validateTicketCreate({ ...BODY, category_id: 2147483647 }, KEY).input.category_id).toBe(2147483647);
    });

    test('FR6 dữ liệu sai: customer_id, device_id thiếu hoặc không phải số nguyên dương', () => {
        for (const id of [undefined, null, '1024', 0, -5, 1.5]) {
            expect(fieldsOf({ ...BODY, customer_id: id, device_id: id })).toEqual({
                customer_id: MESSAGES.customer_id,
                device_id: MESSAGES.device_id,
            });
        }
    });

    test('NFR4 dữ liệu sai: thiếu hoặc sai dạng Idempotency-Key → idempotency_key', () => {
        for (const key of [undefined, '', 'abc', `${KEY}, ${KEY}`, KEY.replace(/-/g, '')]) {
            expect(fieldsOf(BODY, key)).toEqual({ idempotency_key: MESSAGES.idempotency_key });
        }
    });

    test('NFR4 giá trị biên: Idempotency-Key viết hoa vẫn hợp lệ, đổi về chữ thường', () => {
        expect(validateTicketCreate(BODY, KEY.toUpperCase()).idempotencyKey).toBe(KEY);
    });

    test('FR6 dữ liệu sai: body rỗng, không có khóa → gom đủ lỗi các trường bắt buộc trong một lần', () => {
        for (const body of [{}, null, [], 'abc']) {
            expect(Object.keys(fieldsOf(body, undefined)).sort()).toEqual(['customer_id', 'device_id', 'idempotency_key', 'issue_desc']);
        }
    });
});
