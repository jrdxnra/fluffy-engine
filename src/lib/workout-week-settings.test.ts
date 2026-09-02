import { describe, expect, it } from "vitest";
import type { CycleSettings } from "@/lib/types";
import { resolveWorkoutWeekSettings } from "@/lib/workout-week-settings";

describe("resolveWorkoutWeekSettings", () => {
  it("does not override week4 deload settings from assigned rep scheme", () => {
    const cycleSettings: CycleSettings = {
      week4: {
        name: "Week 4",
        percentages: {
          warmup1: 0.5,
          warmup2: 0.6,
          workset1: 0.4,
          workset2: 0.5,
          workset3: 0.6,
        },
        reps: {
          workset1: 5,
          workset2: 5,
          workset3: "5",
        },
      },
    };

    const resolved = resolveWorkoutWeekSettings(cycleSettings, "week4", "3");

    expect(resolved?.percentages.workset1).toBe(0.4);
    expect(resolved?.percentages.workset2).toBe(0.5);
    expect(resolved?.percentages.workset3).toBe(0.6);
    expect(resolved?.reps.workset3).toBe("5");
  });

  it("does not override named deload week settings outside week4", () => {
    const cycleSettings: CycleSettings = {
      week5: {
        name: "Recovery Deload",
        percentages: {
          warmup1: 0.5,
          warmup2: 0.6,
          workset1: 0.45,
          workset2: 0.55,
          workset3: 0.65,
        },
        reps: {
          workset1: 5,
          workset2: 5,
          workset3: "5",
        },
      },
    };

    const resolved = resolveWorkoutWeekSettings(cycleSettings, "week5", "1");

    expect(resolved?.percentages.workset1).toBe(0.45);
    expect(resolved?.percentages.workset2).toBe(0.55);
    expect(resolved?.percentages.workset3).toBe(0.65);
    expect(resolved?.reps.workset3).toBe("5");
  });

  it("still applies assigned rep scheme overrides for non-deload weeks", () => {
    const cycleSettings: CycleSettings = {
      week1: {
        name: "Week 1",
        percentages: {
          warmup1: 0.5,
          warmup2: 0.6,
          workset1: 0.65,
          workset2: 0.75,
          workset3: 0.85,
        },
        reps: {
          workset1: 5,
          workset2: 5,
          workset3: "5+",
        },
      },
    };

    const resolved = resolveWorkoutWeekSettings(cycleSettings, "week1", "3");

    expect(resolved?.percentages.warmup1).toBe(0.25);
    expect(resolved?.percentages.warmup2).toBe(0.35);
    expect(resolved?.percentages.workset1).toBe(0.7);
    expect(resolved?.percentages.workset2).toBe(0.8);
    expect(resolved?.percentages.workset3).toBe(0.9);
    expect(resolved?.reps.workset3).toBe("3+");
  });
});
