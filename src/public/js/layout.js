'use strict';

// Sidebar dạng ngăn kéo dưới lg (UI5): mở bằng nút menu, đóng bằng nút ✕, bấm lớp phủ hoặc phím Esc.
// Từ lg trở lên sidebar luôn hiện bằng lớp lg:translate-x-0, script này không can thiệp.
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const openButton = document.getElementById('sidebar-open');
    const closeButton = document.getElementById('sidebar-close');
    if (!sidebar || !openButton) return;

    function setOpen(open) {
        sidebar.classList.toggle('translate-x-0', open);
        sidebar.classList.toggle('-translate-x-full', !open);
        overlay.hidden = !open;
        openButton.setAttribute('aria-expanded', String(open));
        if (open) closeButton.focus();
        else openButton.focus();
    }

    openButton.addEventListener('click', () => setOpen(true));
    closeButton.addEventListener('click', () => setOpen(false));
    overlay.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && openButton.getAttribute('aria-expanded') === 'true') setOpen(false);
    });
});
