'use strict';

// Giá trị danh mục giữ đúng như CHECK trong db/schema.sql.

const Role = Object.freeze({
    TIEP_NHAN: 'TIEP_NHAN',
    QUAN_LY_TRUNG_TAM: 'QUAN_LY_TRUNG_TAM',
});

// Tên vai trò hiển thị trên thanh tiêu đề (wireframe: "Trần Thị Lan (Tiếp nhận)").
const RoleLabel = Object.freeze({
    [Role.TIEP_NHAN]: 'Tiếp nhận',
    [Role.QUAN_LY_TRUNG_TAM]: 'Quản lý trung tâm',
});

const Priority = Object.freeze({
    CAO: 'CAO',
    TRUNG_BINH: 'TRUNG_BINH',
    THAP: 'THAP',
});

const TicketStatus = Object.freeze({
    MOI: 'MOI',
    DA_PHAN_CONG: 'DA_PHAN_CONG',
    DANG_XU_LY: 'DANG_XU_LY',
    CHO_LINH_KIEN: 'CHO_LINH_KIEN',
    HOAN_TAT: 'HOAN_TAT',
    DA_DONG: 'DA_DONG',
    DA_HUY: 'DA_HUY',
});

// Tên trạng thái trong thông báo lỗi của service (khớp nhãn hiển thị ở public/js/format.js).
const TicketStatusLabel = Object.freeze({
    [TicketStatus.MOI]: 'Mới',
    [TicketStatus.DA_PHAN_CONG]: 'Đã phân công',
    [TicketStatus.DANG_XU_LY]: 'Đang xử lý',
    [TicketStatus.CHO_LINH_KIEN]: 'Chờ linh kiện',
    [TicketStatus.HOAN_TAT]: 'Hoàn tất',
    [TicketStatus.DA_DONG]: 'Đã đóng',
    [TicketStatus.DA_HUY]: 'Đã hủy',
});

const WarrantyStatus = Object.freeze({
    CON_BAO_HANH: 'CON_BAO_HANH',
    HET_BAO_HANH: 'HET_BAO_HANH',
    CHUA_XAC_MINH: 'CHUA_XAC_MINH',
});

// Số tháng bảo hành mặc định khi thêm sản phẩm mà không gửi default_warranty_months
// (api-contract mục 5, khớp DEFAULT 12 của cột product.default_warranty_months).
const DEFAULT_WARRANTY_MONTHS = 12;

// Giới hạn số tháng bảo hành (CHECK ... BETWEEN 1 AND 60 trong db/schema.sql).
const WARRANTY_MONTHS_MIN = 1;
const WARRANTY_MONTHS_MAX = 60;

module.exports = {
    Role,
    RoleLabel,
    Priority,
    TicketStatus,
    TicketStatusLabel,
    WarrantyStatus,
    DEFAULT_WARRANTY_MONTHS,
    WARRANTY_MONTHS_MIN,
    WARRANTY_MONTHS_MAX,
};
