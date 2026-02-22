import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import type { TrainingMaxes } from '@/lib/types';
import { calculateTrainingMaxes } from '@/lib/training-max';

const initialClients = [
  {
    name: 'Devon',
    oneRepMaxes: { Squat: 201, Bench: 172, Deadlift: 263, Press: 74 },
    trainingMaxes: { Squat: 201, Bench: 172, Deadlift: 263, Press: 74 },
    initialWeights: { Squat: 201, Bench: 172, Deadlift: 263, Press: 74 },
    actualWeights: { Squat: 201, Bench: 172, Deadlift: 263, Press: 74 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Michael',
    oneRepMaxes: { Squat: 292, Bench: 196, Deadlift: 269, Press: 109 },
    trainingMaxes: { Squat: 292, Bench: 196, Deadlift: 269, Press: 109 },
    initialWeights: { Squat: 292, Bench: 196, Deadlift: 269, Press: 109 },
    actualWeights: { Squat: 292, Bench: 196, Deadlift: 269, Press: 109 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Michelle',
    oneRepMaxes: { Squat: 149, Bench: 109, Deadlift: 176, Press: 56 },
    trainingMaxes: { Squat: 149, Bench: 109, Deadlift: 176, Press: 56 },
    initialWeights: { Squat: 149, Bench: 109, Deadlift: 176, Press: 56 },
    actualWeights: { Squat: 149, Bench: 109, Deadlift: 176, Press: 56 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Yuriy',
    oneRepMaxes: { Squat: 264, Bench: 189, Deadlift: 253, Press: 114 },
    trainingMaxes: { Squat: 264, Bench: 189, Deadlift: 253, Press: 114 },
    initialWeights: { Squat: 264, Bench: 189, Deadlift: 253, Press: 114 },
    actualWeights: { Squat: 264, Bench: 189, Deadlift: 253, Press: 114 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Mick',
    oneRepMaxes: { Squat: 207, Bench: 196, Deadlift: 253, Press: 92 },
    trainingMaxes: { Squat: 207, Bench: 196, Deadlift: 253, Press: 92 },
    initialWeights: { Squat: 207, Bench: 196, Deadlift: 253, Press: 92 },
    actualWeights: { Squat: 207, Bench: 196, Deadlift: 253, Press: 92 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Akshta',
    oneRepMaxes: { Squat: 264, Bench: 92, Deadlift: 191, Press: 114 },
    trainingMaxes: { Squat: 264, Bench: 92, Deadlift: 191, Press: 114 },
    initialWeights: { Squat: 264, Bench: 92, Deadlift: 191, Press: 114 },
    actualWeights: { Squat: 264, Bench: 92, Deadlift: 191, Press: 114 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Livvie',
    oneRepMaxes: { Squat: 264, Bench: 127, Deadlift: 212, Press: 114 },
    trainingMaxes: { Squat: 264, Bench: 127, Deadlift: 212, Press: 114 },
    initialWeights: { Squat: 264, Bench: 127, Deadlift: 212, Press: 114 },
    actualWeights: { Squat: 264, Bench: 127, Deadlift: 212, Press: 114 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Hunter',
    oneRepMaxes: { Squat: 264, Bench: 127, Deadlift: 232, Press: 114 },
    trainingMaxes: { Squat: 264, Bench: 127, Deadlift: 232, Press: 114 },
    initialWeights: { Squat: 264, Bench: 127, Deadlift: 232, Press: 114 },
    actualWeights: { Squat: 264, Bench: 127, Deadlift: 232, Press: 114 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
  {
    name: 'Kristina',
    oneRepMaxes: { Squat: 264, Bench: 132, Deadlift: 165, Press: 114 },
    trainingMaxes: { Squat: 264, Bench: 132, Deadlift: 165, Press: 114 },
    initialWeights: { Squat: 264, Bench: 132, Deadlift: 165, Press: 114 },
    actualWeights: { Squat: 264, Bench: 132, Deadlift: 165, Press: 114 },
    currentCycleNumber: 1,
    weekAssignmentsByCycle: { 1: { week1: "5", week2: "3", week3: "1" } },
    notes: "",
  },
].map((client) => {
  const trainingMaxes = calculateTrainingMaxes(client.oneRepMaxes as TrainingMaxes);
  return {
    ...client,
    trainingMaxes,
    initialWeights: trainingMaxes,
    actualWeights: trainingMaxes,
    trainingMaxesByCycle: { 1: trainingMaxes },
    currentCycleNumber: client.currentCycleNumber || 1,
    weekAssignmentsByCycle: client.weekAssignmentsByCycle || { 1: { week1: '5', week2: '3', week3: '1' } },
  };
});

const initialHistoricalRecords: any[] = [];

export async function seedDatabase() {
  try {
    // Check if data already exists
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    if (!clientsSnapshot.empty) {
      console.log('Database already seeded.');
      return { success: false, message: 'Database already has data' };
    }

    // Add clients
    const clientsRef = collection(db, 'clients');
    const addedClients = [];
    for (const client of initialClients) {
      const doc = await addDoc(clientsRef, client);
      addedClients.push({ id: doc.id, ...client });
    }
    console.log(`Added ${addedClients.length} clients`);

    // Add historical records with client IDs
    const historicalRef = collection(db, 'historicalRecords');
    for (const record of initialHistoricalRecords) {
      const updatedRecord = {
        ...record,
        clientId: addedClients[0].id, // Use first client's ID
      };
      await addDoc(historicalRef, updatedRecord);
    }
    console.log(`Added ${initialHistoricalRecords.length} historical records`);

    return {
      success: true,
      message: `Seeded database with ${addedClients.length} clients and ${initialHistoricalRecords.length} records`,
    };
  } catch (error) {
    console.error('Error seeding database:', error);
    return { success: false, message: `Failed to seed database: ${error}` };
  }
}
