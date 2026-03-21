import type { Client } from '@/lib/types';

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

  // Check if trainingMaxesByCycle has current cycle
  if (!client.trainingMaxesByCycle?.[currentCycle]) {
    warnings.push(`Missing trainingMaxesByCycle for current cycle ${currentCycle}`);
  }

  // Check if trainingMaxesByCycle values match global trainingMaxes for current cycle
  const cycleMaxes = client.trainingMaxesByCycle?.[currentCycle];
  if (cycleMaxes) {
    const lifts: (keyof typeof client.trainingMaxes)[] = ['Squat', 'Bench', 'Deadlift', 'Press'];
    for (const lift of lifts) {
      if (cycleMaxes[lift] !== client.trainingMaxes[lift]) {
        warnings.push(
          `${lift}: trainingMaxesByCycle[${currentCycle}] (${cycleMaxes[lift]}) ≠ trainingMaxes (${client.trainingMaxes[lift]})`
        );
      }
    }
  }

  // Check for future cycles with outdated maxes
  if (client.trainingMaxesByCycle) {
    for (const [cycleKey, cycleMaxes] of Object.entries(client.trainingMaxesByCycle)) {
      const cycle = Number(cycleKey);
      if (cycle > currentCycle) {
        const lifts: (keyof typeof client.trainingMaxes)[] = ['Squat', 'Bench', 'Deadlift', 'Press'];
        for (const lift of lifts) {
          if (cycleMaxes[lift] !== client.trainingMaxes[lift]) {
            warnings.push(
              `${lift}: Future cycle ${cycle} maxes (${cycleMaxes[lift]}) don't match current trainingMaxes (${client.trainingMaxes[lift]})`
            );
          }
        }
      }
    }
  }

  // Check week assignments exist for current cycle
  if (!client.weekAssignmentsByCycle?.[currentCycle]) {
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
  allWarnings: Array<{ clientId: string; clientName: string; warnings: string[] }>;
  allErrors: Array<{ clientId: string; clientName: string; errors: string[] }>;
} {
  const allWarnings: Array<{ clientId: string; clientName: string; warnings: string[] }> = [];
  const allErrors: Array<{ clientId: string; clientName: string; errors: string[] }> = [];

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
  }

  return {
    totalClients: clients.length,
    clientsWithWarnings: allWarnings.length,
    clientsWithErrors: allErrors.length,
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
    }

    console.groupEnd();
  } else {
    console.log('✅ All client data is consistent');
  }
}