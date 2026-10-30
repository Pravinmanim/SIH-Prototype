# APAAR GUARD (SIH26263)
> **Accurate Student Records. Transparent Verification. Trusted Data.**

A software-only web platform for AICTE-approved institutions and regulatory authorities to validate student records, detect duplicate and inconsistent APAAR identifiers across institutions, manage intake capacities and supernumerary admissions, record verifiable student consent workflow events, and provide high-level national regulatory oversight without compromising personal data privacy.

---

## ⚠️ Critical Verification & Regulatory Boundary

> **IMPORTANT:**
> - **Local checks are NOT official identity verification.** Syntactic 12-digit format checks (Verhoeff checksum) and local cross-institution duplicate heuristics do not constitute official DigiLocker or UIDAI verification.
> - **No live government APIs are connected.** The platform displays an unambiguous notice across all relevant interfaces:
>   `"Official verification unavailable. Local checks are not official verification."`
> - **Consent is a staff-recorded workflow record.** In this prototype, student consent records represent institutional administrative tracking. They do not independently establish legally verified DPDP consent or direct digital signatures.
> - **Zero Fraud Accusations.** Alerts are strictly operational data-quality flags: `Ready`, `Invalid Data`, `Needs Review`, `Pending Review`, `In Progress`, `Correction Requested`, `Resolved`, and `False Positive`.

---

## 🏛️ Personas & Role Boundaries

Enforced strictly in backend dependencies and database queries (not merely hidden in UI):

| Role | Persona / Level | Permissions | Restricted Actions |
|---|---|---|---|
| **Institution Admin** | Asha Sharma (Apex Institute) | Full CRUD on own institution's students, bulk CSV/XLSX imports, approved intake & supernumerary configuration, audited APAAR reveal, staff consent recording. | Cannot access other institutions' records. Cannot access `/api/regulator/*` national monitoring endpoints. |
| **Verification Officer** | Ravi Verma (Apex Institute) | Review flagged cases in Verification Centre, inspect duplicate comparison, record resolutions/justifications, view student profiles, record consent. | Cannot create, update, or delete student records. Cannot run bulk imports. Cannot access `/api/regulator/*` endpoints. |
| **AICTE Regulator** | Dr. Rajesh Kumar (AICTE HQ) | National oversight dashboard (`/regulator`), institution-level aggregate statistics, program intake utilization, data-quality indicators, duplicate review summaries. | **STRICTLY BLOCKED** from student-level records, individual consent histories, student reveal, and institution-specific operational endpoints. |

---

## 💻 Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, Recharts, React Router v7, Lucide Icons, React Hook Form, Zod.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Starlette.
- **Database**: SQLite WAL mode for prototype (`apaar_guard.db`) with `PRAGMA foreign_keys = ON`, `PRAGMA synchronous = NORMAL`. Models are 100% PostgreSQL-compatible.
- **Security & RBAC**: JWT bearer tokens, secure HttpOnly cookies, bcrypt hashing, tenant-scoping dependencies (`verify_institution_access`), immutable audit logging (`AuditLog`, `StudentConsentEvent`).
- **Data Protection**: 12-digit APAAR stored as `VARCHAR(50)` strings (preserving leading zeros), masked across UI and CSV exports (`XXXX-XXXX-1234`), non-sensitive local record references (`AG-INST...`), and scrubbed cross-institution duplicate alerts.

---

## 📁 Repository Structure

```text
apaar-guard/
├── README.md                        # Complete project manual & demo guide
├── sample-data/                     # Sample datasets for judges & testing
│   ├── valid.csv                    # Clean CSV with valid students
│   ├── with_errors.csv              # CSV with format, missing, and duplicate errors
│   ├── template.csv                 # Blank CSV template
│   └── template.xlsx                # Blank Excel XLSX template
├── backend/
│   ├── requirements.txt             # Python backend dependencies
│   ├── apaar_guard.db               # SQLite database (WAL mode)
│   └── app/
│       ├── main.py                  # FastAPI entrypoint, lifespan & non-destructive schema updater
│       ├── provision_regulator.py   # Secure administrative CLI for regulator provisioning
│       ├── seed.py                  # Synthetic multi-institution seeding script
│       ├── core/                    # Config, security, database engine, RBAC dependencies
│       ├── models/                  # SQLAlchemy models (Institution, User, Student, Consent, etc.)
│       ├── schemas/                 # Pydantic schemas (Student, Intake, Consent, Regulator, Auth)
│       ├── api/                     # Modular API routers (students, intake, consent, regulator, etc.)
│       ├── services/                # Validation engine, duplicate collision sync, audit service
│       └── tests/                   # 128 Automated pytest regression & integration tests
└── frontend/
    ├── package.json
    ├── vite.config.ts               # Production build & proxy config
    └── src/
        ├── App.tsx                  # Lazy-loaded routes & role-based route guards
        ├── types/index.ts           # Centralized TypeScript interfaces
        ├── services/api.ts          # Axios/fetch API wrapper with client caching
        ├── pages/                   # All UI screens (Dashboard, Students, Intake, Regulator, etc.)
        └── components/              # UI components (Student ID Card, StatusBadge, Toast, Modal)
```

