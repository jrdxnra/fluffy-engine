import { describe, expect, it } from "vitest";
import { buildDayCopyText, buildLiftCopyText, buildMonthCopy, buildMonthSessions, sessionDateLabel } from "@/lib/session-copy";
import { calculateClientLiftWorkout } from "@/lib/client-workout";
import type { CalculatedWorkout, Client, CycleScheduleSettings, CycleSettings, CycleWeekSettings, Lift, LoggedSetMap } from "@/lib/types";

const at = "2026-10-06T00:00:00.000Z";
const logged = (...pairs: Array<[number, number]>): LoggedSetMap =>
  Object.fromEntries(pairs.map(([weight, reps], index) => [String(index + 2), { weight, reps, updatedAt: at }]));
const week = (name: string, work: [number, number, number], top: string): CycleWeekSettings => ({
  name,
  percentages: { warmup1: 0.5, warmup2: 0.6, workset1: work[0], workset2: work[1], workset3: work[2] },
  reps: { workset1: 5, workset2: 5, workset3: top },
  accessories: {
    Squat: ["Front Squat"],
    Bench: ["Close Grip Bench"],
    Deadlift: ["Back Extension"],
    Press: ["JM Press", "French Press"],
  },
});
const cycle: CycleSettings = {
  week1: week("Week 1", [0.65, 0.75, 0.85], "5+"),
  week2: week("Week 2", [0.7, 0.8, 0.9], "3+"),
  week3: week("Week 3", [0.75, 0.85, 0.95], "1+"),
  week4: week("Deload", [0.4, 0.5, 0.6], "5"),
};
const schedule = (start: string, press = "OH Press"): CycleScheduleSettings =>
  ({
    cycleStartDate: start,
    day1Weekday: "Tuesday",
    day2Weekday: "Thursday",
    liftDayAssignments: { Deadlift: "day1", Bench: "day1", Squat: "day2", Press: "day2" },
    liftDisplayNames: { Squat: "Squat", Deadlift: "Deadlift", Bench: "Bench", Press: press },
  }) as CycleScheduleSettings;

const maxes = { Squat: 300, Bench: 200, Deadlift: 400, Press: 100 };
const client: Client = {
  id: "c1",
  name: "Lifter",
  oneRepMaxes: maxes,
  trainingMaxes: { Squat: 270, Bench: 180, Deadlift: 360, Press: 90 },
  currentCycleNumber: 9,
  cycleMembership: [8, 9],
  movementSelectionByCycle: { 8: { Deadlift: "Hex Bar Deadlift" }, 9: { Deadlift: "Hex Bar Deadlift" } },
  loggedSetInputsByCycle: {
    9: { week1: { Deadlift: logged([235, 5], [270, 5], [305, 9]) } },
  },
};

const program = (weekKey: string, press = "OH Press") => ({
  cycleNumber: 9,
  weekKey,
  cycleSettings: cycle,
  schedule: schedule("2026-10-06", press),
});
const workoutFor = (lift: Lift, weekKey = "week1", press = "OH Press"): CalculatedWorkout =>
  calculateClientLiftWorkout({ client, lift, weekKey, cycleNumber: 9, cycleSettings: cycle, schedule: schedule("2026-10-06", press), historicalData: [] });

