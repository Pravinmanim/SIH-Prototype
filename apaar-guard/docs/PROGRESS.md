# APAAR GUARD — Agile Progress Tracker & DoD Verification

> **SIH Problem Statement SIH26263**  
> **Tagline:** Accurate Student Records. Transparent Verification. Trusted Data.  
> **Status:** All 6 Sprints Built, Tested & Verified (Increment v2.0)

---

## 1. Sprint Completion Summary

| Sprint | Goal | Acceptance Criteria | Automated Tests | DoD Status |
|---|---|---|---|---|
| **Sprint 1** | Foundation, Auth & Tenant Isolation | JWT cookies, bcrypt, role checks, multi-institution tenant isolation | 9 / 9 Passing | **DONE** |
| **Sprint 2** | Validation Engine & Duplicate Detection | Format rules (R1-R6), fingerprinting, boundary stub, sync logic | 9 / 9 Passing | **DONE** |
| **Sprint 3** | Student Records & Concurrency | Server pagination, masking, reveal RBAC, optimistic locking (version) | 9 / 9 Passing | **DONE** |
| **Sprint 4** | Bulk Ingestion Wizard | CSV/XLSX parser, auto-mapping, row-level errors, idempotency, diff preview | 4 / 4 Passing | **DONE** |
| **Sprint 5** | Verification Centre, Intake & Reports | State machine (409 guard), aggregate intake alerts, CSV export, audit trail | 5 / 5 Passing | **DONE** |
| **Sprint 6** | Performance Optimization & Polish | Vercel-grade bundle splitting, lazy routing, GET cache, UI component library | Build Passing | **DONE** |

---

## 2. Test Sweep & DoD Verification

### 2.1 Backend Pytest Execution
- **Command:** `python -m pytest app/tests/ -v`
- **Result:** **36 passed**, 0 failed, 2 warnings in 13.63s
- **Coverage Areas:**
  - `test_sprint1_auth_isolation.py`:
    - Health checks & OpenAPI docs
    - Admin login & Officer login (JWT in HttpOnly cookie)
    - Invalid password safe generic error
    - Session authentication (`/api/auth/me`)
    - Role enforcement (Officer cannot perform Admin actions)
    - Cross-tenant institutional isolation (Apex vs Beacon vs Crescent)
    - Canonical 120-record synthetic seed data integrity
  - `test_sprint2_validation.py`:
    - 12-digit format rule with leading zero preservation (`012345678901`)
    - Empty APAAR absent duplicate immunity
    - Duplicate APAAR warning severity routing to Needs Review
    - Scoped roll number duplicate check (same vs diff institution)
    - Possible duplicate heuristic (normalized name + DOB)
    - Deterministic SHA-256 issue fingerprinting
    - Aggregate intake boundary (alerts produced without altering student validation status)
    - Official verification boundary stub returning "unavailable"
    - Batch validation run endpoint
  - `test_sprint3_student_records.py`:
    - Server pagination & list APAAR masking (`XXXX-XXXX-1234`)
    - Search & filter by status (Ready, Invalid Data, Needs Review)
    - Student detail drawer view with boundary notice
    - Admin create & automatic validation execution
    - Officer 403 enforcement on create, update, and soft archive
    - Admin update & soft-archive workflow
    - Admin-only "Reveal APAAR" RBAC + immutable `APAAR_REVEALED` audit logging
    - Optimistic locking: `HTTP 409 Conflict` on stale version update; atomic version increment
    - Cross-institution negative tests (`HTTP 403 Forbidden` on foreign student access)
  - `test_sprint4_bulk_import.py`:
    - Officer 403 enforcement on import endpoints
    - Invalid binary/exe rejection
    - Plain-English row-level error descriptions with identified values
    - Transactional commit with idempotency (`mapping_hash` + `file_sha256`)
  - `test_sprint5_verification_dashboard.py`:
    - Dashboard KPIs exact match with database SQL aggregates
    - Potential Duplicates distinct student counting + open alerts
    - Review case state machine transitions & student status independence
    - Illegal transition prevention (`HTTP 409 Conflict`)
    - Mandatory justification reasons for `Resolved` and `False Positive`
    - Cross-institution review case access denial (`HTTP 403`)
    - Aggregate intake capacity monitoring & admin override auditing
    - CSV export with verification boundary headers & audit logging

