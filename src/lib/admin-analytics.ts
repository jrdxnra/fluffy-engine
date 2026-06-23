import { Lifts } from "@/lib/types";
import type { Client, HistoricalRecord, Lift, LoggedSetInputsByCycle, CycleScheduleSettings } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 90;
const PRIOR_WINDOW_DAYS = 180;
const ACTIVE_WINDOW_DAYS = 10;
const WATCH_WINDOW_DAYS = 21;
const ATTENDANCE_WINDOW_DAYS = 30;

type ActivityStatus = "active" | "watch" | "inactive";
type OverallStatus = "on-track" | "needs-adjustment" | "inactive" | "needs-data";
type LiftTrend = "up" | "flat" | "down" | "no-data";
type EvidenceStrength = "high" | "moderate" | "emerging";

type CoachingReference = {
  title: string;
  url: string;
};

type CoachingEvidence = {
  why: string;
  evidenceStrength: EvidenceStrength;
  references: CoachingReference[];
};

export type LiftAnalytics = {
  lift: Lift;
  currentTrainingMax: number;
  previousTrainingMax: number | null;
  trainingMaxDelta: number | null;
  recentBestEstimated1RM: number | null;
  estimated1RMDelta: number | null;
  recentRecordCount: number;
  latestRecordDate: string | null;
  trend: LiftTrend;
  plateauRisk: boolean;
};

export type ClientAnalytics = {
  clientId: string;
  clientName: string;
  currentCycleNumber: number;
  activity: {
    status: ActivityStatus;
    lastActivityAt: string | null;
    daysSinceLastActivity: number | null;
    loggedDaysLast30: number;
    activeWeeksCurrentCycle: number;
  };
  overallStatus: OverallStatus;
  attentionScore: number;
  improvingLifts: Lift[];
  plateauLifts: Lift[];
  downtrendLifts: Lift[];
  liftAnalytics: LiftAnalytics[];
  quickReview: {
    completedSessionSlots: number;
    plannedSessionSlots: number;
    completionPercent: number;
    loggedDaysLast30: number;
    activeWeeksCurrentCycle: number;
    daysSinceLastActivity: number | null;
    improvingLiftCount: number;
    riskLiftCount: number;
  };
  coachingFocus: {
    primaryIssue: {
      title: string; // e.g., "Squat flat for 11 weeks"
      action: string; // e.g., "Deload week (40-50% intensity, 50% volume)"
    } | null;
    secondaryIssues: string[];
    opportunities: string[]; // e.g., "Keep progressing Deadlift, Bench, Press"
    primaryEvidence: CoachingEvidence | null;
    notesContext: string | null;
    reasonForStatus: string;
  };
};

export type TeamAnalytics = {
  totalClients: number;
  onTrackClients: number;
  needsAdjustmentClients: number;
  inactiveClients: number;
  needsDataClients: number;
  activeThisMonthClients: number;
  plateauRiskClients: number;
};

export type AdminAnalyticsReport = {
  team: TeamAnalytics;
  clients: ClientAnalytics[];
};

const parseDate = (value: string | undefined | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysBetween = (later: Date, earlier: Date): number => {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / DAY_MS));
};

const getActivityTimestamps = (loggedSetInputsByCycle: LoggedSetInputsByCycle | undefined): string[] => {
  if (!loggedSetInputsByCycle) return [];

  const timestamps: string[] = [];

  for (const cycleMap of Object.values(loggedSetInputsByCycle)) {
    for (const weekMap of Object.values(cycleMap || {})) {
      for (const liftMap of Object.values(weekMap || {})) {
        if (!liftMap) continue;
        for (const entry of Object.values(liftMap)) {
          if (entry?.updatedAt) {
            timestamps.push(entry.updatedAt);
          }
        }
      }
    }
  }

  return timestamps;
};

