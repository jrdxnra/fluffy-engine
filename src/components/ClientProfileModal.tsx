"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Client, CycleScheduleSettings, CycleSettings, GlobalMovementSettings, HistoricalRecord, Lift, MovementProfile, SessionMode } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { getEffectiveCycleSchedule, getLiftDisplayName } from "@/lib/schedule";
import { normalizeMovementName, resolveMovementClassType } from "@/lib/movement-profiles";
import { getEffectiveCycleMembership } from "@/lib/cycle-membership";
import { ClientProgressChart } from "./ClientProgressChart";
import { useAdminModeContext } from "@/contexts/AdminModeContext";
import { getDefaultMovementProgressionIncrement } from "@/lib/movement-profiles";

type ClientProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  cycleSettings: CycleSettings;
  currentCycleSchedule?: CycleScheduleSettings;
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>;
  globalMovementOptions?: string[];
  globalMovementSettings?: GlobalMovementSettings;
  currentGlobalWeek: string;
  currentCycleNumber?: number;
  availableCycleNumbers?: number[];
  historicalData: HistoricalRecord[];
  onUpdateClient: (updatedClient: Client) => Promise<void> | void;
  onResetTrainingMax: (clientId: string, cycleNumber: number) => Promise<void>;
  onDeleteClient: (clientId: string) => Promise<void>;
};

const getRepScheme = (workset3Reps: string | number): string => {
  const repNum = typeof workset3Reps === "string"
    ? workset3Reps.replace(/\D/g, "")
    : workset3Reps.toString();
  return repNum || "?";
};

const normalizeAssignmentsForSettings = (
  assignments: Record<string, string>,
  settings: CycleSettings
): Record<string, string> => {
  const normalized: Record<string, string> = {};

  for (const [weekKey, repScheme] of Object.entries(assignments)) {
    const weekSettings = settings[weekKey];
    if (!weekSettings) continue;

    const globalRepScheme = getRepScheme(weekSettings.reps.workset3);
    if (repScheme === "N/A" || repScheme !== globalRepScheme) {
      normalized[weekKey] = repScheme;
    }
  }

  return normalized;
};

