import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CalculatedWorkout, Client, CycleWeekSettings, HistoricalRecord, Lift, WorkoutSet } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Rounds a number to the nearest 5.
 * @param {number} num The number to round.
 * @returns {number} The rounded number.
 */
export const mround = (num: number) => {
  return Math.round(num / 5) * 5;
};

/**
 * Calculates the plate loading for one side of a barbell.
 * @param {number} weight The total weight on the bar.
 * @returns {string} A string representing the plates, e.g., "45, 25, 5".
 */
export const calculatePlates = (weight: number): string => {
  if (weight <= 45) return "";
  const plates = [45, 25, 10, 5, 2.5];
  let weightPerSide = (weight - 45) / 2;
  const result: number[] = [];

  for (const plate of plates) {
    while (weightPerSide >= plate) {
      result.push(plate);
      weightPerSide -= plate;
    }
  }

  return result.join(", ");
};

/**
 * Calculates estimated 1-Rep Max using the Epley formula.
 * @param {number} weight The weight lifted.
 * @param {number} reps The number of reps performed.
 * @returns {number} The estimated 1RM.
 */
export const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};

/**
 * Calculates the reps needed to beat a target 1RM.
 * @param {number} target1RM The 1RM to beat.
 * @param {number} currentWeight The weight for the upcoming set.
 * @returns {number} The number of reps required.
 */
export const calculateRepsForPR = (target1RM: number, currentWeight: number): number => {
    if (currentWeight <= 0) return 0;
    const requiredRatio = target1RM / currentWeight;
    if (requiredRatio <= 1) return 1;
    return Math.ceil((requiredRatio - 1) * 30);
};

export const calculateWorkout = (
  client: Client,
  lift: Lift,
  weekSettings: CycleWeekSettings,
  historicalData: HistoricalRecord[]
): CalculatedWorkout => {
  const tm = client.trainingMaxes[lift];
  
  const sets: WorkoutSet[] = [
    { type: 'Warm-up', set: 1, label: 'Warm-up 1', weight: mround(tm * weekSettings.percentages.warmup1), reps: 5, plates: ''},
    { type: 'Warm-up', set: 2, label: 'Warm-up 2', weight: mround(tm * weekSettings.percentages.warmup2), reps: 5, plates: ''},
    { type: 'Work Set', set: 1, label: 'Work Set 1', weight: mround(tm * weekSettings.percentages.workset1), reps: weekSettings.reps.workset1, plates: '' },
    { type: 'Work Set', set: 2, label: 'Work Set 2', weight: mround(tm * weekSettings.percentages.workset2), reps: weekSettings.reps.workset2, plates: '' },
    { type: 'Work Set', set: 3, label: 'Top Set', weight: mround(tm * weekSettings.percentages.workset3), reps: weekSettings.reps.workset3, plates: '' },
  ];

  sets.forEach(set => {
    set.plates = calculatePlates(set.weight);
  });

  // Calculate PR Target
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const lastMonthRecords = historicalData.filter(r => 
    r.clientId === client.id && 
    r.lift === lift &&
    new Date(r.date) >= oneMonthAgo
  );
  
  const lastMonth1RM = Math.max(0, ...lastMonthRecords.map(r => r.estimated1RM));
  
  let prTarget;
  if (lastMonth1RM > 0) {
      const topSetWeight = sets.find(s => s.type === 'Work Set' && s.set === 3)?.weight || 0;
      prTarget = {
          reps: calculateRepsForPR(lastMonth1RM + 1, topSetWeight),
          lastMonth1RM: lastMonth1RM
      }
  }

  return { client, sets, prTarget };
};

export const exportToCsv = (workouts: CalculatedWorkout[], lift: Lift, weekName: string) => {
    const headers = ['Client', 'Set', 'Weight (lbs)', 'Target Reps'];
    const rows = workouts.flatMap(({ client, sets }) => 
        sets.map(set => [client.name, set.label, set.weight, set.reps])
    );

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\r\n";

    rows.forEach(rowArray => {
        const row = rowArray.join(",");
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `SBDOH_531_Workout_${lift}_${weekName.replace(' ', '_')}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