const countActiveWeeksForCycle = (client: Client, cycleNumber: number): number => {
  const cycleEntries = client.loggedSetInputsByCycle?.[cycleNumber];
  if (!cycleEntries) return 0;

  return Object.values(cycleEntries).filter((weekMap) => {
    return Object.values(weekMap || {}).some((liftMap) => {
      return Boolean(liftMap && Object.keys(liftMap).length > 0);
    });
  }).length;
};

const getCycleSessionProgress = (client: Client, cycleNumber: number, now: Date = new Date()) => {
  const weekAssignments = client.weekAssignmentsByCycle?.[cycleNumber] || {};
  const plannedWeeks = Math.max(1, Object.keys(weekAssignments).length || 4);

  const cycleEntries = client.loggedSetInputsByCycle?.[cycleNumber] || {};
  let completedSessionSlots = 0;
  let plannedSessionSlots = 0;
  const hasLegacyWeekAssignments = Object.values(weekAssignments).some((value) => !/^\d{4}-\d{2}-\d{2}$/.test(value));

  const getDaySlotForLift = (lift: Lift): "day1" | "day2" => {
    if (lift === "Deadlift" || lift === "Bench") return "day1";
    return "day2";
  };

  // Count planned and completed day slots for weeks scheduled up to today.
  // Each week has two training days (day1 and day2, typically spaced 2 days apart
  // e.g. Tuesday/Thursday). We count each day slot only after its estimated date
  // has passed, so mid-week the denominator grows incrementally (4 → 5 → 6).
  for (let weekIndex = 1; weekIndex <= plannedWeeks; weekIndex++) {
    const weekKey = `week${weekIndex}`;
    const weekAssignmentValue = weekAssignments[weekKey];
    const weekAssignmentDate = parseDate(weekAssignmentValue);

    // For legacy (non-dated) assignments, count the whole week at once.
    if (hasLegacyWeekAssignments || !weekAssignmentDate) {
      plannedSessionSlots += 2;
    } else {
      // day1 is the week's assigned date; day2 is estimated 2 days later.
      const day1Ms = weekAssignmentDate.getTime();
      const day2Ms = day1Ms + 2 * 24 * 60 * 60 * 1000;
      const nowMs = now.getTime();
      if (day1Ms <= nowMs) plannedSessionSlots += 1;
      if (day2Ms <= nowMs) plannedSessionSlots += 1;
    }

    // A day slot is counted complete when any lift assigned to that day has logged entries.
    const weekMap = cycleEntries[weekKey];
    if (weekMap) {
      const completedDaySlots = new Set<"day1" | "day2">();
      for (const [liftName, liftMap] of Object.entries(weekMap)) {
        if (!liftMap || Object.keys(liftMap).length === 0) continue;
        if (liftName === "Deadlift" || liftName === "Bench" || liftName === "Squat" || liftName === "Press") {
          completedDaySlots.add(getDaySlotForLift(liftName));
        }
      }
      completedSessionSlots += completedDaySlots.size;
    }
  }

  // Ensure at least the current week is counted as planned
  if (plannedSessionSlots === 0) {
    plannedSessionSlots = Lifts.length;
  }

  const completionPercent = plannedSessionSlots > 0
    ? Math.round((completedSessionSlots / plannedSessionSlots) * 100)
    : 0;

  return {
    completedSessionSlots,
    plannedSessionSlots,
    completionPercent,
  };
};

const getLiftRecords = (
  historicalData: HistoricalRecord[],
  clientId: string,
  lift: Lift,
): HistoricalRecord[] => {
  return historicalData
    .filter((record) => record.clientId === clientId && record.lift === lift)
    .sort((a, b) => {
      const aTime = parseDate(a.date)?.getTime() || 0;
      const bTime = parseDate(b.date)?.getTime() || 0;
      return bTime - aTime;
    });
};

