'use strict';

// Đọc/ghi CSV tối giản (RFC 4180: dấu phẩy, ô trong ngoặc kép, "" là một dấu ngoặc kép), đủ cho
// bộ dữ liệu Mekong Mobile trong data/raw/ và các file data/sample/*.csv. Không thêm thư viện.
// Dùng chung cho db/tools/sample-data.js (sinh mẫu) và db/seeds/*.js (nạp mẫu).

const fs = require('fs');
const path = require('path');

const SAMPLE_DIR = path.join(__dirname, '..', '..', 'data', 'sample');

/**
 * Tách nội dung CSV thành mảng đối tượng theo dòng tiêu đề. Ô trống → chuỗi rỗng.
 *
 * @param {string} text nội dung file (UTF-8, có thể có BOM, xuống dòng LF hoặc CRLF)
 * @returns {object[]}
 */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

    for (let i = 0; i < src.length; i += 1) {
        const ch = src[i];
        if (inQuotes) {
            if (ch === '"' && src[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i += 1;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    const [header, ...body] = rows.filter((r) => !(r.length === 1 && r[0] === ''));
    return body.map((r) => Object.fromEntries(header.map((name, k) => [name, r[k] ?? ''])));
}

function readCsv(filePath) {
    return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

/** Đọc data/sample/<name> – dữ liệu mẫu đã rút từ bộ Mekong Mobile, dùng cho db/seeds/. */
function readSampleCsv(name) {
    return readCsv(path.join(SAMPLE_DIR, name));
}

function escapeField(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Ghi mảng đối tượng ra CSV theo đúng thứ tự cột `columns`, xuống dòng LF. null/undefined → ô trống.
 */
function writeCsv(filePath, columns, records) {
    const lines = [columns.join(','), ...records.map((r) => columns.map((c) => escapeField(r[c])).join(','))];
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

module.exports = { parseCsv, readCsv, readSampleCsv, writeCsv, SAMPLE_DIR };
