import { describe, expect, it } from "vitest";
import { buildGraduatedClient } from "@/lib/graduation";
import type { Client, CycleScheduleSettings, MovementProfile } from "@/lib/types";

const profile = (trainingMax: number, overrides: Partial<MovementProfile> = {}): MovementProfile => ({
  oneRepMax: trainingMax + 30,
  trainingMax,
  classType: 5,
  progressionIncrement: 5,
  progressionHoldActive: false,
  calibrationPhaseActive: false,
  movementCycleNumber: 1,
  ...overrides,
});

const schedule = {
  cycleStartDate: "2026-01-06",
  day1Weekday: "Tuesday",
  day2Weekday: "Thursday",
  liftDayAssignments: { Squat: "day2", Deadlift: "day1", Bench: "day1", Press: "day2" },
  liftDisplayNames: { Squat: "Squat", Deadlift: "Deadlift", Bench: "Bench", Press: "Incline Press" },
} as CycleScheduleSettings;

// Three logged weeks in the cycle = an established lift, not a calibration one.
const fullCycleLogs = (cycle: number) => ({
  [cycle]: {
    week1: { Squat: { 4: { weight: 100, reps: 5, updatedAt: "2026-01-06T00:00:00.000Z" } }, Bench: { 4: { weight: 100, reps: 5, updatedAt: "2026-01-06T00:00:00.000Z" } }, Deadlift: { 4: { weight: 100, reps: 5, updatedAt: "2026-01-06T00:00:00.000Z" } }, Press: { 4: { weight: 100, reps: 5, updatedAt: "2026-01-06T00:00:00.000Z" } } },
    week2: { Squat: { 4: { weight: 100, reps: 3, updatedAt: "2026-01-06T00:00:00.000Z" } } },
    week3: { Squat: { 4: { weight: 100, reps: 1, updatedAt: "2026-01-06T00:00:00.000Z" } } },
  },
});

const client = (overrides: Partial<Client> = {}): Client => ({
  id: "c1",
  name: "Graduate",
  oneRepMaxes: { Squat: 300, Bench: 200, Deadlift: 350, Press: 130 },
  trainingMaxes: { Squat: 270, Bench: 180, Deadlift: 315, Press: 110 },
  currentCycleNumber: 3,
  cycleMembership: [1, 2, 3],
  trainingMaxesByCycle: { 3: { Squat: 270, Bench: 180, Deadlift: 315, Press: 110 } },
  oneRepMaxesByCycle: { 3: { Squat: 300, Bench: 200, Deadlift: 350, Press: 130 } },
  weekAssignmentsByCycle: { 3: { week1: "5", week2: "3", week3: "1" } },
  loggedSetInputsByCycle: fullCycleLogs(3) as Client["loggedSetInputsByCycle"],
  movementProfilesByCycle: {
    3: {
      Squat: profile(270, { progressionIncrement: 10, classType: 10 }),
      Deadlift: profile(315, { progressionIncrement: 10, classType: 10 }),
      Bench: profile(180),
      "Incline Press": profile(110),
    },
  },
  ...overrides,
});

const graduate = (c: Client, params = {}) =>
  buildGraduatedClient(c, { currentCycleSchedule: schedule, now: "2026-02-03T00:00:00.000Z", ...params });

