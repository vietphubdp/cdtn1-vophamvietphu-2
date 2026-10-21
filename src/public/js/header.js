'use strict';

// Nút Đăng xuất trên thanh tiêu đề: gọi API 10 rồi về trang đăng nhập.
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('logout-button');
    if (!button) return;
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            await window.apiClient.post('/api/auth/logout');
        } finally {
            window.location.assign('/login');
        }
    });
});
