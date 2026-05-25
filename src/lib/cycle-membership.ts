import type { Client } from "@/lib/types";

export const LEGACY_DEFAULT_CYCLE_MEMBERSHIP = (client: Client): number[] => {
  return [client.currentCycleNumber || 1];
};

export const getEffectiveCycleMembership = (client: Client): number[] => {
  const explicit = client.cycleMembership || [];
  if (explicit.length > 0) {
    return Array.from(new Set(explicit.map(Number).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
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
