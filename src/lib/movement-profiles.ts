import type { Client, GlobalMovementSettings, Lift, MovementClassType, MovementProfile } from "@/lib/types";

export type MovementProgressionIncrement = 2.5 | 5 | 7.5 | 10;

const supportedProgressionIncrements: MovementProgressionIncrement[] = [2.5, 5, 7.5, 10];

export const normalizeMovementName = (name: string): string => {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
};

export const getMovementClassTypeForLift = (lift: Lift): MovementClassType => {
  return lift === "Bench" || lift === "Press" ? "upper" : "lower";
};

export const inferMovementClassTypeFromName = (movementName: string): MovementClassType => {
  const normalized = normalizeMovementName(movementName);
  if (normalized.includes("bench") || normalized.includes("press") || normalized.includes("dip") || normalized.includes("push")) {
    return "upper";
  }
  return "lower";
};

export const resolveMovementClassType = (
  movementName: string,
  globalMovementSettings?: GlobalMovementSettings,
  fallbackLift?: Lift
): MovementClassType => {
  const normalized = normalizeMovementName(movementName);
  const exactEntry = globalMovementSettings?.[movementName];
  if (exactEntry) return exactEntry.classType;

  const matchedEntry = Object.entries(globalMovementSettings || {}).find(([key]) => normalizeMovementName(key) === normalized);
  if (matchedEntry) return matchedEntry[1].classType;

  if (fallbackLift) return getMovementClassTypeForLift(fallbackLift);
  return inferMovementClassTypeFromName(movementName);
};

export const getDefaultMovementProgressionIncrement = (
  movementName: string,
  globalMovementSettings?: GlobalMovementSettings,
  fallbackLift?: Lift
): MovementProgressionIncrement => {
  const classType = resolveMovementClassType(movementName, globalMovementSettings, fallbackLift);
  return classType === "upper" ? 5 : 10;
};

export const coerceMovementProgressionIncrement = (
  value: number,
  fallback: MovementProgressionIncrement = 5
): MovementProgressionIncrement => {
  const matched = supportedProgressionIncrements.find((increment) => increment === value);
  return matched || fallback;
};

export const buildGlobalMovementSettings = (
  movementOptions: string[],
  existing?: GlobalMovementSettings
): GlobalMovementSettings => {
  const result: GlobalMovementSettings = {};

  for (const movementName of movementOptions) {
    const trimmed = movementName.trim();
    if (!trimmed) continue;
    result[trimmed] = {
      classType: resolveMovementClassType(trimmed, existing),
    };
  }

  for (const [movementName, value] of Object.entries(existing || {})) {
    if (!result[movementName]) {
      result[movementName] = value;
    }
  }

  return result;
};

export const getMovementProfileForCycle = (
  client: Client,
  cycleNumber: number,
  movementName: string
): MovementProfile | null => {
  const normalized = normalizeMovementName(movementName);
  const profilesForCycle = client.movementProfilesByCycle?.[cycleNumber];
  if (!profilesForCycle) return null;

  const exact = profilesForCycle[movementName];
  if (exact) return exact;

  const byNormalized = Object.entries(profilesForCycle).find(([key]) => normalizeMovementName(key) === normalized);
  return byNormalized?.[1] || null;
};
