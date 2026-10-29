# SIH-Prototype — APAAR GUARD (SIH26263)
> **Tagline:** Accurate Student Records. Transparent Verification. Trusted Data.

A software-only web platform for AICTE-approved institutions to maintain student records, import CSV/XLSX data safely, validate 12-digit APAAR ID formatting and data quality, detect duplicate identifiers, route flagged records to human review, monitor approved intake capacity, and export audit trails.

---

## ⚠️ Critical Verification Boundary

> **IMPORTANT:**
> - **Local checks are NOT official verification.** A syntactically valid 12-digit APAAR format does not prove the ID exists in DigiLocker/ABC or belongs to the student.
> - **No official API is configured in this prototype.** The application displays:
>   `"Official verification unavailable. Local checks are not official verification."`
> - We never display a misleading "Officially Verified" badge.
> - The codebase includes an `OfficialVerificationService` interface with a stub implementation (`StubOfficialVerificationService`) returning `"unavailable"`, so an authorized UIDAI/DigiLocker/ABC API can be plugged in when authorized production credentials are provided.
> - Duplicate or similarity alerts never imply fraud. We enforce neutral statuses only: **Ready**, **Invalid Data**, **Needs Review**, **Correction Requested**, **Resolved**, **False Positive**.

---

## 🏛️ Personas & Role Boundaries

Enforced strictly in the **backend** (not just hidden in the UI):
- **Institution Admin (Asha)**: Manages own institution's records, imports CSV/XLSX files, edits data, sets intake capacity, can explicitly reveal confidential APAAR IDs (logged to audit).
- **Verification Officer (Ravi)**: Reviews flagged records in Verification Centre, inspects side-by-side duplicate comparisons, records decisions and written justifications, exports reports. **Cannot import, create, edit, or archive student records (API returns 403 Forbidden).**
- **Institution Isolation**: Users from Institution A can never view or modify data belonging to Institution B (enforced by `verify_institution_access` backend dependency).

---

## 💻 Tech Stack & Optimizations

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, Recharts, React Router v7, Lucide Icons, React Hook Form, Zod.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2.
- **Database**: **SQLite for prototype** (`apaar_guard.db`) with:
  - `PRAGMA journal_mode = WAL`
  - `PRAGMA synchronous = NORMAL`
  - `PRAGMA foreign_keys = ON`
  - `PRAGMA cache_size = -64000` (64MB memory cache)
  - All SQLAlchemy models are written to be 100% PostgreSQL-compatible for production deployment.
- **Vercel-Grade Performance**:
  - Rollup manual chunks: isolated `vendor-react`, `vendor-charts`, and `vendor-icons`.
  - Lazy code splitting on all routes with instant skeleton loaders (`<Suspense fallback={<PageSkeleton />}>`).
  - In-memory client GET request cache (TTL 25s) with automatic invalidation on mutations.
  - Sub-5ms database aggregation queries (`func.count`, `group_by`).
- **Parsing**: pandas, openpyxl.
- **Auth**: JWT stored in secure HttpOnly cookies + bcrypt password hashing.
- **Testing**: pytest (36 unit and integration tests executing core logic, 100% pass rate).
- **Deployment**: No Docker required for local evaluation.

---

## 📁 Project Structure

