# UAMS Task Report

---

## Session 1 — Academic Structure (Faculties, Departments, Courses, Programs)

**Status:** Done & Tested

### Backend
- Schema: `faculties`, `departments`, `courses`, `programs`, `program_courses`, `course_prerequisites` tables with full audit log tables for each
- Migrations: `0000` → `0006` applied
- Services: CRUD + soft-delete + audit trail for all four entities
- Routes: `/api/faculties`, `/api/departments`, `/api/courses`, `/api/programs`
- Validators: Zod schemas for all create/update operations
- RBAC: read access for `admin`, `super_admin`, `academic_coordinator`; write restricted to `admin`, `super_admin`

### Frontend
- Pages: Faculties, Departments, Courses, Programs under `/dashboard`
- Features: paginated tables, search, filters, create/edit modals, soft-delete confirm, audit history modal
- API clients: `academic.ts`

---

## Session 2 — Teacher Management

**Status:** Done & Tested  
**Date:** 2026-04-29

### Backend

#### Schema (`academic.ts`)
- `designationEnum` — `Professor | Lecturer`
- `teachers` table — `id`, `tenant_id`, `department_id` (FK), `faculty_id` (FK), `user_id` (FK → users), `name`, `email`, `phone`, `designation`, `joining_date`, `is_active`, audit fields
- `teacherAuditLogs` table
- Unique constraint: `(tenant_id, email)`

#### Migration
- `0007_orange_maria_hill.sql` — generated via `drizzle-kit generate`, applied via `drizzle-kit migrate`

#### Validators (`academic.validator.ts`)
- `createTeacherSchema` — all fields required; email excluded from update
- `updateTeacherSchema` — all fields except email; `isActive` toggles user account in sync

#### Email (`email.ts`)
- `sendTeacherInvitationEmail` — sends branded 24 h activation link via Resend

#### Service (`teacher.service.ts`)
- `createTeacher` — validates faculty/dept belong to tenant, creates inactive user (`role=teacher`, `isActive=false`), creates teacher record, generates Redis token (`invite:teacher:<token>`, 24 h TTL), sends invitation email
- `listTeachers` — paginated, filterable by `facultyId`, `departmentId`, `search`
- `getTeacherById`
- `updateTeacher` — all fields except email; syncs `user.isActive` when `isActive` changes
- `toggleTeacherStatus` — flips `teacher.isActive` and `user.isActive` together
- `resendTeacherInvitation` — only allowed if user not yet activated; regenerates Redis token and resends email
- `getTeacherAuditLogs`

#### Route (`teacher.route.ts`) — `/api/teachers`
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | admin, super_admin, academic_coordinator, dean |
| GET | `/:id` | same |
| GET | `/:id/audit` | admin, super_admin |
| POST | `/` | admin, super_admin |
| PUT | `/:id` | admin, super_admin |
| PATCH | `/:id/toggle-status` | admin, super_admin |
| POST | `/:id/resend-invitation` | admin, super_admin |

#### Auth — Invitation Activation
- `POST /api/auth/activate-invitation` — public endpoint; validates Redis token, hashes and sets password, activates `user.isActive=true` and `teacher.isActive=true`, deletes Redis key

### Frontend

#### API client (`teachers.ts`)
- `listTeachersApi`, `createTeacherApi`, `updateTeacherApi`, `toggleTeacherStatusApi`, `resendTeacherInvitationApi`, `getTeacherAuditLogsApi`

#### Teachers page (`/dashboard/teachers`)
- Searchable, paginated table with faculty + department cascade filters
- **Add Teacher** modal — faculty → department cascade select, all fields, sends invite on save; info note shown about 24 h invitation
- **Edit** modal — all fields except email (read-only notice shown)
- **Toggle status** (Activate / Deactivate) from row action menu — syncs user account
- **Resend Invite** — only shown for inactive (never-activated) teachers
- **Audit History** modal with expand/collapse snapshot diff
- Nav entry added to admin sidebar

#### Activation page (`/activate`)
- Reads `?token=` from URL
- Invalid/missing token → error card
- Valid token → password + confirm password form with strength rules (8 chars, upper, lower, number, special)
- Submit disabled until all rules pass
- On success → green confirmation card → "Go to Login"

---

## Session 3 — Academic Sessions

**Status:** Done & Tested  
**Date:** 2026-04-29

### Backend

#### Schema (`academic.ts`)
- `termEnum` — `SPRING | SUMMER | FALL`
- `sessionStatusEnum` — `draft | active | completed | archived`
- `academicSessions` table — `id`, `tenant_id`, `name`, `year`, `term`, `start_date`, `end_date`, `status`, audit fields
- `academicSessionAuditLogs` table
- Unique constraint: `(tenant_id, year, term)` — one session per term per year per tenant

#### Migration
- `0008_cool_outlaw_kid.sql` — generated via `drizzle-kit generate`, applied via `drizzle-kit migrate`

#### Validators (`academic.validator.ts`)
- `createSessionSchema` — name, year (2000–2100), term, startDate, endDate (YYYY-MM-DD), status (default: draft)
- `updateSessionSchema` — all fields optional

#### Service (`academic-session.service.ts`)
- `createSession` — validates end > start, enforces unique year+term per tenant
- `listSessions` — paginated, searchable by name, ordered by year desc then term
- `getSessionById`
- `updateSession` — validates date range and duplicate year+term on change
- `deleteSession` — blocked if status is `active`
- `getSessionAuditLogs`

#### Route (`academic-session.route.ts`) — `/api/sessions`
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | admin, super_admin, academic_coordinator, dean |
| GET | `/:id` | same |
| GET | `/:id/audit` | admin, super_admin |
| POST | `/` | admin, super_admin |
| PUT | `/:id` | admin, super_admin |
| DELETE | `/:id` | admin, super_admin |

### Frontend

#### API client (`sessions.ts`)
- `listSessionsApi`, `createSessionApi`, `updateSessionApi`, `deleteSessionApi`, `getSessionAuditLogsApi`

#### Sessions page (`/dashboard/sessions`)
- Paginated table with search; columns: name, year, term (colour-coded badge), period, status (colour-coded badge)
- **Add Session** modal — name, year, term, start/end date, status
- **Edit** modal — same fields, pre-populated
- **Delete** confirm modal — blocked server-side if session is active
- **Audit History** modal with expand/collapse snapshot diff
- Nav entry added to admin sidebar (`CalendarDays` icon)

---

---

## Session 4 — Student Enrollment Module (Students & Batches)

**Status:** Done & Tested  
**Date:** 2026-04-29

### Backend

#### Schema (`enrollment.ts`)
- `students` table — `id`, `tenant_id`, `student_code`, `name`, `email`, `phone`, `address`, `emergency_phone`, `nid_birth_reg`, `photo_url`, `is_active`, audit fields
  - Unique constraints: `(tenant_id, student_code)` and `(tenant_id, email)`
- `student_audit_logs` table
- `batches` table — `id`, `tenant_id`, `program_id` (FK → programs), `session_id` (FK → academic_sessions, nullable), `code`, `name`, `capacity`, `is_active`, audit fields
  - Unique constraint: `(tenant_id, code)`
- `batch_audit_logs` table

