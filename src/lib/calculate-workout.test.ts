import { describe, expect, it } from "vitest";
import { calculateWorkout } from "@/lib/utils";
import type { Client, CycleWeekSettings } from "@/lib/types";

describe("calculateWorkout", () => {
  it("uses 90%-based fallback TM in cycle 1 when stored TM exceeds 1RM", () => {
    const client: Client = {
      id: "c1",
      name: "Devon",
      oneRepMaxes: { Squat: 201, Bench: 172, Deadlift: 263, Press: 74 },
      trainingMaxes: { Squat: 221, Bench: 182, Deadlift: 283, Press: 84 },
      trainingMaxesByCycle: {
        1: { Squat: 221, Bench: 182, Deadlift: 283, Press: 84 },
      },
    };

    const weekSettings: CycleWeekSettings = {
      name: "Week 1",
      percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.65, workset2: 0.75, workset3: 0.85 },
      reps: { workset1: 5, workset2: 5, workset3: "5+" },
    };

    const workout = calculateWorkout(client, "Deadlift", weekSettings, [], 1);

    expect(workout.sets[0].weight).toBe(120);
    expect(workout.sets[1].weight).toBe(140);
    expect(workout.sets[4].weight).toBe(200);
  });

  it("derives missing cycle max from nearest prior cycle instead of stale global fallback", () => {
    const client: Client = {
      id: "c2",
      name: "Michelle",
      oneRepMaxes: { Squat: 260, Bench: 180, Deadlift: 300, Press: 120 },
      // Stale global fallback that should NOT drive cycle 2 if cycle 1 exists.
      trainingMaxes: { Squat: 180, Bench: 125, Deadlift: 210, Press: 85 },
      trainingMaxesByCycle: {
        1: { Squat: 250, Bench: 170, Deadlift: 290, Press: 115 },
      },
    };

    const weekSettings: CycleWeekSettings = {
      name: "Week 1",
      percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.65, workset2: 0.75, workset3: 0.85 },
      reps: { workset1: 5, workset2: 5, workset3: "5+" },
    };

    const cycle2Deadlift = calculateWorkout(client, "Deadlift", weekSettings, [], 2);
    // Expected TM: cycle1 deadlift 290 + 10 = 300; top set = 300 * 0.85 = 255.
    expect(cycle2Deadlift.sets[4].weight).toBe(255);
  });
});
