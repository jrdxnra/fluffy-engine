import { describe, expect, it } from "vitest";
import type { Client, TrainingGroup } from "@/lib/types";
import {
  buildGroupProgramStateForPlacement,
  buildGroupTransferUpdate,
  getActiveTrainingGroups,
  getActiveClients,
  getDefaultTrainingGroupId,
  getClientForTrainingGroup,
  getGroupProgramStateFromClient,
  getClientProgramState,
  getClientsInTrainingGroup,
  getRecommendedTrainingGroupId,
  getSortedTrainingGroups,
  UNASSIGNED_GROUP_ID,
} from "@/lib/training-groups";

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: "client-1",
  name: "Client One",
  oneRepMaxes: { Squat: 200, Bench: 150, Deadlift: 250, Press: 100 },
  trainingMaxes: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 },
  ...overrides,
});

const makeGroup = (overrides: Partial<TrainingGroup> = {}): TrainingGroup => ({
  id: "morning",
  name: "Morning Group",
  sortOrder: 1,
  active: true,
  timeZone: "America/Chicago",
  sessionTimes: { day1StartTime: "06:00", day2StartTime: "06:00" },
  currentCycleNumber: 1,
  program: {
    cycleSettingsByCycle: { 1: {} },
    cycleNames: { 1: "Cycle 1" },
    cycleSchedulesByCycle: {
      1: { cycleStartDate: "2026-09-01", day1Weekday: "Monday", day2Weekday: "Wednesday" },
    },
  },
  ...overrides,
});

