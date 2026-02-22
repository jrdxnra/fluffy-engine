import { describe, expect, it } from "vitest";
import { calculateTrainingMax, calculateTrainingMaxes } from "@/lib/training-max";

describe("training max calculations", () => {
  it("calculates 90% of 1RM rounded to nearest 5", () => {
    expect(calculateTrainingMax(263)).toBe(235);
    expect(calculateTrainingMax(196)).toBe(175);
  });

  it("calculates lift map from one-rep maxes", () => {
    const result = calculateTrainingMaxes({
      Squat: 292,
      Bench: 196,
      Deadlift: 263,
      Press: 109,
    });

    expect(result).toEqual({
      Squat: 265,
      Bench: 175,
      Deadlift: 235,
      Press: 100,
    });
  });
});
