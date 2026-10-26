'use strict';

// node db/tools/sample-data.js
// Rút mẫu nhỏ từ bộ dữ liệu Mekong Mobile (data/raw/, không commit) ra data/sample/*.csv (có commit),
// để db/seeds/ nạp vào CSDL. Quy tắc chọn cố định + bộ sinh số ngẫu nhiên có seed cố định (SEED),
// không đọc ngày giờ máy: chạy lại bao nhiêu lần cũng ra đúng các file như nhau (tái lập được).
// Quy tắc và lý do: README mục 3 "Dữ liệu mẫu", docs/thay-doi-thiet-ke.md TĐ-14.

const fs = require('fs');
const path = require('path');
const { readCsv, writeCsv, SAMPLE_DIR } = require('./csv');
const { normalizePhone } = require('../../src/services/normalizePhone');
const { determineWarrantyStatus } = require('../../src/services/WarrantyService');
const { parseCalendarDate, formatCalendarDate, daysInMonth } = require('../../src/services/calendarDate');
const { Priority, WarrantyStatus } = require('../../src/domain/constants');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw');

// ---------- Tham số cố định (ghi trong README) ----------
const SEED = 20261026;
// Ngày neo để sinh ngày mua, thay cho "hôm nay" (không đọc giờ máy).
const REFERENCE_DATE = '2026-10-26';
// Tình trạng bảo hành của thiết bị giữ đúng như is_warranty từ REFERENCE_DATE tới hết ngày này.
const WARRANTY_STABLE_UNTIL = '2027-03-01';
// Ngày mua muộn nhất: trước REFERENCE_DATE 14 ngày, vì phiếu seed tiếp nhận tối đa 230 giờ trước lúc seed.
const LATEST_PURCHASE_DATE = '2026-10-12';
const EARLIEST_PURCHASE_DATE = '2023-01-01';
const CENTER_IDS = [1, 2, 3]; // 3 trung tâm có tài khoản demo
const TICKETS_PER_CENTER = 10;
const MIN_PRODUCTS = 24;
const EXTRA_UNVERIFIED_DEVICES = 6; // thêm 1 thiết bị của khách tự bổ sung = 7 thiết bị không có ngày mua
const MAX_HOURS_AGO = 230;
// QT-04: số giờ cam kết theo mức ưu tiên (để chọn hours_ago chắc chắn quá hạn / chưa quá hạn).
const COMMITMENT_HOURS = { [Priority.CAO]: 24, [Priority.TRUNG_BINH]: 72, [Priority.THAP]: 120 };

// Đổi mã nhóm sự cố của bộ mẫu sang tên theo bảng thuật ngữ SRS.
const CATEGORY_NAMES = {
    MAN_HINH: 'Màn hình', PIN: 'Pin', SAC: 'Sạc', PHAN_MEM: 'Phần mềm', NUOC_VAO: 'Nước vào', KHAC: 'Khác',
};

// Khách tự bổ sung (không có trong bộ mẫu): số của ví dụ api-contract 3.1, README và lệnh curl đang dùng.
// Mã nằm ngoài dải record_id 1–67037 của customers_raw.csv để không lẫn với khách của bộ mẫu.
const SUPPLEMENTED_CUSTOMER = {
    customer_id: 100001,
    full_name: 'Nguyễn Văn An',
    phone: '0901234567',
    email: '',
    address: '12 Nguyễn Tri Phương, Quận 10',
    source: 'TU_BO_SUNG',
};

