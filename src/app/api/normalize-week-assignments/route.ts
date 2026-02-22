import { getAppSettings, getClients, updateClient } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';
import type { CycleSettings } from '@/lib/types';

const getRepScheme = (workset3Reps: string | number | undefined): string => {
  if (workset3Reps === undefined || workset3Reps === null) return '?';
  return typeof workset3Reps === 'string'
    ? workset3Reps.replace(/\D/g, '') || '?'
    : workset3Reps.toString();
};

const normalizeWeekAssignmentsForCycle = (
  assignments: Record<string, string> | undefined,
  cycleSettings: CycleSettings | undefined
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  if (!assignments || !cycleSettings) return normalized;

  for (const [weekKey, repScheme] of Object.entries(assignments)) {
    const weekSettings = cycleSettings[weekKey];
    if (!weekSettings) continue;

    const globalRepScheme = getRepScheme(weekSettings.reps?.workset3);
    if (repScheme === 'N/A' || repScheme !== globalRepScheme) {
      normalized[weekKey] = repScheme;
    }
  }

  return normalized;
};

const normalizeAssignmentsByCycle = (
  assignmentsByCycle: Record<number, Record<string, string>> | undefined,
  cycleSettingsByCycle: Record<number, CycleSettings>
): Record<number, Record<string, string>> => {
  const cleaned: Record<number, Record<string, string>> = {};
  if (!assignmentsByCycle) return cleaned;

  for (const [cycleKey, assignments] of Object.entries(assignmentsByCycle)) {
    const cycleNumber = Number(cycleKey);
    if (Number.isNaN(cycleNumber)) continue;

    const normalizedCycleAssignments = normalizeWeekAssignmentsForCycle(
      assignments,
      cycleSettingsByCycle[cycleNumber]
    );

    if (Object.keys(normalizedCycleAssignments).length > 0) {
      cleaned[cycleNumber] = normalizedCycleAssignments;
    }
  }

  return cleaned;
};

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const clients = await getClients();
    const { cycleSettingsByCycle } = await getAppSettings();

    let scanned = 0;
    let updated = 0;

    for (const client of clients) {
      scanned += 1;
      const current = (client.weekAssignmentsByCycle || {}) as Record<number, Record<string, string>>;
      const normalized = normalizeAssignmentsByCycle(current, cycleSettingsByCycle);

      if (JSON.stringify(current) !== JSON.stringify(normalized)) {
        await updateClient(client.id, {
          weekAssignmentsByCycle: normalized,
        });
        updated += 1;
      }
    }

    return Response.json({
      success: true,
      scanned,
      updated,
      message: `Normalized week assignments for ${updated} of ${scanned} clients.`,
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
      message: 'Use POST to run normalization.',
    },
    { status: 405 }
  );
}
