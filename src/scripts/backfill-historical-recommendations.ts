import "dotenv/config";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAppSettings, getClients, getHistoricalData } from "@/lib/data";
import { calculateWorkout } from "@/lib/utils";
import { resolveWorkoutWeekSettings } from "@/lib/workout-week-settings";
import { getLiftDisplayName } from "@/lib/schedule";
import { getMovementProfileForCycle } from "@/lib/movement-profiles";
import type { Client, HistoricalRecord, Lift } from "@/lib/types";

const toDayStamp = (iso: string): number | null => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const resolveSessionContext = (
  client: Client,
  record: HistoricalRecord
): { cycleNumber: number; weekKey: string } => {
  const defaultContext = {
    cycleNumber: client.currentCycleNumber || 1,
    weekKey: "week1",
  };

  const cycleEntries = client.loggedSetInputsByCycle || {};
  const recordDayStamp = toDayStamp(record.date);
  if (recordDayStamp === null) return defaultContext;

  let exactAnyLiftMatch: { cycleNumber: number; weekKey: string } | null = null;
  let nearestMatch: { cycleNumber: number; weekKey: string; dayDistance: number } | null = null;

  for (const [cycleKey, weeks] of Object.entries(cycleEntries)) {
    const cycleNumber = Number(cycleKey);
    if (Number.isNaN(cycleNumber)) continue;

    for (const [weekKey, weekMap] of Object.entries(weeks || {})) {
      for (const [liftName, liftMap] of Object.entries(weekMap || {})) {
        if (!liftMap) continue;

        for (const entry of Object.values(liftMap)) {
          if (!entry?.updatedAt) continue;
          const entryDayStamp = toDayStamp(entry.updatedAt);
          if (entryDayStamp === null) continue;

          if (entryDayStamp === recordDayStamp && liftName === record.lift) {
            return { cycleNumber, weekKey };
          }

          if (entryDayStamp === recordDayStamp) {
            exactAnyLiftMatch = { cycleNumber, weekKey };
            continue;
          }

          const dayDistance = Math.abs(entryDayStamp - recordDayStamp);
          if (!nearestMatch || dayDistance < nearestMatch.dayDistance) {
            nearestMatch = { cycleNumber, weekKey, dayDistance };
          }
        }
      }
    }
  }

  if (exactAnyLiftMatch) return exactAnyLiftMatch;
  if (nearestMatch) return { cycleNumber: nearestMatch.cycleNumber, weekKey: nearestMatch.weekKey };
  return defaultContext;
};

async function main() {
  const [clients, historicalData, appSettings] = await Promise.all([
    getClients(),
    getHistoricalData(),
    getAppSettings(),
  ]);

  const clientsById = new Map(clients.map((client) => [client.id, client]));
  let updated = 0;
  let skipped = 0;

  for (const record of historicalData) {
    if (!record.id) {
      skipped += 1;
      continue;
    }

    const client = clientsById.get(record.clientId);
    if (!client) {
      skipped += 1;
      continue;
    }

    const { cycleNumber, weekKey } = resolveSessionContext(client, record);
    const cycleSettings = appSettings.cycleSettingsByCycle[cycleNumber];
    const baseWeekSettings = cycleSettings?.[weekKey];
    if (!cycleSettings || !baseWeekSettings) {
      skipped += 1;
      continue;
    }

    const assignedScheme = client.weekAssignmentsByCycle?.[cycleNumber]?.[weekKey] || undefined;
    const workoutWeekSettings =
      resolveWorkoutWeekSettings(cycleSettings, weekKey, assignedScheme) || baseWeekSettings;

    const movementName = getLiftDisplayName(
      record.lift as Lift,
      appSettings.cycleSchedulesByCycle?.[cycleNumber]
    );
    const movementProfile = getMovementProfileForCycle(client, cycleNumber, movementName);

    const workout = calculateWorkout(
      client,
      record.lift as Lift,
      workoutWeekSettings,
      historicalData,
      cycleNumber,
      movementProfile
        ? {
            oneRepMaxOverride: movementProfile.oneRepMax,
            trainingMaxOverride: movementProfile.trainingMax,
          }
        : undefined
    );

    const topSet = workout.sets.find((set) => set.type === "Work Set" && set.set === 3);
    const recommendedTopSetReps = topSet
      ? parseInt(String(topSet.reps).replace(/\D/g, ""), 10)
      : undefined;
    const recommendedTarget1RM = topSet && recommendedTopSetReps
      ? Math.round(topSet.weight * (1 + recommendedTopSetReps / 30))
      : undefined;

    const nextValues = {
      recommendedTrainingMax: workout.trainingMax ?? null,
      recommendedTopSetWeight: topSet?.weight ?? null,
      recommendedTopSetReps: recommendedTopSetReps ?? null,
      recommendedTarget1RM: recommendedTarget1RM ?? null,
    };

    const isUnchanged =
      (record.recommendedTrainingMax ?? null) === nextValues.recommendedTrainingMax &&
      ((record as HistoricalRecord & { recommendedTopSetWeight?: number | null }).recommendedTopSetWeight ?? null) === nextValues.recommendedTopSetWeight &&
      ((record as HistoricalRecord & { recommendedTopSetReps?: number | null }).recommendedTopSetReps ?? null) === nextValues.recommendedTopSetReps &&
      ((record as HistoricalRecord & { recommendedTarget1RM?: number | null }).recommendedTarget1RM ?? null) === nextValues.recommendedTarget1RM;

    if (isUnchanged) {
      skipped += 1;
      continue;
    }

    await updateDoc(doc(db, "historicalRecords", record.id), nextValues);
    updated += 1;
  }

  console.log(JSON.stringify({ total: historicalData.length, updated, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
