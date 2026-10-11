import { describe, expect, it } from "vitest";
import { hasCycleStrengthData, normalizeClientForProfileSave } from "@/lib/client-profile-save";
import { calculateWorkout } from "@/lib/utils";
import type { Client, CycleWeekSettings } from "@/lib/types";

const baseClient = (overrides: Partial<Client> = {}): Client => ({
  id: "c1",
  name: "Test Client",
  oneRepMaxes: { Squat: 300, Bench: 200, Deadlift: 350, Press: 120 },
  trainingMaxes: { Squat: 270, Bench: 180, Deadlift: 315, Press: 110 },
  ...overrides,
});

describe("normalizeClientForProfileSave", () => {
  it("keeps a hand-set training max instead of recalculating 90% of the 1RM", () => {
    const saved = normalizeClientForProfileSave(baseClient({
      currentCycleNumber: 3,
      cycleMembership: [1, 2, 3],
      oneRepMaxesByCycle: { 3: { Squat: 300, Bench: 200, Deadlift: 350, Press: 120 } },
      trainingMaxesByCycle: { 3: { Squat: 290, Bench: 190, Deadlift: 335, Press: 100 } },
    }));

    expect(saved.trainingMaxesByCycle?.[3]).toEqual({ Squat: 290, Bench: 190, Deadlift: 335, Press: 100 });
    expect(saved.trainingMaxes).toEqual({ Squat: 290, Bench: 190, Deadlift: 335, Press: 100 });
  });

  it("does not zero a training max when the 1RM is blank", () => {
    const saved = normalizeClientForProfileSave(baseClient({
      currentCycleNumber: 2,
      cycleMembership: [1, 2],
      oneRepMaxesByCycle: { 2: { Squat: 0, Bench: 200, Deadlift: 0, Press: 0 } },
      trainingMaxesByCycle: { 2: { Squat: 250, Bench: 180, Deadlift: 300, Press: 100 } },
    }));

    expect(saved.trainingMaxesByCycle?.[2]).toEqual({ Squat: 250, Bench: 180, Deadlift: 300, Press: 100 });
  });

  it("leaves other cycles' training maxes untouched", () => {
    const saved = normalizeClientForProfileSave(baseClient({
      currentCycleNumber: 1,
      cycleMembership: [1, 2],
      oneRepMaxesByCycle: { 1: { Squat: 300, Bench: 200, Deadlift: 350, Press: 120 } },
      trainingMaxesByCycle: {
        1: { Squat: 270, Bench: 180, Deadlift: 315, Press: 110 },
        2: { Squat: 275, Bench: 180, Deadlift: 325, Press: 110 },
      },
    }));

    expect(saved.trainingMaxesByCycle?.[2]).toEqual({ Squat: 275, Bench: 180, Deadlift: 325, Press: 110 });
  });

  it("puts a brand-new client on Cycle 1 and derives their first training maxes", () => {
    const saved = normalizeClientForProfileSave(baseClient({ trainingMaxes: { Squat: 0, Bench: 0, Deadlift: 0, Press: 0 } }));

    expect(saved.currentCycleNumber).toBe(1);
    expect(saved.cycleMembership).toEqual([1]);
    expect(saved.oneRepMaxesByCycle?.[1]).toEqual({ Squat: 300, Bench: 200, Deadlift: 350, Press: 120 });
    expect(saved.trainingMaxesByCycle?.[1]).toEqual({ Squat: 270, Bench: 180, Deadlift: 315, Press: 110 });
    expect(Object.keys(saved.oneRepMaxesByCycle || {})).toEqual(["1"]);
  });
});

describe("hasCycleStrengthData", () => {
  it("is false for a cycle the client has nothing stored in", () => {
    const client = baseClient({ trainingMaxesByCycle: { 7: { Squat: 270, Bench: 180, Deadlift: 315, Press: 110 } } });
    expect(hasCycleStrengthData(client, 7)).toBe(true);
    expect(hasCycleStrengthData(client, 8)).toBe(false);
  });
});

describe("calculateWorkout with a movement training max", () => {
  const client = baseClient({ trainingMaxesByCycle: { 7: { Squat: 270, Bench: 180, Deadlift: 315, Press: 110 } } });
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
  const inclinePress = { oneRepMaxOverride: 115, trainingMaxOverride: 100 };

  it("uses the movement's training max on a normal week", () => {
    const workout = calculateWorkout(client, "Press", week1, [], 7, inclinePress);
    expect(workout.sets.map((set) => set.weight)).toEqual([50, 60, 65, 75, 85]);
  });

  it("uses the same training max on a deload week, not the lift-level one", () => {
    const workout = calculateWorkout(client, "Press", deload, [], 7, inclinePress);
    expect(workout.trainingMax).toBe(100);
    expect(workout.sets.map((set) => set.weight)).toEqual([50, 60, 40, 50, 60]);
  });

  it("does not wipe the workout when the movement's 1RM is blank", () => {
    const workout = calculateWorkout(client, "Press", week1, [], 7, { oneRepMaxOverride: 0, trainingMaxOverride: 100 });
    expect(workout.sets.map((set) => set.weight)).toEqual([50, 60, 65, 75, 85]);
  });
});
