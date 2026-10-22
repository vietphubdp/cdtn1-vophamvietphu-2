'use strict';

const { Role } = require('../domain/constants');

// Giữ 3 số đầu và 3 số cuối, che 4 số giữa: 0901234567 → 090****567 (NFR2).
const VISIBLE_HEAD = 3;
const VISIBLE_TAIL = 3;
const MASK = '****';

/**
 * QT-15: che số điện thoại dạng chuẩn 10 chữ số. Hàm thuần, không đọc/ghi dữ liệu.
 * @param {string} phone số đã chuẩn hóa (QT-02)
 * @returns {string} ví dụ '090****567'
 */
function maskPhone(phone) {
    return phone.slice(0, VISIBLE_HEAD) + MASK + phone.slice(-VISIBLE_TAIL);
}

/**
 * QT-15: số điện thoại trả cho người gọi. Chỉ Quản lý trung tâm thấy số đầy đủ
 * (vai trò Ban giám đốc ngoài phạm vi L2); mọi vai trò khác nhận dạng che.
 *
 * @param {object} caller { role, ... } lấy từ JWT
 * @param {string} phone  số đã chuẩn hóa
 */
function phoneForCaller(caller, phone) {
    return caller && caller.role === Role.QUAN_LY_TRUNG_TAM ? phone : maskPhone(phone);
}

module.exports = { maskPhone, phoneForCaller };
