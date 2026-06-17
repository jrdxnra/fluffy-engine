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
import { calculateTrainingMaxes } from "@/lib/training-max";
import { getLiftDisplayName } from "@/lib/schedule";
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
  globalMovementSettings,
  currentGlobalWeek,
  currentCycleNumber = 1,
  availableCycleNumbers = [1, 2, 3, 4],
  historicalData,
  onUpdateClient,
  onResetTrainingMax,
  onDeleteClient,
}: ClientProfileModalProps) {
  const [localClient, setLocalClient] = useState<Client | null>(client);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingTM, setIsResettingTM] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<number>(currentCycleNumber);
  const [resetCycleNumber, setResetCycleNumber] = useState<number>(currentCycleNumber);
  const { isAdminMode } = useAdminModeContext();

  useEffect(() => {
    if (!client) {
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
    setResetCycleNumber(currentCycleNumber);
  }, [client, currentCycleNumber]);

  useEffect(() => {
    setResetCycleNumber(currentCycleNumber);
  }, [currentCycleNumber]);

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

  const handleOneRepMaxChange = (lift: Lift, value: string) => {
    if (!localClient) return;
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue <= 0) return;

    setLocalClient({
      ...localClient,
      oneRepMaxes: {
        ...localClient.oneRepMaxes,
        [lift]: numValue,
      },
    });
  };

  const movementProfileEntries = useMemo(() => {
    if (!localClient) return [] as Array<{ name: string; profile: MovementProfile }>;

    const cycleProfiles = localClient.movementProfilesByCycle?.[currentCycleNumber] || {};
    const mapped = new Map<string, { name: string; profile: MovementProfile }>();
    const cycleTrainingMaxes =
      (localClient.trainingMaxesByCycle?.[currentCycleNumber] || localClient.trainingMaxes);

    const addMovementEntry = (movementName: string, lift: Lift) => {
      const normalizedName = normalizeMovementName(movementName);
      if (mapped.has(normalizedName)) return;

      const existingProfile = Object.entries(cycleProfiles).find(
        ([profileName]) => normalizeMovementName(profileName) === normalizedName
      )?.[1];
      const isDisplayAlias = normalizedName !== normalizeMovementName(lift);
      const hasBaseNumbers = localClient.oneRepMaxes[lift] > 0 && cycleTrainingMaxes[lift] > 0;

      mapped.set(normalizedName, {
        name: movementName,
        profile: existingProfile || {
          oneRepMax: localClient.oneRepMaxes[lift],
          trainingMax: cycleTrainingMaxes[lift],
          classType: resolveMovementClassType(movementName, globalMovementSettings, lift),
          progressionIncrement: getDefaultMovementProgressionIncrement(movementName, globalMovementSettings, lift),
          progressionHoldActive: false,
          movementCycleNumber: currentCycleNumber,
          calibrationPhaseActive: isDisplayAlias ? true : !hasBaseNumbers,
        },
      });
    };

    for (const lift of Lifts) {
      const movementName = getLiftDisplayName(lift, currentCycleSchedule);
      addMovementEntry(lift, lift);
      addMovementEntry(movementName, lift);
    }

    for (const [profileName, profile] of Object.entries(cycleProfiles)) {
      const normalizedName = normalizeMovementName(profileName);
      if (!mapped.has(normalizedName)) {
        mapped.set(normalizedName, {
          name: profileName,
          profile,
        });
      }
    }

    return Array.from(mapped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [localClient, currentCycleNumber, currentCycleSchedule, globalMovementSettings]);

  const handleMovementProfileChange = (
    movementName: string,
    field: "oneRepMax" | "trainingMax" | "movementCycleNumber" | "progressionIncrement",
    value: string
  ) => {
    if (!localClient) return;
    const parsed = field === "progressionIncrement" ? Number(value) : parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    if (field === "progressionIncrement" && ![2.5, 5, 7.5, 10].includes(parsed)) return;

    const existingForCycle = localClient.movementProfilesByCycle?.[currentCycleNumber] || {};
    const normalizedMovementName = normalizeMovementName(movementName);
    const matchedLift = Lifts.find((lift) => normalizeMovementName(lift) === normalizedMovementName);
    const existing = existingForCycle[movementName] || {
      oneRepMax: 0,
      trainingMax: 0,
      classType: resolveMovementClassType(movementName, globalMovementSettings, matchedLift),
      progressionIncrement: getDefaultMovementProgressionIncrement(movementName, globalMovementSettings, matchedLift),
      progressionHoldActive: false,
      movementCycleNumber: currentCycleNumber,
      calibrationPhaseActive: true,
    };

    setLocalClient({
      ...localClient,
      movementProfilesByCycle: {
        ...(localClient.movementProfilesByCycle || {}),
        [currentCycleNumber]: {
          ...existingForCycle,
          [movementName]: {
            ...existing,
            [field]: parsed,
          },
        },
      },
    });
  };

  const handleMovementCalibrationToggle = (movementName: string, enabled: boolean) => {
    if (!localClient) return;
    const existingForCycle = localClient.movementProfilesByCycle?.[currentCycleNumber] || {};
    const existing = existingForCycle[movementName];
    if (!existing) return;

    setLocalClient({
      ...localClient,
      movementProfilesByCycle: {
        ...(localClient.movementProfilesByCycle || {}),
        [currentCycleNumber]: {
          ...existingForCycle,
          [movementName]: {
            ...existing,
            calibrationPhaseActive: enabled,
            progressionHoldActive: enabled ? false : existing.progressionHoldActive,
          },
        },
      },
    });
  };

  const handleMovementHoldToggle = (movementName: string, enabled: boolean) => {
    if (!localClient) return;
    const existingForCycle = localClient.movementProfilesByCycle?.[currentCycleNumber] || {};
    const existing = existingForCycle[movementName];
    if (!existing) return;

    setLocalClient({
      ...localClient,
      movementProfilesByCycle: {
        ...(localClient.movementProfilesByCycle || {}),
        [currentCycleNumber]: {
          ...existingForCycle,
          [movementName]: {
            ...existing,
            progressionHoldActive: enabled,
            calibrationPhaseActive: enabled ? false : existing.calibrationPhaseActive,
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
      const savedCycleNumber = effectiveMembership.length > 0
        ? (localClient.cycleMembership?.includes(currentCycleNumber || 0)
          ? currentCycleNumber
          : Math.max(...effectiveMembership))
        : undefined;

      const cleanedAssignmentsByCycle: Record<number, Record<string, string>> = {};

      for (const [cycleKey, assignments] of Object.entries(localClient.weekAssignmentsByCycle || {})) {
        const cycleNumber = Number(cycleKey);
        if (Number.isNaN(cycleNumber)) continue;

        const normalized = normalizeAssignmentsForSettings(assignments || {}, cycleSettings);
        if (Object.keys(normalized).length > 0) {
          cleanedAssignmentsByCycle[cycleNumber] = normalized;
        }
      }

      const cycleOneRepMaxes = savedCycleNumber
        ? {
            ...(localClient.oneRepMaxesByCycle || {}),
            [savedCycleNumber]: localClient.oneRepMaxes,
          }
        : localClient.oneRepMaxesByCycle;

      const existingMovementProfilesForCycle =
        savedCycleNumber ? localClient.movementProfilesByCycle?.[savedCycleNumber] || {} : undefined;
      const mergedMovementProfilesForCycle = savedCycleNumber
        ? {
            ...existingMovementProfilesForCycle,
          }
        : undefined;
      if (savedCycleNumber && mergedMovementProfilesForCycle) {
        for (const entry of movementProfileEntries) {
          mergedMovementProfilesForCycle[entry.name] = {
            ...(existingMovementProfilesForCycle?.[entry.name] || {}),
            ...entry.profile,
          };
        }

        const canonicalTrainingMaxes = calculateTrainingMaxes(localClient.oneRepMaxes);
        for (const lift of Lifts) {
          const displayName = getLiftDisplayName(lift, currentCycleSchedule);
          const profileNames = [lift, displayName]
            .filter((name, index, arr) => arr.findIndex((value) => normalizeMovementName(value) === normalizeMovementName(name)) === index);

          for (const profileName of profileNames) {
            const existingProfile = mergedMovementProfilesForCycle[profileName];
            mergedMovementProfilesForCycle[profileName] = {
              ...(existingProfile || {}),
              oneRepMax: localClient.oneRepMaxes[lift],
              trainingMax: canonicalTrainingMaxes[lift],
              classType: existingProfile?.classType || resolveMovementClassType(profileName, globalMovementSettings, lift),
              progressionIncrement:
                existingProfile?.progressionIncrement ||
                getDefaultMovementProgressionIncrement(profileName, globalMovementSettings, lift),
              progressionHoldActive: existingProfile?.progressionHoldActive || false,
              movementCycleNumber: savedCycleNumber,
              calibrationPhaseActive: false,
              sourceWeekKey: existingProfile?.sourceWeekKey,
              lastUpdatedAt: new Date().toISOString(),
            };
          }
        }
      }

      const clientToSave: Client = {
        ...localClient,
        currentCycleNumber: savedCycleNumber,
        cycleMembership: effectiveMembership,
        oneRepMaxesByCycle: cycleOneRepMaxes,
        oneRepMaxes: localClient.oneRepMaxes,
        trainingMaxes: calculateTrainingMaxes(localClient.oneRepMaxes),
        trainingMaxesByCycle: savedCycleNumber
          ? {
              ...(localClient.trainingMaxesByCycle || {}),
              [savedCycleNumber]: calculateTrainingMaxes(localClient.oneRepMaxes),
            }
          : localClient.trainingMaxesByCycle,
        weekAssignmentsByCycle: cleanedAssignmentsByCycle,
        sessionStateByCycle: localClient.sessionStateByCycle,
        movementProfilesByCycle: savedCycleNumber && mergedMovementProfilesForCycle
          ? {
              ...(localClient.movementProfilesByCycle || {}),
              [savedCycleNumber]: mergedMovementProfilesForCycle,
            }
          : localClient.movementProfilesByCycle,
      };

      setIsSaving(true);
      await onUpdateClient(clientToSave);
      setTimeout(() => {
        setIsSaving(false);
        onOpenChange(false);
      }, 300);
    }
  };

  const handleResetTM = async () => {
    if (!localClient) return;
    setIsResettingTM(true);
    await onResetTrainingMax(localClient.id, resetCycleNumber);
    setIsResettingTM(false);
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
            <TabsTrigger value="1rm-progress">1RM + Weights</TabsTrigger>
            <TabsTrigger value="week-assignments">Week Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="1rm-progress" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1RM Progress Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                    <p className="text-sm font-medium">Update Actual 1RM</p>
                    <p className="text-xs text-primary">Editing Cycle {currentCycleNumber} only. Previous cycles are preserved.</p>
                    <p className="text-xs text-muted-foreground">
                      Edit Actual 1RM below. Training Max is automatically calculated at 90% when you save.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {Lifts.map((lift) => {
                        const actual1RM = localClient.oneRepMaxes[lift];
                        const trainingMax = calculateTrainingMaxes(localClient.oneRepMaxes)[lift];

                        return (
                          <div key={lift} className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">{lift} Actual 1RM</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                value={actual1RM}
                                onChange={(e) => handleOneRepMaxChange(lift, e.target.value)}
                                className="w-28"
                              />
                              <span className="text-xs text-muted-foreground">lbs</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Auto TM: {trainingMax} lbs</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {isAdminMode && (
                    <div className="rounded-md border p-3 bg-muted/30">
                      <p className="text-sm font-medium">Stall / Reset Protocol (Current Cycle Only)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use this when a client stalls. Recalculate TM from recent performance starting at a selected cycle and apply forward.
                        This does not overwrite Actual 1RM values.
                      </p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Reset Starting At Cycle</Label>
                          <Select
                            value={resetCycleNumber.toString()}
                            onValueChange={(value) => setResetCycleNumber(parseInt(value, 10))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const cycleSet = new Set<number>([currentCycleNumber]);
                                Object.keys(localClient.trainingMaxesByCycle || {}).forEach((cycleKey) => {
                                  const n = parseInt(cycleKey, 10);
                                  if (!Number.isNaN(n)) cycleSet.add(n);
                                });

                                return Array.from(cycleSet)
                                  .sort((a, b) => a - b)
                                  .map((cycle) => (
                                    <SelectItem key={cycle} value={cycle.toString()}>
                                      Cycle {cycle}
                                    </SelectItem>
                                  ));
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        className="mt-3"
                        variant="outline"
                        onClick={handleResetTM}
                        disabled={isResettingTM || isSaving}
                      >
                        {isResettingTM ? "Resetting TM..." : `Reset From Cycle ${resetCycleNumber} Forward`}
                      </Button>
                      <p className="mt-2 text-[11px] text-muted-foreground">Applies to selected cycle and all later cycles.</p>
                    </div>
                  )}
                </div>
                <div className="rounded-md border p-3 bg-muted/30 space-y-3">
                  <p className="text-sm font-medium">Movement Recommendation Profiles (Cycle {currentCycleNumber})</p>
                  <p className="text-xs text-muted-foreground">
                    These values drive movement recommendations for this cycle. New movements like Incline update here from top-set AMRAP calibration.
                  </p>
                  <div className="space-y-3">
                    {movementProfileEntries.map(({ name, profile }) => (
                      <div key={name} className="rounded-md border bg-background/80 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Movement</Label>
                            <div className="h-10 rounded-md border px-3 flex items-center text-sm font-medium">
                              {name}
                            </div>
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
                            <Button
                              type="button"
                              variant={profile.calibrationPhaseActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleMovementCalibrationToggle(name, !profile.calibrationPhaseActive)}
                            >
                              {profile.calibrationPhaseActive ? "Calibrating" : "Stable"}
                            </Button>
                            <Button
                              type="button"
                              variant={profile.progressionHoldActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleMovementHoldToggle(name, !profile.progressionHoldActive)}
                            >
                              {profile.progressionHoldActive ? "Hold" : "Progressing"}
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground">Cycle #{profile.movementCycleNumber}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Lifts.map((lift) => {
                    const actual1RM = localClient.oneRepMaxes[lift];
                    const computedTrainingMaxes = calculateTrainingMaxes(localClient.oneRepMaxes);
                    const trainingMax = computedTrainingMaxes[lift];
                    const gap = actual1RM - trainingMax;
                    const gapPercent = ((gap / actual1RM) * 100).toFixed(1);
                    
                    return (
                      <div key={lift} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{lift}</h3>
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
                            lift={lift}
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
              <CardHeader>
                <CardTitle className="text-base">Cycle Week Assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Cycle</Label>
                  <Select
                    value={selectedCycle.toString()}
                    onValueChange={(value) => setSelectedCycle(parseInt(value, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Generate cycle options based on client's cycles */}
                      {localClient?.weekAssignmentsByCycle && 
                        Object.keys(localClient.weekAssignmentsByCycle).map((cycleKey) => (
                          <SelectItem key={cycleKey} value={cycleKey}>
                            Cycle {cycleKey}
                            {parseInt(cycleKey) === currentCycleNumber && " (Current)"}
                          </SelectItem>
                        ))}
                      {/* Always show current cycle option even if not yet set */}
                      {!localClient?.weekAssignmentsByCycle || !localClient.weekAssignmentsByCycle[selectedCycle] && (
                        <SelectItem value={selectedCycle.toString()}>
                          Cycle {selectedCycle} (Current)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

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
                                <SelectItem value={globalRepScheme}>{globalRepScheme}'s (Default)</SelectItem>
                                {globalRepScheme !== "5" && <SelectItem value="5">5's</SelectItem>}
                                {globalRepScheme !== "3" && <SelectItem value="3">3's</SelectItem>}
                                {globalRepScheme !== "1" && <SelectItem value="1">1's</SelectItem>}
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

        <div className="flex justify-between gap-2 pt-4">
          {isAdminMode && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSaving || isResettingTM || isDeleting}>
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
          <div className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}