const getPreviousCycleNumber = (client: Client, currentCycleNumber: number): number | null => {
  const candidateCycles = Object.keys(client.trainingMaxesByCycle || {})
    .map(Number)
    .filter((cycleNumber) => !Number.isNaN(cycleNumber) && cycleNumber < currentCycleNumber)
    .sort((a, b) => b - a);

  return candidateCycles[0] ?? null;
};

const getCurrentTrainingMax = (client: Client, lift: Lift, currentCycleNumber: number): number => {
  return (
    client.trainingMaxesByCycle?.[currentCycleNumber]?.[lift] ??
    client.trainingMaxes?.[lift] ??
    0
  );
};

const getPreviousTrainingMax = (client: Client, lift: Lift, currentCycleNumber: number): number | null => {
  const previousCycleNumber = getPreviousCycleNumber(client, currentCycleNumber);
  if (!previousCycleNumber) return null;
  return client.trainingMaxesByCycle?.[previousCycleNumber]?.[lift] ?? null;
};

const summarizeLift = (
  client: Client,
  lift: Lift,
  historicalData: HistoricalRecord[],
  now: Date,
): LiftAnalytics => {
  const currentCycleNumber = client.currentCycleNumber || 1;
  const records = getLiftRecords(historicalData, client.id, lift);

  const recentRecords = records.filter((record) => {
    const date = parseDate(record.date);
    return date ? daysBetween(now, date) <= RECENT_WINDOW_DAYS : false;
  });
  const priorRecords = records.filter((record) => {
    const date = parseDate(record.date);
    if (!date) return false;
    const ageInDays = daysBetween(now, date);
    return ageInDays > RECENT_WINDOW_DAYS && ageInDays <= PRIOR_WINDOW_DAYS;
  });

  const latestRecord = recentRecords[0] || records[0] || null;
  const latestRecordDate = latestRecord?.date || null;
  const recentBestEstimated1RM = recentRecords.length > 0
    ? Math.max(...recentRecords.map((record) => record.estimated1RM))
    : null;
  const priorBestEstimated1RM = priorRecords.length > 0
    ? Math.max(...priorRecords.map((record) => record.estimated1RM))
    : null;

  const currentTrainingMax = getCurrentTrainingMax(client, lift, currentCycleNumber);
  const previousTrainingMax = getPreviousTrainingMax(client, lift, currentCycleNumber);
  const trainingMaxDelta = previousTrainingMax === null ? null : currentTrainingMax - previousTrainingMax;

  const latestEstimated1RM = recentRecords[0]?.estimated1RM ?? null;
  const oldestEstimated1RM = recentRecords[recentRecords.length - 1]?.estimated1RM ?? null;
  const estimated1RMDelta =
    recentBestEstimated1RM !== null && priorBestEstimated1RM !== null
      ? recentBestEstimated1RM - priorBestEstimated1RM
      : latestEstimated1RM !== null && oldestEstimated1RM !== null
        ? latestEstimated1RM - oldestEstimated1RM
        : null;

  let trend: LiftTrend = "no-data";
  if (recentRecords.length > 0 || currentTrainingMax > 0) {
    if (estimated1RMDelta !== null) {
      if (estimated1RMDelta >= 5 || (trainingMaxDelta ?? 0) > 0) {
        trend = "up";
      } else if (estimated1RMDelta <= -5) {
        trend = "down";
      } else {
        trend = "flat";
      }
    } else if ((trainingMaxDelta ?? 0) > 0) {
      trend = "up";
    } else {
      trend = "flat";
    }
  }

  const latestRecordAge = latestRecordDate ? daysBetween(now, parseDate(latestRecordDate) as Date) : null;
  const plateauRisk =
    recentRecords.length >= 2 &&
    estimated1RMDelta !== null &&
    estimated1RMDelta > -5 &&
    estimated1RMDelta < 5 &&
    (trainingMaxDelta ?? 0) <= 0 &&
    latestRecordAge !== null &&
    latestRecordAge <= 45;

  return {
    lift,
    currentTrainingMax,
    previousTrainingMax,
    trainingMaxDelta,
    recentBestEstimated1RM,
    estimated1RMDelta,
    recentRecordCount: recentRecords.length,
    latestRecordDate,
    trend,
    plateauRisk,
  };
};

