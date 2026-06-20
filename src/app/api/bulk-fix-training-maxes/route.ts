import { getClients, updateClient } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';
import { calculateTrainingMaxes } from '@/lib/training-max';
import type { TrainingMaxes } from '@/lib/types';

interface ClientFix {
  name: string;
  clientId: string;
  cycle: number;
  oneRepMaxes: TrainingMaxes;
}

const fixes: ClientFix[] = [
  {
    name: 'Michael',
    clientId: '',
    cycle: 5,
    oneRepMaxes: { Deadlift: 285, Squat: 285, Bench: 210, Press: 140 },
  },
  {
    name: 'Michelle',
    clientId: '',
    cycle: 5,
    oneRepMaxes: { Deadlift: 210, Squat: 125, Bench: 92, Press: 55 },
  },
  {
    name: 'Yuriy',
    clientId: '',
    cycle: 4,
    oneRepMaxes: { Deadlift: 270, Squat: 210, Bench: 170, Press: 110 },
  },
  {
    name: 'Mick',
    clientId: '',
    cycle: 5,
    oneRepMaxes: { Deadlift: 285, Squat: 207, Bench: 175, Press: 110 },
  },
  {
    name: 'Hunter',
    clientId: '',
    cycle: 5,
    oneRepMaxes: { Deadlift: 232, Squat: 200, Bench: 140, Press: 95 },
  },
  {
    name: 'Mel',
    clientId: '',
    cycle: 5,
    oneRepMaxes: { Deadlift: 185, Squat: 165, Bench: 225, Press: 125 },
  },
  {
    name: 'Kristina',
    clientId: '',
    cycle: 5,
    oneRepMaxes: { Deadlift: 165, Squat: 125, Bench: 117, Press: 90 },
  },
  {
    name: 'JJ',
    clientId: '',
    cycle: 5,
    oneRepMaxes: { Deadlift: 240, Squat: 210, Bench: 170, Press: 135 },
  },
];

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const clients = await getClients();

    // Map client names to IDs
    const nameToId = new Map(clients.map((c) => [c.name, c.id]));
    const fixesWithIds = fixes.map((f) => ({
      ...f,
      clientId: nameToId.get(f.name) || '',
    }));

    const results: Array<{
      name: string;
      cycle: number;
      before: Record<string, Record<string, number>>;
      after: Record<string, Record<string, number>>;
      success: boolean;
      error?: string;
    }> = [];

    for (const fix of fixesWithIds) {
      if (!fix.clientId) {
        results.push({
          name: fix.name,
          cycle: fix.cycle,
          before: {},
          after: {},
          success: false,
          error: 'Client not found',
        });
        continue;
      }

      const client = clients.find((c) => c.id === fix.clientId);
      if (!client) {
        results.push({
          name: fix.name,
          cycle: fix.cycle,
          before: {},
          after: {},
          success: false,
          error: 'Client not found',
        });
        continue;
      }

      const before = {
        oneRepMaxes: { ...(client.oneRepMaxesByCycle?.[fix.cycle] || client.oneRepMaxes) },
        trainingMaxes: { ...(client.trainingMaxesByCycle?.[fix.cycle] || client.trainingMaxes) },
      };

      const correctedTMs = calculateTrainingMaxes(fix.oneRepMaxes);

      await updateClient(fix.clientId, {
        oneRepMaxesByCycle: {
          ...(client.oneRepMaxesByCycle || {}),
          [fix.cycle]: fix.oneRepMaxes,
        },
        trainingMaxesByCycle: {
          ...(client.trainingMaxesByCycle || {}),
          [fix.cycle]: correctedTMs,
        },
      });

      const after = {
        oneRepMaxes: fix.oneRepMaxes,
        trainingMaxes: correctedTMs,
      };

      results.push({
        name: fix.name,
        cycle: fix.cycle,
        before,
        after,
        success: true,
      });
    }

    return Response.json({
      success: true,
      updated: results.filter((r) => r.success).length,
      total: results.length,
      results,
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
      message: 'Use POST to run bulk fix.',
    },
    { status: 405 }
  );
}