---

## ⚡ Setup & Execution Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup & Run
```bash
# Navigate to backend
cd apaar-guard/backend

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server (runs on http://127.0.0.1:8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive OpenAPI documentation will be accessible at: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup & Run
Open a second terminal window:
```bash
# Navigate to frontend
cd apaar-guard/frontend

# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```
Open your browser to: `http://localhost:5173`

### 3. Database Initialization & Migration
- **Automatic Initialization**: On first launch, the database tables and idempotent schema updates are initialized automatically.
- **Safe Non-Destructive Migrations**: The `ensure_schema_updates()` utility automatically adds newly introduced columns (`admission_category`, `is_supernumerary`, `supernumerary_intake`) without deleting or resetting existing tables.
- **Re-seeding Demo Data (Optional)**:
  ```bash
  cd apaar-guard/backend
  python -m app.seed
  ```

### 4. Administrative Regulator Account Provisioning
In production or staging environments where demo accounts are disabled, regulators are provisioned via the secure administrative CLI:
```bash
cd apaar-guard/backend
python -m app.provision_regulator --email dr.rajesh@aicte.gov.in --name "Dr. Rajesh Kumar" --password "<secure-password>"
```

---

## 🔑 Demo Login Accounts

*Label: "Demo login — not production-secure"* (Password for all demo accounts: `password123`)

| Role | Email | Institution / Scope | Access Level |
|---|---|---|---|
| **Institution Admin** | `asha.admin@apex.edu` | Apex Institute of Technology (Delhi) | Full institution management, student CRUD, imports, intake configuration, audited reveal. |
| **Verification Officer** | `ravi.officer@apex.edu` | Apex Institute of Technology (Delhi) | Verification queue, review decisions, student profile inspection, staff consent recording. |
| **Institution Admin (Peer)** | `suresh.admin@bnce.edu` | Bharatiya National College (Pune) | Used to demonstrate cross-institution duplicate collision and tenant isolation. |
| **Verification Officer (Peer)** | `priya.officer@bnce.edu` | Bharatiya National College (Pune) | Peer verification personnel. |
| **AICTE Regulator** | `rajesh.regulator@aicte.gov.in` | National AICTE Oversight | National overview, institution comparisons, intake alerts, duplicate review summaries (aggregate only). |

---

## 🧪 Comprehensive Automated Test Results

### 1. Full Backend Test Suite
```bash
cd apaar-guard/backend
python -m pytest app/tests/ -v
```
**Outcome: 128 PASSED, 0 FAILED** in 61.2s across all test modules:
- `test_phase1_bugfixes.py`: Notification queries, canonical review case status, student filtering.
- `test_phase2_student_card.py`: ID card access, local record reference privacy, masked APAAR, reveal auditing.
- `test_phase3_cross_institution_duplicates.py`: Multi-tenant collision detection, peer masking, false-positive resolution.
- `test_phase4_intake_categories.py`: Approved intake vs supernumerary admissions, category totals (NRI, OCI, FN, General).
- `test_phase5_regulator_dashboard.py`: Regulator aggregate overview, institution monitoring, strict student-level 403 blocks.
- `test_phase6_consent_and_security.py`: Student consent states, event history immutability, zero-secret demo discovery.
- `test_phase7_final_integration_and_security.py`: Complete end-to-end integration flow, schema idempotency, CLI provisioning.
- `test_sprint1_auth_isolation.py` through `test_sprint5_verification_dashboard.py`: Core sprint regressions.
- `test_validation_comprehensive.py`: Verhoeff checksum, Indian phone, calendar DOB, and input validation.

### 2. Frontend Production Build
```bash
cd apaar-guard/frontend
npm run build
```
**Outcome: Built in ~900ms with 0 TypeScript errors and 0 lint warnings.**

---

## 🚀 Hackathon 5-Minute Demonstration Checklist

Follow this sequence during judge evaluations for a smooth presentation:

