import { describe, expect, it } from "vitest";
import {
  buildOneRepMaxUpdate,
  getOneRepMaxSuggestion,
  getWorkoutOneRepMaxSuggestion,
} from "@/lib/one-rep-max-suggestion";
import type { Client, CycleWeekSettings, LoggedSetMap, MovementProfile } from "@/lib/types";

const at = "2026-10-06T00:00:00.000Z";
const logged = (weight: number, reps: number): LoggedSetMap => ({ 4: { weight, reps, updatedAt: at } });
const profile = (oneRepMax: number, trainingMax: number, extra: Partial<MovementProfile> = {}): MovementProfile => ({
  oneRepMax,
  trainingMax,
  classType: 10,
  progressionIncrement: 10,
  movementCycleNumber: 9,
  calibrationPhaseActive: false,
  ...extra,
});
const suggest = (sets: LoggedSetMap, p: MovementProfile | null) =>
  getOneRepMaxSuggestion({ movementName: "Squat", sourceKey: "9:week1", loggedSets: sets, profile: p });

describe("getOneRepMaxSuggestion", () => {
  it("offers nothing when the lifter just hits the prescribed reps", () => {
    // 1RM 300, TM 270, week 1 top set 230 x 5 -> estimate 268.
    expect(suggest(logged(230, 5), profile(300, 270))).toBeNull();
  });

  it("offers nothing for a small beat (under 5% over the stored 1RM)", () => {
    // 230 x 10 -> 307, only 2% over 300.
    expect(suggest(logged(230, 10), profile(300, 270))).toBeNull();
  });

  it("offers the full estimate when it is within the 10% cap", () => {
    // 230 x 12 -> 322 -> 1RM 320, TM 290 (cap would be 295).
    const result = suggest(logged(230, 12), profile(300, 270));
    expect(result).toMatchObject({ suggestedOneRepMax: 320, suggestedTrainingMax: 290, capped: false, weight: 230, reps: 12 });
  });

  it("caps the increase at 10% of the training max", () => {
    // 185 x 10 -> 247 -> uncapped TM 220, but 190 x 1.1 = 210.
    const result = suggest(logged(185, 10), profile(210, 190));
    expect(result).toMatchObject({ suggestedTrainingMax: 210, suggestedOneRepMax: 235, capped: true, estimatedOneRepMax: 247 });
  });

  it("never suggests a training max above 90% of the suggested 1RM", () => {
    const result = suggest(logged(225, 11), profile(240, 215))!;
    expect(result.suggestedTrainingMax).toBeLessThanOrEqual(result.suggestedOneRepMax * 0.9 + 0.001);
  });

  it("uses the best logged set, not just the last one", () => {
    const sets: LoggedSetMap = { 3: { weight: 230, reps: 12, updatedAt: at }, 4: { weight: 235, reps: 1, updatedAt: at } };
    expect(suggest(sets, profile(300, 270))?.reps).toBe(12);
  });

  it("offers nothing without stored numbers (calibration handles that) or without logged sets", () => {
    expect(suggest(logged(230, 12), profile(0, 0))).toBeNull();
    expect(suggest(logged(230, 12), null)).toBeNull();
    expect(suggest({}, profile(300, 270))).toBeNull();
  });

  it("offers only one update per logged session", () => {
    expect(suggest(logged(185, 10), profile(235, 210, { lastPerformanceUpdateKey: "9:week1" }))).toBeNull();
  });
});

const week1: CycleWeekSettings = {
  name: "Week 1",
  percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.65, workset2: 0.75, workset3: 0.85 },
  reps: { workset1: 5, workset2: 5, workset3: "5+" },
};
const deload: CycleWeekSettings = {
  name: "Deload",
  percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.4, workset2: 0.5, workset3: 0.6 },
  reps: { workset1: 5, workset2: 5, workset3: "5" },
};
const lifter = (): Client => ({
  id: "c1",
  name: "Lifter",
  oneRepMaxes: { Squat: 210, Bench: 150, Deadlift: 250, Press: 100 },
  trainingMaxes: { Squat: 190, Bench: 135, Deadlift: 225, Press: 90 },
  oneRepMaxesByCycle: { 9: { Squat: 210, Bench: 150, Deadlift: 250, Press: 100 } },
  trainingMaxesByCycle: { 9: { Squat: 190, Bench: 135, Deadlift: 225, Press: 90 } },
  movementProfilesByCycle: { 9: { Squat: profile(210, 190, { progressionHoldActive: true }) } },
  loggedSetInputsByCycle: { 9: { week1: { Squat: logged(185, 10) }, week4: { Squat: logged(185, 10) } } },
});

describe("getWorkoutOneRepMaxSuggestion", () => {
  const base = { client: lifter(), cycleNumber: 9, lift: "Squat" as const };

  it("flags a normal week where a logged set beats the stored numbers", () => {
    const result = getWorkoutOneRepMaxSuggestion({ ...base, weekKey: "week1", weekSettings: week1, sessionMode: "normal" });
    expect(result).toMatchObject({ movementName: "Squat", sourceKey: "9:week1", suggestedTrainingMax: 210 });
  });

  it("stays quiet on deload weeks and modified sessions", () => {
    expect(getWorkoutOneRepMaxSuggestion({ ...base, weekKey: "week4", weekSettings: deload, sessionMode: "normal" })).toBeNull();
    expect(getWorkoutOneRepMaxSuggestion({ ...base, weekKey: "week1", weekSettings: week1, sessionMode: "recovery" })).toBeNull();
  });
});

describe("buildOneRepMaxUpdate", () => {
  it("updates the movement, the lift slot and the top-level numbers together, and nothing else", () => {
    const client = lifter();
    const suggestion = getWorkoutOneRepMaxSuggestion({ client, cycleNumber: 9, lift: "Squat", weekKey: "week1", weekSettings: week1, sessionMode: "normal" })!;
    const update = buildOneRepMaxUpdate(client, 9, "Squat", suggestion, at);
    const squat = update.movementProfilesByCycle?.[9]?.Squat;

    expect(squat).toMatchObject({ oneRepMax: 235, trainingMax: 210, lastPerformanceUpdateKey: "9:week1", progressionHoldActive: true });
    expect(update.trainingMaxesByCycle?.[9]).toEqual({ Squat: 210, Bench: 135, Deadlift: 225, Press: 90 });
    expect(update.oneRepMaxesByCycle?.[9]).toEqual({ Squat: 235, Bench: 150, Deadlift: 250, Press: 100 });
    expect(update.trainingMaxes.Squat).toBe(210);
    expect(update.oneRepMaxes.Squat).toBe(235);

    // The same logged session can't be used to step past the cap.
    const after = { ...client, ...update };
    expect(getWorkoutOneRepMaxSuggestion({ client: after, cycleNumber: 9, lift: "Squat", weekKey: "week1", weekSettings: week1, sessionMode: "normal" })).toBeNull();
  });
});