describe("training group helpers", () => {
  it("sorts groups by configured order and excludes archived groups", () => {
    const archived = makeGroup({ id: "archived", name: "Archived", sortOrder: 1, active: false });
    const later = makeGroup({ id: "later", name: "Later", sortOrder: 3 });
    const first = makeGroup({ id: "first", name: "First", sortOrder: 1 });

    expect(getSortedTrainingGroups([later, first, archived]).map((group) => group.id)).toEqual(["archived", "first", "later"]);
    expect(getActiveTrainingGroups([later, first, archived]).map((group) => group.id)).toEqual(["first", "later"]);
  });

  it("returns the active default group and ignores an archived default", () => {
    const archivedDefault = makeGroup({ id: "archived", active: false, isDefault: true });
    const activeDefault = makeGroup({ id: "active", sortOrder: 2, isDefault: true });

    expect(getDefaultTrainingGroupId([archivedDefault, activeDefault])).toBe("active");
  });

  it("filters assigned and unassigned clients without dropping legacy clients", () => {
    const morningClient = makeClient({ id: "morning-client", activeGroupId: "morning" });
    const eveningClient = makeClient({ id: "evening-client", activeGroupId: "evening" });
    const legacyClient = makeClient({ id: "legacy-client" });

    expect(getClientsInTrainingGroup([morningClient, eveningClient, legacyClient], "morning")).toEqual([morningClient]);
    expect(getClientsInTrainingGroup([morningClient, eveningClient, legacyClient], UNASSIGNED_GROUP_ID)).toEqual([legacyClient]);
  });

  it("excludes inactive clients from active group rosters while retaining them in client data", () => {
    const activeClient = makeClient({ id: "active", activeGroupId: "morning" });
    const inactiveClient = makeClient({ id: "inactive", activeGroupId: "morning", status: "inactive" });

    expect(getActiveClients([activeClient, inactiveClient])).toEqual([activeClient]);
    expect(getClientsInTrainingGroup([activeClient, inactiveClient], "morning")).toEqual([activeClient]);
  });

  it("keeps program state separate for each group after a transfer", () => {
    const client = makeClient({
      activeGroupId: "evening",
      programStateByGroup: {
        morning: {
          oneRepMaxes: { Squat: 200, Bench: 150, Deadlift: 250, Press: 100 },
          trainingMaxes: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 },
          currentCycleNumber: 3,
        },
        evening: {
          oneRepMaxes: { Squat: 210, Bench: 155, Deadlift: 260, Press: 105 },
          trainingMaxes: { Squat: 190, Bench: 140, Deadlift: 235, Press: 95 },
          currentCycleNumber: 1,
        },
      },
    });

    expect(getClientProgramState(client, "morning")?.currentCycleNumber).toBe(3);
    expect(getClientProgramState(client, "evening")?.currentCycleNumber).toBe(1);
  });

  it("projects the selected group's program state without changing client identity", () => {
    const client = makeClient({
      activeGroupId: "morning",
      programStateByGroup: {
        morning: {
          oneRepMaxes: { Squat: 210, Bench: 155, Deadlift: 260, Press: 105 },
          trainingMaxes: { Squat: 190, Bench: 140, Deadlift: 235, Press: 95 },
          currentCycleNumber: 2,
        },
      },
    });

    const projected = getClientForTrainingGroup(client, "morning");

    expect(projected.id).toBe(client.id);
    expect(projected.activeGroupId).toBe("morning");
    expect(projected.currentCycleNumber).toBe(2);
    expect(projected.oneRepMaxes.Squat).toBe(200);
  });

  it("extracts only group-owned program state without copying shared strength", () => {
    const client = makeClient({
      currentCycleNumber: 2,
      cycleMembership: [1, 2],
      weekAssignmentsByCycle: { 2: { week1: "5" } },
      oneRepMaxes: { Squat: 300, Bench: 200, Deadlift: 350, Press: 150 },
      trainingMaxes: { Squat: 270, Bench: 180, Deadlift: 315, Press: 135 },
    });

    const groupState = getGroupProgramStateFromClient(client);

    expect(groupState.currentCycleNumber).toBe(2);
    expect(groupState.weekAssignmentsByCycle).toEqual({ 2: { week1: "5" } });
    expect(groupState).not.toHaveProperty("oneRepMaxes");
    expect(groupState).not.toHaveProperty("trainingMaxes");
  });

  it("selects the active group during its configured session window", () => {
    const morning = makeGroup();
    const evening = makeGroup({ id: "evening", name: "Evening Group", sortOrder: 2, sessionTimes: { day1StartTime: "17:30", day2StartTime: "17:30" } });

    expect(getRecommendedTrainingGroupId([morning, evening], new Date("2026-09-07T11:30:00.000Z"))).toBe("morning");
  });

  it("selects the next group after the active-session window ends", () => {
    const morning = makeGroup();
    const evening = makeGroup({ id: "evening", name: "Evening Group", sortOrder: 2, sessionTimes: { day1StartTime: "17:30", day2StartTime: "17:30" } });

    expect(getRecommendedTrainingGroupId([morning, evening], new Date("2026-09-07T15:00:00.000Z"))).toBe("evening");
  });

  it("uses each group's configured timezone rather than the browser timezone", () => {
    const london = makeGroup({ id: "london", timeZone: "Europe/London" });
    const chicago = makeGroup({ id: "chicago", sortOrder: 2, timeZone: "America/Chicago" });

    expect(getRecommendedTrainingGroupId([london, chicago], new Date("2026-09-07T05:30:00.000Z"))).toBe("london");
  });

  it("resets to a fresh cycle 1 program state when placement is week_1", () => {
    const client = makeClient({
      oneRepMaxes: { Squat: 300, Bench: 200, Deadlift: 350, Press: 150 },
      currentCycleNumber: 4,
      cycleMembership: [1, 2, 3, 4],
      trainingMaxesByCycle: { 4: { Squat: 270, Bench: 180, Deadlift: 315, Press: 135 } },
    });

    const state = buildGroupProgramStateForPlacement(client, "week_1");

    expect(state.currentCycleNumber).toBe(1);
    expect(state.cycleMembership).toEqual([1]);
    expect(state.trainingMaxes).toBeUndefined();
    expect(state.movementCalibrationsByCycle).toBeUndefined();
  });

  it("preserves existing program progress when placement is current_program", () => {
    const client = makeClient({
      currentCycleNumber: 4,
      cycleMembership: [1, 2, 3, 4],
      trainingMaxesByCycle: { 4: { Squat: 270, Bench: 180, Deadlift: 315, Press: 135 } },
    });

    const state = buildGroupProgramStateForPlacement(client, "current_program");

    expect(state.currentCycleNumber).toBe(4);
    expect(state.cycleMembership).toEqual([1, 2, 3, 4]);
    expect(state.trainingMaxesByCycle).toBeUndefined();
  });

  it("uses the source group's state when keeping progress through a transfer", () => {
    const client = makeClient({
      activeGroupId: "morning",
      currentCycleNumber: 1,
      programStateByGroup: {
        morning: {
          oneRepMaxes: { Squat: 300, Bench: 200, Deadlift: 350, Press: 150 },
          trainingMaxes: { Squat: 270, Bench: 180, Deadlift: 315, Press: 135 },
          currentCycleNumber: 4,
          cycleMembership: [1, 2, 3, 4],
        },
      },
    });

    const state = buildGroupProgramStateForPlacement(client, "current_program");

    expect(state.currentCycleNumber).toBe(4);
    expect(state.trainingMaxes).toBeUndefined();
  });

  it("closes the prior enrollment and keeps other groups' program state untouched on transfer", () => {
    const priorOneRepMaxes = { Squat: 200, Bench: 150, Deadlift: 250, Press: 100 };
    const client = makeClient({
      activeGroupId: "morning",
      groupEnrollmentHistory: [{ groupId: "morning", joinedAt: "2026-01-01T00:00:00.000Z", placement: "current_program" }],
      programStateByGroup: {
        morning: { oneRepMaxes: priorOneRepMaxes, trainingMaxes: priorOneRepMaxes, currentCycleNumber: 3 },
      },
    });

    const update = buildGroupTransferUpdate(client, "evening", "week_1", "2026-09-07T12:00:00.000Z");

    expect(update.activeGroupId).toBe("evening");
    expect(update.groupEnrollmentHistory).toEqual([
      { groupId: "morning", joinedAt: "2026-01-01T00:00:00.000Z", placement: "current_program", leftAt: "2026-09-07T12:00:00.000Z" },
      { groupId: "evening", joinedAt: "2026-09-07T12:00:00.000Z", placement: "week_1" },
    ]);
    expect(update.programStateByGroup?.morning?.currentCycleNumber).toBe(3);
    expect(update.programStateByGroup?.evening?.currentCycleNumber).toBe(1);
  });

  it("keeps overlapping Cycle 1 Week 1 logged set drafts separate by group", () => {
    const client = makeClient({
      programStateByGroup: {
        morning: {
          loggedSetInputsByCycle: {
            1: { week1: { Deadlift: { "0": { weight: 200, reps: 5, updatedAt: "2026-09-02" } } } },
          },
        },
        evening: {
          loggedSetInputsByCycle: {
            1: { week1: { Deadlift: { "0": { weight: 250, reps: 5, updatedAt: "2026-09-02" } } } },
          },
        },
      },
    });

    expect(getClientForTrainingGroup(client, "morning").loggedSetInputsByCycle?.[1].week1.Deadlift?.["0"].weight).toBe(200);
    expect(getClientForTrainingGroup(client, "evening").loggedSetInputsByCycle?.[1].week1.Deadlift?.["0"].weight).toBe(250);
  });
});