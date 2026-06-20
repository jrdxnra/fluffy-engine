import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const lifts = ['Squat', 'Bench', 'Deadlift', 'Press'] as const;
type LiftName = (typeof lifts)[number];

type ClientAuditDoc = {
  id: string;
  name?: string;
  currentCycleNumber?: number;
  oneRepMaxes?: Partial<Record<LiftName, number>>;
  trainingMaxesByCycle?: Record<number, Partial<Record<LiftName, number>>>;
};

type HistoricalAuditDoc = {
  id: string;
  clientId: string;
  lift: LiftName;
  date?: string;
  weight?: number;
  reps?: number;
  estimated1RM?: number;
};

type CorruptedClientEntry = {
  name?: string;
  oneRepMaxes?: Partial<Record<LiftName, number>>;
  trainingMaxesByCycle?: Record<number, Partial<Record<LiftName, number>>>;
  cycleDetails: Record<number, Partial<Record<LiftName, { actualTm: number; expectedTm: number; oneRM: number; mismatch: boolean; delta: number }>>>;
  issues: string[];
};

type CorruptedHistoricalEntry = {
  name?: string;
  records: Array<{
    id: string;
    date?: string;
    lift: LiftName;
    weight?: number;
    reps?: number;
    estimated1RM?: number;
    oneRM: number;
    excessPercentage: number;
  }>;
};

const mround = (value: number) => Math.round(value / 5) * 5;

export async function GET() {
  try {
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    const historicalSnapshot = await getDocs(collection(db, 'historicalRecords'));

    const clients: ClientAuditDoc[] = [];
    const historical: HistoricalAuditDoc[] = [];

    clientsSnapshot.forEach((doc) => {
      clients.push({ id: doc.id, ...(doc.data() as Omit<ClientAuditDoc, 'id'>) });
    });

    historicalSnapshot.forEach((doc) => {
      historical.push({ id: doc.id, ...(doc.data() as Omit<HistoricalAuditDoc, 'id'>) });
    });

    const corrupted: Record<string, CorruptedClientEntry> = {};
    const corruptedHistorical: Record<string, CorruptedHistoricalEntry> = {};

    for (const client of clients) {
      const issues: string[] = [];
      const byCycle = client.trainingMaxesByCycle || {};
      const cycleNumbers = Object.keys(byCycle)
        .map((cycleKey) => Number(cycleKey))
        .filter((cycle) => !Number.isNaN(cycle) && cycle >= 1)
        .sort((a, b) => a - b);
      const maxCycle = Math.max(client.currentCycleNumber || 1, ...cycleNumbers, 1);
      const cycleDetails: CorruptedClientEntry['cycleDetails'] = {};

      for (const lift of lifts) {
        const oneRM = client.oneRepMaxes?.[lift] || 0;
        if (oneRM === 0) continue;

        const baseTm = mround(oneRM * 0.9);
        const increment = lift === 'Squat' || lift === 'Deadlift' ? 10 : 5;

        for (let cycle = 1; cycle <= maxCycle; cycle++) {
          const actualTm = byCycle?.[cycle]?.[lift];
          if (typeof actualTm !== 'number') continue;

          const expectedTm = baseTm + (cycle - 1) * increment;
          const mismatch = actualTm !== expectedTm;

          if (!mismatch) continue;

          if (!cycleDetails[cycle]) {
            cycleDetails[cycle] = {};
          }

          cycleDetails[cycle][lift] = {
            actualTm,
            expectedTm,
            oneRM,
            mismatch,
            delta: actualTm - expectedTm,
          };

          if (mismatch) {
            issues.push(
              `${lift} cycle ${cycle} TM ${actualTm} should be ${expectedTm} (delta ${actualTm - expectedTm})`
            );
          }
        }
      }

      if (issues.length > 0) {
        corrupted[client.id] = {
          name: client.name,
          oneRepMaxes: client.oneRepMaxes,
          trainingMaxesByCycle: client.trainingMaxesByCycle,
          cycleDetails,
          issues,
        };
      }
    }

    for (const record of historical) {
      const client = clients.find((c) => c.id === record.clientId);
      if (!client) continue;

      const oneRM = client.oneRepMaxes?.[record.lift] || 0;
      if (oneRM === 0) continue;

      const maxHistorical = oneRM * 1.3;
      if (record.estimated1RM && record.estimated1RM > maxHistorical) {
        if (!corruptedHistorical[record.clientId]) {
          corruptedHistorical[record.clientId] = {
            name: client.name,
            records: [],
          };
        }

        corruptedHistorical[record.clientId].records.push({
          id: record.id,
          date: record.date,
          lift: record.lift,
          weight: record.weight,
          reps: record.reps,
          estimated1RM: record.estimated1RM,
          oneRM,
          excessPercentage: Math.round(((record.estimated1RM - oneRM) / oneRM) * 100),
        });
      }
    }

    const clientsToRepair = Object.entries(corrupted).map(([clientId, value]) => ({
      clientId,
      name: value.name,
      issueCount: value.issues.length,
    }));

    return Response.json(
      {
        summary: {
          totalClients: clients.length,
          corruptedClients: Object.keys(corrupted).length,
          totalHistoricalRecords: historical.length,
          corruptedHistoricalRecords: Object.values(corruptedHistorical).reduce(
            (sum: number, c) => sum + c.records.length,
            0
          ),
        },
        clientsToRepair,
        corrupted,
        corruptedHistorical,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Audit error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