describe("buildGraduatedClient", () => {
  it("adds +10 to squat/deadlift and +5 to bench/press movements, and moves to the next cycle", () => {
    const next = graduate(client());
    const profiles = next.movementProfilesByCycle?.[4] || {};

    expect(next.currentCycleNumber).toBe(4);
    expect(next.cycleMembership).toEqual([1, 2, 3, 4]);
    expect(profiles.Squat.trainingMax).toBe(280);
    expect(profiles.Deadlift.trainingMax).toBe(325);
    expect(profiles.Bench.trainingMax).toBe(185);
    expect(profiles["Incline Press"].trainingMax).toBe(115);
    expect(next.weekAssignmentsByCycle?.[4]).toEqual({ week1: "5", week2: "3", week3: "1" });
  });

  it("keeps each lift slot's training max equal to its movement's", () => {
    const drifted = client({ trainingMaxesByCycle: { 3: { Squat: 170, Bench: 215, Deadlift: 185, Press: 165 } } });
    const next = graduate(drifted);

    expect(next.trainingMaxesByCycle?.[4]).toEqual({ Squat: 280, Bench: 185, Deadlift: 325, Press: 115 });
    expect(next.trainingMaxes).toEqual({ Squat: 280, Bench: 185, Deadlift: 325, Press: 115 });
    expect(next.oneRepMaxesByCycle?.[4]?.Squat).toBe(300);
  });

  it("does not raise a stored movement that was not trained this cycle", () => {
    const base = client();
    const withUnused = client({
      movementProfilesByCycle: { 3: { ...base.movementProfilesByCycle![3], "OH Press": profile(90) } },
    });
    const next = graduate(withUnused);

    expect(next.movementProfilesByCycle?.[4]?.["OH Press"].trainingMax).toBe(90);
    expect(next.movementProfilesByCycle?.[4]?.["Incline Press"].trainingMax).toBe(115);
  });

  it("holds a movement whose progression hold is on", () => {
    const base = client();
    const held = client({
      movementProfilesByCycle: { 3: { ...base.movementProfilesByCycle![3], Bench: profile(180, { progressionHoldActive: true }) } },
    });
    const next = graduate(held);

    expect(next.movementProfilesByCycle?.[4]?.Bench.trainingMax).toBe(180);
    expect(next.trainingMaxesByCycle?.[4]?.Bench).toBe(180);
  });

  it("does not let a leftover calibration flag hold a lift with a full cycle of logged history", () => {
    const base = client();
    const stale = client({
      movementProfilesByCycle: {
        3: { ...base.movementProfilesByCycle![3], Squat: profile(270, { progressionIncrement: 10, calibrationPhaseActive: true }) },
      },
    });
    const next = graduate(stale);

    expect(next.movementProfilesByCycle?.[4]?.Squat.trainingMax).toBe(280);
    expect(next.movementProfilesByCycle?.[4]?.Squat.calibrationPhaseActive).toBe(false);
  });

  it("holds a lift that is genuinely still calibrating (no logged history)", () => {
    const base = client();
    const calibrating = client({
      loggedSetInputsByCycle: {},
      movementProfilesByCycle: {
        3: { ...base.movementProfilesByCycle![3], Squat: profile(270, { progressionIncrement: 10, calibrationPhaseActive: true }) },
      },
    });
    const next = graduate(calibrating);

    expect(next.movementProfilesByCycle?.[4]?.Squat.trainingMax).toBe(270);
    expect(next.movementProfilesByCycle?.[4]?.Squat.calibrationPhaseActive).toBe(true);
  });

  it("blanks a lift slot whose movement changes next cycle so it calibrates", () => {
    const next = graduate(client(), { options: { noIncrementLifts: ["Press"], calibrationLifts: ["Press"] } });

    expect(next.trainingMaxesByCycle?.[4]?.Press).toBe(0);
    expect(next.oneRepMaxesByCycle?.[4]?.Press).toBe(0);
    expect(next.movementCalibrationsByCycle?.[4]?.Press).toEqual({ needsCalibration: true });
    expect(next.trainingMaxesByCycle?.[4]?.Bench).toBe(185);
  });

  it("uses the standard jumps when a client has no movement profiles", () => {
    const next = graduate(client({ movementProfilesByCycle: {} }));
    expect(next.trainingMaxesByCycle?.[4]).toEqual({ Squat: 280, Bench: 185, Deadlift: 325, Press: 115 });
  });

  it("brings a group member who fell behind up to the group's next cycle", () => {
    const base = client();
    const behind = client({
      activeGroupId: "g1",
      programStateByGroup: {
        g1: {
          currentCycleNumber: 3,
          cycleMembership: [1, 2, 3],
          weekAssignmentsByCycle: base.weekAssignmentsByCycle,
          loggedSetInputsByCycle: base.loggedSetInputsByCycle,
        },
      },
    });
    // The group is on cycle 5, so graduation moves everyone to cycle 6.
    const next = graduate(behind, { groupId: "g1", targetCycle: 6 });
    const state = next.programStateByGroup?.g1;

    expect(state?.currentCycleNumber).toBe(6);
    expect(state?.cycleMembership).toEqual([1, 2, 3, 6]);
    expect(state?.weekAssignmentsByCycle?.[6]).toEqual({ week1: "5", week2: "3", week3: "1" });
    expect(next.movementProfilesByCycle?.[6]?.Squat.trainingMax).toBe(280);
    expect(next.trainingMaxesByCycle?.[6]?.Squat).toBe(280);
  });

  it("graduates a member who fell behind from their most recent numbers", () => {
    const base = client();
    const behind = client({
      activeGroupId: "g1",
      programStateByGroup: { g1: { currentCycleNumber: 3, cycleMembership: [1, 2, 3] } },
      trainingMaxesByCycle: { ...base.trainingMaxesByCycle, 5: { Squat: 290, Bench: 190, Deadlift: 335, Press: 120 } },
      movementProfilesByCycle: {
        ...base.movementProfilesByCycle,
        5: { Squat: profile(290, { progressionIncrement: 10, progressionHoldActive: true }), Bench: profile(190) },
      },
    });
    const next = graduate(behind, { groupId: "g1", targetCycle: 6, groupCurrentCycle: 5 });

    expect(next.programStateByGroup?.g1?.currentCycleNumber).toBe(6);
    expect(next.movementProfilesByCycle?.[6]?.Squat.trainingMax).toBe(290);
    expect(next.movementProfilesByCycle?.[6]?.Bench.trainingMax).toBe(195);
    expect(next.trainingMaxesByCycle?.[6]?.Deadlift).toBe(345);
  });
});
