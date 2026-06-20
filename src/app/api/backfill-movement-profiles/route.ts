import { getAppSettings, getClients, updateClient } from "@/lib/data";
import {
  isMaintenanceRouteEnabled,
  maintenanceRouteDisabledResponse,
} from "@/lib/maintenance-routes";
import {
  coerceMovementProgressionIncrement,
  getDefaultMovementProgressionIncrement,
  normalizeMovementName,
  resolveMovementClassType,
} from "@/lib/movement-profiles";
import { getLiftDisplayName } from "@/lib/schedule";
import type {
  Lift,
  LoggedSetEntry,
  MovementClassType,
  MovementProfile,
  TrainingMaxes,
} from "@/lib/types";

const lifts: Lift[] = ["Squat", "Bench", "Deadlift", "Press"];

const mround = (value: number): number => Math.round(value / 5) * 5;

const getCycleSnapshot = (
  byCycle: Record<number, TrainingMaxes> | undefined,
  fallback: TrainingMaxes,
  cycleNumber: number
): TrainingMaxes => ({ ...(byCycle?.[cycleNumber] || fallback) });

const getProfileEntryByMovementName = (
  profilesForCycle: Record<string, MovementProfile>,
  movementName: string
): { key: string; profile: MovementProfile } | null => {
  if (profilesForCycle[movementName]) {
    return { key: movementName, profile: profilesForCycle[movementName] };
  }

  const normalizedTarget = normalizeMovementName(movementName);
  const matched = Object.entries(profilesForCycle).find(
    ([name]) => normalizeMovementName(name) === normalizedTarget
  );

  return matched ? { key: matched[0], profile: matched[1] } : null;
};

const normalizeMovementProfile = (args: {
  profile: MovementProfile;
  movementName: string;
  cycleNumber: number;
  defaultClassType: MovementClassType;
  defaultIncrement: 2.5 | 5 | 7.5 | 10;
  sourceWeekKey?: string;
  needsCalibration?: boolean;
}): MovementProfile => {
  const {
    profile,
    movementName,
    cycleNumber,
    defaultClassType,
    defaultIncrement,
    sourceWeekKey,
    needsCalibration,
  } = args;

  const oneRepMax = Number(profile.oneRepMax || 0);
  const trainingMax = Number(profile.trainingMax || 0);
  const shouldBeCalibrating = Boolean(needsCalibration && oneRepMax <= 0);

  const normalized: MovementProfile = {
    ...profile,
    oneRepMax,
    trainingMax,
    classType:
      profile.classType ||
      resolveMovementClassType(movementName, undefined) ||
      defaultClassType,
    progressionIncrement: coerceMovementProgressionIncrement(
      Number(profile.progressionIncrement || 0),
      defaultIncrement
    ),
    progressionHoldActive: Boolean(profile.progressionHoldActive),
    movementCycleNumber: Math.max(profile.movementCycleNumber || 0, cycleNumber),
    calibrationPhaseActive: shouldBeCalibrating,
    lastUpdatedAt: profile.lastUpdatedAt || new Date().toISOString(),
  };

  const resolvedSourceWeekKey = profile.sourceWeekKey || sourceWeekKey;
  if (resolvedSourceWeekKey) {
    normalized.sourceWeekKey = resolvedSourceWeekKey;
  }

  return normalized;
};

const upsertOrNormalizeMovementProfile = (args: {
  profilesForCycle: Record<string, MovementProfile>;
  movementName: string;
  cycleNumber: number;
  oneRepMax: number;
  trainingMax: number;
  defaultClassType: MovementClassType;
  defaultIncrement: 2.5 | 5 | 7.5 | 10;
  sourceWeekKey?: string;
  needsCalibration?: boolean;
}): { changed: boolean; inserted: boolean } => {
  const {
    profilesForCycle,
    movementName,
    cycleNumber,
    oneRepMax,
    trainingMax,
    defaultClassType,
    defaultIncrement,
    sourceWeekKey,
    needsCalibration,
  } = args;

  const found = getProfileEntryByMovementName(profilesForCycle, movementName);

  if (!found && (oneRepMax <= 0 || trainingMax <= 0)) {
    return { changed: false, inserted: false };
  }

  const baseProfile: MovementProfile = found
    ? found.profile
    : {
        oneRepMax,
        trainingMax,
        classType: defaultClassType,
        progressionIncrement: defaultIncrement,
        progressionHoldActive: false,
        movementCycleNumber: cycleNumber,
        calibrationPhaseActive: Boolean(needsCalibration && oneRepMax <= 0),
        lastUpdatedAt: new Date().toISOString(),
      };

  const enrichedBase: MovementProfile = {
    ...baseProfile,
    oneRepMax: baseProfile.oneRepMax > 0 ? baseProfile.oneRepMax : oneRepMax,
    trainingMax: baseProfile.trainingMax > 0 ? baseProfile.trainingMax : trainingMax,
  };

  const normalized = normalizeMovementProfile({
    profile: enrichedBase,
    movementName,
    cycleNumber,
    defaultClassType,
    defaultIncrement,
    sourceWeekKey,
    needsCalibration,
  });

  const targetKey = found?.key || movementName;
  const previous = profilesForCycle[targetKey];
  const changed = JSON.stringify(previous || null) !== JSON.stringify(normalized);

  if (changed) {
    profilesForCycle[targetKey] = normalized;
  }

  return { changed, inserted: !found };
};

