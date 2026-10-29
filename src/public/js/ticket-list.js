'use strict';

/**
 * M3 · Danh sách phiếu của trung tâm (UC6). Chỉ điều khiển giao diện; quy tắc do API 8 làm:
 * lọc theo trung tâm trong JWT (QT-14), che số theo vai trò (QT-15), sắp theo hạn cam kết, cờ quá hạn (FR11).
 * Trang hiện tại nằm trên đường dẫn (?page=) để tải lại hoặc nút Back của trình duyệt vẫn đúng trang.
 * Đủ 3 trạng thái đang tải · rỗng · lỗi (S4, UI7).
 */
document.addEventListener('DOMContentLoaded', () => {
    const { apiClient, format } = window;
    const $ = (id) => document.getElementById(id);

    const PAGE_SIZE = 20; // 20 dòng/trang như wireframe
    const UNCATEGORIZED = 'Chưa phân loại'; // category_name null (7a)

    // Lớp gắn bằng JS viết đủ tên để Tailwind quét được (UI3).
    const OVERDUE_ROW_CLASS = 'bg-red-50';
    const OVERDUE_DUE_CLASS = 'font-medium text-red-700';
    const OVERDUE_BADGE_CLASS = 'badge bg-red-600 text-white';

    const state = { page: 1, totalPages: 1 };
    let sequence = 0; // bỏ qua phản hồi của yêu cầu cũ khi người dùng đã chuyển trang khác

    function show(element, visible) {
        element.hidden = !visible;
    }

    /** ?page= không phải số nguyên dương → trang 1 (không gửi tham số sai lên API). */
    function readPageFromUrl() {
        const value = new URLSearchParams(window.location.search).get('page');
        const page = /^\d+$/.test(value || '') ? Number(value) : 1;
        return Number.isSafeInteger(page) && page >= 1 ? page : 1;
    }

    function writePageToUrl(page, replace) {
        const url = page === 1 ? window.location.pathname : `${window.location.pathname}?page=${page}`;
        if (replace) window.history.replaceState({ page }, '', url);
        else window.history.pushState({ page }, '', url);
    }

    function cell(text, className) {
        const td = document.createElement('td');
        td.textContent = text;
        if (className) td.className = className;
        return td;
    }

    function createTicketRow(ticket) {
        const row = document.createElement('tr');
        if (ticket.is_overdue) row.className = OVERDUE_ROW_CLASS;

        const overdueCell = document.createElement('td');
        overdueCell.className = 'pr-5 sm:pr-6';
        if (ticket.is_overdue) {
            const badge = document.createElement('span');
            badge.className = OVERDUE_BADGE_CLASS;
            badge.textContent = 'QUÁ HẠN';
            overdueCell.append(badge);
        }

        // Mã phiếu mở M4 – chi tiết, sửa, hủy phiếu (TĐ-02, TĐ-03).
        const codeCell = cell('', 'pl-5 font-medium sm:pl-6');
        const codeLink = document.createElement('a');
        codeLink.className = 'link';
        codeLink.href = `/tickets/${ticket.ticket_id}`;
        codeLink.textContent = ticket.ticket_code;
        codeLink.setAttribute('aria-label', `Xem chi tiết phiếu ${ticket.ticket_code}`);
        codeCell.append(codeLink);

        row.append(
            codeCell,
            cell(ticket.customer_name),
            cell(ticket.phone), // QT-15: API đã che với Tiếp nhận, đầy đủ với Quản lý (NFR2)
            cell(ticket.product_name),
            cell(ticket.serial_no),
            cell(ticket.category_name || UNCATEGORIZED),
            cell(format.priorityLabel(ticket.priority)),
            cell(format.warrantyStatusLabel(ticket.warranty_status)),
            cell(format.ticketStatusLabel(ticket.status)),
            cell(format.formatDateTime(ticket.received_at)),
            cell(format.formatDateTime(ticket.due_date), ticket.is_overdue ? OVERDUE_DUE_CLASS : ''),
            overdueCell,
        );
        return row;
    }

    function renderPagination(total) {
        $('page-info').textContent = `Trang ${state.page} / ${state.totalPages}`;
        $('page-total').textContent = `· Tổng: ${total} phiếu`;
        $('page-prev').disabled = state.page <= 1;
        $('page-next').disabled = state.page >= state.totalPages;
    }

    async function loadPage(page) {
        sequence += 1;
        const current = sequence;
        state.page = page;

        ['list-empty', 'list-error'].forEach((id) => show($(id), false));
        show($('list-loading'), true);
        $('page-prev').disabled = true;
        $('page-next').disabled = true;
        try {
            const data = await apiClient.get(`/api/tickets?page=${page}&size=${PAGE_SIZE}`);
            if (current !== sequence) return;

            if (data.total === 0) {
                show($('list-content'), false);
                show($('list-empty'), true);
                return;
            }
            state.totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
            // Trang vượt quá số phiếu (gõ tay ?page=99, hoặc phiếu ít đi): API trả items rỗng → về trang cuối.
            if (data.items.length === 0 && page > state.totalPages) {
                writePageToUrl(state.totalPages, true);
                loadPage(state.totalPages);
                return;
            }
            $('ticket-rows').replaceChildren(...data.items.map(createTicketRow));
            renderPagination(data.total);
            show($('list-content'), true);
        } catch (err) {
            if (current !== sequence) return;
            if (err.status === 401) return window.location.assign('/login');
            show($('list-content'), false);
            show($('list-error'), true);
        } finally {
            if (current === sequence) show($('list-loading'), false);
        }
    }

    function goToPage(page) {
        writePageToUrl(page, false);
        loadPage(page);
    }

    $('page-prev').addEventListener('click', () => goToPage(state.page - 1));
    $('page-next').addEventListener('click', () => goToPage(state.page + 1));
    $('list-retry').addEventListener('click', () => loadPage(state.page));
    window.addEventListener('popstate', () => loadPage(readPageFromUrl()));

    loadPage(readPageFromUrl());
});
