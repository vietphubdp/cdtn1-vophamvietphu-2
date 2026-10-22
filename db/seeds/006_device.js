'use strict';

// 30 thiết bị giả lập (D6), đủ 3 trường hợp bảo hành cho giai đoạn 4–5 (QT-05):
//   CON  – hết hạn sớm nhất 03/2027: còn bảo hành suốt thời gian chấm BT2;
//   HET  – hết hạn muộn nhất 06/2026: đã hết bảo hành;
//   NULL – không có ngày mua: chưa xác minh.
// Nhãn `case` chỉ để người đọc đối chiếu, không ghi vào CSDL; tình trạng thật do
// WarrantyService tính (test "dữ liệu seed khớp nhãn" trong tests/services/WarrantyService.test.js).
// Khách và sản phẩm tra theo cột UNIQUE (phone, product_name) nên không phụ thuộc mã tự tăng.
const { CUSTOMERS } = require('./005_customer');
const { PRODUCTS } = require('./003_product');

const DEVICES = [
    // Ví dụ api-contract mục 3.2 và US4-AC1/AC2: mua 05/03/2026 + 12 tháng → còn đến hết 05/03/2027.
    { phone: '0901234567', product_name: 'Samsung Galaxy A52', serial_no: 'SN-A52-778901', purchase_date: '2026-03-05', warranty_months: 12, case: 'CON' },
    { phone: '0901234567', product_name: 'iPhone 13', serial_no: '358240051111110', purchase_date: null, warranty_months: 12, case: 'NULL' },
    { phone: '0912345678', product_name: 'iPhone 15', serial_no: '356789104422331', purchase_date: '2026-05-18', warranty_months: 12, case: 'CON' },
    { phone: '0912345678', product_name: 'Oppo A18', serial_no: 'OPA18-20931', purchase_date: '2024-02-10', warranty_months: 12, case: 'HET' },
    { phone: '0923456789', product_name: 'Samsung Galaxy S24', serial_no: 'R5CX30AB12K', purchase_date: '2025-04-22', warranty_months: 24, case: 'CON' },
    { phone: '0934567890', product_name: 'Xiaomi Redmi Note 13', serial_no: 'XMRN13-660172', purchase_date: '2026-07-01', warranty_months: 18, case: 'CON' },
    { phone: '0934567890', product_name: 'vivo Y17s', serial_no: 'VVY17S-118340', purchase_date: null, warranty_months: 12, case: 'NULL' },
    { phone: '0945678901', product_name: 'Samsung Galaxy A06', serial_no: 'R9TA06-554120', purchase_date: '2024-11-30', warranty_months: 12, case: 'HET' },
    // Cộng tháng rơi vào ngày không tồn tại (Q4): 31/08/2025 + 6 tháng → hết hạn 28/02/2026.
    { phone: '0956789012', product_name: 'Oppo A78', serial_no: 'OPA78-40017', purchase_date: '2025-08-31', warranty_months: 6, case: 'HET' },
    { phone: '0956789012', product_name: 'iPhone 16', serial_no: '359112260078415', purchase_date: '2026-09-12', warranty_months: 12, case: 'CON' },
    { phone: '0967890123', product_name: 'Samsung Galaxy A35', serial_no: 'R5CXA35-90021', purchase_date: '2026-04-03', warranty_months: 12, case: 'CON' },
    { phone: '0978901234', product_name: 'realme C67', serial_no: 'RMC67-773190', purchase_date: '2023-12-24', warranty_months: 12, case: 'HET' },
    { phone: '0989012345', product_name: 'iPhone 14', serial_no: '353918113366720', purchase_date: null, warranty_months: 12, case: 'NULL' },
    { phone: '0390123456', product_name: 'Xiaomi 14T', serial_no: 'XM14T-208455', purchase_date: '2026-01-15', warranty_months: 18, case: 'CON' },
    { phone: '0381234567', product_name: 'Samsung Galaxy A16', serial_no: 'R9TA16-310877', purchase_date: '2026-06-20', warranty_months: 12, case: 'CON' },
    { phone: '0372345678', product_name: 'Oppo Reno11', serial_no: 'OPRN11-56702', purchase_date: '2024-09-09', warranty_months: 18, case: 'HET' },
    { phone: '0363456789', product_name: 'iPhone 15 Pro', serial_no: '357260147788019', purchase_date: '2026-08-08', warranty_months: 12, case: 'CON' },
    { phone: '0354567890', product_name: 'Xiaomi Redmi 13C', serial_no: 'XMR13C-994410', purchase_date: null, warranty_months: 18, case: 'NULL' },
    { phone: '0345678901', product_name: 'Samsung Galaxy Z Flip6', serial_no: 'R3CZF6-120588', purchase_date: '2025-10-02', warranty_months: 24, case: 'CON' },
    { phone: '0336789012', product_name: 'vivo V30', serial_no: 'VVV30-447163', purchase_date: '2025-01-05', warranty_months: 12, case: 'HET' },
    { phone: '0327890123', product_name: 'Samsung Galaxy A55', serial_no: 'R5CXA55-62290', purchase_date: '2026-03-28', warranty_months: 12, case: 'CON' },
    { phone: '0708901234', product_name: 'Oppo Find N3 Flip', serial_no: 'OPN3F-00381', purchase_date: null, warranty_months: 18, case: 'NULL' },
    { phone: '0779012345', product_name: 'Samsung Galaxy S23 FE', serial_no: 'R5CS23F-71504', purchase_date: '2024-06-14', warranty_months: 12, case: 'HET' },
    { phone: '0760123456', product_name: 'iPhone 13', serial_no: '358240053344121', purchase_date: '2026-03-27', warranty_months: 12, case: 'CON' },
    { phone: '0791234567', product_name: 'Samsung Galaxy S24 Ultra', serial_no: 'R5CXS24U-8812', purchase_date: '2026-10-01', warranty_months: 24, case: 'CON' },
    { phone: '0832345678', product_name: 'Oppo A78', serial_no: 'OPA78-51288', purchase_date: '2025-05-19', warranty_months: 12, case: 'HET' },
    { phone: '0832345678', product_name: 'Xiaomi Redmi Note 13', serial_no: 'XMRN13-700245', purchase_date: null, warranty_months: 18, case: 'NULL' },
    { phone: '0843456789', product_name: 'iPhone 16', serial_no: '359112260091102', purchase_date: '2026-07-30', warranty_months: 12, case: 'CON' },
    { phone: '0854567890', product_name: 'vivo Y17s', serial_no: 'VVY17S-120995', purchase_date: '2024-03-03', warranty_months: 12, case: 'HET' },
    { phone: '0865678901', product_name: 'Samsung Galaxy A52', serial_no: 'SN-A52-781540', purchase_date: null, warranty_months: 12, case: 'NULL' },
];

