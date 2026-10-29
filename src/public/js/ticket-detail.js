'use strict';

/**
 * M4 · Chi tiết phiếu (TĐ-02, TĐ-03). Chỉ điều khiển giao diện; mọi quy tắc do API kiểm:
 * phiếu của trung tâm mình (QT-14), chỉ sửa phiếu Mới (QT-16), hủy theo vòng đời (QT-06),
 * quyết định bảo hành chỉ cho phiếu chưa xác minh (QT-17), thiết bị thuộc khách (QT-03).
 * Khối nào hiện ra do cờ can_edit, can_cancel, can_decide_warranty của API 18 quyết định.
 * Đủ 3 trạng thái đang tải · không có (404) · lỗi (S4, UI7).
 */
document.addEventListener('DOMContentLoaded', () => {
    const { apiClient, format } = window;
    const $ = (id) => document.getElementById(id);

    const ticketId = document.body.dataset.ticketId;
    const API_PATH = `/api/tickets/${ticketId}`;
    const UNCATEGORIZED = 'Chưa phân loại';

    // Tên trường hiển thị trong lịch sử sửa (khóa của `changes` trong API 18).
    const CHANGE_LABELS = {
        serial_no: 'Thiết bị (serial)',
        issue_desc: 'Mô tả lỗi',
        category_name: 'Nhóm sự cố',
        priority: 'Mức ưu tiên',
        due_date: 'Hạn cam kết',
        warranty_status: 'Tình trạng bảo hành',
    };

    // Lỗi trường `reason` của API trả về hiện ở ô lý do của đúng form đã gửi.
    const REASON_INPUT = { edit: 'edit-reason', cancel: 'cancel-reason', decision: 'decision-reason' };

    const state = { ticket: null };
    let sequence = 0;

    function show(element, visible) {
        element.hidden = !visible;
    }

    function setFieldError(name, message) {
        const target = document.querySelector(`[data-error-for="${name}"]`);
        if (target) target.textContent = message;
        const input = document.getElementById(name);
        if (input) input.setAttribute('aria-invalid', 'true');
    }

    function clearFieldErrors(form) {
        form.querySelectorAll('[data-error-for]').forEach((target) => {
            target.textContent = '';
            const input = document.getElementById(target.dataset.errorFor);
            if (input) input.removeAttribute('aria-invalid');
        });
    }

    function formatChangeValue(field, value) {
        if (value === null || value === undefined || value === '') return field === 'category_name' ? UNCATEGORIZED : '(trống)';
        if (field === 'priority') return format.priorityLabel(value);
        if (field === 'warranty_status') return format.warrantyStatusLabel(value);
        if (field === 'due_date') return format.formatDateTime(value);
        return String(value);
    }

    // ---------- Thông tin phiếu ----------

    function renderInfo(ticket) {
        const values = {
            customer_name: ticket.customer_name,
            phone: ticket.phone, // QT-15: API đã che theo vai trò
            device: `${ticket.product_name} · ${ticket.serial_no}`,
            category_name: ticket.category_name || UNCATEGORIZED,
            priority: format.priorityLabel(ticket.priority),
            warranty_status: format.warrantyStatusLabel(ticket.warranty_status),
            status: format.ticketStatusLabel(ticket.status),
            received_at: format.formatDateTime(ticket.received_at),
            due_date: `${format.formatDateTime(ticket.due_date)}${ticket.is_overdue ? ' · QUÁ HẠN' : ''}`,
            issue_desc: ticket.issue_desc,
        };
        Object.entries(values).forEach(([field, text]) => {
            $('ticket-info').querySelector(`[data-field="${field}"]`).textContent = text;
        });
        $('title-code').textContent = ticket.ticket_code;

        const readonly = !ticket.can_edit && !ticket.can_cancel && !ticket.can_decide_warranty;
        $('readonly-note').textContent = `ⓘ Phiếu đang ở trạng thái "${format.ticketStatusLabel(ticket.status)}", bạn chỉ xem được, không sửa được.`;
        show($('readonly-note'), readonly);
    }

    // ---------- Lịch sử: trạng thái (ticket_status_log) và sửa phiếu (ticket_edit_log), xếp theo thời gian ----------

    function historyItem(time, who, title, lines) {
        const item = document.createElement('li');
        item.className = 'tile space-y-1 text-sm';
        const head = document.createElement('p');
        head.className = 'text-neutral-500';
        head.textContent = `${format.formatDateTime(time)} · ${who}`;
        const body = document.createElement('p');
        body.className = 'font-medium';
        body.textContent = title;
        item.append(head, body);
        lines.forEach((text) => {
            const line = document.createElement('p');
            line.textContent = text;
            item.append(line);
        });
        return item;
    }

    function renderHistory(ticket) {
        const entries = [
            ...ticket.status_history.map((log) => ({
                time: log.changed_at,
                node: historyItem(
                    log.changed_at,
                    log.changed_by_name,
                    log.from_status
                        ? `Chuyển trạng thái: ${format.ticketStatusLabel(log.from_status)} → ${format.ticketStatusLabel(log.to_status)}`
                        : `Lập phiếu, trạng thái ${format.ticketStatusLabel(log.to_status)}`,
                    log.note ? [`Lý do: ${log.note}`] : [],
                ),
            })),
            ...ticket.edit_history.map((log) => ({
                time: log.changed_at,
                node: historyItem(log.changed_at, log.changed_by_name, 'Sửa phiếu', [
                    ...Object.entries(log.changes).map(
                        ([field, change]) =>
                            `${CHANGE_LABELS[field] || field}: ${formatChangeValue(field, change.from)} → ${formatChangeValue(field, change.to)}`,
                    ),
                    `Lý do: ${log.reason}`,
                ]),
            })),
        ];
        // Chuỗi ISO cùng múi giờ +07:00 nên so chuỗi là đúng thứ tự thời gian.
        entries.sort((a, b) => a.time.localeCompare(b.time));
        $('history-list').replaceChildren(...entries.map((entry) => entry.node));
        show($('history-empty'), entries.length === 0);
    }

    // ---------- Form sửa phiếu: điền giá trị hiện tại, tải thiết bị của khách (API 2) và nhóm sự cố (API 6) ----------

    function option(value, text) {
        const element = document.createElement('option');
        element.value = String(value);
        element.textContent = text;
        return element;
    }

    async function fillEditForm(ticket) {
        $('issue_desc').value = ticket.issue_desc;
        $('edit-reason').value = '';
        document.querySelectorAll('input[name="priority"]').forEach((radio) => {
            radio.checked = radio.value === ticket.priority;
        });

        const deviceSelect = $('device_id');
        const categorySelect = $('category_id');
        deviceSelect.disabled = true;
        categorySelect.disabled = true;
        try {
            const [devices, categories] = await Promise.all([
                apiClient.get(`/api/customers/${ticket.customer_id}/devices`),
                apiClient.get('/api/issue-categories'), // chỉ nhóm đang sử dụng (FR7)
            ]);
            deviceSelect.replaceChildren(
                ...devices.items.map((d) => option(d.device_id, `${d.product_name} · ${d.serial_no} · mua ${format.formatDate(d.purchase_date)}`)),
            );
            deviceSelect.value = String(ticket.device_id);

            const categoryOptions = [option('', UNCATEGORIZED), ...categories.items.map((c) => option(c.category_id, c.category_name))];
            // Nhóm hiện tại đã ngừng dùng: vẫn hiện để giữ nguyên khi không đổi (FR7 chỉ chặn chọn nhóm mới).
            if (ticket.category_id !== null && !categories.items.some((c) => c.category_id === ticket.category_id)) {
                categoryOptions.push(option(ticket.category_id, `${ticket.category_name} (đã ngừng dùng)`));
            }
            categorySelect.replaceChildren(...categoryOptions);
            categorySelect.value = ticket.category_id === null ? '' : String(ticket.category_id);
            deviceSelect.disabled = false;
            categorySelect.disabled = false;
        } catch (err) {
            if (err.status === 401) return window.location.assign('/login');
            $('edit-error').textContent = '⚠ Không tải được danh sách thiết bị hoặc nhóm sự cố. Tải lại trang để thử lại.';
            show($('edit-error'), true);
        }
        return undefined;
    }

    // ---------- Tải phiếu (API 18) ----------

    async function loadTicket() {
        sequence += 1;
        const current = sequence;
        ['detail-not-found', 'detail-error', 'detail-content'].forEach((id) => show($(id), false));
        show($('detail-loading'), true);
        try {
            const ticket = await apiClient.get(API_PATH);
            if (current !== sequence) return;
            state.ticket = ticket;
            renderInfo(ticket);
            renderHistory(ticket);
            ['edit-form', 'decision-form', 'cancel-form'].forEach((id) => {
                clearFieldErrors($(id));
                $(id).reset();
            });
            ['edit-error', 'decision-error', 'cancel-error'].forEach((id) => show($(id), false));
            show($('edit-form'), ticket.can_edit);
            show($('decision-form'), ticket.can_decide_warranty);
            show($('cancel-form'), ticket.can_cancel);
            show($('detail-content'), true);
            if (ticket.can_edit) fillEditForm(ticket);
        } catch (err) {
            if (current !== sequence) return;
            if (err.status === 401) return window.location.assign('/login');
            show($(err.status === 404 ? 'detail-not-found' : 'detail-error'), true);
        } finally {
            if (current === sequence) show($('detail-loading'), false);
        }
    }

    // ---------- Gửi ba form ----------

    /**
     * Gửi một form: 400 → báo theo từng trường; 404/403/422/409/mất kết nối → thông báo của API ở khung lỗi của form.
     * Thành công → tải lại phiếu để thấy giá trị mới, lịch sử mới và các khối thao tác còn được phép.
     */
    async function submit(kind, form, send, successMessage) {
        clearFieldErrors(form);
        show($(`${kind}-error`), false);
        show($('action-success'), false);
        const button = $(`${kind}-save`);
        button.disabled = true;
        try {
            await send();
            await loadTicket();
            $('action-success').textContent = `✓ ${successMessage}`;
            show($('action-success'), true);
            $('action-success').focus();
        } catch (err) {
            if (err.status === 401) return window.location.assign('/login');
            if (err.status === 400 && Object.keys(err.fields).length > 0) {
                Object.entries(err.fields).forEach(([name, message]) => {
                    setFieldError(name === 'reason' ? REASON_INPUT[kind] : name, `⚠ ${message}`);
                });
                if (err.fields.body) {
                    $(`${kind}-error`).textContent = `⚠ ${err.fields.body}`;
                    show($(`${kind}-error`), true);
                }
            } else {
                $(`${kind}-error`).textContent = `⚠ ${err.message}`;
                show($(`${kind}-error`), true);
            }
        } finally {
            button.disabled = false;
        }
        return undefined;
    }

    $('edit-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const checked = document.querySelector('input[name="priority"]:checked');
        const categoryValue = $('category_id').value;
        const body = {
            device_id: Number($('device_id').value) || state.ticket.device_id,
            issue_desc: $('issue_desc').value,
            category_id: categoryValue === '' ? null : Number(categoryValue),
            priority: checked ? checked.value : state.ticket.priority,
            reason: $('edit-reason').value,
        };
        submit('edit', $('edit-form'), () => apiClient.patch(API_PATH, body), 'Đã lưu thay đổi của phiếu.');
    });

    $('decision-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const checked = document.querySelector('input[name="warranty_status"]:checked');
        const body = { warranty_status: checked ? checked.value : null, reason: $('decision-reason').value };
        submit('decision', $('decision-form'), () => apiClient.post(`${API_PATH}/warranty-decision`, body), 'Đã lưu quyết định bảo hành.');
    });

    $('cancel-form').addEventListener('submit', (event) => {
        event.preventDefault();
        if (!window.confirm('Hủy phiếu này? Phiếu đã hủy không mở lại được.')) return;
        const body = { reason: $('cancel-reason').value };
        submit('cancel', $('cancel-form'), () => apiClient.post(`${API_PATH}/cancel`, body), 'Đã hủy phiếu.');
    });

    $('detail-retry').addEventListener('click', loadTicket);

    loadTicket();
});