const analyzePlateauLift = (
  lift: Lift,
  records: HistoricalRecord[],
  liftAnalytics: LiftAnalytics[],
  now: Date,
): { weeks: number; volumeTrend: "increasing" | "stable" | "declining"; repTrend: "improving" | "stable" | "declining" } | null => {
  const liftAnalytic = liftAnalytics.find((l) => l.lift === lift);
  if (!liftAnalytic || !liftAnalytic.latestRecordDate) return null;

  // Calculate plateau duration (how many weeks since last TM increase)
  const currentTMRecords = records.filter((r) => r.weight >= liftAnalytic.currentTrainingMax * 0.9);
  if (currentTMRecords.length === 0) return null;

  const mostRecentTMRecord = parseDate(currentTMRecords[0].date);
  const oldestTMRecord = parseDate(currentTMRecords[currentTMRecords.length - 1].date);
  if (!mostRecentTMRecord || !oldestTMRecord) return null;

  const plateauWeeks = Math.ceil(daysBetween(mostRecentTMRecord, oldestTMRecord) / 7);

  // Analyze volume trend: split last 8 weeks into two halves
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * DAY_MS);
  const recentFourWeekRecords = records.filter((r) => {
    const date = parseDate(r.date);
    return date && date.getTime() > eightWeeksAgo.getTime();
  });

  let recentVolume = 0;
  let priorVolume = 0;

  for (const record of recentFourWeekRecords) {
    const date = parseDate(record.date);
    if (!date) continue;
    const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * DAY_MS);
    const volume = record.weight * record.reps;
    if (date.getTime() > fourWeeksAgo.getTime()) {
      recentVolume += volume;
    } else {
      priorVolume += volume;
    }
  }

  const volumeTrend = recentVolume > priorVolume * 1.1 ? "increasing" : recentVolume < priorVolume * 0.9 ? "declining" : "stable";

  // Analyze rep trend: are reps declining while weight stays same?
  const recent3Weeks = records.filter((r) => {
    const date = parseDate(r.date);
    return date && daysBetween(now, date) <= 21;
  });
  const prior3Weeks = records.filter((r) => {
    const date = parseDate(r.date);
    return date && daysBetween(now, date) > 21 && daysBetween(now, date) <= 42;
  });

  const avgRecentReps = recent3Weeks.length > 0 ? recent3Weeks.reduce((sum, r) => sum + r.reps, 0) / recent3Weeks.length : 0;
  const avgPriorReps = prior3Weeks.length > 0 ? prior3Weeks.reduce((sum, r) => sum + r.reps, 0) / prior3Weeks.length : 0;
  const repTrend = avgRecentReps < avgPriorReps * 0.9 ? "declining" : avgRecentReps > avgPriorReps * 1.1 ? "improving" : "stable";

  return { weeks: plateauWeeks, volumeTrend, repTrend };
};

const EVIDENCE_LIBRARY = {
  progression: {
    title: "ACSM progression models for resistance training",
    url: "https://pubmed.ncbi.nlm.nih.gov/19204579/",
  },
  volumeDose: {
    title: "Dose-response relationship between weekly resistance volume and strength",
    url: "https://pubmed.ncbi.nlm.nih.gov/27433992/",
  },
  periodization: {
    title: "Periodization and managing fatigue in strength training",
    url: "https://pubmed.ncbi.nlm.nih.gov/33433010/",
  },
  frequencyMeta: {
    title: "Training frequency and strength gains (meta-analysis)",
    url: "https://pubmed.ncbi.nlm.nih.gov/30558493/",
  },
  autoregulationReview: {
    title: "Autoregulation in resistance training (systematic review)",
    url: "https://pubmed.ncbi.nlm.nih.gov/29564973/",
  },
  fatigueSearch: {
    title: "Further reading: fatigue management and deloading",
    url: "https://pubmed.ncbi.nlm.nih.gov/?term=resistance+training+fatigue+management+deload",
  },
  techniqueSearch: {
    title: "Further reading: technique, motor control, and bar path in strength training",
    url: "https://pubmed.ncbi.nlm.nih.gov/?term=strength+training+technique+motor+control",
  },
  attendanceSearch: {
    title: "Further reading: adherence and outcomes in resistance training",
    url: "https://pubmed.ncbi.nlm.nih.gov/?term=resistance+training+adherence+outcomes",
  },
};

