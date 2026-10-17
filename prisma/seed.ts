/**
 * Life OS — demo data seeder.
 *
 * Creates a single, self-contained demo account with two years of realistic
 * history across tasks, calendar events, timetable, projects, goals, habits,
 * notes and journal entries — plus the matching reward-ledger rows so the
 * Rewards/Analytics pages add up.
 *
 * Design notes
 * ------------
 * - **Idempotent by reset.** The demo user is looked up by email and deleted
 *   (cascade removes every child row) before being recreated. Running the seed
 *   twice therefore yields exactly one demo account and never touches other
 *   users. It is safe to run against a shared development database.
 * - **Deterministic shape.** All randomness flows through a seeded PRNG, so the
 *   same run date produces the same dataset. Dates are anchored to *today* in
 *   the account's timezone, so the demo always looks "current".
 * - **Faithful to the app.** Recurring tasks get a series template + recurrence
 *   rule + materialised occurrences; completions write both a `TaskCompletion`
 *   and an idempotency-keyed `RewardTransaction`; recurring events stay as a
 *   single rule row (the calendar expands them on read). Points come from the
 *   same pure rule builders the server actions use.
 * - **Pure-module reuse only.** The script imports `@/lib/*` domain modules
 *   (none of which import `server-only`), so it runs under plain `tsx` without
 *   the `react-server` export condition.
 *
 * Usage:
 *   npm run db:seed                      # or `prisma db seed`
 *   DEMO_EMAIL=me@x.dev npm run db:seed  # override the account
 *
 * Credentials are printed at the end.
 */
// Must be imported before `@prisma/client` so env is resolved like `next dev`
// (see `seed-env.ts`). Keep this the very first import.
import "./seed-env";

import { randomUUID } from "node:crypto";

import { PrismaClient, type Prisma } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import {
  type DateOnly,
  addDays,
  addWeeks,
  addYears,
  compareDateOnly,
  dateOnlyToDb,
  dbDateToDateOnly,
  eachDay,
  formatInstant,
  parseTimeToMinutes,
  startOfMonth,
  todayDateOnly,
  weekdayOf,
  zonedDateTimeToUtc,
} from "@/lib/dates";
import { type HabitDefinition, isScheduledOn } from "@/lib/habits";
import { DEFAULT_LIFE_AREAS } from "@/lib/life-areas/defaults";
import {
  type RecurrenceDefinition,
  type RecurrenceFrequency,
  getOccurrences,
  nthWeekdayOfMonth,
} from "@/lib/recurrence";
import {
  DEFAULT_POINT_RULES,
  type PointRules,
  type TaskPriority,
  buildHabitAward,
  buildMilestoneAward,
  buildTaskCompletionAward,
} from "@/lib/rewards/rules";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@lifeos.dev";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";
const DEMO_NAME = process.env.DEMO_NAME ?? "Avery Demo";
const TIMEZONE = process.env.DEMO_TIMEZONE ?? "America/New_York";
const SEED = Number(process.env.DEMO_SEED ?? 20260101);

// The ledger must use the same point rules the account is configured with.
const POINT_RULES: PointRules = { ...DEFAULT_POINT_RULES };

const NOW = new Date();
const TODAY = todayDateOnly(TIMEZONE, NOW);
/** Two years of history … */
const HISTORY_START = addYears(TODAY, -2);
/** … plus a little runway of upcoming work/events. */
const FUTURE_END = addDays(TODAY, 90);
/** Local wall-clock minute-of-day for "now", used to avoid future instants. */
const NOW_MINUTES = parseTimeToMinutes(formatInstant(NOW, TIMEZONE, "HH:mm")) ?? 20 * 60;

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32 — a tiny, fast, seedable PRNG. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);
const rand = (): number => rng();
const randInt = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
const chance = (probability: number): boolean => rand() < probability;
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)] as T;
}

const newId = (): string => randomUUID();

// ---------------------------------------------------------------------------
// Small date/time helpers
// ---------------------------------------------------------------------------

/** UTC instant for a local date + minute-of-day in the account timezone. */
function at(date: DateOnly, minutes: number): Date {
  return zonedDateTimeToUtc(date, minutes, TIMEZONE);
}

/** Like {@link at}, but clamped to "now" so seeds never place history in the future. */
function atOrBeforeNow(date: DateOnly, minutes: number): Date {
  const candidate = at(date, minutes);
  return candidate.getTime() > NOW.getTime() ? NOW : candidate;
}

/** A plausible completion time on `date` (business-ish hours of the local day). */
function completionTime(date: DateOnly): Date {
  return atOrBeforeNow(date, Math.min(randInt(7 * 60, 21 * 60), NOW_MINUTES));
}

/** An instant a few days before `date`, for `createdAt` backdating. */
function createdEarlier(date: DateOnly, daysBack = randInt(1, 10)): Date {
  return atOrBeforeNow(addDays(date, -daysBack), randInt(7 * 60, 10 * 60));
}

/** Monday-based start of week (the account uses `weekStartsOn = 1`). */
function startOfWeekMonday(value: DateOnly): DateOnly {
  return addDays(value, -((weekdayOf(value) + 6) % 7));
}

// ---------------------------------------------------------------------------
// Recurrence helpers (pure definitions, mirrored into RecurrenceRule rows)
// ---------------------------------------------------------------------------

interface RuleSpec {
  frequency: RecurrenceFrequency;
  startDate: DateOnly;
  interval?: number;
  byWeekday?: number[];
  byMonthDay?: number;
  byMonth?: number;
}

function toDefinition(spec: RuleSpec): RecurrenceDefinition {
  return {
    frequency: spec.frequency,
    interval: spec.interval ?? 1,
    byWeekday: spec.byWeekday ?? [],
    byMonthDay: spec.byMonthDay ?? null,
    bySetPos: null,
    byWeekdayForSetPos: null,
    byMonth: spec.byMonth ?? null,
    startDate: spec.startDate,
    endDate: null,
    count: null,
    exclusions: [],
  };
}

function toRuleRow(userId: string, spec: RuleSpec): Prisma.RecurrenceRuleCreateManyInput {
  return {
    id: newId(),
    userId,
    frequency: spec.frequency,
    interval: spec.interval ?? 1,
    byWeekday: spec.byWeekday ?? [],
    byMonthDay: spec.byMonthDay ?? null,
    bySetPos: null,
    byWeekdayForSetPos: null,
    byMonth: spec.byMonth ?? null,
    startDate: dateOnlyToDb(spec.startDate),
    endDate: null,
    count: null,
    timezone: TIMEZONE,
    exclusions: [],
  };
}

// ---------------------------------------------------------------------------
// Accumulators + bulk-insert helper
// ---------------------------------------------------------------------------

const completionRows: Prisma.TaskCompletionCreateManyInput[] = [];
const occurrenceRows: Prisma.TaskOccurrenceCreateManyInput[] = [];
const rewardRows: Prisma.RewardTransactionCreateManyInput[] = [];
const rewardKeys = new Set<string>();

/** Adds a reward row at most once per idempotency key (mirrors `awardOnce`). */
function pushReward(row: Prisma.RewardTransactionCreateManyInput): void {
  if (rewardKeys.has(row.idempotencyKey)) return;
  rewardKeys.add(row.idempotencyKey);
  rewardRows.push(row);
}

async function insert<T>(
  label: string,
  rows: T[],
  run: (batch: T[]) => Promise<unknown>,
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await run(rows.slice(i, i + size));
  }
  console.log(`  • ${label.padEnd(22)} ${String(rows.length).padStart(6)}`);
}

// ---------------------------------------------------------------------------
// Static content libraries
// ---------------------------------------------------------------------------

const TASK_LIBRARY: Record<string, string[]> = {
  Career: [
    "Draft Q{quarter} status report",
    "Prepare client presentation",
    "Review {name}'s pull request",
    "Write design doc for {topic}",
    "Interview candidate",
    "Update release notes",
    "Fix onboarding bug",
    "Plan sprint backlog",
    "Refactor {area} module",
    "Reply to {name} about contract",
  ],
  Health: [
    "Book dentist appointment",
    "Meal prep for the week",
    "Restock supplements",
    "Schedule blood test",
    "Buy new running shoes",
    "Stretch + mobility session",
    "Refill prescription",
    "Book physio session",
  ],
  Family: [
    "Plan weekend trip",
    "Call grandparents",
    "Buy birthday gift for {name}",
    "Family board game night",
    "Fix the leaking tap",
    "Sign school permission slip",
    "Movie night with the kids",
  ],
  Faith: [
    "Read scripture",
    "Prepare study notes",
    "Volunteer at the shelter",
    "Attend small group",
    "Write a reflection",
  ],
  Finance: [
    "Review credit card statement",
    "Move savings to index fund",
    "Cancel unused subscription",
    "Compare insurance quotes",
    "File expense report",
    "Pay electricity bill",
    "Rebalance the portfolio",
  ],
  Learning: [
    "Finish TypeScript chapter",
    "Practice SQL exercises",
    "Read 'Deep Work' chapter",
    "Watch a conference talk",
    "Build a flashcard deck",
    "Write a blog post",
    "Solve two algorithm puzzles",
  ],
  Personal: [
    "Declutter the closet",
    "Plan the week ahead",
    "Call {name}",
    "Renew passport",
    "Back up laptop",
    "Digital detox evening",
    "Sort the garage",
  ],
};

