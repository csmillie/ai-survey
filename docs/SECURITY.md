# Security

- **Authentication:** Email + password credentials
- **Password hashing:** bcrypt (12 rounds) via `src/lib/auth.ts`
- **Sessions:** httpOnly JWT cookies (HS256, signed with `JWT_SECRET`)
- **Route protection:** Middleware (`src/middleware.ts`) guards all `/app/*` routes
- **Authorization:** Survey-level sharing with VIEW/EDIT roles via `src/lib/survey-auth.ts`
- **Audit logging:** All sensitive operations logged to `AuditEvent` table via `src/lib/audit.ts`
- **Secrets:** API keys and credentials stored in `.env` only (gitignored). Accessed via typed helpers in `src/lib/env.ts`.
- **Input validation:** All server action inputs validated with Zod schemas from `src/lib/schemas.ts`
