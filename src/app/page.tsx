import { ArrowRight, Calendar, Command, Target, Trophy } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Command className="size-4" />
          </div>
          Life OS
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <div className="bg-muted text-muted-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
          Plan · Track · Reflect
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          One calm system for your whole life
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-balance">
          Tasks, a configurable weekly timetable, goals, habits, calendar and
          reflection — connected so progress is visible and planning is simple.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/sign-up">
              Create your account
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">I already have an account</Link>
          </Button>
        </div>

        <div className="mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          <Feature icon={Calendar} title="Timetable" body="Design your ideal week and reuse it across days." />
          <Feature icon={Target} title="Goals & habits" body="Break big aims into milestones, tasks and streaks." />
          <Feature icon={Trophy} title="Rewards" body="Earn points for the work you complete, with a ledger you can trust." />
        </div>
      </main>

      <footer className="border-border/60 text-muted-foreground border-t px-6 py-6 text-center text-sm">
        Built to be self-hosted. Your data stays yours.
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Calendar;
  title: string;
  body: string;
}) {
  return (
    <div className="border-border/70 bg-card flex flex-col items-start gap-2 rounded-lg border p-4 text-left">
      <div className="bg-muted flex size-9 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{body}</p>
    </div>
  );
}
