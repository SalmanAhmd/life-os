// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCalendarItems } from "@/features/calendar/actions";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import type { CalendarItem } from "@/features/calendar/queries";

// The view calls the server action to load each tab's range. Mock it so the
// test can assert *when* and *for which range* a refetch happens.
vi.mock("@/features/calendar/actions", () => ({
  fetchCalendarItems: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  getEventForEdit: vi.fn(),
}));

const fetchMock = vi.mocked(fetchCalendarItems);

// `globals` is off, so RTL's automatic cleanup is skipped.
afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

function item(overrides: Partial<CalendarItem>): CalendarItem {
  return {
    kind: "event",
    id: "e1",
    title: "Event",
    allDay: true,
    start: null,
    end: null,
    dateOnly: "2026-10-05",
    lifeArea: null,
    color: null,
    recurrenceLabel: null,
    eventSeriesId: null,
    ...overrides,
  };
}

const TODAY = "2026-10-05";
// Ranges derived by `rangeFor` (week starts Sunday).
const MONTH = { from: "2026-09-27", to: "2026-10-31" };
const WEEK = { from: "2026-10-04", to: "2026-10-10" };
const DAY = { from: TODAY, to: TODAY };
const AGENDA = { from: TODAY, to: "2026-11-04" };

function ok(data: CalendarItem[]) {
  return { ok: true as const, data };
}

function renderView(initialItems: CalendarItem[]) {
  return render(<CalendarView items={initialItems} lifeAreas={[]} timezone="UTC" today={TODAY} />);
}

describe("CalendarView range switching", () => {
  it("reloads the month range when returning from day (reported bug)", async () => {
    const monthItems = [item({ id: "m1", title: "Month Event", dateOnly: "2026-10-20" })];
    const dayItems = [item({ id: "d1", title: "Day Event", dateOnly: TODAY })];

    fetchMock.mockImplementation(async (from, to) => {
      if (from === DAY.from && to === DAY.to) return ok(dayItems);
      if (from === MONTH.from && to === MONTH.to) return ok(monthItems);
      return ok([]);
    });

    renderView(monthItems);

    // The initial month range is server-rendered, so no client fetch yet.
    expect(screen.getByText("Month Event")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // Day tab → loads only that day's items.
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(await screen.findByText("Day Event")).toBeInTheDocument();
    expect(screen.queryByText("Month Event")).not.toBeInTheDocument();

    // Back to Month → must refetch, not keep the day's items on screen.
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(await screen.findByText("Month Event")).toBeInTheDocument();
    expect(screen.queryByText("Day Event")).not.toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(1, DAY.from, DAY.to);
    expect(fetchMock).toHaveBeenNthCalledWith(2, MONTH.from, MONTH.to);
  });

  it("refetches for week and agenda ranges as well", async () => {
    const monthItems = [item({ id: "m1", title: "Month Event", dateOnly: "2026-10-20" })];
    const weekItems = [item({ id: "w1", title: "Week Event", dateOnly: "2026-10-07" })];
    const agendaItems = [item({ id: "a1", title: "Agenda Event", dateOnly: "2026-10-20" })];

    fetchMock.mockImplementation(async (from, to) => {
      if (from === WEEK.from && to === WEEK.to) return ok(weekItems);
      if (from === AGENDA.from && to === AGENDA.to) return ok(agendaItems);
      return ok(monthItems);
    });

    renderView(monthItems);

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(await screen.findByText("Week Event")).toBeInTheDocument();
    expect(screen.queryByText("Month Event")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(await screen.findByText("Agenda Event")).toBeInTheDocument();
    expect(screen.queryByText("Week Event")).not.toBeInTheDocument();

    // Returning to Week must reload the week range again.
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(await screen.findByText("Week Event")).toBeInTheDocument();
    expect(screen.queryByText("Agenda Event")).not.toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(1, WEEK.from, WEEK.to);
    expect(fetchMock).toHaveBeenNthCalledWith(2, AGENDA.from, AGENDA.to);
    expect(fetchMock).toHaveBeenNthCalledWith(3, WEEK.from, WEEK.to);
  });

  it("ignores a stale response that resolves after a newer range", async () => {
    const monthItems = [item({ id: "m1", title: "Month Event", dateOnly: "2026-10-20" })];
    const dayItems = [item({ id: "d1", title: "Day Event", dateOnly: TODAY })];
    const weekItems = [item({ id: "w1", title: "Week Event", dateOnly: "2026-10-07" })];
    type FetchResult = Awaited<ReturnType<typeof fetchCalendarItems>>;

    let resolveDay: (value: FetchResult) => void = () => {};
    let resolveWeek: (value: FetchResult) => void = () => {};
    fetchMock.mockImplementation((from, to) => {
      if (from === DAY.from && to === DAY.to) {
        return new Promise<FetchResult>((resolve) => {
          resolveDay = resolve;
        });
      }
      if (from === WEEK.from && to === WEEK.to) {
        return new Promise<FetchResult>((resolve) => {
          resolveWeek = resolve;
        });
      }
      return Promise.resolve(ok(monthItems));
    });

    renderView(monthItems);

    // Fire two range changes before either request settles.
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    fireEvent.click(screen.getByRole("button", { name: "Week" }));

    // Week (the latest range) resolves first and wins.
    resolveWeek(ok(weekItems));
    expect(await screen.findByText("Week Event")).toBeInTheDocument();

    // The earlier day response arrives late and must be dropped.
    resolveDay(ok(dayItems));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Day Event")).not.toBeInTheDocument();
    expect(screen.getByText("Week Event")).toBeInTheDocument();
  });
});
