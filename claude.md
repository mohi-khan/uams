UAMS SaaS Technical Guidelines (MVP)
Overview
This document defines technical rules, multi-tenancy approach, security, and tech stack for building the University Academic Management System (SaaS MVP).
Tech Stack
Frontend: Next.js (App Router), TypeScript, Tailwind CSS
Backend: Node.js with Express or Next.js API Routes
ORM: Drizzle ORM
Database: PostgreSQL
Cache & Queue: Redis
Storage: S3-compatible (AWS S3 / Cloudflare R2)
Architecture Principles
- Modular architecture
- Separation of concerns (API, services, UI)
- Scalable SaaS-first design
- API-first development approach
Multi-Tenancy Strategy
Approach: Shared Database, Shared Schema

Rules:
- Every request must resolve tenant context
- Tenant identified via subdomain or JWT
- Every query must enforce tenant isolation
- No cross-tenant data access allowed
- Middleware must inject tenant_id into request lifecycle
Tenant Resolution
- Subdomain  (e.g., university1.app.com)
- OR JWT token-based tenant identification
- Middleware must validate tenant existence
- Reject request if tenant is invalid
Authentication
- JWT-based authentication
- Secure login with hashed passwords (bcrypt)
- Optional refresh token mechanism
- Session caching using Redis
Authorization (RBAC)
Roles:
- Super Admin
- Admin
- Dean
- Teacher
- Student

Rules:
- Role-based access enforced via middleware
- Each API endpoint must define allowed roles
- Principle of least privilege must be followed
Security Guidelines
- Enforce HTTPS
- Input validation using Zod
- Password hashing using bcrypt
- Rate limiting on APIs
- Protect against SQL Injection (via ORM)
- Protect against XSS and CSRF
- File upload validation (type & size)
- Use pre-signed URLs for storage
Code Rules
- Use TypeScript strictly
- Follow consistent naming conventions
- Separate business logic into services
- Avoid fat controllers
- Use reusable components
- Maintain clean folder structure
- Use environment variables for secrets
- No hardcoding of sensitive data
Redis Usage
- Cache frequently accessed data
- Store session/token data
- Use for background job queues
- Improve performance for repeated queries
API Design Rules
- RESTful API design
- Use proper HTTP methods
- Standard response format
- Centralized error handling
- Middleware-based validation and auth
Deployment Guidelines
- Frontend: Vercel
- Backend: VPS / Render / Railway
- Database: Managed PostgreSQL
- Redis: Upstash / Redis Cloud
- Use CI/CD pipelines
Important Constraints
- Tenant isolation is mandatory
- Security must not be compromised
- System must be scalable
- Avoid tight coupling between modules