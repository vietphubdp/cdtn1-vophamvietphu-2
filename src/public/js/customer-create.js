'use strict';

/**
 * M2 · Tạo khách hàng mới / Ghi nhận thiết bị mới (UC2, UC3). Chỉ điều khiển giao diện; mọi quy tắc do API kiểm:
 * chuẩn hóa và số duy nhất (QT-01, QT-02), che số (QT-15), serial duy nhất (QT-03), ngày mua không ở tương lai,
 * số tháng mặc định theo sản phẩm (FR4).
 * Mở từ M1: 3a `?phone=` → tạo khách (API 3) rồi ghi nhận thiết bị; 4a `?phone=&customer_id=` → khách đã có
 * (hiện bằng API 1), chỉ ghi nhận thiết bị (API 4). Lưu thiết bị xong quay lại M1 với số đã gõ và thiết bị mới,
 * M1 tự tra lại khách và chọn sẵn thiết bị đó.
 */
document.addEventListener('DOMContentLoaded', () => {
    const { apiClient, format } = window;
    const $ = (id) => document.getElementById(id);

    const M1_PATH = '/tickets/new';
    const CUSTOMER_FIELDS = ['full_name', 'phone', 'email', 'address'];
    const DEVICE_FIELDS = ['product_id', 'serial_no', 'purchase_date', 'warranty_months'];
    const DISPLAY_DATE_SHAPE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

    const state = {
        phone: '', // số đã gõ (chưa che) để quay lại M1 tra cứu; số API trả về đã bị che với Tiếp nhận
        customerId: null,
        products: [],
    };

    const customerForm = $('customer-form');
    const deviceForm = $('device-form');
    const productSelect = $('product_id');
    const customerSaveButton = $('customer-save');
    const deviceSaveButton = $('device-save');

    function show(element, visible) {
        element.hidden = !visible;
    }

    function redirectToLogin() {
        window.location.assign('/login');
    }

    function m1Url(phone, deviceId) {
        const params = new URLSearchParams();
        if (phone) params.set('phone', phone);
        if (deviceId) params.set('device_id', String(deviceId));
        const query = params.toString();
        return query ? `${M1_PATH}?${query}` : M1_PATH;
    }

    // ---------- Lỗi theo từng trường (UI8: aria-invalid + aria-describedby đã đặt sẵn trong EJS) ----------

    function setFieldError(name, message) {
        const target = document.querySelector(`[data-error-for="${name}"]`);
        if (target) target.textContent = `⚠ ${message}`;
        const input = document.getElementById(name);
        if (input) input.setAttribute('aria-invalid', 'true');
    }

    function clearFieldErrors(names) {
        names.forEach((name) => {
            const target = document.querySelector(`[data-error-for="${name}"]`);
            if (target) target.textContent = '';
            const input = document.getElementById(name);
            if (input) input.removeAttribute('aria-invalid');
        });
    }

    function showRetryBox(box, message) {
        box.querySelector('[data-message]').textContent = `⚠ ${message}`;
        show(box, true);
    }

    // Mất kết nối hoặc lỗi hệ thống: không hiện chi tiết kỹ thuật, giữ dữ liệu để thử lưu lại.
    function retryMessage(err) {
        return err.status === 0
            ? 'Mất kết nối – dữ liệu vẫn giữ trên màn hình.'
            : 'Hệ thống đang gặp sự cố, vui lòng thử lại';
    }

    // ---------- Khách hàng đã xác định (4a, hoặc vừa tạo ở 3a) ----------

    function useCustomer(customer, phone) {
        state.customerId = customer.customer_id;
        state.phone = phone;

        const info = $('customer-info');
        info.querySelector('[data-field="full_name"]').textContent = customer.full_name;
        info.querySelector('[data-field="phone"]').textContent = customer.phone; // QT-15: API đã che theo vai trò
        show(info, true);
        show(customerForm, false);

        $('back-link').href = m1Url(phone);
        $('device-fields').disabled = false;
        deviceSaveButton.disabled = false;
        show($('device-locked'), false);
    }

    function showCustomerForm(phone) {
        $('phone').value = phone;
        show(customerForm, true);
    }

    // 4a: M1 đã tra thấy khách → hiện lại khách bằng API 1 (không có endpoint đọc khách theo mã).
    async function loadExistingCustomer(phone) {
        show($('customer-error'), false);
        show($('customer-loading'), true);
        try {
            const customer = await apiClient.get(`/api/customers?phone=${encodeURIComponent(phone)}`);
            $('customer-title').textContent = 'Khách hàng';
            useCustomer(customer, phone);
        } catch (err) {
            if (err.status === 401) return redirectToLogin();
            if (err.status === 404 || err.status === 400) {
                // Số trên đường dẫn không còn khớp khách nào: chuyển sang tạo khách mới với số đó (3a)
                showCustomerForm(phone);
                if (err.status === 400) setFieldError('phone', err.fields.phone || err.message);
            } else {
                showRetryBox($('customer-error'), 'Không tải được thông tin khách hàng');
            }
        } finally {
            show($('customer-loading'), false);
        }
    }

    // ---------- Tạo khách hàng mới (UC2, API 3) ----------

    function clearCustomerMessages() {
        ['customer-conflict', 'customer-save-error', 'customer-retry-box'].forEach((id) => show($(id), false));
        clearFieldErrors(CUSTOMER_FIELDS);
    }

    function readCustomerBody() {
        // Để trống email, địa chỉ → API lưu null; chuẩn hóa số (QT-02) và cắt khoảng trắng do API làm.
        return {
            full_name: $('full_name').value,
            phone: $('phone').value,
            email: $('email').value,
            address: $('address').value,
        };
    }

    function showCustomerFailure(err, phone) {
        if (err.status === 400) {
            Object.entries(err.fields).forEach(([name, message]) => setFieldError(name, message));
            $('customer-save-error').textContent = `⚠ ${err.message}`;
            show($('customer-save-error'), true);
        } else if (err.status === 409) {
            // QT-01: số đã có hồ sơ (details.customer_id) → mở hồ sơ đó ở M1 bằng số vừa gõ
            $('customer-existing-link').href = m1Url(phone);
            show($('customer-existing-link'), Boolean(err.details.customer_id));
            show($('customer-conflict'), true);
            $('phone').setAttribute('aria-invalid', 'true');
        } else if (err.status === 0 || err.status >= 500) {
            showRetryBox($('customer-retry-box'), retryMessage(err));
        } else {
            // 401 (hết phiên), 403: hiện đúng thông báo của API, giữ dữ liệu đã nhập
            $('customer-save-error').textContent = `⚠ ${err.message}`;
            show($('customer-save-error'), true);
        }
    }

    async function saveCustomer() {
        clearCustomerMessages();
        const body = readCustomerBody();
        const phone = body.phone.trim();
        customerSaveButton.disabled = true;
        customerSaveButton.textContent = 'Đang lưu…';
        try {
            const customer = await apiClient.post('/api/customers', body);
            useCustomer(customer, phone);
            const success = $('customer-success');
            success.textContent = `✓ Đã tạo khách hàng ${customer.full_name}. Ghi nhận thiết bị mới hoặc quay lại lập phiếu.`;
            show(success, true);
            success.focus();
        } catch (err) {
            showCustomerFailure(err, phone);
        } finally {
            customerSaveButton.disabled = false;
            customerSaveButton.textContent = 'Lưu khách hàng';
        }
    }

    // ---------- Danh mục sản phẩm (API 11), (8) điền sẵn số tháng (FR4) ----------

    async function loadProducts() {
        ['product-empty', 'product-error'].forEach((id) => show($(id), false));
        productSelect.disabled = true;
        productSelect.replaceChildren(new Option('Đang tải…', ''));
        try {
            const data = await apiClient.get('/api/products'); // chỉ sản phẩm đang sử dụng
            state.products = data.items;
            if (data.items.length === 0) {
                productSelect.replaceChildren(new Option('Chưa có sản phẩm', ''));
                show($('product-empty'), true);
                return;
            }
            productSelect.replaceChildren(
                new Option('Chọn từ danh mục sản phẩm', ''),
                ...data.items.map((p) => new Option(p.product_name, String(p.product_id))),
            );
            productSelect.disabled = false;
        } catch (err) {
            if (err.status === 401) return redirectToLogin();
            productSelect.replaceChildren(new Option('Không tải được', ''));
            show($('product-error'), true);
        }
    }

    productSelect.addEventListener('change', () => {
        const product = state.products.find((p) => String(p.product_id) === productSelect.value);
        if (product) $('warranty_months').value = String(product.default_warranty_months);
        clearFieldErrors(['product_id', 'warranty_months']);
    });

    // ---------- Ghi nhận thiết bị mới (UC3, API 4) ----------

    function clearDeviceMessages() {
        ['device-save-error', 'device-retry-box'].forEach((id) => show($(id), false));
        clearFieldErrors(DEVICE_FIELDS);
    }

    // Ô chữ số: để trống → null (lấy theo sản phẩm); có chữ số → số; còn lại gửi nguyên để API báo lỗi trường.
    function readWarrantyMonths() {
        const text = $('warranty_months').value.trim();
        if (text === '') return null;
        return /^\d+$/.test(text) ? Number(text) : text;
    }

    function readDeviceBody() {
        return {
            product_id: productSelect.value ? Number(productSelect.value) : null,
            serial_no: $('serial_no').value,
            purchase_date: format.toApiDate($('purchase_date').value), // dd/mm/yyyy → YYYY-MM-DD
            warranty_months: readWarrantyMonths(),
        };
    }

    function showDeviceFailure(err) {
        if (err.status === 400) {
            Object.entries(err.fields).forEach(([name, message]) => {
                // API mô tả dạng ngày của JSON (YYYY-MM-DD); trên form người dùng gõ dd/mm/yyyy
                const wrongShape = name === 'purchase_date' && !DISPLAY_DATE_SHAPE.test($('purchase_date').value.trim());
                setFieldError(name, wrongShape ? 'Ngày mua không hợp lệ – nhập dạng dd/mm/yyyy' : message);
            });
            $('device-save-error').textContent = `⚠ ${err.message}`;
            show($('device-save-error'), true);
        } else if (err.status === 0 || err.status >= 500) {
            showRetryBox($('device-retry-box'), retryMessage(err));
        } else {
            // 409 serial đã ghi nhận (QT-03), 404 khách không tồn tại, 403, 401: hiện đúng thông báo của API
            if (err.status === 409) setFieldError('serial_no', err.message);
            $('device-save-error').textContent = `⚠ ${err.message}`;
            show($('device-save-error'), true);
        }
    }

    async function saveDevice() {
        if (!state.customerId) return;
        clearDeviceMessages();
        deviceSaveButton.disabled = true;
        deviceSaveButton.textContent = 'Đang lưu…';
        try {
            const device = await apiClient.post(`/api/customers/${state.customerId}/devices`, readDeviceBody());
            // Lưu xong quay lại M1 với dữ liệu vừa tạo (wireframe M2): M1 tra lại khách, chọn sẵn thiết bị mới.
            window.location.assign(m1Url(state.phone, device.device_id));
        } catch (err) {
            showDeviceFailure(err);
            deviceSaveButton.disabled = false;
            deviceSaveButton.textContent = 'Lưu thiết bị';
        }
    }

    // ---------- Gắn sự kiện ----------

    customerForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveCustomer();
    });
    $('customer-retry').addEventListener('click', saveCustomer);
    deviceForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveDevice();
    });
    $('device-retry').addEventListener('click', saveDevice);
    $('product-retry').addEventListener('click', loadProducts);

    [...CUSTOMER_FIELDS, 'serial_no', 'purchase_date', 'warranty_months'].forEach((name) => {
        $(name).addEventListener('input', () => clearFieldErrors([name]));
    });

    // ---------- Khởi động ----------

    loadProducts();

    const params = new URLSearchParams(window.location.search);
    const phoneParam = (params.get('phone') || '').trim();
    const customerParam = Number(params.get('customer_id'));
    $('back-link').href = m1Url(phoneParam);

    if (phoneParam && Number.isSafeInteger(customerParam) && customerParam > 0) {
        // 4a: khách đã có, chỉ ghi nhận thiết bị
        show(customerForm, false);
        $('customer-load-retry').addEventListener('click', () => loadExistingCustomer(phoneParam));
        loadExistingCustomer(phoneParam);
    } else {
        // 3a: tạo khách với số đã gõ ở M1
        showCustomerForm(phoneParam);
        $('full_name').focus();
    }
});
