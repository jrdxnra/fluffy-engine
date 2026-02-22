export type Lift = 'Squat' | 'Bench' | 'Deadlift' | 'Press';

export const Lifts: Lift[] = ['Deadlift', 'Bench', 'Squat', 'Press'];

export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export type DaySlot = 'day1' | 'day2';

export interface CycleScheduleSettings {
  cycleStartDate: string; // ISO date (yyyy-mm-dd)
  day1Weekday: Weekday;
  day2Weekday: Weekday;
  liftDayAssignments?: {
    [key in Lift]?: DaySlot;
  };
}

export type TrainingMaxes = {
  [key in Lift]: number;
};

export interface Client {
  id: string;
  name: string;
  rosterOrder?: number;
  oneRepMaxes: TrainingMaxes;
  trainingMaxes: TrainingMaxes; // Deprecated: use trainingMaxesByCycle instead
  trainingMaxesByCycle?: { [cycleNumber: number]: TrainingMaxes }; // Training max for each cycle
  initialWeights?: TrainingMaxes; // Starting weights for first cycle
  actualWeights?: TrainingMaxes; // Latest actual weights lifted
  currentCycleNumber?: number; // Track which cycle the client is on (defaults to 1)
  weekAssignmentsByCycle?: { [cycleNumber: number]: { [weekKey: string]: string } }; // Maps cycle number to week assignments
  sessionStateByCycle?: {
    [cycleNumber: number]: {
      mode: SessionMode;
      flowWeekKey?: string;
      applyUntilChanged?: boolean;
      note?: string;
    };
  };
  notes?: string; // Client notes
};

export type SessionMode = 'normal' | 'slide' | 'jack_shit' | 'pause_week' | 'recovery';

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
  accessories?: {
    [key in Lift]?: string[]; // Accessor exercises for each lift
  };
  accessoryVisibility?: {
    [key in Lift]?: Record<string, boolean>; // Per-accessory visibility toggle for each lift
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
  actualWeight?: number; // Actual weight lifted (if different from recommended)
};

export type CalculatedWorkout = {
  client: Client;
  sets: WorkoutSet[];
  prTarget?: {
    reps: number;
    lastMonth1RM: number;
  };
  sessionMode?: SessionMode;
  effectiveWeekKey?: string;
};

