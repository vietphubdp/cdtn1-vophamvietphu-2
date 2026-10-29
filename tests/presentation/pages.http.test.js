'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { TEST_PASSWORD, createTestDeps } = require('../helpers/fakeAuth');

// Trang EJS qua HTTP với repository giả (D4): PageController chỉ render khung,
// dữ liệu trên trang lấy qua API bằng api-client.js nên ở đây chỉ kiểm khung và điều hướng theo vai trò.

async function loginAs(username, deps = createTestDeps()) {
    const agent = request.agent(createApp(deps));
    await agent.post('/api/auth/login').send({ username, password: TEST_PASSWORD }).expect(200);
    return agent;
}

describe('Trang chủ – chuyển theo vai trò', () => {
    test('UC5 luồng đúng: Tiếp nhận vào trang chủ → chuyển tới M1', async () => {
        const agent = await loginAs('lan.q10');
        const res = await agent.get('/');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/tickets/new');
    });

    test('UC6 luồng đúng: Quản lý trung tâm vào trang chủ → chuyển tới M3', async () => {
        const agent = await loginAs('hung.q10');
        const res = await agent.get('/');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/tickets');
    });
});

describe('M1 · Lập phiếu bảo hành (UC5)', () => {
    test('UC5 luồng đúng: Tiếp nhận mở M1 → khung trang có trung tâm (1), các trường của wireframe và script gọi API', async () => {
        const deps = createTestDeps();
        const agent = await loginAs('lan.q10', deps);
        deps.repositories.customer.findByPhone.mockClear();

        const res = await agent.get('/tickets/new');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('Trung tâm: <span class="font-medium text-neutral-900">Trung tâm bảo hành Quận 10</span>');
        for (const label of ['Số điện thoại khách *', 'Tên máy', 'Serial/IMEI', 'Ngày mua',
            'Tình trạng bảo hành', 'Mô tả lỗi *', 'Nhóm sự cố', 'Mức ưu tiên',
            'Thoát không lưu', 'Lưu phiếu']) {
            expect(res.text).toContain(label);
        }
        expect(res.text).toContain('/public/js/api-client.js');
        expect(res.text).toContain('/public/js/ticket-create.js');
        // PageController không tra dữ liệu, trang tự gọi API sau khi tải
        expect(deps.repositories.customer.findByPhone).not.toHaveBeenCalled();
    });

    test('UC5 luồng đúng: M1 có đủ câu chữ 3 trạng thái của danh sách thiết bị theo wireframe (S4)', async () => {
        const agent = await loginAs('lan.q10');
        const res = await agent.get('/tickets/new');

        expect(res.text).toContain('Đang tải thiết bị…');
        expect(res.text).toContain('Khách chưa có thiết bị nào – hãy ghi nhận thiết bị mới');
        expect(res.text).toContain('Không tải được danh sách thiết bị');
    });

    test('UC5 dữ liệu sai: Quản lý trung tâm mở M1 → chuyển về M3 (M1 chỉ dành cho Tiếp nhận)', async () => {
        const agent = await loginAs('hung.q10');
        const res = await agent.get('/tickets/new');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/tickets');
    });

    test('UC5 dữ liệu sai: chưa đăng nhập mở M1 → chuyển về trang đăng nhập', async () => {
        const res = await request(createApp(createTestDeps())).get('/tickets/new');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });
});

describe('M2 · Tạo khách hàng mới / Ghi nhận thiết bị mới (UC2, UC3)', () => {
    test('UC2 luồng đúng: Tiếp nhận mở M2 từ 3a → khung có đủ trường (1)–(8) của wireframe và script gọi API', async () => {
        const deps = createTestDeps();
        const agent = await loginAs('lan.q10', deps);
        deps.repositories.customer.findByPhone.mockClear();

        const res = await agent.get('/customers/new?phone=0901234567');

        expect(res.status).toBe(200);
        for (const label of ['Tạo khách hàng mới', 'Họ tên *', 'Số điện thoại *', 'Email', 'Địa chỉ',
            'Lưu khách hàng', 'Ghi nhận thiết bị mới', 'Tên máy *', 'Serial/IMEI *', 'Ngày mua',
            'Số tháng bảo hành', 'Lưu thiết bị']) {
            expect(res.text).toContain(label);
        }
        expect(res.text).toContain('placeholder="dd/mm/yyyy"');
        expect(res.text).toContain('/public/js/customer-create.js');
        // Số trên đường dẫn do script đọc, PageController không tra khách
        expect(deps.repositories.customer.findByPhone).not.toHaveBeenCalled();
    });

    test('UC3 luồng đúng: M2 có đủ câu chữ 3 trạng thái của danh mục sản phẩm và lỗi QT-01 theo wireframe (S4)', async () => {
        const agent = await loginAs('lan.q10');
        const res = await agent.get('/customers/new');

        expect(res.text).toContain('<option value="">Đang tải…</option>');
        expect(res.text).toContain('Chưa có sản phẩm nào đang sử dụng');
        expect(res.text).toContain('Không tải được danh mục sản phẩm');
        expect(res.text).toContain('Số điện thoại đã tồn tại.');
        expect(res.text).toContain('Mở hồ sơ có sẵn');
    });

    test('UC3 luồng đúng: M2 mở từ M1 nên sidebar sáng mục M1, có nút quay lại lập phiếu', async () => {
        const agent = await loginAs('lan.q10');
        const res = await agent.get('/customers/new?phone=0901234567&customer_id=1');

        expect(res.text).toMatch(/href="\/tickets\/new" class="nav-item" aria-current="page"/);
        expect(res.text).toContain('Quay lại lập phiếu');
    });

    test('UC2 dữ liệu sai: chưa đăng nhập mở M2 → chuyển về trang đăng nhập', async () => {
        const res = await request(createApp(createTestDeps())).get('/customers/new');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });
});

