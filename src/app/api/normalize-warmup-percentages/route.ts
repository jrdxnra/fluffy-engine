import { getAppSettings, getClients, saveAppSettings, updateClient } from '@/lib/data';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';
import type { CycleSettings } from '@/lib/types';

const normalizeWarmups = (cycleSettings: CycleSettings): CycleSettings => {
  const normalized: CycleSettings = JSON.parse(JSON.stringify(cycleSettings));

  for (const weekKey of Object.keys(normalized)) {
    const week = normalized[weekKey];
    if (!week?.percentages) continue;
    week.percentages.warmup1 = 0.5;
    week.percentages.warmup2 = 0.6;
  }

  return normalized;
};

const normalizeCycleSettingsByCycle = (
  cycleSettingsByCycle: Record<number, CycleSettings>
): Record<number, CycleSettings> => {
  const normalized: Record<number, CycleSettings> = {};

  for (const [cycleKey, cycleSettings] of Object.entries(cycleSettingsByCycle || {})) {
    normalized[Number(cycleKey)] = normalizeWarmups(cycleSettings);
  }

  return normalized;
};

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const appSettings = await getAppSettings();
    const normalizedCycleSettingsByCycle = normalizeCycleSettingsByCycle(appSettings.cycleSettingsByCycle);

    await saveAppSettings({
      cycleSettingsByCycle: normalizedCycleSettingsByCycle,
      cycleNames: appSettings.cycleNames,
      cycleSchedulesByCycle: appSettings.cycleSchedulesByCycle,
    });

    const clients = await getClients();
    let clientsUpdated = 0;

    for (const client of clients) {
      const clientCycleSettings = (client as any).cycleSettingsByCycle as Record<number, CycleSettings> | undefined;
      if (!clientCycleSettings || Object.keys(clientCycleSettings).length === 0) continue;

      const normalizedClientCycleSettings = normalizeCycleSettingsByCycle(clientCycleSettings);
      if (JSON.stringify(clientCycleSettings) === JSON.stringify(normalizedClientCycleSettings)) continue;

      await updateClient(client.id, {
        cycleSettingsByCycle: normalizedClientCycleSettings as any,
      } as any);
      clientsUpdated += 1;
    }

    return Response.json({
      success: true,
      cyclesUpdated: Object.keys(normalizedCycleSettingsByCycle).length,
      clientsUpdated,
      message: 'Warm-up percentages normalized to 50% / 60% across cycle settings.',
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
      message: 'Use POST to run warm-up normalization.',
    },
    { status: 405 }
  );
}
