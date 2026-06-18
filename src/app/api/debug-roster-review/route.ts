import { getClients } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';

const liftKeys = ['Squat', 'Bench', 'Deadlift', 'Press'] as const;

const pickLiftNumbers = (input: Record<string, number> | undefined) => {
  const output: Record<string, number> = {};
  if (!input) return output;

  for (const lift of liftKeys) {
    const value = Number(input[lift] || 0);
    if (Number.isFinite(value) && value > 0) {
      output[lift] = value;
    }
  }

  return output;
};

export async function GET() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const clients = await getClients();

    const review = clients.map((client) => ({
      id: client.id,
      name: client.name,
      currentCycleNumber: client.currentCycleNumber || 1,
      cycleMembership: client.cycleMembership || [],
      oneRepMaxes: pickLiftNumbers(client.oneRepMaxes),
      trainingMaxes: pickLiftNumbers(client.trainingMaxes),
      oneRepMaxesByCycle: Object.fromEntries(
        Object.entries(client.oneRepMaxesByCycle || {}).map(([cycleNumber, maxes]) => [
          cycleNumber,
          pickLiftNumbers(maxes),
        ])
      ),
      trainingMaxesByCycle: Object.fromEntries(
        Object.entries(client.trainingMaxesByCycle || {}).map(([cycleNumber, maxes]) => [
          cycleNumber,
          pickLiftNumbers(maxes),
        ])
      ),
      weekAssignmentsByCycle: client.weekAssignmentsByCycle || {},
      movementCalibrationsByCycle: client.movementCalibrationsByCycle || {},
      movementProfilesByCycle: client.movementProfilesByCycle || {},
    }));

    return Response.json({
      success: true,
      count: review.length,
      clients: review,
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