import type { Client, CycleScheduleSettings, CycleSettings, Lift, PreviousTopSet } from "@/lib/types";
import { normalizeMovementName } from "@/lib/movement-profiles";
import { resolveClientMovementName } from "@/lib/schedule";
import { isDeloadWeekSettings } from "@/lib/workout-week-settings";

const weekNumberOf = (weekKey: string): number => parseInt(weekKey.match(/\d+/)?.[0] || "0", 10);

/**
 * The lifter's most recent logged top set for this lift before the week being viewed:
 * earlier weeks of this cycle first, then the previous cycle (only when the lift slot
 * trained the same movement there). Deload weeks are skipped - they say nothing about strength.
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

  const search = (cycle: number, beforeWeekNumber: number): PreviousTopSet | null => {
    const cycleLogs = client.loggedSetInputsByCycle?.[cycle] || {};
    const weekKeys = Object.keys(cycleLogs)
      .filter((key) => weekNumberOf(key) < beforeWeekNumber)
      .sort((a, b) => weekNumberOf(b) - weekNumberOf(a));

    for (const candidateWeek of weekKeys) {
      const weekSettings = cycleSettingsByCycle[cycle]?.[candidateWeek];
      if (weekSettings ? isDeloadWeekSettings(weekSettings, candidateWeek) : weekNumberOf(candidateWeek) === 4) continue;

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
    title: `Most recent logged top set (${where})`,
  };
};
