'use strict';

// 25 khách hàng giả lập (D6): họ tên, số điện thoại, địa chỉ không phải dữ liệu thật.
// Số điện thoại đã ở dạng chuẩn 10 chữ số (QT-02), không trùng nhau (QT-01).
// Khách đầu tiên trùng ví dụ api-contract mục 3.1 để thử bằng curl.
// Không seed số 0931234888 (ví dụ tạo khách ở mục 3.3) để demo được 201.
const CUSTOMERS = [
    { full_name: 'Nguyễn Văn An', phone: '0901234567', email: null, address: '12 Nguyễn Tri Phương, Quận 10' },
    { full_name: 'Trần Thị Bích', phone: '0912345678', email: 'bich.tran@example.com', address: '88 Ba Tháng Hai, Quận 10' },
    { full_name: 'Lê Hoàng Cường', phone: '0923456789', email: null, address: '5 Sư Vạn Hạnh, Quận 10' },
    { full_name: 'Phạm Minh Đức', phone: '0934567890', email: 'duc.pham@example.com', address: '201 Lý Thái Tổ, Quận 10' },
    { full_name: 'Võ Thị Hạnh', phone: '0945678901', email: null, address: '17 Thành Thái, Quận 10' },
    { full_name: 'Đặng Quốc Huy', phone: '0956789012', email: null, address: '32 Trần Hưng Đạo, Ninh Kiều, Cần Thơ' },
    { full_name: 'Bùi Thị Kim', phone: '0967890123', email: 'kim.bui@example.com', address: '9 Mậu Thân, Ninh Kiều, Cần Thơ' },
    { full_name: 'Hồ Văn Lộc', phone: '0978901234', email: null, address: '140 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ' },
    { full_name: 'Ngô Thị Mỹ', phone: '0989012345', email: null, address: '21 Hòa Bình, Ninh Kiều, Cần Thơ' },
    { full_name: 'Dương Văn Nam', phone: '0390123456', email: 'nam.duong@example.com', address: '7 Ba Tháng Hai, Ninh Kiều, Cần Thơ' },
    { full_name: 'Lâm Thị Oanh', phone: '0381234567', email: null, address: '56 Phạm Thái Bường, Phường 4, Vĩnh Long' },
    { full_name: 'Châu Minh Phát', phone: '0372345678', email: null, address: '3 Lê Thái Tổ, Phường 2, Vĩnh Long' },
    { full_name: 'Tạ Thị Quyên', phone: '0363456789', email: 'quyen.ta@example.com', address: '118 Nguyễn Huệ, Phường 2, Vĩnh Long' },
    { full_name: 'Mai Văn Sang', phone: '0354567890', email: null, address: '44 Trưng Nữ Vương, Phường 1, Vĩnh Long' },
    { full_name: 'Kiều Thị Tâm', phone: '0345678901', email: null, address: '60 Hùng Vương, Phường 1, Vĩnh Long' },
    { full_name: 'Phan Văn Thành', phone: '0336789012', email: null, address: '15 Tôn Đức Thắng, Long Xuyên, An Giang' },
    { full_name: 'Huỳnh Thị Uyên', phone: '0327890123', email: 'uyen.huynh@example.com', address: '92 Trần Hưng Đạo, Long Xuyên, An Giang' },
    { full_name: 'Trịnh Văn Vinh', phone: '0708901234', email: null, address: '27 Ấp Bắc, Mỹ Tho, Tiền Giang' },
    { full_name: 'Quách Thị Xuân', phone: '0779012345', email: null, address: '8 Nam Kỳ Khởi Nghĩa, Mỹ Tho, Tiền Giang' },
    { full_name: 'Lưu Minh Yên', phone: '0760123456', email: null, address: '73 Đồng Khởi, Bến Tre' },
    { full_name: 'Đoàn Văn Bảo', phone: '0791234567', email: 'bao.doan@example.com', address: '19 Hai Bà Trưng, Bến Tre' },
    { full_name: 'Thái Thị Cẩm', phone: '0832345678', email: null, address: '250 Ngô Gia Tự, Quận 10' },
    { full_name: 'Vương Quốc Dũng', phone: '0843456789', email: null, address: '11 Hồ Thị Kỷ, Quận 10' },
    { full_name: 'Tô Thị Giang', phone: '0854567890', email: null, address: '66 Lê Hồng Phong, Quận 10' },
    { full_name: 'Hà Văn Khánh', phone: '0865678901', email: 'khanh.ha@example.com', address: '4 Võ Văn Kiệt, Ninh Kiều, Cần Thơ' },
];

async function seed(client) {
    let inserted = 0;
    for (const c of CUSTOMERS) {
        const result = await client.query(
            `INSERT INTO customer (full_name, phone, email, address) VALUES ($1, $2, $3, $4)
             ON CONFLICT (phone) DO NOTHING`,
            [c.full_name, c.phone, c.email, c.address],
        );
        inserted += result.rowCount;
    }
    return inserted;
}

module.exports = { seed, CUSTOMERS };
