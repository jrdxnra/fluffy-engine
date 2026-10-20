import { describe, expect, it } from "vitest";
import { formatPreviousTopSet, getPreviousTopSet } from "@/lib/previous-top-set";
import { getCalendarWeekKey } from "@/lib/schedule";
import type { Client, CycleScheduleSettings, CycleSettings, CycleWeekSettings, LoggedSetMap } from "@/lib/types";

const at = "2026-10-06T00:00:00.000Z";
const sets = (...pairs: Array<[number, number]>): LoggedSetMap =>
  Object.fromEntries(pairs.map(([weight, reps], index) => [String(index + 2), { weight, reps, updatedAt: at }]));
const week = (name: string, work: [number, number, number], top: string): CycleWeekSettings => ({
  name,
  percentages: { warmup1: 0.5, warmup2: 0.6, workset1: work[0], workset2: work[1], workset3: work[2] },
  reps: { workset1: 5, workset2: 5, workset3: top },
});
const cycle: CycleSettings = {
  week1: week("Week 1", [0.65, 0.75, 0.85], "5+"),
  week2: week("Week 2", [0.7, 0.8, 0.9], "3+"),
  week3: week("Week 3", [0.75, 0.85, 0.95], "1+"),
  week4: week("Week 4", [0.4, 0.5, 0.6], "5"),
};
const schedule = (press: string, start = "2026-10-06") => ({
  cycleStartDate: start,
  day1Weekday: "Tuesday",
  day2Weekday: "Thursday",
  liftDayAssignments: { Squat: "day2", Deadlift: "day1", Bench: "day1", Press: "day2" },
  liftDisplayNames: { Squat: "Squat", Deadlift: "Deadlift", Bench: "Bench", Press: press },
}) as CycleScheduleSettings;

const client: Client = {
  id: "c1",
  name: "Lifter",
  oneRepMaxes: { Squat: 0, Bench: 0, Deadlift: 0, Press: 0 },
  trainingMaxes: { Squat: 0, Bench: 0, Deadlift: 0, Press: 0 },
  loggedSetInputsByCycle: {
    8: {
      week3: { Squat: sets([190, 3], [215, 3], [230, 2]), Press: sets([100, 5]) },
      week4: { Squat: sets([95, 5], [120, 5], [145, 9]) },
    },
    9: { week1: { Squat: sets([155, 5], [175, 5], [200, 8]) } },
  },
};
const lookup = (overrides: Partial<Parameters<typeof getPreviousTopSet>[0]> = {}) =>
  getPreviousTopSet({
    client,
    cycleNumber: 9,
    weekKey: "week2",
    lift: "Squat",
    cycleSettingsByCycle: { 8: cycle, 9: cycle },
    currentSchedule: schedule("1ct Pause Bench"),
    previousCycleSchedule: schedule("1ct Pause Bench"),
    ...overrides,
  });

