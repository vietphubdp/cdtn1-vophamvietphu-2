# Deployment Guide — Mekong Mobile Smart CRM (Flow L2)

**Track:** Software Engineering (SE)  
**Flow:** L2 – Warranty Intake & Classification  
**Release Tag:** `v1.0`  
**Author:** Vo Pham Viet Phu (Student ID: `2374802010391`)  
**Course:** Graduation Internship / Capstone Topic 1 (Chuyen de Tot nghiep 1) — Faculty of IT, Van Lang University  

---

## 1. Requirements

The entire application runs inside containerised Docker environments. No local Node.js or PostgreSQL runtime is required on the host machine:

- **Operating System:** Linux (Ubuntu 22.04 LTS or newer), macOS 13+, or Windows 10/11 (with Docker Desktop and WSL 2 backend).
- **Container Engine:** Docker Engine 24.0+ and Docker Compose v2.20+ (verify with `docker compose version`).
- **Version Control:** Git 2.30+.
- **Disk Space:** Approximately 2.0 GB free disk space for container base images, node modules, and PostgreSQL data volume.
- **Memory (RAM):** Minimum 2 GB available RAM (4 GB recommended).
- **Network Ports:** Port `3000` free on host (can be customized via `PORT` in `.env`). Port `5432` of PostgreSQL remains internal and is not exposed to host to avoid conflicts.

---

## 2. Setup Steps (Clean-Machine Reproduction)

Execute the following commands from a clean working directory:

### Step 1: Clone Repository at Tag `v1.0`
```bash
git clone --branch v1.0 https://github.com/vietphubdp/cdtn1-vophamvietphu-2.git
cd cdtn1-vophamvietphu-2
```

### Step 2: Configure Environment Variables
```bash
cp .env.example .env
```
*(On Windows Command Prompt `cmd`, use `copy .env.example .env`)*. The default template values work out-of-the-box for Docker environments.

### Step 3: Build and Start Containers
```bash
docker compose up -d --build
```

> **Automated Lifecycle Notice:**  
> On startup, Docker Compose starts the PostgreSQL container first. The Node.js application container waits until PostgreSQL passes its healthcheck (`condition: service_healthy`), then automatically executes schema migration (`db/schema.sql`) and sample data seeding (`db/seeds/*.js`) before launching the HTTP server. No manual migration or seeding command is needed.

---

## 3. Environment Variables Reference

All runtime configurations are declared in `.env` and documented in `.env.example`. Secrets are never committed into Git history:

| Variable Name | Required | Default / Sample Value | Purpose & Security Role |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `3000` | Host port mapped to the web application container. |
| `DB_HOST` | Yes | `db` | Hostname of PostgreSQL service on Docker network. |
| `DB_PORT` | Yes | `5432` | Internal database listening port. |
| `DB_NAME` | Yes | `smartcrm` | Target PostgreSQL database name. |
| `DB_USER` | Yes | `smartcrm` | Database username. |
| `DB_PASSWORD` | Yes | `doi-mat-khau-nay` | Database password (read securely from environment). |
| `JWT_SECRET` | Yes | `c0d3_s3cr3t_must_b3_at_l3ast_32_chars_long!!` | HMAC-SHA256 signature secret key ($\ge$ 32 characters). |
| `JWT_EXPIRES_IN`| No | `8h` | Lifetime of authentication JWT tokens. |
| `LOG_LEVEL` | No | `info` | Minimum log severity: `debug`, `info`, `warn`, `error`. |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Whitelisted HTTP origins for CORS validation. |

---

## 4. Sample Data & Demo Accounts

The automated seeding process loads baseline synthetic datasets adapted from the official Mekong Mobile case study:
- **6 Service Centres:** Quận 10 (ID 1), Tân Bình (ID 2), Thủ Đức (ID 3), Ninh Kiều (ID 4), Cái Răng (ID 5), Cầu Giấy (ID 6).
- **6 Staff Accounts:** 3 Intake Officers + 3 Centre Managers with bcrypt-hashed credentials (`Demo@2026`).
- **27 Product Models & 6 Issue Categories:** Screen (`MAN_HINH`), Battery (`PIN`), Charger/Port (`SAC`), Software (`PHAN_MEM`), Water Damage (`NUOC_VAO`), Others (`KHAC`).
- **31 Customer Records, 38 Registered Devices, and 30 Warranty Tickets.**

