'use strict';

/**
 * Lớp client gọi API JSON bằng fetch, dùng chung cho mọi trang.
 * Trình duyệt tự gửi cookie JWT (cùng nguồn), script không đọc được cookie (HttpOnly).
 * Lỗi theo cấu trúc { error: { code, message, fields, details } } được ném thành ApiError;
 * mất kết nối → ApiError status 0, mã NETWORK_ERROR.
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

    async function request(method, path, body, extraHeaders) {
        const options = {
            method,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...extraHeaders },
        };
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

    /**
     * UUID phiên bản 4 cho header Idempotency-Key. crypto.randomUUID chỉ có ở trang https hoặc localhost;
     * máy quầy mở qua http trong mạng nội bộ thì tự ghép từ crypto.getRandomValues.
     */
    function createUuid() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        const bytes = window.crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // phiên bản 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // biến thể RFC 4122
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    /**
     * POST có chống lưu trùng (NFR4, ngoại lệ 9c, Q12): mỗi lần lập một bản ghi dùng một khóa.
     * - Thành công (201, hoặc 200 khi máy chủ trả lại bản ghi đã lưu) → tạo khóa mới cho lần sau.
     * - Lỗi bất kỳ → giữ khóa: nếu yêu cầu trước thật ra đã lưu (mất kết nối lúc nhận phản hồi),
     *   lần thử lưu lại nhận về bản ghi cũ chứ không lưu thêm.
     * - reset() → bỏ khóa cũ khi người dùng bắt đầu một bản ghi khác (đổi khách, đổi thiết bị, thoát không lưu).
     */
    function createIdempotentPost(path) {
        let key = createUuid();
        return {
            async send(body) {
                const data = await request('POST', path, body, { 'Idempotency-Key': key });
                key = createUuid();
                return data;
            },
            reset() {
                key = createUuid();
            },
        };
    }

    window.apiClient = {
        ApiError,
        get: (path) => request('GET', path),
        post: (path, body) => request('POST', path, body),
        put: (path, body) => request('PUT', path, body),
        delete: (path) => request('DELETE', path),
        createIdempotentPost,
    };
})();
