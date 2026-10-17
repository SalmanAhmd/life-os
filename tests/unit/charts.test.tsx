// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ChartSkeleton } from "@/components/charts/chart-skeleton";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { LazyDistributionChart } from "@/components/charts/lazy-distribution-chart";
import { LazyTrendChart } from "@/components/charts/lazy-trend-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { GoalsProgressChart } from "@/features/analytics/components/goals-progress-chart";
import { LazyGoalsProgressChart } from "@/features/analytics/components/lazy-goals-progress-chart";
import type { AnalyticsSnapshot } from "@/features/analytics/types";

// `globals` is off in this project, so RTL's automatic cleanup is skipped.
afterEach(cleanup);

// recharts warns that its container has zero size because jsdom performs no
// layout. Filter that one message so the suite output stays readable.
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  const original = console.warn;
  warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("width(0) and height(0)")) return;
    original(...args);
  });
});
afterAll(() => warnSpy.mockRestore());

// recharts measures its own container with ResizeObserver, which jsdom lacks.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("TrendChart", () => {
  it("shows the empty label instead of a chart when every value is zero", () => {
    render(<TrendChart data={[{ date: "2026-10-01", value: 0 }]} emptyLabel="Nothing here yet" />);

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.queryByText("No data for this period yet.")).not.toBeInTheDocument();
  });

  it("shows the empty label when there is no data at all", () => {
    render(<TrendChart data={[]} emptyLabel="Nothing here yet" />);

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("swaps the empty label for a chart once a value is non-zero", () => {
    render(<TrendChart data={[{ date: "2026-10-01", value: 3 }]} emptyLabel="Nothing here yet" />);

    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
  });
});

describe("DistributionChart", () => {
  it("shows the empty label when every slice is zero", () => {
    render(
      <DistributionChart
        slices={[{ label: "To do", value: 0, color: "#111" }]}
        emptyLabel="No tasks yet."
      />,
    );

    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
  });

  it("lists each slice with its count and percentage share", () => {
    render(
      <DistributionChart
        slices={[
          { label: "To do", value: 3, color: "#111" },
          { label: "Completed", value: 1, color: "#222" },
        ]}
      />,
    );

    expect(screen.getByText("To do")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("3 · 75%")).toBeInTheDocument();
    expect(screen.getByText("1 · 25%")).toBeInTheDocument();
  });
});

describe("GoalsProgressChart", () => {
  it("shows the empty label when there are no goals", () => {
    render(<GoalsProgressChart goals={[]} emptyLabel="No goals yet." />);

    expect(screen.getByText("No goals yet.")).toBeInTheDocument();
  });

  it("renders a chart container when goals are present", () => {
    render(
      <GoalsProgressChart
        goals={[{ title: "Read 12 books", progress: 50, color: "#111" }]}
        emptyLabel="No goals yet."
      />,
    );

    expect(screen.queryByText("No goals yet.")).not.toBeInTheDocument();
  });
});

describe("ChartSkeleton", () => {
  it("renders a hidden placeholder at the requested height", () => {
    const { container } = render(<ChartSkeleton height={321} />);
    const placeholder = container.firstElementChild as HTMLElement;

    expect(placeholder).toHaveAttribute("aria-hidden");
    expect(placeholder).toHaveStyle({ height: "321px" });
  });
});

describe("lazy chart wrappers", () => {
  // The wrappers resolve their chunk asynchronously, so assert after loading.
  it("resolves the trend chart after its chunk loads", async () => {
    render(<LazyTrendChart data={[{ date: "2026-10-01", value: 0 }]} emptyLabel="Lazy trend" />);

    expect(await screen.findByText("Lazy trend")).toBeInTheDocument();
  });

  it("resolves the distribution chart after its chunk loads", async () => {
    render(<LazyDistributionChart slices={[{ label: "To do", value: 2, color: "#111" }]} />);

    expect(await screen.findByText("To do")).toBeInTheDocument();
  });

  it("resolves the goals progress chart after its chunk loads", async () => {
    render(<LazyGoalsProgressChart goals={[]} emptyLabel="Lazy goals" />);

    expect(await screen.findByText("Lazy goals")).toBeInTheDocument();
  });
});

describe("AnalyticsView", () => {
  const snapshot: AnalyticsSnapshot = {
    range: { from: "2026-09-18", to: "2026-10-17" },
    completions: [{ date: "2026-10-01", value: 2 }],
    points: [{ date: "2026-10-01", value: 5 }],
    checkIns: [],
    moods: [{ date: "2026-10-14", value: 4 }],
    taskStatus: [
      { status: "TODO", count: 2 },
      { status: "COMPLETED", count: 1 },
      { status: "SOMETHING_NEW", count: 1 },
    ],
  };

  it("renders status slices in a fixed order and passes unknown statuses through", async () => {
    render(<AnalyticsView snapshot={snapshot} goals={[]} windowDays={30} />);

    const items = await screen.findAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "To do2 · 50%",
      "Completed1 · 25%",
      "SOMETHING_NEW1 · 25%",
    ]);
  });

  it("falls back to empty states for metrics and goals with no data", async () => {
    render(<AnalyticsView snapshot={snapshot} goals={[]} windowDays={30} />);

    expect(await screen.findByText("Check in to a habit to see it here.")).toBeInTheDocument();
    expect(await screen.findByText("Create a goal to track progress here.")).toBeInTheDocument();
  });
});
