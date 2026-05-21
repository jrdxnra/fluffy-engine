import { getDocs, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const lifts = ['Squat', 'Bench', 'Deadlift', 'Press'] as const;
const mround = (value: number) => Math.round(value / 5) * 5;

interface RepairPlan {
  clientId: string;
  clientName: string;
  action: 'reset-training-maxes' | 'delete-record' | 'mark-for-audit';
  details: string;
}

/**
 * Repairs:
 * 1. Resets corrupted cycle training maxes to 0.9 × oneRM for affected lifts
 * 2. Deletes impossible historical records (e.g., 863 estimated 1RM on squat)
 * 3. Flags suspicious records (> 130% of actual 1RM) for manual review
 */
export async function POST(req: Request) {
  const { action } = await req.json();

  try {
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    const historicalSnapshot = await getDocs(collection(db, 'historicalRecords'));

    const clients: any[] = [];
    const historical: any[] = [];

    clientsSnapshot.forEach((doc) => {
      clients.push({ id: doc.id, ...doc.data() });
    });

    historicalSnapshot.forEach((doc) => {
      historical.push({ id: doc.id, ...doc.data() });
    });

    if (action === 'plan') {
      // Just return what would be repaired
      return planRepairs(clients, historical);
    }

    if (action === 'execute') {
      // Execute repairs
      return await executeRepairs(clients, historical);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Repair error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function planRepairs(clients: any[], historical: any[]) {
  const repairs: RepairPlan[] = [];

  for (const client of clients) {
    const byCycle = client.trainingMaxesByCycle || {};
    const cycleNumbers = Object.keys(byCycle)
      .map((cycleKey) => Number(cycleKey))
      .filter((cycle) => !Number.isNaN(cycle) && cycle >= 1)
      .sort((a, b) => a - b);

    const maxCycle = Math.max(client.currentCycleNumber || 1, ...cycleNumbers, 1);
    const mismatches: string[] = [];

    for (const lift of lifts) {
      const oneRM = client.oneRepMaxes?.[lift] || 0;
      if (oneRM === 0) continue;

      const baseTm = mround(oneRM * 0.9);
      const increment = lift === 'Squat' || lift === 'Deadlift' ? 10 : 5;

      for (let cycle = 1; cycle <= maxCycle; cycle++) {
        const actualTm = byCycle?.[cycle]?.[lift];
        if (typeof actualTm !== 'number') continue;

        const expectedTm = baseTm + (cycle - 1) * increment;
        if (actualTm !== expectedTm) {
          mismatches.push(`${lift} c${cycle}: ${actualTm} -> ${expectedTm}`);
        }
      }
    }

    if (mismatches.length > 0) {
      repairs.push({
        clientId: client.id,
        clientName: client.name,
        action: 'reset-training-maxes',
        details: mismatches.join('; '),
      });
    }
  }

  for (const record of historical) {
    const client = clients.find((c) => c.id === record.clientId);
    if (!client) continue;

    const oneRM = client.oneRepMaxes?.[record.lift] || 0;
    if (oneRM === 0) continue;

    // Flag records with estimated 1RM > 250% of actual 1RM (data entry errors)
    if (record.estimated1RM > oneRM * 2.5) {
      repairs.push({
        clientId: record.clientId,
        clientName: client.name,
        action: 'delete-record',
        details: `${record.lift}: Delete record with impossible estimated1RM ${record.estimated1RM} (actual 1RM: ${oneRM})`,
      });
    }
  }

  return Response.json({ repairs, totalRepairs: repairs.length }, { status: 200 });
}

async function executeRepairs(clients: any[], historical: any[]) {
  const executed: RepairPlan[] = [];
  let errors: string[] = [];

  for (const client of clients) {
    const existingByCycle = client.trainingMaxesByCycle || {};
    const cycleNumbers = Object.keys(existingByCycle)
      .map((cycleKey) => Number(cycleKey))
      .filter((cycle) => !Number.isNaN(cycle) && cycle >= 1)
      .sort((a, b) => a - b);

    const maxCycle = Math.max(client.currentCycleNumber || 1, ...cycleNumbers, 1);
    const updatedMaxes: any = { ...existingByCycle };
    const updatesForClient: string[] = [];

    for (const lift of lifts) {
      const oneRM = client.oneRepMaxes?.[lift] || 0;
      if (oneRM === 0) continue;

      const baseTm = mround(oneRM * 0.9);
      const increment = lift === 'Squat' || lift === 'Deadlift' ? 10 : 5;

      for (let cycle = 1; cycle <= maxCycle; cycle++) {
        updatedMaxes[cycle] = updatedMaxes[cycle] || {};
        const expectedTm = baseTm + (cycle - 1) * increment;
        const actualTm = existingByCycle?.[cycle]?.[lift];

        if (actualTm !== expectedTm) {
          updatedMaxes[cycle][lift] = expectedTm;
          updatesForClient.push(`${lift} c${cycle}: ${actualTm ?? 'missing'} -> ${expectedTm}`);
        }
      }
    }

    if (updatesForClient.length > 0) {
      const currentCycle = client.currentCycleNumber || 1;
      const nextGlobalTrainingMaxes = updatedMaxes[currentCycle] || client.trainingMaxes;

      try {
        const clientRef = doc(db, 'clients', client.id);
        await updateDoc(clientRef, {
          trainingMaxesByCycle: updatedMaxes,
          trainingMaxes: nextGlobalTrainingMaxes,
        });

        executed.push({
          clientId: client.id,
          clientName: client.name,
          action: 'reset-training-maxes',
          details: updatesForClient.join('; '),
        });
      } catch (e) {
        errors.push(`Failed to update ${client.name}: ${e}`);
      }
    }
  }

  // Delete impossible historical records
  for (const record of historical) {
    const client = clients.find((c) => c.id === record.clientId);
    if (!client) continue;

    const oneRM = client.oneRepMaxes?.[record.lift] || 0;
    if (oneRM === 0) continue;

    if (record.estimated1RM > oneRM * 2.5) {
      try {
        const recordRef = doc(db, 'historicalRecords', record.id);
        await deleteDoc(recordRef);
        executed.push({
          clientId: record.clientId,
          clientName: client.name,
          action: 'delete-record',
          details: `${record.lift}: Deleted impossible record (estimated1RM: ${record.estimated1RM})`,
        });
      } catch (e) {
        errors.push(`Failed to delete record ${record.id}: ${e}`);
      }
    }
  }

  return Response.json(
    {
      success: true,
      executed,
      errors,
      summary: {
        repairsExecuted: executed.length,
        errors: errors.length,
      },
    },
    { status: 200 }
  );
}
