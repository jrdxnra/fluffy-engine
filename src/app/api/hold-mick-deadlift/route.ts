import { getClients, updateClient } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';
import { calculateTrainingMaxes } from '@/lib/training-max';
import type { TrainingMaxes } from '@/lib/types';

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const clients = await getClients();
    const mick = clients.find((c) => c.name === 'Mick');

    if (!mick) {
      return Response.json({
        success: false,
        message: 'Mick not found',
      });
    }

    const currentCycle = mick.currentCycleNumber || 1;
    
    const before = {
      oneRepMax: mick.oneRepMaxes.Deadlift,
      trainingMax: mick.trainingMaxesByCycle?.[currentCycle]?.Deadlift || mick.trainingMaxes.Deadlift,
      fullOneRepMaxes: { ...mick.oneRepMaxes },
      fullTrainingMaxes: { ...mick.trainingMaxesByCycle?.[currentCycle], ...mick.trainingMaxes },
    };

    // Set Deadlift 1RM to 300 so TM = 270 (90% of 300)
    const newOneRepMaxes: TrainingMaxes = {
      ...mick.oneRepMaxes,
      Deadlift: 300,
    };

    const newTrainingMaxes = calculateTrainingMaxes(newOneRepMaxes);

    await updateClient(mick.id, {
      oneRepMaxes: newOneRepMaxes,
      trainingMaxes: newTrainingMaxes,
      oneRepMaxesByCycle: {
        ...(mick.oneRepMaxesByCycle || {}),
        [currentCycle]: newOneRepMaxes,
      },
      trainingMaxesByCycle: {
        ...(mick.trainingMaxesByCycle || {}),
        [currentCycle]: newTrainingMaxes,
      },
    });

    const after = {
      oneRepMax: newOneRepMaxes.Deadlift,
      trainingMax: newTrainingMaxes.Deadlift,
    };

    return Response.json({
      success: true,
      message: 'Mick placed on progression hold (Deadlift)',
      cycle: currentCycle,
      before,
      after,
      details: {
        'Before Deadlift 1RM': before.oneRepMax,
        'Before Deadlift TM': before.trainingMax,
        'After Deadlift 1RM': after.oneRepMax,
        'After Deadlift TM': after.trainingMax,
        'Expected 3-rep week loads (90% TM)': {
          'Work Set 1 (70%)': Math.round((after.trainingMax * 0.7) / 5) * 5,
          'Work Set 2 (80%)': Math.round((after.trainingMax * 0.8) / 5) * 5,
          'Top Set (90%)': Math.round((after.trainingMax * 0.9) / 5) * 5,
        },
      },
    });
  } catch (error) {
    console.error('Error placing Mick on hold:', error);
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
      message: 'Use POST to place Mick on progression hold.',
    },
    { status: 405 }
  );
}
