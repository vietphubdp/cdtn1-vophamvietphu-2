'use strict';

/**
 * Lớp client gọi API JSON bằng fetch, dùng chung cho mọi trang.
 * Trình duyệt tự gửi cookie JWT (cùng nguồn), script không đọc được cookie (HttpOnly).
 * Lỗi theo cấu trúc { error: { code, message, fields, details } } được ném thành ApiError.
 * GĐ 7 bổ sung header Idempotency-Key cho POST /api/tickets.
 */
(function () {
    class ApiError extends Error {
        constructor(status, error) {
            super(error.message);
            this.name = 'ApiError';
            this.status = status;
            this.code = error.code;
            this.fields = error.fields || {};
            this.details = error.details || {};
        }
    }

    const NETWORK_ERROR = {
        code: 'NETWORK_ERROR',
        message: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    };

    async function request(method, path, body) {
        const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
        if (body !== undefined) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetch(path, options);
        } catch {
            throw new ApiError(0, NETWORK_ERROR);
        }

        if (response.status === 204) return null;
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const error = data && data.error ? data.error : { code: 'INTERNAL_ERROR', message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.' };
            throw new ApiError(response.status, error);
        }
        return data;
    }

    window.apiClient = {
        ApiError,
        get: (path) => request('GET', path),
        post: (path, body) => request('POST', path, body),
        put: (path, body) => request('PUT', path, body),
        delete: (path) => request('DELETE', path),
    };
})();
