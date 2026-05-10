# UAMS — University Academic Management System

A multi-tenant SaaS platform for managing university academic operations, built as a monorepo.

## Structure

```
uams/
├── backend/    # Hono API server (Node.js + Drizzle ORM + PostgreSQL)
└── frontend/   # Next.js 15 App Router dashboard
```

## Features

- **Multi-tenancy** — shared schema with strict tenant isolation; every query is scoped by `tenantId`
- **Role-based access** — Super Admin, Admin, Dean, Academic Coordinator, Teacher, Student
- **Academic setup** — faculties, departments, courses, programs, academic sessions
- **Student lifecycle** — registration, batch assignment, fee structures, enrollment, semester scheduling
- **Syllabus management** — versioned syllabi with topic breakdown per course
- **OBE (Outcome-Based Education)** — CLOs per course, PLOs per program, CLO-PLO mapping with weights
- **Assessment plans** — versioned per course/session, component weights summing to 100%, CLO linkage, copy from previous session

## Quick Start

See individual READMEs:
- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

## Tech Stack

| Layer     | Technology                                        |
|-----------|---------------------------------------------------|
| Backend   | Node.js, Hono, Drizzle ORM, PostgreSQL, Redis     |
| Frontend  | Next.js 15 (App Router), TanStack Query, Jotai, Tailwind CSS |
| Auth      | JWT (access + refresh tokens), bcrypt, Google OAuth |
| Storage   | S3-compatible (AWS S3 / Cloudflare R2)            |
| Email     | Resend                                            |

## License

MIT