describe('M3 · Danh sách phiếu của trung tâm (UC6)', () => {
    const COLUMNS = ['Mã phiếu', 'Khách hàng', 'Số điện thoại', 'Tên máy', 'Serial/IMEI',
        'Nhóm sự cố', 'Mức ưu tiên', 'Tình trạng bảo hành', 'Trạng thái', 'Tiếp nhận lúc',
        'Hạn cam kết', 'Quá hạn'];

    test('US7 luồng đúng: Tiếp nhận mở M3 → bảng đủ 12 cột của wireframe, tên trung tâm từ JWT, script gọi API', async () => {
        const deps = createTestDeps();
        const agent = await loginAs('lan.q10', deps);
        deps.repositories.ticket.listByCenter.mockClear();

        const res = await agent.get('/tickets');

        expect(res.status).toBe(200);
        COLUMNS.forEach((column) => expect(res.text).toContain(column));
        expect(res.text).toContain('Trung tâm: <span class="font-medium text-neutral-900">Trung tâm bảo hành Quận 10</span>');
        expect(res.text).toContain('Sắp theo Hạn cam kết tăng dần · 20 dòng/trang');
        expect(res.text).toContain('/public/js/ticket-list.js');
        // Dữ liệu lấy qua API 8 sau khi tải trang
        expect(deps.repositories.ticket.listByCenter).not.toHaveBeenCalled();
    });

    test('US7 luồng đúng: M3 có đủ câu chữ 3 trạng thái, phân trang và chú thích quá hạn theo wireframe (S4)', async () => {
        const agent = await loginAs('hung.q10');
        const res = await agent.get('/tickets?page=2');

        expect(res.status).toBe(200);
        expect(res.text).toContain('Đang tải danh sách phiếu…');
        expect(res.text).toContain('Trung tâm chưa có phiếu nào');
        expect(res.text).toContain('Không tải được danh sách phiếu');
        expect(res.text).toContain('« Trước');
        expect(res.text).toContain('Sau »');
        expect(res.text).toContain('Dòng tô đỏ = phiếu quá hạn (hạn cam kết đã qua, chưa Hoàn tất, Đã đóng hoặc Đã hủy)');
        expect(res.text).toContain('overflow-x-auto'); // UI6: bảng cuộn ngang
    });

    test('US7 dữ liệu sai: chưa đăng nhập mở M3 → chuyển về trang đăng nhập', async () => {
        const res = await request(createApp(createTestDeps())).get('/tickets');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });
});

describe('Khung trang navbar · sidebar · footer (TĐ-13, UI5)', () => {
    test('TĐ-13 luồng đúng: Tiếp nhận thấy mục M1 (đang mở) và M3 trên sidebar, navbar có Đăng xuất, có footer', async () => {
        const agent = await loginAs('lan.q10');
        const res = await agent.get('/tickets/new');

        expect(res.text).toMatch(/href="\/tickets\/new" class="nav-item" aria-current="page"/);
        expect(res.text).toContain('href="/tickets" class="nav-item"');
        expect(res.text).toContain('id="logout-button"');
        expect(res.text).toContain('Smart CRM – Mekong Mobile · Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành');
    });

    test('TĐ-13 luồng đúng: Quản lý trung tâm ở M3 không thấy mục M1, navbar có tên trung tâm, họ tên, vai trò', async () => {
        const agent = await loginAs('hung.q10');
        const res = await agent.get('/tickets');

        expect(res.status).toBe(200);
        expect(res.text).not.toContain('href="/tickets/new"');
        expect(res.text).toMatch(/href="\/tickets" class="nav-item" aria-current="page"/);
        expect(res.text).toContain('Trung tâm bảo hành Quận 10 · Đỗ Quốc Hùng (Quản lý trung tâm)');
    });

    test('TĐ-13 dữ liệu sai: Quản lý trung tâm mở M2 → chuyển về M3', async () => {
        const agent = await loginAs('hung.q10');
        const res = await agent.get('/customers/new?phone=0901234567');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/tickets');
    });

    test('HT1 luồng đúng: trang đăng nhập không có sidebar, có footer và dùng CSS dựng từ Tailwind (UI1)', async () => {
        const res = await request(createApp(createTestDeps())).get('/login');

        expect(res.text).not.toContain('id="sidebar"');
        expect(res.text).toContain('Smart CRM – Mekong Mobile · Luồng L2');
        expect(res.text).toContain('href="/public/css/app.css"');
        expect(res.text).not.toMatch(/cdn\.|fonts\.googleapis/); // không tải gì từ mạng (UI1, UI9)
    });
});
