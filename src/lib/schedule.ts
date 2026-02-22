import type { CycleScheduleSettings, DaySlot, Lift, Weekday } from "@/lib/types";
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
  liftDayAssignments: {
    Deadlift: "day1",
    Bench: "day1",
    Squat: "day2",
    Press: "day2",
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
    liftDayAssignments: {
      ...defaultSchedule.liftDayAssignments,
      ...(schedule?.liftDayAssignments || {}),
    },
  };
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
