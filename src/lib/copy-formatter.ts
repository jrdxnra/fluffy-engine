import type { Lift, LoggedSetMap, WorkoutSet } from "@/lib/types";

type ActualSetEntry = {
  weight: number;
  reps: number;
};

export type BasicWorkoutCopyInput = {
  lift: Lift;
  workoutDateLabel?: string;
  sets: WorkoutSet[];
  accessories: string[];
  actualBySetIndex?: Record<number, ActualSetEntry>;
  persistedSetMap?: LoggedSetMap;
};

export const formatBasicWorkoutCopyText = ({
  lift,
  workoutDateLabel,
  sets,
  accessories,
  actualBySetIndex,
  persistedSetMap,
}: BasicWorkoutCopyInput): string => {
  const setsText = sets
    .map((set) => `${set.label}: ${set.weight} lbs x ${set.reps}`)
    .join("\n");

  const actualsText = sets
    .map((set, index) => {
      const actual = actualBySetIndex?.[index];
      const persisted = persistedSetMap?.[String(index)];
      const actualWeight = actual?.weight ?? persisted?.weight;
      const actualReps = actual?.reps ?? persisted?.reps;
      if (actualWeight === undefined || actualReps === undefined) return null;
      return `${set.label}: ${actualWeight} lbs x ${actualReps}`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return [
    workoutDateLabel ? `${lift} ${workoutDateLabel}` : lift,
    "",
    "Main Sets",
    setsText,
    ...(actualsText ? ["", "Logged Actuals", actualsText] : []),
    "",
    `${lift} Accessories`,
    ...accessories.map((item) => `- ${item}`),
  ]
    .filter((line) => line !== "")
    .join("\n");
};

export type DayCopyLiftEntry = {
  lift: Lift;
  sets: WorkoutSet[];
  accessories: string[];
  persistedSetMap?: LoggedSetMap;
};

export type DayWorkoutCopyInput = {
  dayHeader: string;
  dayLifts: Lift[];
  liftEntries: DayCopyLiftEntry[];
  fallbackText: string;
};

const parseAccessoryPrescription = (
  text: string
): { movement: string; sets: string; target: string } | null => {
  const normalized = text.trim().replace(/\s+/g, " ");
  const prefix = normalized.match(/^\s*(\d+)\s*[xX]\s*([^\s]+)\s+(.+)$/);
  if (prefix) {
    const [, sets, target, movement] = prefix;
    return { movement: movement.trim(), sets, target };
  }

  const suffix = normalized.match(/^\s*(.+?)\s+(\d+)\s*[xX]\s*([^\s]+)\s*$/);
  if (suffix) {
    const [, movement, sets, target] = suffix;
    return { movement: movement.trim(), sets, target };
  }

  return null;
};

export const formatDayWorkoutCopyText = ({
  dayHeader,
  dayLifts,
  liftEntries,
  fallbackText,
}: DayWorkoutCopyInput): string => {
  const tsvRows: string[] = [];
  const mergedAccessories: string[] = [];

  tsvRows.push(dayHeader);
  tsvRows.push("MOVEMENTS\tSETS\tREC REPS\tREC LOAD\tACT REPS\tACT LOAD");

  for (const dayLift of dayLifts) {
    const liftEntry = liftEntries.find((item) => item.lift === dayLift);
    if (!liftEntry || !liftEntry.sets || liftEntry.sets.length === 0) {
      continue;
    }

    tsvRows.push(`WORKING SETS: ${dayLift.toUpperCase()}`);
    for (const [setIndex, set] of liftEntry.sets.entries()) {
      if (set.type !== "Work Set") continue;
      const persisted = liftEntry.persistedSetMap?.[String(setIndex)];
      const actualReps = persisted?.reps !== undefined ? String(persisted.reps) : "";
      const actualLoad = persisted?.weight !== undefined ? String(persisted.weight) : "";
      tsvRows.push(`${dayLift}\t1\t${set.reps}\t${set.weight}\t${actualReps}\t${actualLoad}`);
    }
    tsvRows.push("");

    for (const accessory of liftEntry.accessories) {
      if (!mergedAccessories.includes(accessory)) {
        mergedAccessories.push(accessory);
      }
    }
  }

  if (tsvRows.length <= 2) {
    return fallbackText;
  }

  tsvRows.push("WORKING SETS: ACCESSORIES");
  for (const accessory of mergedAccessories) {
    const parsed = parseAccessoryPrescription(accessory);
    if (parsed) {
      tsvRows.push(`${parsed.movement}\t${parsed.sets}\t${parsed.target}\t\t\t`);
    } else {
      tsvRows.push(`${accessory}\t\t\t\t\t`);
    }
  }

  return tsvRows.join("\n");
};
