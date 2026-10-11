import type { Client, CycleScheduleSettings, GlobalMovementSettings, Lift, LiftProgressStatus, MovementProfile } from "@/lib/types";
import { isLiftCalibrationRequired } from "@/lib/calibration";
import { withCycleAdded } from "@/lib/cycle-membership";
import { getDefaultMovementProgressionIncrement, normalizeMovementName } from "@/lib/movement-profiles";
import { getLiftDisplayName, resolveClientMovementName } from "@/lib/schedule";
import { getClientForTrainingGroup } from "@/lib/training-groups";

const lifts: Lift[] = ["Squat", "Deadlift", "Bench", "Press"];

const defaultSlotIncrement: Record<Lift, number> = {
  Squat: 10,
  Deadlift: 10,
  Bench: 5,
  Press: 5,
};

export type GraduationOptions = {
  noIncrementLifts?: Lift[];
  calibrationLifts?: Lift[];
};

export type GraduationParams = {
  groupId?: string;
  /** Cycle the client moves into. Defaults to the client's own current cycle + 1. */
  targetCycle?: number;
  /** The group's current cycle; lets a member who fell behind graduate from their latest numbers. */
  groupCurrentCycle?: number;
  /** Schedule of the cycle being graduated FROM (decides which movement each lift slot trained). */
  currentCycleSchedule?: CycleScheduleSettings;
  globalMovementSettings?: GlobalMovementSettings;
  options?: GraduationOptions;
  now?: string;
};

export const getGraduationSourceCycle = (
  client: Client,
  groupId?: string,
  groupCurrentCycle?: number
): number => {
  const ownCycle = (groupId ? client.programStateByGroup?.[groupId]?.currentCycleNumber : undefined) ?? client.currentCycleNumber ?? 1;
  if (!groupCurrentCycle || ownCycle >= groupCurrentCycle) return ownCycle;

  // A member who fell behind the group graduates from their most recent numbers,
  // not from the old cycle their schedule position is stuck on.
  const strengthCycles = [
    ...Object.keys(client.movementProfilesByCycle || {}),
    ...Object.keys(client.trainingMaxesByCycle || {}),
  ]
    .map(Number)
    .filter((cycle) => Number.isFinite(cycle) && cycle > ownCycle && cycle <= groupCurrentCycle);
  return strengthCycles.length > 0 ? Math.max(...strengthCycles) : ownCycle;
};

/**
 * Whether a lift is on hold or still calibrating for the cycle. The coaching screen shows
 * this, and graduation uses the same rule to decide what goes up.
 * `client` must carry the schedule position being viewed (group-projected for a group).
 */
export const getLiftProgressStatus = (
  client: Client,
  cycleNumber: number,
  lift: Lift,
  profile?: MovementProfile | null
): LiftProgressStatus => {
  const explicit = Boolean(client.movementCalibrationsByCycle?.[cycleNumber]?.[lift]?.needsCalibration);
  const calibrating = explicit
    || (Boolean(profile?.calibrationPhaseActive) && isLiftCalibrationRequired(client, cycleNumber, lift, profile, false));
  return { hold: Boolean(profile?.progressionHoldActive), calibrating };
};

/**
 * Builds the client as they should look after graduating into the next cycle.
 * Pure: no database access. Used by the server (graduateTeam) and by the desktop
 * screen's local state so the two can never drift apart.
 *
 * Rules:
 * - Only movements actually trained this cycle (assigned to a lift slot) go up.
 *   Other stored movements are carried forward unchanged.
 * - A movement is held when its progression hold is on, or it is genuinely still in
 *   calibration. A leftover calibration flag on a lift with a full cycle of logged
 *   history does not hold it, and is cleared.
 * - Each lift slot's training max follows its movement's training max, so the two
 *   numbers stay the same.
 */
