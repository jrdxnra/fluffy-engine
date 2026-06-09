import type { CycleSettings } from "@/lib/types";

type Scheme = "5" | "3" | "1";

const getSchemeFromReps = (workset3Reps: string | number | undefined): Scheme | null => {
  if (workset3Reps === undefined || workset3Reps === null) return null;
  const normalized = String(workset3Reps).replace(/\D/g, "");
  if (normalized === "5") return "5";
  if (normalized === "3") return "3";
  if (normalized === "1") return "1";
  return null;
};

const getSchemeFromWorkset3Percentage = (workset3Percentage: number): Scheme => {
  if (workset3Percentage <= 0.86) {
    return "5";
  }
  if (workset3Percentage <= 0.91) {
    return "3";
  }
  return "1";
};

const getRepTemplate = (scheme: Scheme) => {
  if (scheme === "5") {
    return { workset1: 5, workset2: 5, workset3: "5+" };
  }
  if (scheme === "3") {
    return { workset1: 3, workset2: 3, workset3: "3+" };
  }
  return { workset1: 5, workset2: 3, workset3: "1+" };
};

const getPercentageTemplate = (scheme: Scheme) => {
  if (scheme === "5") {
    return {
      warmup1: 0.5,
      warmup2: 0.6,
      workset1: 0.65,
      workset2: 0.75,
      workset3: 0.85,
    };
  }
  if (scheme === "3") {
    return {
      warmup1: 0.5,
      warmup2: 0.6,
      workset1: 0.7,
      workset2: 0.8,
      workset3: 0.9,
    };
  }
  return {
    warmup1: 0.5,
    warmup2: 0.6,
    workset1: 0.75,
    workset2: 0.85,
    workset3: 0.95,
  };
};

const isDeloadTemplate = (weekSettings: CycleSettings[string]): boolean => {
  const reps = String(weekSettings.reps?.workset3 ?? "").trim();
  const hasAmrap = reps.includes("+");
  const normalizedReps = reps.replace(/\D/g, "");
  const percentages = weekSettings.percentages;

  return (
    !hasAmrap &&
    normalizedReps === "5" &&
    percentages.warmup1 === 0.5 &&
    percentages.warmup2 === 0.6 &&
    percentages.workset1 === 0.4 &&
    percentages.workset2 === 0.5 &&
    percentages.workset3 === 0.6
  );
};

export const normalizeCycleSettingsByCycle = (
  settingsByCycle: Record<number, CycleSettings>
): { normalized: Record<number, CycleSettings>; changed: boolean } => {
  const normalized: Record<number, CycleSettings> = {};
  let changed = false;

  for (const [cycleKey, cycleSettings] of Object.entries(settingsByCycle)) {
    const cycleNumber = Number(cycleKey);
    const updatedCycleSettings: CycleSettings = {};

    for (const [weekKey, weekSettings] of Object.entries(cycleSettings || {})) {
      const weekNum = parseInt(weekKey.match(/\d+/)?.[0] || "0", 10);
      if (!weekNum) continue;

      const updatedWeekSettings = { ...weekSettings };
      if (
        !updatedWeekSettings.name?.toLowerCase().includes("deload") &&
        (updatedWeekSettings.name?.includes("Repeat") || /^Week\s+\d+/.test(updatedWeekSettings.name || ""))
      ) {
        const nextName = `Week ${weekNum}`;
        if (updatedWeekSettings.name !== nextName) {
          updatedWeekSettings.name = nextName;
          changed = true;
        }
      }

      const isDeloadByNumber = weekNum === 4;
      const isDeloadWeek =
        updatedWeekSettings.name?.toLowerCase().includes("deload") ||
        isDeloadByNumber ||
        isDeloadTemplate(updatedWeekSettings);

      if (isDeloadByNumber) {
        // Week 4 is always the deload week — enforce standard deload percentages and reps
        // to repair any corruption (e.g., from an accidental settings edit or bad migration)
        const deloadPercentages = { warmup1: 0.5, warmup2: 0.6, workset1: 0.4, workset2: 0.5, workset3: 0.6 };
        const deloadReps = { workset1: 5, workset2: 5, workset3: "5" };
        const p = updatedWeekSettings.percentages;
        if (
          p?.workset1 !== deloadPercentages.workset1 ||
          p?.workset2 !== deloadPercentages.workset2 ||
          p?.workset3 !== deloadPercentages.workset3
        ) {
          updatedWeekSettings.percentages = { ...p, ...deloadPercentages };
          changed = true;
        }
        const r = updatedWeekSettings.reps;
        if (
          r?.workset1 !== deloadReps.workset1 ||
          r?.workset2 !== deloadReps.workset2 ||
          r?.workset3 !== deloadReps.workset3
        ) {
          updatedWeekSettings.reps = { ...r, ...deloadReps };
          changed = true;
        }
      }

      if (!isDeloadWeek && updatedWeekSettings.percentages?.workset3 !== undefined) {
        const schemeFromReps = getSchemeFromReps(updatedWeekSettings.reps?.workset3);
        const scheme = schemeFromReps || getSchemeFromWorkset3Percentage(updatedWeekSettings.percentages.workset3);

        const expectedReps = getRepTemplate(scheme);
        const expectedPercentages = getPercentageTemplate(scheme);

        const currentPercentages = updatedWeekSettings.percentages;
        const percentagesMismatch =
          currentPercentages.warmup1 !== expectedPercentages.warmup1 ||
          currentPercentages.warmup2 !== expectedPercentages.warmup2 ||
          currentPercentages.workset1 !== expectedPercentages.workset1 ||
          currentPercentages.workset2 !== expectedPercentages.workset2 ||
          currentPercentages.workset3 !== expectedPercentages.workset3;

        if (percentagesMismatch) {
          updatedWeekSettings.percentages = expectedPercentages;
          changed = true;
        }

        const currentReps = updatedWeekSettings.reps;
        if (
          !currentReps ||
          currentReps.workset1 !== expectedReps.workset1 ||
          currentReps.workset2 !== expectedReps.workset2 ||
          currentReps.workset3 !== expectedReps.workset3
        ) {
          updatedWeekSettings.reps = expectedReps;
          changed = true;
        }
      }

      updatedCycleSettings[weekKey] = updatedWeekSettings;
    }

    if (Object.keys(updatedCycleSettings).length > 0) {
      normalized[cycleNumber] = updatedCycleSettings;
    }
  }

  if (Object.keys(normalized).length === 0) {
    normalized[1] = {} as CycleSettings;
  }

  return { normalized, changed };
};
