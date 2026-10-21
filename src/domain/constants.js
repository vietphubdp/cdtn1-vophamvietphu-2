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

const WarrantyStatus = Object.freeze({
    CON_BAO_HANH: 'CON_BAO_HANH',
    HET_BAO_HANH: 'HET_BAO_HANH',
    CHUA_XAC_MINH: 'CHUA_XAC_MINH',
});

module.exports = { Role, RoleLabel, Priority, TicketStatus, WarrantyStatus };
