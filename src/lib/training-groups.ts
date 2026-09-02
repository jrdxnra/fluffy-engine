import type { Client, DaySlot, GroupClientProgramState, GroupEnrollment, TrainingGroup, Weekday } from "@/lib/types";

const weekdayOrder: Weekday[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export const UNASSIGNED_GROUP_ID = "unassigned";

export const getSortedTrainingGroups = (groups: TrainingGroup[]): TrainingGroup[] => {
  return [...groups].sort((first, second) => {
    const orderDifference = first.sortOrder - second.sortOrder;
    return orderDifference !== 0 ? orderDifference : first.name.localeCompare(second.name);
  });
};

export const getActiveTrainingGroups = (groups: TrainingGroup[]): TrainingGroup[] => {
  return getSortedTrainingGroups(groups.filter((group) => group.active));
};

export const isClientActive = (client: Client): boolean => client.status !== "inactive";

export const getActiveClients = (clients: Client[]): Client[] => {
  return clients.filter(isClientActive);
};

export const getDefaultTrainingGroupId = (groups: TrainingGroup[]): string | null => {
  return getActiveTrainingGroups(groups).find((group) => group.isDefault)?.id || null;
};

export const getTrainingGroupById = (
  groups: TrainingGroup[], groupId: string | undefined
): TrainingGroup | undefined => groups.find((group) => group.id === groupId);

export const getClientsInTrainingGroup = (clients: Client[], groupId: string): Client[] => {
  return clients.filter((client) => {
    if (!isClientActive(client)) return false;
    if (groupId === UNASSIGNED_GROUP_ID) return !client.activeGroupId;
    return client.activeGroupId === groupId;
  });
};

export const getClientProgramState = (
  client: Client, groupId: string
): GroupClientProgramState | undefined => client.programStateByGroup?.[groupId];

export const getGroupProgramStateFromClient = (client: Client): GroupClientProgramState => ({
  currentCycleNumber: client.currentCycleNumber,
  cycleMembership: client.cycleMembership,
  weekAssignmentsByCycle: client.weekAssignmentsByCycle,
  sessionStateByCycle: client.sessionStateByCycle,
  loggedSetInputsByCycle: client.loggedSetInputsByCycle,
  movementSelectionByCycle: client.movementSelectionByCycle,
});

export const withGroupProgramState = (client: Client, groupId: string): Client => ({
  ...client,
  programStateByGroup: {
    ...(client.programStateByGroup || {}),
    [groupId]: getGroupProgramStateFromClient(client),
  },
});

export const getClientForTrainingGroup = (client: Client, groupId: string): Client => {
  const programState = getClientProgramState(client, groupId);
  if (programState) {
    return {
      ...client,
      currentCycleNumber: programState.currentCycleNumber || client.currentCycleNumber,
      cycleMembership: programState.cycleMembership || client.cycleMembership,
      weekAssignmentsByCycle: programState.weekAssignmentsByCycle || client.weekAssignmentsByCycle,
      sessionStateByCycle: programState.sessionStateByCycle || client.sessionStateByCycle,
      loggedSetInputsByCycle: programState.loggedSetInputsByCycle || client.loggedSetInputsByCycle,
      movementSelectionByCycle: programState.movementSelectionByCycle || client.movementSelectionByCycle,
    };
  }

  return {
    ...client,
    currentCycleNumber: 1,
    cycleMembership: [1],
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
  };
};

export const buildGroupProgramStateForPlacement = (
  client: Client,
  placement: "current_program" | "week_1"
): GroupClientProgramState => {
  if (placement === "week_1") {
    return {
      currentCycleNumber: 1,
      cycleMembership: [1],
      weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    };
  }

  const sourceProgramState = client.activeGroupId
    ? getClientProgramState(client, client.activeGroupId)
    : undefined;

  return {
    currentCycleNumber: sourceProgramState?.currentCycleNumber || client.currentCycleNumber,
    cycleMembership: sourceProgramState?.cycleMembership || client.cycleMembership,
    weekAssignmentsByCycle: sourceProgramState?.weekAssignmentsByCycle || client.weekAssignmentsByCycle,
    sessionStateByCycle: sourceProgramState?.sessionStateByCycle || client.sessionStateByCycle,
    loggedSetInputsByCycle: sourceProgramState?.loggedSetInputsByCycle || client.loggedSetInputsByCycle,
    movementSelectionByCycle: sourceProgramState?.movementSelectionByCycle || client.movementSelectionByCycle,
  };
};

export const buildGroupTransferUpdate = (
  client: Client,
  toGroupId: string,
  placement: "current_program" | "week_1",
  transferredAt: string = new Date().toISOString()
): Pick<Client, "activeGroupId" | "groupEnrollmentHistory" | "programStateByGroup"> => {
  const previousGroupId = client.activeGroupId;
  const closedHistory: GroupEnrollment[] = (client.groupEnrollmentHistory || []).map((entry) =>
    !entry.leftAt && entry.groupId === previousGroupId
      ? { ...entry, leftAt: transferredAt }
      : entry
  );

  return {
    activeGroupId: toGroupId,
    groupEnrollmentHistory: [
      ...closedHistory,
      { groupId: toGroupId, joinedAt: transferredAt, placement },
    ],
    programStateByGroup: {
      ...(client.programStateByGroup || {}),
      [toGroupId]: buildGroupProgramStateForPlacement(client, placement),
    },
  };
};

type LocalDateTime = { weekday: Weekday; minutesSinceMidnight: number };

const getLocalDateTime = (referenceDate: Date, timeZone: string): LocalDateTime | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(referenceDate);
    const values = Object.fromEntries(
      parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
    );
    const weekday = values.weekday as Weekday | undefined;
    const hour = Number(values.hour);
    const minute = Number(values.minute);

    if (!weekday || !weekdayOrder.includes(weekday) || !Number.isInteger(hour) || !Number.isInteger(minute)) {
      return null;
    }
    return { weekday, minutesSinceMidnight: hour * 60 + minute };
  } catch {
    return null;
  }
};

