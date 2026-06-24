import { getAppSettings, getClients, updateClient } from "@/lib/data";
import { resolveClientMovementName } from "@/lib/schedule";
import { getDefaultMovementProgressionIncrement, normalizeMovementName, resolveMovementClassType } from "@/lib/movement-profiles";
import type { Lift, MovementProfile } from "@/lib/types";

type Mode = "hold" | "progress";

const lifts: Lift[] = ["Squat", "Bench", "Deadlift", "Press"];

const isLift = (value: string): value is Lift => {
  return lifts.includes(value as Lift);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientId = String(body?.clientId || "");
    const cycleNumber = Number(body?.cycleNumber || 0);
    const lift = String(body?.lift || "");
    const mode = String(body?.mode || "") as Mode;

    if (!clientId || !cycleNumber || !isLift(lift) || !["hold", "progress"].includes(mode)) {
      return Response.json({ success: false, message: "Invalid request payload." }, { status: 400 });
    }

    const [clients, appSettings] = await Promise.all([getClients(), getAppSettings()]);
    const client = clients.find((entry) => entry.id === clientId);

    if (!client) {
      return Response.json({ success: false, message: "Client not found." }, { status: 404 });
    }

    const schedule = appSettings.cycleSchedulesByCycle?.[cycleNumber];
    const selectedMovementName = resolveClientMovementName(client, cycleNumber, lift, schedule);

    const profilesForCycle = {
      ...(client.movementProfilesByCycle?.[cycleNumber] || {}),
    } as Record<string, MovementProfile>;

    const normalizedTarget = normalizeMovementName(selectedMovementName);
    const existingKey = Object.keys(profilesForCycle).find(
      (key) => normalizeMovementName(key) === normalizedTarget
    ) || selectedMovementName;

    const cycleOneRepMax = client.oneRepMaxesByCycle?.[cycleNumber]?.[lift] ?? client.oneRepMaxes[lift] ?? 0;
    const cycleTrainingMax = client.trainingMaxesByCycle?.[cycleNumber]?.[lift] ?? client.trainingMaxes[lift] ?? 0;

    const previous = profilesForCycle[existingKey] || {
      oneRepMax: cycleOneRepMax,
      trainingMax: cycleTrainingMax,
      classType: resolveMovementClassType(selectedMovementName, appSettings.globalMovementSettings, lift),
      progressionIncrement: getDefaultMovementProgressionIncrement(selectedMovementName, appSettings.globalMovementSettings, lift),
      progressionHoldActive: false,
      movementCycleNumber: cycleNumber,
      calibrationPhaseActive: false,
    };

    const nextProfile: MovementProfile = {
      ...previous,
      progressionHoldActive: mode === "hold",
      calibrationPhaseActive: false,
      lastUpdatedAt: new Date().toISOString(),
    };

    profilesForCycle[existingKey] = nextProfile;

    const nextCalibrations = {
      ...(client.movementCalibrationsByCycle || {}),
      [cycleNumber]: {
        ...(client.movementCalibrationsByCycle?.[cycleNumber] || {}),
        [lift]: {
          ...(client.movementCalibrationsByCycle?.[cycleNumber]?.[lift] || {}),
          needsCalibration: false,
        },
      },
    };

    await updateClient(clientId, {
      movementProfilesByCycle: {
        ...(client.movementProfilesByCycle || {}),
        [cycleNumber]: profilesForCycle,
      },
      movementCalibrationsByCycle: nextCalibrations,
    });

    return Response.json({
      success: true,
      status: {
        progressionHoldActive: nextProfile.progressionHoldActive,
        calibrationPhaseActive: nextProfile.calibrationPhaseActive,
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update movement status." },
      { status: 500 }
    );
  }
}
