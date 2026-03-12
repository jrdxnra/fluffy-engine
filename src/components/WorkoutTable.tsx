"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { CalculatedWorkout, CycleSettings, HistoricalRecord, Lift, WorkoutSet, LoggedSetMap } from "@/lib/types";
import { Eye, Copy } from "lucide-react";
import { logRepRecordAction } from "@/app/actions";
import { ClientNotesDialog } from "./ClientNotesDialog";
import type { Client } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveVisibleAccessories } from "@/lib/accessory-utils";
import { formatBasicWorkoutCopyText } from "@/lib/copy-formatter";

type WorkoutTableProps = {
  workouts: CalculatedWorkout[];
  lift: Lift;
  weekName: string;
  workoutDateLabel?: string;
  cycleSettings: CycleSettings;
  currentWeek: string;
  onRepRecordUpdate: (newRecord: HistoricalRecord) => void;
  buildCopyText?: (workout: CalculatedWorkout, defaultText: string) => string;
  currentCycleNumber: number;
  onPersistLoggedSets: (args: {
    clientId: string;
    weekKey: string;
    lift: Lift;
    setEntries: LoggedSetMap;
  }) => Promise<void>;
  layoutMode?: "horizontal" | "vertical";
  bulkLogAction?: {
    type: "open" | "save";
    token: number;
    targetLift: Lift;
  } | null;
  isBulkLoggingActive?: boolean;
  onBulkLogToggle?: () => void;
  showWarmups?: boolean;
};

type SetCellProps = {
  clientId: string;
  set: WorkoutSet;
  setIndex: number;
  lift: Lift;
  isTopSet: boolean;
  isExpanded: boolean;
  setInputs: { [key: string]: { weight: string; reps: string } };
  onSetInputChange: (setIndex: number, field: "weight" | "reps", value: string) => void;
  onSaveAll: () => void;
  isSaving: boolean;
  showRepBadge?: boolean;
  sizeMode?: "default" | "focused";
  inlineEditorMode?: "auto" | "alwaysWhenExpanded";
  platePosition?: "below" | "inline";
};