/** Bộ sinh số ngẫu nhiên mulberry32: cùng seed → cùng dãy số trên mọi máy. */
function createRandom(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (min, max) => min + Math.floor(next() * (max - min + 1));
    const shuffle = (items) => {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = int(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };
    return { int, shuffle, pick: (items) => items[int(0, items.length - 1)] };
}

// ---------- Ngày lịch 'YYYY-MM-DD' (không múi giờ) ----------
function addMonths(dateText, months) {
    const d = parseCalendarDate(dateText);
    const monthIndex = d.month - 1 + months;
    const year = d.year + Math.floor(monthIndex / 12);
    const month = (((monthIndex % 12) + 12) % 12) + 1;
    return formatCalendarDate({ year, month, day: Math.min(d.day, daysInMonth(year, month)) });
}

function addDays(dateText, days) {
    const d = parseCalendarDate(dateText);
    const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
    return formatCalendarDate({ year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() });
}

function daysBetween(fromText, toText) {
    const a = parseCalendarDate(fromText);
    const b = parseCalendarDate(toText);
    return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
}

/** Ngày giờ Việt Nam 00:00 của ngày lịch, để gọi WarrantyService tự kiểm kết quả. */
const vietnamMidnight = (dateText) => new Date(`${dateText}T00:00:00+07:00`);

/**
 * Sinh ngày mua sao cho WarrantyService cho đúng is_warranty của phiếu gốc suốt
 * [REFERENCE_DATE, WARRANTY_STABLE_UNTIL]:
 *  - còn bảo hành: ngày mua + N tháng ≥ WARRANTY_STABLE_UNTIL, ngày mua ≤ LATEST_PURCHASE_DATE;
 *  - hết bảo hành: ngày mua + N tháng < REFERENCE_DATE trừ 30 ngày.
 */
function generatePurchaseDate(random, isWarranty, warrantyMonths) {
    let from;
    let to;
    if (isWarranty) {
        from = addMonths(WARRANTY_STABLE_UNTIL, -warrantyMonths);
        to = LATEST_PURCHASE_DATE;
    } else {
        from = EARLIEST_PURCHASE_DATE;
        to = addMonths(addDays(REFERENCE_DATE, -30), -warrantyMonths);
    }
    return addDays(from, random.int(0, daysBetween(from, to)));
}

function assertWarrantyStable(device) {
    const expected = device.is_warranty === ''
        ? WarrantyStatus.CHUA_XAC_MINH
        : device.is_warranty === 'true' ? WarrantyStatus.CON_BAO_HANH : WarrantyStatus.HET_BAO_HANH;
    const record = { purchase_date: device.purchase_date || null, warranty_months: Number(device.warranty_months) };
    for (const day of [REFERENCE_DATE, WARRANTY_STABLE_UNTIL]) {
        const actual = determineWarrantyStatus(record, vietnamMidnight(day)).warranty_status;
        if (actual !== expected) throw new Error(`Thiết bị ${device.serial_no}: ${actual} ≠ ${expected} ngày ${day}`);
    }
}

/** Sinh serial dạng của bộ mẫu (SN + 12 chữ số), không trùng serial nào đã có. */
function generateSerial(random, usedSerials) {
    for (;;) {
        const serial = `SN${String(random.int(1, 999999)).padStart(6, '0')}${String(random.int(0, 999999)).padStart(6, '0')}`;
        if (!usedSerials.has(serial)) {
            usedSerials.add(serial);
            return serial;
        }
    }
}

/** hours_ago khác nhau từng phiếu; quá hạn: ≥ N + 48 giờ, chưa quá hạn: ≤ N − 1 giờ (như seed GĐ 5). */
function generateHoursAgo(random, priority, overdue, usedHours) {
    const n = COMMITMENT_HOURS[priority];
    const [min, max] = overdue ? [n + 48, MAX_HOURS_AGO] : [1, n - 1];
    for (;;) {
        const hours = random.int(min, max);
        if (!usedHours.has(hours)) {
            usedHours.add(hours);
            return hours;
        }
    }
}

const normalizeSpaces = (text) => text.replace(/\s+/g, ' ').trim();

function main() {
    const random = createRandom(SEED);
    const raw = (name) => readCsv(path.join(RAW_DIR, name));

    // 1. Trung tâm, nhóm sự cố: lấy đủ 6 dòng.
    const centers = raw('service_centers.csv').map((c) => ({ center_id: c.center_id, center_name: c.center_name }));
    const categories = raw('issue_categories.csv').map((c) => {
        if (!CATEGORY_NAMES[c.category_name]) throw new Error(`Nhóm sự cố lạ: ${c.category_name}`);
        return { category_id: c.category_id, category_name: CATEGORY_NAMES[c.category_name], default_priority: c.default_priority };
    });

    const productsById = new Map(raw('products.csv').map((p) => [p.product_id, p]));
    const customersById = new Map(raw('customers_raw.csv').map((c) => [c.record_id, c]));
    const history = raw('tickets_history.csv');
    const usedSerials = new Set(history.map((t) => t.serial_no));

    // 2. Chọn phiếu: mỗi trung tâm 1–3 lấy TICKETS_PER_CENTER phiếu theo thứ tự xáo trộn có seed.
    const chosenCustomers = new Map(); // customer_id → khách đã chuẩn hóa
    const phoneOwner = new Map([[SUPPLEMENTED_CUSTOMER.phone, String(SUPPLEMENTED_CUSTOMER.customer_id)]]);
    const productNameOwner = new Map(); // product_name → product_id (product_name là UNIQUE)
    const chosenTickets = [];

    for (const centerId of CENTER_IDS) {
        const candidates = random.shuffle(history.filter((t) => Number(t.center_id) === centerId));
        let taken = 0;
        for (const t of candidates) {
            if (taken === TICKETS_PER_CENTER) break;
            const customer = customersById.get(t.customer_id);
            const phone = customer ? normalizePhone(customer.so_dien_thoai) : null; // QT-02
            if (!phone) continue; // khách không có số / số không hợp lệ
            if (phoneOwner.has(phone) && phoneOwner.get(phone) !== t.customer_id) continue; // QT-01: số đã thuộc hồ sơ khác
            const product = productsById.get(t.product_id);
            if (productNameOwner.has(product.product_name) && productNameOwner.get(product.product_name) !== t.product_id) continue;
            const issueDesc = normalizeSpaces(t.issue_desc);
            if (issueDesc.length < 10 || issueDesc.length > 2000) continue;

            phoneOwner.set(phone, t.customer_id);
            productNameOwner.set(product.product_name, t.product_id);
            chosenCustomers.set(t.customer_id, {
                customer_id: t.customer_id,
                full_name: normalizeSpaces(customer.ho_ten),
                phone,
                email: customer.email.trim(),
                address: normalizeSpaces(customer.dia_chi),
                source: 'customers_raw.csv',
            });
            const overdue = taken % 2 === 0; // nửa quá hạn, nửa chưa quá hạn tại lúc seed (FR11)
            chosenTickets.push({ ...t, issue_desc: issueDesc, overdue });
            taken += 1;
        }
        if (taken < TICKETS_PER_CENTER) throw new Error(`Trung tâm ${centerId} chỉ có ${taken} phiếu hợp lệ`);
    }

    // 3. Sản phẩm: các sản phẩm phiếu tham chiếu, bổ sung từ products.csv cho đủ MIN_PRODUCTS.
    const productIds = [...new Set(chosenTickets.map((t) => t.product_id))];
    for (const p of random.shuffle([...productsById.values()])) {
        if (productIds.length >= MIN_PRODUCTS) break;
        if (productNameOwner.has(p.product_name)) continue;
        productNameOwner.set(p.product_name, p.product_id);
        productIds.push(p.product_id);
    }
    const products = productIds
        .map((id) => productsById.get(id))
        .sort((a, b) => Number(a.product_id) - Number(b.product_id))
        .map((p) => ({ product_id: p.product_id, product_name: p.product_name, default_warranty_months: p.warranty_months }));
    const monthsOf = (productId) => Number(productsById.get(productId).warranty_months);

    // 4. Thiết bị: 1–2 của khách tự bổ sung, tiếp theo là thiết bị của phiếu, cuối cùng thiết bị không có ngày mua.
    const twelveMonthProducts = products.filter((p) => p.default_warranty_months === '12');
    const devices = [];
    const addDevice = (d) => {
        const device = { device_id: devices.length + 1, ...d, warranty_months: monthsOf(d.product_id) };
        devices.push(device);
        return device;
    };
    // device_id 1: còn bảo hành, mua 05/03/2026 + 12 tháng như ví dụ US4-AC1 / api-contract 3.5.
    addDevice({
        customer_id: SUPPLEMENTED_CUSTOMER.customer_id, product_id: twelveMonthProducts[0].product_id,
        serial_no: generateSerial(random, usedSerials), purchase_date: '2026-03-05', is_warranty: 'true', source: 'TU_BO_SUNG',
    });
    // device_id 2: không có ngày mua → chưa xác minh (ví dụ api-contract 3.2).
    addDevice({
        customer_id: SUPPLEMENTED_CUSTOMER.customer_id, product_id: random.pick(products).product_id,
        serial_no: generateSerial(random, usedSerials), purchase_date: '', is_warranty: '', source: 'TU_BO_SUNG',
    });
    for (const t of chosenTickets) {
        addDevice({
            customer_id: t.customer_id, product_id: t.product_id, serial_no: t.serial_no,
            purchase_date: generatePurchaseDate(random, t.is_warranty === 'true', monthsOf(t.product_id)),
            is_warranty: t.is_warranty, source: 'tickets_history.csv',
        });
    }
    const ticketCustomerIds = [...chosenCustomers.keys()];
    for (let i = 0; i < EXTRA_UNVERIFIED_DEVICES; i += 1) {
        addDevice({
            customer_id: random.pick(ticketCustomerIds), product_id: random.pick(products).product_id,
            serial_no: generateSerial(random, usedSerials), purchase_date: '', is_warranty: '', source: 'TU_BO_SUNG',
        });
    }
    devices.forEach(assertWarrantyStable);

    // 5. Phiếu: giữ dữ liệu gốc, thêm hours_ago (thời điểm tiếp nhận tính lùi lúc seed).
    const usedHours = new Set();
    const tickets = chosenTickets.map((t) => ({
        source_ticket_id: t.ticket_id,
        customer_id: t.customer_id,
        product_id: t.product_id,
        serial_no: t.serial_no,
        center_id: t.center_id,
        issue_desc: t.issue_desc,
        category_id: t.category_id,
        priority: t.priority,
        is_warranty: t.is_warranty,
        hours_ago: generateHoursAgo(random, t.priority, t.overdue, usedHours),
    }));

    const customers = [
        SUPPLEMENTED_CUSTOMER,
        ...[...chosenCustomers.values()].sort((a, b) => Number(a.customer_id) - Number(b.customer_id)),
    ];

    fs.mkdirSync(SAMPLE_DIR, { recursive: true });
    const out = (name, columns, rows) => {
        writeCsv(path.join(SAMPLE_DIR, name), columns, rows);
        console.log(`data/sample/${name}: ${rows.length} dòng`);
    };
    out('service_centers.csv', ['center_id', 'center_name'], centers);
    out('issue_categories.csv', ['category_id', 'category_name', 'default_priority'], categories);
    out('products.csv', ['product_id', 'product_name', 'default_warranty_months'], products);
    out('customers.csv', ['customer_id', 'full_name', 'phone', 'email', 'address', 'source'], customers);
    out('devices.csv', ['device_id', 'customer_id', 'product_id', 'serial_no', 'purchase_date', 'warranty_months', 'is_warranty', 'source'], devices);
    out('tickets.csv', ['source_ticket_id', 'customer_id', 'product_id', 'serial_no', 'center_id', 'issue_desc', 'category_id', 'priority', 'is_warranty', 'hours_ago'], tickets);
}

main();
