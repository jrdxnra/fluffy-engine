import type { Client, Lift, MovementProfile } from "@/lib/types";

export const getExpectedWeekCountForCycle = (client: Client, cycleNumber: number): number => {
  const assignments = client.weekAssignmentsByCycle?.[cycleNumber] || {};
  const expected = Object.entries(assignments)
    .filter(([, assignment]) => assignment !== "N/A")
    .length;
  return expected > 0 ? expected : 3;
};

export const getCompletedLoggedWeekCountForLift = (
  client: Client,
  cycleNumber: number,
  lift: Lift
): number => {
  const cycleLogs = client.loggedSetInputsByCycle?.[cycleNumber] || {};
  const completedWeekKeys = new Set(
    Object.entries(cycleLogs)
      .filter(([, weekMap]) => {
        const liftMap = weekMap?.[lift];
        return Boolean(liftMap && Object.keys(liftMap).length > 0);
      })
      .map(([weekKey]) => weekKey)
  );
  return completedWeekKeys.size;
};

export const getCompletedLoggedWeekCountForCycle = (
  client: Client,
  cycleNumber: number
): number => {
  const cycleLogs = client.loggedSetInputsByCycle?.[cycleNumber] || {};
  const completedWeekKeys = new Set(
    Object.entries(cycleLogs)
      .filter(([, weekMap]) => {
        if (!weekMap) return false;
        return Object.values(weekMap).some((liftMap) => Boolean(liftMap && Object.keys(liftMap).length > 0));
      })
      .map(([weekKey]) => weekKey)
  );
  return completedWeekKeys.size;
};

const getKnownCycleNumbers = (client: Client): number[] => {
  const cycleNumbers = new Set<number>();

  Object.keys(client.weekAssignmentsByCycle || {}).forEach((key) => cycleNumbers.add(Number(key)));
  Object.keys(client.loggedSetInputsByCycle || {}).forEach((key) => cycleNumbers.add(Number(key)));

  return Array.from(cycleNumbers).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
};

export const hasFullCycleLiftLogs = (
  client: Client,
  cycleNumber: number,
  lift: Lift
): boolean => {
  const knownCycles = getKnownCycleNumbers(client).filter((n) => n <= cycleNumber);
  if (knownCycles.length === 0) knownCycles.push(cycleNumber);

  for (const candidateCycle of knownCycles) {
    const completedCycleWeeks = getCompletedLoggedWeekCountForCycle(client, candidateCycle);
    const expectedCycleWeeks = getExpectedWeekCountForCycle(client, candidateCycle);
    const hasCompletedCycle = completedCycleWeeks >= expectedCycleWeeks;
    if (!hasCompletedCycle) continue;

    const completedLiftWeeks = getCompletedLoggedWeekCountForLift(client, candidateCycle, lift);
    const hasLiftWork = completedLiftWeeks > 0;
    if (hasLiftWork) return true;
  }

  return false;
};

export const isLiftCalibrationRequired = (
  client: Client,
  cycleNumber: number,
  lift: Lift,
  profile?: MovementProfile | null,
  explicitNeedsCalibration?: boolean
): boolean => {
  if (explicitNeedsCalibration) return true;

  // Historical completion is authoritative for established lifts, even if
  // profile keys drift because of movement renames.
  const hasEstablishedHistory = hasFullCycleLiftLogs(client, cycleNumber, lift);
  if (hasEstablishedHistory) return false;

  // New/insufficiently logged lifts remain in calibration.
  if (!profile || !profile.sourceWeekKey) return true;
  return true;
};
