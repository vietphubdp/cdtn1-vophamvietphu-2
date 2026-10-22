'use strict';

const { toVietnamIsoString, toVietnamDateString } = require('../../src/services/vietnamTime');

// Thời gian trả ra API theo giờ Việt Nam, dạng …+07:00 (api-contract mục 2).

describe('toVietnamIsoString', () => {
    test('TĐ-06 luồng đúng: 07:20 UTC → 14:20 giờ Việt Nam', () => {
        expect(toVietnamIsoString(new Date('2026-10-08T07:20:00Z'))).toBe('2026-10-08T14:20:00+07:00');
    });

    test('TĐ-06 giá trị biên: 17:00 UTC sang ngày mới theo giờ Việt Nam', () => {
        expect(toVietnamIsoString(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01T00:00:00+07:00');
    });

    test('TĐ-06 giá trị biên: bỏ phần nghìn giây', () => {
        expect(toVietnamIsoString(new Date('2026-10-08T07:20:59.999Z'))).toBe('2026-10-08T14:20:59+07:00');
    });
});

describe('toVietnamDateString', () => {
    test('QT-05 luồng đúng: 07:20 UTC → ngày 08/10 theo giờ Việt Nam', () => {
        expect(toVietnamDateString(new Date('2026-10-08T07:20:00Z'))).toBe('2026-10-08');
    });

    test('QT-05 giá trị biên: 16:59:59 UTC vẫn là ngày cũ, 17:00 UTC đã sang ngày mới', () => {
        expect(toVietnamDateString(new Date('2026-10-08T16:59:59Z'))).toBe('2026-10-08');
        expect(toVietnamDateString(new Date('2026-10-08T17:00:00Z'))).toBe('2026-10-09');
    });
});
