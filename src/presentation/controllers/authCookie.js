'use strict';

// Cookie chứa JWT (api-contract mục 2, 3.9, 3.10): HttpOnly để script trên trang không đọc được,
// SameSite=Strict để trang khác không gửi kèm cookie khi gọi API của hệ thống.
const TOKEN_COOKIE = 'token';
const TOKEN_COOKIE_OPTIONS = Object.freeze({ httpOnly: true, sameSite: 'strict', path: '/' });

/**
 * Đọc JWT từ header Cookie. Tự tách chuỗi thay vì thêm thư viện cookie-parser
 * vì chỉ cần đúng một cookie.
 * @returns {string|undefined}
 */
function readTokenCookie(req) {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) continue;
        if (part.slice(0, separator).trim() !== TOKEN_COOKIE) continue;
        const value = part.slice(separator + 1).trim();
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }
    return undefined;
}

module.exports = { TOKEN_COOKIE, TOKEN_COOKIE_OPTIONS, readTokenCookie };
