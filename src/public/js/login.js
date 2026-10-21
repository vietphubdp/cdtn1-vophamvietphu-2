'use strict';

// Trang đăng nhập: gửi API 9, hiện lỗi theo từng ô (400) hoặc lỗi chung (401, mạng, 500).
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const button = document.getElementById('login-button');
    const generalError = document.getElementById('login-error');

    function clearErrors() {
        form.querySelectorAll('[data-error-for]').forEach((el) => {
            el.textContent = '';
        });
        generalError.hidden = true;
        generalError.textContent = '';
    }

    function showErrors(err) {
        Object.entries(err.fields).forEach(([name, message]) => {
            const el = form.querySelector(`[data-error-for="${name}"]`);
            if (el) el.textContent = message;
        });
        generalError.textContent = err.message;
        generalError.hidden = false;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearErrors();
        button.disabled = true;
        button.textContent = 'Đang đăng nhập…';
        try {
            await window.apiClient.post('/api/auth/login', {
                username: form.username.value,
                password: form.password.value,
            });
            window.location.assign('/');
        } catch (err) {
            showErrors(err);
            button.disabled = false;
            button.textContent = 'Đăng nhập';
        }
    });
});
