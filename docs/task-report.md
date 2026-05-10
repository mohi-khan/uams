# UAMS — Task Report
**Project:** University Academic Management System (SaaS MVP)
**Last Updated:** 2026-04-29

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v3 |
| Backend | Node.js, Hono, TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Docker) |
| Cache / Queue | Redis (ioredis) |
| Storage | Cloudflare R2 (S3-compatible) |
| Email | Resend |
| State Management | Jotai (atomWithStorage) |
| Data Fetching | TanStack Query v5 |
| Icons | Lucide React |

---

## Repositories

| Repo | Path | Port |
|---|---|---|
| Backend | `UniversityAcademic/uams-backend` | 8000 |
| Frontend | `UniversityAcademic/uams-frontend` | 3000 |

---

## Completed Tasks

### 1. Environment Setup

#### Backend (`uams-backend`)
- Initialized npm project with TypeScript
- Installed: `hono`, `@hono/node-server`, `@hono/zod-validator`, `drizzle-orm`, `pg`, `ioredis`, `bcryptjs`, `jsonwebtoken`, `zod`, `resend`, `@aws-sdk/client-s3`
- `tsconfig.json` configured (CommonJS target, strict mode)
- `drizzle.config.ts` for migrations
- Dev script uses `tsx watch --env-file=.env` for correct env loading
- Folder structure:
  ```
  src/
    routes/       ← Hono route handlers
    services/     ← Business logic
    middleware/   ← auth, RBAC
    db/schema/    ← Drizzle schema files
    db/migrations/← Generated SQL migrations
    db/seed.ts    ← Database seed script
    lib/          ← db, redis, s3, email, validators
    types/        ← shared TypeScript types
  ```

#### Frontend (`uams-frontend`)
- Scaffolded with `create-next-app` (App Router, TypeScript)
- Tailwind CSS **downgraded to v3** (v4 blocked by Windows Application Control policy on native `.node` binaries)
- Installed: `axios`, `jotai`, `@tanstack/react-query`, `lucide-react`
- TanStack QueryClient wrapped in `src/lib/providers.tsx`
- Axios client at `src/lib/api/client.ts` with JWT interceptor (`JSON.parse` applied to `atomWithStorage` values) and auto-refresh on 401
- Jotai atoms: `accessTokenAtom`, `refreshTokenAtom`, `currentUserAtom`, `isAuthenticatedAtom` (persisted in localStorage via `atomWithStorage`)
- Folder structure:
  ```
  src/
    app/(auth)/     ← public auth pages
    app/(dashboard)/← protected dashboard pages
    components/layout/ ← Sidebar, Header, nav-config
    lib/api/        ← axios API functions per module
    store/          ← jotai atoms
    types/          ← shared types
  ```

---

### 2. Database Schema & Migrations

**Migrations applied:** `0000` → `0006`

#### `tenants`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto-generated |
| name | varchar(255) | university name |
| email | varchar(255) unique | official university email |
| phone | varchar(50) | optional |
| address / city / country | varchar | |
| tier | enum | `0-50`, `51-100`, `101-500`, `501-1000`, `1001+` |
| subdomain | varchar(100) unique | nullable — Phase 2 |
| is_verified | boolean | default false |
| is_active | boolean | default false (activated after email verify) |
| created_at / updated_at | timestamp | |

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | |
| email | varchar(255) | unique per tenant |
| password_hash | varchar(255) | nullable (Google auth users) |
| google_id | varchar(255) | nullable (email auth users) |
| auth_provider | enum | `email`, `google` |
| first_name / last_name | varchar | |
| role | enum | `super_admin`, `admin`, `dean`, `academic_coordinator`, `teacher`, `student` |
| status | enum | `active`, `inactive`, `suspended` |
| is_active | boolean | mirrors status |
| created_at / updated_at | timestamp | |

