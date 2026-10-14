import Link from "next/link";
import { Command } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <Command className="size-4" />
            </div>
            Life OS
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-muted-foreground text-center text-xs">
          Your data stays yours. No third parties, no tracking.
        </p>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <div className="absolute inset-0 flex flex-col justify-center gap-6 p-12">
          <blockquote className="space-y-3">
            <p className="text-xl font-medium text-balance">
              “A calm place to plan your day, track what matters, and see how far
              you have come.”
            </p>
            <footer className="text-muted-foreground text-sm">
              Tasks, goals, habits, calendar and reflection — connected in one system.
            </footer>
          </blockquote>
          <ul className="text-muted-foreground grid gap-2 text-sm">
            <li>• Plan with a configurable weekly timetable</li>
            <li>• Track recurring work and streaks</li>
            <li>• Reflect with notes, journal and analytics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
