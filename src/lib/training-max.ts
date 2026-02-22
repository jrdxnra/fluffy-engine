import type { Lift, TrainingMaxes } from "@/lib/types";
import { mround } from "@/lib/utils";

export const calculateTrainingMax = (oneRepMax: number): number => {
  return mround(oneRepMax * 0.9);
};

export const calculateTrainingMaxes = (
  oneRepMaxes: TrainingMaxes,
  lifts: Lift[] = ["Squat", "Bench", "Deadlift", "Press"]
): TrainingMaxes => {
  return lifts.reduce((acc, lift) => {
    acc[lift] = calculateTrainingMax(oneRepMaxes[lift]);
    return acc;
  }, {} as TrainingMaxes);
};