const SetCell = ({ 
  clientId, 
  set, 
  setIndex,
  lift, 
  isTopSet, 
  isExpanded,
  setInputs,
  onSetInputChange,
  onSaveAll,
  isSaving,
  showRepBadge = true,
  sizeMode = "default",
  inlineEditorMode = "auto",
  platePosition = "below",
}: SetCellProps) => {
  const setKey = `${setIndex}`;
  const input = setInputs[setKey] || { weight: "", reps: "" };

  const plateTokens = set.plates
    ? set.plates.split(",").map((token) => token.trim()).filter(Boolean)
    : [];

  const plateClassMap: Record<string, string> = {
    "45": "bg-[#2f6fe4] text-white border-[#1f4fb6]",
    "25": "bg-[#2fa35a] text-white border-[#1e7a43]",
    "10": "bg-[#1c1c1e] text-white border-black",
    "5": "bg-[#f8f8f9] text-black border-black",
    "2.5": "bg-[#c9ced6] text-black border-[#8a9099]",
  };
  const isFocusedSize = sizeMode === "focused";
  const showInlineEditor = isExpanded && (isFocusedSize || inlineEditorMode === "alwaysWhenExpanded");
  const showInlinePlates = platePosition === "inline";

  return (
    <div className="flex flex-col gap-1">
      <div className={`font-code font-bold text-foreground ${isFocusedSize ? "text-2xl" : "text-lg"} flex items-center gap-1.5 ${showInlineEditor ? "flex-nowrap" : "flex-wrap"}`}>
        <span>{set.weight} lbs</span>
        {showRepBadge ? (
          <Badge variant="secondary" className={`${isFocusedSize ? "text-sm px-2.5 py-0.5" : ""} font-sans`}>
            {set.reps} reps
          </Badge>
        ) : null}
        {showInlinePlates ? (
          <div className="flex flex-nowrap items-center gap-0.5 pl-2">
            {plateTokens.length > 0 ? plateTokens.map((plate, idx) => (
              <span
                key={`inline-${plate}-${idx}`}
                className={`inline-flex ${isFocusedSize ? "h-7 w-7 text-[10px]" : "h-5 w-5 text-[9px]"} shrink-0 items-center justify-center rounded-full border-2 font-sans font-bold tabular-nums leading-none antialiased ${plateClassMap[plate] || "bg-muted text-foreground border-border"}`}
                title={`${plate} lb plate`}
              >
                {plate}
              </span>
            )) : (
              <span className="text-[10px] text-muted-foreground">Bar</span>
            )}
          </div>
        ) : null}
        {showInlineEditor ? (
          <div className="ml-auto flex items-center border-l border-border/70 pl-3">
            <div className="flex w-[176px] items-center justify-end gap-2">
            <Input
              type="number"
              placeholder="lbs"
              className="h-8 w-20 text-sm font-code [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={input.weight}
              onChange={(e) => onSetInputChange(setIndex, "weight", e.target.value)}
              disabled={isSaving}
            />
            <Input
              type="number"
              placeholder="reps"
              className="h-8 w-14 text-right text-sm font-code [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={input.reps}
              onChange={(e) => onSetInputChange(setIndex, "reps", e.target.value)}
              disabled={isSaving}
            />
            </div>
          </div>
        ) : null}
      </div>
      {!showInlinePlates ? (
        <div className="text-xs text-muted-foreground font-code min-h-4">
          {plateTokens.length > 0 ? (
            <div className="flex flex-nowrap items-center gap-0.5">
              {plateTokens.map((plate, idx) => (
                <span
                  key={`${plate}-${idx}`}
                  className={`inline-flex ${isFocusedSize ? "h-8 w-8 text-[11px]" : "h-5 w-5 text-[9px]"} shrink-0 items-center justify-center rounded-full border-2 font-sans font-bold tabular-nums leading-none antialiased ${plateClassMap[plate] || "bg-muted text-foreground border-border"}`}
                  title={`${plate} lb plate`}
                >
                  {plate}
                </span>
              ))}
            </div>
          ) : (
            "Bar only"
          )}
        </div>
      ) : null}
      {isExpanded && !showInlineEditor && (
        <div className="mt-2 flex items-center gap-1.5 whitespace-nowrap">
          <Input
            type="number"
            placeholder="lbs"
            className={`${isFocusedSize ? "h-9 w-24 text-sm" : "h-7 w-16 text-xs"} font-code [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            value={input.weight}
            onChange={(e) => onSetInputChange(setIndex, "weight", e.target.value)}
            disabled={isSaving}
          />
          <Input
            type="number"
            placeholder="reps"
            className={`${isFocusedSize ? "h-9 w-16 text-sm" : "h-7 w-12 text-xs"} font-code [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            value={input.reps}
            onChange={(e) => onSetInputChange(setIndex, "reps", e.target.value)}
            disabled={isSaving}
          />
        </div>
      )}
    </div>
  );
};


export function WorkoutTable({ workouts, lift, weekName, workoutDateLabel, cycleSettings, currentWeek, onRepRecordUpdate, buildCopyText, currentCycleNumber, onPersistLoggedSets, layoutMode = "horizontal", bulkLogAction = null, isBulkLoggingActive = false, onBulkLogToggle, showWarmups = false }: WorkoutTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [clientNotes, setClientNotes] = useState<{ [key: string]: string }>({});
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [rowInputs, setRowInputs] = useState<{ [key: string]: { [key: string]: { weight: string; reps: string } } }>({});
  const [savingRows, setSavingRows] = useState<{ [key: string]: boolean }>({});
  const [actualByClientSet, setActualByClientSet] = useState<Record<string, Record<number, { weight: number; reps: number }>>>({});
  const [selectedWorkout, setSelectedWorkout] = useState<CalculatedWorkout | null>(null);
  const [focusedClientId, setFocusedClientId] = useState<string | null>(null);
  const { toast } = useToast();

  if (!workouts.length) {
    return <p>No clients on the roster. Add one to get started!</p>;
  }

  const getVisibleSetIndexes = (sets: WorkoutSet[]): number[] => {
    return sets
      .map((set, index) => ({ set, index }))
      .filter(({ set }) => showWarmups || set.type === "Work Set")
      .map(({ index }) => index);
  };

  const headerSource = workouts.find((workout) => getVisibleSetIndexes(workout.sets).length > 0) || workouts[0];
  const headerSets = (headerSource
    ? getVisibleSetIndexes(headerSource.sets).map((originalIndex) => {
        const set = headerSource.sets[originalIndex];
        return {
          label: set.label,
          type: set.type,
          set: set.set,
          reps: set.reps,
          originalIndex,
        };
      })
    : []);

  const sessionModeLabel: Record<string, string> = {
    normal: "Normal",
    slide: "Slide",
    jack_shit: "Jack Shit",
    pause_week: "Paused",
    recovery: "Recovery",
  };

  useEffect(() => {
    if (workouts.length === 0) {
      setFocusedClientId(null);
      return;
    }

    if (focusedClientId && !workouts.some((workout) => workout.client.id === focusedClientId)) {
      setFocusedClientId(null);
    }
  }, [workouts, focusedClientId]);

  const focusedIndex = focusedClientId
    ? workouts.findIndex((workout) => workout.client.id === focusedClientId)
    : -1;

  const handleNotesSaved = (clientId: string, notes: string) => {
    setClientNotes(prev => ({ ...prev, [clientId]: notes }));
  };

  const saveClientIfDirty = async (clientId: string) => {
    if (!hasSetData(clientId)) return;

    const workout = workouts.find((item) => item.client.id === clientId);
    if (!workout) return;

    const clientWeekKey = workout.effectiveWeekKey || currentWeek;
    const persistedSetMap =
      workout.client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};

    await handleSaveRowInputs(clientId, workout.sets, clientWeekKey, persistedSetMap);
  };

  const handleClientNameClick = (clientId: string) => {
    const isSameClient = focusedClientId === clientId;
    const previouslyFocused = focusedClientId;

    if (previouslyFocused) {
      void saveClientIfDirty(previouslyFocused);
    }

    if (isSameClient) {
      setFocusedClientId(null);
      setExpandedRows({});
      return;
    }

    setFocusedClientId(clientId);
    setExpandedRows({ [clientId]: true });
  };

  const handleSetInputChange = (clientId: string, setIndex: number, field: "weight" | "reps", value: string) => {
    const setKey = `${setIndex}`;
    setRowInputs(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [setKey]: {
          ...(prev[clientId]?.[setKey] || { weight: "", reps: "" }),
          [field]: value
        }
      }
    }));
  };

  // Check if there's any set data entered for a row
  const hasSetData = (clientId: string): boolean => {
    const rowData = rowInputs[clientId];
    if (!rowData) return false;
    return Object.values(rowData).some((input) =>
      (input.reps && input.reps.trim() !== "") ||
      (input.weight && input.weight.trim() !== "")
    );
  };

  const handleSaveRowInputs = async (
    clientId: string,
    sets: WorkoutSet[],
    effectiveWeekKey: string,
    persistedSetMap: LoggedSetMap
  ) => {
    const rowData = rowInputs[clientId];
    
    // If no data entered, silently close the row
    if (!hasSetData(clientId)) {
      setExpandedRows(prev => ({ ...prev, [clientId]: false }));
      return;
    }

    setSavingRows(prev => ({ ...prev, [clientId]: true }));
    const loggedSetActuals: Record<number, { weight: number; reps: number }> = {};
    const persistedSetEntries: LoggedSetMap = {};
    let attemptedCount = 0;
    let failedCount = 0;

    try {
      let successCount = 0;
      for (const [setIndex, input] of Object.entries(rowData)) {
        const hasRepsInput = !!input.reps && input.reps.trim() !== "";
        const hasWeightInput = !!input.weight && input.weight.trim() !== "";
        if (!hasRepsInput && !hasWeightInput) continue;

        const set = sets[parseInt(setIndex, 10)];
        if (!set) continue;

        const persisted = persistedSetMap[String(setIndex)];
        const fallbackReps =
          persisted?.reps ?? parseInt(String(set.reps).replace(/\D/g, ""), 10);
        const fallbackWeight = persisted?.weight ?? set.weight;
        const repCount = hasRepsInput ? parseInt(input.reps, 10) : fallbackReps;
        const actual = hasWeightInput ? parseInt(input.weight, 10) : fallbackWeight;

        if (isNaN(repCount) || repCount <= 0) {
          toast({ variant: "destructive", title: "Invalid input", description: `Invalid reps for ${set.label}` });
          continue;
        }
        if (isNaN(actual) || actual <= 0) {
          toast({ variant: "destructive", title: "Invalid weight", description: `Invalid weight for ${set.label}` });
          continue;
        }

        const parsedIndex = parseInt(setIndex, 10);
        if (!isNaN(parsedIndex)) {
          loggedSetActuals[parsedIndex] = { weight: actual, reps: repCount };
          persistedSetEntries[String(parsedIndex)] = {
            weight: actual,
            reps: repCount,
            updatedAt: new Date().toISOString(),
          };
        }

        attemptedCount++;
        try {
          const result = await logRepRecordAction(clientId, lift, actual, repCount);
          if (result.success) {
            successCount++;
            const newRecord: HistoricalRecord = {
              clientId,
              date: new Date().toISOString(),
              lift,
              weight: actual,
              reps: repCount,
              estimated1RM: Math.round(actual * (1 + repCount / 30)),
            };
            onRepRecordUpdate(newRecord);
          } else {
            failedCount++;
            toast({
              variant: "destructive",
              title: `Failed to log ${set.label}`,
              description: result.message || "Unable to save this set.",
            });
          }
        } catch {
          failedCount++;
          toast({
            variant: "destructive",
            title: `Failed to log ${set.label}`,
            description: "Network/server error while logging set.",
          });
        }
      }

      const snapshotCount = Object.keys(persistedSetEntries).length;
      if (snapshotCount > 0) {
        setActualByClientSet((prev) => ({
          ...prev,
          [clientId]: {
            ...(prev[clientId] || {}),
            ...loggedSetActuals,
          },
        }));
        if (successCount > 0) {
          toast({ title: "Saved!", description: `${successCount} set(s) logged.` });
        } else {
          toast({
            title: "Snapshot saved",
            description: "Entered set values were saved for View/Copy.",
          });
        }
        setRowInputs(prev => ({ ...prev, [clientId]: {} }));
        setExpandedRows(prev => ({ ...prev, [clientId]: false }));
        await onPersistLoggedSets({
          clientId,
          weekKey: effectiveWeekKey,
          lift,
          setEntries: persistedSetEntries,
        });
      } else if (attemptedCount > 0 && failedCount > 0) {
        toast({
          variant: "destructive",
          title: "No sets were saved",
          description: "Check the browser and server logs for details.",
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save sets." });
    } finally {
      setSavingRows(prev => ({ ...prev, [clientId]: false }));
    }
  };

  const openAllRows = () => {
    const nextExpanded: Record<string, boolean> = {};
    for (const { client, sets } of workouts) {
      if (sets.length > 0) {
        nextExpanded[client.id] = true;
      }
    }
    setExpandedRows(nextExpanded);
  };

  useEffect(() => {
    if (!bulkLogAction) return;
    if (bulkLogAction.targetLift !== lift) return;

    if (bulkLogAction.type === "open") {
      if (focusedClientId) {
        void saveClientIfDirty(focusedClientId);
      }
      setFocusedClientId(null);
      openAllRows();
      return;
    }

    if (focusedClientId) {
      void saveClientIfDirty(focusedClientId);
    }
    setFocusedClientId(null);

    const saveUpdatedRows = async () => {
      try {
        for (const { client, sets, effectiveWeekKey } of workouts) {
          if (sets.length === 0 || !hasSetData(client.id)) continue;

          const clientWeekKey = effectiveWeekKey || currentWeek;
          const persistedSetMap =
            client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};

          await handleSaveRowInputs(client.id, sets, clientWeekKey, persistedSetMap);
        }
      } finally {
        // Match row-level save behavior by collapsing everything after bulk save.
        setExpandedRows({});
      }
    };

    void saveUpdatedRows();
  }, [bulkLogAction, workouts, currentWeek, currentCycleNumber, lift]);

  useEffect(() => {
    if (!focusedClientId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      void saveClientIfDirty(focusedClientId);
      setFocusedClientId(null);
      setExpandedRows({});
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [focusedClientId]);

  const buildWorkoutText = (workout: CalculatedWorkout): string => {
    const effectiveWeekKey = workout.effectiveWeekKey || currentWeek;
    const accessories = resolveVisibleAccessories(cycleSettings, effectiveWeekKey, lift);
    const persistedSetMap =
      workout.client.loggedSetInputsByCycle?.[currentCycleNumber]?.[effectiveWeekKey]?.[lift] || {};

    return formatBasicWorkoutCopyText({
      lift,
      workoutDateLabel,
      sets: workout.sets,
      accessories,
      actualBySetIndex: actualByClientSet[workout.client.id],
      persistedSetMap,
    });
  };

  const getDisplayWorkoutText = (workout: CalculatedWorkout): string => {
    const defaultText = buildWorkoutText(workout);
    return buildCopyText ? buildCopyText(workout, defaultText) : defaultText;
  };

  const handleCopyWorkout = async (workout: CalculatedWorkout) => {
    try {
      const text = getDisplayWorkoutText(workout);
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${workout.client.name}'s workout copied to clipboard.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Could not copy workout. Try again.",
      });
    }
  };

  const getFocusedEdgeClass = (isFocused: boolean) =>
    isFocused
      ? "shadow-[inset_2px_0_0_0_hsl(var(--border)),inset_-2px_0_0_0_hsl(var(--border))]"
      : "shadow-[inset_1px_0_0_0_hsl(var(--border)/0.8),inset_-1px_0_0_0_hsl(var(--border)/0.8)]";

  const getColumnWidthStyle = (index: number, isFocused: boolean) => {
    const total = workouts.length;
    if (total <= 1) return { width: "100%" } as const;

    if (focusedIndex < 0) {
      return { width: `${100 / total}%` } as const;
    }

    const focusedShare =
      total === 2 ? 46 :
      total === 3 ? 35 :
      total === 4 ? 28 :
      24;
    const otherShare = (100 - focusedShare) / (total - 1);

    return { width: `${isFocused ? focusedShare : otherShare}%` } as const;
  };

  return (
    <div ref={containerRef} className="relative w-full rounded-lg border border-border/90 bg-card/85 shadow-sm" style={{ perspective: "1200px" }}>
      {layoutMode === "horizontal" ? (
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px] bg-muted/55">Client</TableHead>
            {headerSets.map((s, index) => (
              <TableHead key={index} className={`w-auto ${s.type === "Work Set" && s.set === 3 ? "text-primary" : ""}`}>
                <div className="leading-tight">
                  <div>{s.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{s.reps} reps</div>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {workouts.map(({ client, sets, prTarget, sessionMode, effectiveWeekKey }, rowIndex) => {
            const isExpanded = expandedRows[client.id] || false;
            const isSaving = savingRows[client.id] || false;
            const visibleSetIndexes = getVisibleSetIndexes(sets);
            const hasSets = visibleSetIndexes.length > 0;
            const isFocusedClient = client.id === focusedClientId;
            const isEffectivelyExpanded = isExpanded || isFocusedClient;
            const clientWeekKey = effectiveWeekKey || currentWeek;
            const persistedSetMap =
              client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};
            
            return (
            <Fragment key={client.id}>
            <TableRow
              className={`${isFocusedClient ? "relative z-10 bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]" : rowIndex % 2 === 0 ? "bg-accent/20" : "bg-muted/45 dark:bg-muted/30"}`}
            >
                <TableCell className="align-middle font-medium transition-colors duration-200">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleClientNameClick(client.id)}
                          className={`rounded-md py-1 font-bold text-foreground transition-[background-color,color] duration-200 dark:text-white ${isFocusedClient ? "px-2 bg-primary text-primary-foreground shadow-md text-lg" : "pl-0 pr-2 hover:bg-muted/70 text-base"}`}
                        >
                          {client.name}
                        </button>
                        {sessionMode && sessionMode !== "normal" && (
                          <Badge variant="outline" className="text-[10px]">
                            {sessionModeLabel[sessionMode] || sessionMode}
                          </Badge>
                        )}
                        {effectiveWeekKey && effectiveWeekKey !== weekName.toLowerCase().replace(" ", "") && (
                          <Badge variant="secondary" className="text-[10px]">
                            {effectiveWeekKey}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ClientNotesDialog
                          clientId={client.id}
                          clientName={client.name}
                          currentNotes={client.notes}
                          onNotesSaved={(notes) => handleNotesSaved(client.id, notes)}
                          compact
                          showLabel={false}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-8 p-0"
                          onClick={() => {
                            setSelectedWorkout({ client, sets, prTarget, sessionMode, effectiveWeekKey });
                          }}
                          disabled={!hasSets}
                          aria-label={`View ${client.name} workout`}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </TableCell>
                {hasSets ? visibleSetIndexes.map((originalIndex) => {
                  const set = sets[originalIndex];
                  const isTopSet = set.type === "Work Set" && set.set === 3;
                  return (
                    <TableCell key={originalIndex} className={`align-top ${isTopSet ? "bg-primary/10" : ""}`}>
                      <SetCell
                        clientId={client.id}
                        set={set}
                        setIndex={originalIndex}
                        lift={lift}
                        isTopSet={isTopSet}
                        isExpanded={isEffectivelyExpanded}
                        sizeMode="default"
                        inlineEditorMode="alwaysWhenExpanded"
                        showRepBadge={false}
                        platePosition="inline"
                        setInputs={{
                          ...Object.entries(persistedSetMap).reduce<Record<string, { weight: string; reps: string }>>((acc, [key, value]) => {
                            acc[key] = {
                              weight: String(value.weight),
                              reps: String(value.reps),
                            };
                            return acc;
                          }, {}),
                          ...(rowInputs[client.id] || {}),
                        }}
                        onSetInputChange={(setIndex, field, value) => 
                          handleSetInputChange(client.id, setIndex, field, value)
                        }
                        onSaveAll={() => handleSaveRowInputs(client.id, sets, clientWeekKey, persistedSetMap)}
                        isSaving={isSaving}
                      />
                    </TableCell>
                  );
                }) : (
                  <TableCell colSpan={Math.max(1, headerSets.length)} className="text-sm text-muted-foreground">
                    {sessionMode === "pause_week"
                      ? "Paused this week. Client resumes on selected flow week."
                      : "No work sets scheduled for this client in current mode."}
                  </TableCell>
                )}
              </TableRow>
            </Fragment>
            );
          })}
        </TableBody>
      </Table>
      ) : (
      <div className="overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[96px] text-left bg-gradient-to-r from-muted/80 to-accent/45">Set</TableHead>
              {workouts.map(({ client, sessionMode, effectiveWeekKey }, columnIndex) => {
                const isFocusedClient = client.id === focusedClientId;
                return (
                <TableHead
                  key={client.id}
                  className={`align-middle overflow-hidden transition-[width,background-color,opacity] duration-300 ease-in-out ${getFocusedEdgeClass(isFocusedClient)} ${isFocusedClient ? "bg-primary/10" : columnIndex % 2 !== 0 ? "bg-muted/50" : "bg-accent/35"}`}
                  style={getColumnWidthStyle(columnIndex, isFocusedClient)}
                >
                  <div className={`flex min-h-[56px] flex-col justify-center gap-1 transition-opacity duration-300 ${focusedIndex >= 0 && !isFocusedClient ? "opacity-90" : "opacity-100"}`}>
                    <div className="flex items-center justify-between gap-0.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleClientNameClick(client.id)}
                        className={`min-w-0 overflow-hidden whitespace-nowrap rounded-md py-1 text-left font-bold text-foreground transition-[background-color,color] duration-200 dark:text-white ${isFocusedClient ? "w-full px-2 bg-primary text-primary-foreground shadow-md text-base" : "pl-0 pr-0 hover:bg-muted/70 text-sm"}`}
                      >
                        {client.name}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <ClientNotesDialog
                          clientId={client.id}
                          clientName={client.name}
                          currentNotes={client.notes}
                          onNotesSaved={(notes) => handleNotesSaved(client.id, notes)}
                          compact={!isFocusedClient}
                          showLabel={isFocusedClient}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className={isFocusedClient ? "h-7 px-2 text-xs" : "h-7 w-7 p-0"}
                          onClick={() => {
                            const workout = workouts.find((item) => item.client.id === client.id);
                            if (!workout) return;
                            setSelectedWorkout(workout);
                          }}
                          aria-label={isFocusedClient ? undefined : `View ${client.name} workout`}
                        >
                          <Eye className={isFocusedClient ? "h-3 w-3 mr-1" : "h-3 w-3"} />
                          {isFocusedClient ? "View" : null}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {sessionMode && sessionMode !== "normal" && (
                        <Badge variant="outline" className="text-[10px]">
                          {sessionModeLabel[sessionMode] || sessionMode}
                        </Badge>
                      )}
                      {effectiveWeekKey && effectiveWeekKey !== weekName.toLowerCase().replace(" ", "") && (
                        <Badge variant="secondary" className="text-[10px]">
                          {effectiveWeekKey}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableHead>
              )})}
            </TableRow>
          </TableHeader>
          <TableBody>
            {headerSets.map((headerSet, setIndex) => {
              const isTopSet = headerSet.type === "Work Set" && headerSet.set === 3;
              return (
                <TableRow key={`${headerSet.label}-${setIndex}`}>
                  <TableCell className={`bg-gradient-to-r from-muted/80 to-accent/45 text-left font-medium text-xs ${isTopSet ? "bg-primary/10 text-primary" : ""}`}>
                    <div className="leading-tight">
                      <div className="whitespace-nowrap">{headerSet.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{headerSet.reps} reps</div>
                    </div>
                  </TableCell>
                  {workouts.map(({ client, sets, effectiveWeekKey, sessionMode }, columnIndex) => {
                    const isExpanded = expandedRows[client.id] || false;
                    const isSaving = savingRows[client.id] || false;
                    const isFocusedClient = client.id === focusedClientId;
                    const clientWeekKey = effectiveWeekKey || currentWeek;
                    const persistedSetMap =
                      client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};
                    const set = sets[headerSet.originalIndex];

                    if (!set) {
                      return (
                        <TableCell key={`${client.id}-${setIndex}`} className="text-xs text-muted-foreground">
                          <div
                            className={`rounded-md px-2 py-3 transition-colors duration-200 ${isFocusedClient ? "bg-primary/8" : "bg-accent/20"}`}
                          >
                            {sessionMode === "pause_week" ? "Paused" : "-"}
                          </div>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell
                        key={`${client.id}-${setIndex}`}
                        className={`${isFocusedClient ? "bg-primary/10" : isTopSet ? "bg-primary/10" : columnIndex % 2 !== 0 ? "bg-muted/40" : "bg-accent/25"} ${getFocusedEdgeClass(isFocusedClient)} align-top transition-[width,background-color,opacity] duration-300 ease-in-out`}
                        style={getColumnWidthStyle(columnIndex, isFocusedClient)}
                      >
                        <div className={`rounded-md px-2 py-2 transition-opacity duration-300 ${focusedIndex >= 0 && !isFocusedClient ? "opacity-90" : "opacity-100"}`}>
                          <SetCell
                            clientId={client.id}
                            set={set}
                            setIndex={headerSet.originalIndex}
                            lift={lift}
                            isTopSet={isTopSet}
                            isExpanded={isExpanded}
                            sizeMode={isFocusedClient ? "focused" : "default"}
                            setInputs={{
                              ...Object.entries(persistedSetMap).reduce<Record<string, { weight: string; reps: string }>>((acc, [key, value]) => {
                                acc[key] = {
                                  weight: String(value.weight),
                                  reps: String(value.reps),
                                };
                                return acc;
                              }, {}),
                              ...(rowInputs[client.id] || {}),
                            }}
                            onSetInputChange={(index, field, value) =>
                              handleSetInputChange(client.id, index, field, value)
                            }
                            onSaveAll={() => handleSaveRowInputs(client.id, sets, clientWeekKey, persistedSetMap)}
                            isSaving={isSaving}
                            showRepBadge={false}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}

      <Dialog open={!!selectedWorkout} onOpenChange={(open) => !open && setSelectedWorkout(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkout?.client.name} Workout
            </DialogTitle>
            <DialogDescription>
              Individual workout view for sharing with the client.
            </DialogDescription>
          </DialogHeader>
          {selectedWorkout && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-code">
                  {getDisplayWorkoutText(selectedWorkout)}
                </pre>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleCopyWorkout(selectedWorkout)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