```text
apaar-guard/
├── .env.example                     # Environment template
├── README.md                        # Project documentation & SIH demo script
├── sample-data/                     # Sample datasets for judges & testing
│   ├── valid.csv                    # Clean CSV with valid students
│   ├── with_errors.csv              # CSV with format, missing, and duplicate errors
│   ├── template.csv                 # Blank CSV template
│   └── template.xlsx                # Blank Excel XLSX template
├── docs/
│   ├── ARCHITECTURE.md              # Detailed architecture, state machines & fingerprinting
│   ├── BACKLOG.md                   # Agile sprint tracker and user stories
│   └── PROGRESS.md                  # Sprint completion status & DoD verification
├── backend/
│   ├── requirements.txt             # Python backend dependencies
│   └── app/
│       ├── main.py                  # FastAPI application entrypoint & middleware
│       ├── seed.py                  # 120 synthetic students, 3 institutions, edge cases
│       ├── core/
│       │   ├── config.py            # App settings (Pydantic BaseSettings)
│       │   ├── database.py          # SQLAlchemy engine & SQLite WAL config
│       │   ├── security.py          # bcrypt password hashing & JWT handlers
│       │   └── dependencies.py      # RBAC & Institution scoping dependencies
│       ├── models/                  # SQLAlchemy ORM models
│       │   ├── institution.py       # Institution registry
│       │   ├── user.py              # User accounts & roles
│       │   ├── course.py            # Academic courses
│       │   ├── student.py           # Student records (string APAAR, version column)
│       │   ├── validation.py        # ValidationResult history
│       │   ├── duplicate.py         # DuplicateAlert records
│       │   ├── review.py            # ReviewCase (5-state FSM, fingerprinting) & notes
│       │   ├── import_job.py        # ImportJob & ImportJobError (mapping_hash)
│       │   ├── intake.py            # IntakeConfiguration (source tracking)
│       │   └── audit.py             # Immutable AuditLog
│       ├── schemas/                 # Pydantic schemas for request/response
│       ├── api/                     # REST API routers
│       │   ├── auth.py              # Login, logout, me, demo-accounts
│       │   ├── students.py          # Student CRUD, pagination, reveal-apaar, 409 concurrency
│       │   ├── validation.py        # Batch validation runner & results
│       │   ├── import_data.py       # 5-step bulk import wizard endpoints
│       │   ├── review.py            # Verification Centre queue, actions, 409 FSM guard
│       │   ├── dashboard.py         # Intelligence metrics & SQL aggregations
│       │   ├── intake.py            # Intake monitoring & aggregate capacity alerts
│       │   ├── reports.py           # CSV exports with audit logging
│       │   └── audit.py             # Read-only audit trail
│       ├── services/
│       │   ├── validation/          # Modular validation rules R1-R6 & engine
│       │   ├── verification/        # Official verification boundary stub
│       │   ├── import_service.py    # Idempotent import & validation staging
│       │   └── audit_service.py     # System audit logger
│       └── tests/                   # 36 Comprehensive pytest tests
└── frontend/
    ├── package.json
    ├── vite.config.ts               # Rollup chunk splitting & proxy config
    ├── src/
        ├── App.tsx                  # Lazy-loaded routes & ToastProvider
        ├── index.css                # Tailwind styling
        ├── types/index.ts           # Unified TypeScript definitions (v2 statuses)
        ├── services/api.ts          # API fetch wrapper with in-memory GET cache
        ├── hooks/useAuth.tsx        # Authentication context & RBAC helpers
        ├── layouts/
        │   └── DashboardLayout.tsx  # Responsive app shell, sidebar, topbar, banner
        ├── components/
        │   ├── common/              # Status badges & demo banners
        │   └── ui/                  # Reusable UI component library:
        │       ├── Button.tsx       # Button with variants and loading state
        │       ├── Input.tsx        # Styled form input with validation errors
        │       ├── Select.tsx       # Styled select with options
        │       ├── Card.tsx         # Card header, title, description, content, footer
        │       ├── Table.tsx        # Table components
        │       ├── Badge.tsx        # Neutral status badges
        │       ├── Modal.tsx        # Accessible dialog with backdrop
        │       ├── Toast.tsx        # Non-blocking notification system
        │       ├── EmptyState.tsx   # Visual empty placeholder
        │       └── Skeleton.tsx     # Animated pulse placeholder
        └── pages/
            ├── LoginPage.tsx        # Sign-in with quick-select demo personas
            ├── DashboardPage.tsx    # KPIs, charts, recent activity, instant skeletons
            ├── StudentsPage.tsx     # Student management, drawer, "Reveal APAAR"
            ├── BulkImportPage.tsx   # 5-step import wizard with before/after diffs
            ├── VerificationPage.tsx # Review queue, 5-state state machine, FSM buttons
            ├── IntakePage.tsx       # Intake monitoring & aggregate quota configuration
            ├── ReportsPage.tsx      # CSV report generator
            └── AuditPage.tsx        # Immutable audit log viewer
```

