"use client";

import { useState, useEffect } from "react";
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
import type { Client, CycleSettings, SessionMode } from "@/lib/types";
import { Lifts } from "@/lib/types";

type ClientProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  cycleSettings: CycleSettings;
  currentGlobalWeek: string;
  currentCycleNumber?: number;
  onUpdateClient: (updatedClient: Client) => Promise<void> | void;
  onResetTrainingMax: (clientId: string) => Promise<void>;
};

const getRepScheme = (workset3Reps: string | number): string => {
  const repNum = typeof workset3Reps === 'string' 
    ? workset3Reps.replace(/\D/g, '')
    : workset3Reps.toString();
  return repNum || '?';
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
  currentGlobalWeek,
  currentCycleNumber = 1,
  onUpdateClient,
  onResetTrainingMax,
}: ClientProfileModalProps) {
  const [localClient, setLocalClient] = useState<Client | null>(client);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingTM, setIsResettingTM] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<number>(currentCycleNumber);

  // Sync local state when client prop changes
  useEffect(() => {
    setLocalClient(client);
  }, [client]);

  const handleWeightChange = (lift: string, value: string) => {
    if (!localClient) return;
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;

    setLocalClient({
      ...localClient,
      initialWeights: {
        ...localClient.initialWeights,
        [lift]: numValue,
      } as any,
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

  const handleSessionModeChange = (cycleNumber: number, mode: SessionMode) => {
    if (!localClient) return;
    const updatedSessionStateByCycle = {
      ...(localClient.sessionStateByCycle || {}),
      [cycleNumber]: {
        ...(localClient.sessionStateByCycle?.[cycleNumber] || {}),
        mode,
      },
    };

    setLocalClient({
      ...localClient,
      sessionStateByCycle: updatedSessionStateByCycle,
    });
  };

  const handleSessionWeekChange = (cycleNumber: number, flowWeekKey: string) => {
    if (!localClient) return;
    const updatedSessionStateByCycle = {
      ...(localClient.sessionStateByCycle || {}),
      [cycleNumber]: {
        ...(localClient.sessionStateByCycle?.[cycleNumber] || { mode: "normal" as SessionMode }),
        flowWeekKey,
      },
    };

    setLocalClient({
      ...localClient,
      sessionStateByCycle: updatedSessionStateByCycle,
    });
  };

  const handleSave = async () => {
    if (localClient) {
      const cleanedAssignmentsByCycle: Record<number, Record<string, string>> = {};

      for (const [cycleKey, assignments] of Object.entries(localClient.weekAssignmentsByCycle || {})) {
        const cycleNumber = Number(cycleKey);
        if (Number.isNaN(cycleNumber)) continue;

        const normalized = normalizeAssignmentsForSettings(assignments || {}, cycleSettings);
        if (Object.keys(normalized).length > 0) {
          cleanedAssignmentsByCycle[cycleNumber] = normalized;
        }
      }

      const clientToSave: Client = {
        ...localClient,
        weekAssignmentsByCycle: cleanedAssignmentsByCycle,
        sessionStateByCycle: localClient.sessionStateByCycle,
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
    await onResetTrainingMax(localClient.id);
    setIsResettingTM(false);
  };

  const handleClose = () => {
    setLocalClient(client);
    onOpenChange(false);
  };

  if (!localClient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{localClient.name} - Profile Settings</DialogTitle>
          <DialogDescription>
            View and manage client profile information, training maxes, and week assignments.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="initial-weights" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="initial-weights">Initial Weights</TabsTrigger>
            <TabsTrigger value="1rm-progress">1RM Progress</TabsTrigger>
            <TabsTrigger value="week-assignments">Week Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="initial-weights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Starting Weights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  These are the initial weights used as a baseline for calculating percentages.
                </p>
                {Lifts.map((lift) => (
                  <div key={lift} className="space-y-2">
                    <Label className="font-medium">{lift}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={localClient.initialWeights?.[lift] || localClient.trainingMaxes[lift]}
                        onChange={(e) => handleWeightChange(lift, e.target.value)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">lbs</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="1rm-progress" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1RM Progress Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Actual 1RMs vs Recommended Training Maxes (90% of 1RM). The gap shows room for improvement.
                </p>
                <div className="rounded-md border p-3 bg-muted/30">
                  <p className="text-sm font-medium">Stall / Reset Protocol</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use this when a client stalls. We recalculate each lift from recent performance and set a new TM at 90%.
                  </p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={handleResetTM}
                    disabled={isResettingTM || isSaving}
                  >
                    {isResettingTM ? "Resetting TM..." : "Reset TM from Recent Performance"}
                  </Button>
                </div>
                <div className="space-y-4">
                  {Lifts.map((lift) => {
                    const actual1RM = localClient.oneRepMaxes[lift];
                    // Get training max for current cycle, fallback to default
                    const trainingMax = localClient.trainingMaxesByCycle?.[currentCycleNumber]?.[lift] ?? localClient.trainingMaxes[lift];
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
                            <Label className="text-xs font-medium text-muted-foreground">Training Max (Cycle {currentCycleNumber})</Label>
                            <div className="text-2xl font-bold mt-1">{trainingMax} lbs</div>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${(trainingMax / actual1RM) * 100}%` }}
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

                <p className="text-sm text-muted-foreground">
                  Assign the rep scheme for each week. Select N/A if the client skips that week.
                </p>

                <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                  <p className="text-sm font-medium">Session Mode (Per Client)</p>
                  <p className="text-xs text-muted-foreground">
                    Handle missed sessions, short sessions, pause weeks, and recovery days without breaking the team flow.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Mode</Label>
                      <Select
                        value={localClient.sessionStateByCycle?.[selectedCycle]?.mode || "normal"}
                        onValueChange={(value) => handleSessionModeChange(selectedCycle, value as SessionMode)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="slide">Slide (Missed Session)</SelectItem>
                          <SelectItem value="jack_shit">Jack Shit (Main Lift Only)</SelectItem>
                          <SelectItem value="pause_week">Pause Week (Skip)</SelectItem>
                          <SelectItem value="recovery">Recovery Day (No AMRAP/PR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Flow Week</Label>
                      <Select
                        value={localClient.sessionStateByCycle?.[selectedCycle]?.flowWeekKey || currentGlobalWeek}
                        onValueChange={(value) => handleSessionWeekChange(selectedCycle, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(cycleSettings)
                            .sort((a, b) => {
                              const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
                              const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
                              return aNum - bNum;
                            })
                            .map((weekKey) => (
                              <SelectItem key={weekKey} value={weekKey}>
                                {cycleSettings[weekKey]?.name || weekKey}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {Object.entries(cycleSettings).map(([weekKey, weekSettings]) => {
                    const globalRepScheme = getRepScheme(weekSettings.reps.workset3);
                    const cycleAssignments = localClient?.weekAssignmentsByCycle?.[selectedCycle] || {};
                    const clientAssignment = cycleAssignments[weekKey] || globalRepScheme;
                    
                    return (
                      <div key={weekKey} className="flex items-center gap-4 p-3 border rounded-md">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{weekSettings.name}</p>
                          <p className="text-xs text-muted-foreground">Global: ({globalRepScheme})</p>
                        </div>
                        <Select
                          value={clientAssignment}
                          onValueChange={(value) => handleWeekAssignmentChange(selectedCycle, weekKey, value)}
                        >
                          <SelectTrigger className="w-32">
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
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
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