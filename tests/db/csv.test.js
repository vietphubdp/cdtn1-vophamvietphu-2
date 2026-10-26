'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseCsv, readCsv, writeCsv } = require('../../db/tools/csv');

// Bộ đọc/ghi CSV của db/tools/csv.js (TĐ-14): đọc data/raw/ của bộ mẫu Mekong Mobile và data/sample/.

describe('db/tools/csv.js', () => {
    test('TĐ-14 luồng đúng: tách dòng theo tiêu đề, ô trống thành chuỗi rỗng', () => {
        const rows = parseCsv('record_id,ho_ten,email\n1,Phan Hữu Bình,binh72@yahoo.com\n2,Đỗ Đức Tâm,\n');
        expect(rows).toEqual([
            { record_id: '1', ho_ten: 'Phan Hữu Bình', email: 'binh72@yahoo.com' },
            { record_id: '2', ho_ten: 'Đỗ Đức Tâm', email: '' },
        ]);
    });

    test('TĐ-14 giá trị biên: ô trong ngoặc kép chứa dấu phẩy, dấu ngoặc kép, xuống dòng; file có BOM và CRLF', () => {
        const text = '﻿id,dia_chi,ghi_chu\r\n1,"252 Điện Biên Phủ, TP. Thủ Đức","nói ""máy nóng""\r\nhai dòng"\r\n2,,cuối file không xuống dòng';
        expect(parseCsv(text)).toEqual([
            { id: '1', dia_chi: '252 Điện Biên Phủ, TP. Thủ Đức', ghi_chu: 'nói "máy nóng"\r\nhai dòng' },
            { id: '2', dia_chi: '', ghi_chu: 'cuối file không xuống dòng' },
        ]);
    });

    test('TĐ-14 giá trị biên: ghi rồi đọc lại giữ nguyên giá trị; null thành ô trống', () => {
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csv-')), 'out.csv');
        writeCsv(file, ['id', 'address', 'email'], [
            { id: 1, address: '12 Nguyễn Tri Phương, Quận 10', email: null },
            { id: 2, address: 'có "ngoặc"', email: 'a@b.vn' },
        ]);
        expect(readCsv(file)).toEqual([
            { id: '1', address: '12 Nguyễn Tri Phương, Quận 10', email: '' },
            { id: '2', address: 'có "ngoặc"', email: 'a@b.vn' },
        ]);
    });

    test('TĐ-14 dữ liệu sai: dòng thiếu cột thì cột thiếu là chuỗi rỗng, không lệch sang dòng sau', () => {
        expect(parseCsv('a,b,c\n1,2\n3,4,5\n')).toEqual([
            { a: '1', b: '2', c: '' },
            { a: '3', b: '4', c: '5' },
        ]);
    });
});