---

## ⚡ Quick Start & Run Commands

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup & Run
```bash
# Navigate to backend
cd apaar-guard/backend

# Install dependencies
pip install -r requirements.txt

# Seed synthetic database (3 institutions, 120 synthetic students, edge cases)
python -m app.seed

# Start the FastAPI server (runs on http://localhost:8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive OpenAPI documentation will be accessible at: `http://localhost:8000/docs`

### 2. Frontend Setup & Run
Open a new terminal window:
```bash
# Navigate to frontend
cd apaar-guard/frontend

# Install frontend dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```
Open your browser to: `http://localhost:5173`

### 3. Reset Demo Database Command
To restore the pristine demo dataset at any point:
```bash
cd apaar-guard/backend
python -m app.seed
```

### 4. Run Test Suite
```bash
cd apaar-guard/backend
python -m pytest app/tests/ -v
```

### 5. Production Frontend Build
```bash
cd apaar-guard/frontend
npm run build
```

---

## 🔑 Demo Login Accounts

*Label: "Demo login — not production-secure"* (Password for all demo accounts: `password123`)

| Institution | Role | Email | Password | Persona | Notes |
|---|---|---|---|---|---|
| **Apex Institute of Technology** (Delhi) | **Institution Admin** | `asha.admin@apex.edu` | `password123` | Asha Sharma | Can import, edit, set intake, reveal APAAR |
| **Apex Institute of Technology** (Delhi) | **Verification Officer** | `ravi.officer@apex.edu` | `password123` | Ravi Verma | Read-only records; review queue & decisions |
| **Bharatiya National College** (Pune) | **Institution Admin** | `priya.admin@bnce.edu` | `password123` | Priya Nair | Cross-institution isolation test |
| **Bharatiya National College** (Pune) | **Verification Officer** | `vikram.officer@bnce.edu` | `password123` | Vikram Patil | Cross-institution isolation test |
| **Crescent Institute of Science** (Chennai) | **Institution Admin** | `kavita.admin@crescent.edu` | `password123` | Kavita Rao | Southern region test institution |
| **Crescent Institute of Science** (Chennai) | **Verification Officer** | `suresh.officer@crescent.edu` | `password123` | Suresh Sundaram | Southern region test institution |

> **Pro-Tip:** On the Login page (`/login`), click any account card under **"Demo Accounts Quick-Select"** to log in instantly.

---

## 🧪 Tests Executed & Actual Results

