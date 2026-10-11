import { describe, expect, it } from "vitest";
import { calculateWorkout } from "@/lib/utils";
import { calculateTrainingMax } from "@/lib/training-max";
import type { Client, CycleWeekSettings, Lift } from "@/lib/types";

// The site's own rules, as written in docs/program-rules.md. If a test here fails,
// either the site broke a rule or the rule changed on purpose - update both together.
const warmups = { warmup1: 0.5, warmup2: 0.6 };
const weeks: Record<string, CycleWeekSettings> = {
  week1: { name: "Week 1", percentages: { ...warmups, workset1: 0.65, workset2: 0.75, workset3: 0.85 }, reps: { workset1: 5, workset2: 5, workset3: "5+" } },
  week2: { name: "Week 2", percentages: { ...warmups, workset1: 0.7, workset2: 0.8, workset3: 0.9 }, reps: { workset1: 3, workset2: 3, workset3: "3+" } },
  week3: { name: "Week 3", percentages: { ...warmups, workset1: 0.75, workset2: 0.85, workset3: 0.95 }, reps: { workset1: 5, workset2: 3, workset3: "1+" } },
  week4: { name: "Deload", percentages: { ...warmups, workset1: 0.4, workset2: 0.5, workset3: 0.6 }, reps: { workset1: 5, workset2: 5, workset3: "5" } },
};

// Worked examples: [warm-up 1, warm-up 2, work set 1, work set 2, top set] per week.
const workedExamples: Array<{ lift: Lift; oneRepMax: number; trainingMax: number; weights: Record<string, number[]> }> = [
  {
    lift: "Bench", oneRepMax: 200, trainingMax: 180,
    weights: { week1: [90, 110, 115, 135, 155], week2: [90, 110, 125, 145, 160], week3: [90, 110, 135, 155, 170], week4: [90, 110, 70, 90, 110] },
  },
  {
    lift: "Deadlift", oneRepMax: 300, trainingMax: 270,
    weights: { week1: [135, 160, 175, 205, 230], week2: [135, 160, 190, 215, 245], week3: [135, 160, 205, 230, 255], week4: [135, 160, 110, 135, 160] },
  },
  {
    lift: "Squat", oneRepMax: 250, trainingMax: 225,
    weights: { week1: [115, 135, 145, 170, 190], week2: [115, 135, 160, 180, 205], week3: [115, 135, 170, 190, 215], week4: [115, 135, 90, 115, 135] },
  },
];

const clientFor = (lift: Lift, oneRepMax: number, trainingMax: number): Client => {
  const zero = { Squat: 0, Bench: 0, Deadlift: 0, Press: 0 };
  return {
    id: "rules",
    name: "Rules Example",
    oneRepMaxes: { ...zero, [lift]: oneRepMax },
    trainingMaxes: { ...zero, [lift]: trainingMax },
    trainingMaxesByCycle: { 1: { ...zero, [lift]: trainingMax } },
  };
};

describe("program rules: training max", () => {
  it.each(workedExamples)("$lift: 90% of a $oneRepMax 1RM is $trainingMax", ({ oneRepMax, trainingMax }) => {
    expect(calculateTrainingMax(oneRepMax)).toBe(trainingMax);
  });
});

describe("program rules: week structure", () => {
  for (const example of workedExamples) {
    for (const [weekKey, expected] of Object.entries(example.weights)) {
      it(`${example.lift} ${weekKey} at training max ${example.trainingMax}`, () => {
        const workout = calculateWorkout(
          clientFor(example.lift, example.oneRepMax, example.trainingMax),
          example.lift,
          weeks[weekKey],
          [],
          1
        );
        expect(workout.sets.map((set) => set.weight)).toEqual(expected);
      });
    }
  }

  it("always prescribes exactly two warm-up sets of 5 reps", () => {
    const workout = calculateWorkout(clientFor("Bench", 200, 180), "Bench", weeks.week1, [], 1);
    const warmupSets = workout.sets.filter((set) => set.type === "Warm-up");
    expect(warmupSets.map((set) => set.reps)).toEqual([5, 5]);
  });

  it("has an all-out top set on weeks 1-3 and none on deload", () => {
    const topSetReps = (weekKey: string) =>
      calculateWorkout(clientFor("Bench", 200, 180), "Bench", weeks[weekKey], [], 1).sets[4].reps;
    expect([topSetReps("week1"), topSetReps("week2"), topSetReps("week3")]).toEqual(["5+", "3+", "1+"]);
    expect(String(topSetReps("week4"))).not.toContain("+");
  });
});
