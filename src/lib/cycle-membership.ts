import type { Client } from "@/lib/types";

const collectCycleKeys = (record: Record<number, unknown> | undefined): number[] => {
  if (!record) return [];

  return Object.keys(record)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
};

export const inferCycleMembershipFromHistoricalData = (client: Client): number[] => {
  const inferred = new Set<number>();

  for (const cycle of collectCycleKeys(client.trainingMaxesByCycle as Record<number, unknown> | undefined)) {
    inferred.add(cycle);
  }
  for (const cycle of collectCycleKeys(client.oneRepMaxesByCycle as Record<number, unknown> | undefined)) {
    inferred.add(cycle);
  }
  for (const cycle of collectCycleKeys(client.weekAssignmentsByCycle as Record<number, unknown> | undefined)) {
    inferred.add(cycle);
  }
  for (const cycle of collectCycleKeys(client.loggedSetInputsByCycle as Record<number, unknown> | undefined)) {
    inferred.add(cycle);
  }
  for (const cycle of collectCycleKeys(client.sessionStateByCycle as Record<number, unknown> | undefined)) {
    inferred.add(cycle);
  }
  for (const cycle of collectCycleKeys(client.movementCalibrationsByCycle as Record<number, unknown> | undefined)) {
    inferred.add(cycle);
  }
  for (const cycle of collectCycleKeys(client.movementProfilesByCycle as Record<number, unknown> | undefined)) {
    inferred.add(cycle);
  }

  return Array.from(inferred).sort((a, b) => a - b);
};

export const getEffectiveCycleMembership = (client: Client): number[] => {
  const explicit = client.cycleMembership || [];
  const normalizedExplicit = Array.from(
    new Set(explicit.map(Number).filter((value) => Number.isFinite(value) && value > 0))
  ).sort((a, b) => a - b);

  if (normalizedExplicit.length > 0) {
    return normalizedExplicit;
  }

  return inferCycleMembershipFromHistoricalData(client);
};

export const isClientInCycle = (client: Client, cycleNumber: number): boolean => {
  return getEffectiveCycleMembership(client).includes(cycleNumber);
};

export const withCycleAdded = (client: Client, cycleNumber: number): number[] => {
  return Array.from(new Set([...getEffectiveCycleMembership(client), cycleNumber])).sort((a, b) => a - b);
};

export const withCycleRemoved = (client: Client, cycleNumber: number): number[] => {
  const remaining = getEffectiveCycleMembership(client).filter((value) => value !== cycleNumber);
  return remaining;
};
