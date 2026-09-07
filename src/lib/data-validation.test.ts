import { describe, expect, it } from 'vitest';
import { validateAllClientsDataConsistency } from '@/lib/data-validation';
import type { Client } from '@/lib/types';

describe('validateAllClientsDataConsistency', () => {
  it('tracks stale deprecated trainingMaxes values separately from other warnings', () => {
    const client: Client = {
      id: 'client-1',
      name: 'Devon',
      currentCycleNumber: 7,
      trainingMaxes: { Squat: 0, Bench: 145, Deadlift: 0, Press: 0 },
      trainingMaxesByCycle: {
        7: { Squat: 250, Bench: 175, Deadlift: 330, Press: 110 },
      },
      weekAssignmentsByCycle: {
        7: { week1: '5', week2: '3', week3: '1' },
      },
      oneRepMaxes: { Squat: 250, Bench: 145, Deadlift: 330, Press: 110 },
    };

    const result = validateAllClientsDataConsistency([client]);

    expect(result.clientsWithWarnings).toBe(1);
    expect(result.staleDeprecatedTrainingMaxes).toEqual([
      {
        clientId: 'client-1',
        clientName: 'Devon',
        cycle: 7,
        mismatches: [
          { lift: 'Squat', cycleValue: 250, deprecatedValue: 0 },
          { lift: 'Bench', cycleValue: 175, deprecatedValue: 145 },
          { lift: 'Deadlift', cycleValue: 330, deprecatedValue: 0 },
          { lift: 'Press', cycleValue: 110, deprecatedValue: 0 },
        ],
      },
    ]);
  });
});