### Step 1: Sign in as Institution Admin & Inspect Intake (0:00 - 1:00)
1. Navigate to `http://localhost:5173/login`.
2. Click **Asha Sharma (Institution Admin)** under Demo Quick-Select.
3. Show the **Dashboard**: Highlight active enrolled count, data quality breakdown, and capacity status.
4. Navigate to **Intake Capacity** (`/intake`):
   - Highlight that **Regular Approved Intake** and **Supernumerary Quotas** (NRI, OCI, FN) are tracked separately.
   - Point out course utilization badges and over-capacity warnings.

### Step 2: Student Creation, Leading Zeros & Cross-Institution Duplicates (1:00 - 2:15)
1. Navigate to **Students** (`/students`) and click **Add Student**:
   - Enter Roll Number: `CS-2026-901`
   - Enter Full Name: `Ananya Deshmukh`
   - Enter APAAR ID with leading zeros: `004512789632`
   - Select Admission Category: `NRI` (Supernumerary: Yes)
2. Submit and view the record in the list:
   - Point out that leading zeros are preserved and displayed masked as `XXXXXXXX9632`.
3. Open Student Drawer:
   - Click **Reveal (Audited)**: Notice unmasked APAAR is displayed and an immutable audit log entry is recorded.
   - Scroll to **Student Consent & Privacy Control**:
     - Status starts accurately as `Not Recorded` (never assumed).
     - Enter note: *"Physical consent form verified at admission desk."*
     - Click **Record Granted**. Show instant audit event recorded.

### Step 3: Printable Student ID Card & Record Reference (2:15 - 3:00)
1. In the Student Drawer, click **Student ID Card**:
   - Preview the responsive card layout showing student photo avatar, roll number, course, masked APAAR, official local reference identifier (`REF: AG-INST...`), and boundary disclaimer.
   - Click **Print / Save as PDF**: Show native browser print styling (application chrome is cleanly stripped via `@media print`).

### Step 4: Verification Officer & Human Review (3:00 - 3:45)
1. Log out and sign in as **Ravi Verma (Verification Officer)**.
2. Demonstrate RBAC:
   - Point out that **Add Student**, **Bulk Import**, and **Archive** buttons are disabled/hidden.
   - If an officer attempts a mutation via API, the server returns `403 Forbidden`.
3. Open **Verification Centre** (`/verification`):
   - Open a pending duplicate review case.
   - Show side-by-side comparison: notice that if the duplicate is from another institution, external student PII is masked to protect privacy.
   - Enter resolution notes and mark as **Resolved**.

### Step 5: AICTE Regulator National Oversight (3:45 - 5:00)
1. Log out and sign in as **Dr. Rajesh Kumar (AICTE Regulator)**.
2. The user is routed directly to the **Regulator Monitoring Dashboard** (`/regulator`).
3. Point out national aggregate intelligence:
   - Total participating institutions, total enrolled students, approved regular vs supernumerary seat utilization.
   - National category distribution (General, NRI, OCI, FN, Other).
   - Data quality metrics across institutions.
4. Demonstrate strict privacy boundary:
   - The regulator cannot view individual student records or reveal APAARs.
   - Navigating to `/students` or querying `/api/students` returns `403 Forbidden`.
   - Regulator views only aggregate institution-level policy metrics.

---

## 🔒 Security Hardening Summary

1. **Zero Raw APAAR Exposure**: APAAR identifiers are masked by default (`XXXX-XXXX-1234`) across list APIs, exports, and audit logs.
2. **Password & Secret Scrubbing**: The `/api/auth/demo-accounts` endpoint never returns passwords or secrets. Outside `APP_ENV=development`, demo account discovery is disabled.
3. **Immutability of Audit & Consent**: Consent events and audit entries are append-only. Transitions (`not_recorded` $\to$ `granted` $\to$ `withdrawn` $\to$ `granted`) create distinct historical events.
4. **Tenant Isolation**: Backend checks (`verify_institution_access`) ensure users can never view or manipulate data belonging to another college.

---

## 📋 Known Limitations & Future Work

- **Official Identity Integration**: This software prototype provides local institution data hygiene and integrity checks. Full integration with DigiLocker or UIDAI ABC requires authorized government gateway credentials and HSM signing.
- **Direct Student Portal**: Consent in this prototype is institutional staff-recorded. A production phase would include a student-facing portal with OTP/Aadhaar-authenticated direct consent submission.
- **Database Scalability**: Designed and tested on SQLite WAL mode for hackathon portability; production deployment can point directly to PostgreSQL with zero ORM model modifications.
