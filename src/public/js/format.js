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
    const DISPLAY_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

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
    // Nhãn tình trạng bảo hành trên bảng M3, đúng câu chữ wireframe (QT-05, US4-AC2, AC3).
    const WARRANTY_STATUS_LABELS = Object.freeze({
        CON_BAO_HANH: 'Còn bảo hành',
        HET_BAO_HANH: 'Hết bảo hành (có tính phí)',
        CHUA_XAC_MINH: 'Chưa xác minh bảo hành (chờ quản lý)',
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

    /**
     * Ngày mua gõ trên form M2 → giá trị gửi API 4.
     * '05/03/2026', '5/3/2026' → '2026-03-05'; để trống → null (khách không nhớ ngày mua, US4-AC3).
     * Không đúng dạng dd/mm/yyyy thì gửi nguyên chuỗi để API báo lỗi trường purchase_date;
     * ngày không có thật (31/02/2026) và ngày ở tương lai cũng do API kiểm, giao diện không lặp lại quy tắc.
     */
    function toApiDate(displayDate) {
        const text = (displayDate || '').trim();
        if (text === '') return null;
        const match = DISPLAY_DATE_PATTERN.exec(text);
        if (!match) return text;
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const format = {
        formatDateTime,
        formatDate,
        toApiDate,
        warrantyStatusLabel: (value) => WARRANTY_STATUS_LABELS[value] || value,
        priorityLabel: (value) => PRIORITY_LABELS[value] || value,
        ticketStatusLabel: (value) => TICKET_STATUS_LABELS[value] || value,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = format;
    else root.format = format;
})(typeof window !== 'undefined' ? window : globalThis);
