# APAAR GUARD — Product Backlog & Sprint Tracker

**Tagline:** Accurate Student Records. Transparent Verification. Trusted Data.  
**Architecture:** FastAPI (Python) + React (TypeScript/Vite) + SQLite (PostgreSQL-compatible)

---

## Sprint Overview

| Sprint | Goal | Status |
|---|---|---|
| **Sprint 1** | Foundation, Auth, Seed Data | Done |
| **Sprint 2** | Validation Engine & Duplicate Detection | Done |
| **Sprint 3** | Student Records (API + UI Shell) | Done |
| **Sprint 4** | Bulk Import Wizard | Done |
| **Sprint 5** | Verification Centre, Dashboard, Intake, Reports, Audit | Done |
| **Sprint 6** | Polish, Testing, Docs, Demo | Done |

---

## Stories by Sprint

### Sprint 1: Foundation, Auth, Seed Data
- [x] **S1.1** Project scaffolding (backend, frontend, env, README skeleton) - *Done*
- [x] **S1.2** SQLAlchemy models (User, Institution, Course, Student, ValidationResult, DuplicateAlert, ReviewCase, ReviewNote, ImportJob, ImportJobError, IntakeConfiguration, AuditLog) with PK/FK, indexes, string APAAR, soft delete - *Done*
- [x] **S1.3** Auth endpoints: login/logout and `/api/auth/me` (JWT in HttpOnly cookie, bcrypt) - *Done*
- [x] **S1.4** Role + Institution scoping reusable dependencies - *Done*
- [x] **S1.5** Demo login accounts (Admin + Officer per institution) with banner - *Done*
- [x] **S1.6** Seed data script (100+ synthetic students, 3 institutions, 4 courses, 3 years, variety of edge cases) & reset-demo command - *Done*

### Sprint 2: Validation Engine & Duplicate Detection
- [x] **S2.1** Modular rule classes R1-R7 (Required, APAAR format, Exact duplicate, Roll duplicate, Academic consistency, Possible duplicate, Intake check) - *Done*
- [x] **S2.2** Validation runner & status derivation (Ready, Invalid Data, Needs Review, Correction Requested, Resolved) - *Done*
- [x] **S2.3** Auto-creation of duplicate alerts and review cases - *Done*
- [x] **S2.4** OfficialVerificationService interface stub returning "unavailable" - *Done*

### Sprint 3: Student Records (API + UI Shell)
- [x] **S3.1** App shell (role-aware sidebar, top bar, demo banner, responsive drawer, palette) - *Done*
- [x] **S3.2** Login page (branding, demo quick-select, validation, error/loading states) - *Done*
- [x] **S3.3** Student listing API & UI (search, filters, sorting, server pagination) - *Done*
- [x] **S3.4** Student table with masked APAAR ID (XXXX-XXXX-1234), status badges - *Done*
- [x] **S3.5** Add/Edit student form with React Hook Form + Zod & server validation - *Done*
- [x] **S3.6** Detail drawer with verification disclaimer and review history - *Done*
- [x] **S3.7** Soft archive with confirmation & officer 403 enforcement - *Done*
- [x] **S3.8** Auto-validation re-run and audit logging on mutations - *Done*

### Sprint 4: Bulk Import Wizard
- [x] **S4.1** Step 1: Upload (CSV/XLSX, limits, privacy notice, template download) - *Done*
- [x] **S4.2** Step 2: Column mapping with auto-suggestions & preview - *Done*
- [x] **S4.3** Step 3: Validate before commit (totals, errors preview, exportable report) - *Done*
- [x] **S4.4** Step 4: Import options & safe duplicate handling rules - *Done*
- [x] **S4.5** Step 5: Import results with job summary & error report download - *Done*
- [x] **S4.6** Transactional import with idempotency & audit logging - *Done*
- [x] **S4.7** Sample files (`valid.csv`, `with_errors.csv`, `template.xlsx`) - *Done*

### Sprint 5: Verification Centre, Dashboard, Intake, Reports, Audit
- [x] **S5.1** Verification Centre queue with reason, severity, filters, case view - *Done*
- [x] **S5.2** Duplicate side-by-side comparison with matching fields highlighted - *Done*
- [x] **S5.3** Review actions (Note, Request Correction, Confirm Issue, False Positive, Resolve) - *Done*
- [x] **S5.4** Dashboard with KPI cards, status charts, recent activity, clickable filters - *Done*
- [x] **S5.5** Intake monitoring (capacity, utilization %, status badges, admin configuration) - *Done*
- [x] **S5.6** CSV Reports export (summary, validation, duplicate, intake, audit) - *Done*
- [x] **S5.7** Audit log viewer with filters (actor, action, date range) - *Done*

### Sprint 6: Polish, Testing, Docs, Demo
- [x] **S6.1** Responsive pass, keyboard focus, toasts, confirmations - *Done*
- [x] **S6.2** Navigation integrity check, dead button removal - *Done*
- [x] **S6.3** Comprehensive backend test sweep (32 pytest tests executed and passing) - *Done*
- [x] **S6.4** Frontend build validation & verification (TypeScript 0 errors, Vite production bundle generated) - *Done*
- [x] **S6.5** Documentation (README, architecture, commands, demo logins) - *Done*
- [x] **S6.6** 3-minute SIH demo script - *Done*

---

## Out of Scope ("Later" in Backlog)
- Super Admin and Auditor roles
- User management UI
- Settings pages
- Excel multi-tab export
- Celery / Redis background queue
- PostgreSQL live production migrations (Alembic in production)
- Playwright E2E automation
- Real UIDAI/DigiLocker/ABC/AICTE API live integration
