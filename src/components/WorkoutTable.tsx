"use client";

import { useEffect, useState } from "react";
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
import { Check, ChevronRight, Eye, Copy } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-1">
      <div className="font-code font-bold text-lg text-foreground">
        {set.weight} lbs
        {showRepBadge ? (
          <Badge variant="secondary" className="ml-2 font-sans">
            {set.reps} reps
          </Badge>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground font-code min-h-5">
        {plateTokens.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {plateTokens.map((plate, idx) => (
              <span
                key={`${plate}-${idx}`}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-sans text-[10px] font-bold tabular-nums leading-none antialiased ${plateClassMap[plate] || "bg-muted text-foreground border-border"}`}
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
      {isExpanded && (
        <div className="mt-2 flex items-center gap-1.5 whitespace-nowrap">
          <Input
            type="number"
            placeholder="lbs"
            className="h-7 w-16 font-code text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={input.weight}
            onChange={(e) => onSetInputChange(setIndex, "weight", e.target.value)}
            disabled={isSaving}
          />
          <Input
            type="number"
            placeholder="reps"
            className="h-7 w-12 font-code text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={input.reps}
            onChange={(e) => onSetInputChange(setIndex, "reps", e.target.value)}
            disabled={isSaving}
          />
        </div>
      )}
    </div>
  );
};


export function WorkoutTable({ workouts, lift, weekName, workoutDateLabel, cycleSettings, currentWeek, onRepRecordUpdate, buildCopyText, currentCycleNumber, onPersistLoggedSets, layoutMode = "horizontal", bulkLogAction = null, isBulkLoggingActive = false, onBulkLogToggle }: WorkoutTableProps) {
  const [clientNotes, setClientNotes] = useState<{ [key: string]: string }>({});
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [rowInputs, setRowInputs] = useState<{ [key: string]: { [key: string]: { weight: string; reps: string } } }>({});
  const [savingRows, setSavingRows] = useState<{ [key: string]: boolean }>({});
  const [actualByClientSet, setActualByClientSet] = useState<Record<string, Record<number, { weight: number; reps: number }>>>({});
  const [selectedWorkout, setSelectedWorkout] = useState<CalculatedWorkout | null>(null);
  const { toast } = useToast();

  if (!workouts.length) {
    return <p>No clients on the roster. Add one to get started!</p>;
  }

  const headerSource = workouts.find((workout) => workout.sets.length > 0) || workouts[0];
  const headerSets = headerSource?.sets.map((s) => ({
    label: s.label,
    type: s.type,
    set: s.set,
    reps: s.reps,
  })) || [];

  const sessionModeLabel: Record<string, string> = {
    normal: "Normal",
    slide: "Slide",
    jack_shit: "Jack Shit",
    pause_week: "Paused",
    recovery: "Recovery",
  };

  const handleNotesSaved = (clientId: string, notes: string) => {
    setClientNotes(prev => ({ ...prev, [clientId]: notes }));
  };

  const handleToggleRow = (clientId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
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
      openAllRows();
      return;
    }

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

  return (
    <div className="border rounded-lg w-full">
      {layoutMode === "horizontal" ? (
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Client</TableHead>
            {headerSets.map((s, index) => (
              <TableHead key={index} className={`w-auto ${s.type === "Work Set" && s.set === 3 ? "text-primary" : ""}`}>
                {s.label}
              </TableHead>
            ))}
            <TableHead className="w-[132px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workouts.map(({ client, sets, prTarget, sessionMode, effectiveWeekKey }, rowIndex) => {
            const isExpanded = expandedRows[client.id] || false;
            const isSaving = savingRows[client.id] || false;
            const hasSets = sets.length > 0;
            const clientWeekKey = effectiveWeekKey || currentWeek;
            const persistedSetMap =
              client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};
            
            return (
            <TableRow key={client.id} className={rowIndex % 2 === 0 ? "" : "bg-slate-100 dark:bg-slate-800"}>
                <TableCell className="align-middle font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base">{client.name}</span>
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
                </TableCell>
                {hasSets ? sets.map((set, index) => {
                  const isTopSet = set.type === "Work Set" && set.set === 3;
                  return (
                    <TableCell key={index} className={`align-top ${isTopSet ? "bg-primary/10" : ""}`}>
                      <SetCell
                        clientId={client.id}
                        set={set}
                        setIndex={index}
                        lift={lift}
                        isTopSet={isTopSet}
                        isExpanded={isExpanded}
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
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <ClientNotesDialog
                      clientId={client.id}
                      clientName={client.name}
                      currentNotes={client.notes}
                      onNotesSaved={(notes) => handleNotesSaved(client.id, notes)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-24 justify-center text-xs"
                      onClick={() => {
                        setSelectedWorkout({ client, sets, prTarget, sessionMode, effectiveWeekKey });
                      }}
                      disabled={!hasSets}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant={isExpanded ? "default" : "outline"}
                      className="h-7 w-24 justify-center text-xs"
                      onClick={() => {
                        if (isExpanded) {
                          handleSaveRowInputs(client.id, sets, clientWeekKey, persistedSetMap);
                        } else {
                          handleToggleRow(client.id);
                        }
                      }}
                      disabled={isSaving || !hasSets}
                    >
                      {isExpanded ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-3 w-3 mr-1" />
                          Log Reps
                        </>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      ) : (
      <div className="overflow-x-auto">
        <Table className="table-fixed w-full min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[118px]">Set</TableHead>
              {workouts.map(({ client, sessionMode, effectiveWeekKey }) => (
                <TableHead key={client.id} className="align-middle">
                  <div className="flex min-h-[56px] flex-col justify-center gap-1">
                    <span className="font-bold text-sm">{client.name}</span>
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
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {headerSets.map((headerSet, setIndex) => {
              const isTopSet = headerSet.type === "Work Set" && headerSet.set === 3;
              return (
                <TableRow key={`${headerSet.label}-${setIndex}`}>
                  <TableCell className={`font-medium text-xs ${isTopSet ? "text-primary" : ""}`}>
                    <div className="leading-tight">
                      <div>{headerSet.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{headerSet.reps} reps</div>
                    </div>
                  </TableCell>
                  {workouts.map(({ client, sets, effectiveWeekKey, sessionMode }) => {
                    const isExpanded = expandedRows[client.id] || false;
                    const isSaving = savingRows[client.id] || false;
                    const clientWeekKey = effectiveWeekKey || currentWeek;
                    const persistedSetMap =
                      client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};
                    const set = sets[setIndex];

                    if (!set) {
                      return (
                        <TableCell key={`${client.id}-${setIndex}`} className="text-xs text-muted-foreground">
                          {sessionMode === "pause_week" ? "Paused" : "-"}
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell key={`${client.id}-${setIndex}`} className={isTopSet ? "bg-primary/10 align-top" : "align-top"}>
                        <SetCell
                          clientId={client.id}
                          set={set}
                          setIndex={setIndex}
                          lift={lift}
                          isTopSet={isTopSet}
                          isExpanded={isExpanded}
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
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}

            <TableRow>
              <TableCell className="font-medium text-xs">
                <div className="flex flex-col items-start gap-1">
                  <span>Action</span>
                  {onBulkLogToggle ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={isBulkLoggingActive ? "default" : "outline"}
                      className="h-7 px-2 text-[11px]"
                      onClick={onBulkLogToggle}
                    >
                      {isBulkLoggingActive ? "Save all Reps" : "Log all Reps"}
                    </Button>
                  ) : null}
                </div>
              </TableCell>
              {workouts.map(({ client, sets, prTarget, sessionMode, effectiveWeekKey }) => {
                const isExpanded = expandedRows[client.id] || false;
                const isSaving = savingRows[client.id] || false;
                const hasSets = sets.length > 0;
                const clientWeekKey = effectiveWeekKey || currentWeek;
                const persistedSetMap =
                  client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};

                return (
                  <TableCell key={`${client.id}-actions`}>
                    <div className="flex flex-wrap gap-1">
                      <ClientNotesDialog
                        clientId={client.id}
                        clientName={client.name}
                        currentNotes={client.notes}
                        onNotesSaved={(notes) => handleNotesSaved(client.id, notes)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setSelectedWorkout({ client, sets, prTarget, sessionMode, effectiveWeekKey });
                        }}
                        disabled={!hasSets}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant={isExpanded ? "default" : "outline"}
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          if (isExpanded) {
                            handleSaveRowInputs(client.id, sets, clientWeekKey, persistedSetMap);
                          } else {
                            handleToggleRow(client.id);
                          }
                        }}
                        disabled={isSaving || !hasSets}
                      >
                        {isExpanded ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Save
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-3 w-3 mr-1" />
                            Log Reps
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
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