const PEOPLE = ["Mia", "Jordan", "Sam", "Priya", "Noah", "Alex", "Diego", "Yuki"];
const TOPICS = ["auth", "billing", "search", "onboarding", "notifications", "reporting"];
const AREAS = ["dashboard", "tasks", "calendar", "goals", "habits", "settings"];

const NOTE_LIBRARY: { title: string; area: string; body: string }[] = [
  {
    title: "Meeting notes — quarterly planning",
    area: "Career",
    body: "- Ship the redesign by mid-quarter\n- Hire one more engineer\n- Cut the two flaky integrations",
  },
  {
    title: "Deep work rules",
    area: "Career",
    body: "1. Phone in another room\n2. One task on the board\n3. 90-minute blocks, 20-minute breaks",
  },
  {
    title: "Marathon training plan",
    area: "Health",
    body: "Mon easy, Wed tempo, Fri intervals, Sun long run.\nBuild 10% per week, deload every 4th.",
  },
  {
    title: "Strength routine",
    area: "Health",
    body: "Squat, bench, row, hinge, press. 3x5, add 2.5kg when all sets are clean.",
  },
  {
    title: "Sleep experiment log",
    area: "Health",
    body: "No screens after 22:00 → falling asleep ~20 minutes faster.",
  },
  {
    title: "Spanish vocabulary",
    area: "Learning",
    body: "ser/estar, por/para, subjunctive triggers. Practice 15 minutes daily.",
  },
  {
    title: "Reading list",
    area: "Learning",
    body: "- Deep Work\n- Thinking in Systems\n- The Design of Everyday Things\n- Range",
  },
  {
    title: "Book notes — Deep Work",
    area: "Learning",
    body: "Shallow work is infinite; deep work is finite and valuable. Schedule it.",
  },
  {
    title: "Budget categories",
    area: "Finance",
    body: "Housing 35%, food 12%, transport 8%, savings 20%, fun 10%, other 15%.",
  },
  {
    title: "Emergency fund milestone",
    area: "Finance",
    body: "Target: 6 months of expenses. Currently at 4 months.",
  },
  {
    title: "Home renovation ideas",
    area: "Personal",
    body: "Kitchen: open shelving, matte handles, warm under-cabinet light.",
  },
  {
    title: "Trip packing checklist",
    area: "Personal",
    body: "Passport, adapters, meds, Kindle, running shoes, chargers.",
  },
  {
    title: "Gift ideas",
    area: "Family",
    body: "Mia: pottery class. Sam: coffee subscription. Mum: garden tools.",
  },
  {
    title: "Weekend meal plan",
    area: "Family",
    body: "Sat: roast chicken. Sun: leftovers + big salad. Bake bread Sunday morning.",
  },
  {
    title: "Reflection prompts",
    area: "Faith",
    body: "What am I grateful for? Where did I see grace today? Who can I serve?",
  },
  {
    title: "Volunteer schedule",
    area: "Faith",
    body: "Shelter: 1st and 3rd Saturday, 09:00–12:00.",
  },
  {
    title: "Website redesign brief",
    area: "Career",
    body: "Goal: 20% faster signup. Focus on clarity and a single primary action.",
  },
  {
    title: "Interview rubric",
    area: "Career",
    body: "Signals: ownership, debugging story, communication, curiosity.",
  },
  {
    title: "Life admin checklist",
    area: "Personal",
    body: "Insurance, passport, backups, subscriptions, warranties.",
  },
  {
    title: "Ideas parking lot",
    area: "Personal",
    body: "- Learn to swim\n- Teach a workshop\n- Write a short story\n- 30-day photo challenge",
  },
  {
    title: "Side project scratchpad",
    area: "Side Projects",
    body: "Life OS: habits heatmap, weekly review automation, offline notes.",
  },
];

const JOURNAL_TITLES = [
  "A quiet morning",
  "Long day, good progress",
  "A small win",
  "Reset and refocus",
  "Grateful for the little things",
  "Slow start",
  "Momentum building",
  "Rest and recover",
  "Something clicked today",
  "Keeping the streak",
];

const JOURNAL_BODIES = [
  "Woke up early and got a full deep-work block in before the meetings started. The difference it makes is enormous.",
  "Busy day, but I finished the thing I'd been avoiding for a week. It took less time than I feared.",
  "Felt scattered in the morning; the afternoon planning session pulled it back together.",
  "Long run today. Legs heavy but spirits high. The marathon still feels possible.",
  "Said no to a meeting I didn't need and read instead. No regrets.",
  "Cooked dinner for everyone and we actually sat down together. Should do that more.",
  "A bit low today. Wrote it out instead of pushing through, and that helped.",
  "Made real progress on the side project. Small steps, but they compound.",
  "Spent the evening away from screens. Read a chapter and went to bed early.",
  "Tired but content. The weekly review kept the week from running me over.",
];

const GRATITUDE = [
  "Warm coffee, a quiet house, and a plan for the day.",
  "Friends who check in without being asked.",
  "A body that can still run the long miles.",
  "Work that stretches me and people who help me grow.",
  "Rain on the roof and nowhere to be.",
  "Family, health, and enough.",
];

const JOURNAL_TAGS = ["reflection", "gratitude", "growth", "fitness", "family"];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/**
 * Returns the host of a Postgres connection string, or a short label when the
 * URL is missing/unparseable. Used only for the startup banner.
 */
function databaseHost(url: string | undefined): string {
  if (!url) return "(unset)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
}

/**
 * The seeder resets the demo account (delete + recreate), so it is deliberately
 * pinned to a **local** database — a stray run must never wipe data in a shared
 * or remote environment. Set `SEED_ALLOW_REMOTE=1` to override the guard.
 */
function assertLocalDatabase(url: string | undefined): void {
  if (process.env.SEED_ALLOW_REMOTE === "1") return;
  if (!url) {
    throw new Error("DATABASE_URL is not set — cannot seed.");
  }
  const host = databaseHost(url);
  const isLocal =
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "[::1]" ||
    host.startsWith("[::1]:");
  if (!isLocal) {
    throw new Error(
      `Refusing to seed non-local database "${host}". ` +
        "Seed the local database, or set SEED_ALLOW_REMOTE=1 to override.",
    );
  }
}

