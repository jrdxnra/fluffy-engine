import type { Client, CycleScheduleSettings, CycleSettings, Lift, PreviousTopSet } from "@/lib/types";
import { normalizeMovementName } from "@/lib/movement-profiles";
import { resolveClientMovementName } from "@/lib/schedule";
import { isDeloadWeekSettings } from "@/lib/workout-week-settings";

const weekNumberOf = (weekKey: string): number => parseInt(weekKey.match(/\d+/)?.[0] || "0", 10);

/** The top-set rep scheme of a week ("5", "3", "1"), or null when the week has no settings. */
const repSchemeOf = (cycleSettings: CycleSettings | undefined, weekKey: string): string | null => {
  const reps = cycleSettings?.[weekKey]?.reps?.workset3;
  if (reps === undefined || reps === null) return null;
  const digits = String(reps).replace(/\D/g, "");
  return digits || null;
};

/**
 * The lifter's most recent logged top set for this lift before the week being viewed,
 * at the same rep scheme (a 3+ week compares against the last 3+ week, not last week's 5+):
 * earlier weeks of this cycle first, then the previous cycle (only when the lift slot
 * trained the same movement there). Deload weeks are skipped - they say nothing about strength.
 * When the viewed week's rep scheme is unknown, any non-deload week counts.
 */
export const getPreviousTopSet = (args: {
  client: Client;
  cycleNumber: number;
  weekKey: string;
  lift: Lift;
  cycleSettingsByCycle: Record<number, CycleSettings>;
  currentSchedule?: CycleScheduleSettings;
  previousCycleSchedule?: CycleScheduleSettings;
}): PreviousTopSet | null => {
  const { client, cycleNumber, weekKey, lift, cycleSettingsByCycle, currentSchedule, previousCycleSchedule } = args;
  const sameMovementInPreviousCycle =
    normalizeMovementName(resolveClientMovementName(client, cycleNumber - 1, lift, previousCycleSchedule))
    === normalizeMovementName(resolveClientMovementName(client, cycleNumber, lift, currentSchedule));
  const currentWeekNumber = weekNumberOf(weekKey);
  const targetRepScheme = repSchemeOf(cycleSettingsByCycle[cycleNumber], weekKey);

  const search = (cycle: number, beforeWeekNumber: number): PreviousTopSet | null => {
    const cycleLogs = client.loggedSetInputsByCycle?.[cycle] || {};
    const weekKeys = Object.keys(cycleLogs)
      .filter((key) => weekNumberOf(key) < beforeWeekNumber)
      .sort((a, b) => weekNumberOf(b) - weekNumberOf(a));

    for (const candidateWeek of weekKeys) {
      const weekSettings = cycleSettingsByCycle[cycle]?.[candidateWeek];
      if (weekSettings ? isDeloadWeekSettings(weekSettings, candidateWeek) : weekNumberOf(candidateWeek) === 4) continue;
      if (targetRepScheme && repSchemeOf(cycleSettingsByCycle[cycle], candidateWeek) !== targetRepScheme) continue;

      const entries = Object.values(cycleLogs[candidateWeek]?.[lift] || {})
        .filter((entry) => entry && entry.weight > 0 && entry.reps > 0);
      if (entries.length === 0) continue;

      // The top set is the heaviest set logged that day.
      const top = entries.reduce((best, entry) => (entry.weight >= best.weight ? entry : best));
      return { weight: top.weight, reps: top.reps, cycleNumber: cycle, weekKey: candidateWeek };
    }
    return null;
  };

  return search(cycleNumber, currentWeekNumber)
    || (sameMovementInPreviousCycle && cycleNumber > 1 ? search(cycleNumber - 1, Number.POSITIVE_INFINITY) : null);
};

export const formatPreviousTopSet = (previous: PreviousTopSet, currentCycleNumber: number): { text: string; title: string } => {
  const week = `week ${weekNumberOf(previous.weekKey)}`;
  const where = previous.cycleNumber === currentCycleNumber ? week : `cycle ${previous.cycleNumber}, ${week}`;
  return {
    text: `Last ${previous.weight} × ${previous.reps}`,
    title: `Last logged top set at this rep scheme (${where})`,
  };
};
