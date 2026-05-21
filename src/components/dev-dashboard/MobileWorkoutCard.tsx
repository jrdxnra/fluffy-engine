"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Save, MoreVertical, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClientNotesDialog } from "@/components/ClientNotesDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RestTimerButton } from "@/components/dev-dashboard/RestTimerButton";
import { logRepRecordAction } from "@/app/actions";
import type {
  CalculatedWorkout,
  Client,
  HistoricalRecord,
  Lift,
  LoggedSetMap,
  WorkoutSet,
} from "@/lib/types";

type MobileWorkoutCardProps = {
  workout: CalculatedWorkout;
  lift: Lift;
  currentWeek: string;
  currentCycleNumber: number;
  showWarmups: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onPersistLoggedSets: (args: {
    clientId: string;
    weekKey: string;
    lift: Lift;
    setEntries: LoggedSetMap;
    removeSetIndexes?: string[];
  }) => Promise<void>;
  onRepRecordUpdate: (newRecord: HistoricalRecord) => void;
  onCopyText: (workout: CalculatedWorkout, lift: Lift) => string;
  historicalData: HistoricalRecord[];
  onOpenProfile: (client: Client) => void;
};

const plateColorMap: Record<string, string> = {
  "45": "bg-[#2f6fe4] text-white border-[#1f4fb6]",
  "25": "bg-[#2fa35a] text-white border-[#1e7a43]",
  "10": "bg-[#1c1c1e] text-white border-black",
  "5": "bg-[#f8f8f9] text-black border-black",
  "2.5": "bg-[#c9ced6] text-black border-[#8a9099]",
};

const sessionModeLabel: Record<string, string> = {
  normal: "Normal",
  slide: "Slide",
  jack_shit: "Jack Shit",
  pause_week: "Paused",
  recovery: "Recovery",
};