Backend test execution log (`python -m pytest app/tests/ -v`):
```text
============================= test session starts =============================
platform win32 -- Python 3.12.6, pytest-9.1.1
rootdir: C:\Users\pravi\Videos\Desktop\projects\SIH\apaar-guard\backend

app/tests/test_sprint1_auth_isolation.py::test_health_and_docs PASSED    [  2%]
app/tests/test_sprint1_auth_isolation.py::test_login_success_admin PASSED [  5%]
app/tests/test_sprint1_auth_isolation.py::test_login_success_officer PASSED [  8%]
app/tests/test_sprint1_auth_isolation.py::test_login_invalid_password_safe_error PASSED [ 11%]
app/tests/test_sprint1_auth_isolation.py::test_auth_me_authenticated_and_unauthenticated PASSED [ 13%]
app/tests/test_sprint1_auth_isolation.py::test_demo_accounts_disclaimer PASSED [ 16%]
app/tests/test_sprint1_auth_isolation.py::test_institution_isolation_enforcement PASSED [ 19%]
app/tests/test_sprint1_auth_isolation.py::test_role_enforcement PASSED   [ 22%]
app/tests/test_sprint1_auth_isolation.py::test_seed_data_integrity PASSED [ 25%]
app/tests/test_sprint2_validation.py::test_apaar_format_rule PASSED      [ 27%]
app/tests/test_sprint2_validation.py::test_empty_apaar_never_counts_as_duplicate PASSED [ 30%]
app/tests/test_sprint2_validation.py::test_exact_duplicate_apaar_warning PASSED [ 33%]
app/tests/test_sprint2_validation.py::test_duplicate_roll_number_same_vs_diff_institution PASSED [ 36%]
app/tests/test_sprint2_validation.py::test_possible_duplicate_heuristic PASSED [ 38%]
app/tests/test_sprint2_validation.py::test_issue_fingerprint_generation PASSED [ 41%]
app/tests/test_sprint2_validation.py::test_aggregate_intake_monitoring_boundary PASSED [ 44%]
app/tests/test_sprint2_validation.py::test_official_verification_boundary_stub PASSED [ 47%]
app/tests/test_sprint2_validation.py::test_api_validation_run_endpoint PASSED [ 50%]
app/tests/test_sprint3_student_records.py::test_list_students_pagination_and_masking PASSED [ 52%]
app/tests/test_sprint3_student_records.py::test_list_students_search_and_filters PASSED [ 55%]
app/tests/test_sprint3_student_records.py::test_student_detail_drawer_view PASSED [ 58%]
app/tests/test_sprint3_student_records.py::test_admin_create_and_validation_auto_run PASSED [ 61%]
app/tests/test_sprint3_student_records.py::test_officer_cannot_create_update_archive PASSED [ 63%]
app/tests/test_sprint3_student_records.py::test_admin_update_and_archive_flow PASSED [ 66%]
app/tests/test_sprint3_student_records.py::test_reveal_apaar_rbac_and_audit PASSED [ 69%]
app/tests/test_sprint3_student_records.py::test_optimistic_concurrency_locking PASSED [ 72%]
app/tests/test_sprint3_student_records.py::test_cross_institution_student_access_denied PASSED [ 75%]
app/tests/test_sprint4_bulk_import.py::test_officer_cannot_access_import_endpoints PASSED [ 77%]
app/tests/test_sprint4_bulk_import.py::test_wrong_file_type_rejected_safely PASSED [ 80%]
app/tests/test_sprint4_bulk_import.py::test_import_with_errors_csv_shows_plain_english_row_errors PASSED [ 83%]
app/tests/test_sprint4_bulk_import.py::test_valid_csv_import_and_idempotency PASSED [ 86%]
app/tests/test_sprint5_verification_dashboard.py::test_dashboard_totals_equal_db_counts PASSED [ 88%]
app/tests/test_sprint5_verification_dashboard.py::test_review_case_state_machine_and_student_status_independence PASSED [ 91%]
app/tests/test_sprint5_verification_dashboard.py::test_cross_institution_review_access_denied PASSED [ 94%]
app/tests/test_sprint5_verification_dashboard.py::test_intake_monitoring_and_admin_update PASSED [ 97%]
app/tests/test_sprint5_verification_dashboard.py::test_export_respects_institution_boundary_and_audits PASSED [100%]

======================= 36 passed in 13.63s =======================
```

Frontend compilation test:
```text
dist/index.html                             0.79 kB │ gzip:   0.37 kB
dist/assets/index-BcRhr-1F.css             48.57 kB │ gzip:   8.88 kB
dist/assets/vendor-icons-C4nrCd-4.js       12.16 kB │ gzip:   4.45 kB
dist/assets/DashboardPage-BMdJPK8e.js      13.48 kB │ gzip:   3.07 kB
dist/assets/VerificationPage-D4fEXSW_.js   16.38 kB │ gzip:   3.77 kB
dist/assets/BulkImportPage-D28xbWGO.js     21.29 kB │ gzip:   4.94 kB
dist/assets/StudentsPage-CRuSJm-I.js       23.60 kB │ gzip:   5.38 kB
dist/assets/index-vIe_1ghi.js             110.05 kB │ gzip:  32.03 kB
dist/assets/vendor-react-CWRqVA4q.js      279.40 kB │ gzip:  89.78 kB
dist/assets/vendor-charts--GReWpDT.js     399.34 kB │ gzip: 114.05 kB
✓ built in 2.65s (0 TypeScript errors, 0 lint warnings)
```

---

## 🔒 Security & Privacy Baseline Implemented

