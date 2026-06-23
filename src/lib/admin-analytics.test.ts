import { describe, expect, it } from "vitest";
import { buildAdminAnalyticsReport } from "@/lib/admin-analytics";
import type { Client, HistoricalRecord } from "@/lib/types";

const now = new Date("2026-06-22T12:00:00.000Z");

const clients: Client[] = [
  {
    id: "client-1",
    name: "Alex",
    oneRepMaxes: { Squat: 315, Bench: 225, Deadlift: 405, Press: 145 },
    trainingMaxes: { Squat: 285, Bench: 205, Deadlift: 365, Press: 130 },
    trainingMaxesByCycle: {
      2: { Squat: 275, Bench: 200, Deadlift: 355, Press: 125 },
      3: { Squat: 285, Bench: 205, Deadlift: 365, Press: 130 },
    },
    currentCycleNumber: 3,
    loggedSetInputsByCycle: {
      3: {
        week1: {
          Squat: {
            top: { weight: 255, reps: 5, updatedAt: "2026-06-18T14:00:00.000Z" },
          },
        },
        week2: {
          Deadlift: {
            top: { weight: 335, reps: 5, updatedAt: "2026-06-11T14:00:00.000Z" },
          },
        },
      },
    },
  },
  {
    id: "client-2",
    name: "Morgan",
    oneRepMaxes: { Squat: 275, Bench: 175, Deadlift: 315, Press: 115 },
    trainingMaxes: { Squat: 250, Bench: 160, Deadlift: 285, Press: 105 },
    trainingMaxesByCycle: {
      2: { Squat: 250, Bench: 160, Deadlift: 285, Press: 105 },
    },
    currentCycleNumber: 2,
    loggedSetInputsByCycle: {
      2: {
        week1: {
          Bench: {
            top: { weight: 145, reps: 4, updatedAt: "2026-05-01T14:00:00.000Z" },
          },
        },
      },
    },
  },
];

const historicalData: HistoricalRecord[] = [
  { clientId: "client-1", lift: "Squat", date: "2026-06-18T14:00:00.000Z", weight: 255, reps: 5, estimated1RM: 300 },
  { clientId: "client-1", lift: "Squat", date: "2026-04-25T14:00:00.000Z", weight: 245, reps: 5, estimated1RM: 285 },
  { clientId: "client-1", lift: "Deadlift", date: "2026-06-11T14:00:00.000Z", weight: 335, reps: 5, estimated1RM: 390 },
  { clientId: "client-1", lift: "Deadlift", date: "2026-04-10T14:00:00.000Z", weight: 325, reps: 5, estimated1RM: 380 },
  { clientId: "client-2", lift: "Bench", date: "2026-05-01T14:00:00.000Z", weight: 145, reps: 4, estimated1RM: 164 },
  { clientId: "client-2", lift: "Bench", date: "2026-04-15T14:00:00.000Z", weight: 145, reps: 4, estimated1RM: 164 },
];

describe("buildAdminAnalyticsReport", () => {
  it("summarizes active progress and inactive clients", () => {
    const report = buildAdminAnalyticsReport(clients, historicalData, now);

    expect(report.team.totalClients).toBe(2);
    expect(report.team.onTrackClients).toBe(1);
    expect(report.team.inactiveClients).toBe(1);
    expect(report.team.plateauRiskClients).toBe(0);

    const alex = report.clients.find((client) => client.clientId === "client-1");
    const morgan = report.clients.find((client) => client.clientId === "client-2");

    expect(alex?.overallStatus).toBe("on-track");
    expect(alex?.activity.loggedDaysLast30).toBe(2);
    expect(alex?.improvingLifts).toEqual(expect.arrayContaining(["Squat", "Deadlift"]));
    expect(alex?.quickReview.completedSessionSlots).toBe(2);
    expect(alex?.quickReview.plannedSessionSlots).toBe(8);

    expect(morgan?.overallStatus).toBe("inactive");
    expect(morgan?.activity.daysSinceLastActivity).toBeGreaterThan(21);
    expect(morgan?.coachingFocus.primaryIssue).not.toBeNull();
    expect(morgan?.coachingFocus.primaryIssue?.title).toMatch(/drop|Attendance/);
  });

  it("flags plateau risk when recent performance stays flat without TM movement", () => {
    const plateauClient: Client = {
      id: "client-3",
      name: "Taylor",
      oneRepMaxes: { Squat: 225, Bench: 165, Deadlift: 275, Press: 95 },
      trainingMaxes: { Squat: 205, Bench: 150, Deadlift: 250, Press: 85 },
      trainingMaxesByCycle: {
        1: { Squat: 205, Bench: 150, Deadlift: 250, Press: 85 },
        2: { Squat: 205, Bench: 150, Deadlift: 250, Press: 85 },
      },
      currentCycleNumber: 2,
      loggedSetInputsByCycle: {
        2: {
          week1: {
            Bench: {
              top: { weight: 135, reps: 5, updatedAt: "2026-06-19T14:00:00.000Z" },
            },
          },
          week2: {
            Bench: {
              top: { weight: 135, reps: 5, updatedAt: "2026-05-30T14:00:00.000Z" },
            },
          },
        },
      },
    };

    const plateauHistory: HistoricalRecord[] = [
      { clientId: "client-3", lift: "Bench", date: "2026-06-19T14:00:00.000Z", weight: 135, reps: 5, estimated1RM: 160 },
      { clientId: "client-3", lift: "Bench", date: "2026-05-30T14:00:00.000Z", weight: 135, reps: 5, estimated1RM: 160 },
    ];

    const report = buildAdminAnalyticsReport([plateauClient], plateauHistory, now);
    const taylor = report.clients[0];

    expect(taylor.overallStatus).toBe("needs-adjustment");
    expect(taylor.plateauLifts).toContain("Bench");
    expect(taylor.coachingFocus.primaryIssue).not.toBeNull();
    expect(taylor.coachingFocus.primaryIssue?.title).toContain("Bench");
    expect(taylor.coachingFocus.primaryIssue?.action).toBeTruthy();
  });

});