### 2.2 Frontend Production Build Verification
- **Command:** `npm run build` (tsc -b && vite build)
- **Result:** **0 errors**, compiled in 2.65s
- **Output Chunks:**
  - `dist/index.html`: 0.79 kB
  - `dist/assets/index-BcRhr-1F.css`: 48.57 kB (gzip: 8.88 kB)
  - `dist/assets/vendor-icons-C4nrCd-4.js`: 12.16 kB (gzip: 4.45 kB)
  - `dist/assets/DashboardPage-BMdJPK8e.js`: 13.48 kB (gzip: 3.07 kB)
  - `dist/assets/VerificationPage-D4fEXSW_.js`: 16.38 kB (gzip: 3.77 kB)
  - `dist/assets/BulkImportPage-D28xbWGO.js`: 21.29 kB (gzip: 4.94 kB)
  - `dist/assets/StudentsPage-CRuSJm-I.js`: 23.60 kB (gzip: 5.38 kB)
  - `dist/assets/index-vIe_1ghi.js`: 110.05 kB (gzip: 32.03 kB)
  - `dist/assets/vendor-react-CWRqVA4q.js`: 279.40 kB (gzip: 89.78 kB)
  - `dist/assets/vendor-charts--GReWpDT.js`: 399.34 kB (gzip: 114.05 kB)

---

## 3. UI Component Library (Sprint 3 Reusable Primitives)

Created standard accessible primitives in `frontend/src/components/ui/`:
1. `Button.tsx`: Variants (`primary`, `secondary`, `outline`, `danger`, `ghost`, `success`), sizes, loading state with spinner.
2. `Input.tsx`: Form input with labels, validation error messages, helper text, and icon support.
3. `Select.tsx`: Dropdown select with options, validation errors, and helper text.
4. `Card.tsx`: Card container with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
5. `Table.tsx`: Responsive table with `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
6. `Badge.tsx`: Neutral status badges with variants (`ready`, `needs-review`, `invalid`, `neutral`, `info`).
7. `Modal.tsx`: Accessible dialog with backdrop, escape key listener, and focus trapping.
8. `Toast.tsx`: Non-blocking notification provider (`useToast`) for success, error, warning, and info messages.
9. `EmptyState.tsx`: Visual placeholder for empty lists and clear queues.
10. `Skeleton.tsx`: Animated pulsing placeholders (`TableSkeleton`, `CardSkeleton`) for zero-layout-shift loading.

---

## 4. How to Run the Prototype

### 4.1 Backend (FastAPI)
```bash
cd apaar-guard/backend
python -m uvicorn app.main:app --reload --port 8000
```
- API Base: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`

### 4.2 Frontend (React + Vite)
```bash
cd apaar-guard/frontend
npm run dev
```
- Web Application: `http://localhost:5173`

### 4.3 Demo Accounts (Pre-Seeded)
| Institution | Role | Email | Password |
|---|---|---|---|
| Apex Institute of Technology (Delhi) | Admin | `asha.admin@apex.edu` | `password123` |
| Apex Institute of Technology (Delhi) | Officer | `ravi.officer@apex.edu` | `password123` |
| Bharatiya National College (Pune) | Admin | `priya.admin@bnce.edu` | `password123` |
| Bharatiya National College (Pune) | Officer | `vikram.officer@bnce.edu` | `password123` |
| Crescent Institute of Science (Chennai) | Admin | `kavita.admin@crescent.edu` | `password123` |
| Crescent Institute of Science (Chennai) | Officer | `suresh.officer@crescent.edu` | `password123` |

