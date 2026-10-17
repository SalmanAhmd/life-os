import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { addDays, todayDateOnly } from "@/lib/dates";
import { zeroFillDays } from "@/lib/analytics/series";
import { LazyTrendChart } from "@/components/charts/lazy-trend-chart";
import { listRewardTransactions, getPointsBalance, pointsByDay } from "@/features/rewards/queries";

export const metadata: Metadata = { title: "Rewards" };

/** Days of points history shown in the trend chart. */
const TREND_DAYS = 30;

export default async function RewardsPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);
  const from = addDays(today, -(TREND_DAYS - 1));

  const [balance, transactions, rawPoints] = await Promise.all([
    getPointsBalance(user.id),
    listRewardTransactions(user.id, { limit: 50 }),
    pointsByDay(user.id, from, today),
  ]);

  // `pointsByDay` only returns days with activity; pad it so quiet days read as 0.
  const pointsSeries = zeroFillDays(
    from,
    today,
    rawPoints.map((point) => ({ date: point.date, value: point.points })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Rewards</h1>
        <p className="text-muted-foreground text-sm">
          Your points ledger. Earned through completing tasks, habits and milestones.
        </p>
      </div>

      <div className="border-border/70 bg-card flex flex-col gap-1 rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Total points</p>
        <p className="text-3xl font-semibold">{balance}</p>
      </div>

      <section className="border-border/70 bg-card flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Points earned</h2>
          <p className="text-muted-foreground text-xs">Per day · last {TREND_DAYS} days</p>
        </div>
        <LazyTrendChart
          data={pointsSeries}
          color="var(--chart-2)"
          valueLabel="Points"
          emptyLabel="Earn points by completing tasks, habits and milestones."
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recent transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="border-border/70 bg-card flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{tx.reason.replaceAll("_", " ")}</p>
                  {tx.note ? <p className="text-muted-foreground text-xs">{tx.note}</p> : null}
                </div>
                <span className="text-sm font-semibold">
                  {tx.points > 0 ? `+${tx.points}` : tx.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
