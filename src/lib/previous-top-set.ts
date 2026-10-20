import type { Client, CycleScheduleSettings, CycleSettings, Lift, PreviousTopSet } from "@/lib/types";
import { normalizeMovementName } from "@/lib/movement-profiles";
import { resolveClientMovementName } from "@/lib/schedule";
import { isDeloadWeekSettings } from "@/lib/workout-week-settings";

const weekNumberOf = (weekKey: string): number => parseInt(weekKey.match(/\d+/)?.[0] || "0", 10);

const digitsOf = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  return String(value).replace(/\D/g, "") || null;
};

/**
 * The lifter's most recent logged top set for this lift before the week being viewed,
 * at the same rep scheme (a 3+ week compares against the last 3+ week, not last week's 5+).
 * Searches earlier weeks of this cycle, then keeps walking back through earlier cycles
 * until it finds a logged week at that rep scheme, stopping at the first cycle where the
 * lift slot trained a different movement. Deload weeks are skipped - they say nothing
 * about strength. A week's rep scheme is the client's own assignment for it when they
 * have one, otherwise the program's. When the viewed week's rep scheme is unknown, any
 * non-deload week counts.
 */
export const getPreviousTopSet = (args: {
  client: Client;
  cycleNumber: number;
  weekKey: string;
  lift: Lift;
  cycleSettingsByCycle: Record<number, CycleSettings>;
  currentSchedule?: CycleScheduleSettings;
  previousCycleSchedule?: CycleScheduleSettings;
  /** Schedules for earlier cycles, so the search can reach back more than one cycle. */
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>;
}): PreviousTopSet | null => {
  const {
    client, cycleNumber, weekKey, lift, cycleSettingsByCycle, currentSchedule, previousCycleSchedule, cycleSchedulesByCycle,
  } = args;

  const scheduleFor = (cycle: number): CycleScheduleSettings | undefined =>
    cycle === cycleNumber
      ? currentSchedule ?? cycleSchedulesByCycle?.[cycle]
      : cycleSchedulesByCycle?.[cycle] ?? (cycle === cycleNumber - 1 ? previousCycleSchedule : undefined);
  const movementIn = (cycle: number) => normalizeMovementName(resolveClientMovementName(client, cycle, lift, scheduleFor(cycle)));
  const currentMovement = movementIn(cycleNumber);

  // Older cycles' settings may not be loaded; the program template's same week is the best guess then.
  const weekSettingsFor = (cycle: number, key: string) =>
    cycleSettingsByCycle[cycle]?.[key] ?? cycleSettingsByCycle[cycleNumber]?.[key];
  const repSchemeOf = (cycle: number, key: string): string | null =>
    digitsOf(client.weekAssignmentsByCycle?.[cycle]?.[key]) ?? digitsOf(weekSettingsFor(cycle, key)?.reps?.workset3);

  const targetRepScheme = repSchemeOf(cycleNumber, weekKey);

  const search = (cycle: number, beforeWeekNumber: number): PreviousTopSet | null => {
    const cycleLogs = client.loggedSetInputsByCycle?.[cycle] || {};
    const weekKeys = Object.keys(cycleLogs)
      .filter((key) => weekNumberOf(key) < beforeWeekNumber)
      .sort((a, b) => weekNumberOf(b) - weekNumberOf(a));

    for (const candidateWeek of weekKeys) {
      const weekSettings = weekSettingsFor(cycle, candidateWeek);
      if (weekSettings ? isDeloadWeekSettings(weekSettings, candidateWeek) : weekNumberOf(candidateWeek) === 4) continue;
      if (targetRepScheme && repSchemeOf(cycle, candidateWeek) !== targetRepScheme) continue;

      const entries = Object.values(cycleLogs[candidateWeek]?.[lift] || {})
        .filter((entry) => entry && entry.weight > 0 && entry.reps > 0);
      if (entries.length === 0) continue;

      // The top set is the heaviest set logged that day.
      const top = entries.reduce((best, entry) => (entry.weight >= best.weight ? entry : best));
      return { weight: top.weight, reps: top.reps, cycleNumber: cycle, weekKey: candidateWeek };
    }
    return null;
  };

  const inThisCycle = search(cycleNumber, weekNumberOf(weekKey));
  if (inThisCycle) return inThisCycle;

  const loggedCycles = Object.keys(client.loggedSetInputsByCycle || {})
    .map(Number)
    .filter((cycle) => cycle < cycleNumber)
    .sort((a, b) => b - a);
  for (const cycle of loggedCycles) {
    // Skipped (unlogged) cycles in between still have to have trained the same movement.
    for (let between = cycleNumber - 1; between >= cycle; between -= 1) {
      if (movementIn(between) !== currentMovement) return null;
    }
    const found = search(cycle, Number.POSITIVE_INFINITY);
    if (found) return found;
  }
  return null;
};

export const formatPreviousTopSet = (previous: PreviousTopSet, currentCycleNumber: number): { text: string; title: string } => {
  const week = `week ${weekNumberOf(previous.weekKey)}`;
  const where = previous.cycleNumber === currentCycleNumber ? week : `cycle ${previous.cycleNumber}, ${week}`;
  return {
    text: `Last ${previous.weight} × ${previous.reps}`,
    title: `Last logged top set at this rep scheme (${where})`,
  };
};