describe("copy text", () => {
  it("uses the lifter's movement name once, without rewriting accessory names", () => {
    const text = buildDayCopyText({
      clientId: "c1",
      dayLifts: ["Squat", "Press"],
      workoutsByLift: { Squat: [workoutFor("Squat")], Press: [workoutFor("Press", "week1", "1ct Pause Bench")] },
      program: program("week1", "1ct Pause Bench"),
      dateLabel: "Thursday (Oct 9)",
    });
    expect(text.split("\n")[0]).toBe("Squat + 1ct Pause Bench Thursday (Oct 9)");
    expect(text).toContain("WORKING SETS: 1CT PAUSE BENCH");
    expect(text).toContain("JM Press\t");
    expect(text).toContain("French Press\t");
    expect(text).toContain("Front Squat\t");
    expect(text).not.toContain("1ct Pause Bench Press");
  });

  it("does not double a name that contains the lift's own word", () => {
    const text = buildDayCopyText({
      clientId: "c1",
      dayLifts: ["Deadlift", "Bench"],
      workoutsByLift: { Deadlift: [workoutFor("Deadlift")], Bench: [workoutFor("Bench")] },
      program: program("week1"),
      dateLabel: "Tuesday (Oct 7)",
    });
    expect(text.split("\n")[0]).toBe("Hex Bar Deadlift + Bench Tuesday (Oct 7)");
    expect(text).not.toContain("Hex Bar Hex Bar");
    // The logged top set fills the actual columns; week 1 of calibration has no prescribed load.
    expect(text).toContain("Hex Bar Deadlift\t1\t5+\t\t9\t305");
  });

  it("shows OH Press once in the lift view and follows the warm-up toggle", () => {
    const base = { workout: workoutFor("Press"), lift: "Press" as Lift, program: program("week1"), dateLabel: "Thursday (Oct 9)" };
    const withoutWarmups = buildLiftCopyText({ ...base, includeWarmups: false });
    expect(withoutWarmups.split("\n")[0]).toBe("OH Press Thursday (Oct 9)");
    expect(withoutWarmups).not.toContain("Warm-up");
    expect(withoutWarmups).toContain("\n\nMain Sets\n");
    expect(withoutWarmups).toContain("- JM Press");
    expect(buildLiftCopyText({ ...base, includeWarmups: true })).toContain("Warm-up 1:");
  });

  it("includes numbers typed but not saved yet", () => {
    const text = buildLiftCopyText({
      workout: workoutFor("Press"),
      lift: "Press",
      program: program("week1"),
      includeWarmups: false,
      unsavedActuals: { "4": { weight: 80, reps: 7 } },
    });
    expect(text).toContain("Logged Actuals\nTop Set: 80 lbs x 7");
  });

  it("labels a session date from the schedule", () => {
    expect(sessionDateLabel(schedule("2026-10-06"), "week2", "day2")).toBe("Thursday (Oct 15)");
  });
});

describe("month so far", () => {
  const today = new Date(2026, 9, 15); // Thursday 15 October 2026
  const args = {
    client,
    cycleSettingsByCycle: { 8: cycle, 9: cycle },
    schedulesByCycle: { 8: schedule("2026-09-08"), 9: schedule("2026-10-06") },
    historicalData: [],
    today,
  };

  it("collects every session from the 1st to today, across cycles", () => {
    const sessions = buildMonthSessions(args);
    expect(sessions.map((session) => `${session.date} ${session.label}`)).toEqual([
      "2026-10-01 Cycle 8 · Deload (5)",
      "2026-10-06 Cycle 9 · Week 1 (5+)",
      "2026-10-08 Cycle 9 · Week 1 (5+)",
      "2026-10-13 Cycle 9 · Week 2 (3+)",
      "2026-10-15 Cycle 9 · Week 2 (3+)",
    ]);
    expect(sessions[1].lifts.map((lift) => lift.name)).toEqual(["Hex Bar Deadlift", "Bench"]);
  });

  it("leaves out a skipped deload week and cycles the lifter was not on", () => {
    const skipped = buildMonthSessions({
      ...args,
      schedulesByCycle: { 8: { ...schedule("2026-09-08"), skipDeloadWeek: true }, 9: schedule("2026-10-06") },
    });
    expect(skipped[0].date).toBe("2026-10-06");
    const notOnEight = buildMonthSessions({ ...args, client: { ...client, cycleMembership: [9] } });
    expect(notOnEight[0].date).toBe("2026-10-06");
  });

  it("lays the month out a week to a row, one column per training day", () => {
    const copied = buildMonthCopy(args);
    expect(copied.sessionCount).toBe(5);
    const lines = copied.plain.split("\n");
    expect(lines[0]).toBe("Lifter · October 2026 so far (to Oct 15)");
    expect(copied.plain).toContain("Tue 10/6 · Cycle 9 · Week 1 (5+)");
    // Tuesday and Thursday side by side on one row.
    const dateRow = lines.find((line) => line.startsWith("Tue 10/13"));
    expect(dateRow?.split("\t").filter(Boolean)).toEqual(["Tue 10/13 · Cycle 9 · Week 2 (3+)", "Thu 10/15 · Cycle 9 · Week 2 (3+)"]);
    expect(copied.plain).toContain("Hex Bar Deadlift\t1\t5+\t\t9\t305");
    expect(copied.rich.startsWith("<table")).toBe(true);
  });
});