export function ClientProfileModal({
  open,
  onOpenChange,
  client,
  cycleSettings,
  currentCycleSchedule,
  cycleSchedulesByCycle = {},
  globalMovementOptions = [],
  globalMovementSettings,
  currentGlobalWeek,
  currentCycleNumber = 1,
  availableCycleNumbers = [1, 2, 3, 4],
  historicalData,
  onUpdateClient,
  onDeleteClient,
}: ClientProfileModalProps) {
  const [localClient, setLocalClient] = useState<Client | null>(client);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<number>(currentCycleNumber);
  const { isAdminMode } = useAdminModeContext();
  void currentGlobalWeek;

  const cycleOptions = useMemo(() => {
    const fromData = new Set<number>([
      currentCycleNumber,
      ...availableCycleNumbers,
      ...Object.keys(client?.oneRepMaxesByCycle || {}).map((cycleKey) => parseInt(cycleKey, 10)).filter((cycle) => !Number.isNaN(cycle)),
      ...Object.keys(client?.movementProfilesByCycle || {}).map((cycleKey) => parseInt(cycleKey, 10)).filter((cycle) => !Number.isNaN(cycle)),
    ]);

    return Array.from(fromData).sort((a, b) => a - b);
  }, [availableCycleNumbers, client, currentCycleNumber]);

  useEffect(() => {
    if (!client) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalClient(null);
      return;
    }

    const cycleOneRepMaxes = client.oneRepMaxesByCycle?.[currentCycleNumber];
    const cycleMembership = getEffectiveCycleMembership(client);
    setLocalClient({
      ...client,
      cycleMembership,
      oneRepMaxes: cycleOneRepMaxes || client.oneRepMaxes,
    });
    setSelectedCycle(currentCycleNumber);
  }, [client, currentCycleNumber]);

  const progressChartDataByLift = useMemo(() => {
    if (!localClient) {
      return {
        Deadlift: [],
        Bench: [],
        Squat: [],
        Press: [],
      } as Record<Lift, HistoricalRecord[]>;
    }

    const byLift: Record<Lift, HistoricalRecord[]> = {
      Deadlift: [],
      Bench: [],
      Squat: [],
      Press: [],
    };

    historicalData
      .filter((record) => record.clientId === localClient.id)
      .forEach((record) => {
        byLift[record.lift].push(record);
      });

    for (const lift of Lifts) {
      byLift[lift].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return byLift;
  }, [historicalData, localClient]);

  const sortedWeekEntries = useMemo(() => {
    return Object.entries(cycleSettings).sort(([a], [b]) => {
      const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return aNum - bNum;
    });
  }, [cycleSettings]);

  const selectedCycleSchedule = useMemo(
    () => getEffectiveCycleSchedule(cycleSchedulesByCycle[selectedCycle] || currentCycleSchedule),
    [cycleSchedulesByCycle, currentCycleSchedule, selectedCycle]
  );

  const movementProfileEntries = useMemo(() => {
    if (!localClient) return [] as Array<{ name: string; profile: MovementProfile; trackedLift?: Lift }>;

    const cycleProfiles = localClient.movementProfilesByCycle?.[selectedCycle] || {};
    const cycleSelections = localClient.movementSelectionByCycle?.[selectedCycle] || {};
    const isCurrentCycleView = selectedCycle === currentCycleNumber;
    const mapped = new Map<string, { name: string; profile: MovementProfile; trackedLift?: Lift }>();
    const trackedAliasNames = new Set<string>();
    const cycleTrainingMaxes =
      (localClient.trainingMaxesByCycle?.[selectedCycle] || localClient.trainingMaxes);
    const cycleOneRepMaxes = localClient.oneRepMaxesByCycle?.[selectedCycle] || localClient.oneRepMaxes;
    const cycleCalibrationMap = localClient.movementCalibrationsByCycle?.[selectedCycle] || {};

    const resolveMatchedLift = (movementName: string, fallbackLift?: Lift): Lift | undefined => {
      if (fallbackLift) return fallbackLift;
      const normalized = normalizeMovementName(movementName);
      return Lifts.find((lift) => {
        const display = getLiftDisplayName(lift, selectedCycleSchedule);
        return (
          normalized === normalizeMovementName(lift) ||
          normalized === normalizeMovementName(display)
        );
      });
    };

    const isCalibrationRequired = (movementName: string, profile: MovementProfile, fallbackLift?: Lift) => {
      const matchedLift = resolveMatchedLift(movementName, fallbackLift);
      const liftNeedsCalibration = matchedLift
        ? Boolean(cycleCalibrationMap[matchedLift]?.needsCalibration)
        : false;
      return liftNeedsCalibration || !profile.sourceWeekKey;
    };

    for (const lift of Lifts) {
      const selectedName = (cycleSelections[lift] || getLiftDisplayName(lift, selectedCycleSchedule)).trim();
      const displayName = getLiftDisplayName(lift, selectedCycleSchedule);
      const aliases = [selectedName, displayName, lift]
        .map((name) => name.trim())
        .filter((name, index, arr) => arr.findIndex((value) => normalizeMovementName(value) === normalizeMovementName(name)) === index);

      for (const alias of aliases) {
        trackedAliasNames.add(normalizeMovementName(alias));
      }

      const normalizedLiftAlias = normalizeMovementName(lift);
      const normalizedDisplayAlias = normalizeMovementName(displayName);
      const normalizedSelectedAlias = normalizeMovementName(selectedName);
      const existingEntry =
        Object.entries(cycleProfiles).find(([profileName]) => normalizeMovementName(profileName) === normalizedSelectedAlias) ||
        Object.entries(cycleProfiles).find(([profileName]) => normalizeMovementName(profileName) === normalizedLiftAlias) ||
        Object.entries(cycleProfiles).find(([profileName]) => normalizeMovementName(profileName) === normalizedDisplayAlias);

      const mappedKey = normalizeMovementName(lift);
      if (!mapped.has(mappedKey) && (existingEntry || isCurrentCycleView)) {
        const existingProfile = existingEntry?.[1];
        const baseProfile: MovementProfile = existingProfile || {
          oneRepMax: cycleOneRepMaxes[lift],
          trainingMax: cycleTrainingMaxes[lift],
          classType: resolveMovementClassType(selectedName, globalMovementSettings, lift),
          progressionIncrement: getDefaultMovementProgressionIncrement(selectedName, globalMovementSettings, lift),
          progressionHoldActive: false,
          movementCycleNumber: selectedCycle,
          calibrationPhaseActive: true,
        };

        mapped.set(mappedKey, {
          name: selectedName,
          trackedLift: lift,
          profile: {
            ...baseProfile,
            calibrationPhaseActive: isCalibrationRequired(selectedName, baseProfile, lift)
              ? true
              : Boolean(baseProfile.calibrationPhaseActive),
          },
        });
      }
    }

    for (const [profileName, profile] of Object.entries(cycleProfiles)) {
      const normalizedName = normalizeMovementName(profileName);
      if (trackedAliasNames.has(normalizedName)) continue;
      if (!mapped.has(normalizedName)) {
        const calibrationRequired = isCalibrationRequired(profileName, profile);
        mapped.set(normalizedName, {
          name: profileName,
          trackedLift: undefined,
          profile: {
            ...profile,
            calibrationPhaseActive: calibrationRequired ? true : Boolean(profile.calibrationPhaseActive),
          },
        });
      }
    }

    return Array.from(mapped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [localClient, selectedCycle, selectedCycleSchedule, globalMovementSettings, currentCycleNumber]);

  const trackedMovementEntries = useMemo(
    () => movementProfileEntries.filter((entry): entry is typeof entry & { trackedLift: Lift } => Boolean(entry.trackedLift)),
    [movementProfileEntries]
  );

  const trackedMovementByLift = useMemo(() => {
    const map = {} as Record<Lift, { name: string; profile: MovementProfile; trackedLift: Lift }>;
    for (const entry of trackedMovementEntries) {
      if (entry.trackedLift) {
        map[entry.trackedLift] = entry;
      }
    }
    return map;
  }, [trackedMovementEntries]);

  const mainLiftProfileSnapshots = useMemo(() => {
    const snapshots = {} as Record<Lift, { oneRepMax: number; trainingMax: number }>;
    const isCurrentCycleView = selectedCycle === currentCycleNumber;

    for (const lift of Lifts) {
      const normalizedLift = normalizeMovementName(lift);
      const exactProfile = movementProfileEntries.find(({ trackedLift }) => trackedLift === lift)
        || movementProfileEntries.find(({ name }) => normalizeMovementName(name) === normalizedLift);
      const fallbackLiftProfile = movementProfileEntries.find(
        ({ name }) => normalizeMovementName(name) === normalizeMovementName(getLiftDisplayName(lift, selectedCycleSchedule))
      );
      const chosenProfile = exactProfile || fallbackLiftProfile;

      if (!chosenProfile && !isCurrentCycleView) {
        snapshots[lift] = { oneRepMax: 0, trainingMax: 0 };
        continue;
      }

      snapshots[lift] = {
        oneRepMax: chosenProfile?.profile.oneRepMax ?? localClient?.oneRepMaxesByCycle?.[selectedCycle]?.[lift] ?? localClient?.oneRepMaxes[lift] ?? 0,
        trainingMax: chosenProfile?.profile.trainingMax ?? localClient?.trainingMaxesByCycle?.[selectedCycle]?.[lift] ?? localClient?.trainingMaxes[lift] ?? 0,
      };
    }

    return snapshots;
  }, [movementProfileEntries, localClient, selectedCycle, selectedCycleSchedule, currentCycleNumber]);

  const handleMovementProfileChange = (
    movementName: string,
    field: "oneRepMax" | "trainingMax" | "movementCycleNumber" | "progressionIncrement",
    value: string
  ) => {
    if (!localClient) return;
    const parsed = field === "progressionIncrement" ? Number(value) : parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    if (field === "progressionIncrement" && ![2.5, 5, 7.5, 10].includes(parsed)) return;

    const existingForCycle = localClient.movementProfilesByCycle?.[selectedCycle] || {};
    const normalizedMovementName = normalizeMovementName(movementName);
    const matchedLift = Lifts.find((lift) => {
      const display = getLiftDisplayName(lift, selectedCycleSchedule);
      return normalizedMovementName === normalizeMovementName(lift) || normalizedMovementName === normalizeMovementName(display);
    });
    const existing = existingForCycle[movementName] || {
      oneRepMax: 0,
      trainingMax: 0,
      classType: resolveMovementClassType(movementName, globalMovementSettings, matchedLift),
      progressionIncrement: getDefaultMovementProgressionIncrement(movementName, globalMovementSettings, matchedLift),
      progressionHoldActive: false,
      movementCycleNumber: selectedCycle,
      calibrationPhaseActive: true,
    };

    const nextFieldValues =
      field === "oneRepMax"
        ? {
            oneRepMax: parsed,
            trainingMax: Math.round((parsed * 0.9) / 5) * 5,
          }
        : {
            [field]: parsed,
          };

    setLocalClient({
      ...localClient,
      movementProfilesByCycle: {
        ...(localClient.movementProfilesByCycle || {}),
        [selectedCycle]: {
          ...existingForCycle,
          [movementName]: {
            ...existing,
            ...nextFieldValues,
          },
        },
      },
    });
  };

  const handleMovementCalibrationToggle = (movementName: string, enabled: boolean) => {
    if (!localClient) return;
    const existingForCycle = localClient.movementProfilesByCycle?.[selectedCycle] || {};
    const normalizedMovementName = normalizeMovementName(movementName);
    const matchedLift = Lifts.find((lift) => {
      const display = getLiftDisplayName(lift, selectedCycleSchedule);
      return normalizedMovementName === normalizeMovementName(lift) || normalizedMovementName === normalizeMovementName(display);
    });
    const existing = existingForCycle[movementName] || {
      oneRepMax: mainLiftProfileSnapshots[matchedLift || "Squat"].oneRepMax,
      trainingMax: mainLiftProfileSnapshots[matchedLift || "Squat"].trainingMax,
      classType: resolveMovementClassType(movementName, globalMovementSettings, matchedLift),
      progressionIncrement: getDefaultMovementProgressionIncrement(movementName, globalMovementSettings, matchedLift),
      progressionHoldActive: false,
      movementCycleNumber: selectedCycle,
      calibrationPhaseActive: true,
    };
    const canExitCalibration = Boolean(existing.sourceWeekKey);

    if (!canExitCalibration && !enabled) return;

    setLocalClient({
      ...localClient,
      movementProfilesByCycle: {
        ...(localClient.movementProfilesByCycle || {}),
        [selectedCycle]: {
          ...existingForCycle,
          [movementName]: {
            ...existing,
              calibrationPhaseActive: enabled ? canExitCalibration : existing.calibrationPhaseActive,
              progressionHoldActive: enabled ? false : existing.progressionHoldActive,
          },
        },
      },
    });
  };

  const handleMovementHoldToggle = (movementName: string, enabled: boolean) => {
    if (!localClient) return;
    const existingForCycle = localClient.movementProfilesByCycle?.[selectedCycle] || {};
    const normalizedMovementName = normalizeMovementName(movementName);
    const matchedLift = Lifts.find((lift) => {
      const display = getLiftDisplayName(lift, selectedCycleSchedule);
      return normalizedMovementName === normalizeMovementName(lift) || normalizedMovementName === normalizeMovementName(display);
    });
    const existing = existingForCycle[movementName] || {
      oneRepMax: mainLiftProfileSnapshots[matchedLift || "Squat"].oneRepMax,
      trainingMax: mainLiftProfileSnapshots[matchedLift || "Squat"].trainingMax,
      classType: resolveMovementClassType(movementName, globalMovementSettings, matchedLift),
      progressionIncrement: getDefaultMovementProgressionIncrement(movementName, globalMovementSettings, matchedLift),
      progressionHoldActive: false,
      movementCycleNumber: selectedCycle,
      calibrationPhaseActive: true,
    };
    const canExitCalibration = Boolean(existing.sourceWeekKey);

    setLocalClient({
      ...localClient,
      movementProfilesByCycle: {
        ...(localClient.movementProfilesByCycle || {}),
        [selectedCycle]: {
          ...existingForCycle,
          [movementName]: {
            ...existing,
            progressionHoldActive: enabled,
              calibrationPhaseActive: canExitCalibration ? (enabled ? false : existing.calibrationPhaseActive) : true,
          },
        },
      },
    });
  };

  const handleWeekAssignmentChange = (cycleNumber: number, weekKey: string, repScheme: string) => {
    if (!localClient) return;

    const currentAssignments = {
      ...(localClient.weekAssignmentsByCycle?.[cycleNumber] || {}),
    };
    const globalRepScheme = getRepScheme(cycleSettings[weekKey]?.reps.workset3);

    if (repScheme === globalRepScheme) {
      delete currentAssignments[weekKey];
    } else {
      currentAssignments[weekKey] = repScheme;
    }

    const normalizedAssignments = normalizeAssignmentsForSettings(currentAssignments, cycleSettings);
    const updatedAssignmentsByCycle = {
      ...(localClient.weekAssignmentsByCycle || {}),
    };

    if (Object.keys(normalizedAssignments).length === 0) {
      delete updatedAssignmentsByCycle[cycleNumber];
    } else {
      updatedAssignmentsByCycle[cycleNumber] = normalizedAssignments;
    }

    setLocalClient({
      ...localClient,
      weekAssignmentsByCycle: updatedAssignmentsByCycle,
    });
  };

  const handleTrackedMovementSelectionChange = (lift: Lift, nextMovementName: string) => {
    if (!localClient) return;
    const trimmed = nextMovementName.trim();
    if (!trimmed) return;

    const existingForCycle = localClient.movementProfilesByCycle?.[selectedCycle] || {};
    const currentDisplayName = getLiftDisplayName(lift, selectedCycleSchedule);
    const currentSelection = localClient.movementSelectionByCycle?.[selectedCycle]?.[lift] || currentDisplayName;
    const normalizedLift = normalizeMovementName(lift);
    const normalizedDisplay = normalizeMovementName(currentDisplayName);
    const normalizedSelection = normalizeMovementName(currentSelection);
    const normalizedTarget = normalizeMovementName(trimmed);

    if (normalizedSelection === normalizedTarget) {
      return;
    }

    const isDifferentMovementSelection = normalizedSelection !== normalizedTarget;
    const isCustomTargetMovement = normalizedTarget !== normalizedLift && normalizedTarget !== normalizedDisplay;
    const shouldForceCalibrationForSelection = isDifferentMovementSelection && isCustomTargetMovement;

    const aliases = [currentSelection, currentDisplayName, lift]
      .map((name) => name.trim())
      .filter((name, index, arr) => arr.findIndex((value) => normalizeMovementName(value) === normalizeMovementName(name)) === index);
    const aliasSet = new Set(aliases.map((name) => normalizeMovementName(name)));

    const sourceProfile =
      existingForCycle[lift] ||
      existingForCycle[currentSelection] ||
      existingForCycle[currentDisplayName] ||
      Object.entries(existingForCycle).find(([name]) => aliasSet.has(normalizeMovementName(name)))?.[1] ||
      {
        oneRepMax: mainLiftProfileSnapshots[lift].oneRepMax,
        trainingMax: mainLiftProfileSnapshots[lift].trainingMax,
        classType: resolveMovementClassType(trimmed, globalMovementSettings, lift),
        progressionIncrement: getDefaultMovementProgressionIncrement(trimmed, globalMovementSettings, lift),
        progressionHoldActive: false,
        movementCycleNumber: selectedCycle,
        calibrationPhaseActive: true,
      };

    const nextProfilesForCycle = { ...existingForCycle };
    for (const key of Object.keys(nextProfilesForCycle)) {
      if (aliasSet.has(normalizeMovementName(key)) && normalizeMovementName(key) !== normalizeMovementName(trimmed)) {
        delete nextProfilesForCycle[key];
      }
    }
    const existingTarget = Object.entries(nextProfilesForCycle).find(([name]) => normalizeMovementName(name) === normalizedTarget)?.[1];
    const isNewTargetMovement = !existingTarget;
    const resolvedProfile = existingTarget || sourceProfile;
    const targetClassType = existingTarget?.classType || resolveMovementClassType(trimmed, globalMovementSettings, lift);
    const targetProgressionIncrement =
      existingTarget?.progressionIncrement ||
      getDefaultMovementProgressionIncrement(trimmed, globalMovementSettings, lift);
    nextProfilesForCycle[trimmed] = {
      ...resolvedProfile,
      classType: targetClassType,
      progressionIncrement: targetProgressionIncrement,
      movementCycleNumber: selectedCycle,
      calibrationPhaseActive: shouldForceCalibrationForSelection || isNewTargetMovement
        ? true
        : Boolean(resolvedProfile.calibrationPhaseActive),
      progressionHoldActive: shouldForceCalibrationForSelection || isNewTargetMovement
        ? false
        : Boolean(resolvedProfile.progressionHoldActive),
      sourceWeekKey: shouldForceCalibrationForSelection || isNewTargetMovement
        ? undefined
        : resolvedProfile.sourceWeekKey,
    };

    setLocalClient({
      ...localClient,
      movementSelectionByCycle: {
        ...(localClient.movementSelectionByCycle || {}),
        [selectedCycle]: {
          ...(localClient.movementSelectionByCycle?.[selectedCycle] || {}),
          [lift]: trimmed,
        },
      },
      movementProfilesByCycle: {
        ...(localClient.movementProfilesByCycle || {}),
        [selectedCycle]: nextProfilesForCycle,
      },
      movementCalibrationsByCycle: {
        ...(localClient.movementCalibrationsByCycle || {}),
        [selectedCycle]: {
          ...(localClient.movementCalibrationsByCycle?.[selectedCycle] || {}),
          [lift]: {
            ...(localClient.movementCalibrationsByCycle?.[selectedCycle]?.[lift] || {}),
            needsCalibration: shouldForceCalibrationForSelection || isNewTargetMovement
              ? true
              : Boolean(localClient.movementCalibrationsByCycle?.[selectedCycle]?.[lift]?.needsCalibration),
          },
        },
      },
    });
  };

  const cycleMembershipOptions = useMemo(() => {
    const fromClient = localClient ? getEffectiveCycleMembership(localClient) : [];
    const merged = Array.from(new Set([...availableCycleNumbers, ...fromClient])).sort((a, b) => a - b);
    return merged;
  }, [availableCycleNumbers, localClient]);

  const handleCycleMembershipToggle = (cycleNumber: number, enabled: boolean) => {
    if (!localClient) return;

    const nextMembership = enabled
      ? Array.from(new Set([...(localClient.cycleMembership || []), cycleNumber])).sort((a, b) => a - b)
      : (localClient.cycleMembership || []).filter((value) => value !== cycleNumber);

    if (nextMembership.length === 0) return;

    setLocalClient({
      ...localClient,
      cycleMembership: nextMembership,
      currentCycleNumber: nextMembership.includes(localClient.currentCycleNumber || 0)
        ? localClient.currentCycleNumber
        : Math.max(...nextMembership),
    });
  };

  const handleSessionModeChange = (cycleNumber: number, weekKey: string, mode: SessionMode) => {
    if (!localClient) return;
    const currentCycleState = localClient.sessionStateByCycle?.[cycleNumber] || { mode: "normal" as SessionMode };
    const nextModeByWeek = {
      ...(currentCycleState.modeByWeek || {}),
      [weekKey]: mode,
    };

    const updatedSessionStateByCycle = {
      ...(localClient.sessionStateByCycle || {}),
      [cycleNumber]: {
        ...currentCycleState,
        modeByWeek: nextModeByWeek,
      },
    };

    setLocalClient({
      ...localClient,
      sessionStateByCycle: updatedSessionStateByCycle,
    });
  };

  const handleSessionWeekChange = (cycleNumber: number, weekKey: string, flowWeekKey: string) => {
    if (!localClient) return;
    const currentCycleState = localClient.sessionStateByCycle?.[cycleNumber] || { mode: "normal" as SessionMode };
    const nextFlowByWeek = {
      ...(currentCycleState.flowWeekKeyByWeek || {}),
      [weekKey]: flowWeekKey,
    };

    const updatedSessionStateByCycle = {
      ...(localClient.sessionStateByCycle || {}),
      [cycleNumber]: {
        ...currentCycleState,
        flowWeekKeyByWeek: nextFlowByWeek,
      },
    };

    setLocalClient({
      ...localClient,
      sessionStateByCycle: updatedSessionStateByCycle,
    });
  };

  const handleSave = async () => {
    if (localClient) {
      const effectiveMembership = getEffectiveCycleMembership(localClient);

      const cleanedAssignmentsByCycle: Record<number, Record<string, string>> = {};

      for (const [cycleKey, assignments] of Object.entries(localClient.weekAssignmentsByCycle || {})) {
        const cycleNumber = Number(cycleKey);
        if (Number.isNaN(cycleNumber)) continue;

        const normalized = normalizeAssignmentsForSettings(assignments || {}, cycleSettings);
        if (Object.keys(normalized).length > 0) {
          cleanedAssignmentsByCycle[cycleNumber] = normalized;
        }
      }

      const mainLiftOneRepMaxes = {} as Record<Lift, number>;
      const mainLiftTrainingMaxes = {} as Record<Lift, number>;

      for (const lift of Lifts) {
        mainLiftOneRepMaxes[lift] = mainLiftProfileSnapshots[lift]?.oneRepMax || 0;
        mainLiftTrainingMaxes[lift] = mainLiftProfileSnapshots[lift]?.trainingMax || 0;
      }

      const activeCycleNumber = localClient.currentCycleNumber || currentCycleNumber;
      const activeCycleOneRepMaxes = localClient.oneRepMaxesByCycle?.[activeCycleNumber] || localClient.oneRepMaxes;
      const activeCycleTrainingMaxes = localClient.trainingMaxesByCycle?.[activeCycleNumber] || localClient.trainingMaxes;

      const cycleOneRepMaxes = {
        ...(localClient.oneRepMaxesByCycle || {}),
        [selectedCycle]: mainLiftOneRepMaxes,
      };

      const existingMovementProfilesForCycle = localClient.movementProfilesByCycle?.[selectedCycle] || {};
      const mergedMovementProfilesForCycle = {
        ...existingMovementProfilesForCycle,
      };
      if (mergedMovementProfilesForCycle) {
        for (const entry of movementProfileEntries) {
          mergedMovementProfilesForCycle[entry.name] = {
            ...(existingMovementProfilesForCycle?.[entry.name] || {}),
            ...entry.profile,
          };
        }
        const selectedMovementMap = localClient.movementSelectionByCycle?.[selectedCycle] || {};
        for (const lift of Lifts) {
          const selectedMovementName = (selectedMovementMap[lift] || getLiftDisplayName(lift, selectedCycleSchedule)).trim();
          const displayName = getLiftDisplayName(lift, selectedCycleSchedule);
          const profileNames = [selectedMovementName, displayName, lift]
            .filter((name, index, arr) => arr.findIndex((value) => normalizeMovementName(value) === normalizeMovementName(name)) === index);

          const existingProfile =
            mergedMovementProfilesForCycle[selectedMovementName] ||
            mergedMovementProfilesForCycle[lift] ||
            mergedMovementProfilesForCycle[displayName] ||
            profileNames.map((profileName) => mergedMovementProfilesForCycle[profileName]).find(Boolean);
          const targetProfileName = selectedMovementName;

          for (const aliasName of profileNames) {
            if (normalizeMovementName(aliasName) !== normalizeMovementName(targetProfileName)) {
              delete mergedMovementProfilesForCycle[aliasName];
            }
          }

          const canExitCalibration = Boolean(existingProfile?.sourceWeekKey);
          const liftNeedsCalibration = Boolean(localClient.movementCalibrationsByCycle?.[selectedCycle]?.[lift]?.needsCalibration);
          mergedMovementProfilesForCycle[targetProfileName] = {
            ...(existingProfile || {}),
            oneRepMax: mainLiftOneRepMaxes[lift],
            trainingMax: mainLiftTrainingMaxes[lift],
            classType: existingProfile?.classType || resolveMovementClassType(targetProfileName, globalMovementSettings, lift),
            progressionIncrement:
              existingProfile?.progressionIncrement ||
              getDefaultMovementProgressionIncrement(targetProfileName, globalMovementSettings, lift),
            progressionHoldActive: existingProfile?.progressionHoldActive || false,
            movementCycleNumber: selectedCycle,
            calibrationPhaseActive: liftNeedsCalibration
              ? true
              : (canExitCalibration ? Boolean(existingProfile?.calibrationPhaseActive) : true),
            sourceWeekKey: existingProfile?.sourceWeekKey,
            lastUpdatedAt: new Date().toISOString(),
          };
        }
      }

      const clientToSave: Client = {
        ...localClient,
        currentCycleNumber: activeCycleNumber,
        cycleMembership: effectiveMembership,
        oneRepMaxesByCycle: cycleOneRepMaxes,
        oneRepMaxes: activeCycleOneRepMaxes,
        trainingMaxes: activeCycleTrainingMaxes,
        trainingMaxesByCycle: {
          ...(localClient.trainingMaxesByCycle || {}),
          [selectedCycle]: mainLiftTrainingMaxes,
        },
        weekAssignmentsByCycle: cleanedAssignmentsByCycle,
        sessionStateByCycle: localClient.sessionStateByCycle,
        movementSelectionByCycle: localClient.movementSelectionByCycle,
        movementProfilesByCycle: {
          ...(localClient.movementProfilesByCycle || {}),
          [selectedCycle]: mergedMovementProfilesForCycle,
        },
      };

      setIsSaving(true);
      await onUpdateClient(clientToSave);
      setTimeout(() => {
        setIsSaving(false);
        onOpenChange(false);
      }, 300);
    }
  };

  const handleClose = () => {
    if (!client) {
      setLocalClient(null);
      onOpenChange(false);
      return;
    }

    const cycleOneRepMaxes = client.oneRepMaxesByCycle?.[currentCycleNumber];
    setLocalClient({
      ...client,
      oneRepMaxes: cycleOneRepMaxes || client.oneRepMaxes,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!localClient) return;
    setIsDeleting(true);
    await onDeleteClient(localClient.id);
    setIsDeleting(false);
  };

  if (!localClient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{localClient.name} - Profile Settings</DialogTitle>
          <DialogDescription>
            View and manage client profile information, training maxes, and week assignments.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="1rm-progress" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="1rm-progress">Movement Profiles</TabsTrigger>
            <TabsTrigger value="week-assignments">Week Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="1rm-progress" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Core Lift Movement Profiles</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    This screen shows the four tracked lifts for this client in the selected cycle.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    To change cycle day assignments (Day 1/Day 2 movement slots), use Settings {"->"} Cycle Schedule.
                  </p>
                </div>
                <div className="space-y-1 sm:min-w-[220px]">
                  <Label className="text-xs">View Cycle</Label>
                  <Select value={selectedCycle.toString()} onValueChange={(value) => setSelectedCycle(parseInt(value, 10))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cycleOptions.map((cycle) => (
                        <SelectItem key={cycle} value={cycle.toString()}>
                          Cycle {cycle}
                          {cycle === currentCycleNumber ? " (Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {trackedMovementEntries.map(({ name, profile, trackedLift }) => (
                    <div key={trackedLift ? `tracked-${trackedLift}` : name} className="rounded-md border bg-background/80 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Movement</Label>
                            <Select
                              value={name}
                              onValueChange={(value) => handleTrackedMovementSelectionChange(trackedLift, value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(new Set([name, ...globalMovementOptions]))
                                  .filter(Boolean)
                                  .sort((a, b) => a.localeCompare(b))
                                  .map((option) => (
                                    <SelectItem key={`movement-option-${trackedLift}-${option}`} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">1RM</Label>
                            <Input
                              type="number"
                              min={1}
                              value={profile.oneRepMax}
                              onChange={(e) => handleMovementProfileChange(name, "oneRepMax", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">TM</Label>
                            <Input
                              type="number"
                              min={1}
                              value={profile.trainingMax}
                              onChange={(e) => handleMovementProfileChange(name, "trainingMax", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Progression</Label>
                            <Select
                              value={String(profile.progressionIncrement || 5)}
                              onValueChange={(value) => handleMovementProfileChange(name, "progressionIncrement", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2.5">2.5 lbs</SelectItem>
                                <SelectItem value="5">5 lbs</SelectItem>
                                <SelectItem value="7.5">7.5 lbs</SelectItem>
                                <SelectItem value="10">10 lbs</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                              {trackedLift} · {(selectedCycleSchedule?.liftDayAssignments?.[trackedLift] || "day1") === "day2" ? "Day 2" : "Day 1"}
                            </span>
                            {profile.calibrationPhaseActive || !profile.sourceWeekKey ? (
                              <span className="text-[11px] rounded-full bg-amber-100 text-amber-900 px-2 py-0.5">
                                Calibration required
                              </span>
                            ) : null}
                            <Button
                              type="button"
                              variant={profile.calibrationPhaseActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleMovementCalibrationToggle(name, !profile.calibrationPhaseActive)}
                              disabled={!profile.sourceWeekKey && !profile.calibrationPhaseActive}
                            >
                              {profile.calibrationPhaseActive ? "Calibrating" : "Stable"}
                            </Button>
                            <Button
                              type="button"
                              variant={profile.progressionHoldActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleMovementHoldToggle(name, !profile.progressionHoldActive)}
                              disabled={!profile.sourceWeekKey && profile.progressionHoldActive}
                            >
                              {profile.progressionHoldActive ? "Hold" : "Progressing"}
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground">Cycle #{selectedCycle}</span>
                        </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Lifts.map((lift) => {
                    const trackedEntry = trackedMovementByLift[lift];
                    const displayMovementName = trackedEntry?.name || getLiftDisplayName(lift, selectedCycleSchedule);
                    const snapshot = mainLiftProfileSnapshots[lift];
                    if (!snapshot || (snapshot.oneRepMax <= 0 && snapshot.trainingMax <= 0 && selectedCycle !== currentCycleNumber)) {
                      return (
                        <div key={lift} className="p-4 border rounded-lg space-y-2 bg-muted/20">
                          <h3 className="font-semibold">{displayMovementName}</h3>
                          <p className="text-sm text-muted-foreground">
                            This movement was not introduced in Cycle {selectedCycle} yet.
                          </p>
                        </div>
                      );
                    }

                    const actual1RM = snapshot.oneRepMax;
                    const trainingMax = snapshot.trainingMax;
                    const gap = actual1RM - trainingMax;
                    const gapPercent = actual1RM > 0 ? ((gap / actual1RM) * 100).toFixed(1) : "0.0";
                    
                    return (
                      <div key={lift} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{displayMovementName}</h3>
                          <div className="text-xs bg-muted px-2 py-1 rounded">
                            Gap: {gap} lbs ({gapPercent}%)
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground">Actual 1RM</Label>
                            <div className="text-2xl font-bold mt-1">{actual1RM} lbs</div>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground">Training Max (Auto 90%)</Label>
                            <div className="text-2xl font-bold mt-1">{trainingMax} lbs</div>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${(trainingMax / actual1RM) * 100}%` }}
                          />
                        </div>
                        <div className="h-[220px] w-full rounded-md border p-2">
                          <ClientProgressChart
                            data={progressChartDataByLift[lift] || []}
                            movementLabel={displayMovementName}
                            currentOneRepMax={actual1RM}
                            currentTrainingMax={trainingMax}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="week-assignments" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <CardTitle className="text-base">Cycle Week Assignments</CardTitle>
                <div className="space-y-1 sm:min-w-[220px]">
                  <Label className="text-xs">View Cycle</Label>
                  <Select value={selectedCycle.toString()} onValueChange={(value) => setSelectedCycle(parseInt(value, 10))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cycleOptions.map((cycle) => (
                        <SelectItem key={cycle} value={cycle.toString()}>
                          Cycle {cycle}
                          {cycle === currentCycleNumber ? " (Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-md border p-3">
                  <Label className="text-sm font-medium">Client Cycle Membership</Label>
                  <p className="text-xs text-muted-foreground">Checked cycles are where this client appears.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {cycleMembershipOptions.map((cycleNumber) => {
                      const checked = (localClient.cycleMembership || []).includes(cycleNumber);
                      return (
                        <label key={`membership-${cycleNumber}`} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => handleCycleMembershipToggle(cycleNumber, event.target.checked)}
                            className="h-4 w-4"
                          />
                          <span>Cycle {cycleNumber}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Assign the rep scheme for each week. Select N/A if the client skips that week.
                </p>

                <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                  <p className="text-sm font-medium">Session Mode (Per Week)</p>
                  <p className="text-xs text-muted-foreground">
                    Set each week independently. Slide can optionally target a specific flow week.
                  </p>
                </div>
                <div className="space-y-3">
                  {sortedWeekEntries.map(([weekKey, weekSettings]) => {
                    const globalRepScheme = getRepScheme(weekSettings.reps.workset3);
                    const cycleAssignments = localClient?.weekAssignmentsByCycle?.[selectedCycle] || {};
                    const clientAssignment = cycleAssignments[weekKey] || globalRepScheme;
                    const cycleSessionState = localClient.sessionStateByCycle?.[selectedCycle];
                    const weekMode =
                      cycleSessionState?.modeByWeek?.[weekKey] ||
                      cycleSessionState?.mode ||
                      "normal";
                    const currentWeekIndex = sortedWeekEntries.findIndex(([key]) => key === weekKey);
                    const availableSlideWeeks = currentWeekIndex > 0
                      ? sortedWeekEntries.slice(0, currentWeekIndex)
                      : [];
                    const fallbackSlideWeek = availableSlideWeeks.length > 0
                      ? availableSlideWeeks[availableSlideWeeks.length - 1][0]
                      : "";
                    const flowWeek =
                      cycleSessionState?.flowWeekKeyByWeek?.[weekKey] ||
                      cycleSessionState?.flowWeekKey ||
                      fallbackSlideWeek;
                    const canSlideBackward = availableSlideWeeks.length > 0;
                    const displayWeekMode: SessionMode =
                      !canSlideBackward && weekMode === "slide" ? "normal" : weekMode;
                    
                    return (
                      <div key={weekKey} className="p-3 border rounded-md">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                          <div className="space-y-1">
                            <Label className="text-xs">Week</Label>
                            <div className="h-10 rounded-md border px-3 flex items-center text-sm">
                              {weekSettings.name}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Reps</Label>
                            <Select
                              value={clientAssignment}
                              onValueChange={(value) => handleWeekAssignmentChange(selectedCycle, weekKey, value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={globalRepScheme}>{globalRepScheme}&apos;s (Default)</SelectItem>
                                {globalRepScheme !== "5" && <SelectItem value="5">5&apos;s</SelectItem>}
                                {globalRepScheme !== "3" && <SelectItem value="3">3&apos;s</SelectItem>}
                                {globalRepScheme !== "1" && <SelectItem value="1">1&apos;s</SelectItem>}
                                <SelectItem value="N/A">N/A (Skip)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Mode</Label>
                            <Select
                              value={displayWeekMode}
                              onValueChange={(value) => handleSessionModeChange(selectedCycle, weekKey, value as SessionMode)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                {canSlideBackward ? <SelectItem value="slide">Slide (Missed Session)</SelectItem> : null}
                                <SelectItem value="jack_shit">Jack Shit (Main Lift Only)</SelectItem>
                                <SelectItem value="pause_week">Pause Week (Skip)</SelectItem>
                                <SelectItem value="recovery">Recovery Day (No AMRAP/PR)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {displayWeekMode === "slide" ? (
                            <div className="space-y-1">
                              <Label className="text-xs">Use From</Label>
                              {availableSlideWeeks.length > 0 ? (
                                <Select
                                  value={flowWeek || availableSlideWeeks[availableSlideWeeks.length - 1][0]}
                                  onValueChange={(value) => handleSessionWeekChange(selectedCycle, weekKey, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableSlideWeeks.map(([flowWeekKey, flowWeekSettings]) => (
                                      <SelectItem key={flowWeekKey} value={flowWeekKey}>
                                        {flowWeekSettings?.name || flowWeekKey}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="h-10 rounded-md border px-3 flex items-center text-xs text-muted-foreground bg-muted/20">
                                  No prior week available
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          {isAdminMode && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSaving || isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete Client"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {localClient.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the client from your roster. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete Client
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}