async function main(): Promise<void> {
  assertLocalDatabase(process.env.DATABASE_URL);

  console.log(`\nSeeding demo account "${DEMO_EMAIL}"`);
  console.log(`  database ${databaseHost(process.env.DATABASE_URL)}`);
  console.log(`  window  ${HISTORY_START} → ${FUTURE_END}   (tz ${TIMEZONE})\n`);

  // --- 1. Reset the previous demo account (cascade removes all children) ---
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  // --- 2. Account, preferences, schedule, life areas, tags ---
  const userId = newId();
  await prisma.user.create({
    data: {
      id: userId,
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      timezone: TIMEZONE,
      onboardedAt: NOW,
      emailVerified: NOW,
      createdAt: at(HISTORY_START, 8 * 60),
    },
  });

  await prisma.userPreferences.create({
    data: {
      userId,
      theme: "system",
      weekStartsOn: 1,
      timeFormat: "24h",
      defaultTaskView: "list",
      pointsPerTask: POINT_RULES.pointsPerTask,
      pointsPerHighPriority: POINT_RULES.pointsPerHighPriority,
      highPriorityBonus: POINT_RULES.highPriorityBonus,
      pointsPerHabit: POINT_RULES.pointsPerHabit,
      pointsPerMilestone: POINT_RULES.pointsPerMilestone,
      perfectDayBonus: POINT_RULES.perfectDayBonus,
      perfectDayEnabled: POINT_RULES.perfectDayEnabled,
      notifyInApp: true,
      dailyAgendaEnabled: true,
      dailyAgendaTime: "07:30",
      defaultReminderMinutes: 15,
    },
  });

  const yearSet = new Set([
    Number(HISTORY_START.slice(0, 4)),
    Number(TODAY.slice(0, 4)),
    Number(FUTURE_END.slice(0, 4)),
  ]);
  const holidays = [...yearSet].flatMap((year) => {
    const thanksgiving = nthWeekdayOfMonth(`${year}-11-01`, 4, 4) ?? `${year}-11-24`;
    return [
      { date: `${year}-01-01`, name: "New Year's Day" },
      { date: `${year}-07-04`, name: "Independence Day" },
      { date: thanksgiving, name: "Thanksgiving" },
      { date: `${year}-12-25`, name: "Christmas Day" },
    ];
  });

  await prisma.scheduleSettings.create({
    data: {
      userId,
      weekStartsOn: 1,
      timeFormat: "24h",
      saturdayRule: "ALTERNATE_OFF",
      workingDays: [1, 2, 3, 4, 5],
      alternateSaturdayWeeks: 2,
      alternateSaturdayAnchor: dateOnlyToDb(startOfMonth(HISTORY_START)),
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 18 * 60,
      holidays,
      exceptionalWorkdays: [{ date: addDays(TODAY, 21), name: "Team offsite" }],
    },
  });

  const lifeAreas = [
    ...DEFAULT_LIFE_AREAS,
    { name: "Side Projects", color: "#0ea5e9", icon: "sparkles" },
  ];
  const lifeAreaIds = new Map<string, string>();
  await prisma.lifeArea.createMany({
    data: lifeAreas.map((area, index) => {
      const id = newId();
      lifeAreaIds.set(area.name, id);
      return { id, userId, name: area.name, color: area.color, icon: area.icon, order: index };
    }),
  });
  const areaId = (name: string): string => lifeAreaIds.get(name) as string;

  const tagSpecs: { name: string; color: string }[] = [
    { name: "deep-work", color: "#6366f1" },
    { name: "meeting", color: "#f59e0b" },
    { name: "reading", color: "#ec4899" },
    { name: "fitness", color: "#10b981" },
    { name: "family", color: "#f97316" },
    { name: "finance", color: "#0ea5e9" },
    { name: "quick-win", color: "#64748b" },
    { name: "ideas", color: "#8b5cf6" },
    { name: "reflection", color: "#14b8a6" },
    { name: "gratitude", color: "#eab308" },
    { name: "growth", color: "#a855f7" },
  ];
  const tagIds = new Map<string, string>();
  await prisma.tag.createMany({
    data: tagSpecs.map((tag) => {
      const id = newId();
      tagIds.set(tag.name, id);
      return { id, userId, name: tag.name, color: tag.color };
    }),
  });
  const tagId = (name: string): string => tagIds.get(name) as string;

  // --- 3. Projects (+ milestones) ---
  interface ProjectSpec {
    name: string;
    area: string;
    status: Prisma.ProjectCreateInput["status"];
    priority: TaskPriority;
    start: DateOnly;
    target: DateOnly | null;
    description: string;
    milestones: { title: string; offsetDays: number; done: boolean }[];
  }

  const projectSpecs: ProjectSpec[] = [
    {
      name: "Website Redesign",
      area: "Career",
      status: "ACTIVE",
      priority: "HIGH",
      start: addDays(HISTORY_START, 210),
      target: addDays(TODAY, 45),
      description: "Rebuild the marketing site around a single, clear call to action.",
      milestones: [
        { title: "Wireframes approved", offsetDays: 20, done: true },
        { title: "Design system in place", offsetDays: 55, done: true },
        { title: "Homepage built", offsetDays: 90, done: false },
        { title: "Launch", offsetDays: 130, done: false },
      ],
    },
    {
      name: "Marathon Training",
      area: "Health",
      status: "ACTIVE",
      priority: "HIGH",
      start: addDays(HISTORY_START, 300),
      target: addDays(TODAY, 120),
      description: "Build to a comfortable autumn marathon.",
      milestones: [
        { title: "Run 10K", offsetDays: 60, done: true },
        { title: "Run a half marathon", offsetDays: 180, done: true },
        { title: "Full marathon race day", offsetDays: 330, done: false },
      ],
    },
    {
      name: "Emergency Fund",
      area: "Finance",
      status: "ACTIVE",
      priority: "MEDIUM",
      start: addDays(HISTORY_START, 120),
      target: addDays(TODAY, 200),
      description: "Six months of expenses set aside and untouched.",
      milestones: [
        { title: "First $1,000", offsetDays: 40, done: true },
        { title: "Three months saved", offsetDays: 260, done: true },
        { title: "Six months saved", offsetDays: 520, done: false },
      ],
    },
    {
      name: "Home Renovation",
      area: "Personal",
      status: "ON_HOLD",
      priority: "MEDIUM",
      start: addDays(HISTORY_START, 60),
      target: null,
      description: "Refresh the kitchen and finally sort the garage.",
      milestones: [
        { title: "Kitchen plan drawn", offsetDays: 30, done: true },
        { title: "Contractor quotes", offsetDays: 90, done: true },
        { title: "Permits filed", offsetDays: 150, done: false },
      ],
    },
    {
      name: "Learn Spanish",
      area: "Learning",
      status: "COMPLETED",
      priority: "MEDIUM",
      start: addDays(HISTORY_START, 20),
      target: addDays(HISTORY_START, 600),
      description: "Reach a solid conversational B1.",
      milestones: [
        { title: "Complete A1", offsetDays: 180, done: true },
        { title: "Complete A2", offsetDays: 360, done: true },
        { title: "Complete B1", offsetDays: 560, done: true },
      ],
    },
    {
      name: "Photo Book 2024",
      area: "Personal",
      status: "COMPLETED",
      priority: "LOW",
      start: addDays(HISTORY_START, 10),
      target: addDays(HISTORY_START, 120),
      description: "Turn the year's photos into a printed book.",
      milestones: [
        { title: "Select photos", offsetDays: 40, done: true },
        { title: "Order the print", offsetDays: 100, done: true },
      ],
    },
  ];

  const projectIds = new Map<string, string>();
  for (const spec of projectSpecs) {
    const id = newId();
    projectIds.set(spec.name, id);
    const startInstant = at(spec.start, 9 * 60);
    await prisma.project.create({
      data: {
        id,
        userId,
        name: spec.name,
        description: spec.description,
        status: spec.status,
        priority: spec.priority,
        startDate: dateOnlyToDb(spec.start),
        targetDate: spec.target ? dateOnlyToDb(spec.target) : null,
        lifeAreaId: areaId(spec.area),
        completedAt: spec.status === "COMPLETED" ? at(spec.target ?? spec.start, 16 * 60) : null,
        createdAt: startInstant,
        updatedAt: startInstant,
      },
    });
    await prisma.projectMilestone.createMany({
      data: spec.milestones.map((milestone, index) => {
        const dueDate = addDays(spec.start, milestone.offsetDays);
        return {
          id: newId(),
          userId,
          projectId: id,
          title: milestone.title,
          dueDate: dateOnlyToDb(dueDate),
          completedAt: milestone.done ? at(dueDate, 15 * 60) : null,
          order: index,
          createdAt: startInstant,
        };
      }),
    });
  }

  // --- 4. Goals (+ milestones with rewards, sub-goals) ---
  interface GoalSpec {
    key: string;
    title: string;
    area: string;
    timeframe: Prisma.GoalCreateInput["timeframe"];
    status: Prisma.GoalCreateInput["status"];
    priority: TaskPriority;
    metricType: Prisma.GoalCreateInput["metricType"];
    start: DateOnly;
    target: DateOnly | null;
    targetValue?: number;
    currentValue?: number;
    unit?: string;
    project?: string;
    parent?: string;
    description: string;
    milestones?: { title: string; offsetDays: number; done: boolean }[];
  }

  const thisYear = TODAY.slice(0, 4);
  const goalSpecs: GoalSpec[] = [
    {
      key: "ship-releases",
      title: "Ship 4 product releases",
      area: "Career",
      timeframe: "MONTHLY",
      status: "IN_PROGRESS",
      priority: "HIGH",
      metricType: "TASK_BASED",
      start: startOfMonth(TODAY),
      target: addDays(startOfMonth(TODAY), 30),
      project: "Website Redesign",
      description: "Four meaningful releases this month, not endless polishing.",
    },
    {
      key: "read-books",
      title: "Read 24 books",
      area: "Learning",
      timeframe: "YEARLY",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      metricType: "NUMERIC",
      start: `${thisYear}-01-01`,
      target: `${thisYear}-12-31`,
      targetValue: 24,
      currentValue: 17,
      unit: "books",
      description: "Roughly two a month, including a few deep ones.",
      milestones: [
        { title: "Read 6 books", offsetDays: 90, done: true },
        { title: "Read 12 books", offsetDays: 180, done: true },
        { title: "Read 18 books", offsetDays: 270, done: false },
        { title: "Read 24 books", offsetDays: 355, done: false },
      ],
    },
    {
      key: "run-1000km",
      title: "Run 1,000 km this year",
      area: "Health",
      timeframe: "YEARLY",
      status: "IN_PROGRESS",
      priority: "HIGH",
      metricType: "NUMERIC",
      start: `${thisYear}-01-01`,
      target: `${thisYear}-12-31`,
      targetValue: 1000,
      currentValue: 640,
      unit: "km",
      project: "Marathon Training",
      description: "Consistent weekly mileage, deloading every fourth week.",
      milestones: [
        { title: "Run 250 km", offsetDays: 90, done: true },
        { title: "Run 500 km", offsetDays: 180, done: true },
        { title: "Run 750 km", offsetDays: 270, done: false },
        { title: "Run 1,000 km", offsetDays: 355, done: false },
      ],
    },
    {
      key: "save-500",
      title: "Save $500 this month",
      area: "Finance",
      timeframe: "MONTHLY",
      status: "COMPLETED",
      priority: "MEDIUM",
      metricType: "NUMERIC",
      start: startOfMonth(TODAY),
      target: addDays(startOfMonth(TODAY), 30),
      targetValue: 500,
      currentValue: 500,
      unit: "USD",
      project: "Emergency Fund",
      description: "Automate the transfer on payday.",
    },
    {
      key: "deep-work",
      title: "20 hours of deep work weekly",
      area: "Career",
      timeframe: "WEEKLY",
      status: "IN_PROGRESS",
      priority: "HIGH",
      metricType: "NUMERIC",
      start: startOfWeekMonday(TODAY),
      target: addDays(startOfWeekMonday(TODAY), 6),
      targetValue: 20,
      currentValue: 12,
      unit: "hours",
      description: "Phone away, single thread, ninety-minute blocks.",
    },
    {
      key: "get-fit",
      title: "Get properly fit",
      area: "Health",
      timeframe: "YEARLY",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      metricType: "MANUAL",
      start: `${thisYear}-01-01`,
      target: `${thisYear}-12-31`,
      description: "A parent goal so the weekly and yearly numbers roll up.",
    },
    {
      key: "sub-strength",
      title: "Strength train twice a week",
      area: "Health",
      timeframe: "WEEKLY",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      metricType: "NUMERIC",
      start: startOfWeekMonday(TODAY),
      target: addDays(startOfWeekMonday(TODAY), 6),
      targetValue: 2,
      currentValue: 1,
      unit: "sessions",
      parent: "get-fit",
      description: "A sub-goal of “Get properly fit”.",
    },
    {
      key: "visit-countries",
      title: "Visit 3 new countries",
      area: "Personal",
      timeframe: "YEARLY",
      status: "IN_PROGRESS",
      priority: "LOW",
      metricType: "NUMERIC",
      start: `${thisYear}-01-01`,
      target: `${thisYear}-12-31`,
      targetValue: 3,
      currentValue: 1,
      unit: "countries",
      description: "Slow travel, at least four nights each place.",
    },
    {
      key: "meditate",
      title: "Meditate 20 days this month",
      area: "Personal",
      timeframe: "MONTHLY",
      status: "IN_PROGRESS",
      priority: "LOW",
      metricType: "HABIT_BASED",
      start: startOfMonth(TODAY),
      target: addDays(startOfMonth(TODAY), 30),
      targetValue: 20,
      currentValue: 12,
      unit: "days",
      description: "Ten minutes counts. Consistency over duration.",
    },
    {
      key: "spanish-b1",
      title: "Reach conversational Spanish",
      area: "Learning",
      timeframe: "YEARLY",
      status: "COMPLETED",
      priority: "MEDIUM",
      metricType: "MANUAL",
      start: addDays(HISTORY_START, 20),
      target: addDays(HISTORY_START, 600),
      project: "Learn Spanish",
      description: "Completed ahead of schedule — kept the streak alive.",
      milestones: [
        { title: "Order food without pointing", offsetDays: 120, done: true },
        { title: "First full conversation", offsetDays: 320, done: true },
        { title: "Read a short story", offsetDays: 540, done: true },
      ],
    },
    {
      key: "learn-swim",
      title: "Learn to swim",
      area: "Health",
      timeframe: "YEARLY",
      status: "NOT_STARTED",
      priority: "LOW",
      metricType: "MANUAL",
      start: addDays(TODAY, 30),
      target: addDays(TODAY, 365),
      description: "Next year's project. Book adult lessons first.",
    },
  ];

  const goalIds = new Map<string, string>();
  for (const spec of goalSpecs) {
    const id = newId();
    goalIds.set(spec.key, id);
    const startInstant = at(spec.start, 8 * 60);
    await prisma.goal.create({
      data: {
        id,
        userId,
        title: spec.title,
        description: spec.description,
        timeframe: spec.timeframe,
        status: spec.status,
        priority: spec.priority,
        metricType: spec.metricType,
        startDate: dateOnlyToDb(spec.start),
        targetDate: spec.target ? dateOnlyToDb(spec.target) : null,
        targetValue: spec.targetValue ?? null,
        currentValue: spec.currentValue ?? null,
        unit: spec.unit ?? null,
        parentGoalId: spec.parent ? (goalIds.get(spec.parent) as string) : null,
        lifeAreaId: areaId(spec.area),
        projectId: spec.project ? (projectIds.get(spec.project) as string) : null,
        completedAt: spec.status === "COMPLETED" ? at(spec.target ?? spec.start, 18 * 60) : null,
        createdAt: startInstant,
        updatedAt: startInstant,
      },
    });

    for (const [index, milestone] of (spec.milestones ?? []).entries()) {
      const milestoneId = newId();
      const dueDate = addDays(spec.start, milestone.offsetDays);
      await prisma.goalMilestone.create({
        data: {
          id: milestoneId,
          userId,
          goalId: id,
          title: milestone.title,
          dueDate: dateOnlyToDb(dueDate),
          completedAt: milestone.done ? at(dueDate, 17 * 60) : null,
          order: index,
          createdAt: startInstant,
        },
      });
      if (milestone.done) {
        const award = buildMilestoneAward(milestoneId, POINT_RULES);
        if (award) {
          pushReward({
            userId,
            points: award.points,
            reason: award.reason,
            idempotencyKey: award.idempotencyKey,
            goalMilestoneId: milestoneId,
            note: `Milestone: ${milestone.title}`,
            createdAt: at(dueDate, 17 * 60),
          });
        }
      }
    }
  }

  // --- 5. Habits (check-ins are generated in a later phase) ---
  interface HabitSpec {
    name: string;
    description: string;
    area: string;
    frequency: HabitDefinition["frequency"];
    targetPerPeriod: number;
    weekdays: number[];
    unit: string | null;
    color: string;
    icon: string;
    startOffsetDays: number;
    probability: number;
    valueMode: "boolean" | "count";
  }

  const habitSpecs: HabitSpec[] = [
    {
      name: "Morning meditation",
      description: "Ten quiet minutes before the day starts.",
      area: "Personal",
      frequency: "DAILY",
      targetPerPeriod: 1,
      weekdays: [],
      unit: "min",
      color: "#8b5cf6",
      icon: "sparkles",
      startOffsetDays: 2,
      probability: 0.82,
      valueMode: "boolean",
    },
    {
      name: "Read 30 minutes",
      description: "Fiction at night, non-fiction in the morning.",
      area: "Learning",
      frequency: "DAILY",
      targetPerPeriod: 1,
      weekdays: [],
      unit: "min",
      color: "#ec4899",
      icon: "book",
      startOffsetDays: 2,
      probability: 0.72,
      valueMode: "boolean",
    },
    {
      name: "Workout",
      description: "Lift or run — anything that counts.",
      area: "Health",
      frequency: "CUSTOM",
      targetPerPeriod: 1,
      weekdays: [1, 3, 5],
      unit: "session",
      color: "#10b981",
      icon: "dumbbell",
      startOffsetDays: 3,
      probability: 0.78,
      valueMode: "boolean",
    },
    {
      name: "Drink 8 glasses of water",
      description: "Roughly two litres.",
      area: "Health",
      frequency: "DAILY",
      targetPerPeriod: 8,
      weekdays: [],
      unit: "glasses",
      color: "#0ea5e9",
      icon: "heart",
      startOffsetDays: 1,
      probability: 0.75,
      valueMode: "count",
    },
    {
      name: "Write in journal",
      description: "Even a couple of lines.",
      area: "Personal",
      frequency: "DAILY",
      targetPerPeriod: 1,
      weekdays: [],
      unit: "entry",
      color: "#f59e0b",
      icon: "star",
      startOffsetDays: 1,
      probability: 0.68,
      valueMode: "boolean",
    },
    {
      name: "No added sugar",
      description: "Whole fruit is fine.",
      area: "Health",
      frequency: "DAILY",
      targetPerPeriod: 1,
      weekdays: [],
      unit: null,
      color: "#ef4444",
      icon: "leaf",
      startOffsetDays: 1,
      probability: 0.6,
      valueMode: "boolean",
    },
    {
      name: "Weekly review",
      description: "Empty the inbox, plan the week.",
      area: "Career",
      frequency: "WEEKLY",
      targetPerPeriod: 1,
      weekdays: [],
      unit: "review",
      color: "#6366f1",
      icon: "target",
      startOffsetDays: 2,
      probability: 0.85,
      valueMode: "boolean",
    },
    {
      name: "Call family",
      description: "A real conversation, not a text.",
      area: "Family",
      frequency: "WEEKLY",
      targetPerPeriod: 2,
      weekdays: [],
      unit: "call",
      color: "#f97316",
      icon: "users",
      startOffsetDays: 2,
      probability: 0.7,
      valueMode: "count",
    },
  ];

  const habitRecords: {
    id: string;
    spec: HabitSpec;
    definition: HabitDefinition;
    start: DateOnly;
  }[] = [];
  for (const spec of habitSpecs) {
    const id = newId();
    const start = addDays(HISTORY_START, spec.startOffsetDays);
    const startInstant = at(start, 7 * 60);
    habitRecords.push({
      id,
      spec,
      start,
      definition: {
        frequency: spec.frequency,
        weekdays: spec.weekdays,
        targetPerPeriod: spec.targetPerPeriod,
        createdAt: start,
      },
    });
    await prisma.habit.create({
      data: {
        id,
        userId,
        name: spec.name,
        description: spec.description,
        frequency: spec.frequency,
        targetPerPeriod: spec.targetPerPeriod,
        weekdays: spec.weekdays,
        unit: spec.unit,
        color: spec.color,
        icon: spec.icon,
        lifeAreaId: areaId(spec.area),
        createdAt: startInstant,
        updatedAt: startInstant,
      },
    });
  }

  // --- 6. Tasks: recurring templates, then one-off tasks ---
  interface TemplateSpec {
    title: string;
    description: string;
    area: string;
    priority: TaskPriority;
    estimatedMinutes: number;
    startMinutes: number;
    endMinutes: number;
    rule: RuleSpec;
    completionRate: number;
    tags: string[];
    project?: string;
  }

  const templateSpecs: TemplateSpec[] = [
    {
      title: "Morning planning",
      description: "Review the day, pick the three things that matter.",
      area: "Career",
      priority: "MEDIUM",
      estimatedMinutes: 15,
      startMinutes: 8 * 60,
      endMinutes: 8 * 60 + 15,
      rule: { frequency: "WEEKLY", startDate: HISTORY_START, byWeekday: [1, 2, 3, 4, 5] },
      completionRate: 0.86,
      tags: ["deep-work"],
    },
    {
      title: "Evening shutdown ritual",
      description: "Clear the desk, close the loops, note tomorrow's first task.",
      area: "Personal",
      priority: "LOW",
      estimatedMinutes: 10,
      startMinutes: 21 * 60 + 30,
      endMinutes: 21 * 60 + 40,
      rule: { frequency: "DAILY", startDate: HISTORY_START },
      completionRate: 0.74,
      tags: ["quick-win"],
    },
    {
      title: "Weekly review",
      description: "Tidy the inbox, review goals, plan next week.",
      area: "Career",
      priority: "HIGH",
      estimatedMinutes: 45,
      startMinutes: 16 * 60,
      endMinutes: 16 * 60 + 45,
      rule: { frequency: "WEEKLY", startDate: HISTORY_START, byWeekday: [5] },
      completionRate: 0.78,
      tags: ["deep-work"],
      project: "Website Redesign",
    },
    {
      title: "Team sync prep",
      description: "Update the board and write talking points.",
      area: "Career",
      priority: "MEDIUM",
      estimatedMinutes: 30,
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 30,
      rule: { frequency: "WEEKLY", startDate: HISTORY_START, byWeekday: [1] },
      completionRate: 0.82,
      tags: ["meeting"],
    },
    {
      title: "Pay rent",
      description: "Standing transfer on the first.",
      area: "Finance",
      priority: "URGENT",
      estimatedMinutes: 10,
      startMinutes: 8 * 60,
      endMinutes: 8 * 60 + 10,
      rule: { frequency: "MONTHLY", startDate: HISTORY_START, byMonthDay: 1 },
      completionRate: 0.98,
      tags: ["finance"],
    },
    {
      title: "Monthly budget review",
      description: "Reconcile spending and adjust categories.",
      area: "Finance",
      priority: "HIGH",
      estimatedMinutes: 60,
      startMinutes: 19 * 60,
      endMinutes: 20 * 60,
      rule: { frequency: "MONTHLY", startDate: HISTORY_START, byMonthDay: 1 },
      completionRate: 0.8,
      tags: ["finance", "deep-work"],
    },
    {
      title: "Inbox to zero",
      description: "Two-minute rule and quick replies only.",
      area: "Career",
      priority: "LOW",
      estimatedMinutes: 20,
      startMinutes: 12 * 60 + 30,
      endMinutes: 12 * 60 + 50,
      rule: { frequency: "WEEKLY", startDate: HISTORY_START, byWeekday: [1, 2, 3, 4, 5] },
      completionRate: 0.6,
      tags: ["quick-win"],
    },
    {
      title: "Annual tax filing",
      description: "Gather documents and file the return.",
      area: "Finance",
      priority: "HIGH",
      estimatedMinutes: 180,
      startMinutes: 10 * 60,
      endMinutes: 13 * 60,
      rule: {
        frequency: "YEARLY",
        startDate: `${HISTORY_START.slice(0, 4)}-04-15`,
        byMonth: 4,
        byMonthDay: 15,
      },
      completionRate: 1,
      tags: ["finance"],
    },
  ];

  const seriesList: {
    taskId: string;
    definition: RecurrenceDefinition;
    completionRate: number;
    priority: TaskPriority;
  }[] = [];
  const taskRuleRows: Prisma.RecurrenceRuleCreateManyInput[] = [];
  const templatePlans = templateSpecs.map((spec) => {
    const ruleRow = toRuleRow(userId, spec.rule);
    taskRuleRows.push(ruleRow);
    const taskId = newId();
    seriesList.push({
      taskId,
      definition: toDefinition(spec.rule),
      completionRate: spec.completionRate,
      priority: spec.priority,
    });
    return { spec, ruleRow, taskId };
  });

  // Rules must exist before the tasks that reference them (FK).
  await insert("recurrence rules", taskRuleRows, (data) =>
    prisma.recurrenceRule.createMany({ data, skipDuplicates: true }),
  );

  for (const { spec, ruleRow, taskId } of templatePlans) {
    await prisma.task.create({
      data: {
        id: taskId,
        userId,
        title: spec.title,
        description: spec.description,
        status: "TODO",
        priority: spec.priority,
        startMinutes: spec.startMinutes,
        endMinutes: spec.endMinutes,
        estimatedMinutes: spec.estimatedMinutes,
        isRecurring: true,
        seriesId: taskId,
        recurrenceRuleId: ruleRow.id as string,
        lifeAreaId: areaId(spec.area),
        projectId: spec.project ? (projectIds.get(spec.project) as string) : null,
        createdAt: at(HISTORY_START, 7 * 60),
        updatedAt: at(HISTORY_START, 7 * 60),
        tags: { connect: spec.tags.map((tag) => ({ id: tagId(tag) })) },
      },
    });
  }

  // --- One-off tasks (with occasional subtasks) ---
  interface OneOff {
    id: string;
    priority: TaskPriority;
    doDate: DateOnly;
    status: string;
  }
  const oneOff: OneOff[] = [];

  const spanDays = Math.round(
    (new Date(dateOnlyToDb(FUTURE_END)).getTime() -
      new Date(dateOnlyToDb(HISTORY_START)).getTime()) /
      86_400_000,
  );
  const weekCount = Math.floor(spanDays / 7);
  const projectNames = projectSpecs.map((p) => p.name);

  for (let week = 0; week < weekCount; week += 1) {
    const weekStart = addWeeks(HISTORY_START, week);
    const tasksThisWeek = randInt(2, 5);
    for (let n = 0; n < tasksThisWeek; n += 1) {
      const doDate = addDays(weekStart, randInt(0, 6));
      const area = pick(Object.keys(TASK_LIBRARY));
      const title = pick(TASK_LIBRARY[area] as string[])
        .replace("{quarter}", `Q${randInt(1, 4)}`)
        .replace("{name}", pick(PEOPLE))
        .replace("{topic}", pick(TOPICS))
        .replace("{area}", pick(AREAS));
      const priority = pick<TaskPriority>(["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "URGENT"]);
      const estimatedMinutes = pick([15, 30, 45, 60, 90, 120]);
      const project = pick([undefined, undefined, undefined, ...projectNames]);
      const daysAgo = Math.round(
        (new Date(dateOnlyToDb(TODAY)).getTime() - new Date(dateOnlyToDb(doDate)).getTime()) /
          86_400_000,
      );

      let status: Prisma.TaskCreateInput["status"];
      let completedAt: Date | null = null;
      if (daysAgo > 14) {
        const r = rand();
        status = r < 0.86 ? "COMPLETED" : r < 0.95 ? "CANCELLED" : "TODO";
      } else if (daysAgo >= 0) {
        const r = rand();
        status = r < 0.55 ? "COMPLETED" : r < 0.7 ? "CANCELLED" : r < 0.85 ? "IN_PROGRESS" : "TODO";
      } else {
        status = chance(0.12) ? "IN_PROGRESS" : "TODO";
      }
      if (status === "COMPLETED") completedAt = completionTime(doDate);

      const id = newId();
      const createdAt = doDate > TODAY ? createdEarlier(TODAY) : createdEarlier(doDate);
      const actualMinutes =
        status === "COMPLETED" ? Math.max(5, estimatedMinutes + randInt(-10, 20)) : null;
      const taskTags = chance(0.4) ? [pick(tagSpecs).name] : [];
      const dueDate = chance(0.35) ? addDays(doDate, randInt(1, 7)) : null;

      await prisma.task.create({
        data: {
          id,
          userId,
          title,
          status,
          priority,
          doDate: dateOnlyToDb(doDate),
          dueDate: dueDate ? dateOnlyToDb(dueDate) : null,
          estimatedMinutes,
          actualMinutes,
          completedAt,
          lifeAreaId: areaId(area),
          projectId: project ? (projectIds.get(project) as string) : null,
          createdAt,
          updatedAt: completedAt ?? createdAt,
          tags: taskTags.length
            ? { connect: taskTags.map((tag) => ({ id: tagId(tag) })) }
            : undefined,
        },
      });
      oneOff.push({ id, priority, doDate, status });

      if (status === "COMPLETED" && completedAt) {
        completionRows.push({
          id: newId(),
          userId,
          taskId: id,
          completedAt,
          createdAt: completedAt,
          actualMinutes,
        });
        const award = buildTaskCompletionAward({ kind: "task", taskId: id }, priority, POINT_RULES);
        if (award) {
          pushReward({
            userId,
            points: award.points,
            reason: award.reason,
            idempotencyKey: award.idempotencyKey,
            taskId: id,
            createdAt: completedAt,
          });
        }
      }

      if (chance(0.15)) {
        const subtaskCount = randInt(1, 3);
        for (let s = 0; s < subtaskCount; s += 1) {
          const subDone = status === "COMPLETED" ? chance(0.9) : chance(0.2);
          const subStatus: Prisma.TaskCreateInput["status"] = subDone
            ? "COMPLETED"
            : status === "CANCELLED"
              ? "CANCELLED"
              : "TODO";
          await prisma.task.create({
            data: {
              id: newId(),
              userId,
              title: `${pick(["Part", "Step", "Item"])} ${s + 1}`,
              parentTaskId: id,
              status: subStatus,
              priority,
              doDate: dateOnlyToDb(doDate),
              completedAt: subDone ? completionTime(doDate) : null,
              lifeAreaId: areaId(area),
              order: s,
              createdAt,
              updatedAt: completedAt ?? createdAt,
            },
          });
        }
      }
    }
  }

  // Undated "inbox" tasks and deadline-only tasks.
  for (let i = 0; i < 6; i += 1) {
    const area = pick(Object.keys(TASK_LIBRARY));
    const title = pick(TASK_LIBRARY[area] as string[]).replace("{name}", pick(PEOPLE));
    const createdAt = createdEarlier(TODAY);
    await prisma.task.create({
      data: {
        id: newId(),
        userId,
        title: `Inbox: ${title}`,
        status: "TODO",
        priority: "LOW",
        doDate: null,
        dueDate: chance(0.5) ? dateOnlyToDb(addDays(TODAY, randInt(3, 40))) : null,
        lifeAreaId: areaId(area),
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // A deliberate "today / next few days" focus so the Today and Upcoming views
  // are never empty, regardless of where the weekly sampling landed.
  const focusSpecs: {
    offset: number;
    title: string;
    area: string;
    priority: TaskPriority;
    status: "TODO" | "IN_PROGRESS";
  }[] = [
    {
      offset: 0,
      title: "Review the quarterly roadmap",
      area: "Career",
      priority: "HIGH",
      status: "IN_PROGRESS",
    },
    {
      offset: 0,
      title: "Draft the side-project update",
      area: "Side Projects",
      priority: "MEDIUM",
      status: "TODO",
    },
    { offset: 0, title: "Easy 30-minute run", area: "Health", priority: "MEDIUM", status: "TODO" },
    { offset: 0, title: "Call Mum", area: "Family", priority: "HIGH", status: "TODO" },
    {
      offset: 0,
      title: "Clear the reading backlog",
      area: "Learning",
      priority: "LOW",
      status: "TODO",
    },
    {
      offset: 1,
      title: "Prep Monday's 1:1 notes",
      area: "Career",
      priority: "MEDIUM",
      status: "TODO",
    },
    { offset: 1, title: "Weekly grocery order", area: "Personal", priority: "LOW", status: "TODO" },
    {
      offset: 1,
      title: "Strength session",
      area: "Health",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
    },
    { offset: 2, title: "Plan the sprint", area: "Career", priority: "HIGH", status: "TODO" },
    { offset: 2, title: "Pay the water bill", area: "Finance", priority: "MEDIUM", status: "TODO" },
  ];
  for (const item of focusSpecs) {
    const doDate = addDays(TODAY, item.offset);
    const createdAt = createdEarlier(TODAY);
    const id = newId();
    await prisma.task.create({
      data: {
        id,
        userId,
        title: item.title,
        status: item.status,
        priority: item.priority,
        doDate: dateOnlyToDb(doDate),
        estimatedMinutes: pick([30, 45, 60]),
        lifeAreaId: areaId(item.area),
        createdAt,
        updatedAt: createdAt,
      },
    });
    oneOff.push({ id, priority: item.priority, doDate, status: item.status });
  }

  // --- 7. Goal ↔ task links (so TASK_BASED progress has real inputs) ---
  const releaseGoalId = goalIds.get("ship-releases") as string;
  // Link four not-yet-done tasks, then complete two of them so the goal reads
  // as an honest "2 of 4 done" (50%) rather than an arbitrary roll-up.
  const linkCandidates = oneOff
    .filter(
      (task) =>
        compareDateOnly(task.doDate, TODAY) <= 0 &&
        task.status !== "COMPLETED" &&
        task.status !== "CANCELLED",
    )
    .slice(-4);
  const goalTaskRows: Prisma.GoalTaskCreateManyInput[] = [];
  for (const [index, task] of linkCandidates.entries()) {
    if (index < 2) {
      const completedAt = completionTime(task.doDate);
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "COMPLETED", completedAt },
      });
      completionRows.push({
        id: newId(),
        userId,
        taskId: task.id,
        completedAt,
        createdAt: completedAt,
      });
      const award = buildTaskCompletionAward(
        { kind: "task", taskId: task.id },
        task.priority,
        POINT_RULES,
      );
      if (award) {
        pushReward({
          userId,
          points: award.points,
          reason: award.reason,
          idempotencyKey: award.idempotencyKey,
          taskId: task.id,
          createdAt: completedAt,
        });
      }
    }
    goalTaskRows.push({ id: newId(), userId, goalId: releaseGoalId, taskId: task.id });
  }
  await insert("goal links", goalTaskRows, (data) =>
    prisma.goalTask.createMany({ data, skipDuplicates: true }),
  );

  // --- 8. Timetable (the weekly template) ---
  const clock = (value: string): number => parseTimeToMinutes(value) ?? 0;
  const blockSpecs: {
    title: string;
    category: string;
    area: string;
    days: number[];
    start: string;
    end: string;
    color: string;
    description: string;
  }[] = [
    {
      title: "Deep work",
      category: "focus",
      area: "Career",
      days: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "12:00",
      color: "#6366f1",
      description: "No meetings, no notifications.",
    },
    {
      title: "Lunch",
      category: "break",
      area: "Personal",
      days: [1, 2, 3, 4, 5],
      start: "12:00",
      end: "13:00",
      color: "#64748b",
      description: "Away from the desk.",
    },
    {
      title: "Admin & email",
      category: "admin",
      area: "Career",
      days: [2, 4],
      start: "14:00",
      end: "15:00",
      color: "#f59e0b",
      description: "Batched into two windows.",
    },
    {
      title: "Team sync",
      category: "meeting",
      area: "Career",
      days: [1],
      start: "16:00",
      end: "17:00",
      color: "#0ea5e9",
      description: "Weekly kickoff.",
    },
    {
      title: "Gym",
      category: "health",
      area: "Health",
      days: [1, 3, 5],
      start: "18:30",
      end: "19:30",
      color: "#10b981",
      description: "Lift or class.",
    },
    {
      title: "Spanish practice",
      category: "learning",
      area: "Learning",
      days: [2, 4],
      start: "19:30",
      end: "20:15",
      color: "#ec4899",
      description: "Speaking drills.",
    },
    {
      title: "Long run",
      category: "health",
      area: "Health",
      days: [6],
      start: "08:00",
      end: "10:00",
      color: "#10b981",
      description: "Slow and steady.",
    },
    {
      title: "Church",
      category: "faith",
      area: "Faith",
      days: [0],
      start: "10:00",
      end: "11:30",
      color: "#8b5cf6",
      description: "Sunday service.",
    },
    {
      title: "Weekly planning",
      category: "review",
      area: "Personal",
      days: [0],
      start: "18:00",
      end: "19:00",
      color: "#f97316",
      description: "Set up the week.",
    },
    {
      title: "Evening shutdown",
      category: "review",
      area: "Personal",
      days: [1, 2, 3, 4, 5],
      start: "21:30",
      end: "21:45",
      color: "#64748b",
      description: "Close the loops.",
    },
  ];
  await prisma.timetableBlock.createMany({
    data: blockSpecs.map((block) => ({
      id: newId(),
      userId,
      title: block.title,
      description: block.description,
      category: block.category,
      color: block.color,
      startMinutes: clock(block.start),
      endMinutes: clock(block.end),
      days: block.days,
      lifeAreaId: areaId(block.area),
      createdAt: at(HISTORY_START, 6 * 60),
      updatedAt: at(HISTORY_START, 6 * 60),
    })),
  });

  // --- 9. Calendar events (recurring = one rule row; the app expands on read) ---
  const eventRuleRows: Prisma.RecurrenceRuleCreateManyInput[] = [];
  const eventRows: Prisma.CalendarEventCreateManyInput[] = [];

  interface RecurringEventSpec {
    title: string;
    area: string;
    days: number[];
    start: string;
    end: string;
    location?: string;
    description: string;
    allDay?: boolean;
  }
  const recurringEventSpecs: RecurringEventSpec[] = [
    {
      title: "Team standup",
      area: "Career",
      days: [1, 2, 3, 4, 5],
      start: "09:30",
      end: "09:45",
      location: "Zoom",
      description: "Fifteen minutes, standing.",
    },
    {
      title: "1:1 with Jordan",
      area: "Career",
      days: [2],
      start: "14:00",
      end: "14:30",
      location: "Room 3",
      description: "Growth and blockers.",
    },
    {
      title: "Gym class",
      area: "Health",
      days: [1, 3, 5],
      start: "18:30",
      end: "19:30",
      location: "Riverside Gym",
      description: "Strength circuit.",
    },
    {
      title: "Family dinner",
      area: "Family",
      days: [0],
      start: "18:00",
      end: "19:30",
      location: "Home",
      description: "Everyone at the table.",
    },
    {
      title: "Church service",
      area: "Faith",
      days: [0],
      start: "10:00",
      end: "11:30",
      location: "St. Anne's",
      description: "Sunday service.",
    },
    {
      title: "Spanish class",
      area: "Learning",
      days: [2, 4],
      start: "19:30",
      end: "20:30",
      location: "Language school",
      description: "Conversation practice.",
    },
    {
      title: "Recycling pickup",
      area: "Personal",
      days: [3],
      start: "00:00",
      end: "23:59",
      description: "Put the bin out the night before.",
      allDay: true,
    },
  ];
  for (const spec of recurringEventSpecs) {
    const ruleRow = toRuleRow(userId, {
      frequency: "WEEKLY",
      startDate: HISTORY_START,
      byWeekday: spec.days,
    });
    eventRuleRows.push(ruleRow);
    const eventId = newId();
    const allDay = Boolean(spec.allDay);
    eventRows.push({
      id: eventId,
      userId,
      title: spec.title,
      description: spec.description,
      location: spec.location ?? null,
      startsAt: allDay ? at(HISTORY_START, 0) : at(HISTORY_START, clock(spec.start)),
      endsAt: allDay ? at(addDays(HISTORY_START, 1), 0) : at(HISTORY_START, clock(spec.end)),
      allDay,
      lifeAreaId: areaId(spec.area),
      recurrenceRuleId: ruleRow.id as string,
      seriesId: eventId,
      createdAt: at(HISTORY_START, 6 * 60),
      updatedAt: at(HISTORY_START, 6 * 60),
    });
  }

  const oneOffEvents: {
    title: string;
    area: string;
    offset: number;
    start: string;
    end: string;
    location?: string;
    meetingUrl?: string;
    description: string;
  }[] = [
    {
      title: "Dentist appointment",
      area: "Health",
      offset: 30,
      start: "11:00",
      end: "12:00",
      location: "Riverside Dental",
      description: "Six-month check-up.",
    },
    {
      title: "Google I/O watch party",
      area: "Learning",
      offset: 210,
      start: "18:00",
      end: "21:00",
      meetingUrl: "https://meet.example.com/io",
      description: "Keynote with the team.",
    },
    {
      title: "Mia's birthday party",
      area: "Family",
      offset: 150,
      start: "15:00",
      end: "18:00",
      location: "The Park",
      description: "Bring the cake.",
    },
    {
      title: "Company offsite",
      area: "Career",
      offset: 380,
      start: "09:00",
      end: "17:00",
      location: "Lake Lodge",
      description: "Strategy day.",
    },
    {
      title: "Blood donation",
      area: "Health",
      offset: 240,
      start: "14:30",
      end: "15:30",
      location: "City Blood Bank",
      description: "Eat beforehand.",
    },
    {
      title: "Hackathon",
      area: "Career",
      offset: 470,
      start: "09:00",
      end: "18:00",
      meetingUrl: "https://meet.example.com/hack",
      description: "Team Life OS.",
    },
    {
      title: "Concert: The National",
      area: "Personal",
      offset: 520,
      start: "20:00",
      end: "23:00",
      location: "Grand Hall",
      description: "Front row tickets.",
    },
    {
      title: "Root canal",
      area: "Health",
      offset: 400,
      start: "10:00",
      end: "11:30",
      location: "Riverside Dental",
      description: "Not the fun one.",
    },
    {
      title: "Parent-teacher meeting",
      area: "Family",
      offset: 330,
      start: "16:00",
      end: "16:30",
      location: "School",
      description: "Mia's progress.",
    },
    {
      title: "Flight to Lisbon",
      area: "Personal",
      offset: 560,
      start: "07:00",
      end: "13:00",
      location: "Airport, Gate B12",
      description: "Summer trip.",
    },
    {
      title: "Community cleanup",
      area: "Faith",
      offset: 300,
      start: "09:00",
      end: "12:00",
      location: "Riverside Park",
      description: "Bags and gloves provided.",
    },
    {
      title: "Marathon race day",
      area: "Health",
      offset: 660,
      start: "07:30",
      end: "14:00",
      location: "City Centre",
      description: "The big one.",
    },
    {
      title: "Christmas dinner",
      area: "Family",
      offset: 620,
      start: "17:00",
      end: "21:00",
      location: "Mum's house",
      description: "Bring dessert.",
    },
    {
      title: "Annual health checkup",
      area: "Health",
      offset: 700,
      start: "08:30",
      end: "09:30",
      location: "Family Clinic",
      description: "Fasting bloods.",
    },
    {
      title: "Team offsite",
      area: "Career",
      offset: 730,
      start: "09:00",
      end: "17:00",
      location: "Lake Lodge",
      description: "Quarterly planning.",
    },
  ];
  for (const spec of oneOffEvents) {
    const date = addDays(HISTORY_START, spec.offset);
    if (compareDateOnly(date, FUTURE_END) > 0) continue;
    eventRows.push({
      id: newId(),
      userId,
      title: spec.title,
      description: spec.description,
      location: spec.location ?? null,
      meetingUrl: spec.meetingUrl ?? null,
      startsAt: at(date, clock(spec.start)),
      endsAt: at(date, clock(spec.end)),
      allDay: false,
      lifeAreaId: areaId(spec.area),
      createdAt: at(addDays(date, -14), 9 * 60),
      updatedAt: at(addDays(date, -14), 9 * 60),
    });
  }

  await insert("recurrence rules", eventRuleRows, (data) =>
    prisma.recurrenceRule.createMany({ data, skipDuplicates: true }),
  );
  await insert("calendar events", eventRows, (data) =>
    prisma.calendarEvent.createMany({ data, skipDuplicates: true }),
  );

  // --- 10. Recurring occurrences + their completions/rewards ---
  for (const series of seriesList) {
    for (const date of getOccurrences(series.definition, { from: HISTORY_START, to: FUTURE_END })) {
      const occurrenceId = newId();
      const isPast = compareDateOnly(date, TODAY) < 0;
      const isToday = compareDateOnly(date, TODAY) === 0;

      let status: "PENDING" | "COMPLETED" | "SKIPPED" = "PENDING";
      if (isPast) {
        status = chance(series.completionRate) ? "COMPLETED" : "SKIPPED";
      } else if (isToday) {
        status = chance(0.5) ? "COMPLETED" : "PENDING";
      }
      const completedAt = status === "COMPLETED" ? completionTime(date) : null;

      occurrenceRows.push({
        id: occurrenceId,
        userId,
        taskId: series.taskId,
        seriesId: series.taskId,
        scheduledFor: dateOnlyToDb(date),
        status,
        completedAt,
        skipped: status === "SKIPPED",
        actualMinutes: status === "COMPLETED" ? randInt(5, 60) : null,
      });

      if (status === "COMPLETED" && completedAt) {
        completionRows.push({
          id: newId(),
          userId,
          taskId: series.taskId,
          occurrenceId,
          completedAt,
          createdAt: completedAt,
        });
        const award = buildTaskCompletionAward(
          { kind: "occurrence", occurrenceId },
          series.priority,
          POINT_RULES,
        );
        if (award) {
          pushReward({
            userId,
            points: award.points,
            reason: award.reason,
            idempotencyKey: award.idempotencyKey,
            taskId: series.taskId,
            occurrenceId,
            createdAt: completedAt,
          });
        }
      }
    }
  }

  await insert("task occurrences", occurrenceRows, (data) =>
    prisma.taskOccurrence.createMany({ data, skipDuplicates: true }),
  );

  // --- 11. Habit check-ins (+ rewards for completed periods) ---
  const checkInRows: Prisma.HabitCheckInCreateManyInput[] = [];
  for (const habit of habitRecords) {
    const { spec, definition, start } = habit;

    if (spec.frequency === "WEEKLY") {
      for (
        let week = startOfWeekMonday(start);
        compareDateOnly(week, TODAY) <= 0;
        week = addWeeks(week, 1)
      ) {
        const completed = chance(spec.probability);
        const target = spec.targetPerPeriod;
        const hits = completed ? target : Math.max(0, target - 1);
        const usedDays = new Set<number>();
        const weekDates: DateOnly[] = [];
        for (let i = 0; i < hits; i += 1) {
          let offset = randInt(0, 6);
          for (let guard = 0; usedDays.has(offset) && guard < 12; guard += 1)
            offset = randInt(0, 6);
          usedDays.add(offset);
          const date = addDays(week, offset);
          if (compareDateOnly(date, TODAY) > 0 || compareDateOnly(date, start) < 0) continue;
          weekDates.push(date);
          checkInRows.push({
            id: newId(),
            userId,
            habitId: habit.id,
            date: dateOnlyToDb(date),
            value: 1,
            createdAt: at(date, 20 * 60),
          });
        }
        // Award only when the week actually reached its target, so the ledger
        // agrees with what the check-in rows show.
        if (weekDates.length >= target) {
          const rewardDate = weekDates.slice().sort(compareDateOnly)[
            weekDates.length - 1
          ] as DateOnly;
          const award = buildHabitAward(habit.id, rewardDate, POINT_RULES);
          if (award) {
            pushReward({
              userId,
              points: award.points,
              reason: award.reason,
              idempotencyKey: award.idempotencyKey,
              habitId: habit.id,
              createdAt: at(rewardDate, 20 * 60),
            });
          }
        }
      }
      continue;
    }

    for (const date of eachDay(start, TODAY)) {
      if (!isScheduledOn(definition, date)) continue;
      const completed = chance(spec.probability);

      if (spec.valueMode === "count") {
        const value = completed
          ? spec.targetPerPeriod
          : randInt(3, Math.max(3, spec.targetPerPeriod - 1));
        if (value <= 0) continue;
        checkInRows.push({
          id: newId(),
          userId,
          habitId: habit.id,
          date: dateOnlyToDb(date),
          value,
          createdAt: at(date, 19 * 60),
        });
        if (completed) {
          const award = buildHabitAward(habit.id, date, POINT_RULES);
          if (award) {
            pushReward({
              userId,
              points: award.points,
              reason: award.reason,
              idempotencyKey: award.idempotencyKey,
              habitId: habit.id,
              createdAt: at(date, 19 * 60),
            });
          }
        }
      } else if (completed) {
        checkInRows.push({
          id: newId(),
          userId,
          habitId: habit.id,
          date: dateOnlyToDb(date),
          value: 1,
          createdAt: at(date, 20 * 60),
        });
        const award = buildHabitAward(habit.id, date, POINT_RULES);
        if (award) {
          pushReward({
            userId,
            points: award.points,
            reason: award.reason,
            idempotencyKey: award.idempotencyKey,
            habitId: habit.id,
            createdAt: at(date, 20 * 60),
          });
        }
      }
    }
  }

  // Guarantee a handful of check-ins land on "today" so the Today and Habits
  // views look alive even when the PRNG skipped them.
  const checkedToday = new Set(
    checkInRows
      .filter((row) => dbDateToDateOnly(row.date as Date) === TODAY)
      .map((row) => row.habitId),
  );
  for (const habit of habitRecords) {
    if (habit.spec.frequency === "WEEKLY") continue;
    if (!isScheduledOn(habit.definition, TODAY)) continue;
    if (checkedToday.has(habit.id)) continue;
    if (!chance(0.65)) continue;
    const value = habit.spec.valueMode === "count" ? habit.spec.targetPerPeriod : 1;
    checkInRows.push({
      id: newId(),
      userId,
      habitId: habit.id,
      date: dateOnlyToDb(TODAY),
      value,
      createdAt: at(TODAY, 20 * 60),
    });
    const award = buildHabitAward(habit.id, TODAY, POINT_RULES);
    if (award) {
      pushReward({
        userId,
        points: award.points,
        reason: award.reason,
        idempotencyKey: award.idempotencyKey,
        habitId: habit.id,
        createdAt: at(TODAY, 20 * 60),
      });
    }
  }

  await insert("habit check-ins", checkInRows, (data) =>
    prisma.habitCheckIn.createMany({ data, skipDuplicates: true }),
  );

  // --- 12. Notes ---
  for (const [index, note] of NOTE_LIBRARY.entries()) {
    const createdDaysAgo = randInt(5, 700);
    const created = atOrBeforeNow(addDays(TODAY, -createdDaysAgo), randInt(9 * 60, 18 * 60));
    const updated = atOrBeforeNow(
      addDays(TODAY, -randInt(0, createdDaysAgo)),
      randInt(9 * 60, 18 * 60),
    );
    const noteTags = chance(0.5) ? [pick(["deep-work", "ideas", "reading", "finance"])] : [];
    await prisma.note.create({
      data: {
        id: newId(),
        userId,
        title: note.title,
        body: note.body,
        format: "MARKDOWN",
        pinned: index % 6 === 0,
        archived: chance(0.08),
        lifeAreaId: areaId(note.area),
        tags: noteTags.length
          ? { connect: noteTags.map((tag) => ({ id: tagId(tag) })) }
          : undefined,
        createdAt: created,
        updatedAt: updated,
      },
    });
  }
  console.log(`  • ${"notes".padEnd(22)} ${String(NOTE_LIBRARY.length).padStart(6)}`);

  // --- 13. Journal entries (at most one per day) ---
  let journalCount = 0;
  for (const date of eachDay(HISTORY_START, TODAY)) {
    // Always write an entry for today; past days are sampled.
    if (!chance(0.55) && compareDateOnly(date, TODAY) !== 0) continue;
    const created = atOrBeforeNow(date, randInt(20 * 60, 23 * 60));
    const entryTags = chance(0.4) ? [pick(JOURNAL_TAGS)] : [];
    await prisma.journalEntry.create({
      data: {
        id: newId(),
        userId,
        date: dateOnlyToDb(date),
        title: pick(JOURNAL_TITLES),
        body: pick(JOURNAL_BODIES),
        mood: pick(["GREAT", "GOOD", "GOOD", "GOOD", "OKAY", "OKAY", "LOW", "BAD"]),
        gratitude: chance(0.7) ? pick(GRATITUDE) : null,
        isPrivate: chance(0.85),
        tags: entryTags.length
          ? { connect: entryTags.map((tag) => ({ id: tagId(tag) })) }
          : undefined,
        createdAt: created,
        updatedAt: created,
      },
    });
    journalCount += 1;
  }
  console.log(`  • ${"journal entries".padEnd(22)} ${String(journalCount).padStart(6)}`);

  // --- 14. Bulk-insert the ledger + completions ---
  await insert("task completions", completionRows, (data) =>
    prisma.taskCompletion.createMany({ data }),
  );
  await insert("reward ledger", rewardRows, (data) =>
    prisma.rewardTransaction.createMany({ data, skipDuplicates: true }),
  );

  // --- Summary ---
  const balance = await prisma.rewardTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });

  console.log(`\n  Demo account ready.`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Email     ${DEMO_EMAIL}`);
  console.log(`  Password  ${DEMO_PASSWORD}`);
  console.log(`  Timezone  ${TIMEZONE}`);
  console.log(`  History   ${HISTORY_START} → ${FUTURE_END}`);
  console.log(`  Points    ${balance._sum.points ?? 0}\n`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
