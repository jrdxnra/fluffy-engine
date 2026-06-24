import type { Client, CycleScheduleSettings, CycleSettings, DaySlot, Lift, Weekday } from "@/lib/types";
import { Lifts } from "@/lib/types";

const weekdayOrder: Weekday[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const defaultSchedule: CycleScheduleSettings = {
  cycleStartDate: "",
  day1Weekday: "Tuesday",
  day2Weekday: "Thursday",
  skipDeloadWeek: false,
  liftDayAssignments: {
    Deadlift: "day1",
    Bench: "day1",
    Squat: "day2",
    Press: "day2",
  },
  liftDisplayNames: {
    Deadlift: "Deadlift",
    Bench: "Bench",
    Squat: "Squat",
    Press: "Press",
  },
};

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const parseWeekNumber = (weekKey: string): number => {
  const match = weekKey.match(/\d+/);
  if (!match) return 1;
  const parsed = parseInt(match[0], 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
};

const getDayOffset = (from: Weekday, to: Weekday): number => {
  const fromIndex = weekdayOrder.indexOf(from);
  const toIndex = weekdayOrder.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return 0;
  return (toIndex - fromIndex + 7) % 7;
};

export type CycleWeekSchedule = {
  day1Weekday: Weekday;
  day2Weekday: Weekday;
  day1Date?: string;
  day2Date?: string;
  weekNumber: number;
  dayOffset: number;
  isConfigured: boolean;
};

export const getEffectiveCycleSchedule = (
  schedule?: CycleScheduleSettings
): CycleScheduleSettings => {
  return {
    cycleStartDate: schedule?.cycleStartDate || "",
    day1Weekday: schedule?.day1Weekday || defaultSchedule.day1Weekday,
    day2Weekday: schedule?.day2Weekday || defaultSchedule.day2Weekday,
    skipDeloadWeek: schedule?.skipDeloadWeek ?? false,
    liftDayAssignments: {
      ...defaultSchedule.liftDayAssignments,
      ...(schedule?.liftDayAssignments || {}),
    },
    liftDisplayNames: {
      ...defaultSchedule.liftDisplayNames,
      ...(schedule?.liftDisplayNames || {}),
    },
  };
};

export const getLiftDisplayName = (
  lift: Lift,
  schedule?: CycleScheduleSettings
): string => {
  const effective = getEffectiveCycleSchedule(schedule);
  return effective.liftDisplayNames?.[lift] || lift;
};

export const resolveClientMovementName = (
  client: Client,
  cycleNumber: number,
  lift: Lift,
  schedule?: CycleScheduleSettings
): string => {
  return (
    client.movementSelectionByCycle?.[cycleNumber]?.[lift] ||
    getLiftDisplayName(lift, schedule) ||
    lift
  ).trim();
};

export const getCycleWeekSchedule = (
  schedule: CycleScheduleSettings | undefined,
  weekKey: string
): CycleWeekSchedule => {
  const effective = getEffectiveCycleSchedule(schedule);
  const weekNumber = parseWeekNumber(weekKey);
  const dayOffset = getDayOffset(effective.day1Weekday, effective.day2Weekday);

  if (!effective.cycleStartDate) {
    return {
      day1Weekday: effective.day1Weekday,
      day2Weekday: effective.day2Weekday,
      weekNumber,
      dayOffset,
      isConfigured: false,
    };
  }

  const day1Week1 = new Date(`${effective.cycleStartDate}T00:00:00`);
  if (Number.isNaN(day1Week1.getTime())) {
    return {
      day1Weekday: effective.day1Weekday,
      day2Weekday: effective.day2Weekday,
      weekNumber,
      dayOffset,
      isConfigured: false,
    };
  }

  const day1CurrentWeek = addDays(day1Week1, (weekNumber - 1) * 7);
  const day2CurrentWeek = addDays(day1CurrentWeek, dayOffset);

  return {
    day1Weekday: effective.day1Weekday,
    day2Weekday: effective.day2Weekday,
    day1Date: toIsoDate(day1CurrentWeek),
    day2Date: toIsoDate(day2CurrentWeek),
    weekNumber,
    dayOffset,
    isConfigured: true,
  };
};

export const getLiftDaySlot = (
  lift: Lift,
  schedule?: CycleScheduleSettings
): DaySlot => {
  const effective = getEffectiveCycleSchedule(schedule);
  return effective.liftDayAssignments?.[lift] || "day1";
};

export const getLiftsForDaySlot = (
  daySlot: DaySlot,
  schedule?: CycleScheduleSettings
): Lift[] => {
  const effective = getEffectiveCycleSchedule(schedule);
  return Lifts.filter((lift) => (effective.liftDayAssignments?.[lift] || "day1") === daySlot);
};

export type RecommendedSessionSelection = {
  cycleNumber: number;
  weekKey: string;
  daySlot: DaySlot;
};

export const getRecommendedSessionSelection = (
  cycleSettingsByCycle: Record<number, CycleSettings>,
  cycleSchedulesByCycle: Record<number, CycleScheduleSettings>,
  referenceDate: Date = new Date(),
  preferredCycleNumber?: number
): RecommendedSessionSelection | null => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const toDate = (isoDate: string | undefined): Date | null => {
    if (!isoDate) return null;
    const parsed = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  const sessionCandidates: Array<{
    date: Date;
    cycleNumber: number;
    weekKey: string;
    daySlot: DaySlot;
    weekNumber: number;
  }> = [];

  const cycleNumbers = Object.keys(cycleSettingsByCycle)
    .map(Number)
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);

  for (const cycleNumber of cycleNumbers) {
    const cycleSettings = cycleSettingsByCycle[cycleNumber];
    if (!cycleSettings) continue;

    const weekKeys = Object.keys(cycleSettings).sort(
      (a, b) => parseWeekNumber(a) - parseWeekNumber(b)
    );

    for (const weekKey of weekKeys) {
      const weekSchedule = getCycleWeekSchedule(cycleSchedulesByCycle[cycleNumber], weekKey);
      if (!weekSchedule.isConfigured) continue;

      const day1Date = toDate(weekSchedule.day1Date);
      if (day1Date) {
        sessionCandidates.push({
          date: day1Date,
          cycleNumber,
          weekKey,
          daySlot: "day1",
          weekNumber: parseWeekNumber(weekKey),
        });
      }

      const day2Date = toDate(weekSchedule.day2Date);
      if (day2Date) {
        sessionCandidates.push({
          date: day2Date,
          cycleNumber,
          weekKey,
          daySlot: "day2",
          weekNumber: parseWeekNumber(weekKey),
        });
      }
    }
  }

  if (sessionCandidates.length === 0) return null;

  const selectByDate = (
    candidates: Array<{
      date: Date;
      cycleNumber: number;
      weekKey: string;
      daySlot: DaySlot;
      weekNumber: number;
    }>
  ): RecommendedSessionSelection | null => {
    if (candidates.length === 0) return null;

    const sortedCandidates = [...candidates].sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;

      const cycleDiff = b.cycleNumber - a.cycleNumber;
      if (cycleDiff !== 0) return cycleDiff;

      const weekDiff = a.weekNumber - b.weekNumber;
      if (weekDiff !== 0) return weekDiff;

      if (a.daySlot === b.daySlot) return 0;
      return a.daySlot === "day1" ? -1 : 1;
    });

    const upcoming = sortedCandidates.find((candidate) => candidate.date.getTime() >= today.getTime());
    const selected = upcoming || sortedCandidates[sortedCandidates.length - 1];

    return {
      cycleNumber: selected.cycleNumber,
      weekKey: selected.weekKey,
      daySlot: selected.daySlot,
    };
  };

  if (preferredCycleNumber && Number.isFinite(preferredCycleNumber)) {
    const preferredCandidates = sessionCandidates.filter(
      (candidate) => candidate.cycleNumber === preferredCycleNumber
    );
    const preferredSelection = selectByDate(preferredCandidates);
    if (preferredSelection) return preferredSelection;
  }

  const globalSelection = selectByDate(sessionCandidates);
  if (!globalSelection) return null;

  return globalSelection;
};