### Demo Credentials for Evaluation:
| Username | Password | Role | Assigned Centre & Permissions |
| :--- | :--- | :--- | :--- |
| `lan.q10` | `Demo@2026` | `TIEP_NHAN` | **Centre 1 (Quận 10) – Intake Officer:** Customer lookup, device intake, create & edit tickets (state MOI), view centre tickets (masked phone). |
| `hung.q10` | `Demo@2026` | `QUAN_LY_TRUNG_TAM` | **Centre 1 (Quận 10) – Centre Manager:** Unmasked phone viewing, ticket cancellation, warranty eligibility determination for unverified cases. |
| `mai.tb` | `Demo@2026` | `TIEP_NHAN` | **Centre 2 (Tân Bình) – Intake Officer:** Cross-centre access verification (modifying Centre 1 tickets returns HTTP 403 / 404). |

---

## 5. Verify It Works

Verify the deployment status using three standard verification commands:

### Verification 1: Container Health Inspection
```bash
docker compose ps
```
**Expected Output:** Both `app` and `db` services report state `Up (healthy)`.

### Verification 2: Health Endpoint Query
```bash
curl -s http://localhost:3000/health
```
**Expected Output:** HTTP 200 JSON payload:
```json
{"status":"ok","db":"up"}
```

### Verification 3: Run Full Test Suite Inside Container
```bash
docker compose exec app npm test
```
**Expected Output:** **38 test suites passed, 505 tests passed (100% PASS)**.

### Verification 4: Idempotent Seed Re-execution (Criterion C8)
```bash
docker compose exec app node db/seed.js
```
**Expected Output:** Confirms `0 rows inserted` without errors or duplication (`ON CONFLICT DO NOTHING`).

### Verification 5: Interactive Web UI Access
Open a web browser at `http://localhost:3000`. Log in as `lan.q10` with password `Demo@2026` to test customer search and ticket creation.

---

## 6. Production Monitoring & Alerts

In production environments, the system logs structured JSON lines tagged with a unique correlation identifier (`X-Request-Id`). The service implements two alerts complying with the mandatory 4-component specification (Measure, Threshold, Notify, Action):

### ALERT-01: High API 5xx Error Rate (Technical Incident)
- **Measure:** Ratio of HTTP 5xx server errors over total incoming API requests on `/api/*` within a rolling 5-minute evaluation window.
- **Threshold:** > 2% 5xx errors across 2 consecutive 5-minute windows.
- **Notify:** On-duty Site Reliability Engineer (SRE) / DevOps via Telegram / Slack webhook.
- **Action:**
  1. Inspect container logs filtered by request IDs of failed calls:  
     `docker compose logs app --tail 100`
  2. If PostgreSQL is unreachable or exhausted, restart the database container:  
     `docker compose restart db`
  3. Re-check health endpoint: `curl -s http://localhost:3000/health` (must return `"db":"up"`).
  4. If failure persists beyond 10 minutes, escalate to senior backend developer.

### ALERT-02: Tickets Approaching SLA Committed Deadline (Business Incident)
- **Measure:** Count of active tickets in state `MOI` or `DANG_XU_LY` due within the next 4 hours across each service centre.
- **Threshold:** > 10 tickets near deadline, or $2\times$ the volume of the same hour last week.
- **Notify:** Service Centre Manager via internal alert email.
- **Action:**
  1. Open Dashboard filtered by near-due tickets (`/tickets?status=MOI`).
  2. Reassign critical and high-priority warranty tickets to available senior repair technicians.
  3. Contact affected customers in advance if inspection cannot be completed on time.

---

## 7. Production HTTPS & Security Proxy

When deploying to a public cloud or production server:
1. **TLS Termination:** Place the application behind a reverse proxy (e.g. Nginx, Caddy, or AWS ALB) with a valid SSL/TLS certificate.
2. **Proxy Trust:** Enable `app.set('trust proxy', 1)` in Express so that `req.protocol` correctly evaluates the `X-Forwarded-Proto: https` header sent by the reverse proxy.
3. **Secure Cookies:** Set `NODE_ENV=production` in `.env`. The authentication cookie automatically enforces `secure: true`, ensuring session tokens are exclusively transmitted over HTTPS encrypted channels.

---

## 8. Troubleshooting

| Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Port 3000 is occupied by another application on host. | Update `PORT=3001` in `.env`, then re-run `docker compose up -d`. |
| `ECONNREFUSED db:5432` during container startup | Application attempted to connect before PostgreSQL was ready. | Docker Compose already enforces `condition: service_healthy`. If manual testing, wait 5 seconds and retry. |
| `relation "ticket" does not exist` | Existing Docker volume bypassed initial table creation. | Reset environment completely: `docker compose down -v && docker compose up -d --build`. |
| Seed script fails with conflict | Previous seed data partially modified. | Run `docker compose down -v` to reset PostgreSQL volume to a clean state. |
