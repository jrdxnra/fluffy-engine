import type { Client, CycleScheduleSettings, CycleSettings, GlobalMovementSettings, HistoricalRecord, Lift } from './types';
import { accessoryMap } from './workout-content';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { logDataConsistencyValidation, validateAllClientsDataConsistency } from './data-validation';
import { buildGlobalMovementSettings, getDefaultMovementProgressionIncrement } from './movement-profiles';
import { getEffectiveCycleMembership, withCycleAdded } from './cycle-membership';
import { inferCycleMembershipForBackfill } from './cycle-membership';

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
  globalMovementOptions?: string[];
  globalMovementSettings?: GlobalMovementSettings;
};

type AppSettingsDocument = {
  cycleSettingsByCycle?: Record<string, CycleSettings>;
  cycleNames?: Record<string, string>;
  cycleSchedulesByCycle?: Record<string, CycleScheduleSettings>;
  globalMovementOptions?: string[];
  globalMovementSettings?: GlobalMovementSettings;
  settingsUpdatedAt?: string;
};

const defaultGlobalMovementOptions = ['Deadlift', 'Bench', 'Squat', 'Press'];

const resolveGlobalMovementOptions = (
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>,
  existing?: string[]
): string[] => {
  const scheduleValues = Object.values(cycleSchedulesByCycle || {}).flatMap((schedule) =>
    Object.values(schedule.liftDisplayNames || {})
  );

  return Array.from(
    new Set(
      [...defaultGlobalMovementOptions, ...(existing || []), ...scheduleValues]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
};

const defaultCycleSchedule: CycleScheduleSettings = {
  cycleStartDate: '',
  day1Weekday: 'Tuesday',
  day2Weekday: 'Thursday',
  skipDeloadWeek: false,
  liftDayAssignments: {
    Deadlift: 'day1',
    Bench: 'day1',
    Squat: 'day2',
    Press: 'day2',
  },
  liftDisplayNames: {
    Deadlift: 'Deadlift',
    Bench: 'Bench',
    Squat: 'Squat',
    Press: 'Press',
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
      liftDisplayNames: {
        ...defaultCycleSchedule.liftDisplayNames,
        ...(schedules[cycleNumber]?.liftDisplayNames || {}),
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
    const backfillUpdates: Promise<unknown>[] = [];
    querySnapshot.forEach((docSnapshot) => {
      const rawClient = { id: docSnapshot.id, ...docSnapshot.data() } as Client;
      const currentCycle = rawClient.currentCycleNumber;
      const trainingMaxesByCycle = {
        ...(rawClient.trainingMaxesByCycle || {}),
      };

      if (currentCycle && !trainingMaxesByCycle[currentCycle]) {
        trainingMaxesByCycle[currentCycle] = { ...rawClient.trainingMaxes };
      }

      const weekAssignmentsByCycle = {
        ...(rawClient.weekAssignmentsByCycle || {}),
      };
      if (currentCycle && !weekAssignmentsByCycle[currentCycle]) {
        weekAssignmentsByCycle[currentCycle] = { week1: '5', week2: '3', week3: '1' };
      }

      const explicitMembership = getEffectiveCycleMembership(rawClient);
      const backfilledMembership = explicitMembership.length > 0
        ? explicitMembership
        : inferCycleMembershipForBackfill(rawClient);

      if (explicitMembership.length === 0 && backfilledMembership.length > 0) {
        const nextCurrentCycle = rawClient.currentCycleNumber ?? backfilledMembership[backfilledMembership.length - 1];
        backfillUpdates.push(updateClient(rawClient.id, {
          cycleMembership: backfilledMembership,
          currentCycleNumber: nextCurrentCycle,
        }));
      }

      clients.push({
        ...rawClient,
        cycleMembership: backfilledMembership,
        trainingMaxesByCycle,
        weekAssignmentsByCycle,
      });
    });

    if (backfillUpdates.length > 0) {
      await Promise.all(backfillUpdates);
    }

    const sortedClients = clients.sort((a, b) => {
      const aOrder = a.rosterOrder;
      const bOrder = b.rosterOrder;
      if (typeof aOrder === 'number' && typeof bOrder === 'number') {
        return aOrder - bOrder;
      }
      if (typeof aOrder === 'number') return -1;
      if (typeof bOrder === 'number') return 1;
      return a.name.localeCompare(b.name);
    });

    // Validate data consistency in development
    if (process.env.NODE_ENV === 'development') {
      logDataConsistencyValidation(sortedClients);
    }

    return sortedClients;
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
          globalMovementOptions: resolveGlobalMovementOptions(
            withDefaultSchedules(cycleSettingsByCycle, cycleSchedulesByCycle),
            data.globalMovementOptions
          ),
          globalMovementSettings: buildGlobalMovementSettings(
            resolveGlobalMovementOptions(withDefaultSchedules(cycleSettingsByCycle, cycleSchedulesByCycle), data.globalMovementOptions),
            data.globalMovementSettings
          ),
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
        globalMovementOptions: resolveGlobalMovementOptions(
          withDefaultSchedules(cycleSettingsByCycle, cycleSchedulesByCycle),
          clientWithSettings.globalMovementOptions || []
        ),
        globalMovementSettings: buildGlobalMovementSettings(
          resolveGlobalMovementOptions(withDefaultSchedules(cycleSettingsByCycle, cycleSchedulesByCycle), clientWithSettings.globalMovementOptions || []),
          clientWithSettings.globalMovementSettings || {}
        ),
      };
    }

    return {
      cycleSettingsByCycle: { 1: cycleSettings },
      cycleNames: { 1: 'Cycle 1' },
      cycleSchedulesByCycle: { 1: { ...defaultCycleSchedule } },
      globalMovementOptions: [...defaultGlobalMovementOptions],
      globalMovementSettings: buildGlobalMovementSettings(defaultGlobalMovementOptions),
    };
  } catch (error) {
    console.error('Error getting app settings:', error);
    return {
      cycleSettingsByCycle: { 1: cycleSettings },
      cycleNames: { 1: 'Cycle 1' },
      cycleSchedulesByCycle: { 1: { ...defaultCycleSchedule } },
      globalMovementOptions: [...defaultGlobalMovementOptions],
      globalMovementSettings: buildGlobalMovementSettings(defaultGlobalMovementOptions),
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
    const globalMovementOptions = resolveGlobalMovementOptions(cycleSchedulesByCycle, settings.globalMovementOptions || existingData.globalMovementOptions || []);
    const globalMovementSettings = buildGlobalMovementSettings(
      globalMovementOptions,
      settings.globalMovementSettings || existingData.globalMovementSettings || {}
    );

    await setDoc(settingsRef, {
      cycleSettingsByCycle: normalizedCycleSettingsByCycle,
      cycleNames: settings.cycleNames,
      cycleSchedulesByCycle,
      globalMovementOptions,
      globalMovementSettings,
      settingsUpdatedAt,
    });
    return { success: true, settingsUpdatedAt, cycleSchedulesByCycle, globalMovementOptions, globalMovementSettings };
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

export const deleteClient = async (clientId: string) => {
  try {
    const clientRef = doc(db, 'clients', clientId);
    await deleteDoc(clientRef);
    return { id: clientId };
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
};

export const graduateTeam = async (
  clients: Client[],
  options?: {
    noIncrementLifts?: Lift[];
    calibrationLifts?: Lift[];
  }
) => {
  try {
    // Pre-graduation validation
    const preValidation = validateAllClientsDataConsistency(clients);
    if (preValidation.clientsWithErrors > 0) {
      console.error('Data consistency errors found before graduation:', preValidation.allErrors);
      throw new Error('Cannot graduate team: data consistency errors detected');
    }

    const noIncrementLiftSet = new Set(options?.noIncrementLifts || []);
    const calibrationLiftSet = new Set(options?.calibrationLifts || []);

    const result = clients.map((client) => {
      const currentCycle = client.currentCycleNumber || 1;
      const nextCycle = currentCycle + 1;

      const currentCycleCalibration = client.movementCalibrationsByCycle?.[currentCycle] || {};
      const recentlyCalibratedLiftSet = new Set(
        (Object.keys(currentCycleCalibration) as Lift[]).filter(
          (lift) => currentCycleCalibration[lift]?.needsCalibration
        )
      );

      const incrementByLift: Record<Lift, number> = {
        Squat: noIncrementLiftSet.has('Squat') || recentlyCalibratedLiftSet.has('Squat') ? 0 : 10,
        Deadlift: noIncrementLiftSet.has('Deadlift') || recentlyCalibratedLiftSet.has('Deadlift') ? 0 : 10,
        Bench: noIncrementLiftSet.has('Bench') || recentlyCalibratedLiftSet.has('Bench') ? 0 : 5,
        Press: noIncrementLiftSet.has('Press') || recentlyCalibratedLiftSet.has('Press') ? 0 : 5,
      };

      const newTrainingMaxes = {
        Squat: calibrationLiftSet.has('Squat') ? 0 : client.trainingMaxes.Squat + incrementByLift.Squat,
        Deadlift: calibrationLiftSet.has('Deadlift') ? 0 : client.trainingMaxes.Deadlift + incrementByLift.Deadlift,
        Bench: calibrationLiftSet.has('Bench') ? 0 : client.trainingMaxes.Bench + incrementByLift.Bench,
        Press: calibrationLiftSet.has('Press') ? 0 : client.trainingMaxes.Press + incrementByLift.Press,
      };

      const updatedTrainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
      for (const cycleKey of Object.keys(updatedTrainingMaxesByCycle)) {
        const cycle = Number(cycleKey);
        if (!Number.isNaN(cycle) && cycle >= nextCycle) {
          updatedTrainingMaxesByCycle[cycle] = { ...newTrainingMaxes };
        }
      }
      updatedTrainingMaxesByCycle[nextCycle] = { ...newTrainingMaxes };

      const previousOneRepMaxes = client.oneRepMaxesByCycle?.[currentCycle] || client.oneRepMaxes;
      const nextOneRepMaxes = {
        ...previousOneRepMaxes,
      };

      for (const lift of calibrationLiftSet) {
        nextOneRepMaxes[lift] = 0;
      }

      const movementCalibrationsForNextCycle = {
        ...(client.movementCalibrationsByCycle?.[nextCycle] || {}),
      };

      const currentCycleMovementProfiles = client.movementProfilesByCycle?.[currentCycle] || {};
      const movementProfilesForNextCycle = {
        ...(client.movementProfilesByCycle?.[nextCycle] || {}),
      };

      for (const [movementName, profile] of Object.entries(currentCycleMovementProfiles)) {
        const shouldHold = Boolean(profile.progressionHoldActive || profile.calibrationPhaseActive);
        const increment = shouldHold ? 0 : (profile.progressionIncrement || getDefaultMovementProgressionIncrement(movementName, undefined));
        movementProfilesForNextCycle[movementName] = {
          ...profile,
          oneRepMax: shouldHold ? profile.oneRepMax : profile.oneRepMax + increment,
          trainingMax: shouldHold ? profile.trainingMax : Math.round(((profile.oneRepMax + increment) * 0.9) / 5) * 5,
          movementCycleNumber: (profile.movementCycleNumber || 1) + 1,
          lastUpdatedAt: new Date().toISOString(),
        };
      }

      for (const lift of calibrationLiftSet) {
        movementCalibrationsForNextCycle[lift] = {
          needsCalibration: true,
        };
      }

      const updatedClient = {
        ...client,
        currentCycleNumber: nextCycle,
        cycleMembership: withCycleAdded(client, nextCycle),
        oneRepMaxesByCycle: {
          ...(client.oneRepMaxesByCycle || {}),
          [nextCycle]: nextOneRepMaxes,
        },
        oneRepMaxes: nextOneRepMaxes,
        trainingMaxes: newTrainingMaxes,
        trainingMaxesByCycle: updatedTrainingMaxesByCycle,
        weekAssignmentsByCycle: {
          ...(client.weekAssignmentsByCycle || {}),
          [nextCycle]: { week1: '5', week2: '3', week3: '1' },
        },
        movementCalibrationsByCycle: {
          ...(client.movementCalibrationsByCycle || {}),
          [nextCycle]: movementCalibrationsForNextCycle,
        },
        movementProfilesByCycle: {
          ...(client.movementProfilesByCycle || {}),
          [nextCycle]: movementProfilesForNextCycle,
        },
      };

      return updatedClient;
    });

    // Update all clients in the database
    for (const updatedClient of result) {
      await updateClient(updatedClient.id, updatedClient);
    }

    // Post-graduation validation
    const postValidation = validateAllClientsDataConsistency(result);
    if (postValidation.clientsWithErrors > 0) {
      console.error('Data consistency errors after graduation:', postValidation.allErrors);
      // Don't throw here - the graduation succeeded, but log the issue
    }

    // Get the next cycle from the first client (they should all be the same)
    const nextCycle = result[0]?.currentCycleNumber || 2;
    console.log(`✅ Team graduated successfully. ${clients.length} clients moved to cycle ${nextCycle}`);
    return result;
  } catch (error) {
    console.error('Error graduating team:', error);
    throw error;
  }
};
