# UAMS Backend

REST API for the University Academic Management System, built with [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), and PostgreSQL.

## Tech Stack

- **Runtime** — Node.js with `@hono/node-server`
- **Framework** — Hono (lightweight, TypeScript-first)
- **ORM** — Drizzle ORM
- **Database** — PostgreSQL
- **Cache / Queue** — Redis (ioredis)
- **Auth** — JWT (jsonwebtoken) + bcrypt
- **Validation** — Zod + `@hono/zod-validator`
- **Email** — Resend
- **Storage** — AWS S3 / Cloudflare R2 (`@aws-sdk/client-s3`)

## Project Structure

```
src/
├── db/
│   ├── migrations/         # 20 SQL migration files (Drizzle Kit)
│   ├── schema/             # Drizzle table definitions
│   │   ├── academic.ts     # courses, programs, sessions, faculties, departments
│   │   ├── users.ts        # users, roles
│   │   ├── tenants.ts      # tenant table
│   │   ├── enrollment.ts   # batches, fee structures
│   │   ├── scheduling.ts   # semester offerings, batch assignments
│   │   ├── student-enrollment.ts
│   │   ├── syllabus.ts     # versioned syllabi + topics
│   │   ├── obe.ts          # CLOs, PLOs, CLO-PLO mappings
│   │   └── assessment.ts   # assessment plans, components, CLO links
│   ├── seed.ts             # base seed (tenant, admin, academic data)
│   ├── seed-syllabus.ts
│   ├── seed-obe.ts
│   └── seed-assessment.ts
├── lib/
│   ├── db.ts               # Drizzle client
│   ├── redis.ts
│   ├── email.ts
│   ├── s3.ts
│   └── validators/         # Zod schemas per domain
├── middleware/
│   ├── auth.ts             # JWT verification → injects user into context
│   └── rbac.ts             # role-based access control helper
├── routes/                 # One file per resource
├── services/               # Business logic (no fat controllers)
├── types/
└── index.ts                # App entry point
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```env
PORT=8000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000

DATABASE_URL=postgresql://user:password@localhost:5432/uams

REDIS_URL=redis://localhost:6379

JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_refresh_secret_here
REFRESH_TOKEN_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=your_google_client_id_here

S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=uams-uploads
```

### 3. Run migrations

```bash
npm run db:migrate
```

### 4. Seed the database

```bash
npm run db:seed             # base data (tenant, admin user, academic structure)
npm run db:seed:syllabus    # syllabus topics for CSE101
npm run db:seed:obe         # CLOs, PLOs, and CLO-PLO mappings
npm run db:seed:assessment  # assessment plan for CSE101
```

### 5. Start the dev server

```bash
npm run dev
```

API runs at `http://localhost:8000`. Health check: `GET /health`

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled output |
| `npm run db:generate` | Generate a new Drizzle migration |
| `npm run db:migrate` | Apply all pending migrations |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |
| `npm run db:seed` | Seed base data |
| `npm run db:seed:syllabus` | Seed syllabus data |
| `npm run db:seed:obe` | Seed OBE data (CLOs, PLOs, mappings) |
| `npm run db:seed:assessment` | Seed assessment plan |

## API Endpoints

All routes are prefixed with `/api`.

| Resource | Base path |
|----------|-----------|
| Auth | `/api/auth` |
| Tenants | `/api/tenants` |
| Users | `/api/users` |
| Faculties | `/api/faculties` |
| Departments | `/api/departments` |
| Courses | `/api/courses` |
| Programs | `/api/programs` |
| Teachers | `/api/teachers` |
| Academic Sessions | `/api/sessions` |
| Students | `/api/students` |
| Batches | `/api/batches` |
| Fee Structures | `/api/fee-structures` |
| Enrollments | `/api/enrollments` |
| Program Offerings | `/api/program-offerings` |
| Semester Offerings | `/api/semester-offerings` |
| Syllabi | `/api/syllabi` |
| OBE (CLOs / PLOs / Mappings) | `/api/obe` |
| Assessment Plans | `/api/assessment-plans` |

### Assessment Plans — Key Routes

```
GET    /api/assessment-plans?courseId=&sessionId=   # list plans
POST   /api/assessment-plans                        # create new plan (draft)
POST   /api/assessment-plans/copy                   # copy plan from another session
GET    /api/assessment-plans/:id                    # get plan with components + CLO links
PUT    /api/assessment-plans/:id/finalize           # lock plan (requires weight = 100%)
PUT    /api/assessment-plans/:id/set-default        # mark as default for that session
DELETE /api/assessment-plans/:id                    # soft-delete draft plan

POST   /api/assessment-plans/:id/components         # add component
PUT    /api/assessment-plans/:id/components/:cId    # update component
DELETE /api/assessment-plans/:id/components/:cId    # remove component

POST   /api/assessment-plans/:id/components/:cId/clos          # link CLO
DELETE /api/assessment-plans/:id/components/:cId/clos/:linkId  # unlink CLO
```

## Multi-Tenancy

Every database table includes a `tenant_id` column. The `authMiddleware` resolves the tenant from the JWT, and every service function receives `tenantId` as its first argument. No cross-tenant data leakage is possible through the service layer.

## RBAC Roles

| Role | Capabilities |
|------|-------------|
| `super_admin` | Full access across all tenants |
| `admin` | Full access within their tenant |
| `academic_coordinator` | Manage academic content (courses, plans, OBE) |
| `dean` | Read access to faculty data |
| `teacher` | Read access to courses, schedules |
| `student` | Read access to own enrollment and schedules |
