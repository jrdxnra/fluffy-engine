import type { Client } from '@/lib/types';

type DeprecatedTrainingMaxMismatch = {
  lift: keyof Client['trainingMaxes'];
  cycleValue: number;
  deprecatedValue: number;
};

/**
 * Validates client data consistency and logs warnings for potential issues
 */
export function validateClientDataConsistency(client: Client): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  const currentCycle = client.currentCycleNumber || 1;

  // Grouped clients keep their per-cycle data under programStateByGroup[activeGroupId];
  // fall back to that before flagging top-level fields as missing to avoid false positives.
  const groupState = client.activeGroupId
    ? client.programStateByGroup?.[client.activeGroupId]
    : undefined;
  const weekAssignmentsByCycle = client.weekAssignmentsByCycle ?? groupState?.weekAssignmentsByCycle;

  // Check if trainingMaxesByCycle has current cycle
  if (!client.trainingMaxesByCycle?.[currentCycle]) {
    warnings.push(`Missing trainingMaxesByCycle for current cycle ${currentCycle}`);
  }

  // trainingMaxesByCycle is the value actually used for workout calculations (see
  // resolveTrainingMaxForCycle in utils.ts); a mismatch here just means the deprecated
  // top-level trainingMaxes field is stale, not that workouts are wrong.
  const cycleMaxes = client.trainingMaxesByCycle?.[currentCycle];
  if (cycleMaxes) {
    const lifts: (keyof typeof client.trainingMaxes)[] = ['Squat', 'Bench', 'Deadlift', 'Press'];
    for (const lift of lifts) {
      if (cycleMaxes[lift] !== client.trainingMaxes[lift]) {
        warnings.push(
          `${lift}: trainingMaxesByCycle[${currentCycle}] (${cycleMaxes[lift]}) ≠ trainingMaxes (${client.trainingMaxes[lift]}) [deprecated field stale, calculations use trainingMaxesByCycle]`
        );
      }
    }
  }

  // Check week assignments exist for current cycle
  if (!weekAssignmentsByCycle?.[currentCycle]) {
    warnings.push(`Missing weekAssignmentsByCycle for current cycle ${currentCycle}`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Validates all clients in a list and returns aggregated results
 */
export function validateAllClientsDataConsistency(clients: Client[]): {
  totalClients: number;
  clientsWithWarnings: number;
  clientsWithErrors: number;
  staleDeprecatedTrainingMaxes: Array<{
    clientId: string;
    clientName: string;
    cycle: number;
    mismatches: DeprecatedTrainingMaxMismatch[];
  }>;
  allWarnings: Array<{ clientId: string; clientName: string; warnings: string[] }>;
  allErrors: Array<{ clientId: string; clientName: string; errors: string[] }>;
} {
  const allWarnings: Array<{ clientId: string; clientName: string; warnings: string[] }> = [];
  const allErrors: Array<{ clientId: string; clientName: string; errors: string[] }> = [];
  const staleDeprecatedTrainingMaxes: Array<{
    clientId: string;
    clientName: string;
    cycle: number;
    mismatches: DeprecatedTrainingMaxMismatch[];
  }> = [];

  for (const client of clients) {
    const validation = validateClientDataConsistency(client);

    if (validation.warnings.length > 0) {
      allWarnings.push({
        clientId: client.id,
        clientName: client.name,
        warnings: validation.warnings,
      });
    }

    if (validation.errors.length > 0) {
      allErrors.push({
        clientId: client.id,
        clientName: client.name,
        errors: validation.errors,
      });
    }

    const currentCycle = client.currentCycleNumber || 1;
    const cycleMaxes = client.trainingMaxesByCycle?.[currentCycle];
    if (cycleMaxes) {
      const mismatches: DeprecatedTrainingMaxMismatch[] = [];
      const lifts: (keyof Client['trainingMaxes'])[] = ['Squat', 'Bench', 'Deadlift', 'Press'];
      for (const lift of lifts) {
        const cycleValue = cycleMaxes[lift];
        const deprecatedValue = client.trainingMaxes[lift];
        if (cycleValue !== deprecatedValue) {
          mismatches.push({
            lift,
            cycleValue,
            deprecatedValue,
          });
        }
      }

      if (mismatches.length > 0) {
        staleDeprecatedTrainingMaxes.push({
          clientId: client.id,
          clientName: client.name,
          cycle: currentCycle,
          mismatches,
        });
      }
    }
  }

  return {
    totalClients: clients.length,
    clientsWithWarnings: allWarnings.length,
    clientsWithErrors: allErrors.length,
    staleDeprecatedTrainingMaxes,
    allWarnings,
    allErrors,
  };
}

/**
 * Logs validation results to console (for debugging)
 */
export function logDataConsistencyValidation(clients: Client[]): void {
  const validation = validateAllClientsDataConsistency(clients);

  if (validation.clientsWithWarnings > 0 || validation.clientsWithErrors > 0) {
    console.group('🔍 Client Data Consistency Check');

    if (validation.clientsWithErrors > 0) {
      console.error(`❌ ${validation.clientsWithErrors} clients have data errors:`);
      validation.allErrors.forEach(({ clientName, errors }) => {
        console.error(`  ${clientName}:`, errors);
      });
    }

    if (validation.clientsWithWarnings > 0) {
      console.warn(`⚠️ ${validation.clientsWithWarnings} clients have data warnings:`);
      validation.allWarnings.forEach(({ clientName, warnings }) => {
        console.warn(`  ${clientName}:`, warnings);
      });

      if (validation.staleDeprecatedTrainingMaxes.length > 0) {
        console.warn(
          `🧹 ${validation.staleDeprecatedTrainingMaxes.length} clients still have stale deprecated trainingMaxes to sync:`
        );
        validation.staleDeprecatedTrainingMaxes.forEach(({ clientName, cycle, mismatches }) => {
          console.warn(`  ${clientName} (cycle ${cycle}):`, mismatches);
        });
      }
    }

    console.groupEnd();
  } else {
    console.log('✅ All client data is consistent');
  }
}