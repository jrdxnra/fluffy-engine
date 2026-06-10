import type { Client } from "@/lib/types";

export const LEGACY_DEFAULT_CYCLE_MEMBERSHIP = (client: Client): number[] => {
  const currentCycle = client.currentCycleNumber || 1;
  const explicit = (client.cycleMembership || [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);

  const inferred = new Set<number>();
  for (const value of explicit) {
    inferred.add(value);
  }
  inferred.add(currentCycle);

  const addCycleKeys = (record: Record<number, unknown> | undefined) => {
    if (!record) return;
    for (const key of Object.keys(record)) {
      const parsed = Number(key);
      if (Number.isFinite(parsed) && parsed > 0) {
        inferred.add(parsed);
      }
    }
  };

  addCycleKeys(client.trainingMaxesByCycle as Record<number, unknown> | undefined);
  addCycleKeys(client.oneRepMaxesByCycle as Record<number, unknown> | undefined);
  addCycleKeys(client.weekAssignmentsByCycle as Record<number, unknown> | undefined);
  addCycleKeys(client.loggedSetInputsByCycle as Record<number, unknown> | undefined);
  addCycleKeys(client.sessionStateByCycle as Record<number, unknown> | undefined);
  addCycleKeys(client.movementCalibrationsByCycle as Record<number, unknown> | undefined);
  addCycleKeys(client.movementProfilesByCycle as Record<number, unknown> | undefined);

  // Legacy records before cycleMembership existed were effectively in every cycle up to current.
  // If there is no by-cycle evidence, keep that historical behavior.
  if (inferred.size <= 1 && currentCycle > 1) {
    for (let cycle = 1; cycle <= currentCycle; cycle++) {
      inferred.add(cycle);
    }
  }

  return Array.from(inferred).sort((a, b) => a - b);
};

export const getEffectiveCycleMembership = (client: Client): number[] => {
  const explicit = client.cycleMembership || [];
  const normalizedExplicit = Array.from(
    new Set(explicit.map(Number).filter((value) => Number.isFinite(value) && value > 0))
  ).sort((a, b) => a - b);

  if (normalizedExplicit.length > 0) {
    const inferredLegacy = LEGACY_DEFAULT_CYCLE_MEMBERSHIP(client);
    // Repair a common migration case where legacy clients were written with only current cycle.
    if (
      normalizedExplicit.length === 1 &&
      normalizedExplicit[0] === (client.currentCycleNumber || 1) &&
      inferredLegacy.length > 1
    ) {
      return inferredLegacy;
    }

    return normalizedExplicit;
  }
  return [...LEGACY_DEFAULT_CYCLE_MEMBERSHIP(client)];
};

export const isClientInCycle = (client: Client, cycleNumber: number): boolean => {
  return getEffectiveCycleMembership(client).includes(cycleNumber);
};

export const withCycleAdded = (client: Client, cycleNumber: number): number[] => {
  return Array.from(new Set([...getEffectiveCycleMembership(client), cycleNumber])).sort((a, b) => a - b);
};

export const withCycleRemoved = (client: Client, cycleNumber: number): number[] => {
  const remaining = getEffectiveCycleMembership(client).filter((value) => value !== cycleNumber);
  return remaining.length > 0 ? remaining : [1];
};
