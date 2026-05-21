import { describe, expect, it } from "vitest";
import type { CycleSettings } from "@/lib/types";
import { normalizeCycleSettingsByCycle } from "@/lib/cycle-settings-normalizer";

describe("normalizeCycleSettingsByCycle", () => {
  it("does not overwrite deload week percentages and reps", () => {
    const input: Record<number, CycleSettings> = {
      2: {
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
      } as CycleSettings,
    };

    const result = normalizeCycleSettingsByCycle(input);
    const week4 = result.normalized[2].week4;

    expect(week4.percentages.workset1).toBe(0.4);
    expect(week4.percentages.workset2).toBe(0.5);
    expect(week4.percentages.workset3).toBe(0.6);
    expect(week4.reps.workset3).toBe("5");
    expect(result.changed).toBe(false);
  });

  it("normalizes non-deload 5s week templates", () => {
    const input: Record<number, CycleSettings> = {
      1: {
        week1: {
          name: "Week 1",
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
      } as CycleSettings,
    };

    const result = normalizeCycleSettingsByCycle(input);
    const week1 = result.normalized[1].week1;

    expect(week1.percentages.workset1).toBe(0.65);
    expect(week1.percentages.workset2).toBe(0.75);
    expect(week1.percentages.workset3).toBe(0.85);
    expect(week1.reps.workset3).toBe("5+");
    expect(result.changed).toBe(true);
  });

  it("keeps explicit deload week by name even when not week4", () => {
    const input: Record<number, CycleSettings> = {
      1: {
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
      } as CycleSettings,
    };

    const result = normalizeCycleSettingsByCycle(input);
    const week5 = result.normalized[1].week5;

    expect(week5.percentages.workset1).toBe(0.45);
    expect(week5.percentages.workset2).toBe(0.55);
    expect(week5.percentages.workset3).toBe(0.65);
    expect(week5.reps.workset3).toBe("5");
    expect(result.changed).toBe(false);
  });

  it("keeps duplicated deload template on non-week4 keys", () => {
    const input: Record<number, CycleSettings> = {
      2: {
        week5: {
          name: "Week 5",
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
      } as CycleSettings,
    };

    const result = normalizeCycleSettingsByCycle(input);
    const week5 = result.normalized[2].week5;

    expect(week5.percentages.workset1).toBe(0.4);
    expect(week5.percentages.workset2).toBe(0.5);
    expect(week5.percentages.workset3).toBe(0.6);
    expect(week5.reps.workset3).toBe("5");
    expect(result.changed).toBe(false);
  });
});