#### Migration
- `0009_tiresome_brood.sql` — generated via `drizzle-kit generate`, applied via `drizzle-kit migrate`

#### S3 (`s3.ts`)
- `getPhotoUploadUrl(key, contentType)` — generates pre-signed PUT URL (5 min TTL) + returns public URL

#### Validators (`enrollment.validator.ts`)
- `createStudentSchema` — studentCode, name, email (normalised to lowercase), optional: phone, address, emergencyPhone, nidBirthReg, photoUrl
- `updateStudentSchema` — all fields optional except email (not updatable)
- `photoUploadSchema` — filename, contentType enum (jpeg/png/webp)
- `createBatchSchema` — programId (uuid), optional sessionId (uuid), code (lowercase), name, optional capacity
- `updateBatchSchema` — all fields optional + isActive

#### Services
- `student.service.ts`
  - `createStudent` — unique studentCode + email per tenant, inserts, audit log
  - `listStudents` — paginated, searchable by name/code/email
  - `updateStudent` — all fields except email updatable, studentCode uniqueness checked on change
  - `deleteStudent`, `getStudentAuditLogs`
  - `getPhotoUploadSignedUrl` — builds S3 key as `tenants/{tenantId}/students/{uuid}.{ext}`

- `batch.service.ts`
  - `createBatch` — validates programId + sessionId exist in tenant, code stored lowercase
  - `listBatches` — joins programs + academicSessions for programName/sessionName, filterable by programId
  - `updateBatch` — validates new code uniqueness + new programId
  - `deleteBatch`, `getBatchAuditLogs`

#### Routes

**`/api/students`**
| Method | Path | Access |
|--------|------|--------|
| GET | `/photo-upload-url` | admin, super_admin (declared before `/:id`) |
| GET | `/` | admin, super_admin |
| GET | `/:id` | admin, super_admin |
| GET | `/:id/audit` | admin, super_admin |
| POST | `/` | admin, super_admin |
| PUT | `/:id` | admin, super_admin |
| DELETE | `/:id` | admin, super_admin |

**`/api/batches`**
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | admin, super_admin, academic_coordinator, dean |
| GET | `/:id` | same |
| GET | `/:id/audit` | admin, super_admin, academic_coordinator |
| POST | `/` | admin, super_admin, academic_coordinator |
| PUT | `/:id` | admin, super_admin, academic_coordinator |
| DELETE | `/:id` | admin, super_admin, academic_coordinator |

### Frontend

#### API clients
- `students.ts` — `listStudentsApi`, `createStudentApi`, `updateStudentApi`, `deleteStudentApi`, `getStudentAuditLogsApi`, `getPhotoUploadUrlApi`, `uploadStudentPhoto` (pre-signed PUT to S3)
- `batches.ts` — `listBatchesApi`, `createBatchApi`, `updateBatchApi`, `deleteBatchApi`, `getBatchAuditLogsApi`

#### Students page (`/dashboard/students`)
- Access: admin + super_admin only
- `PhotoPicker` component: 80×80 preview box, hidden file input, Upload/Change/Remove buttons, "Uploading…" state
- Table: photo thumbnail, studentCode badge (monospace), name + email, phone + address, emergency phone, NID/Birth Reg, status
- **Add Student** modal — PhotoPicker + all fields (email required on create)
- **Edit** modal — same but email locked (blue notice shown), photo updatable
- **Delete** confirm modal
- **Audit History** modal with expand/collapse snapshot

#### Batches page (`/dashboard/batches`)
- Access: admin + super_admin + academic_coordinator (write); all roles can view history
- Filter dropdown by program
- Table: code (monospace badge), name, programName, sessionName, capacity, status
- **New Batch** modal — program select, optional session select, code, name, optional capacity
- **Edit** modal — same fields + inline toggle for isActive status
- **Delete** confirm modal
- **Audit History** modal

#### Nav config
- Admin sidebar: added **Students** (`Users` icon) and **Batches** (`Layers` icon)
- Academic Coordinator sidebar: added **Students** and **Batches**

---

---

## Session 5 — NID Reveal + Fee Structures + Enrollment Transactions

**Status:** Done & Tested

### Backend

#### Schema (`enrollment.ts` + `student-enrollment.ts`)
- `student_nid_reveal_logs` — immutable log each time an admin reveals a student's NID (`0010`)
- `fee_structures` + `fee_structure_audit_logs` — per-program fee catalog (`feeType`: admission / semester / lab / library / other, `amount`, `isActive`)
- `student_enrollments` + `enrollment_audit_logs` — links student → program offering; tracks `status` (active / suspended / completed / dropped), `totalFee`, `paidAmount`
- `student_semesters` + `semester_audit_logs` — individual semester records per enrollment (`semesterNo`, `sessionId`, `startDate`, `endDate`, `status`)
- `student_installments` + `installment_audit_logs` — fee installment schedule per enrollment (`dueDate`, `amount`, `paidAmount`, `status`)
- `student_payments` — payment records against installments (`paymentMethod`, `transactionRef`)
- Migrations: `0010` → `0012` applied

#### Services
- `student.service.ts` — added `revealStudentNid` (bcrypt-verifies caller password, decrypts raw NID, writes reveal log)
- `fee-structure.service.ts` — CRUD for fee structures, scoped per tenant+program
- `student-enrollment.service.ts` — `createEnrollment` (validates offering exists, optional installment schedule), `listEnrollments`, `getEnrollmentById`, `updateEnrollment`, `deleteEnrollment`; nested `addSemester` / `updateSemester`; `listInstallments` / `updateInstallment`; `recordPayment` / `listPayments`

#### Routes
- `GET /api/students/:id/reveal-nid` (POST, password-gated) — admin + super_admin only
- `/api/fee-structures` — full CRUD, read: admin/coordinator/dean, write: admin/super_admin
- `/api/enrollments` — full CRUD + nested `/semesters`, `/installments`, `/installments/:id/payments`

### Frontend
- `enrollments.ts` API client — all types (`EnrollmentRow`, `FeeStructureRow`, `InstallmentRow`, `PaymentRow`, etc.) and API functions
- `/dashboard/enrollment` page — tabbed: **Enrollments** + **Fee Structures**; enrollment detail drawer with semesters, installments, payments sub-sections; NID reveal modal (password-gated)

---

## Session 6 — Program Offerings UI + Gmail Account for Students

**Status:** Done & Tested

### Backend

#### Schema changes
- `program_offerings` + `program_offering_audit_logs` — program × session × status (open/closed), `admissionStartDate`, `admissionEndDate`, `capacity` — migration `0013`
- `students.gmail_account` — new nullable column + unique constraint `(tenant_id, gmail_account)` — migration `0014`

#### Student service (`student.service.ts`)
- `createStudent` — now runs in a DB transaction: checks duplicate gmail, inserts a linked `users` row (`authProvider='google'`, `role='student'`, no password), inserts `students` row
- `updateStudent` — in transaction: if `gmailAccount` changes, syncs `users.email`; if `name` changes, syncs `users.firstName/lastName`
- `splitName(full)` helper — splits full name into `{ firstName, lastName }`

#### Program offering service + route
- `bulkSaveOfferings` — upserts all offerings for a session in one call (load existing map → create or update each)
- `POST /api/program-offerings/bulk` — academic_coordinator write access

