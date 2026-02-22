import type { Client, CycleScheduleSettings, CycleSettings, HistoricalRecord, Lift } from './types';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { accessoryMap } from './workout-content';

const cycleSettings: CycleSettings = {
  week1: {
    name: 'Week 1',
    percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.65, workset2: 0.75, workset3: 0.85 },
    reps: { workset1: 5, workset2: 5, workset3: '5+' },
    accessories: {
      Squat: ['Front Squat', 'GM (Standing)', 'GM (Dead)', 'GM (Seated)', 'Dbell Lunges', 'Barbell Lunges', 'Leg Curl', 'Dips', 'DB Row', "Farmer's Carry"],
      Bench: ['Incline Bench', 'Dbell Inc Bench', 'Cable Flyes', 'Dbell Flyes', 'Wide Dips', 'Close Grip Bench', 'Push Ups', 'Assisted Push Ups', 'Leg Raises', 'Bar Hang', 'Bar Hang - High'],
      Deadlift: ['Romanian Deads', 'Stiff Leg Deads', 'Glute Ham Raise', 'Reverse Hyper', 'Hip Thrusts', 'Farmer Walk', 'Back Extension', 'French Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
      Press: ['Wide Upright Row', 'Face Pulls', 'Shrugs', 'Overhand BB Curl', 'Hammer Curl', 'EZ Bar Curl', 'JM Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
    },
  },
  week2: {
    name: 'Week 2',
    percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.7, workset2: 0.8, workset3: 0.9 },
    reps: { workset1: 3, workset2: 3, workset3: '3+' },
    accessories: {
      Squat: ['Front Squat', 'GM (Standing)', 'GM (Dead)', 'GM (Seated)', 'Dbell Lunges', 'Barbell Lunges', 'Leg Curl', 'Dips', 'DB Row', "Farmer's Carry"],
      Bench: ['Incline Bench', 'Dbell Inc Bench', 'Cable Flyes', 'Dbell Flyes', 'Wide Dips', 'Close Grip Bench', 'Push Ups', 'Assisted Push Ups', 'Leg Raises', 'Bar Hang', 'Bar Hang - High'],
      Deadlift: ['Romanian Deads', 'Stiff Leg Deads', 'Glute Ham Raise', 'Reverse Hyper', 'Hip Thrusts', 'Farmer Walk', 'Back Extension', 'French Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
      Press: ['Wide Upright Row', 'Face Pulls', 'Shrugs', 'Overhand BB Curl', 'Hammer Curl', 'EZ Bar Curl', 'JM Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
    },
  },
  week3: {
    name: 'Week 3',
    percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.75, workset2: 0.85, workset3: 0.95 },
    reps: { workset1: 5, workset2: 3, workset3: '1+' },
    accessories: {
      Squat: ['Front Squat', 'GM (Standing)', 'GM (Dead)', 'GM (Seated)', 'Dbell Lunges', 'Barbell Lunges', 'Leg Curl', 'Dips', 'DB Row', "Farmer's Carry"],
      Bench: ['Incline Bench', 'Dbell Inc Bench', 'Cable Flyes', 'Dbell Flyes', 'Wide Dips', 'Close Grip Bench', 'Push Ups', 'Assisted Push Ups', 'Leg Raises', 'Bar Hang', 'Bar Hang - High'],
      Deadlift: ['Romanian Deads', 'Stiff Leg Deads', 'Glute Ham Raise', 'Reverse Hyper', 'Hip Thrusts', 'Farmer Walk', 'Back Extension', 'French Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
      Press: ['Wide Upright Row', 'Face Pulls', 'Shrugs', 'Overhand BB Curl', 'Hammer Curl', 'EZ Bar Curl', 'JM Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
    },
  },
  week4: {
    name: 'Week 4',
    percentages: { warmup1: 0.5, warmup2: 0.6, workset1: 0.4, workset2: 0.5, workset3: 0.6 },
    reps: { workset1: 5, workset2: 5, workset3: '5' },
    accessories: {
      Squat: ['Front Squat', 'GM (Standing)', 'GM (Dead)', 'GM (Seated)', 'Dbell Lunges', 'Barbell Lunges', 'Leg Curl', 'Dips', 'DB Row', "Farmer's Carry"],
      Bench: ['Incline Bench', 'Dbell Inc Bench', 'Cable Flyes', 'Dbell Flyes', 'Wide Dips', 'Close Grip Bench', 'Push Ups', 'Assisted Push Ups', 'Leg Raises', 'Bar Hang', 'Bar Hang - High'],
      Deadlift: ['Romanian Deads', 'Stiff Leg Deads', 'Glute Ham Raise', 'Reverse Hyper', 'Hip Thrusts', 'Farmer Walk', 'Back Extension', 'French Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
      Press: ['Wide Upright Row', 'Face Pulls', 'Shrugs', 'Overhand BB Curl', 'Hammer Curl', 'EZ Bar Curl', 'JM Press', 'Skull Crushers', 'Close Grip Dips', 'Pull Up Variation'],
    },
  },
};

type AppSettings = {
  cycleSettingsByCycle: Record<number, CycleSettings>;
  cycleNames: Record<number, string>;
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>;
};

type AppSettingsDocument = {
  cycleSettingsByCycle?: Record<string, CycleSettings>;
  cycleNames?: Record<string, string>;
  cycleSchedulesByCycle?: Record<string, CycleScheduleSettings>;
  settingsUpdatedAt?: string;
};

const defaultCycleSchedule: CycleScheduleSettings = {
  cycleStartDate: '',
  day1Weekday: 'Tuesday',
  day2Weekday: 'Thursday',
  liftDayAssignments: {
    Deadlift: 'day1',
    Bench: 'day1',
    Squat: 'day2',
    Press: 'day2',
  },
};

const withDefaultSchedules = (
  cycleSettingsByCycle: Record<number, CycleSettings>,
  existing?: Record<number, CycleScheduleSettings>
): Record<number, CycleScheduleSettings> => {
  const schedules: Record<number, CycleScheduleSettings> = { ...(existing || {}) };
  for (const cycleNumber of Object.keys(cycleSettingsByCycle).map(Number)) {
    schedules[cycleNumber] = {
      ...defaultCycleSchedule,
      ...(schedules[cycleNumber] || {}),
      liftDayAssignments: {
        ...defaultCycleSchedule.liftDayAssignments,
        ...(schedules[cycleNumber]?.liftDayAssignments || {}),
      },
    };
  }
  return schedules;
};

const normalizeNumberKeyRecord = <T>(
  input: Record<string, T> | undefined
): Record<number, T> => {
  const result: Record<number, T> = {};
  if (!input) return result;
  for (const [key, value] of Object.entries(input)) {
    const numKey = Number(key);
    if (!Number.isNaN(numKey)) {
      result[numKey] = value;
    }
  }
  return result;
};

const normalizeWarmupPercentages = (
  cycleSettingsByCycle: Record<number, CycleSettings>
): Record<number, CycleSettings> => {
  const normalized: Record<number, CycleSettings> = {};

  for (const [cycleKey, settings] of Object.entries(cycleSettingsByCycle || {})) {
    const cycleNumber = Number(cycleKey);
    if (Number.isNaN(cycleNumber)) continue;

    const normalizedSettings = JSON.parse(JSON.stringify(settings)) as CycleSettings;
    for (const weekKey of Object.keys(normalizedSettings)) {
      const week = normalizedSettings[weekKey];
      if (!week?.percentages) continue;
      week.percentages.warmup1 = 0.5;
      week.percentages.warmup2 = 0.6;
    }

    normalized[cycleNumber] = normalizedSettings;
  }

  return normalized;
};

const normalizeAccessoryName = (name: string): string => {
  return name
    .replace(/^\s*\d+\s*x\s*\d+[a-z]*\s+/i, '')
    .replace(/^\s*\d+\s*x\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const lifts: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Press'];

const normalizeAccessoryVisibility = (
  cycleSettingsByCycle: Record<number, CycleSettings>
): Record<number, CycleSettings> => {
  const normalized: Record<number, CycleSettings> = {};

  for (const [cycleKey, settings] of Object.entries(cycleSettingsByCycle || {})) {
    const cycleNumber = Number(cycleKey);
    if (Number.isNaN(cycleNumber)) continue;

    const nextSettings = JSON.parse(JSON.stringify(settings)) as CycleSettings;
    const week1 = nextSettings.week1;

    for (const [weekKey, week] of Object.entries(nextSettings)) {
      if (!week) continue;

      for (const lift of lifts) {
        const weekAccessories = (week.accessories?.[lift] || accessoryMap[lift].exercises).filter(Boolean);
        if (weekAccessories.length === 0) continue;

        const existingMap = week.accessoryVisibility?.[lift];
        const hasMap = !!existingMap && Object.keys(existingMap).length > 0;
        if (hasMap) continue;

        if (weekKey === 'week1') continue;

        const week1Map = week1?.accessoryVisibility?.[lift];
        const hasWeek1Map = !!week1Map && Object.keys(week1Map).length > 0;
        if (!hasWeek1Map) continue;

        const selectedNormalized = new Set(
          Object.entries(week1Map)
            .filter(([, visible]) => visible === true)
            .map(([name]) => normalizeAccessoryName(name))
        );

        if (selectedNormalized.size === 0) continue;

        const generated = weekAccessories.reduce<Record<string, boolean>>((acc, exercise) => {
          acc[exercise] = selectedNormalized.has(normalizeAccessoryName(exercise));
          return acc;
        }, {});

        const hasAnySelected = Object.values(generated).some((value) => value === true);
        if (!hasAnySelected) continue;

        week.accessoryVisibility = {
          ...(week.accessoryVisibility || {}),
          [lift]: generated,
        };
      }
    }

    normalized[cycleNumber] = nextSettings;
  }

  return normalized;
};

export const getClients = async (): Promise<Client[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'clients'));
    const clients: Client[] = [];
    querySnapshot.forEach((docSnapshot) => {
      clients.push({ id: docSnapshot.id, ...docSnapshot.data() } as Client);
    });
    return clients.sort((a, b) => {
      const aOrder = a.rosterOrder;
      const bOrder = b.rosterOrder;
      if (typeof aOrder === 'number' && typeof bOrder === 'number') {
        return aOrder - bOrder;
      }
      if (typeof aOrder === 'number') return -1;
      if (typeof bOrder === 'number') return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error getting clients:', error);
    return [];
  }
};

export const getCycleSettings = () => cycleSettings;

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const settingsRef = doc(db, 'appSettings', 'cycleSettings');
    const settingsSnapshot = await getDoc(settingsRef);

    if (settingsSnapshot.exists()) {
      const data = settingsSnapshot.data() as AppSettingsDocument;
      const cycleSettingsByCycle = normalizeAccessoryVisibility(normalizeWarmupPercentages(normalizeNumberKeyRecord<CycleSettings>(
        data.cycleSettingsByCycle
      )));
      const cycleNames = normalizeNumberKeyRecord<string>(data.cycleNames);
      const cycleSchedulesByCycle = normalizeNumberKeyRecord<CycleScheduleSettings>(
        data.cycleSchedulesByCycle
      );

      if (Object.keys(cycleSettingsByCycle).length > 0) {
        if (Object.keys(cycleNames).length === 0) {
          cycleNames[1] = 'Cycle 1';
        }
        return {
          cycleSettingsByCycle,
          cycleNames,
          cycleSchedulesByCycle: withDefaultSchedules(cycleSettingsByCycle, cycleSchedulesByCycle),
        };
      }
    }

    const clients = await getClients();
    const clientWithSettings = clients.find((client: any) =>
      client.cycleSettingsByCycle && Object.keys(client.cycleSettingsByCycle).length > 0
    ) as any;

    if (clientWithSettings) {
      const cycleSettingsByCycle = normalizeAccessoryVisibility(normalizeWarmupPercentages(normalizeNumberKeyRecord<CycleSettings>(
        clientWithSettings.cycleSettingsByCycle
      )));
      const cycleNames = normalizeNumberKeyRecord<string>(clientWithSettings.cycleNames || {});
      const cycleSchedulesByCycle = normalizeNumberKeyRecord<CycleScheduleSettings>(
        clientWithSettings.cycleSchedulesByCycle || {}
      );
      if (Object.keys(cycleNames).length === 0) {
        cycleNames[1] = 'Cycle 1';
      }
      return {
        cycleSettingsByCycle,
        cycleNames,
        cycleSchedulesByCycle: withDefaultSchedules(cycleSettingsByCycle, cycleSchedulesByCycle),
      };
    }

    return {
      cycleSettingsByCycle: { 1: cycleSettings },
      cycleNames: { 1: 'Cycle 1' },
      cycleSchedulesByCycle: { 1: { ...defaultCycleSchedule } },
    };
  } catch (error) {
    console.error('Error getting app settings:', error);
    return {
      cycleSettingsByCycle: { 1: cycleSettings },
      cycleNames: { 1: 'Cycle 1' },
      cycleSchedulesByCycle: { 1: { ...defaultCycleSchedule } },
    };
  }
};

export const saveAppSettings = async (settings: AppSettings) => {
  try {
    const settingsUpdatedAt = new Date().toISOString();
    const settingsRef = doc(db, 'appSettings', 'cycleSettings');
    const existingSnapshot = await getDoc(settingsRef);
    const existingData = existingSnapshot.exists()
      ? (existingSnapshot.data() as AppSettingsDocument)
      : {};

    const normalizedCycleSettingsByCycle = normalizeAccessoryVisibility(normalizeWarmupPercentages(settings.cycleSettingsByCycle));
    const resolvedSchedules = settings.cycleSchedulesByCycle || normalizeNumberKeyRecord<CycleScheduleSettings>(existingData.cycleSchedulesByCycle);
    const cycleSchedulesByCycle = withDefaultSchedules(normalizedCycleSettingsByCycle, resolvedSchedules);

    await setDoc(settingsRef, {
      cycleSettingsByCycle: normalizedCycleSettingsByCycle,
      cycleNames: settings.cycleNames,
      cycleSchedulesByCycle,
      settingsUpdatedAt,
    });
    return { success: true, settingsUpdatedAt, cycleSchedulesByCycle };
  } catch (error) {
    console.error('Error saving app settings:', error);
    throw error;
  }
};

export const getHistoricalData = async (): Promise<HistoricalRecord[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'historicalRecords'));
    const records: HistoricalRecord[] = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      records.push({
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
      } as HistoricalRecord);
    });
    return records;
  } catch (error) {
    console.error('Error getting historical data:', error);
    return [];
  }
};

