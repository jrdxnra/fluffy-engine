import 'dotenv/config';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const mround = (n: number) => Math.round(n / 5) * 5;

async function run() {
  const snap = await getDocs(collection(db, 'clients'));
  const mick = snap.docs.find((d) => (d.data() as { name: string }).name === 'Mick');

  if (!mick) {
    console.error('Mick not found');
    process.exit(1);
  }

  const data = mick.data() as Record<string, unknown>;
  const currentCycle: number = (data.currentCycleNumber as number) || 1;

  const prevOneRepMaxes = (data.oneRepMaxes as Record<string, number>) || {};
  const prevTmByCycle = (data.trainingMaxesByCycle as Record<number, Record<string, number>>) || {};
  const prevTm = prevTmByCycle[currentCycle] || (data.trainingMaxes as Record<string, number>) || {};

  console.log('--- BEFORE ---');
  console.log('  Current cycle:', currentCycle);
  console.log('  Deadlift 1RM:', prevOneRepMaxes.Deadlift);
  console.log('  Deadlift TM (cycle', currentCycle, '):', prevTm.Deadlift);

  // Hold: set 1RM=335 so TM=300 (90% of 335 = 301.5 → rounds to 300)
  // This produces 3-rep week: WS1=210, WS2=240, Top=270
  const newOneRepMaxes = { ...prevOneRepMaxes, Deadlift: 335 };
  const newTm = {
    Squat:    mround((prevTm.Squat    || prevOneRepMaxes.Squat    || 0) * 0.9),
    Bench:    mround((prevTm.Bench    || prevOneRepMaxes.Bench    || 0) * 0.9),
    Deadlift: 300,
    Press:    mround((prevTm.Press    || prevOneRepMaxes.Press    || 0) * 0.9),
  };

  const newTmByCycle = { ...prevTmByCycle, [currentCycle]: newTm };
  const newOneRepMaxesByCycle = {
    ...((data.oneRepMaxesByCycle as Record<number, Record<string, number>>) || {}),
    [currentCycle]: newOneRepMaxes,
  };

  // Also fix the movement profile — this is what actually drives the workout calculation
  const existingProfilesByCycle = (data.movementProfilesByCycle as Record<number, Record<string, unknown>>) || {};
  const existingProfilesForCycle = existingProfilesByCycle[currentCycle] || {};

  // Update all keys that resolve to "Deadlift" (could be "Deadlift", "deadlift", display name variant, etc.)
  const updatedProfilesForCycle: Record<string, unknown> = { ...existingProfilesForCycle };
  let profilesFixed = 0;
  for (const [key, profile] of Object.entries(existingProfilesForCycle)) {
    const p = profile as Record<string, unknown>;
    const normalizedKey = String(key).trim().toLowerCase();
    if (normalizedKey === 'deadlift') {
      updatedProfilesForCycle[key] = {
        ...p,
        oneRepMax: 300,
        trainingMax: 270,
        progressionHoldActive: true,
        lastUpdatedAt: new Date().toISOString(),
      };
      profilesFixed++;
      console.log(`  Fixed movement profile key: "${key}" — was TM=${p.trainingMax}, now TM=270`);
    }
  }

  const newMovementProfilesByCycle = {
    ...existingProfilesByCycle,
    [currentCycle]: updatedProfilesForCycle,
  };

  await updateDoc(doc(db, 'clients', mick.id), {
    oneRepMaxes: newOneRepMaxes,
    trainingMaxes: newTm,
    oneRepMaxesByCycle: newOneRepMaxesByCycle,
    trainingMaxesByCycle: newTmByCycle,
    movementProfilesByCycle: newMovementProfilesByCycle,
  });

  console.log('--- AFTER ---');
  console.log('  Deadlift 1RM:', newOneRepMaxes.Deadlift);
  console.log('  Deadlift TM (cycle', currentCycle, '):', newTm.Deadlift);
  console.log('  Movement profiles fixed:', profilesFixed);
  console.log('  3-rep week loads:');
  console.log('    Work Set 1 (70%):', mround(newTm.Deadlift * 0.7));
  console.log('    Work Set 2 (80%):', mround(newTm.Deadlift * 0.8));
  console.log('    Top Set    (90%):', mround(newTm.Deadlift * 0.9));
  console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