export const buildGraduatedClient = (client: Client, params: GraduationParams = {}): Client => {
  const { groupId, currentCycleSchedule, globalMovementSettings } = params;
  const now = params.now ?? new Date().toISOString();
  const noIncrementLiftSet = new Set(params.options?.noIncrementLifts || []);
  const calibrationLiftSet = new Set(params.options?.calibrationLifts || []);

  const sourceCycle = getGraduationSourceCycle(client, groupId, params.groupCurrentCycle);
  const nextCycle = params.targetCycle ?? sourceCycle + 1;
  // Schedule position (logs, week assignments, movement choice) lives per group.
  const view = groupId ? getClientForTrainingGroup(client, groupId) : client;

  const sourceProfiles = client.movementProfilesByCycle?.[sourceCycle] || {};

  const findProfileKey = (lift: Lift): string | undefined => {
    const candidates = [
      resolveClientMovementName(view, sourceCycle, lift, currentCycleSchedule),
      getLiftDisplayName(lift, currentCycleSchedule),
      lift,
    ].filter(Boolean);
    for (const candidate of candidates) {
      const normalized = normalizeMovementName(candidate);
      const match = Object.keys(sourceProfiles).find((key) => normalizeMovementName(key) === normalized);
      if (match) return match;
    }
    return undefined;
  };

  const profileKeyByLift = {} as Partial<Record<Lift, string>>;
  const liftByProfileKey = new Map<string, Lift>();
  for (const lift of lifts) {
    const key = findProfileKey(lift);
    if (!key) continue;
    profileKeyByLift[lift] = key;
    if (!liftByProfileKey.has(key)) liftByProfileKey.set(key, lift);
  }

  const isStillCalibrating = (lift: Lift, profile?: MovementProfile): boolean => {
    return getLiftProgressStatus(view, sourceCycle, lift, profile).calibrating;
  };

  const isHeld = (lift: Lift, profile?: MovementProfile): boolean => {
    const status = getLiftProgressStatus(view, sourceCycle, lift, profile);
    return status.hold || status.calibrating;
  };

  const nextProfiles: Record<string, MovementProfile> = {
    ...(client.movementProfilesByCycle?.[nextCycle] || {}),
  };
  for (const [movementName, profile] of Object.entries(sourceProfiles)) {
    const trackedLift = liftByProfileKey.get(movementName);
    if (!trackedLift) {
      // Not trained this cycle: keep the numbers exactly as they are.
      nextProfiles[movementName] = { ...profile };
      continue;
    }

    const held = isHeld(trackedLift, profile);
    const increment = held
      ? 0
      : (profile.progressionIncrement || getDefaultMovementProgressionIncrement(movementName, globalMovementSettings));
    nextProfiles[movementName] = {
      ...profile,
      trainingMax: profile.trainingMax + increment,
      calibrationPhaseActive: isStillCalibrating(trackedLift, profile),
      movementCycleNumber: (profile.movementCycleNumber || 1) + 1,
      lastUpdatedAt: now,
    };
  }

  const sourceTrainingMaxes = client.trainingMaxesByCycle?.[sourceCycle] ?? client.trainingMaxes;
  const sourceOneRepMaxes = client.oneRepMaxesByCycle?.[sourceCycle] || client.oneRepMaxes;
  const nextTrainingMaxes = { ...sourceTrainingMaxes };
  const nextOneRepMaxes = { ...sourceOneRepMaxes };

  for (const lift of lifts) {
    if (calibrationLiftSet.has(lift)) {
      // The slot gets a new movement next cycle: start it blank so it calibrates.
      nextTrainingMaxes[lift] = 0;
      nextOneRepMaxes[lift] = 0;
      continue;
    }

    const profileKey = profileKeyByLift[lift];
    const nextProfile = profileKey ? nextProfiles[profileKey] : undefined;
    if (nextProfile) {
      nextTrainingMaxes[lift] = nextProfile.trainingMax;
      nextOneRepMaxes[lift] = nextProfile.oneRepMax;
      continue;
    }

    const held = noIncrementLiftSet.has(lift) || isHeld(lift, undefined);
    nextTrainingMaxes[lift] = (sourceTrainingMaxes?.[lift] || 0) + (held ? 0 : defaultSlotIncrement[lift]);
  }

  // Any cycle at or beyond the new one is replaced, so reusing a cycle number can't compound.
  const nextTrainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
  for (const cycleKey of Object.keys(nextTrainingMaxesByCycle)) {
    const cycle = Number(cycleKey);
    if (!Number.isNaN(cycle) && cycle >= nextCycle) {
      nextTrainingMaxesByCycle[cycle] = { ...nextTrainingMaxes };
    }
  }
  nextTrainingMaxesByCycle[nextCycle] = { ...nextTrainingMaxes };

  const nextCalibration = { ...(client.movementCalibrationsByCycle?.[nextCycle] || {}) };
  for (const lift of calibrationLiftSet) {
    nextCalibration[lift] = { needsCalibration: true };
  }

  const defaultWeekAssignments = { week1: "5", week2: "3", week3: "1" };
  const scheduleProgress = groupId
    ? {
        programStateByGroup: {
          ...(client.programStateByGroup || {}),
          [groupId]: {
            ...(client.programStateByGroup?.[groupId] || {}),
            currentCycleNumber: nextCycle,
            cycleMembership: Array.from(
              new Set([...(client.programStateByGroup?.[groupId]?.cycleMembership || []), nextCycle])
            ).sort((a, b) => a - b),
            weekAssignmentsByCycle: {
              ...(client.programStateByGroup?.[groupId]?.weekAssignmentsByCycle || {}),
              [nextCycle]: defaultWeekAssignments,
            },
          },
        },
      }
    : {
        currentCycleNumber: nextCycle,
        cycleMembership: withCycleAdded(client, nextCycle),
        weekAssignmentsByCycle: {
          ...(client.weekAssignmentsByCycle || {}),
          [nextCycle]: defaultWeekAssignments,
        },
      };

  return {
    ...client,
    ...scheduleProgress,
    oneRepMaxesByCycle: {
      ...(client.oneRepMaxesByCycle || {}),
      [nextCycle]: nextOneRepMaxes,
    },
    oneRepMaxes: nextOneRepMaxes,
    trainingMaxes: nextTrainingMaxes,
    trainingMaxesByCycle: nextTrainingMaxesByCycle,
    movementCalibrationsByCycle: {
      ...(client.movementCalibrationsByCycle || {}),
      [nextCycle]: nextCalibration,
    },
    movementProfilesByCycle: {
      ...(client.movementProfilesByCycle || {}),
      [nextCycle]: nextProfiles,
    },
  };
};

