import { getClients, updateClient } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';
import type { Lift, TrainingMaxes } from '@/lib/types';
import { calculateTrainingMaxes } from '@/lib/training-max';

const lifts: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Press'];

const allLiftsEqual = (a: TrainingMaxes | undefined, b: TrainingMaxes | undefined): boolean => {
  if (!a || !b) return false;
  return lifts.every((lift) => a[lift] === b[lift]);
};

const buildTrainingMaxesFromOneRepMaxes = (oneRepMaxes: TrainingMaxes): TrainingMaxes => {
  return calculateTrainingMaxes(oneRepMaxes, lifts);
};

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const clients = await getClients();
    let scanned = 0;
    let updated = 0;

    for (const client of clients) {
      scanned += 1;

      const currentCycleNumber = client.currentCycleNumber || 1;
      if (currentCycleNumber !== 1) continue;

      const hasInflatedLegacyTms =
        allLiftsEqual(client.trainingMaxes, client.oneRepMaxes) ||
        allLiftsEqual(client.trainingMaxesByCycle?.[1], client.oneRepMaxes);

      const activeCycleTms = (client.trainingMaxesByCycle?.[1] || client.trainingMaxes) as TrainingMaxes | undefined;
      const hasImpossibleCycleOneTms = Boolean(
        activeCycleTms &&
          lifts.some((lift) => {
            const tm = activeCycleTms[lift] || 0;
            const oneRepMax = client.oneRepMaxes?.[lift] || 0;
            return oneRepMax > 0 && tm > oneRepMax;
          })
      );

      if (!hasInflatedLegacyTms && !hasImpossibleCycleOneTms) continue;

      const correctedTrainingMaxes = buildTrainingMaxesFromOneRepMaxes(client.oneRepMaxes);
      await updateClient(client.id, {
        trainingMaxes: correctedTrainingMaxes,
        trainingMaxesByCycle: {
          ...(client.trainingMaxesByCycle || {}),
          1: correctedTrainingMaxes,
        },
      });
      updated += 1;
    }

    return Response.json({
      success: true,
      scanned,
      updated,
      message: `Normalized training maxes for ${updated} of ${scanned} clients.`,
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
      message: 'Use POST to run TM normalization.',
    },
    { status: 405 }
  );
}
