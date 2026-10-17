# AGENTS.md

## Stack & requirements

- **Node 22.19.0+** (see `.nvmrc`), npm (lockfile present)
- Next.js 15.5 (App Router, RSC, Server Actions), React 19, TypeScript strict
- Prisma 6 + PostgreSQL, NextAuth v5 (Auth.js), Tailwind v4, shadcn/ui
- Path alias: `@/*` → `./src/*`

## Commands

```bash
npm run dev              # dev server
npm run build            # prisma generate && next build
npm run lint             # ESLint (flat config)
npm run typecheck        # tsc --noEmit
npm run test             # vitest run --project unit
npm run test:integration # vitest run --project integration (needs TEST_DATABASE_URL)
npm run test:e2e         # Playwright
npm run db:migrate       # prisma migrate dev (interactive, needs TTY)
npm run db:deploy        # prisma migrate deploy (CI/prod)
npm run db:seed          # tsx prisma/seed.ts
```

Run `lint -> typecheck -> test:unit` before committing. ESLint is **not** run during `next build` (`eslint.ignoreDuringBuilds: true`), so lint must be run explicitly.

## Architecture

### Feature-sliced modules (`src/features/<name>/`)

Every feature follows the same shape:

| File | Role |
|------|------|
| `actions.ts` | `"use server"` mutations; validate with Zod, enforce ownership, `revalidatePath` |
| `queries.ts` | `"server-only"` reads; scope every query by `userId`, return plain DTOs |
| `schemas.ts` | Zod schemas + inferred types (shared by client forms and server actions) |
| `types.ts` | View-model types |
| `components/` | `"use client"` UI |

### Request flow

```
Browser → middleware.ts (edge, redirect-only — NOT the security boundary)
       → (dashboard)/layout.tsx → requireUser() → onboarding check
       → page.tsx (RSC) → feature queries.ts → Prisma → Postgres
       → client components → server actions (actions.ts) → revalidatePath
```

### Auth (two configs — do not merge)

- `src/lib/auth/config.ts` — **edge-safe** (`authConfig`): no Prisma/bcrypt imports. Used by `middleware.ts`. Contains the `authorized` callback (redirect-only).
- `src/lib/auth/auth.ts` — **Node runtime**: wires Prisma adapter, Credentials provider, bcrypt, JWT callbacks.

Authorization boundary is `src/lib/auth/current-user.ts`:
- `getSessionUser()` — resolves JWT `sub` to DB user (React `cache`d per request)
- `requireUser()` — redirects to `/sign-in` if unauthenticated
- `requireOnboardedUser()` — additionally redirects to `/onboarding`

**Every action uses `requireOnboardedUser()`; every page uses `requireUser()`.**

### Server action result pattern

Actions return a discriminated union from `src/lib/action-result.ts`:

```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors }
```

Helpers: `ok(data)`, `fail(message, fieldErrors?)`, `zodFieldErrors(zodError)`.

### Data access rules

- Always scope reads/writes with `userId` from server context — never trust a client-sent `userId`.
- Prefer `findFirst({ where: { id, userId } })` and `updateMany`/`deleteMany` with `{ id, userId }` over `findUnique`/`update` by id alone.
- Validate that referenced foreign IDs (life area, project, task, tag) belong to the user before linking.
- RSC pages pass **plain serializable DTOs** into client views — never Prisma model instances.

## Date & time conventions

Two distinct concepts — do not conflate:

| Concept | Storage | Used for |
|---------|---------|----------|
| **DateOnly** (`"YYYY-MM-DD"`) | `@db.Date` | Deadlines, check-ins, occurrence dates |
| **Instant** (real point in time) | `@db.Timestamptz(3)` (UTC) | Events, reminders, audit timestamps |

- DateOnly arithmetic is always UTC-based (`Date.UTC`, `getUTC*`) — never use local `Date` getters.
- Month/year arithmetic clamps (Jan 31 + 1 month → Feb 28/29).
- "Which day is it?" is answered in the user's timezone via `date-fns-tz` helpers in `src/lib/dates`.
- Weekday numbering: `0 = Sunday … 6 = Saturday`.

## Domain core (`src/lib/`)

Pure functions, no I/O, heavily unit-tested:

- `dates/` — `DateOnly` type, UTC-safe arithmetic, timezone helpers
- `recurrence/` — structured occurrence generation (not RRULE strings)
- `working-days.ts` — Saturday presets, holidays, exceptional workdays
- `rewards/rules.ts` — point calculations + idempotency keys
- `goals/progress.ts` — `computeGoalProgress`
- `habits/` — scheduling, streaks, completion rates
- `analytics/series.ts` — chart series normalisation (`zeroFillDays`) + mood scoring
- `action-result.ts` — server action result contract
- `db.ts` — Prisma singleton (cached on `globalThis` for hot-reload)
- `env.ts` — server-only Zod env validation (`getServerEnv`)

## Testing

- **Unit** (`tests/unit/**/*.test.{ts,tsx}`): node env by default, no DB needed. Component tests (`.test.tsx`) opt into jsdom with a `// @vitest-environment jsdom` docblock and use `@testing-library/react` (call `cleanup` yourself — RTL aut-cleanup needs `globals: true`, which is off).
- **Integration** (`tests/integration/**/*.test.ts`): requires `TEST_DATABASE_URL` pointing at a separate Postgres database (tests truncate tables). Runs in `pool: forks`, `singleFork: true`, 30s timeout.
- **E2E**: Playwright (`npm run test:e2e`).

## Database

- `npm run build` runs `prisma generate` automatically (also in `postinstall`).
- Dev migrations: `npm run db:migrate` (interactive, needs TTY). Non-interactive: author `migration.sql` manually and run `prisma migrate deploy`.
- `prisma/seed.ts` builds a two-year demo account (`npm run db:seed`). It deletes and
  recreates only the demo user (default `demo@lifeos.dev` / `demo1234`), so it is safe to
  re-run against a shared dev database. Override with `DEMO_EMAIL`, `DEMO_PASSWORD`,
  `DEMO_TIMEZONE`, `DEMO_NAME` and `DEMO_SEED`.

## Known gaps

- `/analytics` reports 30-day trends (tasks, points, habit check-ins, mood, goals); it has no configurable range or per-life-area breakdown yet.
- No integration or e2e test files exist yet (configs are ready).
- Reminders/notifications have no dispatch scheduler.
- `GoalMetricType.HABIT_BASED` behaves like `NUMERIC` (no habit↔goal link).
- OAuth providers not configured (adapter models present for future).
