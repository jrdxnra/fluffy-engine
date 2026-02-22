"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, Trash2, Pencil, Check, X, ArrowUp, ArrowDown, Plus, Eye, EyeOff } from "lucide-react";
import type { CycleScheduleSettings, CycleSettings, Lift } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { getEffectiveCycleSchedule } from "@/lib/schedule";

const percentageDisplayOrder = ["workset3", "workset2", "workset1", "warmup2", "warmup1"] as const;

type CycleInfo = {
  cycleNumber: number;
  name: string;
};

type ConfigSettingsDialogProps = {
  cycleSettings: CycleSettings;
  onUpdateCycleSettings: (settings: CycleSettings) => void;
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>;
  onUpdateCycleSchedule?: (cycleNumber: number, schedule: CycleScheduleSettings) => Promise<void>;
  currentWeekKey?: string;
  cycles?: CycleInfo[];
  currentCycleNumber?: number;
  onRenameCycle?: (cycleNumber: number, newName: string) => void;
  onDeleteCycle?: (cycleNumber: number) => Promise<void>;
  onCycleChange?: (cycleNumber: number) => void;
};

export function ConfigSettingsDialog({
  cycleSettings,
  onUpdateCycleSettings,
  cycleSchedulesByCycle = {},
  onUpdateCycleSchedule,
  currentWeekKey = "week1",
  cycles = [],
  currentCycleNumber = 1,
  onRenameCycle,
  onDeleteCycle,
  onCycleChange,
}: ConfigSettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<CycleSettings>(cycleSettings);
  const [editingCycleId, setEditingCycleId] = useState<number | null>(null);
  const [editingCycleName, setEditingCycleName] = useState("");
  const [cycleToDelete, setCycleToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogCycleNumber, setDialogCycleNumber] = useState<number>(currentCycleNumber);
  const [isLoadingScheduleDebug, setIsLoadingScheduleDebug] = useState(false);
  const [scheduleDebugOutput, setScheduleDebugOutput] = useState<string>("");
  const [scheduleDebugSummary, setScheduleDebugSummary] = useState<string>("");
  const { toast } = useToast();
  const weekdayOptions: Array<CycleScheduleSettings["day1Weekday"]> = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Sync localSettings when cycleSettings prop changes
  useEffect(() => {
    setLocalSettings(cycleSettings);
  }, [cycleSettings]);

  // Sync dialog cycle number when currentCycleNumber changes externally
  useEffect(() => {
    setDialogCycleNumber(currentCycleNumber);
  }, [currentCycleNumber]);

  // Reset dialog cycle number if it's no longer in available cycles
  useEffect(() => {
    if (cycles.length > 0) {
      const cycleExists = cycles.some(c => c.cycleNumber === dialogCycleNumber);
      if (!cycleExists) {
        const validCycle = cycles[0].cycleNumber;
        setDialogCycleNumber(validCycle);
        // Also notify parent to switch main page to valid cycle
        if (onCycleChange) {
          onCycleChange(validCycle);
        }
      }
    }
  }, [cycles]);

  const handleStartEditCycle = (cycle: CycleInfo) => {
    setEditingCycleId(cycle.cycleNumber);
    setEditingCycleName(cycle.name);
  };

  const handleSaveCycleName = (cycleNumber: number) => {
    if (onRenameCycle && editingCycleName.trim()) {
      onRenameCycle(cycleNumber, editingCycleName.trim());
    }
    setEditingCycleId(null);
    setEditingCycleName("");
  };

  const handleCancelEditCycle = () => {
    setEditingCycleId(null);
    setEditingCycleName("");
  };

  const handleConfirmDelete = async () => {
    if (!cycleToDelete || !onDeleteCycle) return;
    
    console.log("🗑️  Confirming delete for cycle:", cycleToDelete);
    
    setIsDeleting(true);
    let deletedCycleNumber = cycleToDelete;
    
    try {
      // Await the async delete operation
      console.log("🔄 Calling onDeleteCycle...");
      await onDeleteCycle(cycleToDelete);
      console.log("✅ onDeleteCycle completed");
      
      // If we deleted the current dialog cycle, reset to Cycle 1
      if (deletedCycleNumber === dialogCycleNumber) {
        console.log(`Was viewing cycle ${dialogCycleNumber}, resetting to Cycle 1`);
        setDialogCycleNumber(1);
      }
      
      // Reset editing state
      setEditingCycleId(null);
      setEditingCycleName("");
      
      // Show toast
      toast({
        title: "Cycle Deleted",
        description: `Cycle ${deletedCycleNumber} has been deleted successfully.`,
      });
      
      // Close the alert dialog
      setCycleToDelete(null);
    } catch (error) {
      console.error("Error during delete:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete cycle.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCycle = (cycleNumber: number) => {
    console.log("Config Dialog: Delete button clicked for cycle:", cycleNumber);
    setCycleToDelete(cycleNumber);
  };

  const handleCycleChange = (cycleNumber: number) => {
    // Only change if this cycle exists
    const cycleExists = cycles.some(c => c.cycleNumber === cycleNumber);
    if (cycleExists) {
      setDialogCycleNumber(cycleNumber);
      if (onCycleChange) {
        onCycleChange(cycleNumber);
      }
    }
  };

  const getCurrentCycleSchedule = (): CycleScheduleSettings => {
    return getEffectiveCycleSchedule(cycleSchedulesByCycle[dialogCycleNumber]);
  };

  const handleSchedulePatch = async (patch: Partial<CycleScheduleSettings>) => {
    if (!onUpdateCycleSchedule) return;
    const current = getCurrentCycleSchedule();
    await onUpdateCycleSchedule(dialogCycleNumber, {
      ...current,
      ...patch,
    });
  };

  const handleLoadScheduleDebug = async () => {
    setIsLoadingScheduleDebug(true);
    try {
      const params = new URLSearchParams({
        cycle: String(dialogCycleNumber),
        week: currentWeekKey || "week1",
        lift: "Deadlift",
      });
      const response = await fetch(`/api/debug-cycle-schedule?${params.toString()}`);
      const data = await response.json();
      const computed = data?.computed;
      const weekSchedule = computed?.weekSchedule;
      const cycleSchedule = computed?.cycleSchedule;
      const selectedLiftDate = computed?.selectedLiftDate || "—";
      const allWeekSchedules: Array<{
        weekKey: string;
        day1Date?: string;
        day2Date?: string;
      }> = computed?.allWeekSchedules || [];
      const allWeeksLines = allWeekSchedules.length
        ? [
            "",
            "All Weeks:",
            ...allWeekSchedules.map((entry) =>
              `- ${entry.weekKey}: day1=${entry.day1Date || "—"}, day2=${entry.day2Date || "—"}`
            ),
          ]
        : [];

      const summaryLines = [
        `Cycle: ${computed?.cycleNumber ?? dialogCycleNumber}`,
        `Week: ${computed?.weekKey ?? currentWeekKey}`,
        `Lift: ${computed?.lift ?? "Deadlift"}`,
        `Start Date: ${cycleSchedule?.cycleStartDate || "unset"}`,
        `Day 1: ${weekSchedule?.day1Weekday || "—"} (${weekSchedule?.day1Date || "—"})`,
        `Day 2: ${weekSchedule?.day2Weekday || "—"} (${weekSchedule?.day2Date || "—"})`,
        `Lift Slot: ${computed?.liftDaySlot || "—"}`,
        `Selected Lift Date: ${selectedLiftDate}`,
        ...allWeeksLines,
      ];

      setScheduleDebugSummary(summaryLines.join("\n"));
      setScheduleDebugOutput(JSON.stringify(data, null, 2));
    } catch (error) {
      setScheduleDebugSummary(`Debug fetch failed: ${String(error)}`);
      setScheduleDebugOutput(JSON.stringify({ success: false, error: String(error) }, null, 2));
    } finally {
      setIsLoadingScheduleDebug(false);
    }
  };

  const handlePercentageChange = (
    weekKey: string,
    setType: string,
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 1) return;

    setLocalSettings((prev) => ({
      ...prev,
      [weekKey]: {
        ...prev[weekKey],
        percentages: {
          ...prev[weekKey].percentages,
          [setType]: numValue,
        },
      },
    }));
  };

  const handleAccessoryItemChange = (
    weekKey: string,
    lift: Lift,
    index: number,
    value: string
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      [weekKey]: {
        ...prev[weekKey],
        accessories: {
          ...prev[weekKey].accessories,
          [lift]: (prev[weekKey].accessories?.[lift] || [""]).map((item, i) => i === index ? value : item),
        },
        accessoryVisibility: {
          ...(prev[weekKey].accessoryVisibility || {}),
          [lift]: (() => {
            const visibility = { ...(prev[weekKey].accessoryVisibility?.[lift] || {}) };
            const oldName = (prev[weekKey].accessories?.[lift] || [""])[index] || "";
            if (oldName && oldName !== value && Object.prototype.hasOwnProperty.call(visibility, oldName)) {
              visibility[value] = visibility[oldName];
              delete visibility[oldName];
            }
            return visibility;
          })(),
        },
      },
    }));
  };

  const isAccessoryVisible = (weekKey: string, lift: Lift, name: string): boolean => {
    if (!name.trim()) return true;
    const visibilityMap = localSettings[weekKey]?.accessoryVisibility?.[lift] || {};
    const hasCustomVisibility = Object.keys(visibilityMap).length > 0;
    if (!hasCustomVisibility) return true;
    return visibilityMap[name] === true;
  };

  const handleAccessoryVisibilityToggle = (
    weekKey: string,
    lift: Lift,
    name: string
  ) => {
    if (!name.trim()) return;

    setLocalSettings((prev) => {
      const currentExercises = prev[weekKey].accessories?.[lift] || [];
      const currentMap = { ...(prev[weekKey].accessoryVisibility?.[lift] || {}) };
      const hasCustomVisibility = Object.keys(currentMap).length > 0;

      let nextMap: Record<string, boolean>;
      if (!hasCustomVisibility) {
        nextMap = {};
        for (const exercise of currentExercises) {
          if (exercise.trim()) {
            nextMap[exercise] = false;
          }
        }
        nextMap[name] = true;
      } else {
        nextMap = {
          ...currentMap,
          [name]: !(currentMap[name] === true),
        };
      }

      return {
        ...prev,
        [weekKey]: {
          ...prev[weekKey],
          accessoryVisibility: {
            ...(prev[weekKey].accessoryVisibility || {}),
            [lift]: {
              ...nextMap,
            },
          },
        },
      };
    });
  };

  const handleAccessoryAddItem = (
    weekKey: string,
    lift: Lift,
    afterIndex?: number
  ) => {
    setLocalSettings((prev) => {
      const current = prev[weekKey].accessories?.[lift] || [];
      const withBase = current.length > 0 ? current : [""];
      const next =
        afterIndex === undefined
          ? [...withBase, ""]
          : [
              ...withBase.slice(0, afterIndex + 1),
              "",
              ...withBase.slice(afterIndex + 1),
            ];

      return {
        ...prev,
        [weekKey]: {
          ...prev[weekKey],
          accessories: {
            ...prev[weekKey].accessories,
            [lift]: next,
          },
        },
      };
    });
  };

  const handleAccessoryRemoveItem = (
    weekKey: string,
    lift: Lift,
    index: number
  ) => {
    setLocalSettings((prev) => {
      const current = prev[weekKey].accessories?.[lift] || [];
      const withBase = current.length > 0 ? current : [""];
      const next = withBase.length <= 1 ? [""] : withBase.filter((_, i) => i !== index);

      return {
        ...prev,
        [weekKey]: {
          ...prev[weekKey],
          accessories: {
            ...prev[weekKey].accessories,
            [lift]: next,
          },
        },
      };
    });
  };

  const handleAccessoryMoveItem = (
    weekKey: string,
    lift: Lift,
    index: number,
    direction: "up" | "down"
  ) => {
    setLocalSettings((prev) => {
      const current = prev[weekKey].accessories?.[lift] || [];
      const withBase = current.length > 0 ? current : [""];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= withBase.length) return prev;

      const next = [...withBase];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;

      return {
        ...prev,
        [weekKey]: {
          ...prev[weekKey],
          accessories: {
            ...prev[weekKey].accessories,
            [lift]: next,
          },
        },
      };
    });
  };

  const handleSave = () => {
    onUpdateCycleSettings(localSettings);
    setIsOpen(false);
  };

  const handleClose = () => {
    setLocalSettings(cycleSettings);
    setIsOpen(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full h-12 w-12 shadow-lg"
          title="Configuration Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuration Settings</DialogTitle>
          <DialogDescription>
            Manage cycle settings, week percentages, and cycle information.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="weeks" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="weeks">Week Settings</TabsTrigger>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="weeks" className="space-y-4">
            {Object.keys(localSettings).length === 0 ? (
              <p className="text-sm text-muted-foreground">No week settings available.</p>
            ) : (
              <Tabs defaultValue="week1" className="w-full">
                <TabsList
                  className="grid w-full gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, Object.keys(localSettings).length)}, minmax(0, 1fr))`,
                  }}
                >
                  {Object.keys(localSettings)
                    .sort((a, b) => {
                      const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
                      const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
                      return aNum - bNum;
                    })
                    .map((weekKey) => (
                    <TabsTrigger key={weekKey} value={weekKey} className="px-2 text-xs sm:text-sm">
                      {localSettings[weekKey].name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(localSettings)
                  .sort(([a], [b]) => {
                    const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
                    const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
                    return aNum - bNum;
                  })
                  .map(([weekKey, weekSettings]) => (
                <TabsContent key={weekKey} value={weekKey} className="space-y-4">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Percentages</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {percentageDisplayOrder.map((setType) => {
                          const percentage = weekSettings.percentages[setType];
                          if (percentage === undefined) return null;
                          return (
                            <div key={setType} className="flex items-center gap-4">
                              <Label className="w-32 capitalize">
                                {setType.replace(/([A-Z])/g, " $1").trim()}:
                              </Label>
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={percentage}
                                  onChange={(e) =>
                                    handlePercentageChange(weekKey, setType, e.target.value)
                                  }
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">
                                  ({Math.round(percentage * 100)}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Accessories</CardTitle>
                        <p className="text-xs text-muted-foreground">Use format: "2X10 Exercise Name"</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {Lifts.map((lift) => (
                          <div key={lift} className="space-y-2">
                            <Label className="font-medium">{lift}</Label>
                            <p className="text-xs text-muted-foreground">Press Enter to add next line.</p>
                            <div className="space-y-2">
                              {((weekSettings.accessories?.[lift] || []).length > 0
                                ? (weekSettings.accessories?.[lift] || [])
                                : [""]).map((exercise, index, list) => (
                                <div key={`${lift}-${index}`} className="flex items-center gap-2">
                                  <Input
                                    value={exercise}
                                    onChange={(e) =>
                                      handleAccessoryItemChange(weekKey, lift, index, e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAccessoryAddItem(weekKey, lift, index);
                                      }
                                    }}
                                    placeholder={`Accessory ${index + 1}`}
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => handleAccessoryVisibilityToggle(weekKey, lift, exercise)}
                                    title={isAccessoryVisible(weekKey, lift, exercise) ? "Visible" : "Hidden"}
                                    disabled={!exercise.trim()}
                                  >
                                    {isAccessoryVisible(weekKey, lift, exercise) ? (
                                      <Eye className="h-4 w-4" />
                                    ) : (
                                      <EyeOff className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => handleAccessoryMoveItem(weekKey, lift, index, "up")}
                                    disabled={index === 0}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => handleAccessoryMoveItem(weekKey, lift, index, "down")}
                                    disabled={index === list.length - 1}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => handleAccessoryRemoveItem(weekKey, lift, index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleAccessoryAddItem(weekKey, lift)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Line
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="cycles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manage Cycles</CardTitle>
              </CardHeader>
              <CardContent>
                {cycles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cycles yet. Graduate your team to create new cycles.</p>
                ) : (
                  <div className="space-y-2">
                    {cycles.map((cycle) => (
                      <div
                        key={cycle.cycleNumber}
                        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors hover:bg-accent ${cycle.cycleNumber === dialogCycleNumber ? 'border-primary bg-primary/10 font-medium' : 'hover:border-accent-foreground'}`}
                        onClick={() => handleCycleChange(cycle.cycleNumber)}
                      >
                        {editingCycleId === cycle.cycleNumber ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingCycleName}
                              onChange={(e) => setEditingCycleName(e.target.value)}
                              className="h-8"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCycleName(cycle.cycleNumber);
                                if (e.key === 'Escape') handleCancelEditCycle();
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleSaveCycleName(cycle.cycleNumber)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleCancelEditCycle}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <span className="font-medium">{cycle.name}</span>
                              {cycle.cycleNumber === dialogCycleNumber && (
                                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleStartEditCycle(cycle)}
                                title="Rename cycle"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCycle(cycle.cycleNumber)}
                                disabled={cycles.length <= 1}
                                title={cycles.length <= 1 ? "Cannot delete last cycle" : "Delete cycle"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cycle Schedule</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Set the start date and training weekdays for the selected cycle (Cycle {dialogCycleNumber}).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cycle-start-date">Cycle Start Date</Label>
                  <Input
                    id="cycle-start-date"
                    type="date"
                    value={getCurrentCycleSchedule().cycleStartDate}
                    onChange={(e) => {
                      void handleSchedulePatch({ cycleStartDate: e.target.value });
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Day 1 Weekday</Label>
                    <Select
                      value={getCurrentCycleSchedule().day1Weekday}
                      onValueChange={(value) => {
                        void handleSchedulePatch({ day1Weekday: value as CycleScheduleSettings["day1Weekday"] });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select weekday" />
                      </SelectTrigger>
                      <SelectContent>
                        {weekdayOptions.map((weekday) => (
                          <SelectItem key={`day1-${weekday}`} value={weekday}>
                            {weekday}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Day 2 Weekday</Label>
                    <Select
                      value={getCurrentCycleSchedule().day2Weekday}
                      onValueChange={(value) => {
                        void handleSchedulePatch({ day2Weekday: value as CycleScheduleSettings["day2Weekday"] });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select weekday" />
                      </SelectTrigger>
                      <SelectContent>
                        {weekdayOptions.map((weekday) => (
                          <SelectItem key={`day2-${weekday}`} value={weekday}>
                            {weekday}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Movement Day Assignments</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Lifts.map((movement) => (
                      <div key={`movement-day-${movement}`} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{movement}</Label>
                        <Select
                          value={getCurrentCycleSchedule().liftDayAssignments?.[movement] || "day1"}
                          onValueChange={(value) => {
                            void handleSchedulePatch({
                              liftDayAssignments: {
                                ...(getCurrentCycleSchedule().liftDayAssignments || {}),
                                [movement]: value as "day1" | "day2",
                              },
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day1">Day 1</SelectItem>
                            <SelectItem value="day2">Day 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleLoadScheduleDebug();
                    }}
                    disabled={isLoadingScheduleDebug}
                  >
                    {isLoadingScheduleDebug ? "Loading Debug..." : "View Schedule Debug"}
                  </Button>
                  {scheduleDebugOutput ? (
                    <div className="space-y-2">
                      <pre className="rounded border bg-muted p-2 text-[10px] text-muted-foreground whitespace-pre-wrap">
                        {scheduleDebugSummary}
                      </pre>
                      <details>
                        <summary className="cursor-pointer text-[10px] text-muted-foreground">Raw payload</summary>
                        <pre className="mt-1 max-h-48 overflow-auto rounded border bg-muted p-2 text-[10px] text-muted-foreground">
                          {scheduleDebugOutput}
                        </pre>
                      </details>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Why We Choose 5/3/1</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This platform prioritizes consistency and longevity over maxing out.
                  In a high-stress work environment, training should reduce decision fatigue—not add to it.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Zero decision fatigue: percentages are pre-calculated and ready to execute.</li>
                  <li>Train optimally, not maximally: TMs run at 90% to manage fatigue and protect joints.</li>
                  <li>Start light, progress slowly: build a durable strength base over time.</li>
                  <li>Rep record mindset: beat prior rep performance at fixed loads to prove progress.</li>
                </ul>
                <p>
                  Bottom line: trust the percentages, execute the plan, and let volume + consistency do the work.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Wave Loading Roadmap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Week 1 (5s): volume base at 65 / 75 / 85%</li>
                  <li>Week 2 (3s): strength transition at 70 / 80 / 90%</li>
                  <li>Week 3 (5/3/1): peak week at 75 / 85 / 95%</li>
                  <li>Week 4 (Deload): recovery week at 40 / 50 / 60%, no AMRAP</li>
                </ul>
                <p>
                  The app supports duplicate/delete week operations to repeat a week when needed, while preserving the
                  sequence and pushing following weeks forward/back cleanly.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Feature Updates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <span className="font-medium text-foreground">Per-week session modes:</span> Each week can now run
                    its own mode (<span className="font-mono">Normal</span>, <span className="font-mono">Slide</span>, <span className="font-mono">Jack Shit</span>, <span className="font-mono">Pause Week</span>, <span className="font-mono">Recovery</span>) with legacy fallback support.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Slide catch-up flow:</span> Slide now uses a
                    <span className="font-mono"> Use From</span> source week for catch-up logic, and only shows valid prior-week options.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Logged actuals in copy output:</span> Day/Lift copy now includes actual logged weight/reps so coach exports match performed work.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Stable prescribed display:</span> Entering actuals no longer mutates prescribed/top-set programming in the table.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Reliable rep logging persistence:</span> Save now writes historical records and week snapshots with improved error surfacing and reload consistency.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Cycle-safe data isolation:</span> Week assignments, mode maps, and logged sets remain scoped by cycle number, including after team graduation.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">SBDOH App Protocols</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <span className="font-medium text-foreground">Stall / Reset TM:</span> Use the client profile
                    Reset TM control to recalculate training maxes from recent performance.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Mobility + Conditioning:</span> Follow the in-app
                    warm-up checklist and off-day conditioning checklist.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Mandatory pulling assistance:</span> Press/chest
                    work is paired with back work; day-specific accessory pairings are enforced in the display.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">2-Day split focus:</span> Tuesday (Deadlift + Bench),
                    Thursday (Squat + OH Press), with required assistance and core rotation.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={cycleToDelete !== null} onOpenChange={(open) => !open && setCycleToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Cycle {cycleToDelete}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete Cycle {cycleToDelete} and reassign all clients on this cycle to Cycle 1. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-2">
          <AlertDialogCancel disabled={isDeleting} autoFocus>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Cycle"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