const buildCoachingFocus = (
  overallStatus: OverallStatus,
  plateauLifts: Lift[],
  downtrendLifts: Lift[],
  improvingLifts: Lift[],
  loggedDaysLast30: number,
  notes: string | undefined,
  client: Client | null,
  historicalData: HistoricalRecord[],
  liftAnalytics: LiftAnalytics[],
  now: Date = new Date(),
): ClientAnalytics["coachingFocus"] & { reasonForStatus: string } => {
  let primaryIssue: { title: string; action: string } | null = null;
  const secondaryIssues: string[] = [];
  const opportunities: string[] = [];
  let primaryEvidence: CoachingEvidence | null = null;
  let reasonForStatus = "On track";

  if (overallStatus === "needs-data") {
    reasonForStatus = "Needs baseline data to assess trend";
    primaryIssue = {
      title: "Insufficient data for trend confidence",
      action: "Keep load stable for 2-3 exposures while logging top sets consistently.",
    };
    primaryEvidence = {
      why: "With sparse exposure data, false positives are more likely than true plateaus. Build a stable baseline before changing programming.",
      evidenceStrength: "moderate",
      references: [
        EVIDENCE_LIBRARY.progression,
        EVIDENCE_LIBRARY.frequencyMeta,
        EVIDENCE_LIBRARY.attendanceSearch,
      ],
    };
    secondaryIssues.push("Use notes to tag missed reps and readiness each session.");
    return {
      primaryIssue,
      secondaryIssues,
      opportunities: [],
      primaryEvidence,
      notesContext: notes?.trim() ? notes.trim().slice(0, 180) : null,
      reasonForStatus,
    };
  }

  if (overallStatus === "inactive") {
    reasonForStatus = "Attendance has dropped, rebuilding needed";
    primaryIssue = {
      title: "Attendance drop limiting progression signal",
      action: "Rebuild consistency before making aggressive load changes.",
    };
    primaryEvidence = {
      why: "Progressive overload depends on repeated exposures. Low attendance weakens both adaptation and signal quality for decision-making.",
      evidenceStrength: "moderate",
      references: [
        EVIDENCE_LIBRARY.progression,
        EVIDENCE_LIBRARY.frequencyMeta,
        EVIDENCE_LIBRARY.attendanceSearch,
      ],
    };
    secondaryIssues.push("Use a lighter re-entry week if detraining signs are present.");
    return {
      primaryIssue,
      secondaryIssues,
      opportunities: [],
      primaryEvidence,
      notesContext: notes?.trim() ? notes.trim().slice(0, 180) : null,
      reasonForStatus,
    };
  }

  // Prioritize by issue severity: downtrend > plateau with declining volume/reps > plateau stable > low freq
  if (downtrendLifts.length > 0) {
    reasonForStatus = `${downtrendLifts.join(", ")} showing downtrend`;
    primaryIssue = {
      title: `${downtrendLifts.join(", ")} showing downtrend`,
      action: "Run technical check (setup, bar path, rep consistency), then hold or reduce TM 2.5-5%.",
    };
    primaryEvidence = {
      why: "When performance trends downward, reducing load pressure while addressing technique helps restore quality and reduce accumulated fatigue.",
      evidenceStrength: "moderate",
      references: [
        EVIDENCE_LIBRARY.periodization,
        EVIDENCE_LIBRARY.progression,
        EVIDENCE_LIBRARY.autoregulationReview,
        EVIDENCE_LIBRARY.techniqueSearch,
      ],
    };
    if (plateauLifts.length > 0) {
      secondaryIssues.push(`Also monitor: ${plateauLifts.join(", ")} (plateauing).`);
    }
  } else if (plateauLifts.length > 0 && client) {
    const plateauAnalyses: Array<{ lift: Lift; analysis: ReturnType<typeof analyzePlateauLift> }> = [];
    for (const lift of plateauLifts) {
      const records = getLiftRecords(historicalData, client.id, lift);
      const analysis = analyzePlateauLift(lift, records, liftAnalytics, now);
      plateauAnalyses.push({ lift, analysis });
    }

    // Sort by severity: volume+rep decline > volume decline > rep decline > long plateau > short plateau
    plateauAnalyses.sort((a, b) => {
      const aWeeks = a.analysis?.weeks ?? 0;
      const bWeeks = b.analysis?.weeks ?? 0;
      const aVolumeDeclining = a.analysis?.volumeTrend === "declining";
      const bVolumeDeclining = b.analysis?.volumeTrend === "declining";
      const aRepDeclining = a.analysis?.repTrend === "declining";
      const bRepDeclining = b.analysis?.repTrend === "declining";

      // Both have volume+rep decline: sort by duration (longer is worse)
      if (aVolumeDeclining && aRepDeclining && bVolumeDeclining && bRepDeclining) return bWeeks - aWeeks;
      // Only one has volume+rep decline: it's worse
      if (aVolumeDeclining && aRepDeclining) return -1;
      if (bVolumeDeclining && bRepDeclining) return 1;
      // Both have volume decline: sort by duration
      if (aVolumeDeclining && bVolumeDeclining) return bWeeks - aWeeks;
      // Only one has volume decline: it's worse
      if (aVolumeDeclining) return -1;
      if (bVolumeDeclining) return 1;
      // Both have rep decline: sort by duration
      if (aRepDeclining && bRepDeclining) return bWeeks - aWeeks;
      // Only one has rep decline: it's worse
      if (aRepDeclining) return -1;
      if (bRepDeclining) return 1;
      // Neither has decline: sort by duration (longer plateau is worse)
      return bWeeks - aWeeks;
    });

    const worst = plateauAnalyses[0];
    const hasVolumeFatigue = worst.analysis?.volumeTrend === "declining";
    const hasRepDecline = worst.analysis?.repTrend === "declining";
    const weeksFlat = worst.analysis?.weeks ?? 0;

    reasonForStatus = `${worst.lift} flat for ${weeksFlat} weeks`;
    primaryIssue = {
      title: `${worst.lift} flat for ${weeksFlat} weeks`,
      action:
        hasVolumeFatigue && hasRepDecline
          ? "Deload week (40-50% intensity, 50% volume)."
          : hasVolumeFatigue
            ? "Light deload week before TM reset."
            : hasRepDecline
              ? "Form check or reduced intensity."
              : weeksFlat >= 4
                ? "TM micro-reset (5-10 lb reduction)."
                : "Adjust accessory focus or try rep-based progression for 1-2 weeks.",
    };
    primaryEvidence = {
      why:
        hasVolumeFatigue && hasRepDecline
          ? "Volume and rep quality both declining suggests fatigue is outpacing adaptation, so a short deload is usually higher-value than forcing progression."
          : hasVolumeFatigue
            ? "Declining volume with a flat lift often signals recovery debt or poor stress tolerance; short fatigue management can restore progression capacity."
            : hasRepDecline
              ? "Rep quality decline at similar loads suggests technical or fatigue constraints before true strength loss."
              : weeksFlat >= 4
                ? "Sustained plateau with stable execution can respond to a small TM reset to rebuild momentum with quality reps."
                : "Short plateaus often respond to targeted variation before major program changes.",
      evidenceStrength: hasVolumeFatigue || hasRepDecline || weeksFlat >= 4 ? "moderate" : "emerging",
      references: [
        EVIDENCE_LIBRARY.progression,
        EVIDENCE_LIBRARY.volumeDose,
        EVIDENCE_LIBRARY.periodization,
        EVIDENCE_LIBRARY.autoregulationReview,
        EVIDENCE_LIBRARY.fatigueSearch,
      ],
    };

    // Secondary issues: other plateaus or notes
    if (plateauAnalyses.length > 1) {
      const others = plateauAnalyses.slice(1).map((p) => `${p.lift} (${p.analysis?.weeks ?? 0} weeks)`);
      secondaryIssues.push(`Also monitor: ${others.join(", ")}.`);
    }
    secondaryIssues.push("Use notes to log form changes, RPE feedback, or sleep impact.");
  } else if (loggedDaysLast30 < 4) {
    reasonForStatus = "Low session frequency masking trends";
    primaryIssue = {
      title: "Low recent session frequency",
      action: "Prioritize session completion targets before major programming changes.",
    };
    primaryEvidence = {
      why: "Session consistency is a prerequisite for interpreting trends and applying overload decisions with confidence.",
      evidenceStrength: "moderate",
      references: [
        EVIDENCE_LIBRARY.progression,
        EVIDENCE_LIBRARY.frequencyMeta,
        EVIDENCE_LIBRARY.attendanceSearch,
      ],
    };
  }

  if (improvingLifts.length > 0) {
    opportunities.push(`Continue progressing: ${improvingLifts.join(", ")}.`);
  }

  if (!primaryIssue) {
    reasonForStatus = "On track";
    primaryIssue = null;
  }

  if (secondaryIssues.length === 0 && !primaryIssue) {
    secondaryIssues.push("No major sticking points detected right now.");
    opportunities.push("Monitor next cycle checkpoints and maintain current progression.");
  }

  return {
    primaryIssue,
    secondaryIssues: secondaryIssues.slice(0, 2),
    opportunities: opportunities.slice(0, 2),
    primaryEvidence,
    notesContext: notes?.trim() ? notes.trim().slice(0, 180) : null,
    reasonForStatus,
  };
};

