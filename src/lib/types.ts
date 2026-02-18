export type Lift = 'Squat' | 'Bench' | 'Deadlift' | 'Press';

export const Lifts: Lift[] = ['Squat', 'Bench', 'Deadlift', 'Press'];

export type TrainingMaxes = {
  [key in Lift]: number;
};

export interface Client {
  id: string;
  name: string;
  oneRepMaxes: TrainingMaxes;
  trainingMaxes: TrainingMaxes;
};

export interface CycleWeekSettings {
  name: string;
  percentages: {
    warmup1: number;
    warmup2: number;
    workset1: number;
    workset2: number;
    workset3: number;
  };
  reps: {
    workset1: number;
    workset2: number;
    workset3: string; // e.g. "5+"
  };
};

export interface CycleSettings {
  [week: string]: CycleWeekSettings;
};

export interface HistoricalRecord {
  clientId: string;
  date: string; // ISO string
  lift: Lift;
  weight: number;
  reps: number;
  estimated1RM: number;
};

export type WorkoutSet = {
  type: 'Warm-up' | 'Work Set';
  set: number;
  label: string;
  weight: number;
  reps: string | number;
  plates: string;
};

export type CalculatedWorkout = {
  client: Client;
  sets: WorkoutSet[];
  prTarget?: {
    reps: number;
    lastMonth1RM: number;
  };
};
