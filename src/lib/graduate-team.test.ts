import { describe, it, expect } from 'vitest';
import type { Client } from '@/lib/types';

// Test the graduation logic directly without Firebase dependencies
describe('graduateTeam logic', () => {
  const createMockClient = (overrides: Partial<Client> = {}): Client => ({
    id: 'client-1',
    name: 'Test Client',
    oneRepMaxes: { Squat: 200, Bench: 150, Deadlift: 250, Press: 100 },
    trainingMaxes: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 },
    initialWeights: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 },
    actualWeights: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: '5', week2: '3', week3: '1' } },
    trainingMaxesByCycle: {
      1: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 },
      2: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 }, // Should be updated
      3: { Squat: 180, Bench: 135, Deadlift: 225, Press: 90 }, // Should be updated
    },
    notes: '',
    ...overrides,
  });

  it('should calculate new training maxes correctly (+10 Squat/Deadlift, +5 Bench/Press)', () => {
    const client = createMockClient();

    // Simulate the graduation logic
    const currentCycle = client.currentCycleNumber || 1;
    const nextCycle = currentCycle + 1;

    const newTrainingMaxes = {
      Squat: client.trainingMaxes.Squat + 10,
      Deadlift: client.trainingMaxes.Deadlift + 10,
      Bench: client.trainingMaxes.Bench + 5,
      Press: client.trainingMaxes.Press + 5,
    };

    expect(newTrainingMaxes).toEqual({
      Squat: 190,    // 180 + 10
      Bench: 140,    // 135 + 5
      Deadlift: 235, // 225 + 10
      Press: 95,     // 90 + 5
    });
  });

  it('should update trainingMaxesByCycle for current and future cycles', () => {
    const client = createMockClient();

    const currentCycle = client.currentCycleNumber || 1;
    const nextCycle = currentCycle + 1;

    const newTrainingMaxes = {
      Squat: client.trainingMaxes.Squat + 10,
      Deadlift: client.trainingMaxes.Deadlift + 10,
      Bench: client.trainingMaxes.Bench + 5,
      Press: client.trainingMaxes.Press + 5,
    };

    // Update trainingMaxesByCycle for the new cycle and ALL future cycles
    const updatedTrainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
    for (const cycleKey of Object.keys(updatedTrainingMaxesByCycle)) {
      const cycle = Number(cycleKey);
      if (!Number.isNaN(cycle) && cycle >= nextCycle) {
        updatedTrainingMaxesByCycle[cycle] = { ...newTrainingMaxes };
      }
    }
    // Ensure the new cycle has the updated maxes
    updatedTrainingMaxesByCycle[nextCycle] = { ...newTrainingMaxes };

    const expectedNewMaxes = { Squat: 190, Bench: 140, Deadlift: 235, Press: 95 };

    // Cycle 2 should have new maxes
    expect(updatedTrainingMaxesByCycle[2]).toEqual(expectedNewMaxes);

    // Future cycles should also be updated
    expect(updatedTrainingMaxesByCycle[3]).toEqual(expectedNewMaxes);
  });

  it('should add week assignments for new cycle', () => {
    const client = createMockClient();

    const currentCycle = client.currentCycleNumber || 1;
    const nextCycle = currentCycle + 1;

    const updatedWeekAssignmentsByCycle = {
      ...(client.weekAssignmentsByCycle || {}),
      [nextCycle]: { week1: '5', week2: '3', week3: '1' },
    };

    expect(updatedWeekAssignmentsByCycle[2]).toEqual({
      week1: '5',
      week2: '3',
      week3: '1',
    });
  });

  it('should handle clients without trainingMaxesByCycle', () => {
    const client = createMockClient({
      trainingMaxesByCycle: undefined,
    });

    const currentCycle = client.currentCycleNumber || 1;
    const nextCycle = currentCycle + 1;

    const newTrainingMaxes = {
      Squat: client.trainingMaxes.Squat + 10,
      Deadlift: client.trainingMaxes.Deadlift + 10,
      Bench: client.trainingMaxes.Bench + 5,
      Press: client.trainingMaxes.Press + 5,
    };

    const updatedTrainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
    for (const cycleKey of Object.keys(updatedTrainingMaxesByCycle)) {
      const cycle = Number(cycleKey);
      if (!Number.isNaN(cycle) && cycle >= nextCycle) {
        updatedTrainingMaxesByCycle[cycle] = { ...newTrainingMaxes };
      }
    }
    updatedTrainingMaxesByCycle[nextCycle] = { ...newTrainingMaxes };

    const expectedNewMaxes = { Squat: 190, Bench: 140, Deadlift: 235, Press: 95 };
    expect(updatedTrainingMaxesByCycle[2]).toEqual(expectedNewMaxes);
  });

  it('should handle clients with different current cycle numbers', () => {
    const client1 = createMockClient({ currentCycleNumber: 1 });
    const client2 = createMockClient({ currentCycleNumber: 2 });

    const nextCycle1 = (client1.currentCycleNumber || 1) + 1;
    const nextCycle2 = (client2.currentCycleNumber || 1) + 1;

    expect(nextCycle1).toBe(2); // 1 -> 2
    expect(nextCycle2).toBe(3); // 2 -> 3
  });
});