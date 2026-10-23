'use strict';

/**
 * Hàm hiển thị dùng chung cho các trang (không có quy tắc nghiệp vụ).
 * Đọc thẳng chuỗi API trả về (`…+07:00`, `YYYY-MM-DD`), không tạo Date, nên giờ hiển thị
 * luôn là giờ Việt Nam dù máy quầy đặt múi giờ nào.
 * Chạy được trên trình duyệt (window.format) và trong Jest (module.exports).
 */
(function (root) {
    const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
    const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

    // Nhãn hiển thị của các giá trị danh mục trong db/schema.sql.
    const PRIORITY_LABELS = Object.freeze({ CAO: 'Cao', TRUNG_BINH: 'Trung bình', THAP: 'Thấp' });
    const TICKET_STATUS_LABELS = Object.freeze({
        MOI: 'Mới',
        DA_PHAN_CONG: 'Đã phân công',
        DANG_XU_LY: 'Đang xử lý',
        CHO_LINH_KIEN: 'Chờ linh kiện',
        HOAN_TAT: 'Hoàn tất',
        DA_DONG: 'Đã đóng',
        DA_HUY: 'Đã hủy',
    });

    /** '2026-10-12T14:30:00+07:00' → '12/10/2026 14:30'; chuỗi không đúng dạng trả nguyên. */
    function formatDateTime(isoString) {
        const match = DATE_TIME_PATTERN.exec(isoString || '');
        if (!match) return isoString || '';
        const [, year, month, day, hour, minute] = match;
        return `${day}/${month}/${year} ${hour}:${minute}`;
    }

    /** '2026-03-05' → '05/03/2026'; null → '(trống)' như bảng thiết bị M1 của wireframe. */
    function formatDate(dateString) {
        if (dateString === null || dateString === undefined || dateString === '') return '(trống)';
        const match = DATE_PATTERN.exec(dateString);
        if (!match) return dateString;
        const [, year, month, day] = match;
        return `${day}/${month}/${year}`;
    }

    const format = {
        formatDateTime,
        formatDate,
        priorityLabel: (value) => PRIORITY_LABELS[value] || value,
        ticketStatusLabel: (value) => TICKET_STATUS_LABELS[value] || value,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = format;
    else root.format = format;
})(typeof window !== 'undefined' ? window : globalThis);