function PlateChips({ plates, size = "sm" }: { plates: string; size?: "sm" | "lg" }) {
  const tokens = plates.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return <span className="text-[10px] text-muted-foreground">Bar</span>;
  const dim = size === "lg" ? "h-6 w-6 text-[10px]" : "h-5 w-5 text-[9px]";
  return (
    <div className="flex items-center gap-0.5">
      {tokens.map((plate, i) => (
        <span
          key={i}
          className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full border-2 font-bold ${plateColorMap[plate] || "bg-muted text-foreground border-border"}`}
          title={`${plate} lb plate`}
        >
          {plate}
        </span>
      ))}
    </div>
  );
}

function formatActualSummary(weight?: number, reps?: number) {
  if (weight === undefined && reps === undefined) return null;
  return `${weight ?? "-"} lbs x ${reps ?? "-"}`;
}

export function MobileWorkoutCard({
  workout,
  lift,
  currentWeek,
  currentCycleNumber,
  showWarmups,
  isExpanded,
  onToggle,
  onPersistLoggedSets,
  onRepRecordUpdate,
  onCopyText,
  historicalData,
  onOpenProfile,
}: MobileWorkoutCardProps) {
  const { client, sets, prTarget, sessionMode, effectiveWeekKey } = workout;

  const topSet = sets.find((s) => s.type === "Work Set" && s.set === 3);
  const targetReps = topSet ? parseInt(String(topSet.reps).replace("+", ""), 10) : null;
  const lastLiftAtRepRange = targetReps
    ? historicalData
        .filter(
          (r) => r.clientId === client.id && r.lift === lift && r.reps === targetReps
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null
    : null;
  const { toast } = useToast();

  const [inputs, setInputs] = useState<Record<string, { weight: string; reps: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const prevExpandedRef = useRef(isExpanded);

  const clientWeekKey = effectiveWeekKey || currentWeek;
  const persistedSetMap: LoggedSetMap =
    client.loggedSetInputsByCycle?.[currentCycleNumber]?.[clientWeekKey]?.[lift] || {};

  const visibleSets: { set: WorkoutSet; originalIndex: number }[] = sets
    .map((set, index) => ({ set, index }))
    .filter(({ set }) => showWarmups || set.type === "Work Set")
    .map(({ set, index }) => ({ set, originalIndex: index }));

  const hasSets = visibleSets.length > 0;

  const getInput = (idx: number) => {
    const key = String(idx);
    if (inputs[key]) return inputs[key];
    const persisted = persistedSetMap[key];
    if (persisted) return { weight: String(persisted.weight), reps: String(persisted.reps) };
    return { weight: "", reps: "" };
  };

  const hasAnyInput = Object.values(inputs).some(
    (v) => (v.weight && v.weight.trim() !== "") || (v.reps && v.reps.trim() !== "")
  );

  const handleInputChange = (idx: number, field: "weight" | "reps", value: string) => {
    setInputs((prev) => ({
      ...prev,
      [String(idx)]: { ...getInput(idx), [field]: value },
    }));
  };

  const buildAndSave = async (silent = false) => {
    if (!hasAnyInput) return;
    setIsSaving(true);
    const setEntries: LoggedSetMap = {};
    let bestE1RM = 0;
    let bestWeight = 0;
    let bestReps = 0;

    try {
      for (const [key, input] of Object.entries(inputs)) {
        const hasW = input.weight && input.weight.trim() !== "";
        const hasR = input.reps && input.reps.trim() !== "";
        if (!hasW && !hasR) continue;

        const idx = parseInt(key, 10);
        const set = sets[idx];
        if (!set) continue;

        const persisted = persistedSetMap[key];
        const fallbackWeight = persisted?.weight ?? set.weight;
        const fallbackReps = persisted?.reps ?? parseInt(String(set.reps).replace(/\D/g, ""), 10);
        const actual = hasW ? parseInt(input.weight, 10) : fallbackWeight;
        const repCount = hasR ? parseInt(input.reps, 10) : fallbackReps;
        if (isNaN(actual) || actual <= 0 || isNaN(repCount) || repCount <= 0) continue;

        setEntries[key] = { weight: actual, reps: repCount, updatedAt: new Date().toISOString() };

        const e1RM = Math.round(actual * (1 + repCount / 30));
        if (e1RM > bestE1RM) {
          bestE1RM = e1RM;
          bestWeight = actual;
          bestReps = repCount;
        }
      }

      // Log only the best set to historical records — avoids multiple chart points per day
      let logged = false;
      if (bestE1RM > 0) {
        try {
          const result = await logRepRecordAction(client.id, lift, bestWeight, bestReps);
          if (result.success) {
            logged = true;
            onRepRecordUpdate({
              clientId: client.id,
              date: new Date().toISOString(),
              lift,
              weight: bestWeight,
              reps: bestReps,
              estimated1RM: bestE1RM,
            });
          }
        } catch {
          // snapshot still saves
        }
      }

      if (Object.keys(setEntries).length > 0) {
        await onPersistLoggedSets({ clientId: client.id, weekKey: clientWeekKey, lift, setEntries });
        setInputs({});
        if (!silent) {
          toast({
            title: logged ? "Saved!" : "Snapshot saved",
            description: logged ? "Best set logged to progress." : "Values saved for copy.",
          });
        }
      }
    } catch {
      if (!silent) toast({ variant: "destructive", title: "Error", description: "Failed to save sets." });
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save when card collapses with dirty inputs
  useEffect(() => {
    const wasExpanded = prevExpandedRef.current;
    prevExpandedRef.current = isExpanded;
    if (wasExpanded && !isExpanded && hasAnyInput) {
      void buildAndSave(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(onCopyText(workout, lift));
      toast({ title: "Copied", description: `${client.name}'s workout copied.` });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Could not copy." });
    }
  };

  // ── Paused ─────────────────────────────────────────────────────────────────
  if (sessionMode === "pause_week") {
    return (
      <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-bold text-foreground">{client.name}</span>
          <Badge variant="outline" className="text-[10px]">Paused</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Paused this week.</p>
      </div>
    );
  }

  // ── Notes dialog — always mounted so it works from both collapsed & expanded ──
  const notesDialog = (
    <ClientNotesDialog
      clientId={client.id}
      clientName={client.name}
      currentNotes={client.notes}
      onNotesSaved={() => {}}
      open={notesOpen}
      onOpenChange={setNotesOpen}
    />
  );

  // ── Collapsed ─────────────────────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div className="w-full rounded-xl border border-border bg-card/85 shadow-sm text-left transition-colors">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
            onClick={onToggle}
          >
            <span className="truncate text-base font-bold text-foreground">{client.name}</span>
            {sessionMode && sessionMode !== "normal" && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {sessionModeLabel[sessionMode] || sessionMode}
              </Badge>
            )}
          </div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setNotesOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Notes
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { void handleCopy(); }}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOpenProfile(client)}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {hasSets ? (
          <div className="divide-y divide-border/40 border-t border-border/40" onClick={onToggle}>
            {visibleSets.map(({ set, originalIndex }) => {
              const isTopSet = set.type === "Work Set" && set.set === 3;
              const persisted = persistedSetMap[String(originalIndex)];
              const actualSummary = formatActualSummary(persisted?.weight, persisted?.reps);
              const recommendedWeightLabel = set.weight > 0 ? `${set.weight} lbs` : "--";
              return (
                <div
                  key={originalIndex}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 ${isTopSet ? "bg-primary/8" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide ${isTopSet ? "text-primary" : "text-muted-foreground"}`}>
                        {set.label}
                      </span>
                      <span className={`font-code font-bold tabular-nums ${isTopSet ? "text-base" : "text-sm"} text-foreground`}>
                        {recommendedWeightLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">× {set.reps}</span>
                    </div>
                    {actualSummary ? (
                      <div className="mt-1 text-[11px] font-code text-muted-foreground">
                        A {actualSummary}
                      </div>
                    ) : null}
                  </div>
                  {set.plates ? <PlateChips plates={set.plates} size={isTopSet ? "lg" : "sm"} /> : <span className="text-[10px] text-muted-foreground">Bar</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cursor-pointer border-t border-border/40 px-4 py-2 text-sm text-muted-foreground" onClick={onToggle}>No sets scheduled.</div>
        )}
        {notesDialog}
      </div>
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-primary/50 bg-card/95 shadow-md ring-1 ring-primary/20">
      <div
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between rounded-t-xl border-b border-border/60 bg-primary/10 px-4 py-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-bold text-foreground">{client.name}</span>
          {sessionMode && sessionMode !== "normal" && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {sessionModeLabel[sessionMode] || sessionMode}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setNotesOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Notes
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void handleCopy(); }}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpenProfile(client)}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {notesDialog}

      {!hasSets ? (
        <div className="px-4 py-4 text-sm text-muted-foreground">No sets scheduled in current mode.</div>
      ) : (
        <div className="divide-y divide-border/50">
          {visibleSets.map(({ set, originalIndex }) => {
            const isTopSet = set.type === "Work Set" && set.set === 3;
            const input = getInput(originalIndex);
            const recommendedWeightLabel = set.weight > 0 ? `${set.weight} lbs` : "--";
            return (
              <div key={originalIndex} className={`px-4 py-3 ${isTopSet ? "bg-primary/8" : ""}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isTopSet ? "text-primary" : "text-muted-foreground"}`}>
                      {set.label}
                    </span>
                    <span className={`font-code font-bold tabular-nums ${isTopSet ? "text-lg" : "text-base"} text-foreground`}>
                      {recommendedWeightLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">× {set.reps}</span>
                  </div>
                  {set.plates ? <PlateChips plates={set.plates} size={isTopSet ? "lg" : "sm"} /> : <span className="text-[10px] text-muted-foreground">Bar</span>}
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Actual lbs</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={set.weight > 0 ? String(set.weight) : ""}
                      className="h-12 w-28 text-lg font-code [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={input.weight}
                      onChange={(e) => handleInputChange(originalIndex, "weight", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Reps done</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={String(set.reps).replace("+", "")}
                      className="h-12 w-20 text-right text-lg font-code [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={input.reps}
                      onChange={(e) => handleInputChange(originalIndex, "reps", e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastLiftAtRepRange && (
        <div className="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
          Last time: {lastLiftAtRepRange.reps} reps @ {lastLiftAtRepRange.weight} lbs
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-b-xl border-t border-border/60 bg-muted/20 px-4 py-3">
        <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5 px-3" onClick={handleCopy} disabled={!hasSets}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
        <RestTimerButton clientId={client.id} />
        <Button
          type="button"
          size="sm"
          className="h-10 gap-1.5 px-5 text-sm"
          onClick={() => void buildAndSave(false)}
          disabled={!hasAnyInput || isSaving}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
