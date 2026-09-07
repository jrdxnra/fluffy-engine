import type { CycleSettings, CycleWeekSettings } from '@/lib/types';

const isSupportedWarmupPattern = (percentages: CycleWeekSettings['percentages']): boolean => {
  return (
    (percentages.warmup1 === 0.25 && percentages.warmup2 === 0.35) ||
    (percentages.warmup1 === 0.5 && percentages.warmup2 === 0.6)
  );
};

export const isDeloadWeekSettings = (weekSettings: CycleWeekSettings, weekKey?: string): boolean => {
  if (weekKey) {
    const weekNumber = parseInt(weekKey.match(/\d+/)?.[0] || '0', 10);
    if (weekNumber === 4) return true;
  }

  const weekName = weekSettings.name?.toLowerCase() || '';
  if (weekName.includes('deload')) return true;

  const reps = String(weekSettings.reps?.workset3 ?? '').trim();
  const normalizedReps = reps.replace(/\D/g, '');
  const hasAmrap = reps.includes('+');
  const percentages = weekSettings.percentages;

  return (
    !hasAmrap &&
    normalizedReps === '5' &&
    isSupportedWarmupPattern(percentages) &&
    percentages.workset1 === 0.4 &&
    percentages.workset2 === 0.5 &&
    percentages.workset3 === 0.6
  );
};

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

  // Deload prescriptions should never be changed by per-client rep-scheme overrides.
  if (isDeloadWeekSettings(baseWeekSettings, weekKey)) {
    return baseWeekSettings;
  }

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