const getCycleNumbersForClient = (client: Awaited<ReturnType<typeof getClients>>[number]): number[] => {
  const values = new Set<number>();

  for (const key of Object.keys(client.loggedSetInputsByCycle || {})) {
    const parsed = Number(key);
    if (!Number.isNaN(parsed)) values.add(parsed);
  }

  for (const key of Object.keys(client.oneRepMaxesByCycle || {})) {
    const parsed = Number(key);
    if (!Number.isNaN(parsed)) values.add(parsed);
  }

  for (const key of Object.keys(client.trainingMaxesByCycle || {})) {
    const parsed = Number(key);
    if (!Number.isNaN(parsed)) values.add(parsed);
  }

  for (const key of Object.keys(client.movementProfilesByCycle || {})) {
    const parsed = Number(key);
    if (!Number.isNaN(parsed)) values.add(parsed);
  }

  for (const key of Object.keys(client.movementCalibrationsByCycle || {})) {
    const parsed = Number(key);
    if (!Number.isNaN(parsed)) values.add(parsed);
  }

  for (const cycle of client.cycleMembership || []) {
    if (!Number.isNaN(cycle)) values.add(cycle);
  }

  values.add(client.currentCycleNumber || 1);

  return Array.from(values).sort((a, b) => a - b);
};

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const [clients, appSettings] = await Promise.all([getClients(), getAppSettings()]);

    const cycleSchedulesByCycle = appSettings.cycleSchedulesByCycle || {};
    const globalMovementSettings = appSettings.globalMovementSettings || {};

    let scannedClients = 0;
    let updatedClients = 0;
    let profilesBackfilled = 0;
    let profilesNormalized = 0;
    let cycleMaxesBackfilled = 0;

    const updatedClientNames: string[] = [];

    for (const client of clients) {
      scannedClients += 1;

      const cycleNumbers = getCycleNumbersForClient(client);
      if (cycleNumbers.length === 0) continue;

      const nextOneRepMaxesByCycle: Record<number, TrainingMaxes> = {
        ...(client.oneRepMaxesByCycle || {}),
      };
      const nextTrainingMaxesByCycle: Record<number, TrainingMaxes> = {
        ...(client.trainingMaxesByCycle || {}),
      };
      const nextMovementProfilesByCycle = {
        ...(client.movementProfilesByCycle || {}),
      } as NonNullable<typeof client.movementProfilesByCycle>;

      const nextOneRepMaxes = { ...client.oneRepMaxes };
      const nextTrainingMaxes = { ...client.trainingMaxes };

      let clientChanged = false;

      for (const cycleNumber of cycleNumbers) {
        const weekMap = client.loggedSetInputsByCycle?.[cycleNumber] || {};
        const cycleCalibrationState =
          client.movementCalibrationsByCycle?.[cycleNumber] || {};

        const cycleOneRepMaxes = getCycleSnapshot(
          nextOneRepMaxesByCycle,
          client.oneRepMaxes,
          cycleNumber
        );
        const cycleTrainingMaxes = getCycleSnapshot(
          nextTrainingMaxesByCycle,
          client.trainingMaxes,
          cycleNumber
        );

        const profilesForCycle: Record<string, MovementProfile> = {
          ...(nextMovementProfilesByCycle[cycleNumber] || {}),
        };

        for (const lift of lifts) {
          let bestEstimated1RM = 0;
          let sourceWeekKey: string | undefined;

          for (const [weekKey, liftsForWeek] of Object.entries(weekMap)) {
            const setMap = liftsForWeek?.[lift] || {};

            for (const setEntry of Object.values(setMap) as LoggedSetEntry[]) {
              const weight = Number(setEntry?.weight || 0);
              const reps = Number(setEntry?.reps || 0);
              if (weight <= 0 || reps <= 0) continue;

              const estimated1RM = Math.round(weight * (1 + reps / 30));
              if (estimated1RM > bestEstimated1RM) {
                bestEstimated1RM = estimated1RM;
                sourceWeekKey = weekKey;
              }
            }
          }

          const roundedOneRepMax = bestEstimated1RM > 0 ? mround(bestEstimated1RM) : 0;
          const roundedTrainingMax = roundedOneRepMax > 0 ? mround(roundedOneRepMax * 0.9) : 0;

          if (roundedOneRepMax > 0 && (cycleOneRepMaxes[lift] || 0) <= 0) {
            cycleOneRepMaxes[lift] = roundedOneRepMax;
            nextOneRepMaxesByCycle[cycleNumber] = cycleOneRepMaxes;
            cycleMaxesBackfilled += 1;
            clientChanged = true;

            if (
              (client.currentCycleNumber || 1) === cycleNumber &&
              (nextOneRepMaxes[lift] || 0) <= 0
            ) {
              nextOneRepMaxes[lift] = roundedOneRepMax;
            }
          }

          if (roundedTrainingMax > 0 && (cycleTrainingMaxes[lift] || 0) <= 0) {
            cycleTrainingMaxes[lift] = roundedTrainingMax;
            nextTrainingMaxesByCycle[cycleNumber] = cycleTrainingMaxes;
            cycleMaxesBackfilled += 1;
            clientChanged = true;

            if (
              (client.currentCycleNumber || 1) === cycleNumber &&
              (nextTrainingMaxes[lift] || 0) <= 0
            ) {
              nextTrainingMaxes[lift] = roundedTrainingMax;
            }
          }

          const movementName = getLiftDisplayName(
            lift,
            cycleSchedulesByCycle[cycleNumber]
          );
          const classType = resolveMovementClassType(
            movementName,
            globalMovementSettings,
            lift
          );
          const defaultIncrement = getDefaultMovementProgressionIncrement(
            movementName,
            globalMovementSettings,
            lift
          );
          const profileOneRepMax = cycleOneRepMaxes[lift] || roundedOneRepMax;
          const profileTrainingMax = cycleTrainingMaxes[lift] || roundedTrainingMax;
          const needsCalibration = Boolean(
            cycleCalibrationState[lift]?.needsCalibration
          );

          const canonicalResult = upsertOrNormalizeMovementProfile({
            profilesForCycle,
            movementName: lift,
            cycleNumber,
            oneRepMax: profileOneRepMax,
            trainingMax: profileTrainingMax,
            defaultClassType: classType,
            defaultIncrement,
            sourceWeekKey,
            needsCalibration,
          });

          const displayResult = upsertOrNormalizeMovementProfile({
            profilesForCycle,
            movementName,
            cycleNumber,
            oneRepMax: profileOneRepMax,
            trainingMax: profileTrainingMax,
            defaultClassType: classType,
            defaultIncrement,
            sourceWeekKey,
            needsCalibration,
          });

          if (canonicalResult.inserted) profilesBackfilled += 1;
          if (displayResult.inserted) profilesBackfilled += 1;
          if (canonicalResult.changed) profilesNormalized += 1;
          if (displayResult.changed) profilesNormalized += 1;
          if (canonicalResult.changed || displayResult.changed) {
            clientChanged = true;
          }
        }

        for (const [profileName, profile] of Object.entries(profilesForCycle)) {
          const matchedLift = lifts.find((lift) => {
            const displayName = getLiftDisplayName(
              lift,
              cycleSchedulesByCycle[cycleNumber]
            );
            const normalizedProfileName = normalizeMovementName(profileName);
            return (
              normalizedProfileName === normalizeMovementName(lift) ||
              normalizedProfileName === normalizeMovementName(displayName)
            );
          });

          const defaultClassType = resolveMovementClassType(
            profileName,
            globalMovementSettings,
            matchedLift
          );
          const defaultIncrement = getDefaultMovementProgressionIncrement(
            profileName,
            globalMovementSettings,
            matchedLift
          );
          const normalized = normalizeMovementProfile({
            profile,
            movementName: profileName,
            cycleNumber,
            defaultClassType,
            defaultIncrement,
            needsCalibration: matchedLift
              ? Boolean(cycleCalibrationState[matchedLift]?.needsCalibration)
              : false,
          });

          if (JSON.stringify(profile) !== JSON.stringify(normalized)) {
            profilesForCycle[profileName] = normalized;
            profilesNormalized += 1;
            clientChanged = true;
          }
        }

        nextMovementProfilesByCycle[cycleNumber] = profilesForCycle;
      }

      if (!clientChanged) continue;

      await updateClient(client.id, {
        oneRepMaxesByCycle: nextOneRepMaxesByCycle,
        trainingMaxesByCycle: nextTrainingMaxesByCycle,
        movementProfilesByCycle: nextMovementProfilesByCycle,
        oneRepMaxes: nextOneRepMaxes,
        trainingMaxes: nextTrainingMaxes,
      });

      updatedClients += 1;
      updatedClientNames.push(client.name);
    }

    return Response.json({
      success: true,
      scannedClients,
      updatedClients,
      profilesBackfilled,
      profilesNormalized,
      cycleMaxesBackfilled,
      updatedClientNames,
      message: `Backfilled movement profile data for ${updatedClients} client(s).`,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    {
      success: false,
      message: "Use POST to run movement profile backfill.",
    },
    { status: 405 }
  );
}