export const buildAdminAnalyticsReport = (
  clients: Client[],
  historicalData: HistoricalRecord[],
  now: Date = new Date(),
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>,
): AdminAnalyticsReport => {
  const clientAnalytics = clients.map((client) => {
    const currentCycleNumber = client.currentCycleNumber || 1;
    const activityTimestamps = getActivityTimestamps(client.loggedSetInputsByCycle);
    const latestActivityDate = activityTimestamps
      .map(parseDate)
      .filter((value): value is Date => value !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const uniqueLoggedDaysLast30 = new Set(
      activityTimestamps.filter((timestamp) => {
        const date = parseDate(timestamp);
        return date ? daysBetween(now, date) <= ATTENDANCE_WINDOW_DAYS : false;
      }).map((timestamp) => timestamp.slice(0, 10))
    );

    const daysSinceLastActivity = latestActivityDate ? daysBetween(now, latestActivityDate) : null;
    const activityStatus: ActivityStatus =
      daysSinceLastActivity === null
        ? "inactive"
        : daysSinceLastActivity <= ACTIVE_WINDOW_DAYS
          ? "active"
          : daysSinceLastActivity <= WATCH_WINDOW_DAYS
            ? "watch"
            : "inactive";

    // Determine which lifts to analyze for this client based on their current cycle's schedule
    const liftsToAnalyze = (() => {
      const schedule = cycleSchedulesByCycle?.[currentCycleNumber];
      if (schedule?.liftDayAssignments) {
        // Use only the lifts assigned in the schedule
        return (Object.keys(schedule.liftDayAssignments) as Lift[]).filter(
          (lift) => schedule.liftDayAssignments?.[lift] !== undefined
        );
      }
      // Fallback to all standard lifts if no schedule found
      return Lifts;
    })();

    const liftAnalytics = liftsToAnalyze.map((lift) => summarizeLift(client, lift, historicalData, now));
    const improvingLifts = liftAnalytics.filter((item) => item.trend === "up").map((item) => item.lift);
    const plateauLifts = liftAnalytics.filter((item) => item.plateauRisk).map((item) => item.lift);
    const downtrendLifts = liftAnalytics.filter((item) => item.trend === "down").map((item) => item.lift);
    const totalHistoricalRecords = historicalData.filter((record) => record.clientId === client.id).length;

    let overallStatus: OverallStatus;
    if (totalHistoricalRecords === 0) {
      overallStatus = "needs-data";
    } else if (activityStatus === "inactive") {
      overallStatus = "inactive";
    } else if (activityStatus === "watch" || plateauLifts.length > 0 || downtrendLifts.length > 0) {
      overallStatus = "needs-adjustment";
    } else {
      overallStatus = "on-track";
    }

    const attentionScore =
      (overallStatus === "inactive" ? 60 : 0) +
      (overallStatus === "needs-data" ? 45 : 0) +
      (activityStatus === "watch" ? 15 : 0) +
      plateauLifts.length * 12 +
      downtrendLifts.length * 18;

    const loggedDaysLast30 = uniqueLoggedDaysLast30.size;
    const sessionProgress = getCycleSessionProgress(client, currentCycleNumber, now);
    const activeWeeksCurrentCycle = countActiveWeeksForCycle(client, currentCycleNumber);

    return {
      clientId: client.id,
      clientName: client.name,
      currentCycleNumber,
      activity: {
        status: activityStatus,
        lastActivityAt: latestActivityDate?.toISOString() || null,
        daysSinceLastActivity,
        loggedDaysLast30,
        activeWeeksCurrentCycle,
      },
      overallStatus,
      attentionScore,
      improvingLifts,
      plateauLifts,
      downtrendLifts,
      liftAnalytics,
      quickReview: {
        completedSessionSlots: sessionProgress.completedSessionSlots,
        plannedSessionSlots: sessionProgress.plannedSessionSlots,
        completionPercent: sessionProgress.completionPercent,
        loggedDaysLast30,
        activeWeeksCurrentCycle,
        daysSinceLastActivity,
        improvingLiftCount: improvingLifts.length,
        riskLiftCount: plateauLifts.length + downtrendLifts.length,
      },
      coachingFocus: buildCoachingFocus(
        overallStatus,
        plateauLifts,
        downtrendLifts,
        improvingLifts,
        loggedDaysLast30,
        client.notes,
        client,
        historicalData,
        liftAnalytics,
        now,
      ),
    } satisfies ClientAnalytics;
  }).sort((a, b) => b.attentionScore - a.attentionScore || a.clientName.localeCompare(b.clientName));

  return {
    team: {
      totalClients: clientAnalytics.length,
      onTrackClients: clientAnalytics.filter((client) => client.overallStatus === "on-track").length,
      needsAdjustmentClients: clientAnalytics.filter((client) => client.overallStatus === "needs-adjustment").length,
      inactiveClients: clientAnalytics.filter((client) => client.overallStatus === "inactive").length,
      needsDataClients: clientAnalytics.filter((client) => client.overallStatus === "needs-data").length,
      activeThisMonthClients: clientAnalytics.filter((client) => client.activity.loggedDaysLast30 > 0).length,
      plateauRiskClients: clientAnalytics.filter((client) => client.plateauLifts.length > 0 || client.downtrendLifts.length > 0).length,
    },
    clients: clientAnalytics,
  };
};
