import { getAppSettings, getClients, getCycleSettings, saveAppSettings, updateClient } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';
import type { CycleSettings } from '@/lib/types';

const cloneDefaultCycleSettings = (): CycleSettings => {
  return JSON.parse(JSON.stringify(getCycleSettings()));
};

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const { cycleSettingsByCycle, cycleNames } = await getAppSettings();
    const clients = await getClients();

    const cycleNumbers = Object.keys(cycleSettingsByCycle)
      .map(Number)
      .filter((cycleNumber) => !Number.isNaN(cycleNumber));

    const targetCycleNumbers = cycleNumbers.length > 0 ? cycleNumbers : [1];

    const resetCycleSettingsByCycle: Record<number, CycleSettings> = {};
    for (const cycleNumber of targetCycleNumbers) {
      resetCycleSettingsByCycle[cycleNumber] = cloneDefaultCycleSettings();
    }

    const saveResult = await saveAppSettings({
      cycleSettingsByCycle: resetCycleSettingsByCycle,
      cycleNames,
    }) as any;

    // Keep fallback/shared client-stored settings in sync as well.
    for (const client of clients) {
      await updateClient(client.id, {
        cycleSettingsByCycle: resetCycleSettingsByCycle as any,
        cycleNames: cycleNames as any,
        settingsUpdatedAt: saveResult.settingsUpdatedAt as any,
      } as any);
    }

    return Response.json({
      success: true,
      cyclesReset: targetCycleNumbers.length,
      clientsSynced: clients.length,
      message: `Reset week templates for ${targetCycleNumbers.length} cycle(s) to default 5/3/1 + Deload (Weeks 1-4).`,
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
      message: 'Use POST to reset weeks.',
    },
    { status: 405 }
  );
}
