# UAMS Frontend

Next.js 15 dashboard for the University Academic Management System.

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Language** — TypeScript
- **Styling** — Tailwind CSS
- **State / Server state** — Jotai (auth atom) + TanStack Query v5
- **HTTP client** — Axios (`apiClient`)
- **Icons** — Lucide React

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/              # Login page
│   ├── (public)/
│   │   ├── register/           # Tenant registration
│   │   ├── activate/           # Account activation
│   │   ├── verify/             # Email verification
│   │   └── check-email/
│   └── (dashboard)/
│       └── dashboard/
│           ├── page.tsx                        # Home / stats
│           ├── admin/                          # Super-admin panel
│           ├── faculties/
│           ├── departments/
│           ├── courses/
│           │   └── [courseId]/
│           │       ├── clos/                   # Course Learning Outcomes
│           │       ├── syllabus/               # Versioned syllabus editor
│           │       └── assessment-plan/        # Versioned assessment plans
│           ├── programs/
│           │   └── [programId]/
│           │       └── plos/                   # Program Learning Outcomes
│           ├── obe/
│           │   └── mapping/                    # CLO-PLO mapping matrix
│           ├── sessions/
│           ├── teachers/
│           ├── students/
│           ├── batches/
│           ├── enrollment/
│           │   └── program-offerings/
│           ├── scheduling/
│           │   └── batch-assignment/
│           └── my-courses/                     # Teacher view
├── components/
│   └── layout/
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── nav-config.ts       # Role-based navigation tree
├── lib/
│   ├── api/                    # One file per backend resource
│   │   ├── client.ts           # Axios instance with auth interceptor
│   │   ├── academic.ts
│   │   ├── assessment.ts
│   │   ├── obe.ts
│   │   ├── syllabus.ts
│   │   └── ...
│   └── providers.tsx           # TanStack Query + Jotai providers
├── store/
│   └── auth.ts                 # Jotai atom: current user + token
└── types/
    └── index.ts
```

## Getting Started

### Prerequisites

- Node.js 20+
- UAMS backend running at `http://localhost:8000`

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint check |

## Role-Based Navigation

The sidebar adapts based on the authenticated user's role:

| Role | Navigation |
|------|-----------|
| `super_admin` | Admin panel, all academic management |
| `admin` | Full academic management (faculties → assessment plans) |
| `academic_coordinator` | Courses, programs, OBE, assessment plans |
| `dean` | Read-only view of faculty structure |
| `teacher` | My Courses |
| `student` | Enrollment, schedule |

## Key Pages

### Assessment Plan (`/dashboard/courses/[courseId]/assessment-plan`)

- Select an academic session to load plans for that session
- **Empty session** — two options: create from scratch or copy the component structure from any previous session that has a finalized plan
- **Version list** — sidebar shows all plan versions (v1, v2…); multiple draft versions allowed
- **Plan panel** — add/edit/delete components (Quiz, Assignment, Lab, Midterm, Final, etc.), weight progress bar turns green when total reaches 100%, Finalize button locks the plan
- Each component can be expanded to manage CLO links with individual weights

### OBE Mapping (`/dashboard/obe/mapping`)

- Select a course → loads its CLOs
- Select a program → filters the mapping matrix to that program's PLOs
- Grid view with inline weight editing per CLO-PLO pair

### Syllabus Editor (`/dashboard/courses/[courseId]/syllabus`)

- Versioned syllabus with topic ordering
- Draft → Finalize workflow matching the assessment plan pattern

## API Layer

All backend calls go through `src/lib/api/client.ts`, an Axios instance that:
- Sets `Authorization: Bearer <token>` from the Jotai auth atom on every request
- Redirects to `/login` on `401` responses

Each resource has its own typed API module (e.g. `assessment.ts` exports `listPlansApi`, `createPlanApi`, `copyPlanApi`, etc.).

## Deployment

Deploy to [Vercel](https://vercel.com) — set the two environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) in the project settings.