### Frontend
- `/dashboard/enrollment/program-offerings` — **new standalone page**; session → program multi-select with inline date/capacity/status fields → Save; replaced the old tab on the enrollment page
- `/dashboard/enrollment` — program-offerings tab removed; only Enrollments + Fee Structures remain
- Students page — added **Gmail Account (Login)** field to create/edit modals and table; green dot indicator; colSpan updated to 8
- Nav entries for **Program Offerings** added for admin + academic_coordinator

---

## Session 7 — Google Authentication + Student Dashboard

**Status:** Done & Tested

### Backend

#### Auth service (`auth.service.ts`)
- `googleLogin(input)` — verifies Google ID token via `OAuth2Client.verifyIdToken`, queries user by `email + authProvider='google'`, stores `googleId` on first login, checks tenant active, issues JWT pair, stores refresh token in Redis
- `POST /api/auth/google` — public endpoint, validates `{ idToken }` via Zod

#### Student self-service endpoints
- `GET /api/students/me` — `student` role only; looks up student by `users.email = students.gmail_account`
- `GET /api/enrollments/me` — `student` role only; finds student by gmail, returns their enrollments
- `listEnrollments` — added `studentId` filter option

### Frontend
- `providers.tsx` — wrapped with `GoogleOAuthProvider` (from `@react-oauth/google`)
- `login/page.tsx` — added `GoogleLogin` button with "or" divider; `onSuccess` calls `googleLoginApi`, stores tokens, redirects to `/dashboard`
- `lib/api/auth.ts` — added `googleLoginApi`
- `lib/api/students.ts` — added `getStudentMeApi`
- `lib/api/enrollments.ts` — added `getMyEnrollmentsApi`
- `dashboard/page.tsx` — when `role === 'student'` renders `StudentDashboard` component: profile card (name, student code, emails, phone, address), enrollments list with fee progress bars, placeholder panels for assignments/upcoming

---

## Session 8 — Test Student & Dev Login Bypass

**Status:** Done

### Backend
- `src/db/seed-test-student.ts` — idempotent seed script; creates user (`test.student@gmail.com`, `authProvider='google'`) + student (`TEST-001`, id `74df7a19-4405-4982-9367-05c564b162f7`) under the first available tenant
- `devLogin(studentId)` in `auth.service.ts` — dev-only function (throws in production); resolves student → gmail → user → issues JWT pair
- `POST /api/auth/dev-login` — accepts `{ studentId }`, returns same shape as `/login`; returns 403 if `NODE_ENV=production`
- `package.json` — added `"db:seed:test"` script (`tsx --env-file=.env src/db/seed-test-student.ts`)

### Seed result
- Tenant: **Asian University** (`896791d8-…`)
- User created: `8d0a3b9a-…` (`test.student@gmail.com`)
- Student created: `74df7a19-4405-4982-9367-05c564b162f7` (`TEST-001 — Test Student`)

### Frontend
- `login/page.tsx` — amber **"Test Login — Student #TEST-001"** button rendered only when `NODE_ENV=development`; calls `devLoginApi`, redirects to `/dashboard` on success

---

## Session 9 — Semester Scheduling

**Status:** Done & Tested

### Backend

#### Schema (`scheduling.ts`) — migration `0015_blushing_red_wolf.sql`
- `semester_offerings` — links program × session × semesterNo; `status` (planned/active/completed), `startDate`, `endDate`; unique `(tenant_id, program_id, session_id, semester_no)`
- `semester_offering_audit_logs`
- `course_offerings` — section of a course within a semester offering; `section` (A/B/C…), `capacity`, `teacher_id` (nullable FK → teachers), `schedule_info` (jsonb); unique `(tenant_id, semester_offering_id, course_id, section)`
- `course_offering_audit_logs`

#### Validators (`scheduling.validator.ts`)
- `createSemesterOfferingSchema`, `updateSemesterOfferingSchema`
- `createCourseOfferingSchema`, `updateCourseOfferingSchema`
- `bulkSaveCourseOfferingsSchema` — `semesterOfferingId` + array of course rows

#### Service (`scheduling.service.ts`)
- `listSemesterOfferings` — joins programs + sessions, includes `courseCount` subquery
- `getSemesterOfferingById` — includes `durationSemesters` from programs
- `createSemesterOffering` — duplicate check on (program, session, semesterNo)
- `updateSemesterOffering`, `deleteSemesterOffering`, `getSemesterOfferingAuditLogs`
- `listCourseOfferings` — joins courses + teachers, ordered by course code + section
- `getAvailableCourses` — pulls `programCourses` for the semesterNo of the given semester offering (courses the program defines for that semester)
- `createCourseOffering`, `updateCourseOffering`, `deleteCourseOffering`, `getCourseOfferingAuditLogs`
- `bulkSaveCourseOfferings` — upsert by `(courseId, section)` key; creates new or updates existing

#### Route (`scheduling.route.ts`) — `/api/semester-offerings`
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | admin, super_admin, academic_coordinator, dean |
| GET | `/:id` | same |
| GET | `/:id/audit` | admin, super_admin, academic_coordinator |
| POST | `/` | admin, super_admin, academic_coordinator |
| PUT | `/:id` | admin, super_admin, academic_coordinator |
| DELETE | `/:id` | admin, super_admin, academic_coordinator |
| GET | `/:id/courses` | read roles |
| GET | `/:id/courses/available` | read roles |
| POST | `/:id/courses` | write roles |
| POST | `/:id/courses/bulk` | write roles |
| PUT | `/:id/courses/:courseOffId` | write roles |
| DELETE | `/:id/courses/:courseOffId` | write roles |
| GET | `/:id/courses/:courseOffId/audit` | write roles |

### Frontend
- `lib/api/scheduling.ts` — full typed API client; all types (`SemesterOfferingRow`, `CourseOfferingRow`, `AvailableCourseRow`) and functions
- `/dashboard/scheduling` page — single screen:
  - **Selectors**: Program → Session → Semester No (max = `durationSemesters`)
  - **Semester Offering card**: status dropdown + start/end dates; "Create" or "Update" button; "History" button → audit modal
  - **Course Schedule table**: inline editing of section, capacity, teacher per row; amber unsaved-changes footer with "Save Schedule" (bulk upsert); "Add Course" hover dropdown from `available-courses` (only shows courses not already added); row-level history icon → audit modal; trash icon → soft-delete
  - History displayed in modal with action badges + JSON snapshot viewer
- Nav entries: **Semester Scheduling** (`LayoutList` icon) added to admin + academic_coordinator sidebars

---

## Session 10 — Batch Assignment

**Status:** Done  
**Date:** 2026-05-05

### Backend
- `student-enrollment.service.ts` — added `getEnrollmentsBySemesterOffering(tenantId, semesterOfferingId)`: resolves program+session from semester offering, returns all matching enrollments with student name + current batch info; added `bulkAssignBatch(tenantId, performedBy, enrollmentIds, batchId)`: bulk UPDATE via `inArray`, writes audit logs in one batch
- `enrollment-txn.validator.ts` — added `bulkAssignBatchSchema`: `{ enrollmentIds: uuid[], batchId: uuid | null }`
- `student-enrollment.route.ts` — added `GET /by-semester-offering/:semesterOfferingId` and `PUT /bulk-assign-batch` (both before `/:id/audit` to avoid param capture); RBAC: admin, super_admin, academic_coordinator