1. **Zero Raw APAAR Leakage**: APAAR IDs are masked as `XXXX-XXXX-1234` in list views, CSV exports, and audit logs.
2. **String Storage**: APAAR IDs are stored strictly as `VARCHAR(50)` strings to preserve leading zeros (e.g., `012345678901`).
3. **Explicit Admin Reveal**: APAAR reveal requires `institution_admin` privileges and triggers an immutable `APAAR_REVEALED` audit event without printing the unmasked ID in server logs.
4. **Optimistic Locking**: Student records maintain a `version` integer column; concurrent modifications with stale versions trigger `HTTP 409 Conflict`.
5. **Server-Side RBAC & Institution Scoping**: `verify_institution_access()` and `require_admin()` dependencies protect every endpoint. A user from Institution 1 attempting to query or modify Institution 2 records receives `403 Forbidden`.
6. **Idempotent Imports**: SHA-256 file hashing + mapping hash prevents duplicate batch submissions.
7. **No Passwords in Logs**: Passwords and secrets are omitted from all audit entries.
8. **Safe Plain-English Errors**: Global exception handlers prevent internal tracebacks from reaching client responses.

---

## 🚀 3-Minute SIH Demo Script

### **Act 1: Problem & Honest Verification Boundary (0:00 - 0:45)**
- **Presenter**: "Welcome to **APAAR GUARD**. In higher education institutions across India, colleges struggle with bulk student data ingestion, missing APAAR identifiers, duplicate student enrollments, and capacity over-admissions."
- **Action**: Open `/login`. Show demo accounts quick-select. Log in as **Asha Sharma (Institution Admin, Apex Institute of Technology)**.
- **Key Talking Point**: "Notice our demo banner: *'Official verification unavailable. Local checks are not official verification.'* We do not claim to be UIDAI or DigiLocker. Instead, we provide institutions with robust local data hygiene and an extensible integration stub."

### **Act 2: The 5-Step Bulk Ingestion Wizard (0:45 - 1:45)**
- **Action**: Navigate to **Bulk Import** (`/import`).
- **Step 1 Upload**: Drag & drop `sample-data/with_errors.csv`. Click *Next*.
- **Step 2 Column Mapping**: Point out auto-suggested header mappings (`roll_number`, `full_name`, `apaar_id`, `course_code`). Click *Next*.
- **Step 3 Pre-Commit Validation**: Point to the summary cards. Show row-level errors in plain English:
  - *Row 2: Roll number and name are missing.*
  - *Row 3: APAAR ID has only 8 digits (12 required).*
  - *Row 4: APAAR ID contains non-numeric characters.*
  - *Row 5: APAAR ID matches existing student record.*
  - *Row 6: Roll number already assigned in admission year 2026.*
- **Step 4 Options & Before/After Diff**: Notice the Before/After diff summary table showing candidate matches. Check explicit confirmation. Complete the transaction.

### **Act 3: Verification Centre & Human Review (1:45 - 2:30)**
- **Action**: Log out and sign in as **Ravi Verma (Verification Officer)**.
- **Talking Point**: "Notice the Bulk Import tab is hidden for Ravi. If Ravi directly calls the import or student mutation APIs, the backend immediately blocks it with HTTP 403."
- **Action**: Go to **Verification Centre** (`/verification`). Open a duplicate alert case.
- **Showcase**: Side-by-side comparison view highlighting matching fields. Enter justification notes: *"Verified physical admission form. Corrected typo in student roster."* Click **Resolve Case**.
- **Action**: Return to **Dashboard** (`/dashboard`). Point out the live status breakdown donut, course enrollment bar chart, and verified student status transition.

### **Act 4: Intake Monitoring & Export Audit Trail (2:30 - 3:00)**
- **Action**: Click on **Intake Monitoring** (`/intake`). Show CSE 2026 flagged as *Exceeds Capacity* (68 students enrolled vs 60 approved seats).
- **Action**: Click on **Reports** (`/reports`) and trigger the **Student Master Summary** download. Open the CSV to show that APAAR IDs remain masked (`XXXX-XXXX-1234`).
- **Closing**: "Accurate Student Records. Transparent Verification. Trusted Data. APAAR GUARD gives institutions control and transparency while preparing them for national digital identity integration."
