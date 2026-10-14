import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <p className="text-muted-foreground">Analytics page</p>
    </div>
  );
}
