"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Client,
  CycleScheduleSettings,
  CycleSettings,
  HistoricalRecord,
  Lift,
  CalculatedWorkout,
  SessionMode,
  LoggedSetMap,
  LoggedSetInputsByCycle,
} from "@/lib/types";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { WorkoutTable } from "@/components/WorkoutTable";
import { AddClientSheet } from "@/components/AddClientSheet";
import { AccessoryDisplay } from "@/components/AccessoryDisplay";
import { AiInsightsDialog } from "@/components/AiInsightsDialog";
import { calculateWorkout } from "@/lib/utils";
import { getCycleWeekSchedule, getEffectiveCycleSchedule, getLiftDaySlot, getLiftsForDaySlot } from "@/lib/schedule";
import { ProgressChartDialog } from "@/components/ProgressChartDialog";
import { ConfigSettingsDialog } from "@/components/ConfigSettingsDialog";
import { ClientProfileModal } from "@/components/ClientProfileModal";
import { resolveVisibleAccessories } from "@/lib/accessory-utils";
import {
  deleteCycleAction,
  resetClientTrainingMaxAction,
  saveCycleSettingsAction,
  upsertClientLoggedSetEntriesAction,
  updateClientLoggedSetInputsBulkAction,
  updateClientProfileAction,
  updateClientRosterOrderAction,
  updateClientWeekAssignmentsAction,
} from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

type SbdohControlProps = {
  initialClients: Client[];
  initialCycleSettingsByCycle: Record<number, CycleSettings>;
  initialCycleNames: Record<number, string>;
  initialCycleSchedulesByCycle: Record<number, CycleScheduleSettings>;
  initialHistoricalData: HistoricalRecord[];
};