### Frontend
- `lib/api/enrollments.ts` — added `SemesterOfferingEnrollmentRow`, `SemesterOfferingEnrollmentsResult` types; added `getEnrollmentsBySemesterOfferingApi`, `bulkAssignBatchApi`
- `/dashboard/scheduling/batch-assignment/page.tsx` (new page):
  - Semester offering selector (program → session → semester)
  - Enrolled students table with per-row batch dropdown (amber border when dirty)
  - Bulk-select panel: select students → pick a batch → Apply to all selected
  - Amber unsaved-changes footer: dirty count + Discard + Save Assignments buttons
  - Batches filtered by the semester offering's programId
- `nav-config.ts` — added **Batch Assignment** (`UserCheck` icon) to admin + academic_coordinator sidebars

---

## Session 11 — course_offerings: section → batch_id

**Status:** Done  
**Date:** 2026-05-05

### Backend
- `db/schema/scheduling.ts` — replaced `section varchar(10)` with `batchId uuid` FK → `batches` (on delete set null); unique constraint updated from `(tenantId, semesterOfferingId, courseId, section)` to `(tenantId, semesterOfferingId, courseId, batchId)`
- `lib/validators/scheduling.validator.ts` — replaced `section: z.string().min(1).max(10)` with `batchId: z.string().uuid().nullable().optional()` across all three schemas; also fixed remaining `z.record(z.unknown())` → `z.record(z.string(), z.unknown())` (Zod v4 requires 2 args)
- `services/scheduling.service.ts` — updated `listCourseOfferings` + `getCourseOfferingById` to join `batches` table and return `batchId/batchName/batchCode`; updated `createCourseOffering` dup-check to use `isNull()` when `batchId` is null (drizzle-orm `eq()` cannot take `null`); updated `bulkSaveCourseOfferings` existingMap key
- `db/migrations/0016_course_offering_section_to_batch.sql` — manually written (drizzle-kit needs interactive TTY for renames); applied via `npm run db:migrate`

### Frontend
- `lib/api/scheduling.ts` — `CourseOfferingRow`: removed `section`, added `batchId/batchName/batchCode`; `BulkSaveCourseOfferingsPayload`: same
- `/dashboard/scheduling/page.tsx` — section text `<input>` replaced with batch `<select>` dropdown (batches filtered by selected programId); table header updated; `addCourse` default changed; `saveCourseMut` payload updated

---

## Session 12 — Teacher Panel: My Courses

**Status:** Done  
**Date:** 2026-05-05

### Backend
- `services/teacher.service.ts` — added `getMyAssignedCourses(tenantId, userId)`: resolves teacher from userId, joins courseOfferings → courses, semesterOfferings, programs, academicSessions, batches; returns `{ teacher: { id, name, designation }, data: rows[] }`
- `routes/teacher.route.ts` — added `GET /me/courses` with `rbac('teacher')` declared before `/:id` to avoid param capture

### Frontend
- `lib/api/teachers.ts` — added `SemesterOfferingStatus`, `CourseType`, `AssignedCourseRow`, `MyCoursesResult` types; added `getMyAssignedCoursesApi`
- `/dashboard/my-courses/page.tsx` (new page):
  - Groups courses by `semesterOfferingId`, sorted active → planned → completed
  - `CourseCard` component: type badge (CORE/ELECTIVE), course code + credits, title, program + session, batch + capacity, semester status badge, date range
  - Summary chips in header (active count, total count)
  - Skeleton loader (6 placeholder cards) + empty state with guidance
- `nav-config.ts` — added **My Courses** (`Library` icon) to teacher sidebar

---

## Session 13 — Course Syllabus

**Status:** Done  
**Date:** 2026-05-05

### Backend

#### Schema (`db/schema/syllabus.ts`) — migration `0017_syllabus_tables.sql`
- `syllabusStatusEnum` — `draft | final`
- `course_syllabi` — id, tenantId, courseId (FK → courses, restrict), version varchar(10), isDefault boolean, status enum (default draft), soft-delete fields; unique `(tenantId, courseId, version)`
- `syllabus_audit_logs` — standard audit shape (action uses existing `audit_action` enum)
- `syllabus_topics` — id, tenantId, syllabusId (FK → course_syllabi, cascade), title varchar(255), description text, status enum, orderNo integer, estimatedHours numeric(5,1), audit fields (no soft-delete)
- `db/schema/index.ts` — added `export * from './syllabus'`

#### Validators (`lib/validators/syllabus.validator.ts`)
- `createSyllabusSchema` — `{ courseId: uuid }`
- `upsertTopicSchema` — title (required, max 255), description (nullable), orderNo (optional int), estimatedHours (nullable float)
- `updateTopicSchema = upsertTopicSchema.partial()` — all fields optional for partial patch saves
- `reorderTopicsSchema` — `{ orderedIds: uuid[] }`

#### Service (`services/syllabus.service.ts`)
- `listSyllabiForCourse` — filters to `final` only for teacher/student, all statuses for coordinator/admin
- `createSyllabus` — auto-increments version (v1 → v2 → v3…); sets `isDefault=true` if first syllabus for the course
- `getSyllabusWithTopics` — returns syllabus + topics ordered by `orderNo ASC`
- `finalizeSyllabus` — marks syllabus + all topics as `final`; locked after that
- `setDefaultSyllabus` — clears existing default for course, sets new one (final syllabi only)
- `deleteSyllabus` — only draft syllabi can be deleted
- `createTopic` — auto-computes next `orderNo`; saves as `draft`
- `updateTopic` — partial update; rejects if syllabus is final
- `deleteTopic` — hard delete; rejects if syllabus is final
- `reorderTopics` — sets `orderNo = index + 1` for each id in `orderedIds`
- `getSyllabusAuditLogs`

#### Route (`routes/syllabus.route.ts`) — `/api/syllabi`
| Method | Path | Read Roles | Write Roles |
|--------|------|-----------|------------|
| GET | `/?courseId=` | all roles | — |
| POST | `/` | — | admin, super_admin, academic_coordinator |
| GET | `/:id` | all roles | — |
| PUT | `/:id/finalize` | — | write roles |
| PUT | `/:id/set-default` | — | write roles |
| DELETE | `/:id` | — | write roles |
| GET | `/:id/audit` | — | write roles |
| POST | `/:id/topics` | — | write roles |
| PUT | `/:id/topics/reorder` | — | write roles (declared before `/:topicId`) |
| PUT | `/:id/topics/:topicId` | — | write roles |
| DELETE | `/:id/topics/:topicId` | — | write roles |

- `index.ts` — registered `app.route('/api/syllabi', syllabusRoute)`

### Frontend

#### API client (`lib/api/syllabus.ts`)
- Types: `SyllabusStatus`, `SyllabusRow`, `SyllabusTopic`, `SyllabusWithTopics`, `UpsertTopicPayload`
- Functions: `listSyllabiApi`, `createSyllabusApi`, `getSyllabusApi`, `finalizeSyllabusApi`, `setDefaultSyllabusApi`, `deleteSyllabusApi`, `createTopicApi`, `updateTopicApi`, `deleteTopicApi`, `reorderTopicsApi`

