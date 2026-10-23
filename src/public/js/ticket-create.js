'use strict';

/**
 * M1 · Lập phiếu bảo hành (UC5). Chỉ điều khiển giao diện; mọi quy tắc nghiệp vụ do API kiểm:
 * chuẩn hóa số (QT-02), che số (QT-15), tình trạng bảo hành (QT-05), hạn cam kết (QT-04), thiết bị thuộc khách (QT-03).
 * Luồng chính B.2: tra khách (API 1) → thiết bị (API 2) → bảo hành (API 5) → nhóm sự cố (API 6) → lưu phiếu (API 7).
 * Mỗi vùng dữ liệu có đủ 3 trạng thái đang tải · rỗng · lỗi (S4, UI7).
 */
document.addEventListener('DOMContentLoaded', () => {
    const { apiClient, format } = window;
    const $ = (id) => document.getElementById(id);

    const M2_PATH = '/customers/new';
    const DEFAULT_PRIORITY = 'TRUNG_BINH'; // 7a: chưa chọn nhóm thì Trung bình (FR8)

    // Lớp của nhãn tình trạng bảo hành: viết đủ tên để Tailwind quét được (UI3); luôn kèm chữ (UI8).
    const WARRANTY_VIEW = {
        CON_BAO_HANH: { text: 'Còn bảo hành', className: 'badge px-4 py-1.5 text-sm uppercase bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300' },
        HET_BAO_HANH: { text: 'Hết bảo hành', className: 'badge px-4 py-1.5 text-sm uppercase bg-red-50 text-red-700 ring-1 ring-red-300' },
        CHUA_XAC_MINH: { text: 'Chưa xác minh bảo hành', className: 'badge px-4 py-1.5 text-sm uppercase bg-amber-50 text-amber-800 ring-1 ring-amber-300' },
    };

    // Trường chưa chọn trên giao diện: thay thông báo định dạng của API bằng hướng dẫn thao tác.
    const SELECTION_HINTS = {
        customer_id: 'Tra cứu khách hàng theo số điện thoại trước khi lưu phiếu',
        device_id: 'Chọn thiết bị cần bảo hành trong danh sách',
    };

    const state = {
        phone: '', // số đã gõ, giữ để mở M2 và để M2 quay lại tra cứu (số API trả về đã bị che)
        customer: null,
        deviceId: null,
        preselectDeviceId: null, // device_id do M2 truyền về sau khi ghi nhận thiết bị (4a)
        categories: [],
    };
    // Mỗi yêu cầu tải tăng số thứ tự; phản hồi của yêu cầu cũ (người dùng đã tra số khác) bị bỏ qua.
    const sequence = { customer: 0, devices: 0, warranty: 0 };

    // Chống lưu trùng (NFR4, 9c): giữ một khóa cho tới khi lưu thành công hoặc bắt đầu phiếu khác.
    const ticketPost = apiClient.createIdempotentPost('/api/tickets');

    const lookupForm = $('lookup-form');
    const phoneInput = $('phone');
    const lookupButton = $('lookup-button');
    const ticketForm = $('ticket-form');
    const categorySelect = $('category_id');
    const saveButton = $('save-button');

    function show(element, visible) {
        element.hidden = !visible;
    }

    function redirectToLogin() {
        window.location.assign('/login');
    }

    // ---------- Lỗi theo từng trường (UI8: aria-invalid + aria-describedby đã đặt sẵn trong EJS) ----------

    function setFieldError(name, message) {
        const target = document.querySelector(`[data-error-for="${name}"]`);
        if (target) target.textContent = message;
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

    // ---------- Khách hàng (UC1, API 1) ----------

    function resetCustomer() {
        sequence.customer += 1;
        state.customer = null;
        ['customer-loading', 'customer-not-found', 'customer-error', 'customer-info'].forEach((id) => show($(id), false));
        lookupButton.disabled = false;
        clearFieldErrors(['phone', 'customer_id']);
        resetDevices();
        show($('device-section'), false);
    }

    function renderCustomer(customer) {
        const info = $('customer-info');
        info.querySelector('[data-field="full_name"]').textContent = customer.full_name;
        info.querySelector('[data-field="phone"]').textContent = customer.phone; // QT-15: API đã che theo vai trò
        info.querySelector('[data-field="address"]').textContent = customer.address || '(trống)';
        show(info, true);
    }

    async function lookupCustomer() {
        resetCustomer();
        ticketPost.reset(); // khách khác = phiếu khác
        state.phone = phoneInput.value.trim();
        const current = sequence.customer;

        show($('customer-loading'), true);
        lookupButton.disabled = true;
        try {
            const customer = await apiClient.get(`/api/customers?phone=${encodeURIComponent(state.phone)}`);
            if (current !== sequence.customer) return;
            state.customer = customer;
            renderCustomer(customer);
            $('device-create-link').href = `${M2_PATH}?phone=${encodeURIComponent(state.phone)}&customer_id=${customer.customer_id}`;
            show($('device-section'), true);
            loadDevices();
        } catch (err) {
            if (current !== sequence.customer) return;
            if (err.status === 401) return redirectToLogin();
            if (err.status === 400) {
                // 3b: số không đủ 10 chữ số sau khi chuẩn hóa
                setFieldError('phone', `⚠ ${err.fields.phone || err.message}`);
                phoneInput.focus();
            } else if (err.status === 404) {
                // 3a: chưa có khách → M2 với số đã gõ (extend UC2)
                $('customer-create-link').href = `${M2_PATH}?phone=${encodeURIComponent(state.phone)}`;
                show($('customer-not-found'), true);
            } else {
                $('customer-error').querySelector('[data-message]').textContent = `⚠ ${err.message}`;
                show($('customer-error'), true);
            }
        } finally {
            if (current === sequence.customer) {
                show($('customer-loading'), false);
                lookupButton.disabled = false;
            }
        }
    }

    // ---------- Thiết bị của khách (UC1, API 2) ----------

    function resetDevices() {
        sequence.devices += 1;
        state.deviceId = null;
        $('device-rows').replaceChildren();
        ['device-loading', 'device-empty', 'device-error', 'device-list'].forEach((id) => show($(id), false));
        clearFieldErrors(['device_id']);
        resetWarranty();
    }

    function createDeviceRow(device) {
        const row = document.createElement('tr');
        row.className = 'cursor-pointer hover:bg-neutral-50 has-checked:bg-neutral-100';

        const radioCell = document.createElement('td');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'device';
        radio.value = String(device.device_id);
        radio.id = `device-${device.device_id}`;
        radio.className = 'size-4 accent-neutral-900';
        radio.setAttribute('aria-label', `Chọn ${device.product_name}, serial ${device.serial_no}`);
        radio.addEventListener('change', () => selectDevice(device.device_id));
        radioCell.append(radio);

        const cells = [device.product_name, device.serial_no, format.formatDate(device.purchase_date)].map((text) => {
            const cell = document.createElement('td');
            cell.textContent = text;
            return cell;
        });

        row.append(radioCell, ...cells);
        row.addEventListener('click', (event) => {
            if (event.target !== radio) radio.click();
        });
        return row;
    }

    async function loadDevices() {
        resetDevices();
        const current = sequence.devices;
        show($('device-loading'), true);
        try {
            const data = await apiClient.get(`/api/customers/${state.customer.customer_id}/devices`);
            if (current !== sequence.devices) return;
            if (data.items.length === 0) {
                show($('device-empty'), true);
                return;
            }
            $('device-rows').replaceChildren(...data.items.map(createDeviceRow));
            show($('device-list'), true);

            // Quay lại từ M2 sau khi ghi nhận thiết bị mới: chọn sẵn thiết bị đó (4a → bước 5).
            const preselect = state.preselectDeviceId && $(`device-${state.preselectDeviceId}`);
            state.preselectDeviceId = null;
            if (preselect) preselect.click();
        } catch (err) {
            if (current !== sequence.devices) return;
            if (err.status === 401) return redirectToLogin();
            show($('device-error'), true);
        } finally {
            if (current === sequence.devices) show($('device-loading'), false);
        }
    }

    function selectDevice(deviceId) {
        if (state.deviceId === deviceId) return;
        state.deviceId = deviceId;
        clearFieldErrors(['device_id']);
        ticketPost.reset(); // thiết bị khác = phiếu khác
        loadWarranty();
    }

    // ---------- (9) Tình trạng bảo hành (UC4, API 5, QT-05) ----------

    function resetWarranty() {
        sequence.warranty += 1;
        ['warranty-loading', 'warranty-error', 'warranty-result', 'warranty-unverified', 'warranty-expired'].forEach((id) => show($(id), false));
        show($('warranty-idle'), true);
    }

    async function loadWarranty() {
        resetWarranty();
        const current = sequence.warranty;
        show($('warranty-idle'), false);
        show($('warranty-loading'), true);
        try {
            const warranty = await apiClient.get(`/api/devices/${state.deviceId}/warranty`);
            if (current !== sequence.warranty) return;
            const view = WARRANTY_VIEW[warranty.warranty_status];
            const badge = $('warranty-badge');
            badge.className = view.className;
            badge.textContent = view.text;
            $('warranty-expires').textContent = warranty.warranty_expires_on
                ? `Hết hạn bảo hành ngày ${format.formatDate(warranty.warranty_expires_on)}`
                : '';
            show($('warranty-result'), true);
            show($('warranty-unverified'), warranty.warranty_status === 'CHUA_XAC_MINH'); // 5a
            show($('warranty-expired'), warranty.warranty_status === 'HET_BAO_HANH'); // 5b
        } catch (err) {
            if (current !== sequence.warranty) return;
            if (err.status === 401) return redirectToLogin();
            show($('warranty-error'), true);
        } finally {
            if (current === sequence.warranty) show($('warranty-loading'), false);
        }
    }

    // ---------- (11) Nhóm sự cố, (12) Mức ưu tiên (API 6, FR7, FR8) ----------

    function setPriority(value) {
        const radio = ticketForm.querySelector(`input[name="priority"][value="${value}"]`);
        if (radio) radio.checked = true;
    }

    async function loadCategories() {
        show($('category-error'), false);
        categorySelect.disabled = true;
        categorySelect.replaceChildren(new Option('Đang tải…', ''));
        try {
            const data = await apiClient.get('/api/issue-categories'); // chỉ nhóm đang sử dụng (FR7)
            state.categories = data.items;
            // Rỗng: chỉ còn "Chưa phân loại", vẫn lập phiếu được (7a).
            categorySelect.replaceChildren(
                new Option('Chưa phân loại', ''),
                ...data.items.map((c) => new Option(c.category_name, String(c.category_id))),
            );
            categorySelect.disabled = false;
        } catch (err) {
            if (err.status === 401) return redirectToLogin();
            categorySelect.replaceChildren(new Option('Không tải được', ''));
            show($('category-error'), true);
        }
    }

    // FR8: chọn nhóm thì điền sẵn mức ưu tiên mặc định của nhóm; nhân viên vẫn đổi được.
    categorySelect.addEventListener('change', () => {
        const category = state.categories.find((c) => String(c.category_id) === categorySelect.value);
        setPriority(category ? category.default_priority : DEFAULT_PRIORITY);
        clearFieldErrors(['category_id']);
    });

    // ---------- Lưu phiếu (API 7) ----------

    const SAVE_FIELDS = ['customer_id', 'device_id', 'issue_desc', 'category_id', 'priority'];

    function clearSaveMessages() {
        ['save-success', 'save-error', 'save-retry-box'].forEach((id) => show($(id), false));
        clearFieldErrors(SAVE_FIELDS);
    }

    function readTicketBody() {
        const priority = ticketForm.querySelector('input[name="priority"]:checked');
        return {
            customer_id: state.customer ? state.customer.customer_id : null,
            device_id: state.deviceId,
            issue_desc: $('issue_desc').value,
            category_id: categorySelect.value ? Number(categorySelect.value) : null,
            priority: priority ? priority.value : null,
        };
    }

    function showSaveError(message) {
        const box = $('save-error');
        box.textContent = `⚠ ${message}`;
        show(box, true);
    }

    function showRetry(message) {
        const box = $('save-retry-box');
        box.querySelector('[data-message]').textContent = `⚠ ${message}`;
        show(box, true);
    }

    function showSaveFailure(err) {
        if (err.status === 400) {
            // 9a và các trường khác: gom lỗi từng trường, dữ liệu đã nhập giữ nguyên (US5-AC2)
            Object.entries(err.fields).forEach(([name, message]) => {
                const missingSelection = (name === 'customer_id' && !state.customer) || (name === 'device_id' && !state.deviceId);
                setFieldError(name, `⚠ ${missingSelection ? SELECTION_HINTS[name] : message}`);
            });
            showSaveError(err.message);
        } else if (err.status === 0) {
            // 9c: giữ dữ liệu và khóa chống trùng; thử lưu lại không lập phiếu trùng (NFR4)
            showRetry('Mất kết nối – dữ liệu vẫn giữ trên màn hình. Lưu lại sẽ không lập phiếu trùng.');
        } else if (err.status >= 500) {
            showRetry('Hệ thống đang gặp sự cố, vui lòng thử lại'); // không hiện chi tiết kỹ thuật
        } else {
            // 422 (9b, QT-03), 404, 403, 401, 409: hiện đúng thông báo của API
            showSaveError(err.message);
        }
    }

    function showSaveSuccess(ticket) {
        const box = $('save-success');
        box.textContent = `✓ Đã lập phiếu ${ticket.ticket_code} · Trạng thái: ${format.ticketStatusLabel(ticket.status)}`
            + ` · Hạn cam kết: ${format.formatDateTime(ticket.due_date)}`;
        show(box, true);
        box.focus();
    }

    async function saveTicket() {
        clearSaveMessages();
        saveButton.disabled = true;
        saveButton.textContent = 'Đang lưu…';
        try {
            const ticket = await ticketPost.send(readTicketBody());
            resetForm(); // phiếu đã lưu: form trống cho khách tiếp theo, thông báo thành công vẫn hiện
            showSaveSuccess(ticket);
        } catch (err) {
            showSaveFailure(err);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Lưu phiếu';
        }
    }

    // ---------- Làm lại từ đầu ----------

    function resetForm() {
        lookupForm.reset();
        ticketForm.reset();
        state.phone = '';
        resetCustomer();
        categorySelect.value = '';
        setPriority(DEFAULT_PRIORITY);
        clearSaveMessages();
        ticketPost.reset();
    }

    // ---------- Gắn sự kiện ----------

    lookupForm.addEventListener('submit', (event) => {
        event.preventDefault();
        lookupCustomer();
    });
    $('customer-retry').addEventListener('click', lookupCustomer);
    $('device-retry').addEventListener('click', loadDevices);
    $('warranty-retry').addEventListener('click', loadWarranty);
    $('category-retry').addEventListener('click', loadCategories);

    ticketForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveTicket();
    });
    $('save-retry').addEventListener('click', saveTicket);
    $('issue_desc').addEventListener('input', () => clearFieldErrors(['issue_desc']));

    // "Thoát không lưu" chỉ đóng form đang nhập, không hủy phiếu nào (W8).
    $('cancel-button').addEventListener('click', () => {
        resetForm();
        phoneInput.focus();
    });

    // ---------- Khởi động ----------

    loadCategories();

    // Quay lại từ M2 (3a, 4a): M2 truyền số đã gõ và thiết bị vừa ghi nhận; tra lại bằng API 1.
    const params = new URLSearchParams(window.location.search);
    const deviceParam = Number(params.get('device_id'));
    if (Number.isSafeInteger(deviceParam) && deviceParam > 0) state.preselectDeviceId = deviceParam;
    if (params.get('phone')) {
        phoneInput.value = params.get('phone');
        lookupCustomer();
    }
});
