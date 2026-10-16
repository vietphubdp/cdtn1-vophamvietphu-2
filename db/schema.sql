-- =========================================================================
-- db/schema.sql · Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành
-- PostgreSQL 16 · khớp ERD (docs/erd.drawio) · chạy lại nhiều lần không lỗi
-- Mã quy tắc (QT-xx) và yêu cầu (FRx, NFRx) ghi ngay tại ràng buộc để truy vết.
-- (*) = phi chuẩn hóa có chủ ý, lý do ở Mục 4.3 của tài liệu BT1.
-- =========================================================================

-- ---------- Bảng dùng chung (ngoài L2, dựng tối thiểu để tham chiếu) ----------
CREATE TABLE IF NOT EXISTS service_center (
    center_id     BIGSERIAL    PRIMARY KEY,
    center_name   VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS employee (
    employee_id   BIGSERIAL    PRIMARY KEY,
    full_name     VARCHAR(120) NOT NULL,
    role          VARCHAR(20)  NOT NULL
                  CHECK (role IN ('TIEP_NHAN', 'QUAN_LY_TRUNG_TAM')),
    center_id     BIGINT       NOT NULL REFERENCES service_center (center_id),
    username      VARCHAR(50)  NOT NULL UNIQUE,   -- đăng nhập tài khoản mẫu (W13)
    password_hash VARCHAR(100) NOT NULL           -- chỉ lưu mã băm
);

-- ---------- 6 bảng của luồng L2 ----------
CREATE TABLE IF NOT EXISTS customer (
    customer_id   BIGSERIAL    PRIMARY KEY,
    full_name     VARCHAR(120) NOT NULL,
    phone         VARCHAR(10)  NOT NULL UNIQUE    -- QT-01
                  CHECK (phone ~ '^0[0-9]{9}$'),  -- QT-02
    email         VARCHAR(120),
    address       VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product (
    product_id              BIGSERIAL    PRIMARY KEY,
    product_name            VARCHAR(120) NOT NULL UNIQUE,
    default_warranty_months SMALLINT     NOT NULL DEFAULT 12
                            CHECK (default_warranty_months BETWEEN 1 AND 60),
    is_active               BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS device (
    device_id       BIGSERIAL   PRIMARY KEY,
    customer_id     BIGINT      NOT NULL REFERENCES customer (customer_id),
    product_id      BIGINT      NOT NULL REFERENCES product (product_id),
    serial_no       VARCHAR(50) NOT NULL UNIQUE,  -- QT-03
    purchase_date   DATE,                         -- trống: chưa xác minh (QT-05)
    warranty_months SMALLINT    NOT NULL DEFAULT 12  -- (*) FR4
                    CHECK (warranty_months BETWEEN 1 AND 60),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_category (
    category_id      SERIAL      PRIMARY KEY,
    category_name    VARCHAR(60) NOT NULL UNIQUE,
    default_priority VARCHAR(10) NOT NULL
                     CHECK (default_priority IN ('CAO', 'TRUNG_BINH', 'THAP')),
    is_active        BOOLEAN     NOT NULL DEFAULT true   -- NFR5
);

CREATE TABLE IF NOT EXISTS ticket (
    ticket_id       BIGSERIAL   PRIMARY KEY,
    ticket_code     VARCHAR(20) NOT NULL UNIQUE
                    CHECK (ticket_code ~ '^BH[0-9]{6}/[0-9]{4}$'),  -- BH000123/2026
    customer_id     BIGINT      NOT NULL REFERENCES customer (customer_id),  -- (*)
    device_id       BIGINT      NOT NULL REFERENCES device (device_id),
    center_id       BIGINT      NOT NULL REFERENCES service_center (center_id),
    category_id     INT         REFERENCES issue_category (category_id),  -- FR7
    issue_desc      TEXT        NOT NULL
                    CHECK (char_length(issue_desc) BETWEEN 10 AND 2000),
    priority        VARCHAR(10) NOT NULL
                    CHECK (priority IN ('CAO', 'TRUNG_BINH', 'THAP')),
    status          VARCHAR(20) NOT NULL DEFAULT 'MOI'      -- vòng đời Hình 6.2
                    CHECK (status IN ('MOI', 'DA_PHAN_CONG', 'DANG_XU_LY',
                           'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG', 'DA_HUY')),
    warranty_status VARCHAR(15) NOT NULL                    -- (*) QT-05
                    CHECK (warranty_status IN ('CON_BAO_HANH', 'HET_BAO_HANH',
                                               'CHUA_XAC_MINH')),
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date        TIMESTAMPTZ NOT NULL,                   -- QT-04
    idempotency_key UUID        NOT NULL UNIQUE,            -- NFR4
    CONSTRAINT chk_ticket_due_after_received CHECK (due_date > received_at)
);

CREATE TABLE IF NOT EXISTS ticket_status_log (
    log_id      BIGSERIAL   PRIMARY KEY,
    ticket_id   BIGINT      NOT NULL REFERENCES ticket (ticket_id),
    from_status VARCHAR(20),                     -- NULL ở dòng đầu tiên (FR6)
    to_status   VARCHAR(20) NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by  BIGINT      NOT NULL REFERENCES employee (employee_id),
    note        VARCHAR(255),
    CONSTRAINT chk_log_to_status CHECK (to_status IN ('MOI', 'DA_PHAN_CONG',
        'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG', 'DA_HUY'))
);

-- Sinh số thứ tự cho mã phiếu BH000123/2026, an toàn khi nhiều người lưu cùng lúc
CREATE SEQUENCE IF NOT EXISTS ticket_code_seq;

-- ---------- INDEX (ngoài khóa chính) ----------
CREATE INDEX IF NOT EXISTS idx_ticket_center_due
    ON ticket (center_id, due_date);              -- FR10, FR11, NFR1
CREATE INDEX IF NOT EXISTS idx_device_customer
    ON device (customer_id);                      -- FR3
CREATE INDEX IF NOT EXISTS idx_log_ticket
    ON ticket_status_log (ticket_id, changed_at); -- FR6
-- Các cột UNIQUE (customer.phone, device.serial_no, ticket.idempotency_key)
-- được PostgreSQL tự tạo index: phục vụ FR1 + NFR1, QT-03, NFR4.
