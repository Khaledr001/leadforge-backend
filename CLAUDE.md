# LeadForge Backend — Claude Code guide

NestJS 11 + Prisma 6 + PostgreSQL REST API for the LeadForge platform.
Package manager: **pnpm**. The Next.js dashboard is a separate repo
(`../leadforge-frontend`) that calls this API over HTTP.

## Commands
- `pnpm start:dev` — dev server with watch (port 3001)
- `pnpm build` · `pnpm typecheck` · `pnpm lint`
- `pnpm prisma:generate` · `pnpm prisma:push` · `pnpm prisma:studio`

## Conventions
- TypeScript strict; no `any`, no `@ts-ignore`. ESLint 9 flat config.
- Every feature module is self-contained (controller + service + DTOs);
  DTOs use class-validator. Business logic in services, not controllers.
- Env only via `ConfigService` (typed namespaces in `src/config/`) —
  never `process.env` in feature code (config factories are the exception).
- Responses are wrapped by `TransformInterceptor` as `{ data, meta? }`;
  opt out with `@SkipTransform()`. Errors: `{ statusCode, message, error, timestamp, path }`.
- Auth: global `AuthGuard` (Supabase JWT). Mark open routes `@Public()`.
  In non-production with Supabase unset, auth is bypassed (dev convenience).

## Layout
- `src/config/` — typed config namespaces + Joi env validation
- `src/common/` — guards, interceptors, filters, decorators, interfaces
- `src/database/` — global `PrismaService`
- `src/health/` — `GET /health`
- `prisma/schema.prisma` — single source of DB truth
- Feature modules added per phase: leads, scraper, enricher, sites, ai-copy,
  outreach, clients, ai-services, billing, analytics

## Local env (already running natively)
- Postgres `:5432` (postgres/postgres, db `leadforge`), Redis `:6379`.
- Docker is not running; `docker-compose.yml` port-conflicts with the native services.

## Don't read (generated / large — wastes context tokens)
`node_modules/`, `dist/`, the Prisma client under `node_modules/.prisma/`,
`pnpm-lock.yaml`.

## Gotchas
- Prisma client generates to `node_modules/.prisma/client`; import from `@prisma/client`.
- If the build prompt references model `claude-sonnet-4-6`, that is not a real
  model id — use `claude-sonnet-5` or `claude-opus-4-8`.
