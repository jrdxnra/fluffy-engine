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
  skipDeloadWeek?: boolean;
  liftDayAssignments?: {
    [key in Lift]?: DaySlot;
  };
  liftDisplayNames?: {
    [key in Lift]?: string;
  };
}

export type TrainingMaxes = {
  [key in Lift]: number;
};

export type LoggedSetEntry = {
  weight: number;
  reps: number;
  updatedAt: string;
};

export type LoggedSetMap = Record<string, LoggedSetEntry>;

export type LoggedSetInputsByCycle = {
  [cycleNumber: number]: {
    [weekKey: string]: Partial<Record<Lift, LoggedSetMap>>;
  };
};

export type MovementCalibrationByCycle = {
  [cycleNumber: number]: {
    [key in Lift]?: {
      needsCalibration: boolean;
      calibratedAt?: string;
      estimated1RM?: number;
      sourceWeekKey?: string;
    };
  };
};

export type MovementProgressionIncrement = 2.5 | 5 | 7.5 | 10;
export type MovementClassType = MovementProgressionIncrement | 'upper' | 'lower';

export type MovementProfile = {
  oneRepMax: number;
  trainingMax: number;
  classType: MovementClassType;
  progressionIncrement: MovementProgressionIncrement;
  progressionHoldActive?: boolean;
  movementCycleNumber: number;
  calibrationPhaseActive: boolean;
  lastUpdatedAt?: string;
  sourceWeekKey?: string;
};

export type MovementProfilesByCycle = {
  [cycleNumber: number]: {
    [movementName: string]: MovementProfile;
  };
};

export type GlobalMovementSetting = {
  classType: MovementClassType;
  displayName?: string;
};

export type GlobalMovementSettings = {
  [movementName: string]: GlobalMovementSetting;
};

export type SessionStateForCycle = {
  mode: SessionMode;
  flowWeekKey?: string;
  applyUntilChanged?: boolean;
  note?: string;
  modeByWeek?: Record<string, SessionMode>;
  flowWeekKeyByWeek?: Record<string, string>;
};

export interface Client {
  id: string;
  name: string;
  rosterOrder?: number;
  oneRepMaxes: TrainingMaxes;
  movementOneRepMaxes?: Record<string, number>;
  oneRepMaxesByCycle?: { [cycleNumber: number]: TrainingMaxes }; // Optional per-cycle 1RM snapshots
  trainingMaxes: TrainingMaxes; // Deprecated: use trainingMaxesByCycle instead
  trainingMaxesByCycle?: { [cycleNumber: number]: TrainingMaxes }; // Training max for each cycle
  initialWeights?: TrainingMaxes; // Starting weights for first cycle
  actualWeights?: TrainingMaxes; // Latest actual weights lifted
  currentCycleNumber?: number; // Track which cycle the client is on (defaults to 1)
  cycleMembership?: number[]; // Explicit list of cycles this client participates in
  weekAssignmentsByCycle?: { [cycleNumber: number]: { [weekKey: string]: string } }; // Maps cycle number to week assignments
  sessionStateByCycle?: { [cycleNumber: number]: SessionStateForCycle };
  loggedSetInputsByCycle?: LoggedSetInputsByCycle;
  movementCalibrationsByCycle?: MovementCalibrationByCycle;
  movementSelectionByCycle?: {
    [cycleNumber: number]: Partial<Record<Lift, string>>;
  };
  movementProfilesByCycle?: MovementProfilesByCycle;
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
  id?: string;
  clientId: string;
  date: string; // ISO string
  lift: Lift;
  weight: number;
  reps: number;
  estimated1RM: number;
  recommendedTrainingMax?: number;
  recommendedTopSetWeight?: number;
  recommendedTopSetReps?: number;
  recommendedTarget1RM?: number;
  reviewedIssue?: boolean;
  reviewedAt?: string;
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
  trainingMax?: number;
  prTarget?: {
    reps: number;
    lastMonth1RM: number;
  };
  sessionMode?: SessionMode;
  effectiveWeekKey?: string;
};

