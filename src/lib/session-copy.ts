import type { CalculatedWorkout, Client, CycleScheduleSettings, CycleSettings, DaySlot, HistoricalRecord, Lift } from "@/lib/types";
import { resolveVisibleAccessories } from "@/lib/accessory-utils";
import { calculateClientLiftWorkout, sortWeekKeys } from "@/lib/client-workout";
import { getEffectiveCycleMembership } from "@/lib/cycle-membership";
import { getCycleWeekSchedule, getLiftsForDaySlot, resolveClientMovementName } from "@/lib/schedule";
import { isDeloadWeekSettings } from "@/lib/workout-week-settings";
import {
  formatDayCopyText,
  formatLiftCopyText,
  formatMonthCopy,
  type ActualsBySet,
  type Copied,
  type CopyLift,
  type MonthSession,
} from "@/lib/copy-formatter";

/**
 * Builds what the Copy button copies from the coaching screen's data. The computer and the phone both call these,
 * so a lifter's copy reads the same on either.
 */

export type CopyProgram = {
  cycleNumber: number;
  weekKey: string;
  cycleSettings: CycleSettings;
  schedule?: CycleScheduleSettings;
};

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${iso}T00:00:00`));

/** "Tuesday (Oct 14)", or just "Tuesday" when the cycle has no start date. */
export const sessionDateLabel = (schedule: CycleScheduleSettings | undefined, weekKey: string, slot: DaySlot): string => {
  const week = getCycleWeekSchedule(schedule, weekKey);
  const weekday = slot === "day1" ? week.day1Weekday : week.day2Weekday;
  const date = slot === "day1" ? week.day1Date : week.day2Date;
  return `${weekday}${date ? ` (${shortDate(date)})` : ""}`;
};

/** One lift of a calculated workout, named and with its actuals: what was logged, overlaid with anything typed. */
export const copyLiftFor = (
  workout: CalculatedWorkout,
  lift: Lift,
  program: CopyProgram,
  unsavedActuals?: ActualsBySet
): CopyLift => {
  const weekKey = workout.effectiveWeekKey || program.weekKey;
  const logged = workout.client.loggedSetInputsByCycle?.[program.cycleNumber]?.[weekKey]?.[lift] || {};
  return {
    name: resolveClientMovementName(workout.client, program.cycleNumber, lift, program.schedule),
    sets: workout.sets,
    accessories: resolveVisibleAccessories(program.cycleSettings, weekKey, lift),
    actuals: { ...logged, ...(unsavedActuals || {}) },
  };
};

/** The lift view's copy: one lift as text. */
export const buildLiftCopyText = (args: {
  workout: CalculatedWorkout;
  lift: Lift;
  program: CopyProgram;
  dateLabel?: string;
  includeWarmups: boolean;
  unsavedActuals?: ActualsBySet;
}): string =>
  formatLiftCopyText({
    lift: copyLiftFor(args.workout, args.lift, args.program, args.unsavedActuals),
    dateLabel: args.dateLabel,
    includeWarmups: args.includeWarmups,
  });

/**
 * The day view's copy: the lifter's whole session as a table. `unsavedActuals` are what is typed on the lift whose
 * Copy was pressed.
 */
export const buildDayCopyText = (args: {
  clientId: string;
  dayLifts: Lift[];
  workoutsByLift: Partial<Record<Lift, CalculatedWorkout[]>>;
  program: CopyProgram;
  dateLabel: string;
  unsavedActuals?: { lift: Lift; actuals: ActualsBySet };
}): string => {
  const lifts = args.dayLifts
    .map((lift) => {
      const workout = (args.workoutsByLift[lift] || []).find((item) => item.client.id === args.clientId);
      if (!workout || workout.sets.length === 0) return null;
      const typed = args.unsavedActuals?.lift === lift ? args.unsavedActuals.actuals : undefined;
      return copyLiftFor(workout, lift, args.program, typed);
    })
    .filter((lift): lift is CopyLift => lift !== null);
  return formatDayCopyText({ lifts, dateLabel: args.dateLabel });
};

const isoOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Whether the lifter was on this cycle: listed on it, on it now, or logged something in it. */
const wasOnCycle = (client: Client, cycleNumber: number): boolean =>
  getEffectiveCycleMembership(client).includes(cycleNumber) ||
  (client.currentCycleNumber || 1) === cycleNumber ||
  Boolean(client.loggedSetInputsByCycle?.[cycleNumber]);

/**
 * Every session of the lifter's group program dated from the 1st of this month to today, with what was prescribed
 * and what they logged. Weeks a skipped deload would fall on, paused weeks and lifts with no sets are left out.
 */
export const buildMonthSessions = (args: {
  client: Client;
  cycleSettingsByCycle: Record<number, CycleSettings>;
  schedulesByCycle: Record<number, CycleScheduleSettings>;
  historicalData: HistoricalRecord[];
  today?: Date;
}): MonthSession[] => {
  const today = args.today || new Date();
  const from = isoOf(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = isoOf(today);
  const sessions: MonthSession[] = [];

  for (const [cycleKey, cycleSettings] of Object.entries(args.cycleSettingsByCycle)) {
    const cycleNumber = Number(cycleKey);
    const schedule = args.schedulesByCycle[cycleNumber];
    if (!cycleSettings || !schedule?.cycleStartDate || !wasOnCycle(args.client, cycleNumber)) continue;

    for (const weekKey of sortWeekKeys(cycleSettings)) {
      const weekSettings = cycleSettings[weekKey];
      if (schedule.skipDeloadWeek && isDeloadWeekSettings(weekSettings, weekKey)) continue;
      const week = getCycleWeekSchedule(schedule, weekKey);
      const program: CopyProgram = { cycleNumber, weekKey, cycleSettings, schedule };

      for (const slot of ["day1", "day2"] as DaySlot[]) {
        const date = slot === "day1" ? week.day1Date : week.day2Date;
        if (!date || date < from || date > to) continue;

        const lifts = getLiftsForDaySlot(slot, schedule)
          .map((lift) => {
            const workout = calculateClientLiftWorkout({
              client: args.client,
              lift,
              weekKey,
              cycleNumber,
              cycleSettings,
              schedule,
              historicalData: args.historicalData,
            });
            return workout.sets.length > 0 ? copyLiftFor(workout, lift, program) : null;
          })
          .filter((lift): lift is CopyLift => lift !== null);
        if (lifts.length === 0) continue;

        const scheme = weekSettings.reps?.workset3 ? ` (${weekSettings.reps.workset3})` : "";
        sessions.push({ date, label: `Cycle ${cycleNumber} · ${weekSettings.name || weekKey}${scheme}`, lifts });
      }
    }
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date));
};

/** The month so far as a table, with a title naming the lifter and the dates covered. */
export const buildMonthCopy = (args: Parameters<typeof buildMonthSessions>[0]): Copied & { sessionCount: number } => {
  const today = args.today || new Date();
  const sessions = buildMonthSessions({ ...args, today });
  const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(today);
  const title = `${args.client.name} · ${month} so far (to ${shortDate(isoOf(today))})`;
  return { ...formatMonthCopy(sessions, title), sessionCount: sessions.length };
};
