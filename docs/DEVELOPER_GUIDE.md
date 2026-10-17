# Life OS — Developer Guide

> Technical documentation for engineers building, extending, or deploying Life OS.
> For a non-technical overview, see [`PRODUCT_GUIDE.md`](./PRODUCT_GUIDE.md).

---

## Table of contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [Getting started](#3-getting-started)
4. [Project structure](#4-project-structure)
5. [Architecture](#5-architecture)
6. [Feature module anatomy](#6-feature-module-anatomy)
7. [Domain core libraries](#7-domain-core-libraries)
8. [Date, time & timezone conventions](#8-date-time--timezone-conventions)
9. [Data model](#9-data-model)
10. [Authentication & authorization](#10-authentication--authorization)
11. [Rewards engine](#11-rewards-engine)
12. [Recurrence engine](#12-recurrence-engine)
13. [UI & state conventions](#13-ui--state-conventions)
14. [Navigation & app shell](#14-navigation--app-shell)
15. [Cross-feature revalidation map](#15-cross-feature-revalidation-map)
16. [Environment & configuration](#16-environment--configuration)
17. [Database & migrations](#17-database--migrations)
18. [Testing](#18-testing)
19. [Build, lint & deploy](#19-build-lint--deploy)
20. [Conventions & guidelines](#20-conventions--guidelines)
21. [Known gaps & roadmap](#21-known-gaps--roadmap)

---

## 1. Overview

Life OS is a self-hosted personal life-management web app. Users sign up, complete
onboarding, and manage tasks, projects, goals, habits, a weekly timetable, a calendar,
notes, a journal, and a rewards ledger — all grouped by user-defined **life areas**.

### Guiding principles

- **Ownership everywhere.** Every user-owned row carries `userId`. Authorization is
  enforced in the data-access layer (`queries.ts` + `actions.ts`), never only in
  middleware or UI.
- **Derived values are computed on read.** Streaks, progress, and point totals are never
  cached unless documented, so there is a single source of truth.
- **Pure domain core.** Scheduling, recurrence, working-day, progress, streak, and reward
  logic live in `src/lib/*` as pure, unit-tested functions.
- **Server-first.** Data is fetched in React Server Components; mutations are Next.js
  Server Actions.

---

## 2. Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 15.5** (App Router, React Server Components, Server Actions) |
| Language | **TypeScript 5.9** (strict) |
| UI runtime | **React 19.1** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`) + **shadcn/ui** (new-york) |
| Primitives | Radix UI, `lucide-react` icons, `cmdk` (command palette) |
| Forms | **react-hook-form** + **@hookform/resolvers** + **Zod** |
| Toasts | **sonner** |
| Theming | **next-themes** |
| Dates | **date-fns** + **date-fns-tz**, plus custom `DateOnly` helpers |
| Charts | **recharts** (see `src/components/charts/`), themed via CSS `--chart-*` variables |
| Auth | **NextAuth v5 (Auth.js)** — Credentials provider, JWT sessions, Prisma adapter |
| Passwords | **bcryptjs** (cost 12) |
| ORM | **Prisma 6.19** on **PostgreSQL** |
| Validation | **Zod** |
| Tests | **Vitest** (unit + integration projects), **Playwright** (e2e) |
| Tooling | ESLint (flat config), Prettier + tailwind plugin, `tsx` |

Node engine: **`>=22.19.0`** (see `.nvmrc`).

---

## 3. Getting started

### Prerequisites

- Node.js **22.19.0+**
- PostgreSQL running locally (or a connection string to a Postgres instance)

### Setup

```bash
# 1. Use the right Node version
nvm use            # reads .nvmrc

# 2. Install dependencies (postinstall runs `prisma generate`)
npm install

# 3. Configure environment
cp .env.example .env
#   then edit .env with your DATABASE_URL and AUTH_SECRET

# 4. Apply migrations
npm run db:migrate

# 5. (optional) seed data
npm run db:seed

# 6. Run the dev server
npm run dev        # http://localhost:3000
```

### Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier write / check |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:migrate` | Create + apply a dev migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:push` | Push schema without a migration |
| `npm run db:reset` | Reset the database |
| `npm run db:seed` | Run the seed script |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test` / `test:unit` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Playwright |

---

## 4. Project structure

```
life-os/
├── prisma/
│   ├── schema.prisma            # data model (Postgres)
│   ├── migrations/              # SQL migrations
│   └── seed.ts                  # seed script (referenced by package.json)
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/              # sign-in, sign-up (marketing split layout)
│   │   ├── (dashboard)/         # authenticated app shell routes
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── onboarding/          # first-run setup
│   │   ├── error|loading|not-found/
│   │   ├── layout.tsx           # root layout (ThemeProvider, Toaster)
│   │   └── page.tsx             # public landing page
│   ├── components/
│   │   ├── app-shell/           # sidebar, header, command palette, user menu
│   │   ├── charts/              # shared recharts wrappers (trend, distribution)
│   │   └── ui/                  # shadcn/ui components
│   ├── features/                # feature-sliced modules (see §6)
│   │   ├── analytics/ auth/ calendar/ dashboard/ goals/ habits/
│   │   ├── journal/ life-areas/ notes/ onboarding/ projects/
│   │   └── rewards/ settings/ tasks/ timetable/
│   ├── lib/                     # pure domain + infrastructure (see §7)
│   ├── types/                   # ambient types (next-auth.d.ts)
│   └── middleware.ts            # edge auth gate (redirects only)
└── tests/
    ├── unit/                    # Vitest unit tests
    ├── integration/             # Vitest integration tests
    └── setup/integration.ts
```

### Path aliases

- `@/*` → `./src/*` (defined in `tsconfig.json` and mirrored in `vitest.config.ts`).

---

## 5. Architecture

### Request flow

```
Browser → middleware.ts (edge, redirect-only)
        → (dashboard)/layout.tsx  → requireUser() → onboarding check
        → page.tsx (RSC)          → feature queries.ts → Prisma → Postgres
        → Client components       → server actions (actions.ts) → revalidatePath
```

### Layering rules

1. **Pages (`app/**/page.tsx`)** are React Server Components. They authenticate with
   `requireUser()` / `requireOnboardedUser()`, call feature `queries.ts`, and pass plain
   data into a client view component.
2. **Queries (`features/*/queries.ts`)** are `server-only` data readers. They scope every
   query by `userId` and return plain serializable DTOs.
3. **Actions (`features/*/actions.ts`)** are `"use server"` mutation endpoints. They
   validate with Zod, enforce ownership, write via Prisma, and call `revalidatePath`.
4. **Schemas (`features/*/schemas.ts`)** hold Zod schemas + inferred input types, shared
   by both client forms and server actions.
5. **Components (`features/*/components/`)** are client components (`"use client"`) that
   render the UI, own local state (dialogs, tabs, optimistic transitions), and call
   actions.

### Result pattern

Server actions never throw expected failures to the client. They return a discriminated
union from `src/lib/action-result.ts`:

```ts
type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };
```

Helpers: `ok(data)`, `fail(message, fieldErrors?)`, `zodFieldErrors(zodError)`. Client
forms surface `error` via a toast and map `fieldErrors` onto react-hook-form fields.

---

## 6. Feature module anatomy

Every feature follows the same shape. Using `tasks` as the example:

```
src/features/tasks/
├── actions.ts        # "use server" mutations
├── queries.ts        # "server-only" reads (DTOs)
├── schemas.ts        # Zod input schemas + types
├── types.ts          # shared view-model types (optional)
└── components/       # "use client" UI
    ├── tasks-view.tsx
    ├── task-form-dialog.tsx
    ├── task-item-row.tsx
    └── recurrence-editor.tsx
```

### Feature reference

| Feature | Key capabilities | Notable logic |
|---------|------------------|---------------|
| **tasks** | CRUD, subtasks, tags, recurrence, series ops (skip/exclude/move/shift), 5 views | Occurrence materialization into `TaskOccurrence`; see §12 |
| **projects** | CRUD, archive/restore, milestones, progress bar | `progress = round(done/total * 100)` from linked tasks only |
| **goals** | CRUD, milestones, linked tasks, numeric values, sub-goals | `computeGoalProgress` (see §7) |
| **habits** | CRUD, check-ins, streaks, 30-day rate, 14-day heatmap | `computeStreaks` / `completionRate` (see §7) |
| **timetable** | Weekly Mon–Sun grid; blocks carry `days: number[]`; link to task & life area | Direct day-carrying model; overlap column-packing (see below) |
| **calendar** | Month/week/day/agenda; events + task chips; recurrence | Unified aggregation of events, tasks, occurrences |
| **notes** | CRUD, pin, archive, search, tags, life area, project | Markdown/plain body; server + client search |
| **journal** | One entry per day, mood, gratitude, tags, private flag | Date-keyed upsert |
| **life-areas** | CRUD, archive, reorder, colour + icon | `@@unique([userId, name])`; delete → `SetNull` |
| **settings** | Profile, preferences, schedule, notifications | Feeds reward rules + schedule config |
| **rewards** | Ledger + balance; points rules | Idempotent, append-only ledger (see §11) |
| **analytics** | Cross-module reporting page + charts | `queries.ts` builds plain day-bucketed series; `lib/analytics/series.ts` normalises them |
| **onboarding** | First-run form; provisions defaults | `provisionUser` idempotent seed |
| **auth** | Credentials sign-up/in | bcrypt; JWT sessions |

### Timetable: direct day-carrying model

The timetable was deliberately rewritten so a **single `TimetableBlock` stores the exact
list of weekdays it repeats on**:

```prisma
model TimetableBlock {
  startMinutes Int                      // minutes from midnight
  endMinutes   Int
  days         Int[] @default([])       // 0=Sun..6=Sat
  taskId       String?
  lifeAreaId   String?
  // ...
}
```

- Constants live in `features/timetable/schemas.ts`: `WEEKDAY_DAYS = [1,2,3,4,5]`,
  `WEEKEND_DAYS = [0,6]`, `ALL_DAYS = [1,2,3,4,5,6,0]` (Monday-first display order).
- The view buckets blocks per day (`blocksByDay`), then computes an **overlap
  column-packing** layout per day (`layoutDay`): overlapping blocks are placed in
  side-by-side columns within a cluster.
- The vertical range auto-expands to fit blocks, floored/ceiled to the hour, but never
  narrower than the user's configured `dayStartMinutes`/`dayEndMinutes`.

> **Migration note:** migration `20261015120000_rewrite_timetable_blocks` dropped the old
> `TimetableTemplate` and `WeekdayTemplate` tables. Existing blocks were preserved and
> assigned `days = {1,2,3,4,5}` (Mon–Fri).

---

## 7. Domain core libraries

All in `src/lib/`; pure functions, no I/O, heavily unit-tested.

| Module | Responsibility | Key exports |
|--------|----------------|-------------|
| `dates/index.ts` | `DateOnly` type + UTC-safe arithmetic + timezone helpers | `dateOnlyToUtc`, `addDays/addMonths/addYears`, `parseTimeToMinutes`, `formatMinutes`, `todayDateOnly`, `zonedDateTimeToUtc`, `weekdayOf`, `startOfWeek`, `setPosOfDate` |
| `recurrence/index.ts` | Structured occurrence generation (no RRULE strings) | `getOccurrences`, `getNextOccurrence`, `countOccurrences`, `validateRecurrence`, `formatRecurrence` |
| `recurrence/mapping.ts` | Prisma row → domain definition | `ruleToDefinition` |
| `working-days.ts` | Working-day rules (Saturday presets, holidays) | `isWorkingDay`, `effectiveWorkingWeekdays`, `workingDayCountForMonth`, `nthSaturdayOfMonth` |
| `rewards/rules.ts` | Point calculations + idempotency keys | `pointsForTask`, `buildTaskCompletionAward`, `taskRewardKey`, `reversalKey` |
| `goals/progress.ts` | Goal progress calculator | `computeGoalProgress` |
| `habits/index.ts` | Habit scheduling, streaks, rates | `isScheduledOn`, `computeStreaks`, `completionRate` |
| `analytics/series.ts` | Chart series normalisation + mood scoring | `zeroFillDays`, `moodScore`, `MOOD_SCORES` |
| `life-areas/defaults.ts` | Seeded starter life areas | `DEFAULT_LIFE_AREAS` |
| `action-result.ts` | Server action result contract | `ok`, `fail`, `zodFieldErrors` |
| `db.ts` | Prisma singleton | `db` |
| `env.ts` | Server env validation | `getServerEnv`, `ServerEnv` |
| `utils.ts` | Generic helpers | `cn`, `clamp`, `percentage`, `initials`, `groupBy`, `sum`, `slugify` |
| `icons.tsx` | Icon registry | lucide icon map |

### Goal progress precedence (`computeGoalProgress`)

1. Status `COMPLETED` → **100** (`method: completed`); `ARCHIVED` → 0.
2. `TASK_BASED` with ≥1 linked task → done/total (unique link constraint prevents
   double counting).
3. `NUMERIC` / `MANUAL` / `HABIT_BASED` with `targetValue > 0` → clamped value ratio.
4. Else milestones → completed/total.
5. Else sub-goals → average of child goal progress (recursive).
6. Else → 0.

### Habit streaks (`computeStreaks`)

- **Periods:** a day for `DAILY`/`CUSTOM`, a week for `WEEKLY`. A period completes when
  summed value ≥ `targetPerPeriod`.
- **Grace window:** the in-progress current day/week is skipped rather than breaking the
  streak if not yet complete.
- `completionRate` excludes the in-progress period from the denominator (so today doesn't
  drag the rate down).

---

## 8. Date, time & timezone conventions

This is the most important convention to internalize.

### Two distinct concepts

| Concept | Meaning | Storage | Used for |
|---------|---------|---------|----------|
| **DateOnly** | A calendar date, no time/zone (`"YYYY-MM-DD"`) | Postgres `@db.Date` | Deadlines, check-ins, occurrence dates, target dates |
| **Instant** | A real point in time | Postgres `@db.Timestamptz(3)` (UTC) | Events, reminders, audit timestamps |

### Rules

- **DateOnly arithmetic is always UTC-based** (`Date.UTC`, `getUTC*`) to avoid DST
  drift. Round-trips are exact: `dateOnlyToDb("2026-03-08")` →
  `"2026-03-08T00:00:00.000Z"` → `dbDateToDateOnly` → `"2026-03-08"`.
- **Month/year arithmetic clamps** (Jan 31 + 1 month → Feb 28/29).
- **"Which day is it?" is answered in the user's timezone** with `date-fns-tz`:
  - `todayDateOnly(tz)` — today's DateOnly in the user's zone.
  - `localDateOnly(instant, tz)` — the calendar date of an instant.
  - `zonedDateTimeToUtc(date, minutesFromMidnight, tz)` — local wall time → UTC.
- **Weekday numbering:** `0 = Sunday … 6 = Saturday`. The user's `weekStartsOn`
  preference (default 1 = Monday) governs week boundaries.

### Time storage summary

| Data | Stored as |
|------|-----------|
| Timetable block times | integer `startMinutes`/`endMinutes` (from midnight) |
| Calendar events | UTC `startsAt`/`endsAt` |
| Task start/end | integer minutes |
| Task do/due dates, habit check-in dates, goal target dates | `@db.Date` |

---

## 9. Data model

PostgreSQL via Prisma. All user-owned rows carry `userId`; cascading deletes from `User`.
Schema: `prisma/schema.prisma`.

### Entity relationship overview

```
User 1─1 UserPreferences
User 1─1 ScheduleSettings
User 1─* LifeArea ──┬─* Task
                    ├─* Goal
                    ├─* Habit
                    ├─* Note
                    ├─* Project
                    ├─* CalendarEvent
                    └─* TimetableBlock

User 1─* Tag (shared by Task, Note, JournalEntry via join tables)

Task ─* TaskOccurrence        (recurring series → materialized occurrences)
Task ─* TaskCompletion        (completion history)
Task 1─? RecurrenceRule
Task 1─* Task (subtasks, self-relation)
Task *─* Goal                 (via GoalTask, @@unique([goalId, taskId]))
Task 1─? Habit                (linkedTaskId)

Project 1─* ProjectMilestone
Project *─1 LifeArea
Project 1─* Goal

Goal 1─* GoalMilestone
Goal 1─? Goal (parent/sub-goal hierarchy)
Goal *─? Project, LifeArea

Habit 1─* HabitCheckIn        (@@unique([habitId, date]))

CalendarEvent 1─? RecurrenceRule
CalendarEvent 1─* Reminder
Reminder *─? Task | Event | Goal

User 1─* RewardTransaction    (append-only ledger)
User 1─* Notification
```

### Core models

| Model | Notes |
|-------|-------|
| `User` | identity, `timezone`, `onboardedAt`, `passwordHash`; root of all relations |
| `UserPreferences` | theme, week start, time format, default task view, reward rules, notifications |
| `ScheduleSettings` | Saturday rule, working days, day start/end minutes, holidays, exceptional workdays |
| `LifeArea` | `@@unique([userId, name])`, colour, icon, order, archived |
| `Tag` | `@@unique([userId, name])`, shared across tasks/notes/journal |
| `Task` | status, priority, do/due dates, minutes, recurrence, project, life area, subtasks |
| `TaskOccurrence` | `@@unique([taskId, scheduledFor])`; status, skipped, `movedTo` |
| `TaskCompletion` | completion history with `actualMinutes` |
| `RecurrenceRule` | frequency, interval, byWeekday[], byMonthDay, bySetPos, byMonth, count, exclusions (JSON) |
| `Project` / `ProjectMilestone` | status, priority, progress via tasks |
| `Goal` / `GoalMilestone` / `GoalTask` | metric type, hierarchy, linked tasks |
| `Habit` / `HabitCheckIn` | frequency, target, weekdays, `@@unique([habitId, date])` |
| `Note` | pinned, archived, format (Markdown/Plain), life area, project, tags |
| `JournalEntry` | one per day, mood, gratitude, `isPrivate` |
| `TimetableBlock` | `startMinutes`/`endMinutes`, `days Int[]`, task/life-area links |
| `CalendarEvent` | `startsAt`/`endsAt` (UTC), all-day, recurrence, series |
| `Reminder` / `Notification` | entity type, channel, trigger/sent/dismissed |
| `RewardTransaction` | points (±), reason, **`idempotencyKey @unique`**, createdAt |

### Enums

`TaskStatus`, `TaskPriority`, `OccurrenceStatus`, `RecurrenceFrequency`, `SaturdayRule`,
`ProjectStatus`, `GoalTimeframe`, `GoalStatus`, `GoalMetricType`, `HabitFrequency`,
`NoteFormat`, `JournalMood`, `ReminderEntityType`, `ReminderChannel`, `NotificationType`,
`RewardReason`.

> **RLS-style safety:** ownership is enforced in code, not in the database. Always scope
> reads/writes with `userId` (use `findFirst`/`updateMany`/`deleteMany` with
> `{ id, userId }`).

---

## 10. Authentication & authorization

### Stack

NextAuth v5 (Auth.js) with a **Credentials** provider, **JWT** session strategy, and the
**Prisma adapter** (adapter models present for future OAuth providers).

### Two configs

- `src/lib/auth/config.ts` — **edge-safe** (`authConfig`): no Prisma/bcrypt imports;
  used by `middleware.ts`. Contains the `authorized` callback (redirect-only).
- `src/lib/auth/auth.ts` — **Node runtime**: wires the Prisma adapter, Credentials
  provider, bcrypt verification, and JWT/session callbacks that expose `session.user.id`.

### Authorization boundary

- `src/lib/auth/current-user.ts` (React `cache`d):
  - `getSessionUser()` — resolves the JWT `sub` to a DB user with preferences + schedule.
  - `requireUser()` — redirects to `/sign-in` if unauthenticated.
  - `requireOnboardedUser()` — additionally redirects to `/onboarding` if not onboarded.
- **Every** action uses `requireOnboardedUser()`; **every** page uses `requireUser()`.
- `middleware.ts` is a **convenience gate only** — it redirects, but is explicitly *not*
  the security boundary. Server actions and pages re-check.

### Registration flow

1. `/sign-up` → `registerUser` (rejects duplicates, bcrypt-hashes cost 12, creates user).
2. `provisionUser(userId)` seeds preferences, schedule settings, and default life areas.
3. Auto sign-in → redirect to `/onboarding`.

---

## 11. Rewards engine

An **append-only, idempotent ledger** (`RewardTransaction`), configured per user via
`UserPreferences`.

### Keys & idempotency

| Action | Key |
|--------|-----|
| Task completion | `task:completed:<taskId>` |
| Occurrence completion | `occurrence:completed:<occurrenceId>` |
| Habit check-in | `habit:<habitId>:<yyyy-mm-dd>` |
| Goal milestone | `milestone:<milestoneId>` |
| Perfect day | `perfectday:<date>` |
| Reversal | `reversal:<originalKey>` |

- `awardOnce` uses `createMany({ skipDuplicates: true })` against the unique key →
  at-most-once even under concurrency.
- `reverseAward` writes a compensating negative row (never mutates the original) and is
  itself idempotent.
- Awards worth 0 return `null` (no empty ledger rows).

### Point rules (defaults)

`pointsPerTask = 10`, high-priority bonus enabled (`+5`), `pointsPerHabit = 5`,
`pointsPerMilestone = 25`, `perfectDayBonus = 20` (disabled by default).

### Perfect day

On completing a simple task, `maybeAwardPerfectDay` checks that no pending tasks or
occurrences remain for that day (and ≥1 completed) and awards a once-per-date bonus.

---

## 12. Recurrence engine

**Not** RRULE strings. A structured `RecurrenceDefinition`:

```ts
type RecurrenceDefinition = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byWeekday?: number[];             // 0..6
  byMonthDay?: number;              // 1..31
  bySetPos?: -1 | 1 | 2 | 3 | 4;    // nth weekday (-1 = last)
  byWeekdayForSetPos?: number;
  byMonth?: number;                 // 1..12
  startDate: DateOnly;
  endDate?: DateOnly;
  count?: number;
  exclusions?: DateOnly[];
};
```

### Semantics

- **COUNT limits scheduled occurrences *before* exclusions** (RFC 5545-like).
- **Invalid dates are skipped, never clamped** (a "31st" rule doesn't fire in February).
- Occurrences are generated **on demand within a bounded window** (safety cap 20,000;
  default query limit 5,000; `getNextOccurrence` horizon +5 years).
- WEEKLY groups are anchored to Monday so intervals are stable.

### Materialization into the database

- `ensureOccurrencesForRange(userId, from, to)` expands each recurring task's rule and
  `createMany(..., skipDuplicates)` into `TaskOccurrence` (idempotent via
  `@@unique([taskId, scheduledFor])`).
- It runs before every task/calendar list read and on create/update. Windows vary by
  task view (Today = day; Upcoming +1…+120; Overdue −365…−1; etc.).
- The rule is stored separately from occurrences, so editing a series updates the shared
  rule while leaving historical occurrences intact.

### Series operations

`moveOccurrence` (sets `movedTo`), `shiftSeries` (moves future PENDING occurrences),
`excludeOccurrence` (appends to the rule's `exclusions` and deletes the row),
`toggleOccurrenceSkip`.

---

## 13. UI & state conventions

- **shadcn/ui** components live in `src/components/ui/` (new-york style). Add primitives
  there rather than ad-hoc markup. `components.json` defines aliases.
- **Forms:** react-hook-form + `zodResolver` + the shared `Form` primitives. Field-level
  server errors are mapped via `form.setError`.
- **Toasts:** `sonner` (`toast.success` / `toast.error`); the `Toaster` is mounted in the
  root layout.
- **Theming:** `next-themes` `ThemeProvider` in the root layout; `theme-toggle.tsx`
  guards mount to avoid hydration mismatch.
- **Server mutations from client components:** wrap in `useTransition` and call actions
  directly. Dialogs are controlled by local `useState` in the view component.
- **Data contract:** RSC pages pass **plain, serializable DTOs** into client views —
  never Prisma model instances.
- **Empty & loading states:** each view provides an empty state; route-level
  `loading.tsx`, `error.tsx`, and `not-found.tsx` exist under `src/app/`.
- **Charts:** recharts wrappers live in `src/components/charts/` (`TrendChart`,
  `DistributionChart`) and are always client components. Colors are passed as theme
  variables (e.g. `var(--chart-1)`), and the server is responsible for assembling the
  series — client components only receive plain `{ date, value }[]` arrays. Series that
  span a fixed range are padded with `zeroFillDays` so quiet days render as 0.

---

## 14. Navigation & app shell

- `(dashboard)/layout.tsx` calls `requireUser()`, redirects to `/onboarding` when
  `!onboardedAt`, then mounts `AppShell`.
- **`AppShell`**: desktop collapsible sidebar (persisted in `localStorage` under
  `lifeos.sidebar.collapsed`), mobile `Sheet` drawer, sticky header, content `main`.
- **Navigation groups** (`components/app-shell/nav-config.ts`):
  - **Overview** — `/dashboard`, `/today`, `/calendar`, `/analytics`
  - **Plan** — `/timetable`, `/tasks`, `/projects`, `/goals`, `/habits`
  - **Reflect** — `/notes`, `/journal`, `/rewards`
  - **Settings** — `/settings/profile`, `/settings/life-areas`,
    `/settings/preferences`, `/settings/schedule`, `/settings/notifications`
- **Command palette** — `⌘K`/`Ctrl+K`; lists nav groups + a theme group; selections
  `router.push`. (No custom actions are passed today.)
- **User menu** — profile, preferences, sign out.

### Route inventory

| Route | Type |
|-------|------|
| `/` | Public landing |
| `/sign-in`, `/sign-up` | Auth |
| `/onboarding` | First-run setup |
| `/dashboard`, `/today`, `/calendar`, `/analytics` | Overview |
| `/timetable`, `/tasks`, `/projects`, `/goals`, `/habits` | Plan |
| `/notes`, `/journal`, `/rewards` | Reflect |
| `/settings/(profile\|life-areas\|preferences\|schedule\|notifications)` | Settings |

---

## 15. Cross-feature revalidation map

Server actions call `revalidatePath` to keep related views fresh:

| Action source | Revalidates |
|---------------|-------------|
| Tasks | `/tasks`, `/today`, `/dashboard`, `/calendar`, `/goals`, `/rewards` |
| Habits | `/habits`, `/dashboard`, `/today`, `/rewards` |
| Goals | `/goals`, `/dashboard`, `/tasks`, `/rewards` |
| Calendar | `/calendar`, `/today` |
| Timetable | `/timetable` |
| Notes | `/notes` |
| Journal | `/journal` |
| Life areas | `/settings/life-areas`, `/dashboard`, `/tasks`, `/goals`, `/habits` |
| Settings (prefs/schedule) | `/dashboard`, `/timetable`, `/today` |

---

## 16. Environment & configuration

Validated by `src/lib/env.ts` (server-only Zod schema).

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | NextAuth session/JWT secret |
| `AUTH_URL` | ➖ | Base URL (e.g. `http://localhost:3000`) |
| `AUTH_TRUST_HOST` | ➖ | Trust host header |
| `NODE_ENV` | ➖ | `development` / `production` / `test` |

See `.env.example` for the full template (includes `TEST_DATABASE_URL` used by
integration tests).

---

## 17. Database & migrations

- **Provider:** PostgreSQL. **Client:** Prisma (`prisma generate`).
- **Migrations** live in `prisma/migrations/`:
  - `20261014064431_init` — full initial schema.
  - `20261015120000_rewrite_timetable_blocks` — dropped `TimetableTemplate` /
    `WeekdayTemplate`; added `TimetableBlock.days Int[]`; preserved existing blocks on
    Mon–Fri.
- **Conventions:**
  - Date-only fields → `@db.Date`; instants → `@db.Timestamptz(3)`.
  - Derived values are computed on read, not stored.
  - Cascading deletes flow from `User`.
- **Workflow:**
  - Dev: `npm run db:migrate` (interactive; needs a TTY).
  - CI/prod: `npm run db:deploy`.
  - Non-interactive environments can author a `migration.sql` manually and run
    `prisma migrate deploy`.
  - Reset: `npm run db:reset`; inspect: `npm run db:studio`.

> `prisma/seed.ts` is referenced by `package.json`; confirm it exists before running
> `db:seed` (it may be pending implementation).

---

## 18. Testing

Vitest with two projects (`vitest.config.ts`):

- **unit** — `tests/unit/**/*.test.ts` (node env).
- **integration** — `tests/integration/**/*.test.ts`, `pool: forks`, `singleFork: true`,
  30s timeout, setup `tests/setup/integration.ts`.

Playwright is configured for e2e (`npm run test:e2e`).

### Unit test coverage

| File | Focus |
|------|-------|
| `dates.test.ts` | DateOnly round-trips, DST/leap/year arithmetic, weekday helpers, time parsing, timezone conversions |
| `recurrence.test.ts` | DAILY/WEEKLY/MONTHLY/YEARLY, skip-vs-clamp, nth/last weekday, count, next occurrence, validation, formatting |
| `working-days.test.ts` | Saturday rules, holiday/exceptional precedence, ranges, monthly counts |
| `rewards.test.ts` | Point calculations, idempotency keys, award builders |
| `goals.test.ts` | `computeGoalProgress` for every method + no double counting |
| `habits.test.ts` | Scheduling, daily/weekly streaks with grace, completion rate |

---

## 19. Build, lint & deploy

- **Build:** `npm run build` → `prisma generate && next build`.
- **Lint:** `npm run lint` (ESLint flat config; ignores `node_modules`, `.next`, etc.).
  `eslint.ignoreDuringBuilds` is set in `next.config.ts`, so run lint explicitly in CI.
- **Typecheck:** `npm run typecheck`.
- **Format:** `npm run format` / `format:check`.
- **`next.config.ts`:** `reactStrictMode`, `poweredByHeader: false`,
  `serverActions.bodySizeLimit: "1mb"`.
- **Deployment (Vercel):** `vercel.json` sets the build command, framework, Node version,
  and environment mappings. Provide `DATABASE_URL` and `AUTH_SECRET` (and `AUTH_URL`) in
  the project's environment variables. Run `db:deploy` against the production database.

---

## 20. Conventions & guidelines

### Adding a new feature

1. Create `src/features/<name>/{actions,queries,schemas}.ts` and `components/`.
2. `queries.ts`: start with `import "server-only"`, scope by `userId`, return DTOs.
3. `actions.ts`: start with `"use server"`; validate with Zod; use
   `requireOnboardedUser()`; return `ActionResult`; `revalidatePath` affected routes.
4. Add the route under `src/app/(dashboard)/<name>/page.tsx` (RSC → client view).
5. Add a `NavItem` to `components/app-shell/nav-config.ts` if user-facing.
6. Add unit tests for any pure domain logic in `src/lib/`.

### Data access

- Always pass `userId` from the authenticated server context; never trust a client-sent
  `userId`.
- Prefer `findFirst({ where: { id, userId } })` and `updateMany`/`deleteMany` with
  `{ id, userId }` over `findUnique`/`update` by id alone.
- Validate that any referenced foreign id (life area, project, task, tag) belongs to the
  user before linking.

### Dates & time

- Represent calendar dates as `DateOnly` strings; use `src/lib/dates` helpers.
- Never do date math with local `Date` getters; use the UTC-based helpers.
- Convert instants to the user's timezone only at the display boundary.

### Code style

- TypeScript strict; avoid `any`; prefer discriminated unions for results.
- Zod schemas are the single source of truth for input shapes (infer types from them).
- No comments unless they explain non-obvious intent.
- Run `npm run lint`, `npm run typecheck`, and `npm run test:unit` before committing.

---

## 21. Known gaps & roadmap

Current known gaps / incomplete areas:

- **`/analytics`** reports 30-day trends for tasks, habits, points, mood and goals.
  Broader reporting (configurable ranges, per-life-area breakdowns, exports) is not
  implemented yet.
- **No integration or e2e test files** exist yet (configs are ready).
- **`prisma/seed.ts`** is referenced by `package.json` but may not be implemented.
- **Reminders & notifications** models and settings exist, but there is no scheduler/job
  to actually dispatch them; the header notification bell is non-functional.
- **`GoalMetricType.HABIT_BASED`** is reserved — it currently behaves like `NUMERIC`; no
  habit↔goal link is implemented.
- **`RewardReason.MANUAL_ADJUSTMENT`** is defined but no action emits it.
- **`UserPreferences.dashboardWidgets`** exists in the schema but is unused (fixed
  dashboard layout).
- **OAuth providers** are not configured (adapter models are present for the future).
- **`ScheduleSettings`** is only consumed by timetable day bounds and the schedule
  preview; broader working-day integration is partial.
- **README.md** is still the default Next.js template.

### Suggested next steps

1. Extend analytics with configurable date ranges and per-life-area breakdowns.
2. Add integration tests (real Postgres via `TEST_DATABASE_URL`) for the recurrence
   materialization and rewards idempotency paths.
3. Build a reminder dispatch mechanism (cron/edge job) and wire notifications.
4. Implement `HABIT_BASED` goal progress and the habit↔goal link.
5. Write a real `prisma/seed.ts` and a production README.
