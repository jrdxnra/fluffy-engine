import { getAppSettings, saveAppSettings } from "@/lib/data";
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from "@/lib/maintenance-routes";

const DELOAD_PERCENTAGES = {
  warmup1: 0.5,
  warmup2: 0.6,
  workset1: 0.4,
  workset2: 0.5,
  workset3: 0.6,
};

const DELOAD_REPS = {
  workset1: 5,
  workset2: 5,
  workset3: "5",
};

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const { cycleSettingsByCycle, cycleNames } = await getAppSettings();

    const fixedByCycle: Record<number, Record<string, unknown>> = {};
    const fixedWeeks: string[] = [];

    for (const [cycleKey, cycleSettings] of Object.entries(cycleSettingsByCycle)) {
      const cycleNumber = Number(cycleKey);
      const updatedCycle: Record<string, unknown> = {};

      for (const [weekKey, weekSettings] of Object.entries(cycleSettings || {})) {
        const weekNum = parseInt(weekKey.match(/\d+/)?.[0] || "0", 10);
        const isDeload =
          (weekSettings as { name?: string }).name?.toLowerCase().includes("deload") ||
          weekNum === 4;

        if (isDeload) {
          // Restore correct deload percentages and reps, preserve everything else
          updatedCycle[weekKey] = {
            ...weekSettings,
            percentages: { ...DELOAD_PERCENTAGES },
            reps: { ...DELOAD_REPS },
          };
          fixedWeeks.push(`Cycle ${cycleNumber} ${weekKey}`);
        } else {
          updatedCycle[weekKey] = weekSettings;
        }
      }

      fixedByCycle[cycleNumber] = updatedCycle;
    }

    await saveAppSettings({
      cycleSettingsByCycle: fixedByCycle as any,
      cycleNames,
    });

    return Response.json({
      success: true,
      fixedWeeks,
      message: `Restored deload percentages (40/50/60%) and reps (5/5/5) for ${fixedWeeks.length} week(s).`,
    });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    description: "POST to restore correct deload week settings (percentages + reps) across all cycles.",
    deloadPercentages: DELOAD_PERCENTAGES,
    deloadReps: DELOAD_REPS,
  });
}