export const addClient = async (clientData: Omit<Client, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'clients'), clientData);
    return { id: docRef.id, ...clientData };
  } catch (error) {
    console.error('Error adding client:', error);
    throw error;
  }
};

export const addHistoricalRecord = async (record: HistoricalRecord) => {
  try {
    const recordToAdd = {
      ...record,
      date: new Date(record.date),
    };
    const docRef = await addDoc(collection(db, 'historicalRecords'), recordToAdd);
    return { id: docRef.id, ...record };
  } catch (error) {
    console.error('Error adding historical record:', error);
    throw error;
  }
};

export const updateClient = async (clientId: string, updates: Partial<Client>) => {
  try {
    const clientRef = doc(db, 'clients', clientId);
    await updateDoc(clientRef, updates);
    return { id: clientId, ...updates };
  } catch (error) {
    console.error('Error updating client:', error);
    throw error;
  }
};

export const graduateTeam = async (clients: Client[]) => {
  try {
    const updates = clients.map((client) => {
      const currentCycle = client.currentCycleNumber || 1;
      const nextCycle = currentCycle + 1;

      const updatedClient = {
        ...client,
        currentCycleNumber: nextCycle,
        trainingMaxes: {
          Squat: client.trainingMaxes.Squat + 10,
          Deadlift: client.trainingMaxes.Deadlift + 10,
          Bench: client.trainingMaxes.Bench + 5,
          Press: client.trainingMaxes.Press + 5,
        },
        weekAssignmentsByCycle: {
          ...(client.weekAssignmentsByCycle || {}),
          [nextCycle]: { week1: '5', week2: '3', week3: '1' },
        },
      };

      return { clientId: client.id, updates: updatedClient };
    });

    for (const { clientId, updates: clientUpdates } of updates) {
      await updateClient(clientId, clientUpdates);
    }

    return clients.map((client) => {
      const currentCycle = client.currentCycleNumber || 1;
      const nextCycle = currentCycle + 1;
      return {
        ...client,
        currentCycleNumber: nextCycle,
        trainingMaxes: {
          Squat: client.trainingMaxes.Squat + 10,
          Deadlift: client.trainingMaxes.Deadlift + 10,
          Bench: client.trainingMaxes.Bench + 5,
          Press: client.trainingMaxes.Press + 5,
        },
        weekAssignmentsByCycle: {
          ...(client.weekAssignmentsByCycle || {}),
          [nextCycle]: { week1: '5', week2: '3', week3: '1' },
        },
      };
    });
  } catch (error) {
    console.error('Error graduating team:', error);
    throw error;
  }
};