#### `faculties`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | cascade delete |
| name | varchar(255) | |
| code | varchar(50) | auto-uppercased, unique per tenant (service-enforced) |
| description | text | optional |
| is_active | boolean | default true |
| created_by / updated_by / deleted_by | UUID FK → users | set null on delete |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp | null = not deleted (soft delete) |

#### `departments`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | cascade delete |
| faculty_id | UUID FK → faculties | cascade delete |
| name | varchar(255) | |
| code | varchar(50) | auto-uppercased, unique per tenant (service-enforced) |
| description | text | optional |
| is_active | boolean | default true |
| created_by / updated_by / deleted_by | UUID FK → users | set null on delete |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp | null = not deleted (soft delete) |

#### `courses`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | cascade delete |
| department_id | UUID FK → departments | cascade delete |
| code | varchar(20) | auto-uppercased, unique per tenant (service-enforced) |
| title | varchar(255) | |
| credits | integer | |
| type | enum | `CORE`, `ELECTIVE` |
| status | enum | `active`, `inactive`, `archived` |
| original_fee | numeric(10,2) | stored as string in DB, converted to number in service |
| retake_fee | numeric(10,2) | same |
| created_by / updated_by / deleted_by | UUID FK → users | set null on delete |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp | soft delete |

#### `programs`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | cascade delete |
| department_id | UUID FK → departments | cascade delete |
| name | varchar(255) | e.g. "B.Sc. Computer Science" |
| code | varchar(50) | auto-uppercased, unique per tenant (service-enforced) |
| degree_level | enum | `bachelor`, `master`, `phd`, `diploma`, `certificate` |
| total_credits | integer | default 0 |
| duration_semesters | integer | default 8 |
| status | enum | `active`, `inactive`, `archived` |
| created_by / updated_by / deleted_by | UUID FK → users | set null on delete |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp | soft delete |

#### `program_courses`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | cascade delete |
| program_id | UUID FK → programs | cascade delete |
| course_id | UUID FK → courses | cascade delete |
| semester_no | integer | 1-based semester number |
| is_mandatory | boolean | default true |
| created_by | UUID FK → users | set null on delete |
| created_at | timestamp | |

- Uniqueness of (tenant_id, program_id, course_id) enforced in service layer

#### `course_prerequisites`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | cascade delete |
| course_id | UUID FK → courses | target course (e.g. Data Structures) |
| prerequisite_course_id | UUID FK → courses | required course (e.g. Algorithms) |
| min_grade | varchar(5) | optional, e.g. "C", "B+" |
| is_mandatory | boolean | default true |
| created_by | UUID FK → users | set null on delete |
| created_at | timestamp | |

- Uniqueness of (tenant_id, course_id, prerequisite_course_id) enforced in service layer
- Self-reference guard: a course cannot be its own prerequisite

#### Audit Log Tables
| Table | References |
|---|---|
| `faculty_audit_logs` | faculty_id (non-FK, survives hard delete) |
| `department_audit_logs` | department_id |
| `course_audit_logs` | course_id |
| `program_audit_logs` | program_id |

All audit tables share the same structure: `id`, `tenant_id`, `action` (CREATE/UPDATE/DELETE), `performed_by` (FK → users, set null), `snapshot` (jsonb), `created_at`. UPDATE snapshots store `{before, after}`.

---

### 3. Multi-Tenancy

- Strategy: **Shared Database, Shared Schema**
- Phase 1: **JWT-based tenant resolution** (`tenantId` embedded in JWT payload)
- Phase 2 (planned): subdomain-based resolution (`subdomain` column already in schema, nullable)
- Every service query filters by `tenantId` extracted from JWT

---

### 4. Authentication Module

