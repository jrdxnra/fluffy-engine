import type { Client, Lift, MovementClassType, MovementProfile } from "@/lib/types";

export const normalizeMovementName = (name: string): string => {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
};

export const getMovementClassTypeForLift = (lift: Lift): MovementClassType => {
  return lift === "Bench" || lift === "Press" ? "upper" : "lower";
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