#### Syllabus editor page (`/dashboard/courses/[courseId]/syllabus/page.tsx`)
- **Header**: back arrow → `/dashboard/courses`; title shows "Course Syllabus — {code} · {title}" (fetched via `getCourseByIdApi`); "New Version" button (write roles only)
- **Left sidebar**: version list (v1, v2…); default star icon; status badge; "Set default" + "Delete" inline links per version
- **Right panel** — `SyllabusPanel`:
  - Topic list powered by `@dnd-kit/core` + `@dnd-kit/sortable`; drag handle (GripVertical) per row
  - Inline title edit (input, no border, blur-saves); estimated hours input (blur-saves)
  - Description: shows `+ Add description` / truncated preview → click opens auto-focused textarea → blur saves + collapses
  - Local state synced with prop changes via `useEffect` + `prevTopicRef`
  - Drag-end handler calls `reorderTopicsApi` and updates `orderNo` locally
  - "Add Topic" button (creates row with "New Topic" title, auto-save as draft)
  - "Finalize Syllabus" green button → locks syllabus + all topics to `final`
  - Finalized view shows lock icon + "create new version to edit" hint
  - Read-only for teacher/student/dean (no drag, no edit, no finalize button)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` installed in uams-frontend

#### Courses page update (`/dashboard/courses/page.tsx`)
- Added **Manage Syllabus** (`ScrollText` icon, purple) to each course's action menu; navigates to `/dashboard/courses/{courseId}/syllabus`; visible to admin, super_admin, academic_coordinator

---

## Session 14 — OBE Mapping (CLO / PLO)

**Status:** Done

### Backend

#### Schema (`db/schema/obe.ts`) — migration `0018_obe_tables.sql`
- `blooms_level` enum — `remember | understand | apply | analyze | evaluate | create`
- `course_learning_outcomes` — id, tenantId, courseId (FK → courses, restrict), code (CLO1…), description, bloomsLevel; unique `(tenantId, courseId, code)`; soft-delete fields + audit
- `clo_audit_logs`
- `program_learning_outcomes` — id, tenantId, programId (FK → programs, restrict), code (PLO1…), description; unique `(tenantId, programId, code)`; soft-delete + audit
- `plo_audit_logs`
- `clo_plo_mappings` — cloId × ploId, weight (0.00–1.00 numeric); unique `(cloId, ploId)` + audit
- `clo_plo_mapping_audit_logs`

#### Validators (`lib/validators/obe.validator.ts`)
- `createCloSchema`, `updateCloSchema` — code, description, bloomsLevel (optional)
- `createPloSchema`, `updatePloSchema` — code, description
- `createMappingSchema` — cloId, ploId, weight (0–1); `updateMappingSchema` — weight only

#### Service (`services/obe.service.ts`)
- `listClos(tenantId, courseId)`, `createClo`, `getCloById`, `updateClo`, `deleteClo`, `getCloAuditLogs`
- `listPlos(tenantId, programId)`, `createPlo`, `getPloById`, `updatePlo`, `deletePlo`, `getPloAuditLogs`
- `listMappings(tenantId, cloId?, ploId?, courseId?)`, `createMapping`, `updateMapping`, `deleteMapping`

#### Route (`routes/obe.route.ts`) — `/api/obe`
| Method | Path | Access |
|--------|------|--------|
| GET | `/clos?courseId=` | read roles |
| POST | `/clos` | write roles |
| GET | `/clos/:id` | read roles |
| GET | `/clos/:id/audit` | admin, super_admin |
| PUT | `/clos/:id` | write roles |
| DELETE | `/clos/:id` | write roles |
| GET | `/plos?programId=` | read roles |
| POST | `/plos` | write roles |
| GET | `/plos/:id` | read roles |
| GET | `/plos/:id/audit` | admin, super_admin |
| PUT | `/plos/:id` | write roles |
| DELETE | `/plos/:id` | write roles |
| GET | `/mappings?cloId=\|ploId=\|courseId=` | read roles |
| POST | `/mappings` | write roles |
| PUT | `/mappings/:id` | write roles |
| DELETE | `/mappings/:id` | write roles |

### Frontend

#### API client (`lib/api/obe.ts`)
- Types: `BloomsLevel`, `CloRow`, `PloRow`, `MappingRow`
- Functions: full CRUD for CLOs, PLOs, and mappings

#### OBE Mapping page (`/dashboard/obe/mapping`)
- Course selector → loads CLOs for that course; Program selector → loads PLOs for that program
- CLO table: code, description, Bloom's level badge (colour-coded), add/edit/delete inline
- PLO table: same structure
- Mapping matrix: CLO × PLO grid with weight inputs where a mapping exists; click empty cell to add
- Nav entry: **OBE Mapping** (`Link2` icon) added to admin + academic_coordinator sidebars

---

## Session 15 — Assessment Plans

**Status:** Done

### Backend

#### Schema (`db/schema/assessment.ts`) — migration `0019_assessment_tables.sql`
- `assessment_component_type` enum — `quiz | assignment | midterm | final | lab | project | presentation | other`
- `assessment_plan_status` enum — `draft | final`
- `course_assessment_plans` — id, tenantId, courseId (FK restrict), academicSessionId (FK restrict), version (v1/v2…), status, isDefault; unique `(tenantId, courseId, academicSessionId, version)`; soft-delete + audit
- `assessment_plan_audit_logs`
- `course_assessment_components` — id, tenantId, planId (FK cascade), name, componentType, weightPercentage, totalMarks, assessmentCount, cloMapped, orderNo; soft-delete + audit
- `assessment_component_clos` — componentId × cloId, weight (%); unique `(componentId, cloId)`

#### Validators (`lib/validators/assessment.validator.ts`)
- `createAssessmentPlanSchema` — courseId, academicSessionId
- `copyAssessmentPlanSchema` — sourcePlanId, targetSessionId (copy components + CLO links from a finalized plan)
- `createComponentSchema` — name, componentType, weightPercentage, totalMarks, assessmentCount, cloMapped, orderNo
- `updateComponentSchema` — all fields optional
- `addCloLinkSchema` — cloId, weight

#### Service (`services/assessment.service.ts`)
- `listPlans(tenantId, courseId, sessionId?, role)` — returns draft+final for coordinator/admin, final-only for teacher/student
- `createPlan` — auto-increments version (v1→v2…); sets isDefault=true if first for course+session
- `copyPlan` — copies all components + CLO links from a finalized source plan to a new draft in the target session
- `getPlanWithComponents` — returns plan + components + CLO links in one response
- `finalizePlan` — sets status=final; locked after
- `setDefaultPlan` — clears existing default for course+session; sets new one (final only)
- `deletePlan` — draft only
- `getPlanAuditLogs`
- `createComponent`, `updateComponent`, `deleteComponent`
- `addCloLink`, `removeCloLink`

#### Route (`routes/assessment.route.ts`) — `/api/assessment-plans`
| Method | Path | Access |
|--------|------|--------|
| GET | `/?courseId=&sessionId=` | all roles |
| POST | `/` | write roles |
| POST | `/copy` | write roles |
| GET | `/:id` | all roles |
| GET | `/:id/audit` | write roles |
| PUT | `/:id/finalize` | write roles |
| PUT | `/:id/set-default` | write roles |
| DELETE | `/:id` | write roles |
| POST | `/:id/components` | write roles |
| PUT | `/:id/components/:componentId` | write roles |
| DELETE | `/:id/components/:componentId` | write roles |
| POST | `/:id/components/:componentId/clos` | write roles |
| DELETE | `/:id/components/:componentId/clos/:linkId` | write roles |

#### Seed (`db/seed-assessment.ts`)
- `npm run db:seed:assessment` — idempotent seed; creates sample assessment plan with components (Quiz 10%, Assignment 10%, Midterm 30%, Final 50%) under test course
- Added `"db:seed:assessment"` to `package.json`

### Frontend

#### API client (`lib/api/assessment.ts`)
- Types: `AssessmentComponentType`, `PlanStatus`, `AssessmentPlanRow`, `AssessmentComponent`, `CloLink`, `PlanWithComponents`
- Functions: `listPlansApi`, `createPlanApi`, `copyPlanApi`, `getPlanApi`, `finalizePlanApi`, `setDefaultPlanApi`, `deletePlanApi`, `createComponentApi`, `updateComponentApi`, `deleteComponentApi`, `addCloLinkApi`, `removeCloLinkApi`

#### Assessment Plan page (`/dashboard/courses/[courseId]/assessment-plan`)
- Header: back arrow, course code + title, session selector (academic sessions dropdown)
- **No plan state**: two-option panel — "Create from Scratch" button + "Copy from Previous Session" section (shows finalized plans from other sessions in a dropdown → confirm copy)
- **Plan sidebar**: version list (v1, v2…); default star; status badge; "Set default" + "Delete" links
- **Component editor** (draft only):
  - Table: name, type badge, weight %, total marks, count, CLO linked badge
  - Inline add row: name input, type select, weight/marks/count inputs → save on blur
  - Per-component: edit inline, add/remove CLO links via popover, delete
  - Weight total validation (must sum to 100 before finalizing)
  - "Finalize Plan" button → locks plan + shows read-only view
- Finalized view: read-only table with lock icon
- Courses page: **Manage Assessment** action added to each course row

---

## Session 16 — Slot Master + Room Master + Timetable Seed

**Status:** Done

### Backend

#### Schema (`db/schema/timetable.ts`) — migration `0020_slot_room_master.sql`
- `room_type` enum — `THEORY | LAB`
- `time_slots` — id, tenantId, name (varchar 50), startTime (HH:MM varchar 5), endTime (HH:MM), durationMinutes, isActive; unique `(tenantId, name)`
- `rooms` — id, tenantId, name (varchar 100), capacity, type (default THEORY), isActive; unique `(tenantId, name)`

#### Validators (`lib/validators/timetable.validator.ts`)
- `createSlotSchema`, `updateSlotSchema`, `bulkCreateSlotsSchema` — HH:MM regex for time fields
- `createRoomSchema`, `updateRoomSchema`, `bulkCreateRoomsSchema`

#### Service (`services/timetable.service.ts`)
- `listSlots`, `createSlot`, `updateSlot`, `deleteSlot`
- `bulkUpsertSlots` — `onConflictDoUpdate` on `(tenantId, name)`
- `listRooms`, `createRoom`, `updateRoom`, `deleteRoom`
- `bulkUpsertRooms` — `onConflictDoUpdate` on `(tenantId, name)`

#### Routes
**`/api/slots`** and **`/api/rooms`** — full CRUD + `POST /bulk`; write access admin + super_admin only

#### Seed (`db/seed-timetable.ts`)
- 7 time slots: Slot 1 (08:00–09:30) through Slot 7 (19:15–20:45), 90 min each
- 10 rooms: Room 101/102 (cap 50), Room 201/202 (cap 60), Room 301 (cap 40), Seminar Hall (cap 100), Lab A/B (cap 30), CS Lab (cap 25), Network Lab (cap 20)
- Idempotent check by name before insert

### Frontend

#### API client (`lib/api/timetable.ts`)
- Types: `RoomType`, `TimeSlotRow`, `RoomRow`, `CreateSlotPayload`, `CreateRoomPayload`
- Functions: `listSlotsApi`, `createSlotApi`, `updateSlotApi`, `deleteSlotApi`, `bulkCreateSlotsApi`; same set for rooms

#### Slot Master page (`/dashboard/slots`) — admin only
- Violet theme; summary cards: Total / Active / Inactive counts
- `parseSlotExcel(file)` — client-side xlsx parse, reads Name / Start Time / End Time / Duration / Active columns
- `downloadTemplate()` — generates sample .xlsx with headers
- Upload state machine: `idle | parsing | preview | uploading | done | error`
- Preview table (first 8 rows) → "Confirm Import" → bulk upsert
- `SlotRow` component: inline edit all fields, delete confirm modal

#### Room Master page (`/dashboard/rooms`) — admin only
- Teal theme; `TypeBadge` with THEORY (blue) / LAB (emerald) colours
- Filter tabs: All / THEORY / LAB (client-side)
- Same Excel upload/preview pattern as slots

#### Nav config
- Admin sidebar: added **Slot Master** (`Clock` icon) and **Room Master** (`DoorOpen` icon)

---

## Session 17 — Class Routine Builder

**Status:** Done

### Backend

#### Schema (`db/schema/class-schedule.ts`) — migration `0021_class_schedules.sql`
- `class_schedule_status` enum — `SCHEDULED | COMPLETED | CANCELLED | RESCHEDULED`
- `day_of_week` enum — `SUN | MON | TUE | WED | THU | FRI | SAT`
- `class_schedules` — id, tenantId, courseOfferingId (FK restrict), courseId (FK restrict), teacherId (FK set null), batchId (FK set null), section, sessionDate (date), dayOfWeek, timeSlotId (FK restrict), topicId, syllabusTopicId (FK set null), status (default SCHEDULED), roomId (FK set null), isMakeupClass, notes; full audit + soft-delete
- `class_schedule_audit_logs` — scheduleId (no FK), action, performedBy, snapshot (jsonb)

#### Validators (`lib/validators/class-schedule.validator.ts`)
- `scheduleRowSchema` — sessionDate (YYYY-MM-DD), dayOfWeek enum, timeSlotId (uuid), roomId, syllabusTopicId, topicId, isMakeupClass, notes
- `bulkCreateSchedulesSchema` — courseOfferingId + rows (1–500)
- `checkConflictsSchema` — courseOfferingId + rows (sessionDate, dayOfWeek, timeSlotId, roomId)
- `updateScheduleSchema` — all optional: timeSlotId, roomId, sessionDate, status, syllabusTopicId, topicId, notes

#### Service (`services/class-schedule.service.ts`)
- `getPendingRoutineCount(tenantId)` — raw SQL: COUNT of course_offerings with no class_schedules (LEFT JOIN / IS NULL)
- `listOfferingsForRoutine(tenantId)` — enriched raw SQL with course/batch/teacher + `has_routine` boolean
- `checkConflicts(tenantId, input)` — single SQL query with `sql.join` dynamic arrays; checks ROOM / TEACHER / BATCH conflicts; returns `ScheduleConflict[]` (empty = no conflicts)
- `bulkCreateSchedules` — calls `checkConflicts` as hard server-side guard first (throws if conflicts), then resolves offering context, bulk insert, bulk audit log insert
- `listSchedulesByOffering` — LEFT JOINs to timeSlots and rooms
- `updateSchedule` — before/after audit
- `cancelSchedule` — soft delete + audit

#### Route (`routes/class-schedule.route.ts`) — `/api/class-schedules`
| Method | Path | Access |
|--------|------|--------|
| GET | `/pending-count` | academic_coordinator, admin, super_admin |
| GET | `/offerings` | same |
| POST | `/check-conflicts` | same |
| GET | `/` with `?offeringId=` | + dean, teacher |
| POST | `/bulk` | coord roles |
| PUT | `/:id` | coord roles |
| DELETE | `/:id` | coord roles |

### Frontend

#### API client (`lib/api/class-schedule.ts`)
- Types: `DayOfWeek`, `ScheduleStatus`, `ConflictType`, `OfferingForRoutine`, `ScheduleConflict`, `ScheduleRow`, `CheckConflictsRow`, `BulkCreateRow`
- Functions: `getPendingCountApi`, `listOfferingsForRoutineApi`, `checkConflictsApi`, `bulkCreateSchedulesApi`, `listSchedulesApi`, `updateScheduleApi`, `cancelScheduleApi`

#### Class Routine Builder (`/dashboard/scheduling/routine/page.tsx`)
4-step wizard:
1. **Select Course Offering** — dropdown with `has_routine` indicator (✓ suffix), teacher + batch chips shown below
2. **Weekly Pattern** — one or more pattern rows; each row has day-of-week chip toggles (circular buttons, Su–Sa) + time slot select; "+ Add another slot" for multiple patterns
3. **Date Range & Room** — start date, end date, default room select; "Generate Preview" button (disabled until all fields filled); triggers conflict check in background
4. **Preview & Edit** — editable table of all generated classes; per-row: time slot select override, room select override, delete row; conflict badge (ROOM/TEACHER/BATCH) shown per row; overall conflict count badge; "← Modify pattern" back link; "Create Schedule" submit button

- After submit: invalidates `pending-routine-count` and `routine-offerings` queries
- Client-side date generation: iterates start→end, filters by selected weekdays using `getDay()` mapping

#### Dashboard notification (`/dashboard/page.tsx`)
- `PendingRoutineBanner` component for `academic_coordinator` role: amber alert bar showing count + "X course offerings need class routines" message; links to `/dashboard/scheduling/routine`; disappears when count is 0

#### Nav config
- Admin sidebar: added **Class Routine** (`CalendarRange` icon)
- Academic Coordinator sidebar: added **Class Routine** (`CalendarRange` icon)

---

## Session 18 — Add Class Panel + Concurrent User Safety

**Status:** Done

### Backend

#### Migration `0022_class_schedule_unique_indexes.sql`
Three partial unique indexes applied directly (not via drizzle-kit generate):
- `uq_cs_room_slot` — `(tenant_id, session_date, time_slot_id, room_id)` WHERE `room_id IS NOT NULL AND deleted_at IS NULL AND status != 'CANCELLED'`
- `uq_cs_teacher_slot` — `(tenant_id, session_date, time_slot_id, teacher_id)` WHERE `teacher_id IS NOT NULL AND deleted_at IS NULL AND status != 'CANCELLED'`
- `uq_cs_batch_slot` — `(tenant_id, session_date, time_slot_id, batch_id)` WHERE `batch_id IS NOT NULL AND deleted_at IS NULL AND status != 'CANCELLED'`
- Applied via one-off `apply-0022.ts` script (deleted after run); `_journal.json` updated with idx 22 entry

#### Service (`services/class-schedule.service.ts`)
- `bulkCreateSchedules` wrapped in `db.transaction(async (tx) => { ... })` — inserts rows then writes audit logs atomically
- Catches PostgreSQL `23505` unique violation; maps constraint name to friendly message (room / teacher / batch double-booking); re-throws others
- Race condition approach: pre-check via `checkConflicts` for fast UX feedback; DB-level unique indexes as hard fallback for concurrent users (TOCTOU protection)

### Frontend

#### Syllabus hours validation (`/dashboard/scheduling/routine/page.tsx`)
- On Generate Preview: fetches default/final syllabus for the selected course (`listSyllabiApi` + `getSyllabusApi`)
- `totalRequiredHours` = sum of `parseFloat(topic.estimatedHours)` across all topics
- `totalClassHours` = sum of slot `durationMinutes` / 60 across all generated rows
- `hoursValidation` state: `{ classCount, classHours, requiredHours, topicCount }`
- Validation bar shown above preview table: green (±0.5 hr tolerance), red (under), amber (over)
- Syllabus info chip in offering details: version, topic count, required hours

#### Add Class panel (inline form below preview table)
- Fields: session date picker, time slot select, room select (optional), makeup checkbox
- **Check & Add** button: calls `checkConflictsApi` with single row
  - No conflicts → row appended immediately + hours recomputed
  - Conflict found → amber warning inline showing conflict type and existing course; **Add anyway** / **Cancel** options
- `recomputeHours(rows)` helper: recalculates `classCount` and `classHours` in `hoursValidation` after any add or remove
- `removePreviewRow` updated to call `recomputeHours` after deletion

---

## Session 19 — Teacher Class Routine Calendar

**Status:** Done

### Backend

#### Service (`services/class-schedule.service.ts`)
- Added `getMyUpcomingClasses(tenantId, userId)`: resolves teacher from userId; raw SQL joining `class_schedules → courses → batches → time_slots → rooms → syllabus_topics`; returns next 10 upcoming non-cancelled classes ordered by `session_date ASC, slot_start ASC`; LIMIT 10

#### Route (`routes/class-schedule.route.ts`) additions
| Method | Path | Access |
|--------|------|--------|
| GET | `/my-upcoming` | teacher (rbac) |
| PATCH | `/:id/topic` | teacher (rbac) |

- Both routes declared before `GET /` and `PUT /:id` to avoid param capture
- `PATCH /:id/topic` accepts `{ syllabusTopicId: uuid | null }` body; calls existing `updateSchedule` with only that field

### Frontend

#### API client (`lib/api/class-schedule.ts`)
- Added `UpcomingClassRow` interface: `id, session_date, day_of_week, status, is_makeup_class, notes, course_offering_id, syllabus_topic_id, course_id, course_code, course_title, batch_name, slot_name, slot_start, slot_end, room_name, topic_title`
- Added `getMyUpcomingApi()` → `GET /api/class-schedules/my-upcoming`
- Added `assignTopicApi(id, syllabusTopicId)` → `PATCH /api/class-schedules/:id/topic`

#### Teacher course routine page (`/dashboard/my-courses/[offeringId]/routine/page.tsx`) — NEW
- Route params: `offeringId` from `useParams()`; `courseId`, `courseCode`, `courseTitle`, `batchName` from `useSearchParams()`
- Fetches all schedules for the offering via `listSchedulesApi(offeringId)`
- **Week view** (default): custom 7-column grid (Mon–Sun); rows = distinct time slots sorted by `slotStart`; class cells placed at `(date, slotId)` intersections; prev / next week navigation via week-offset state
- **List view**: schedules grouped by date, chronological flat list with slot + room + status chips
- **Side panel** (fixed right-side overlay): opened on any class cell or list row click
  - Shows: session date, time slot, room, status badge
  - Syllabus topic picker: fetches course default syllabus via `listSyllabiApi` + `getSyllabusApi`; select dropdown of topics; **Save topic** → `assignTopicApi` mutation; invalidates schedule list query
  - Cancel class: two-step confirm (first click shows confirm button; second click calls `cancelScheduleApi`); on success invalidates query + closes panel
- Summary chips in header: total / completed / cancelled / topics-set counts
- `STATUS_COLOR` map for colour-coded status badges across both views

#### My Courses page update (`/dashboard/my-courses/page.tsx`)
- Added `useRouter` import + `CalendarRange` icon from lucide-react
- `CourseCard` component receives `onViewSchedule: () => void` prop
- "Schedule" button added to card footer using `CalendarRange` icon
- Navigation target: `/dashboard/my-courses/{courseOfferingId}/routine?courseId=...&courseCode=...&courseTitle=...&batchName=...`

#### Teacher dashboard update (`/dashboard/page.tsx`)
- Added `TeacherUpcomingClasses` component: fetches `getMyUpcomingApi`; renders each row with date number + month column, course code / title, slot / room / batch info, topic badge (when assigned)
- Each row navigates to the course's routine page on click
- Rendered in teacher dashboard bottom-right panel slot (previously a "nothing scheduled" placeholder)

#### Nav config
- Admin sidebar: **Class Routine** (`CalendarRange` icon) at `/dashboard/scheduling/routine` (already added in Session 17)
- Academic Coordinator sidebar: same (already added)

---

## Session 20 — Student Panel: My Courses + Full Schedule + Upcoming Widget

**Status:** Done

### Backend

#### Service additions

**`services/class-schedule.service.ts`**
- `getStudentSchedule(tenantId, userId)` — raw SQL; resolves student via `users.id = userId → users.email = students.gmail_account → student_enrollments.batch_id`; returns all non-cancelled, non-deleted class schedules where `batch_id` is in the student's enrolled batches; enriched with course code/title, batch name, slot name/start/end, room name, topic title; ordered by `session_date ASC, slot_start ASC`
- `getStudentUpcomingTomorrow(tenantId, userId)` — same join chain but adds `session_date = (CURRENT_DATE + INTERVAL '1 day')::date`; no limit (returns all of tomorrow's classes ordered by slot start time)

**`services/student.service.ts`**
- `getStudentCourses(tenantId, userId)` — raw SQL; resolves student's batch IDs via same join chain; returns all `course_offerings` where `batch_id IN (student's batch IDs)`; enriched with course code/title/credits/type, semester_no/status/dates, program name/code, session name, batch id/name/code, teacher name, `has_schedule` boolean (EXISTS subquery on class_schedules)

#### Route additions

**`routes/class-schedule.route.ts`**
- Added `studentRbac = rbac('student')`
- `GET /student-schedule` (studentRbac) → `getStudentSchedule` — declared before `GET /` to avoid param capture
- `GET /student-upcoming` (studentRbac) → `getStudentUpcomingTomorrow`

**`routes/student.route.ts`**
- `GET /me/courses` (student rbac) → `getStudentCourses` — declared before `GET /me` to avoid param shadowing

### Frontend

#### API client additions

**`lib/api/class-schedule.ts`**
- `StudentScheduleRow` interface: `id, session_date, day_of_week, status, is_makeup_class, notes, course_offering_id, syllabus_topic_id, course_id, course_code, course_title, batch_name, slot_name, slot_start, slot_end, room_name, topic_title`
- `getStudentScheduleApi()` → `GET /api/class-schedules/student-schedule`
- `getStudentUpcomingTomorrowApi()` → `GET /api/class-schedules/student-upcoming`

**`lib/api/students.ts`**
- `StudentCourseRow` interface: `offering_id, course_id, course_code, course_title, credits, course_type, semester_no, semester_status, semester_start_date, semester_end_date, program_name, program_code, session_name, batch_id, batch_name, batch_code, teacher_name, has_schedule`
- `getStudentCoursesApi()` → `GET /api/students/me/courses`

#### My Courses page — role-aware (`/dashboard/my-courses/page.tsx`)

Page now checks `currentUserAtom.role` and renders either `TeacherMyCourses` or `StudentMyCourses`:
- `TeacherMyCourses`: existing behavior (course cards grouped by semester offering, "Schedule" button → per-offering routine page)
- `StudentMyCourses`: fetches `getStudentCoursesApi`; course cards show course type/code/credits/title, program, session/semester, batch, teacher name, semester status + date range; groups by program+session+semester, sorted active → planned → completed; if `has_schedule=true` shows "Schedule" link → `/dashboard/schedule`; if false shows greyed "No schedule"; header includes "Full Schedule" button linking to `/dashboard/schedule`

#### Student Schedule page — new (`/dashboard/schedule/page.tsx`)

Full-page calendar for all courses the student is enrolled in:
- **Course legend**: colour-coded chips for each unique course (8-colour palette: indigo, emerald, amber, rose, cyan, purple, orange, teal); colour assignment is deterministic via `colorMap` (Map keyed by `course_id`, cycles through palette by insertion order)
- **View toggle**: Week / List (pill toggle button in header)
- **Week view**:
  - Custom 7-column table (Sun–Sat); rows = distinct slot names sorted by `slot_start`; today's column highlighted with indigo date circle
  - Each cell: coloured button showing `course_code`, room, topic (if assigned); click → side panel
  - Empty weeks show placeholder card
  - Week navigation: ← / → buttons + "Today" shortcut; week range label; class count for current week
- **List view**:
  - All schedules grouped by date, sorted chronologically
  - Each date group: date number + month header with class count; rows show coloured left-border bar, course code + title, slot/room info, topic chip if assigned
- **Side panel** (fixed 320px right overlay): shows full class details — date (long format), slot name + times, room, batch, topic, makeup badge, notes; opens on any cell/row click; close button top-right; panel background uses course accent colour
- `pr-80` added to page container when panel is open to prevent content overlap

#### Student dashboard update (`/dashboard/page.tsx`)

- Added `getStudentUpcomingTomorrowApi` and `StudentScheduleRow` to import from `class-schedule`
- Added `StudentUpcomingClasses` component: fetches `getStudentUpcomingTomorrowApi`; shows tomorrow's date label; each class row is an indigo card with coloured left bar, course code/title, slot/room info, topic chip; "No classes tomorrow" empty state; "View full schedule →" link at the bottom
- Replaced "Upcoming" placeholder panel in `StudentDashboard` with `<StudentUpcomingClasses />`

#### Nav config (`nav-config.ts`)

Added to student nav (between Dashboard and Assignments):
- `{ label: 'My Courses', href: '/dashboard/my-courses', icon: Library }`
- `{ label: 'Schedule',   href: '/dashboard/schedule',   icon: CalendarRange }`

---

## Pending / Next Up

- Assignment module (create, submit, evaluate, publish results)
- Quiz module (create, attempt, auto-grade)
- Result & GPA module (semester GPA, cumulative GPA, transcript)
