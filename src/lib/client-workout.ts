import type { CalculatedWorkout, Client, CycleScheduleSettings, CycleSettings, HistoricalRecord, Lift, SessionMode } from "@/lib/types";
import { calculateWorkout } from "@/lib/utils";
import { resolveWorkoutWeekSettings } from "@/lib/workout-week-settings";
import { getMovementProfileForLift } from "@/lib/movement-profiles";
import { isLiftCalibrationRequired } from "@/lib/calibration";

const weekNumberOf = (weekKey: string): number => parseInt(weekKey.match(/\d+/)?.[0] || "0", 10);

export const sortWeekKeys = (cycleSettings: CycleSettings): string[] =>
  Object.keys(cycleSettings).sort((a, b) => weekNumberOf(a) - weekNumberOf(b));

export type ClientLiftWorkoutParams = {
  client: Client;
  lift: Lift;
  weekKey: string;
  cycleNumber: number;
  cycleSettings: CycleSettings;
  schedule?: CycleScheduleSettings;
  historicalData: HistoricalRecord[];
};

/**
 * One lifter's prescribed sets for one lift in one week of a cycle: the week they actually run (slide mode runs an
 * earlier week), their rep scheme, their movement's training max, calibration (weights hidden until tested) and the
 * session mode. Empty sets mean no session (paused week, "N/A", or no such week). Used by the coaching screen on
 * the computer and the phone, and by the month copy.
 */
export const calculateClientLiftWorkout = ({
  client,
  lift,
  weekKey,
  cycleNumber,
  cycleSettings,
  schedule,
  historicalData,
}: ClientLiftWorkoutParams): CalculatedWorkout & { sessionMode: SessionMode; effectiveWeekKey: string } => {
  const sessionState = client.sessionStateByCycle?.[cycleNumber];
  const mode: SessionMode = sessionState?.modeByWeek?.[weekKey] || sessionState?.mode || "normal";

  let effectiveWeekKey = weekKey;
  if (mode === "slide") {
    const flowWeekKey = sessionState?.flowWeekKeyByWeek?.[weekKey] || sessionState?.flowWeekKey;
    if (flowWeekKey && cycleSettings[flowWeekKey]) {
      effectiveWeekKey = flowWeekKey;
    } else {
      const sortedWeekKeys = sortWeekKeys(cycleSettings);
      const index = sortedWeekKeys.indexOf(weekKey);
      if (index > 0) effectiveWeekKey = sortedWeekKeys[index - 1];
    }
  }

  const noSession = { client, sets: [], prTarget: undefined, sessionMode: mode, effectiveWeekKey };
  if (!cycleSettings[weekKey] || mode === "pause_week") return noSession;

  const effectiveWeekSettings = cycleSettings[effectiveWeekKey];
  if (!effectiveWeekSettings) return noSession;

  const assignedRepScheme = client.weekAssignmentsByCycle?.[cycleNumber]?.[effectiveWeekKey] || undefined;
  if (assignedRepScheme === "N/A") return noSession;

  const workoutWeekSettings =
    resolveWorkoutWeekSettings(cycleSettings, effectiveWeekKey, assignedRepScheme) || effectiveWeekSettings;
  const movementProfile = getMovementProfileForLift(client, cycleNumber, lift, schedule);

  const workout = calculateWorkout(
    client,
    lift,
    workoutWeekSettings,
    historicalData,
    cycleNumber,
    movementProfile
      ? { oneRepMaxOverride: movementProfile.oneRepMax, trainingMaxOverride: movementProfile.trainingMax }
      : undefined
  );

  const needsCalibration = isLiftCalibrationRequired(
    client,
    cycleNumber,
    lift,
    movementProfile,
    Boolean(client.movementCalibrationsByCycle?.[cycleNumber]?.[lift]?.needsCalibration)
  );
  const hasMovementOneRepMax = Boolean(movementProfile && movementProfile.oneRepMax > 0);
  if (needsCalibration && weekNumberOf(effectiveWeekKey) === 1 && !hasMovementOneRepMax) {
    workout.sets = workout.sets.map((set) => ({ ...set, weight: 0, plates: "" }));
  }

  if (mode === "recovery") {
    workout.prTarget = undefined;
    workout.sets = workout.sets.map((set) =>
      set.type === "Work Set" && set.set === 3
        ? { ...set, reps: typeof set.reps === "string" ? set.reps.replace("+", "") : set.reps }
        : set
    );
  }

  if (mode === "jack_shit") {
    workout.prTarget = undefined;
    workout.sets = workout.sets.filter((set) => set.type === "Work Set");
  }

  return { ...workout, sessionMode: mode, effectiveWeekKey };
};
