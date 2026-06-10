import { describe, expect, it } from "vitest";
import type { Client } from "@/lib/types";
import {
  getEffectiveCycleMembership,
  isClientInCycle,
  withCycleAdded,
  withCycleRemoved,
} from "@/lib/cycle-membership";

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: "client-1",
  name: "Client One",
  oneRepMaxes: { Squat: 200, Bench: 150, Deadlift: 250, Press: 100 },
  trainingMaxes: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 },
  notes: "",
  ...overrides,
});

describe("cycle-membership helpers", () => {
  it("falls back legacy clients to their current cycle membership", () => {
    const client = makeClient({ cycleMembership: undefined, currentCycleNumber: 4 });
    expect(getEffectiveCycleMembership(client)).toEqual([4]);
  });

  it("infers historical membership from by-cycle maps for legacy clients", () => {
    const client = makeClient({
      cycleMembership: undefined,
      currentCycleNumber: 4,
      trainingMaxesByCycle: {
        2: { Squat: 210, Bench: 155, Deadlift: 260, Press: 105 },
        4: { Squat: 230, Bench: 165, Deadlift: 280, Press: 115 },
      },
    });

    expect(getEffectiveCycleMembership(client)).toEqual([2, 4]);
  });

  it("does not invent earlier cycles when only the current cycle exists", () => {
    const client = makeClient({
      cycleMembership: undefined,
      currentCycleNumber: 4,
      trainingMaxesByCycle: {
        4: { Squat: 230, Bench: 165, Deadlift: 280, Press: 115 },
      },
    });

    expect(getEffectiveCycleMembership(client)).toEqual([4]);
  });

  it("normalizes explicit membership by sorting and removing duplicates", () => {
    const client = makeClient({ cycleMembership: [4, 2, 2, 1, 3] });
    expect(getEffectiveCycleMembership(client)).toEqual([1, 2, 3, 4]);
  });

  it("supports add/remove without producing empty membership", () => {
    const client = makeClient({ cycleMembership: [4, 5] });

    expect(withCycleAdded(client, 5)).toEqual([4, 5]);
    expect(withCycleAdded(client, 6)).toEqual([4, 5, 6]);

    const removed = withCycleRemoved(client, 5);
    expect(removed).toEqual([4]);

    const removeLast = withCycleRemoved(makeClient({ cycleMembership: [5] }), 5);
    expect(removeLast).toEqual([1]);
  });

  it("filters clients by selected cycle using effective membership", () => {
    const client = makeClient({ cycleMembership: [2, 5] });
    expect(isClientInCycle(client, 5)).toBe(true);
    expect(isClientInCycle(client, 3)).toBe(false);
  });

  it("preserves explicit singleton membership even when historical cycle maps exist", () => {
    const client = makeClient({
      cycleMembership: [4],
      currentCycleNumber: 4,
      weekAssignmentsByCycle: {
        1: { week1: "5", week2: "3", week3: "1" },
        2: { week1: "5", week2: "3", week3: "1" },
        3: { week1: "5", week2: "3", week3: "1" },
        4: { week1: "5", week2: "3", week3: "1" },
      },
    });

    expect(getEffectiveCycleMembership(client)).toEqual([4]);
  });
});