const parseStartTime = (startTime: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
};

const getMinutesUntilWeeklyStart = (
  localDateTime: LocalDateTime, weekday: Weekday, startTime: string, activeWindowMinutes: number
): number | null => {
  const startMinutes = parseStartTime(startTime);
  if (startMinutes === null) return null;

  const currentDayIndex = weekdayOrder.indexOf(localDateTime.weekday);
  const sessionDayIndex = weekdayOrder.indexOf(weekday);
  const dayOffset = (sessionDayIndex - currentDayIndex + 7) % 7;
  let difference = dayOffset * 24 * 60 + startMinutes - localDateTime.minutesSinceMidnight;
  if (difference < -activeWindowMinutes) difference += 7 * 24 * 60;
  return difference;
};

export const getRecommendedTrainingGroupId = (
  groups: TrainingGroup[], referenceDate: Date = new Date(), activeWindowMinutes = 120
): string | null => {
  const candidates = getActiveTrainingGroups(groups).flatMap((group) => {
    const schedule = group.program.cycleSchedulesByCycle[group.currentCycleNumber];
    const localDateTime = getLocalDateTime(referenceDate, group.timeZone);
    if (!schedule || !localDateTime) return [];

    return (["day1", "day2"] as DaySlot[]).flatMap((daySlot) => {
      const weekday = daySlot === "day1" ? schedule.day1Weekday : schedule.day2Weekday;
      const startTime = daySlot === "day1" ? group.sessionTimes.day1StartTime : group.sessionTimes.day2StartTime;
      const minutesUntilStart = getMinutesUntilWeeklyStart(localDateTime, weekday, startTime, activeWindowMinutes);
      return minutesUntilStart === null ? [] : [{ group, minutesUntilStart }];
    });
  });

  if (candidates.length === 0) return null;
  candidates.sort((first, second) => {
    const timeDifference = first.minutesUntilStart - second.minutesUntilStart;
    return timeDifference !== 0 ? timeDifference : first.group.sortOrder - second.group.sortOrder;
  });
  return candidates[0].group.id;
};