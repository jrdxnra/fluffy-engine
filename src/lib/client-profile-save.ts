import type { Client } from "@/lib/types";
import { getEffectiveCycleMembership } from "@/lib/cycle-membership";
import { calculateTrainingMaxes } from "@/lib/training-max";

/**
 * True when the client already has 1RM, training max, or movement profile data stored
 * for the cycle. Used so a profile save never invents an all-zero cycle for a client.
 */
export const hasCycleStrengthData = (client: Client, cycleNumber: number): boolean => {
  return Boolean(
    client.oneRepMaxesByCycle?.[cycleNumber] ||
    client.trainingMaxesByCycle?.[cycleNumber] ||
    Object.keys(client.movementProfilesByCycle?.[cycleNumber] || {}).length > 0
  );
};

/**
 * Shared by the desktop and mobile profile-save handlers. Settles the client's cycle
 * (every client always has a real Cycle 1) and syncs the top-level 1RM/TM fields to the
 * client's current cycle.
 *
 * Training maxes are saved exactly as edited. They are only derived from the 1RM (90%)
 * when the cycle has no training maxes at all, and no other cycle is rewritten.
 */
export const normalizeClientForProfileSave = (
  updatedClient: Client,
  fallbackCycleNumber: number = 1
): Client => {
  const normalizedCycleMembership = getEffectiveCycleMembership(updatedClient);
  const effectiveMembership = normalizedCycleMembership.length > 0 ? normalizedCycleMembership : [1];
  const normalizedCurrentCycleNumber =
    effectiveMembership.includes(updatedClient.currentCycleNumber || 0)
      ? (updatedClient.currentCycleNumber || 1)
      : Math.max(...effectiveMembership);

  const cycleForClient = normalizedCurrentCycleNumber || fallbackCycleNumber || 1;
  const cycleOneRepMaxes =
    updatedClient.oneRepMaxesByCycle?.[cycleForClient] ||
    updatedClient.oneRepMaxes;
  const cycleTrainingMaxes =
    updatedClient.trainingMaxesByCycle?.[cycleForClient] ||
    calculateTrainingMaxes(cycleOneRepMaxes);

  return {
    ...updatedClient,
    currentCycleNumber: normalizedCurrentCycleNumber,
    cycleMembership: effectiveMembership,
    oneRepMaxes: cycleOneRepMaxes,
    oneRepMaxesByCycle: {
      ...(updatedClient.oneRepMaxesByCycle || {}),
      [cycleForClient]: cycleOneRepMaxes,
    },
    trainingMaxes: cycleTrainingMaxes,
    trainingMaxesByCycle: {
      ...(updatedClient.trainingMaxesByCycle || {}),
      [cycleForClient]: cycleTrainingMaxes,
    },
  };
};
