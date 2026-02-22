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
});