#### Backend
- **Password rules** (Zod + bcrypt): min 8 chars, uppercase, lowercase, number, special character; 12 salt rounds
- **Auth Provider split:** `email` → bcrypt (admins, deans, academic coordinators, teachers); `google` → no password stored (students only)
- **JWT:** access token (15m) + refresh token (7d, stored in Redis)
- **Endpoints:**
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`

#### Middleware
- `authMiddleware` — verifies JWT, injects `user` (JwtPayload) into Hono context
- `rbac(...roles)` — returns 403 if caller's role not in allowed list

#### Frontend
- Login page at `/login` with live password strength checklist
- Tokens stored in `atomWithStorage` — axios interceptor calls `JSON.parse()` before use (fixes JSON-quoted Bearer token bug)
- Auto-redirect to `/dashboard` on success, `/login` on 401

---

### 5. Tenant Registration (Public)

#### Backend
- `POST /api/tenants/register` — creates tenant + first admin user (both inactive pending email verify)
- Verification token stored in Redis (24hr TTL)
- Verification email sent via Resend
- `GET /api/tenants/verify?token=xxx` — activates tenant + admin, invalidates token

#### Frontend
- `/register` — university registration form (scaffolded)
- `/verify` — email verification handler (scaffolded)

---

### 6. Dashboard

#### Layout
- Protected by `mounted` + token guard — prevents hydration redirect loop
- Dark sidebar (gray-900) with role-based nav, user avatar + name + email at bottom
- Top header with page title and sign-out button

#### Role-Based Navigation

| Role | Menu Items |
|---|---|
| Student | Dashboard, Assignments, Quizzes, Results, Transcripts |
| Teacher | Dashboard, Assignments, Submissions, Quizzes, Materials |
| Admin | Dashboard, Control Panel, Users, Faculties, Departments, **Programs**, Courses & Sections, Enrollment |
| Dean | Dashboard, Performance, Results Approval |
| Academic Coordinator | Dashboard, Faculties, Departments, **Programs**, Courses & Sections, Enrollment, Reports |
| Super Admin | Dashboard, Universities, Users, System |

#### Dashboard Landing (`/dashboard`)
- Welcome banner with gradient, user name, role label
- 4 role-specific stat cards (placeholder values, wired per module later)
- Recent Activity + Upcoming placeholder panels

---

### 7. User Management (`/dashboard/users`) — Admin / Super Admin

#### Backend (`/api/users`)
- `GET /` — paginated list with search (name / email)
- `GET /:id` — single user
- `POST /` — create user
- `PATCH /:id/status` — activate / deactivate / suspend
- `PATCH /:id/password` — admin reset password

#### Frontend
- Searchable table with role + status colour badges
- **Create User** modal: name, email, role dropdown (includes `academic_coordinator`), auth method, password with live strength checklist
- Row actions: Activate, Deactivate, Suspend, Reset Password
- Pagination

---

### 8. Roles

| Role | Value | Description |
|---|---|---|
| Super Admin | `super_admin` | Platform-level; manages tenants |
| Admin | `admin` | Institution-level; full management access |
| Dean | `dean` | Academic oversight, results approval |
| Academic Coordinator | `academic_coordinator` | Coordinates courses, enrollment, reporting |
| Teacher | `teacher` | Manages assignments, quizzes, materials |
| Student | `student` | Views own assignments, results, transcripts |

---

### 9. Faculty Master (`/dashboard/faculties`)

#### RBAC
| Action | Roles |
|---|---|
| View list / detail | admin, super_admin, academic_coordinator |
| Create / Edit / Delete / History | admin, super_admin |

#### Backend (`/api/faculties`)
- Soft delete; code auto-uppercased; duplicate code check on active records
- Full audit log on every mutation; UPDATE stores `{before, after}` snapshot

#### Frontend
- Searchable table: name, code (monospace badge), description, active/inactive status, created date
- Row actions menu: Edit, History, Delete — all gated to admin/super_admin
- **Audit History** modal: timeline with action badge (green/blue/red), performer name, timestamp, expandable JSON snapshot

---

### 10. Department Master (`/dashboard/departments`)

#### RBAC
Same split as Faculties — view for coordinators, write/history/delete for admin/super_admin only.

#### Backend (`/api/departments`)
- Same pattern as faculties; `?facultyId=` filter on list endpoint
- Faculty existence and tenant ownership validated on create

#### Frontend
- Faculty filter dropdown in toolbar (fetches all, limit 200)
- Table shows Faculty Name column
- Create modal includes Faculty selector
- Edit modal: name, code, description, active toggle

---

### 11. Admin Control Panel (`/dashboard/admin`)

- Tile-grid page linking to all admin-accessible sections
- Sections: User Management, Faculties, Departments, Courses & Sections, Enrollment, Reports
- Each tile: icon, title, description, "Manage →" link with hover animation

---

### 12. Seed Data (`npm run db:seed`)

Seeds the first tenant with realistic academic structure (idempotent — skips existing records):

| Faculty | Code | Departments |
|---|---|---|
| Faculty of Engineering | ENG | CSE, EEE, CVE, MCE |
| Faculty of Business Administration | BUS | ACF, MKT, HRM, BIS |
| Faculty of Arts & Humanities | ART | ELL, HCS, PHE |
| Faculty of Natural Sciences | SCI | MTS, PHY, CHM, BLS |
| Faculty of Law | LAW | CCL, CRJ |

---

### 13. Course Master (`/dashboard/courses`)

#### RBAC
| Action | Roles |
|---|---|
| View list | admin, super_admin, academic_coordinator |
| Create / Edit / Delete / History | admin, super_admin |
| View Prerequisites | all roles (via menu) |

#### Backend (`/api/courses`)
- Soft delete; code auto-uppercased; unique per tenant
- `original_fee` and `retake_fee` stored as `numeric(10,2)` (PostgreSQL returns string — `toNum()` helper converts to JS number before response)
- Full audit log on every mutation

#### Frontend
- Cascading Faculty → Department filter dropdowns in toolbar
- Table: code (monospace + BookOpen icon), title + faculty name, department, credits badge, TYPE badge (CORE=indigo, ELECTIVE=purple), STATUS badge (active=green, inactive=gray, archived=orange), original fee, retake fee
- Shared `CourseForm` component for create + edit modals
- Faculty selector in form is UI-only (filters department dropdown, not sent to API)
- Row actions: Edit, **Prerequisites** (all roles), History, Delete

---

### 14. Program Master (`/dashboard/programs`)

#### RBAC
| Action | Roles |
|---|---|
| View list | admin, super_admin, academic_coordinator |
| Create / Edit / Delete / History | admin, super_admin |
| View / Manage Course Mapping | Courses button: all roles view; add/edit/remove: admin, super_admin |

#### Backend (`/api/programs`)
- Soft delete; code auto-uppercased; unique per tenant
- Belongs to a department (faculty resolved via join)
- Full audit log on every mutation

#### Degree Levels
`bachelor` · `master` · `phd` · `diploma` · `certificate`

#### Frontend
- Cascading Faculty → Department filter dropdowns in toolbar
- Table: code (monospace + BookMarked icon), program name + faculty, department, degree level badge (colour-coded), total credits, duration (semesters), status
- Row actions: Edit, **Courses** (course-mapping modal), History, Delete

#### Course Mapping Modal (`Courses` action)
- Lists courses currently mapped to the program, **grouped by semester**
- Each row: course code, title, credits, mandatory/elective badge, inline edit (semester, mandatory toggle), remove button
- **Add Course** inline form: course dropdown (shows only unmapped courses), semester number, mandatory toggle
- Changes take effect immediately (optimistic invalidation via TanStack Query)

---

### 15. Program-Course Mapping

#### Backend (`/api/programs/:id/courses`)
| Method | Endpoint | Roles |
|---|---|---|
| GET | `/:id/courses` | admin, super_admin, academic_coordinator |
| POST | `/:id/courses` | admin, super_admin |
| PUT | `/:id/courses/:mappingId` | admin, super_admin |
| DELETE | `/:id/courses/:mappingId` | admin, super_admin |

- Duplicate course-in-program check enforced in service layer
- Results ordered by `semester_no ASC`, then `course.code ASC`

---

### 16. Course Prerequisites

#### Backend (`/api/courses/:id/prerequisites`)
| Method | Endpoint | Roles |
|---|---|---|
| GET | `/:id/prerequisites` | admin, super_admin, academic_coordinator |
| POST | `/:id/prerequisites` | admin, super_admin |
| DELETE | `/:id/prerequisites/:prereqId` | admin, super_admin |

- Self-reference guard: a course cannot be its own prerequisite
- Duplicate prerequisite check enforced in service layer
- Self-join on `courses` table using Drizzle `alias()` to fetch prerequisite course code + title

#### Frontend (Prerequisites Modal on Courses page)
- Accessible via "Prerequisites" in every course row's action menu (visible to all roles)
- Lists prerequisites: code, title, min grade badge (yellow, if set), required/optional badge
- **Add** inline form: course dropdown (excludes already-mapped courses and the course itself), optional min grade text input, required toggle
- Remove button (admin/super_admin only)

---

## API Endpoints Summary

| Method | Endpoint | Auth | Roles |
|---|---|---|---|
| POST | `/api/tenants/register` | Public | — |
| GET | `/api/tenants/verify` | Public | — |
| POST | `/api/auth/login` | Public | — |
| POST | `/api/auth/refresh` | Public | — |
| POST | `/api/auth/logout` | JWT | All |
| GET | `/api/users` | JWT | admin, super_admin |
| POST | `/api/users` | JWT | admin, super_admin |
| GET | `/api/users/:id` | JWT | admin, super_admin |
| PATCH | `/api/users/:id/status` | JWT | admin, super_admin |
| PATCH | `/api/users/:id/password` | JWT | admin, super_admin |
| GET | `/api/faculties` | JWT | admin, super_admin, academic_coordinator |
| POST | `/api/faculties` | JWT | admin, super_admin |
| GET | `/api/faculties/:id` | JWT | admin, super_admin, academic_coordinator |
| PUT | `/api/faculties/:id` | JWT | admin, super_admin |
| DELETE | `/api/faculties/:id` | JWT | admin, super_admin |
| GET | `/api/faculties/:id/audit` | JWT | admin, super_admin |
| GET | `/api/departments` | JWT | admin, super_admin, academic_coordinator |
| POST | `/api/departments` | JWT | admin, super_admin |
| GET | `/api/departments/:id` | JWT | admin, super_admin, academic_coordinator |
| PUT | `/api/departments/:id` | JWT | admin, super_admin |
| DELETE | `/api/departments/:id` | JWT | admin, super_admin |
| GET | `/api/departments/:id/audit` | JWT | admin, super_admin |
| GET | `/api/courses` | JWT | admin, super_admin, academic_coordinator |
| POST | `/api/courses` | JWT | admin, super_admin |
| GET | `/api/courses/:id` | JWT | admin, super_admin, academic_coordinator |
| PUT | `/api/courses/:id` | JWT | admin, super_admin |
| DELETE | `/api/courses/:id` | JWT | admin, super_admin |
| GET | `/api/courses/:id/audit` | JWT | admin, super_admin |
| GET | `/api/courses/:id/prerequisites` | JWT | admin, super_admin, academic_coordinator |
| POST | `/api/courses/:id/prerequisites` | JWT | admin, super_admin |
| DELETE | `/api/courses/:id/prerequisites/:prereqId` | JWT | admin, super_admin |
| GET | `/api/programs` | JWT | admin, super_admin, academic_coordinator |
| POST | `/api/programs` | JWT | admin, super_admin |
| GET | `/api/programs/:id` | JWT | admin, super_admin, academic_coordinator |
| PUT | `/api/programs/:id` | JWT | admin, super_admin |
| DELETE | `/api/programs/:id` | JWT | admin, super_admin |
| GET | `/api/programs/:id/audit` | JWT | admin, super_admin |
| GET | `/api/programs/:id/courses` | JWT | admin, super_admin, academic_coordinator |
| POST | `/api/programs/:id/courses` | JWT | admin, super_admin |
| PUT | `/api/programs/:id/courses/:mappingId` | JWT | admin, super_admin |
| DELETE | `/api/programs/:id/courses/:mappingId` | JWT | admin, super_admin |

---

## Pending / Next Modules

| Priority | Module |
|---|---|
| Next | Assignment Module (create, submit, evaluate, publish) |
| Next | Quiz Module (create, attempt, auto-grade) |
| Next | Result Management (GPA calculation, publication) |
| Later | Transcript download (PDF) |
| Later | Notifications |
| Phase 2 | Subdomain-based tenant resolution |

---

## Sessions 10–13 Summary (2026-05-05)

### Session 10 — Batch Assignment
- New `GET /by-semester-offering/:id` and `PUT /bulk-assign-batch` endpoints on `/api/enrollments`
- `/dashboard/scheduling/batch-assignment` page: semester offering picker → enrolled students table → per-row batch dropdown + bulk-select panel → amber unsaved footer

### Session 11 — course_offerings: section → batchId
- Dropped `section varchar(10)`, added `batch_id uuid FK → batches` on `course_offerings`
- Migration `0016` applied manually; unique constraint updated; service dup-check uses `isNull()` for null batchId
- Scheduling page: section text input replaced with batch `<select>` filtered by programId

### Session 12 — Teacher Panel: My Courses
- `GET /api/teachers/me/courses` — returns teacher's assigned course offerings joined with courses, semester offerings, programs, sessions, batches
- `/dashboard/my-courses` page: cards grouped by semester, sorted active → planned → completed; skeleton loader + empty state

### Session 13 — Course Syllabus
- New tables: `course_syllabi`, `syllabus_topics`, `syllabus_audit_logs` (migration `0017`)
- Auto-versioning (v1 → v2…), auto-default on first creation, finalize locks syllabus + all topics
- `/api/syllabi` with 11 endpoints; read: all roles (teachers/students see final only); write: admin/coordinator
- Frontend editor at `/dashboard/courses/[courseId]/syllabus`:
  - Left sidebar: version list with status badges, set-default, delete draft
  - Right panel: drag-and-drop topic rows (`@dnd-kit`), inline title + hours edit with blur-save, click-to-expand description textarea with blur-save, Finalize button
  - Read-only view for teacher/student/dean
- Courses page: "Manage Syllabus" action added per course row

---

## Environment Variables

### Backend (`.env`)
```
PORT, NODE_ENV, ALLOWED_ORIGINS
DATABASE_URL
REDIS_URL
JWT_SECRET, JWT_EXPIRES_IN
REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN
GOOGLE_CLIENT_ID
RESEND_API_KEY, RESEND_FROM
FRONTEND_URL
S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

---

## Known Issues / Notes

- Tailwind v4 blocked by Windows Application Control (native `.node` binary) — using v3
- `--env-file=.env` flag in npm dev script ensures env vars load before module initialization
- `atomWithStorage` JSON-serializes values — axios interceptor must call `JSON.parse()` on localStorage tokens before use as Bearer header
- `overflow-hidden` on table wrapper divs clips absolutely-positioned dropdown menus — removed from all table pages (faculties, departments, courses, programs, users)
- `REFRESH_TOKEN_SECRET` in `.env` still uses placeholder — must be updated before production
- Google OAuth client ID not yet configured
- `numeric` columns (fees) in PostgreSQL return as strings via Drizzle — `toNum()` helper in course service converts before API response
