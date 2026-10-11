import type { Client, CycleScheduleSettings, CycleWeekSettings, Lift, LoggedSetMap, MovementProfile, OneRepMaxSuggestion, SessionMode } from "@/lib/types";
import { getMovementProfileKeyForLift } from "@/lib/movement-profiles";
import { calculate1RM, mround } from "@/lib/utils";
import { isDeloadWeekSettings } from "@/lib/workout-week-settings";

/** How far a single update may raise a training max. High-rep sets overestimate a true max. */
export const ONE_REP_MAX_UPDATE_CAP = 0.1;
/** A logged set has to beat the stored 1RM by this much before an update is offered. */
const MIN_GAIN_OVER_STORED_ONE_REP_MAX = 0.05;

export const buildSuggestionSourceKey = (cycleNumber: number, weekKey: string): string => `${cycleNumber}:${weekKey}`;

/**
 * Offers a new 1RM / training max when a logged set shows the lifter is well past the
 * stored numbers. Never applied automatically - the coach accepts or ignores it.
 */
export const getOneRepMaxSuggestion = (args: {
  movementName: string;
  sourceKey: string;
  loggedSets?: LoggedSetMap;
  profile?: Pick<MovementProfile, "oneRepMax" | "trainingMax" | "lastPerformanceUpdateKey"> | null;
}): OneRepMaxSuggestion | null => {
  const { movementName, sourceKey, loggedSets, profile } = args;
  if (!profile || !(profile.oneRepMax > 0) || !(profile.trainingMax > 0)) return null;
  // One update per logged session, so the cap can't be stepped past by accepting twice.
  if (profile.lastPerformanceUpdateKey === sourceKey) return null;

  let best: { weight: number; reps: number; estimate: number } | null = null;
  for (const entry of Object.values(loggedSets || {})) {
    if (!entry || !(entry.weight > 0) || !(entry.reps > 0)) continue;
    const estimate = calculate1RM(entry.weight, entry.reps);
    if (!best || estimate > best.estimate) {
      best = { weight: entry.weight, reps: entry.reps, estimate };
    }
  }
  if (!best) return null;
  if (best.estimate < profile.oneRepMax * (1 + MIN_GAIN_OVER_STORED_ONE_REP_MAX)) return null;

  const uncappedOneRepMax = mround(best.estimate);
  const uncappedTrainingMax = mround(uncappedOneRepMax * 0.9);
  const maxTrainingMax = mround(profile.trainingMax * (1 + ONE_REP_MAX_UPDATE_CAP));
  const capped = uncappedTrainingMax > maxTrainingMax;
  const suggestedTrainingMax = capped ? maxTrainingMax : uncappedTrainingMax;
  if (suggestedTrainingMax < profile.trainingMax + 5) return null;

  // When capped, the stored 1RM is the smallest 5 lb step that keeps the training max at 90% or less.
  const suggestedOneRepMax = capped
    ? Math.max(profile.oneRepMax, Math.ceil(suggestedTrainingMax / 0.9 / 5) * 5)
    : uncappedOneRepMax;

  return {
    movementName,
    sourceKey,
    weight: best.weight,
    reps: best.reps,
    estimatedOneRepMax: best.estimate,
    currentOneRepMax: profile.oneRepMax,
    currentTrainingMax: profile.trainingMax,
    suggestedOneRepMax,
    suggestedTrainingMax,
    capped,
  };
};

/**
 * The client fields to save when the coach accepts a suggestion: the movement's own
 * numbers, plus the lift slot and top-level copies so every place agrees.
 */
export const buildOneRepMaxUpdate = (
  client: Client,
  cycleNumber: number,
  lift: Lift,
  suggestion: OneRepMaxSuggestion,
  now: string = new Date().toISOString()
): Pick<Client, "movementProfilesByCycle" | "oneRepMaxesByCycle" | "trainingMaxesByCycle" | "oneRepMaxes" | "trainingMaxes"> => {
  const cycleProfiles = client.movementProfilesByCycle?.[cycleNumber] || {};
  const existingProfile = cycleProfiles[suggestion.movementName];
  const cycleOneRepMaxes = { ...(client.oneRepMaxesByCycle?.[cycleNumber] || client.oneRepMaxes), [lift]: suggestion.suggestedOneRepMax };
  const cycleTrainingMaxes = { ...(client.trainingMaxesByCycle?.[cycleNumber] || client.trainingMaxes), [lift]: suggestion.suggestedTrainingMax };

  return {
    movementProfilesByCycle: {
      ...(client.movementProfilesByCycle || {}),
      [cycleNumber]: {
        ...cycleProfiles,
        [suggestion.movementName]: {
          ...existingProfile,
          oneRepMax: suggestion.suggestedOneRepMax,
          trainingMax: suggestion.suggestedTrainingMax,
          lastPerformanceUpdateKey: suggestion.sourceKey,
          lastUpdatedAt: now,
        },
      },
    },
    oneRepMaxesByCycle: { ...(client.oneRepMaxesByCycle || {}), [cycleNumber]: cycleOneRepMaxes },
    trainingMaxesByCycle: { ...(client.trainingMaxesByCycle || {}), [cycleNumber]: cycleTrainingMaxes },
    oneRepMaxes: { ...client.oneRepMaxes, [lift]: suggestion.suggestedOneRepMax },
    trainingMaxes: { ...client.trainingMaxes, [lift]: suggestion.suggestedTrainingMax },
  };
};

/**
 * The suggestion (if any) for one lifter's lift on the week being viewed. Deload weeks and
 * modified sessions (recovery, slide, etc.) never produce one.
 */
export const getWorkoutOneRepMaxSuggestion = (args: {
  client: Client;
  cycleNumber: number;
  weekKey: string;
  lift: Lift;
  schedule?: CycleScheduleSettings;
  weekSettings: CycleWeekSettings;
  sessionMode: SessionMode;
}): OneRepMaxSuggestion | null => {
  const { client, cycleNumber, weekKey, lift, schedule, weekSettings, sessionMode } = args;
  if (sessionMode !== "normal") return null;
  if (isDeloadWeekSettings(weekSettings, weekKey)) return null;

  const movementName = getMovementProfileKeyForLift(client, cycleNumber, lift, schedule);
  if (!movementName) return null;

  return getOneRepMaxSuggestion({
    movementName,
    sourceKey: buildSuggestionSourceKey(cycleNumber, weekKey),
    loggedSets: client.loggedSetInputsByCycle?.[cycleNumber]?.[weekKey]?.[lift],
    profile: client.movementProfilesByCycle?.[cycleNumber]?.[movementName],
  });
};
