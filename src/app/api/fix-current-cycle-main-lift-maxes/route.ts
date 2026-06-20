import { getAppSettings, getClients, updateClient } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';
import { calculateTrainingMaxes } from '@/lib/training-max';
import { getLiftDisplayName } from '@/lib/schedule';
import {
  getDefaultMovementProgressionIncrement,
  normalizeMovementName,
  resolveMovementClassType,
} from '@/lib/movement-profiles';
import type { Lift, MovementProfile, TrainingMaxes } from '@/lib/types';

const lifts: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Press'];

const sameTrainingMaxes = (a: TrainingMaxes | undefined, b: TrainingMaxes | undefined): boolean => {
  if (!a || !b) return false;
  return lifts.every((lift) => Number(a[lift] || 0) === Number(b[lift] || 0));
};

const uniqueNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const normalized = normalizeMovementName(name);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(name);
  }

  return result;
};

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const [clients, appSettings] = await Promise.all([getClients(), getAppSettings()]);

    let scanned = 0;
    let updated = 0;
    const touchedClients: Array<{ name: string; cycle: number }> = [];

    for (const client of clients) {
      scanned += 1;

      const currentCycle = client.currentCycleNumber || 1;
      const cycleOneRepMaxes = (client.oneRepMaxesByCycle?.[currentCycle] || client.oneRepMaxes) as TrainingMaxes;
      const correctedTrainingMaxes = calculateTrainingMaxes(cycleOneRepMaxes);
      const existingCycleTrainingMaxes = (client.trainingMaxesByCycle?.[currentCycle] || client.trainingMaxes) as TrainingMaxes;

      const cycleSchedule = appSettings.cycleSchedulesByCycle?.[currentCycle];
      const existingProfilesForCycle = { ...(client.movementProfilesByCycle?.[currentCycle] || {}) };
      const mergedProfilesForCycle: Record<string, MovementProfile> = { ...existingProfilesForCycle };
      let profilesChanged = false;

      for (const lift of lifts) {
        const movementNames = uniqueNames([
          lift,
          getLiftDisplayName(lift, cycleSchedule),
        ]);

        for (const movementName of movementNames) {
          const existingProfile = mergedProfilesForCycle[movementName];
          const nextProfile: MovementProfile = {
            ...(existingProfile || {}),
            oneRepMax: cycleOneRepMaxes[lift],
            trainingMax: correctedTrainingMaxes[lift],
            classType:
              existingProfile?.classType ||
              resolveMovementClassType(movementName, appSettings.globalMovementSettings, lift),
            progressionIncrement:
              existingProfile?.progressionIncrement ||
              getDefaultMovementProgressionIncrement(movementName, appSettings.globalMovementSettings, lift),
            progressionHoldActive: existingProfile?.progressionHoldActive || false,
            movementCycleNumber: Math.max(existingProfile?.movementCycleNumber || 0, currentCycle),
            calibrationPhaseActive: false,
            sourceWeekKey: existingProfile?.sourceWeekKey,
            lastUpdatedAt: new Date().toISOString(),
          };

          const changed =
            !existingProfile ||
            Number(existingProfile.oneRepMax || 0) !== Number(nextProfile.oneRepMax || 0) ||
            Number(existingProfile.trainingMax || 0) !== Number(nextProfile.trainingMax || 0) ||
            Boolean(existingProfile.calibrationPhaseActive) !== Boolean(nextProfile.calibrationPhaseActive);

          if (changed) {
            profilesChanged = true;
            mergedProfilesForCycle[movementName] = nextProfile;
          }
        }
      }

      const existingCalibrationForCycle = { ...(client.movementCalibrationsByCycle?.[currentCycle] || {}) };
      const nextCalibrationForCycle = { ...existingCalibrationForCycle };
      let calibrationChanged = false;

      for (const lift of lifts) {
        const previous = existingCalibrationForCycle[lift];
        if (previous?.needsCalibration !== false) {
          calibrationChanged = true;
        }
        nextCalibrationForCycle[lift] = {
          ...previous,
          needsCalibration: false,
        };
      }

      const needsUpdate = !sameTrainingMaxes(existingCycleTrainingMaxes, correctedTrainingMaxes) || profilesChanged || calibrationChanged;
      if (!needsUpdate) continue;

      await updateClient(client.id, {
        oneRepMaxes: cycleOneRepMaxes,
        oneRepMaxesByCycle: {
          ...(client.oneRepMaxesByCycle || {}),
          [currentCycle]: cycleOneRepMaxes,
        },
        trainingMaxes: correctedTrainingMaxes,
        trainingMaxesByCycle: {
          ...(client.trainingMaxesByCycle || {}),
          [currentCycle]: correctedTrainingMaxes,
        },
        movementCalibrationsByCycle: {
          ...(client.movementCalibrationsByCycle || {}),
          [currentCycle]: nextCalibrationForCycle,
        },
        movementProfilesByCycle: {
          ...(client.movementProfilesByCycle || {}),
          [currentCycle]: mergedProfilesForCycle,
        },
      });

      updated += 1;
      touchedClients.push({ name: client.name, cycle: currentCycle });
    }

    return Response.json({
      success: true,
      scanned,
      updated,
      touchedClients,
      message: `Fixed active-cycle main lift maxes for ${updated} of ${scanned} clients.`,
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
      message: 'Use POST to apply active-cycle main lift TM normalization.',
    },
    { status: 405 }
  );
}