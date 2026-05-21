import type { CycleSettings, CycleWeekSettings } from '@/lib/types';

const getRepSchemeFromWeek = (cycleSettings: CycleSettings, weekKey: string): string => {
  const reps = cycleSettings[weekKey]?.reps?.workset3;
  if (reps === undefined || reps === null) return '?';
  return String(reps).replace(/\D/g, '');
};

const getRepsTemplateForScheme = (
  repScheme: string,
  fallbackReps: CycleWeekSettings['reps']
): CycleWeekSettings['reps'] => {
  if (repScheme === '5') {
    return { workset1: 5, workset2: 5, workset3: '5+' };
  }
  if (repScheme === '3') {
    return { workset1: 3, workset2: 3, workset3: '3+' };
  }
  if (repScheme === '1') {
    return { workset1: 5, workset2: 3, workset3: '1+' };
  }
  return fallbackReps;
};

const getPercentageTemplateForScheme = (
  repScheme: string,
  fallbackPercentages: CycleWeekSettings['percentages']
): CycleWeekSettings['percentages'] => {
  if (repScheme === '5') {
    return {
      warmup1: 0.5,
      warmup2: 0.6,
      workset1: 0.65,
      workset2: 0.75,
      workset3: 0.85,
    };
  }
  if (repScheme === '3') {
    return {
      warmup1: 0.5,
      warmup2: 0.6,
      workset1: 0.7,
      workset2: 0.8,
      workset3: 0.9,
    };
  }
  if (repScheme === '1') {
    return {
      warmup1: 0.5,
      warmup2: 0.6,
      workset1: 0.75,
      workset2: 0.85,
      workset3: 0.95,
    };
  }
  return fallbackPercentages;
};

export const resolveWorkoutWeekSettings = (
  cycleSettings: CycleSettings,
  weekKey: string,
  assignedRepScheme?: string
): CycleWeekSettings | undefined => {
  const baseWeekSettings = cycleSettings[weekKey];
  if (!baseWeekSettings) return undefined;

  const globalRepScheme = getRepSchemeFromWeek(cycleSettings, weekKey);
  const effectiveAssignedScheme = assignedRepScheme || globalRepScheme;

  if (effectiveAssignedScheme === globalRepScheme) {
    return baseWeekSettings;
  }

  return {
    ...baseWeekSettings,
    percentages: getPercentageTemplateForScheme(
      effectiveAssignedScheme,
      baseWeekSettings.percentages
    ),
    reps: getRepsTemplateForScheme(effectiveAssignedScheme, baseWeekSettings.reps),
  };
};