describe("getPreviousTopSet", () => {
  it("uses the heaviest set from the most recent earlier week at the same rep scheme", () => {
    expect(lookup({ weekKey: "week3", cycleSettingsByCycle: { 8: cycle, 9: { ...cycle, week3: cycle.week1 } } }))
      .toEqual({ weight: 200, reps: 8, cycleNumber: 9, weekKey: "week1" });
  });

  it("skips earlier weeks at a different rep scheme and goes back to the last matching week", () => {
    // Viewing the 3+ week: cycle 9's 5+ week doesn't count; cycle 8's 3+ week (week 2) does.
    const withWeek2 = {
      ...client,
      loggedSetInputsByCycle: {
        ...client.loggedSetInputsByCycle,
        8: { ...client.loggedSetInputsByCycle![8], week2: { Squat: sets([170, 3], [195, 3], [215, 6]) } },
      },
    };
    expect(lookup({ client: withWeek2 })).toEqual({ weight: 215, reps: 6, cycleNumber: 8, weekKey: "week2" });
    expect(lookup()).toBeNull();
  });

  it("falls back to the previous cycle and skips its deload week", () => {
    expect(lookup({ weekKey: "week3" })).toEqual({ weight: 230, reps: 2, cycleNumber: 8, weekKey: "week3" });
  });

  it("keeps walking back cycles until it finds a logged week at the same rep scheme", () => {
    // Cycle 8 has no 3+ week logged, so it reaches cycle 7's 3+ week.
    const olderClient: Client = {
      ...client,
      loggedSetInputsByCycle: {
        ...client.loggedSetInputsByCycle,
        7: { week2: { Squat: sets([160, 3], [185, 3], [205, 5]) } },
      },
    };
    const allSchedules = { 7: schedule("1ct Pause Bench"), 8: schedule("1ct Pause Bench"), 9: schedule("1ct Pause Bench") };
    expect(lookup({ client: olderClient, cycleSchedulesByCycle: allSchedules, cycleSettingsByCycle: { 9: cycle } }))
      .toEqual({ weight: 205, reps: 5, cycleNumber: 7, weekKey: "week2" });
  });

  it("stops walking back at a cycle where the lift slot was a different movement", () => {
    const olderClient: Client = {
      ...client,
      loggedSetInputsByCycle: { ...client.loggedSetInputsByCycle, 7: { week2: { Press: sets([90, 3]) } } },
    };
    const schedules = { 7: schedule("1ct Pause Bench"), 8: schedule("Incline Press"), 9: schedule("1ct Pause Bench") };
    expect(lookup({ client: olderClient, lift: "Press", cycleSchedulesByCycle: schedules, currentSchedule: schedules[9] })).toBeNull();
  });

  it("uses the client's own rep-scheme assignments over the program's", () => {
    // This client did 3s in week 1 of cycle 8 (program says 5+), so that's their last 3-rep week.
    const assigned: Client = {
      ...client,
      weekAssignmentsByCycle: { 8: { week1: "3", week2: "5" } },
      loggedSetInputsByCycle: {
        ...client.loggedSetInputsByCycle,
        8: { ...client.loggedSetInputsByCycle![8], week1: { Squat: sets([180, 3], [210, 4]) }, week2: { Squat: sets([190, 9]) } },
      },
    };
    expect(lookup({ client: assigned })).toEqual({ weight: 210, reps: 4, cycleNumber: 8, weekKey: "week1" });
  });

  it("uses any non-deload week when the viewed week has no rep scheme", () => {
    expect(lookup({ cycleSettingsByCycle: { 8: cycle, 9: {} } })).toEqual({ weight: 200, reps: 8, cycleNumber: 9, weekKey: "week1" });
  });

  it("does not reach into the previous cycle when the lift slot trained a different movement", () => {
    expect(lookup({ weekKey: "week3", lift: "Press", previousCycleSchedule: schedule("Incline Press") })).toBeNull();
    expect(lookup({ weekKey: "week3", lift: "Press" })).toMatchObject({ weight: 100, reps: 5 });
  });

  it("returns nothing when there is no earlier log", () => {
    expect(lookup({ weekKey: "week1", lift: "Deadlift" })).toBeNull();
  });

  it("labels where the result came from", () => {
    expect(formatPreviousTopSet({ weight: 200, reps: 8, cycleNumber: 9, weekKey: "week1" }, 9)).toEqual({
      text: "Last 200 × 8",
      title: "Last logged top set at this rep scheme (week 1)",
    });
    expect(formatPreviousTopSet({ weight: 230, reps: 2, cycleNumber: 8, weekKey: "week3" }, 9).title).toContain("cycle 8, week 3");
  });
});

describe("getCalendarWeekKey", () => {
  const weekKeys = ["week3", "week1", "week4", "week2"];

  it("finds the week today falls in, counting 7-day blocks from the cycle start", () => {
    expect(getCalendarWeekKey(schedule("x"), weekKeys, new Date(2026, 9, 6))).toBe("week1");
    expect(getCalendarWeekKey(schedule("x"), weekKeys, new Date(2026, 9, 12))).toBe("week1");
    expect(getCalendarWeekKey(schedule("x"), weekKeys, new Date(2026, 9, 13))).toBe("week2");
    expect(getCalendarWeekKey(schedule("x"), weekKeys, new Date(2026, 9, 29))).toBe("week4");
  });

  it("returns nothing before the cycle starts, after it ends, or without a start date", () => {
    expect(getCalendarWeekKey(schedule("x"), weekKeys, new Date(2026, 9, 5))).toBeNull();
    expect(getCalendarWeekKey(schedule("x"), weekKeys, new Date(2026, 10, 3))).toBeNull();
    expect(getCalendarWeekKey(schedule("x", ""), weekKeys, new Date(2026, 9, 6))).toBeNull();
  });
});
