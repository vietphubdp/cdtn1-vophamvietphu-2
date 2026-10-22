'use strict';

/**
 * Repository báo "giá trị trùng ràng buộc UNIQUE" mà không lộ mã lỗi của `pg` cho lớp trên.
 * Repository chỉ báo trùng; service quyết định đó là lỗi nghiệp vụ gì (ví dụ CONFLICT).
 *
 * @param {string} [constraint] tên ràng buộc bị vi phạm (để ghi log, không trả cho người dùng)
 */
class DuplicateKeyError extends Error {
    constructor(constraint) {
        super(`Giá trị trùng ràng buộc UNIQUE${constraint ? ` (${constraint})` : ''}`);
        this.name = 'DuplicateKeyError';
        this.constraint = constraint;
    }
}

module.exports = { DuplicateKeyError };