/** Bắt lỗi gõ nhầm số điện thoại / tên máy trước khi chèn (INSERT … SELECT sẽ bỏ qua im lặng). */
function assertReferencesExist() {
    const phones = new Set(CUSTOMERS.map((c) => c.phone));
    const productNames = new Set(PRODUCTS.map((p) => p.product_name));
    for (const d of DEVICES) {
        if (!phones.has(d.phone)) throw new Error(`Seed device ${d.serial_no}: không có khách ${d.phone}`);
        if (!productNames.has(d.product_name)) throw new Error(`Seed device ${d.serial_no}: không có sản phẩm ${d.product_name}`);
    }
}

async function seed(client) {
    assertReferencesExist();
    let inserted = 0;
    for (const d of DEVICES) {
        const result = await client.query(
            `INSERT INTO device (customer_id, product_id, serial_no, purchase_date, warranty_months)
             SELECT c.customer_id, p.product_id, $3, $4, $5
             FROM customer c, product p
             WHERE c.phone = $1 AND p.product_name = $2
             ON CONFLICT (serial_no) DO NOTHING`,
            [d.phone, d.product_name, d.serial_no, d.purchase_date, d.warranty_months],
        );
        inserted += result.rowCount;
    }
    return inserted;
}

module.exports = { seed, DEVICES };
