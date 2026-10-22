'use strict';

// Dạng chuẩn của số điện thoại: 10 chữ số, bắt đầu bằng 0 (khớp CHECK của customer.phone).
const NORMALIZED_PHONE_PATTERN = /^0[0-9]{9}$/;

// Ký tự phân cách được bỏ đi: chỉ dấu cách và dấu chấm (D10). Gạch ngang, ngoặc giữ lại
// để kết quả không khớp dạng chuẩn và bị từ chối.
const SEPARATORS = /[ .]/g;

// +84 hoặc 84 ở đầu, theo sau đúng 9 chữ số → thay tiền tố bằng 0.
const COUNTRY_CODE_PREFIX = /^\+?84(?=[0-9]{9}$)/;

// Thông báo lỗi trường `phone`, dùng chung cho validator và CustomerService (api-contract 3.1).
const PHONE_INVALID_MESSAGE =
    'Phải đủ 10 chữ số, bắt đầu bằng 0 sau khi chuẩn hóa (chấp nhận +84, 84, dấu cách, dấu chấm)';

/**
 * QT-02: chuẩn hóa số điện thoại về 10 chữ số bắt đầu bằng 0 (api-contract mục 5, D10).
 * Thứ tự: bỏ dấu cách, dấu chấm → đổi tiền tố +84/84 thành 0 → phải khớp ^0[0-9]{9}$.
 * Hàm thuần, dùng chung cho validator (gom lỗi một lần, D2) và CustomerService (chuẩn hóa lại
 * trước khi tra/lưu).
 *
 * @param {unknown} raw số người dùng nhập
 * @returns {string|null} số đã chuẩn hóa, hoặc null nếu không hợp lệ
 *
 * @example normalizePhone('+84 90 123 4567') // '0901234567'
 * @example normalizePhone('0901-234-567')    // null
 */
function normalizePhone(raw) {
    if (typeof raw !== 'string') return null;
    const normalized = raw.replace(SEPARATORS, '').replace(COUNTRY_CODE_PREFIX, '0');
    return NORMALIZED_PHONE_PATTERN.test(normalized) ? normalized : null;
}

module.exports = { normalizePhone, PHONE_INVALID_MESSAGE };
