import { describe, expect, it } from "vitest";
import { resolveVisibleAccessories } from "@/lib/accessory-utils";
import type { CycleSettings } from "@/lib/types";

describe("resolveVisibleAccessories", () => {
  it("falls back to week1 visibility selections when week2 has no explicit visibility map", () => {
    const cycleSettings: CycleSettings = {
      week1: {
        name: "Week 1",
        percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.65, workset2: 0.75, workset3: 0.85 },
        reps: { workset1: 5, workset2: 5, workset3: "5+" },
        accessories: {
          Deadlift: ["2X6 Pull Up Variation", "Romanian Deads", "2X10 Hip Thrusts", "2X10 Farmer Walk"],
          Bench: ["Incline Bench", "2X10 Leg Raises", "2X10 Skull Crushers"],
        },
        accessoryVisibility: {
          Deadlift: {
            "2X6 Pull Up Variation": true,
            "Romanian Deads": false,
            "2X10 Hip Thrusts": true,
            "2X10 Farmer Walk": true,
          },
          Bench: {
            "Incline Bench": false,
            "2X10 Leg Raises": true,
            "2X10 Skull Crushers": true,
          },
        },
      },
      week2: {
        name: "Week 2",
        percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.7, workset2: 0.8, workset3: 0.9 },
        reps: { workset1: 3, workset2: 3, workset3: "3+" },
        accessories: {
          Deadlift: ["Romanian Deads", "Stiff Leg Deads", "Hip Thrusts", "Farmer Walk", "Pull Up Variation"],
          Bench: ["Incline Bench", "Leg Raises", "Bar Hang"],
        },
      },
    };

    expect(resolveVisibleAccessories(cycleSettings, "week2", "Deadlift")).toEqual([
      "Pull Up Variation",
      "Hip Thrusts",
      "Farmer Walk",
    ]);

    expect(resolveVisibleAccessories(cycleSettings, "week2", "Bench")).toEqual([
      "Leg Raises",
      "Skull Crushers",
    ]);
  });
});
