import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { listRewardTransactions, getPointsBalance } from "@/features/rewards/queries";

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const user = await requireUser();

  const [balance, transactions] = await Promise.all([
    getPointsBalance(user.id),
    listRewardTransactions(user.id, { limit: 50 }),
  ]);

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
                  {tx.note ? (
                    <p className="text-muted-foreground text-xs">{tx.note}</p>
                  ) : null}
                </div>
                <span className="text-sm font-semibold">{tx.points > 0 ? `+${tx.points}` : tx.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