export type GraduationPreviewRow = {
  lift: Lift;
  movementName: string;
  before: number;
  after: number;
  /** Why the number does or doesn't move. */
  outcome: "up" | "hold" | "calibrating" | "new-movement" | "no-numbers";
};

/**
 * What graduation will do to each of a client's four lifts, without saving anything.
 * Built from buildGraduatedClient, so the preview and the real graduation cannot disagree.
 */
export const getGraduationPreview = (client: Client, params: GraduationParams = {}): GraduationPreviewRow[] => {
  const { groupId, currentCycleSchedule } = params;
  const sourceCycle = getGraduationSourceCycle(client, groupId, params.groupCurrentCycle);
  const nextCycle = params.targetCycle ?? sourceCycle + 1;
  const view = groupId ? getClientForTrainingGroup(client, groupId) : client;
  const graduated = buildGraduatedClient(client, params);
  const calibrationLiftSet = new Set(params.options?.calibrationLifts || []);
  const sourceProfiles = client.movementProfilesByCycle?.[sourceCycle] || {};

  return (["Deadlift", "Bench", "Squat", "Press"] as Lift[]).map((lift) => {
    const movementName = resolveClientMovementName(view, sourceCycle, lift, currentCycleSchedule);
    const profileKey = [movementName, getLiftDisplayName(lift, currentCycleSchedule), lift]
      .map((candidate) => Object.keys(sourceProfiles).find((key) => normalizeMovementName(key) === normalizeMovementName(candidate)))
      .find(Boolean);
    const profile = profileKey ? sourceProfiles[profileKey] : undefined;
    const before = profile?.trainingMax ?? (client.trainingMaxesByCycle?.[sourceCycle] ?? client.trainingMaxes)?.[lift] ?? 0;
    const after = graduated.trainingMaxesByCycle?.[nextCycle]?.[lift] ?? 0;
    const status = getLiftProgressStatus(view, sourceCycle, lift, profile);

    let outcome: GraduationPreviewRow["outcome"] = "up";
    if (calibrationLiftSet.has(lift)) outcome = "new-movement";
    else if (!(before > 0)) outcome = "no-numbers";
    else if (status.calibrating) outcome = "calibrating";
    else if (status.hold || after === before) outcome = "hold";

    return { lift, movementName, before, after, outcome };
  });
};