export function SbdohControl({
  initialClients,
  initialCycleSettingsByCycle,
  initialCycleNames,
  initialCycleSchedulesByCycle,
  initialHistoricalData,
}: SbdohControlProps) {
  const router = useRouter();
  const { toast } = useToast();
  const dayViewStorageKey = "sbdoh:dayViewSlot";
  
  const normalizeCycleSettingsByCycle = (
    settingsByCycle: Record<number, CycleSettings>
  ) => {
    const getRepTemplate = (workset3Percentage: number) => {
      if (workset3Percentage <= 0.6) {
        return { workset1: 5, workset2: 5, workset3: "5" };
      }
      if (workset3Percentage <= 0.86) {
        return { workset1: 5, workset2: 5, workset3: "5+" };
      }
      if (workset3Percentage <= 0.91) {
        return { workset1: 3, workset2: 3, workset3: "3+" };
      }
      return { workset1: 5, workset2: 3, workset3: "1+" };
    };

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
          (
            updatedWeekSettings.name?.includes("Repeat") ||
            /^Week\s+\d+/.test(updatedWeekSettings.name || "")
          )
        ) {
          const nextName = `Week ${weekNum}`;
          if (updatedWeekSettings.name !== nextName) {
            updatedWeekSettings.name = nextName;
            changed = true;
          }
        }

        if (updatedWeekSettings.percentages?.workset3 !== undefined) {
          const expectedReps = getRepTemplate(updatedWeekSettings.percentages.workset3);
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
  
  const normalizedInitial = normalizeCycleSettingsByCycle(initialCycleSettingsByCycle);
  
  // Initialize clients with proper per-cycle training maxes
  const [clients, setClients] = useState<Client[]>(() => {
    return initialClients.map(client => {
      const currentCycle = client.currentCycleNumber || 1;
      
      // If client already has trainingMaxesByCycle with all needed cycles, keep it
      if (client.trainingMaxesByCycle && client.trainingMaxesByCycle[currentCycle]) {
        return client;
      }
      
      // Otherwise, initialize trainingMaxesByCycle
      const trainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
      
      // For each cycle up to current, calculate what the training max should be
      for (let cycle = 1; cycle <= currentCycle; cycle++) {
        if (!trainingMaxesByCycle[cycle]) {
          if (cycle === 1) {
            // Cycle 1 uses the default training maxes
            trainingMaxesByCycle[1] = client.trainingMaxes;
          } else {
            // Each subsequent cycle adds 5-10 lbs to the previous cycle's maxes
            const prevCycleMaxes = trainingMaxesByCycle[cycle - 1];
            trainingMaxesByCycle[cycle] = {
              Squat: prevCycleMaxes.Squat + 10,
              Deadlift: prevCycleMaxes.Deadlift + 10,
              Bench: prevCycleMaxes.Bench + 5,
              Press: prevCycleMaxes.Press + 5,
            };
          }
        }
      }
      
      return {
        ...client,
        trainingMaxesByCycle
      };
    });
  });
  const [historicalData, setHistoricalData] = useState<HistoricalRecord[]>(initialHistoricalData);
  
  // Store settings per cycle: { 1: { week1: {...}, week2: {...} }, 2: { week1: {...}, week2: {...} } }
  const [cycleSettingsByCycle, setCycleSettingsByCycle] = useState<Record<number, CycleSettings>>(() => {
    if (Object.keys(normalizedInitial.normalized).length > 0) {
      return normalizedInitial.normalized;
    }
    return { 1: {} as CycleSettings };
  });
  
  const [lift, setLift] = useState<Lift>("Deadlift");
  const [viewMode, setViewMode] = useState<"lift" | "day">("day");
  const [dayViewSlot, setDayViewSlot] = useState<"day1" | "day2">(() => {
    return getLiftDaySlot("Deadlift", initialCycleSchedulesByCycle[1]);
  });
  const [autoSelectedDay, setAutoSelectedDay] = useState<"day1" | "day2" | null>(null);
  const [collapsedDayLifts, setCollapsedDayLifts] = useState<Record<Lift, boolean>>({
    Deadlift: false,
    Bench: false,
    Squat: false,
    Press: false,
  });
  const [currentWeek, setCurrentWeek] = useState<string>("week1");
  const [currentCycleNumber, setCurrentCycleNumber] = useState<number>(() => {
    return initialClients.length > 0 ? (initialClients[0]?.currentCycleNumber || 1) : 1;
  });
  const [cycleNames, setCycleNames] = useState<Record<number, string>>(() => {
    if (Object.keys(initialCycleNames).length > 0) {
      return initialCycleNames;
    }
    return { 1: "Cycle 1" };
  });
  const [cycleSchedulesByCycle, setCycleSchedulesByCycle] = useState<Record<number, CycleScheduleSettings>>(() => {
    const schedules = { ...(initialCycleSchedulesByCycle || {}) };
    const cycles = Object.keys(normalizedInitial.normalized).map(Number);
    for (const cycleNumber of cycles) {
      if (!schedules[cycleNumber]) {
        schedules[cycleNumber] = {
          cycleStartDate: "",
          day1Weekday: "Tuesday",
          day2Weekday: "Thursday",
        };
      }
    }
    if (Object.keys(schedules).length === 0) {
      schedules[1] = {
        cycleStartDate: "",
        day1Weekday: "Tuesday",
        day2Weekday: "Thursday",
      };
    }
    return schedules;
  });
  
  useEffect(() => {
    if (!normalizedInitial.changed) return;
    saveCycleSettingsAction(cycleSettingsByCycle, cycleNames, cycleSchedulesByCycle).catch(error => {
      console.error("Failed to save normalized week names:", error);
    });
  }, [cycleNames, cycleSchedulesByCycle, cycleSettingsByCycle, normalizedInitial.changed]);
  
  // Helper to get current cycle's settings
  const cycleSettings = cycleSettingsByCycle[currentCycleNumber] || cycleSettingsByCycle[1];

  useEffect(() => {
    if (cycleSettings[currentWeek]) return;

    const firstWeekKey = Object.keys(cycleSettings)
      .sort((a, b) => {
        const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
        const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
        return aNum - bNum;
      })[0];

    if (firstWeekKey) {
      setCurrentWeek(firstWeekKey);
    }
  }, [cycleSettings, currentWeek]);
  
  const [isAddClientSheetOpen, setAddClientSheetOpen] = useState(false);
  const [isClientProfileModalOpen, setClientProfileModalOpen] = useState(false);
  const [selectedClientForProfile, setSelectedClientForProfile] = useState<Client | null>(null);
  const [isAiInsightsDialogOpen, setAiInsightsDialogOpen] = useState(false);
  const [isProgressChartDialogOpen, setProgressChartDialogOpen] = useState(false);
  const [selectedClientForAi, setSelectedClientForAi] = useState<Client | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Compute available cycles from clients
  // Compute available cycles from cycleSettingsByCycle instead of from client data
  // This ensures cycles aren't lost when clients are moved between cycles
  const availableCycles = useMemo(() => {
    const cycleNumbers = Object.keys(cycleSettingsByCycle)
      .map(Number)
      .sort((a, b) => a - b);
    
    return cycleNumbers.map(cycleNumber => ({
      cycleNumber,
      name: cycleNames[cycleNumber] || `Cycle ${cycleNumber}`,
    }));
  }, [cycleSettingsByCycle, cycleNames]);

  const currentCycleSchedule = useMemo(
    () => getEffectiveCycleSchedule(cycleSchedulesByCycle[currentCycleNumber]),
    [cycleSchedulesByCycle, currentCycleNumber]
  );

  const currentWeekSchedule = useMemo(
    () => getCycleWeekSchedule(currentCycleSchedule, currentWeek),
    [currentCycleSchedule, currentWeek]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(dayViewStorageKey);
    if (stored === "day1" || stored === "day2") {
      setDayViewSlot(stored);
    }
  }, []);

  useEffect(() => {
    const weekdayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ] as const;
    const todayWeekday = weekdayNames[new Date().getDay()];

    if (todayWeekday === currentCycleSchedule.day1Weekday) {
      setDayViewSlot("day1");
      setAutoSelectedDay("day1");
      return;
    }
    if (todayWeekday === currentCycleSchedule.day2Weekday) {
      setDayViewSlot("day2");
      setAutoSelectedDay("day2");
      return;
    }
    setAutoSelectedDay(null);
  }, [currentCycleSchedule.day1Weekday, currentCycleSchedule.day2Weekday, currentCycleNumber]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(dayViewStorageKey, dayViewSlot);
  }, [dayViewSlot]);

  useEffect(() => {
    setCollapsedDayLifts({
      Deadlift: false,
      Bench: false,
      Squat: false,
      Press: false,
    });
  }, [dayViewSlot]);

  const formatShortDate = (isoDate?: string) => {
    if (!isoDate) return "—";
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const getRepSchemeFromWeek = (weekKey: string): string => {
    const reps = cycleSettings[weekKey]?.reps?.workset3;
    if (reps === undefined || reps === null) return "?";
    return String(reps).replace(/\D/g, "");
  };

  const getRepsTemplateForScheme = (
    repScheme: string,
    fallbackReps: { workset1: number; workset2: number; workset3: string }
  ) => {
    if (repScheme === "5") {
      return { workset1: 5, workset2: 5, workset3: "5+" };
    }
    if (repScheme === "3") {
      return { workset1: 3, workset2: 3, workset3: "3+" };
    }
    if (repScheme === "1") {
      return { workset1: 5, workset2: 3, workset3: "1+" };
    }
    return fallbackReps;
  };

  const getPercentageTemplateForScheme = (
    repScheme: string,
    fallbackPercentages: {
      warmup1: number;
      warmup2: number;
      workset1: number;
      workset2: number;
      workset3: number;
    }
  ) => {
    if (repScheme === "5") {
      return {
        warmup1: 0.5,
        warmup2: 0.6,
        workset1: 0.65,
        workset2: 0.75,
        workset3: 0.85,
      };
    }
    if (repScheme === "3") {
      return {
        warmup1: 0.5,
        warmup2: 0.6,
        workset1: 0.7,
        workset2: 0.8,
        workset3: 0.9,
      };
    }
    if (repScheme === "1") {
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

  const handleLiftChange = (newLift: Lift) => {
    startTransition(() => {
      setLift(newLift);
    });
  };
  const handleWeekChange = (newWeek: string) => {
    startTransition(() => {
      setCurrentWeek(newWeek);
    });
  };

  const getCalculatedWorkoutsForLift = (targetLift: Lift): CalculatedWorkout[] => {
    const selectedWeekSettings = cycleSettings[currentWeek];
    if (!selectedWeekSettings) {
      return clients.map((client) => ({
        client,
        sets: [],
        prTarget: undefined,
      }));
    }

    const globalRepScheme = getRepSchemeFromWeek(currentWeek);
    const sortedWeekKeys = Object.keys(cycleSettings).sort((a, b) => {
      const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return aNum - bNum;
    });

    return clients.map((client) => {
      const sessionState = client.sessionStateByCycle?.[currentCycleNumber];
      const mode: SessionMode =
        sessionState?.modeByWeek?.[currentWeek] ||
        sessionState?.mode ||
        "normal";
      let effectiveWeekKey = currentWeek;

      if (mode === "slide") {
        const flowWeekKey = sessionState?.flowWeekKeyByWeek?.[currentWeek] || sessionState?.flowWeekKey;
        if (flowWeekKey && cycleSettings[flowWeekKey]) {
          effectiveWeekKey = flowWeekKey;
        } else {
          const currentIndex = sortedWeekKeys.indexOf(currentWeek);
          if (currentIndex > 0) {
            effectiveWeekKey = sortedWeekKeys[currentIndex - 1];
          }
        }
      }

      if (mode === "pause_week") {
        return {
          client,
          sets: [],
          prTarget: undefined,
          sessionMode: mode,
          effectiveWeekKey,
        };
      }

      const selectedWeekSettingsForClient = cycleSettings[effectiveWeekKey];
      if (!selectedWeekSettingsForClient) {
        return {
          client,
          sets: [],
          prTarget: undefined,
          sessionMode: mode,
          effectiveWeekKey,
        };
      }

      const effectiveGlobalRepScheme = getRepSchemeFromWeek(effectiveWeekKey);

      // Get the client's assignment for the selected global cycle + week.
      const clientCycleAssignments = client.weekAssignmentsByCycle?.[currentCycleNumber] || {};
      let assignedRepScheme = clientCycleAssignments[effectiveWeekKey];

      // If the client hasn't set an assignment, use the selected week's rep scheme.
      if (!assignedRepScheme) {
        assignedRepScheme = effectiveGlobalRepScheme;
      }

      // If the client has "N/A", skip this week.
      if (assignedRepScheme === "N/A") {
        return {
          client,
          sets: [],
          prTarget: undefined,
          sessionMode: mode,
          effectiveWeekKey,
        };
      }

      let workoutWeekSettings = selectedWeekSettingsForClient;
      if (assignedRepScheme !== effectiveGlobalRepScheme) {
        workoutWeekSettings = {
          ...selectedWeekSettingsForClient,
          percentages: getPercentageTemplateForScheme(
            assignedRepScheme,
            selectedWeekSettingsForClient.percentages
          ),
          reps: getRepsTemplateForScheme(assignedRepScheme, selectedWeekSettingsForClient.reps),
        };
      }

      const workout = calculateWorkout(
        client,
        targetLift,
        workoutWeekSettings,
        historicalData,
        currentCycleNumber
      );

      if (mode === "recovery") {
        workout.prTarget = undefined;
        workout.sets = workout.sets.map((set) => {
          if (set.type === "Work Set" && set.set === 3) {
            return {
              ...set,
              reps: typeof set.reps === "string" ? set.reps.replace("+", "") : set.reps,
            };
          }
          return set;
        });
      }

      if (mode === "jack_shit") {
        workout.prTarget = undefined;
        workout.sets = workout.sets.filter((set) => set.type === "Work Set");
      }

      workout.sessionMode = mode;
      workout.effectiveWeekKey = effectiveWeekKey;

      return workout;
    });
  };

  const calculatedWorkouts: CalculatedWorkout[] = useMemo(() => {
    return getCalculatedWorkoutsForLift(lift);
  }, [clients, lift, currentWeek, cycleSettings, historicalData, currentCycleNumber]);

  const dayLifts: Lift[] = getLiftsForDaySlot(dayViewSlot, currentCycleSchedule);
  const dayAbbrByLift: Record<Lift, string> = {
    Deadlift: "DL",
    Bench: "B",
    Squat: "SQ",
    Press: "P",
  };
  const weekdayAbbr: Record<string, string> = {
    Monday: "Mon",
    Tuesday: "Tues",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
  };
  const getDayButtonLabel = (slot: "day1" | "day2") => {
    const liftsForSlot = getLiftsForDaySlot(slot, currentCycleSchedule);
    const liftText = liftsForSlot.map((item) => dayAbbrByLift[item]).join(" + ");
    const weekday = slot === "day1" ? currentWeekSchedule.day1Weekday : currentWeekSchedule.day2Weekday;
    return `${liftText} (${weekdayAbbr[weekday] || weekday.slice(0, 3)})`;
  };
  const getLiftDateLabel = (targetLift: Lift): string => {
    const slot = getLiftDaySlot(targetLift, currentCycleSchedule);
    const weekday = slot === "day1" ? currentWeekSchedule.day1Weekday : currentWeekSchedule.day2Weekday;
    const date = slot === "day1" ? currentWeekSchedule.day1Date : currentWeekSchedule.day2Date;
    return `${weekday}${date ? ` (${formatShortDate(date)})` : ""}`;
  };
  const currentWeekLabel = cycleSettings[currentWeek]?.name || currentWeek;
  const sessionHeaderLabel =
    viewMode === "day"
      ? `${getDayButtonLabel(dayViewSlot)} · Cycle ${currentCycleNumber} ${currentWeekLabel}`
      : `${lift} (${getLiftDateLabel(lift)}) · Cycle ${currentCycleNumber} ${currentWeekLabel}`;
  const dayWorkoutsByLift = useMemo(() => {
    return dayLifts.reduce<Record<Lift, CalculatedWorkout[]>>((acc, dayLift) => {
      acc[dayLift] = getCalculatedWorkoutsForLift(dayLift);
      return acc;
    }, {} as Record<Lift, CalculatedWorkout[]>);
  }, [clients, lift, currentWeek, cycleSettings, historicalData, currentCycleNumber, dayViewSlot]);

  const getEffectiveWeekForWorkouts = (workouts: CalculatedWorkout[]): string => {
    const counts = new Map<string, number>();
    for (const workout of workouts) {
      const weekKey = workout.effectiveWeekKey || currentWeek;
      counts.set(weekKey, (counts.get(weekKey) || 0) + 1);
    }
    let chosen = currentWeek;
    let max = -1;
    for (const [weekKey, count] of counts.entries()) {
      if (count > max) {
        max = count;
        chosen = weekKey;
      }
    }
    return chosen;
  };

  const effectiveWeekByLiftForDayView = useMemo(() => {
    const mapping: Partial<Record<Lift, string>> = {};
    for (const dayLift of dayLifts) {
      mapping[dayLift] = getEffectiveWeekForWorkouts(dayWorkoutsByLift[dayLift] || []);
    }
    return mapping;
  }, [dayLifts, dayWorkoutsByLift, currentWeek]);

  const effectiveWeekByLiftForLiftView = useMemo(() => {
    return {
      [lift]: getEffectiveWeekForWorkouts(calculatedWorkouts),
    } as Partial<Record<Lift, string>>;
  }, [lift, calculatedWorkouts, currentWeek]);

  const buildDayCopyTextForWorkout = (workout: CalculatedWorkout, defaultText: string): string => {
    const parseAccessoryPrescription = (text: string): { movement: string; sets: string; target: string } | null => {
      const normalized = text.trim().replace(/\s+/g, " ");
      const prefix = normalized.match(/^\s*(\d+)\s*[xX]\s*([^\s]+)\s+(.+)$/);
      if (prefix) {
        const [, sets, target, movement] = prefix;
        return { movement: movement.trim(), sets, target };
      }

      const suffix = normalized.match(/^\s*(.+?)\s+(\d+)\s*[xX]\s*([^\s]+)\s*$/);
      if (suffix) {
        const [, movement, sets, target] = suffix;
        return { movement: movement.trim(), sets, target };
      }

      return null;
    };

    const tsvRows: string[] = [];
    const mergedAccessories: string[] = [];
    const dayWeekday = dayViewSlot === "day1" ? currentWeekSchedule.day1Weekday : currentWeekSchedule.day2Weekday;
    const dayDate = dayViewSlot === "day1" ? currentWeekSchedule.day1Date : currentWeekSchedule.day2Date;
    const dayDateLabel = `${dayWeekday}${dayDate ? ` (${formatShortDate(dayDate)})` : ""}`;

    tsvRows.push(`${dayLifts.join(" + ")} ${dayDateLabel}`);
    tsvRows.push("MOVEMENTS\tSETS\tREC REPS\tREC LOAD\tACT REPS\tACT LOAD");

    for (const dayLift of dayLifts) {
      const liftWorkout = (dayWorkoutsByLift[dayLift] || []).find((item) => item.client.id === workout.client.id);
      if (!liftWorkout || !liftWorkout.sets || liftWorkout.sets.length === 0) {
        continue;
      }

      const effectiveWeekKey = liftWorkout.effectiveWeekKey || currentWeek;
      const accessories = resolveVisibleAccessories(cycleSettings, effectiveWeekKey, dayLift);
      const persistedSetMap =
        liftWorkout.client.loggedSetInputsByCycle?.[currentCycleNumber]?.[effectiveWeekKey]?.[dayLift] || {};

      tsvRows.push(`WORKING SETS: ${dayLift.toUpperCase()}`);
      for (const [setIndex, set] of liftWorkout.sets.entries()) {
        if (set.type !== "Work Set") continue;
        const persisted = persistedSetMap[String(setIndex)];
        const actualReps = persisted?.reps !== undefined ? String(persisted.reps) : "";
        const actualLoad = persisted?.weight !== undefined ? String(persisted.weight) : "";
        tsvRows.push(
          `${dayLift}\t1\t${set.reps}\t${set.weight}\t${actualReps}\t${actualLoad}`
        );
      }
      tsvRows.push("");

      for (const accessory of accessories) {
        if (!mergedAccessories.includes(accessory)) {
          mergedAccessories.push(accessory);
        }
      }
    }

    if (tsvRows.length <= 2) {
      return defaultText;
    }

    tsvRows.push("WORKING SETS: ACCESSORIES");
    for (const accessory of mergedAccessories) {
      const parsed = parseAccessoryPrescription(accessory);
      if (parsed) {
        tsvRows.push(`${parsed.movement}\t${parsed.sets}\t${parsed.target}\t\t\t`);
      } else {
        tsvRows.push(`${accessory}\t\t\t\t\t`);
      }
    }

    return tsvRows.join("\n");
  };

  const handleAiInsight = (client: Client) => {
    setSelectedClientForAi(client);
    setAiInsightsDialogOpen(true);
  };
  
  const handleClientProfile = (client: Client) => {
    setSelectedClientForProfile(client);
    setClientProfileModalOpen(true);
  };
  
  const handleUpdateClient = async (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));

    const result = await updateClientProfileAction(updatedClient.id, {
      initialWeights: updatedClient.initialWeights as any,
      weekAssignmentsByCycle: updatedClient.weekAssignmentsByCycle,
      sessionStateByCycle: updatedClient.sessionStateByCycle as any,
    });

    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Profile Save Failed",
        description: result.message,
      });
      return;
    }

    setSelectedClientForProfile(null);
    toast({
      title: "Profile Updated",
      description: "Client settings were saved.",
    });
  };

  const handleResetClientTrainingMax = async (clientId: string) => {
    const result = await resetClientTrainingMaxAction(clientId, currentCycleNumber);
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: result.message,
      });
      return;
    }

    if (result.updatedClient) {
      setClients(prev => prev.map(c => c.id === clientId ? (result.updatedClient as Client) : c));
      if (selectedClientForProfile?.id === clientId) {
        setSelectedClientForProfile(result.updatedClient as Client);
      }
    }

    toast({
      title: "Training Max Reset",
      description: result.message,
    });
  };
  
  const handleRepRecordUpdate = (newRecord: HistoricalRecord) => {
    setHistoricalData(prev => [...prev, newRecord]);
  };

  const handlePersistLoggedSets = async ({
    clientId,
    weekKey,
    lift,
    setEntries,
  }: {
    clientId: string;
    weekKey: string;
    lift: Lift;
    setEntries: LoggedSetMap;
  }) => {
    const targetClient = clients.find((client) => client.id === clientId);
    if (!targetClient) return;

    const existing = targetClient.loggedSetInputsByCycle || {};
    const cycleData = existing[currentCycleNumber] || {};
    const weekData = cycleData[weekKey] || {};
    const liftData = weekData[lift] || {};

    const updatedPayload: LoggedSetInputsByCycle = {
      ...existing,
      [currentCycleNumber]: {
        ...cycleData,
        [weekKey]: {
          ...weekData,
          [lift]: {
            ...liftData,
            ...setEntries,
          },
        },
      },
    };

    setClients((prev) =>
      prev.map((client) =>
        client.id === clientId
          ? {
              ...client,
              loggedSetInputsByCycle: updatedPayload,
            }
          : client
      )
    );

    const result = await upsertClientLoggedSetEntriesAction({
      clientId,
      cycleNumber: currentCycleNumber,
      weekKey,
      lift,
      setEntries,
    });
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Save Snapshot Failed",
        description: result.message,
      });
      return;
    }

    if (result.merged) {
      setClients((prev) =>
        prev.map((client) =>
          client.id === clientId
            ? {
                ...client,
                loggedSetInputsByCycle: result.merged,
              }
            : client
        )
      );
    }
  };

  const handleReorderClient = async (clientId: string, direction: "up" | "down") => {
    const currentIndex = clients.findIndex((client) => client.id === clientId);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= clients.length) return;

    const reordered = [...clients];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setClients(reordered);

    const updates = reordered.map((client, index) => ({
      id: client.id,
      rosterOrder: index,
    }));

    const result = await updateClientRosterOrderAction(updates);
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Reorder Failed",
        description: result.message,
      });
      return;
    }
  };

  const handleUpdateCycleSettings = async (newSettings: CycleSettings) => {
    const updatedSettings = {
      ...cycleSettingsByCycle,
      [currentCycleNumber]: newSettings,
    };
    setCycleSettingsByCycle(updatedSettings);
    
    try {
      await saveCycleSettingsAction(updatedSettings, cycleNames, cycleSchedulesByCycle);
    } catch (error) {
      console.error("Failed to save cycle settings:", error);
    }
  };

  const handleUpdateCycleSchedule = async (cycleNumber: number, schedule: CycleScheduleSettings) => {
    const updatedSchedules = {
      ...cycleSchedulesByCycle,
      [cycleNumber]: schedule,
    };
    setCycleSchedulesByCycle(updatedSchedules);
    try {
      await saveCycleSettingsAction(cycleSettingsByCycle, cycleNames, updatedSchedules);
    } catch (error) {
      console.error("Failed to save cycle schedules:", error);
    }
  };

  const handleRenameCycle = async (cycleNumber: number, newName: string) => {
    const updatedNames = {
      ...cycleNames,
      [cycleNumber]: newName,
    };
    setCycleNames(updatedNames);
    
    try {
      await saveCycleSettingsAction(cycleSettingsByCycle, updatedNames, cycleSchedulesByCycle);
    } catch (error) {
      console.error("Failed to save cycle names:", error);
    }
  };

  const handleDeleteCycle = async (cycleNumber: number) => {
    console.log("=== START DELETE CYCLE ===");
    console.log("Deleting cycle:", cycleNumber);
    console.log("Current cycleSettingsByCycle keys:", Object.keys(cycleSettingsByCycle));
    
    try {
      // First, call the server action to persist to Firebase
      const result = await deleteCycleAction(clients, cycleNumber, cycleSettingsByCycle, cycleNames, cycleSchedulesByCycle);
      
      if (!result.success) {
        console.error("Failed to delete cycle on server");
        return;
      }
      
      console.log("Server deletion successful for cycle:", cycleNumber);
      
      // Remove this cycle from all clients' weekAssignmentsByCycle and reassign them to Cycle 1
      setClients(prev => prev.map(client => {
        // If client is on the deleted cycle, move them to Cycle 1
        const newCycleNumber = client.currentCycleNumber === cycleNumber ? 1 : client.currentCycleNumber;
        
        const newAssignments = { ...(client.weekAssignmentsByCycle || {}) };
        delete newAssignments[cycleNumber];
        
        const newTrainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
        delete newTrainingMaxesByCycle[cycleNumber];
        
        return {
          ...client,
          currentCycleNumber: newCycleNumber,
          weekAssignmentsByCycle: newAssignments,
          trainingMaxesByCycle: newTrainingMaxesByCycle,
        };
      }));
      
      const updatedCycleSettingsByCycle = { ...cycleSettingsByCycle };
      delete updatedCycleSettingsByCycle[cycleNumber];
      
      const updatedCycleNames = { ...cycleNames };
      delete updatedCycleNames[cycleNumber];

      const updatedCycleSchedulesByCycle = { ...cycleSchedulesByCycle };
      delete updatedCycleSchedulesByCycle[cycleNumber];
      
      // Remove cycle settings
      console.log("Deleting cycle", cycleNumber, "from cycleSettingsByCycle");
      console.log("Before delete - keys:", Object.keys(cycleSettingsByCycle));
      console.log("After delete - keys:", Object.keys(updatedCycleSettingsByCycle));
      setCycleSettingsByCycle(updatedCycleSettingsByCycle);
      
      // Remove from cycle names
      setCycleNames(updatedCycleNames);
      setCycleSchedulesByCycle(updatedCycleSchedulesByCycle);
      
      // If deleting the current cycle, switch to Cycle 1
      if (cycleNumber === currentCycleNumber) {
        console.log("Deleted cycle was current cycle, switching to Cycle 1");
        setCurrentCycleNumber(1);
      }
      
      console.log("=== END DELETE CYCLE ===");
      
      // Refresh after persistence completes so we don't rehydrate stale cycles
      console.log("Calling router.refresh()...");
      router.refresh();
    } catch (error) {
      console.error("Error deleting cycle:", error);
    }
  };

  const handleGraduateTeam = (graduatedClients: Client[], newCycleNumber: number) => {
    console.log("=== START GRADUATE TEAM ===");
    console.log("newCycleNumber:", newCycleNumber);
    console.log("Current cycleSettingsByCycle keys:", Object.keys(cycleSettingsByCycle));
    console.log("Current cycleSettings for cycle", currentCycleNumber, "keys:", Object.keys(cycleSettings));
    
    // The database has already been updated by graduateTeamAction
    // Update local state with the graduated clients and new cycle
    const updatedClients = graduatedClients.map(client => {
      // Get the previous cycle number
      const previousCycle = client.currentCycleNumber || 1;
      
      // Get the current training maxes (from the cycle they're graduating from)
      const currentTrainingMaxes = client.trainingMaxesByCycle?.[previousCycle] ?? client.trainingMaxes;
      
      // Calculate new training maxes for the new cycle
      const newTrainingMaxes = {
        Squat: currentTrainingMaxes.Squat + 10,
        Deadlift: currentTrainingMaxes.Deadlift + 10,
        Bench: currentTrainingMaxes.Bench + 5,
        Press: currentTrainingMaxes.Press + 5,
      };
      
      return {
        ...client,
        currentCycleNumber: newCycleNumber,
        trainingMaxes: newTrainingMaxes, // Update the fallback value
        trainingMaxesByCycle: {
          ...(client.trainingMaxesByCycle || {}),
          [newCycleNumber]: newTrainingMaxes
        },
        weekAssignmentsByCycle: {
          ...(client.weekAssignmentsByCycle || {}),
          [newCycleNumber]: { week1: "5", week2: "3", week3: "1" }
        }
      };
    });
    
    setClients(updatedClients);
    
    const parseWeekNumber = (weekKey: string) => {
      const match = weekKey.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    const getWorkset3Scheme = (settings: any): "5+" | "3+" | "1+" | "5" | "other" => {
      const raw = settings?.reps?.workset3;
      if (raw === undefined || raw === null) return "other";
      const repText = String(raw).trim();
      if (repText.includes("+")) {
        if (repText.includes("5")) return "5+";
        if (repText.includes("3")) return "3+";
        if (repText.includes("1")) return "1+";
      }
      if (repText === "5" || repText === "5.0") return "5";
      return "other";
    };

    const sourceWeeks = Object.entries(cycleSettings)
      .sort(([a], [b]) => parseWeekNumber(a) - parseWeekNumber(b));

    const latestByScheme: Partial<Record<"5+" | "3+" | "1+" | "5", any>> = {};
    for (const [, weekSettings] of sourceWeeks) {
      const scheme = getWorkset3Scheme(weekSettings);
      if (scheme !== "other") {
        latestByScheme[scheme] = JSON.parse(JSON.stringify(weekSettings));
      }
    }

    const fallbackWeek1 = cycleSettings.week1 ? JSON.parse(JSON.stringify(cycleSettings.week1)) : undefined;
    const fallbackWeek2 = cycleSettings.week2 ? JSON.parse(JSON.stringify(cycleSettings.week2)) : undefined;
    const fallbackWeek3 = cycleSettings.week3 ? JSON.parse(JSON.stringify(cycleSettings.week3)) : undefined;
    const fallbackWeek4 = cycleSettings.week4 ? JSON.parse(JSON.stringify(cycleSettings.week4)) : undefined;

    const newCycleSettings: CycleSettings = {
      week1: (latestByScheme["5+"] || fallbackWeek1 || fallbackWeek4 || JSON.parse(JSON.stringify(sourceWeeks[0]?.[1] || {}))) as any,
      week2: (latestByScheme["3+"] || fallbackWeek2 || fallbackWeek1 || JSON.parse(JSON.stringify(sourceWeeks[0]?.[1] || {}))) as any,
      week3: (latestByScheme["1+"] || fallbackWeek3 || fallbackWeek2 || JSON.parse(JSON.stringify(sourceWeeks[0]?.[1] || {}))) as any,
      week4: (latestByScheme["5"] || fallbackWeek4 || fallbackWeek1 || JSON.parse(JSON.stringify(sourceWeeks[sourceWeeks.length - 1]?.[1] || {}))) as any,
    };

    if (newCycleSettings.week1) newCycleSettings.week1.name = "Week 1";
    if (newCycleSettings.week2) newCycleSettings.week2.name = "Week 2";
    if (newCycleSettings.week3) newCycleSettings.week3.name = "Week 3";
    if (newCycleSettings.week4) newCycleSettings.week4.name = "Week 4";
    console.log("Built fresh 4-week settings for new cycle. Keys:", Object.keys(newCycleSettings));
    
    const updatedCycleSettingsByCycle = {
      ...cycleSettingsByCycle,
      [newCycleNumber]: newCycleSettings,
    };
    const updatedCycleNames = {
      ...cycleNames,
      [newCycleNumber]: `Cycle ${newCycleNumber}`,
    };
    const updatedCycleSchedules = {
      ...cycleSchedulesByCycle,
      [newCycleNumber]: {
        ...(cycleSchedulesByCycle[currentCycleNumber] || {
          cycleStartDate: "",
          day1Weekday: "Tuesday",
          day2Weekday: "Thursday",
        }),
      },
    };
    
    setCycleSettingsByCycle(updatedCycleSettingsByCycle);
    console.log("Updated cycleSettingsByCycle. All cycle keys:", Object.keys(updatedCycleSettingsByCycle));
    console.log("New cycle", newCycleNumber, "has weeks:", Object.keys(updatedCycleSettingsByCycle[newCycleNumber]));
    
    // Update the current cycle view to the new cycle
    setCurrentCycleNumber(newCycleNumber);
    // Add default name for the new cycle
    setCycleNames(updatedCycleNames);
    setCycleSchedulesByCycle(updatedCycleSchedules);
    
    saveCycleSettingsAction(updatedCycleSettingsByCycle, updatedCycleNames, updatedCycleSchedules).catch(error => {
      console.error("Failed to save cycle settings after graduation:", error);
    });
    
    console.log("=== END GRADUATE TEAM ===");
  };

  const getWeekRepScheme = (settings: CycleSettings, weekKey: string): string => {
    const reps = settings[weekKey]?.reps?.workset3;
    if (reps === undefined || reps === null) return "?";
    return String(reps).replace(/\D/g, "");
  };

  const normalizeWeekAssignments = (
    assignments: Record<string, string>,
    settings: CycleSettings
  ): Record<string, string> => {
    const normalized: Record<string, string> = {};
    for (const [weekKey, repScheme] of Object.entries(assignments)) {
      if (!settings[weekKey]) continue;
      const globalRep = getWeekRepScheme(settings, weekKey);
      if (repScheme === "N/A" || repScheme !== globalRep) {
        normalized[weekKey] = repScheme;
      }
    }
    return normalized;
  };

  const handleDuplicateWeek = async (weekKey: string) => {
    console.log("=== START DUPLICATE WEEK ===");
    console.log("weekKey:", weekKey);
    console.log("currentCycleNumber:", currentCycleNumber);
    console.log("current cycleSettings keys:", Object.keys(cycleSettings));
    
    // Extract week number from key (e.g., "week1" -> 1)
    const match = weekKey.match(/\d+/);
    if (!match) {
      console.error("Failed to extract week number from:", weekKey);
      return;
    }
    
    const weekNum = parseInt(match[0]);
    const currentCycleWeekSettings = cycleSettings;
    const newCycleSettings: CycleSettings = {};
    
    console.log("weekNum to duplicate:", weekNum);
    
    // Get the settings of the week being duplicated
    const sourceWeekSettings = currentCycleWeekSettings[weekKey];
    if (!sourceWeekSettings) {
      console.error("Source week settings not found for:", weekKey);
      console.log("Available keys:", Object.keys(currentCycleWeekSettings));
      return;
    }
    
    console.log("sourceWeekSettings:", sourceWeekSettings);
    
    // Process all existing weeks (preserve the duplicated week, shift only later weeks)
    const sortedWeeks = Object.entries(currentCycleWeekSettings)
      .map(([key, settings]) => {
        const keyMatch = key.match(/\d+/);
        const keyNum = keyMatch ? parseInt(keyMatch[0]) : 0;
        return { key, settings, keyNum };
      })
      .filter(item => item.keyNum > 0)
      .sort((a, b) => a.keyNum - b.keyNum);
    
    for (const { key, settings, keyNum } of sortedWeeks) {
      const clonedSettings = JSON.parse(JSON.stringify(settings));
      if (keyNum <= weekNum) {
        // Keep the original week and any earlier weeks
        clonedSettings.name = `Week ${keyNum}`;
        newCycleSettings[key] = clonedSettings;
      } else {
        // Shift weeks after the duplicated week
        const newWeekNumber = keyNum + 1;
        clonedSettings.name = `Week ${newWeekNumber}`;
        newCycleSettings[`week${newWeekNumber}`] = clonedSettings;
      }
    }
    
    // Deep clone the entire week settings (percentages, reps, accessories)
    newCycleSettings[`week${weekNum + 1}`] = JSON.parse(JSON.stringify(sourceWeekSettings));
    newCycleSettings[`week${weekNum + 1}`].name = `Week ${weekNum + 1}`;
    
    console.log("newCycleSettings after duplicate:", newCycleSettings);
    
    const updatedCycleSettingsByCycle = {
      ...cycleSettingsByCycle,
      [currentCycleNumber]: newCycleSettings,
    };
    
    // Update this cycle's settings
    setCycleSettingsByCycle(updatedCycleSettingsByCycle);
    console.log("Updated cycleSettingsByCycle for cycle", currentCycleNumber);
    console.log("New week keys:", Object.keys(newCycleSettings));
    
    console.log("=== END DUPLICATE WEEK ===");
    
    // Update all clients' weekAssignmentsByCycle to include the new week
    const updatedClients = clients.map(client => {
      const clientCycle = client.currentCycleNumber || 1;
      if (clientCycle !== currentCycleNumber) {
        return client;
      }
      
      const currentCycleAssignments = client.weekAssignmentsByCycle?.[clientCycle] || {};
      const newAssignments: Record<string, string> = {};

      // Carry forward only true overrides from old defaults, shifting weeks after insertion
      for (const [assignmentWeekKey, repScheme] of Object.entries(currentCycleAssignments)) {
        const assignmentMatch = assignmentWeekKey.match(/\d+/);
        if (!assignmentMatch) continue;

        const assignmentWeekNum = parseInt(assignmentMatch[0], 10);
        const oldGlobalRep = getWeekRepScheme(currentCycleWeekSettings, assignmentWeekKey);
        const isOverride = repScheme === "N/A" || repScheme !== oldGlobalRep;
        if (!isOverride) continue;

        const newWeekNum = assignmentWeekNum > weekNum
          ? assignmentWeekNum + 1
          : assignmentWeekNum;

        newAssignments[`week${newWeekNum}`] = repScheme;
      }
      
      // Intentionally do not clone source-week client overrides into the duplicated week.
      // A duplicated week should inherit the global programming for that new week by default.

      const cleanedAssignments = normalizeWeekAssignments(newAssignments, newCycleSettings);

      const currentLoggedByWeek = client.loggedSetInputsByCycle?.[clientCycle] || {};
      const shiftedLoggedByWeek: Record<string, Partial<Record<Lift, LoggedSetMap>>> = {};
      for (const [loggedWeekKey, loggedWeekValue] of Object.entries(currentLoggedByWeek)) {
        const loggedMatch = loggedWeekKey.match(/\d+/);
        if (!loggedMatch) continue;
        const loggedWeekNum = parseInt(loggedMatch[0], 10);
        const newLoggedWeekNum = loggedWeekNum > weekNum ? loggedWeekNum + 1 : loggedWeekNum;
        shiftedLoggedByWeek[`week${newLoggedWeekNum}`] = loggedWeekValue;
      }

      const nextLogged = {
        ...(client.loggedSetInputsByCycle || {}),
        [clientCycle]: shiftedLoggedByWeek,
      } as LoggedSetInputsByCycle;

      const currentSessionState = client.sessionStateByCycle?.[clientCycle];
      const modeByWeek = currentSessionState?.modeByWeek || {};
      const flowWeekKeyByWeek = currentSessionState?.flowWeekKeyByWeek || {};
      const shiftedModeByWeek: Record<string, SessionMode> = {};
      const shiftedFlowWeekByWeek: Record<string, string> = {};

      for (const [modeWeekKey, modeValue] of Object.entries(modeByWeek)) {
        const modeMatch = modeWeekKey.match(/\d+/);
        if (!modeMatch) continue;
        const modeWeekNum = parseInt(modeMatch[0], 10);
        const newModeWeekNum = modeWeekNum > weekNum ? modeWeekNum + 1 : modeWeekNum;
        shiftedModeByWeek[`week${newModeWeekNum}`] = modeValue;
      }

      for (const [flowWeekKey, flowValue] of Object.entries(flowWeekKeyByWeek)) {
        const flowMatch = flowWeekKey.match(/\d+/);
        if (!flowMatch) continue;
        const flowWeekNum = parseInt(flowMatch[0], 10);
        const newFlowWeekNum = flowWeekNum > weekNum ? flowWeekNum + 1 : flowWeekNum;
        shiftedFlowWeekByWeek[`week${newFlowWeekNum}`] = flowValue;
      }

      const nextSessionStateByCycle = {
        ...(client.sessionStateByCycle || {}),
        [clientCycle]: {
          ...(currentSessionState || { mode: "normal" as SessionMode }),
          modeByWeek: shiftedModeByWeek,
          flowWeekKeyByWeek: shiftedFlowWeekByWeek,
        },
      };
      
      return {
        ...client,
        weekAssignmentsByCycle: {
          ...(client.weekAssignmentsByCycle || {}),
          [clientCycle]: cleanedAssignments,
        },
        loggedSetInputsByCycle: nextLogged,
        sessionStateByCycle: nextSessionStateByCycle,
      };
    });
    
    setClients(updatedClients);
    
    const updatedAssignmentsPayload = updatedClients
      .filter(client => (client.currentCycleNumber || 1) === currentCycleNumber)
      .map(client => ({
        id: client.id,
        weekAssignmentsByCycle: client.weekAssignmentsByCycle || {},
      }));

    const updatedLoggedPayload = updatedClients
      .filter(client => (client.currentCycleNumber || 1) === currentCycleNumber)
      .map(client => ({
        id: client.id,
        loggedSetInputsByCycle: client.loggedSetInputsByCycle || {},
      }));

    const updatedSessionPayload = updatedClients
      .filter(client => (client.currentCycleNumber || 1) === currentCycleNumber)
      .map(client => ({
        id: client.id,
        sessionStateByCycle: client.sessionStateByCycle || {},
      }));
    
    try {
      const cycleSettingsResult = await saveCycleSettingsAction(updatedCycleSettingsByCycle, cycleNames, cycleSchedulesByCycle);
      if (!cycleSettingsResult.success) {
        throw new Error(cycleSettingsResult.message || "Failed to save cycle settings.");
      }

      const assignmentsResult = await updateClientWeekAssignmentsAction(updatedAssignmentsPayload);
      if (!assignmentsResult.success) {
        console.error("Week duplicated, but failed to persist assignment updates:", assignmentsResult.message);
      }

      const loggedResult = await updateClientLoggedSetInputsBulkAction(updatedLoggedPayload as any);
      if (!loggedResult.success) {
        console.error("Week duplicated, but failed to persist logged set shifts:", loggedResult.message);
      }

      const sessionResults = await Promise.all(
        updatedSessionPayload.map((item) =>
          updateClientProfileAction(item.id, {
            sessionStateByCycle: item.sessionStateByCycle as any,
          })
        )
      );
      if (sessionResults.some((result) => !result.success)) {
        console.error("Week duplicated, but failed to persist some session mode updates.");
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to save duplicate week changes:", error);
    }
  };

  const handleDeleteWeek = async (weekKey: string): Promise<boolean> => {
    const match = weekKey.match(/\d+/);
    if (!match) return false;

    const deletedWeekNum = parseInt(match[0], 10);
    const sortedWeeks = Object.entries(cycleSettings)
      .map(([key, settings]) => {
        const keyMatch = key.match(/\d+/);
        const keyNum = keyMatch ? parseInt(keyMatch[0], 10) : 0;
        return { key, settings, keyNum };
      })
      .filter(item => item.keyNum > 0)
      .sort((a, b) => a.keyNum - b.keyNum);

    if (sortedWeeks.length <= 1) {
      return false;
    }

    const newCycleSettings: CycleSettings = {};
    for (const { settings, keyNum } of sortedWeeks) {
      if (keyNum === deletedWeekNum) continue;
      const newWeekNum = keyNum > deletedWeekNum ? keyNum - 1 : keyNum;
      const clonedSettings = JSON.parse(JSON.stringify(settings));
      clonedSettings.name = `Week ${newWeekNum}`;
      newCycleSettings[`week${newWeekNum}`] = clonedSettings;
    }

    const updatedCycleSettingsByCycle = {
      ...cycleSettingsByCycle,
      [currentCycleNumber]: newCycleSettings,
    };
    setCycleSettingsByCycle(updatedCycleSettingsByCycle);

    const currentWeekMatch = currentWeek.match(/\d+/);
    const currentWeekNum = currentWeekMatch ? parseInt(currentWeekMatch[0], 10) : 1;
    const totalWeeks = Object.keys(newCycleSettings).length;
    let nextWeekNum = currentWeekNum;

    if (currentWeekNum === deletedWeekNum) {
      nextWeekNum = Math.min(deletedWeekNum, totalWeeks);
    } else if (currentWeekNum > deletedWeekNum) {
      nextWeekNum = currentWeekNum - 1;
    }

    nextWeekNum = Math.max(1, Math.min(nextWeekNum, totalWeeks));
    setCurrentWeek(`week${nextWeekNum}`);

    const updatedClients = clients.map(client => {
      const clientCycle = client.currentCycleNumber || 1;
      if (clientCycle !== currentCycleNumber) {
        return client;
      }

      const currentCycleAssignments = client.weekAssignmentsByCycle?.[clientCycle] || {};
      const newAssignments: Record<string, string> = {};

      for (const [assignmentWeekKey, repScheme] of Object.entries(currentCycleAssignments)) {
        const assignmentMatch = assignmentWeekKey.match(/\d+/);
        if (!assignmentMatch) continue;

        const assignmentWeekNum = parseInt(assignmentMatch[0], 10);
        const oldGlobalRep = getWeekRepScheme(cycleSettings, assignmentWeekKey);
        const isOverride = repScheme === "N/A" || repScheme !== oldGlobalRep;
        if (!isOverride || assignmentWeekNum === deletedWeekNum) continue;

        const newWeekNum = assignmentWeekNum > deletedWeekNum
          ? assignmentWeekNum - 1
          : assignmentWeekNum;
        newAssignments[`week${newWeekNum}`] = repScheme;
      }

      const cleanedAssignments = normalizeWeekAssignments(newAssignments, newCycleSettings);

      const currentLoggedByWeek = client.loggedSetInputsByCycle?.[clientCycle] || {};
      const shiftedLoggedByWeek: Record<string, Partial<Record<Lift, LoggedSetMap>>> = {};
      for (const [loggedWeekKey, loggedWeekValue] of Object.entries(currentLoggedByWeek)) {
        const loggedMatch = loggedWeekKey.match(/\d+/);
        if (!loggedMatch) continue;

        const loggedWeekNum = parseInt(loggedMatch[0], 10);
        if (loggedWeekNum === deletedWeekNum) continue;
        const newLoggedWeekNum = loggedWeekNum > deletedWeekNum ? loggedWeekNum - 1 : loggedWeekNum;
        shiftedLoggedByWeek[`week${newLoggedWeekNum}`] = loggedWeekValue;
      }

      const nextLogged = {
        ...(client.loggedSetInputsByCycle || {}),
        [clientCycle]: shiftedLoggedByWeek,
      } as LoggedSetInputsByCycle;

      const currentSessionState = client.sessionStateByCycle?.[clientCycle];
      const modeByWeek = currentSessionState?.modeByWeek || {};
      const flowWeekKeyByWeek = currentSessionState?.flowWeekKeyByWeek || {};
      const shiftedModeByWeek: Record<string, SessionMode> = {};
      const shiftedFlowWeekByWeek: Record<string, string> = {};

      for (const [modeWeekKey, modeValue] of Object.entries(modeByWeek)) {
        const modeMatch = modeWeekKey.match(/\d+/);
        if (!modeMatch) continue;
        const modeWeekNum = parseInt(modeMatch[0], 10);
        if (modeWeekNum === deletedWeekNum) continue;
        const newModeWeekNum = modeWeekNum > deletedWeekNum ? modeWeekNum - 1 : modeWeekNum;
        shiftedModeByWeek[`week${newModeWeekNum}`] = modeValue;
      }

      for (const [flowWeekKey, flowValue] of Object.entries(flowWeekKeyByWeek)) {
        const flowMatch = flowWeekKey.match(/\d+/);
        if (!flowMatch) continue;
        const flowWeekNum = parseInt(flowMatch[0], 10);
        if (flowWeekNum === deletedWeekNum) continue;
        const newFlowWeekNum = flowWeekNum > deletedWeekNum ? flowWeekNum - 1 : flowWeekNum;
        shiftedFlowWeekByWeek[`week${newFlowWeekNum}`] = flowValue;
      }

      const nextSessionStateByCycle = {
        ...(client.sessionStateByCycle || {}),
        [clientCycle]: {
          ...(currentSessionState || { mode: "normal" as SessionMode }),
          modeByWeek: shiftedModeByWeek,
          flowWeekKeyByWeek: shiftedFlowWeekByWeek,
        },
      };

      return {
        ...client,
        weekAssignmentsByCycle: {
          ...(client.weekAssignmentsByCycle || {}),
          [clientCycle]: cleanedAssignments,
        },
        loggedSetInputsByCycle: nextLogged,
        sessionStateByCycle: nextSessionStateByCycle,
      };
    });

    setClients(updatedClients);

    const updatedAssignmentsPayload = updatedClients
      .filter(client => (client.currentCycleNumber || 1) === currentCycleNumber)
      .map(client => ({
        id: client.id,
        weekAssignmentsByCycle: client.weekAssignmentsByCycle || {},
      }));

    const updatedLoggedPayload = updatedClients
      .filter(client => (client.currentCycleNumber || 1) === currentCycleNumber)
      .map(client => ({
        id: client.id,
        loggedSetInputsByCycle: client.loggedSetInputsByCycle || {},
      }));

    const updatedSessionPayload = updatedClients
      .filter(client => (client.currentCycleNumber || 1) === currentCycleNumber)
      .map(client => ({
        id: client.id,
        sessionStateByCycle: client.sessionStateByCycle || {},
      }));

    try {
      const cycleSettingsResult = await saveCycleSettingsAction(updatedCycleSettingsByCycle, cycleNames, cycleSchedulesByCycle);
      if (!cycleSettingsResult.success) {
        console.error("Failed to persist cycle settings while deleting week:", cycleSettingsResult.message);
        return false;
      }

      const assignmentsResult = await updateClientWeekAssignmentsAction(updatedAssignmentsPayload);
      if (!assignmentsResult.success) {
        console.error("Week deleted, but failed to persist assignment cleanup.");
      }

      const loggedResult = await updateClientLoggedSetInputsBulkAction(updatedLoggedPayload as any);
      if (!loggedResult.success) {
        console.error("Week deleted, but failed to persist logged set shifts.");
      }

      const sessionResults = await Promise.all(
        updatedSessionPayload.map((item) =>
          updateClientProfileAction(item.id, {
            sessionStateByCycle: item.sessionStateByCycle as any,
          })
        )
      );
      if (sessionResults.some((result) => !result.success)) {
        console.error("Week deleted, but failed to persist some session mode updates.");
      }

      router.refresh();
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return true;
    } catch (error) {
      console.error("Failed to save cycle settings after week delete:", error);
      return false;
    }
  };

  const sidebarTopControls = (
    <div className="space-y-2">
      <div className="inline-flex items-center rounded-md border overflow-hidden">
        <button
          type="button"
          className={`h-8 px-3 text-sm font-medium transition-colors ${viewMode === "day" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
          onClick={() => setViewMode("day")}
        >
          Day View
        </button>
        <button
          type="button"
          className={`h-8 px-3 text-sm font-medium transition-colors border-l ${viewMode === "lift" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
          onClick={() => setViewMode("lift")}
        >
          Lift View
        </button>
      </div>

      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
        {viewMode === "day" ? (
          <>
            <Button
              type="button"
              size="sm"
              className="text-sm whitespace-nowrap"
              variant={dayViewSlot === "day1" ? "default" : "outline"}
              onClick={() => {
                setDayViewSlot("day1");
                setAutoSelectedDay(null);
              }}
            >
              {getDayButtonLabel("day1")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-sm whitespace-nowrap"
              variant={dayViewSlot === "day2" ? "default" : "outline"}
              onClick={() => {
                setDayViewSlot("day2");
                setAutoSelectedDay(null);
              }}
            >
              {getDayButtonLabel("day2")}
            </Button>
            {autoSelectedDay === dayViewSlot ? (
              <span className="text-[10px] rounded border px-2 py-0.5 text-muted-foreground whitespace-nowrap">
                Auto-selected for today
              </span>
            ) : null}
          </>
        ) : null}

        {viewMode === "lift" ? (
          <>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs whitespace-nowrap"
              variant={lift === "Deadlift" ? "default" : "outline"}
              onClick={() => handleLiftChange("Deadlift")}
            >
              Deadlift
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs whitespace-nowrap"
              variant={lift === "Bench" ? "default" : "outline"}
              onClick={() => handleLiftChange("Bench")}
            >
              Bench
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs whitespace-nowrap"
              variant={lift === "Squat" ? "default" : "outline"}
              onClick={() => handleLiftChange("Squat")}
            >
              Squat
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs whitespace-nowrap"
              variant={lift === "Press" ? "default" : "outline"}
              onClick={() => handleLiftChange("Press")}
            >
              Press
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );


  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
      <div className="flex">
        <SettingsSidebar
          lift={lift}
          onLiftChange={handleLiftChange}
          showLiftSelector={false}
          showCycleSelector={true}
          topControls={sidebarTopControls}
          currentWeek={currentWeek}
          onWeekChange={handleWeekChange}
          cycleSettings={cycleSettings}
          clients={clients}
          currentCycleNumber={currentCycleNumber}
          availableCycleNumbers={availableCycles.map(cycle => cycle.cycleNumber)}
          onCycleChange={setCurrentCycleNumber}
          onAddClient={() => setAddClientSheetOpen(true)}
          onClientProfile={handleClientProfile}
          onAiInsight={handleAiInsight}
          onReorderClient={handleReorderClient}
          onDuplicateWeek={handleDuplicateWeek}
          onDeleteWeek={handleDeleteWeek}
          onGraduateTeam={handleGraduateTeam}
        />
        <main className="flex-1 p-4 md:p-6 relative">
          <div style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 300ms ease-in-out' }}>
            <div className="mb-3 relative flex items-center gap-3 min-h-8">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="h-8 w-8 border" />
                <span className="text-xs text-muted-foreground">Toggle Sidebar</span>
              </div>
              <p className={`absolute left-1/2 -translate-x-1/2 ${isSidebarOpen ? "-ml-[131px]" : "-ml-[3px]"} text-lg font-bold tracking-tight`}>{sessionHeaderLabel}</p>
            </div>

            {viewMode === "lift" ? (
              <>
                <WorkoutTable 
                  workouts={calculatedWorkouts} 
                  lift={lift}
                  weekName={cycleSettings[currentWeek]?.name || currentWeek}
                  workoutDateLabel={getLiftDateLabel(lift)}
                  cycleSettings={cycleSettings}
                  currentWeek={currentWeek}
                  currentCycleNumber={currentCycleNumber}
                  onRepRecordUpdate={handleRepRecordUpdate}
                  onPersistLoggedSets={handlePersistLoggedSets}
                />
                <AccessoryDisplay
                  lift={lift}
                  cycleSettings={cycleSettings}
                  currentWeek={currentWeek}
                  weekByLift={effectiveWeekByLiftForLiftView}
                />
              </>
            ) : (
              <div className="space-y-0.5">
                {dayLifts.length === 0 ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    No movements assigned to this day. Set movement day assignments in Configuration → Cycle Schedule.
                  </div>
                ) : null}
                {dayLifts.map((dayLift, index) => (
                  <div
                    key={dayLift}
                    className={index === 0 ? "space-y-1" : "mt-3 border-t pt-3 space-y-1"}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-semibold">{dayLift}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() =>
                          setCollapsedDayLifts((prev) => ({
                            ...prev,
                            [dayLift]: !prev[dayLift],
                          }))
                        }
                      >
                        {collapsedDayLifts[dayLift] ? "Expand" : "Minimize"}
                      </Button>
                    </div>
                    {!collapsedDayLifts[dayLift] ? (
                      <WorkoutTable
                        workouts={dayWorkoutsByLift[dayLift] || []}
                        lift={dayLift}
                        weekName={cycleSettings[currentWeek]?.name || currentWeek}
                        workoutDateLabel={getLiftDateLabel(dayLift)}
                        cycleSettings={cycleSettings}
                        currentWeek={currentWeek}
                        currentCycleNumber={currentCycleNumber}
                        onRepRecordUpdate={handleRepRecordUpdate}
                        onPersistLoggedSets={handlePersistLoggedSets}
                        buildCopyText={buildDayCopyTextForWorkout}
                      />
                    ) : (
                      <div className="h-0" />
                    )}
                  </div>
                ))}
                <AccessoryDisplay
                  lifts={dayLifts}
                  cycleSettings={cycleSettings}
                  currentWeek={currentWeek}
                  weekByLift={effectiveWeekByLiftForDayView}
                />
              </div>
            )}
            <div className="fixed bottom-6 right-6 z-40">
              <ConfigSettingsDialog
                cycleSettings={cycleSettings}
                onUpdateCycleSettings={handleUpdateCycleSettings}
                cycleSchedulesByCycle={cycleSchedulesByCycle}
                onUpdateCycleSchedule={handleUpdateCycleSchedule}
                currentWeekKey={currentWeek}
                cycles={availableCycles}
                currentCycleNumber={currentCycleNumber}
                onRenameCycle={handleRenameCycle}
                onDeleteCycle={handleDeleteCycle}
                onCycleChange={setCurrentCycleNumber}
              />
            </div>
          </div>
        </main>
      </div>
      <AddClientSheet 
        open={isAddClientSheetOpen} 
        onOpenChange={setAddClientSheetOpen}
        onClientAdded={(newClient) => setClients(prev => [...prev, newClient])}
      />
      <AiInsightsDialog 
        open={isAiInsightsDialogOpen}
        onOpenChange={setAiInsightsDialogOpen}
        client={selectedClientForAi}
        lift={lift}
        cycleSettings={cycleSettings}
        currentWeek={currentWeek}
        historicalData={historicalData}
        onOpenChart={() => setProgressChartDialogOpen(true)}
      />
      <ProgressChartDialog
        open={isProgressChartDialogOpen}
        onOpenChange={setProgressChartDialogOpen}
        client={selectedClientForAi}
        lift={lift}
        historicalData={historicalData}
      />
      <ClientProfileModal
        open={isClientProfileModalOpen}
        onOpenChange={setClientProfileModalOpen}
        client={selectedClientForProfile}
        cycleSettings={cycleSettings}
        currentGlobalWeek={currentWeek}
        currentCycleNumber={currentCycleNumber}
        historicalData={historicalData}
        onUpdateClient={handleUpdateClient}
        onResetTrainingMax={handleResetClientTrainingMax}
      />
    </SidebarProvider>
  );
}
