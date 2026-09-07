"use client";

import { useState, useEffect, useMemo } from "react";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, Check, X, ArrowUp, ArrowDown, Plus, Eye, EyeOff, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import type { Client, CycleScheduleSettings, CycleSettings, GlobalMovementSettings, Lift, MovementProgressionIncrement, TrainingGroup } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { getEffectiveCycleSchedule } from "@/lib/schedule";
import { buildGlobalMovementSettings, coerceMovementProgressionIncrement } from "@/lib/movement-profiles";
import { getActiveClients, getClientForTrainingGroup, getClientsInTrainingGroup } from "@/lib/training-groups";
import { graduateTeamAction } from "@/app/actions";

const percentageDisplayOrder = ["warmup1", "warmup2", "workset1", "workset2", "workset3"] as const;

const normalizeMovementKey = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

type CycleInfo = {
  cycleNumber: number;
  name: string;
};

type DaySlot = "day1" | "day2";

type GraduationOverrides = {
  cycleStartDate: string;
  day1Weekday: CycleScheduleSettings["day1Weekday"];
  day2Weekday: CycleScheduleSettings["day2Weekday"];
  liftDayAssignments: Record<Lift, DaySlot>;
  liftDisplayNames: Record<Lift, string>;
  calibrationLifts: Lift[];
  skipDeloadWeek: boolean;
};

type ConfigSettingsDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  cycleSettingsByCycle: Record<number, CycleSettings>;
  onUpdateCycleSettings: (cycleNumber: number, settings: CycleSettings) => void;
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>;
  onUpdateCycleSchedule?: (cycleNumber: number, schedule: CycleScheduleSettings) => Promise<void>;
  currentWeekKey?: string;
  cycles?: CycleInfo[];
  currentCycleNumber?: number;
  onRenameCycle?: (cycleNumber: number, newName: string) => void;
  onDeleteCycle?: (cycleNumber: number) => Promise<void>;
  onCycleChange?: (cycleNumber: number) => void;
  clients?: Client[];
  onAddClient?: () => void;
  onClientProfile?: (client: Client) => void;
  onUpdateCycleClientMembership?: (cycleNumber: number, selectedClientIds: string[]) => Promise<void>;
  globalMovementOptions?: string[];
  onUpdateGlobalMovementOptions?: (movementOptions: string[], initialSettings?: GlobalMovementSettings) => Promise<void>;
  globalMovementSettings?: GlobalMovementSettings;
  onUpdateGlobalMovementSettings?: (movementSettings: GlobalMovementSettings) => Promise<void>;
  trainingGroups?: TrainingGroup[];
  onUpdateTrainingGroups?: (groups: TrainingGroup[]) => Promise<void>;
  onUnassignClientsFromGroup?: (groupId: string) => Promise<void>;
  selectedGroupId?: string | null;
  onGroupSelect?: (groupId: string) => void;
  onGraduateTeam?: (updatedClients: Client[], newCycleNumber: number, overrides: GraduationOverrides) => void;
  canGraduate?: boolean;
  triggerLabel?: string;
};

export function ConfigSettingsDialog({
  open,
  onOpenChange,
  cycleSettingsByCycle,
  onUpdateCycleSettings,
  cycleSchedulesByCycle = {},
  onUpdateCycleSchedule,
  currentWeekKey = "week1",
  cycles = [],
  currentCycleNumber = 1,
  onRenameCycle,
  onDeleteCycle,
  onCycleChange,
  clients = [],
  onAddClient,
  onClientProfile,
  onUpdateCycleClientMembership,
  globalMovementOptions = ["Deadlift", "Bench", "Squat", "Press"],
  onUpdateGlobalMovementOptions,
  globalMovementSettings = {},
  onUpdateGlobalMovementSettings,
  trainingGroups = [],
  onUpdateTrainingGroups,
  onUnassignClientsFromGroup,
  selectedGroupId = null,
  onGroupSelect,
  onGraduateTeam,
  canGraduate = true,
  triggerLabel = "Settings",
}: ConfigSettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const [editingCycleId, setEditingCycleId] = useState<number | null>(null);
  const [editingCycleName, setEditingCycleName] = useState("");
  const [cycleToDelete, setCycleToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogCycleNumber, setDialogCycleNumber] = useState<number>(currentCycleNumber);
  const [settingsTab, setSettingsTab] = useState<"roster" | "cycles" | "weeks" | "movements" | "about">("cycles");
  const [isGroupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(currentWeekKey || "week1");
  const [newMovementName, setNewMovementName] = useState("");
  const [newMovementClass, setNewMovementClass] = useState<MovementProgressionIncrement>(5);
  const [selectedCycleClientIds, setSelectedCycleClientIds] = useState<string[]>([]);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [localGlobalMovementSettings, setLocalGlobalMovementSettings] = useState<GlobalMovementSettings>(() =>
    buildGlobalMovementSettings(globalMovementOptions, globalMovementSettings)
  );
  const [localSettings, setLocalSettings] = useState<CycleSettings>(
    cycleSettingsByCycle[currentCycleNumber] || cycleSettingsByCycle[1] || {}
  );
  const [isLoadingScheduleDebug, setIsLoadingScheduleDebug] = useState(false);
  const [scheduleDebugOutput, setScheduleDebugOutput] = useState<string>("");
  const [scheduleDebugSummary, setScheduleDebugSummary] = useState<string>("");
  const [localTrainingGroups, setLocalTrainingGroups] = useState<TrainingGroup[]>(trainingGroups);
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
  const [isGraduateFormOpen, setGraduateFormOpen] = useState(false);
  const [isGraduating, setIsGraduating] = useState(false);
  const [nextCycleStartDate, setNextCycleStartDate] = useState("");
  const [nextDay1Weekday, setNextDay1Weekday] = useState<GraduationOverrides["day1Weekday"]>("Tuesday");
  const [nextDay2Weekday, setNextDay2Weekday] = useState<GraduationOverrides["day2Weekday"]>("Thursday");
  const [nextLiftDayAssignments, setNextLiftDayAssignments] = useState<Record<Lift, DaySlot>>({
    Deadlift: "day1",
    Bench: "day1",
    Squat: "day2",
    Press: "day2",
  });
  const [nextLiftDisplayNames, setNextLiftDisplayNames] = useState<Record<Lift, string>>({
    Deadlift: "Deadlift",
    Bench: "Bench",
    Squat: "Squat",
    Press: "Press",
  });
  const [selectedGraduateClientIds, setSelectedGraduateClientIds] = useState<string[]>([]);
  const [nextSkipDeloadWeek, setNextSkipDeloadWeek] = useState(false);

  const addDaysToIso = (isoDate: string, daysToAdd: number): string => {
    if (!isoDate) return "";
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + daysToAdd);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const graduationCycleNumber = selectedGroupId
    ? trainingGroups.find((group) => group.id === selectedGroupId)?.currentCycleNumber ?? currentCycleNumber
    : currentCycleNumber;
  const graduationCycleSchedule = getEffectiveCycleSchedule(cycleSchedulesByCycle[graduationCycleNumber]);

  const defaultLiftAssignments = useMemo(
    () => ({
      Deadlift: graduationCycleSchedule.liftDayAssignments?.Deadlift || "day1",
      Bench: graduationCycleSchedule.liftDayAssignments?.Bench || "day1",
      Squat: graduationCycleSchedule.liftDayAssignments?.Squat || "day2",
      Press: graduationCycleSchedule.liftDayAssignments?.Press || "day2",
    }),
    [graduationCycleSchedule]
  );

  const defaultLiftDisplayNames = useMemo(
    () => ({
      Deadlift: graduationCycleSchedule.liftDisplayNames?.Deadlift || "Deadlift",
      Bench: graduationCycleSchedule.liftDisplayNames?.Bench || "Bench",
      Squat: graduationCycleSchedule.liftDisplayNames?.Squat || "Squat",
      Press: graduationCycleSchedule.liftDisplayNames?.Press || "Press",
    }),
    [graduationCycleSchedule]
  );

  const graduationCandidates = (selectedGroupId
    ? getClientsInTrainingGroup(clients, selectedGroupId).map((client) =>
        getClientForTrainingGroup(client, selectedGroupId)
      )
    : getActiveClients(clients)
  ).filter((client) => (client.currentCycleNumber || 1) === graduationCycleNumber);

  const openGraduateForm = () => {
    const cycleLengthWeeks = graduationCycleSchedule.skipDeloadWeek ? 3 : 4;
    const inferredStartDate = addDaysToIso(graduationCycleSchedule.cycleStartDate || "", cycleLengthWeeks * 7);
    setNextCycleStartDate(inferredStartDate);
    setNextDay1Weekday(graduationCycleSchedule.day1Weekday || "Tuesday");
    setNextDay2Weekday(graduationCycleSchedule.day2Weekday || "Thursday");
    setNextLiftDayAssignments(defaultLiftAssignments);
    setNextLiftDisplayNames(defaultLiftDisplayNames);
    setSelectedGraduateClientIds(graduationCandidates.map((client) => client.id));
    setNextSkipDeloadWeek(false);
    setGraduateFormOpen(true);
  };

  const handleGraduateTeam = async () => {
    if (!canGraduate) {
      toast({
        variant: "destructive",
        title: "Cycle Locked",
        description: "Switch to the active cycle before graduating the team.",
      });
      return;
    }

    const changedLifts = Lifts.filter((trackedLift) => {
      const previous = (defaultLiftDisplayNames[trackedLift] || trackedLift).trim().toLowerCase();
      const next = (nextLiftDisplayNames[trackedLift] || trackedLift).trim().toLowerCase();
      return previous !== next;
    });

    const selectedClients = graduationCandidates.filter((client) => selectedGraduateClientIds.includes(client.id));
    if (selectedClients.length === 0) {
      toast({
        variant: "destructive",
        title: "No Clients Selected",
        description: "Select at least one client to move into the next cycle.",
      });
      return;
    }

    setIsGraduating(true);
    const result = await graduateTeamAction(selectedClients, {
      noIncrementLifts: changedLifts,
      calibrationLifts: changedLifts,
    }, selectedGroupId || undefined);
    if (result.success) {
      toast({
        title: "Success!",
        description: result.message,
      });
      if (onGraduateTeam && result.newCycleNumber) {
        onGraduateTeam(selectedClients, result.newCycleNumber, {
          cycleStartDate: nextCycleStartDate,
          day1Weekday: nextDay1Weekday,
          day2Weekday: nextDay2Weekday,
          liftDayAssignments: nextLiftDayAssignments,
          liftDisplayNames: nextLiftDisplayNames,
          calibrationLifts: changedLifts,
          skipDeloadWeek: nextSkipDeloadWeek,
        });
      }
      setGraduateFormOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to graduate team.",
      });
    }
    setIsGraduating(false);
  };

  const protectedMovementNames = useMemo(
    () => new Set(["Deadlift", "Bench", "Squat", "Press"]),
    []
  );
  const usedMovementNames = new Set(
    Object.values(cycleSchedulesByCycle).flatMap((schedule) => Object.values(schedule.liftDisplayNames || {}))
  );
  const normalizedMovementSettings = useMemo(
    () => buildGlobalMovementSettings(globalMovementOptions, globalMovementSettings),
    [globalMovementOptions, globalMovementSettings]
  );
  const dedupedMovementState = useMemo(() => {
    const chosenByDisplay = new Map<string, string>();

    for (const option of globalMovementOptions) {
      const displayName = (localGlobalMovementSettings[option]?.displayName || option).trim() || option;
      const normalizedDisplay = normalizeMovementKey(displayName);
      const existingKey = chosenByDisplay.get(normalizedDisplay);
      if (!existingKey) {
        chosenByDisplay.set(normalizedDisplay, option);
        continue;
      }

      const existingIsProtected = protectedMovementNames.has(existingKey);
      const currentIsProtected = protectedMovementNames.has(option);
      if (!existingIsProtected && currentIsProtected) {
        chosenByDisplay.set(normalizedDisplay, option);
      }
    }

    const keptKeys = new Set(chosenByDisplay.values());
    const options = globalMovementOptions.filter((option) => keptKeys.has(option));
    const removed = globalMovementOptions.filter((option) => !keptKeys.has(option));
    const settings: GlobalMovementSettings = {};

    for (const option of options) {
      const existingEntry = localGlobalMovementSettings[option];
      const displayName = (existingEntry?.displayName || option).trim() || option;
      settings[option] = {
        classType: coerceMovementProgressionIncrement((existingEntry?.classType as number) || 5, 5),
        displayName,
      };
    }

    return { options, settings, removed };
  }, [globalMovementOptions, localGlobalMovementSettings, protectedMovementNames]);

  // Sync localSettings when selected cycle settings change
  useEffect(() => {
    setLocalSettings(cycleSettingsByCycle[dialogCycleNumber] || cycleSettingsByCycle[1] || {});
  }, [cycleSettingsByCycle, dialogCycleNumber]);

  useEffect(() => {
    setLocalGlobalMovementSettings(normalizedMovementSettings);
  }, [normalizedMovementSettings]);

  // Keep the dialog cycle anchored to app state only when closed.
  // While open, users can inspect/edit any cycle without being reset.
  useEffect(() => {
    if (!isOpen) {
      setDialogCycleNumber(currentCycleNumber);
      setLocalTrainingGroups((current) =>
        JSON.stringify(current) === JSON.stringify(trainingGroups) ? current : trainingGroups
      );
    }
  }, [currentCycleNumber, isOpen, trainingGroups]);

  useEffect(() => {
    if (isOpen) {
      setSettingsTab("cycles");
      setGroupDetailsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setGroupDetailsOpen(settingsTab === "roster");
  }, [settingsTab]);

  useEffect(() => {
    if (currentWeekKey) {
      setSelectedWeekKey(currentWeekKey);
    }
  }, [currentWeekKey]);

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
  }, [cycles, dialogCycleNumber, onCycleChange]);

  useEffect(() => {
    const selected = clients
      .filter((client) => (client.cycleMembership || []).includes(dialogCycleNumber))
      .map((client) => client.id);
    setSelectedCycleClientIds((current) =>
      current.length === selected.length && current.every((clientId, index) => clientId === selected[index])
        ? current
        : selected
    );
  }, [clients, dialogCycleNumber]);

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
    const deletedCycleNumber = cycleToDelete;
    
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

  const handleAddMovementOption = async () => {
    const trimmed = newMovementName.trim();
    const normalizedNew = normalizeMovementKey(trimmed);
    const displayNameTaken = globalMovementOptions.some((option) => {
      const currentDisplayName = (localGlobalMovementSettings[option]?.displayName || option).trim() || option;
      return normalizeMovementKey(currentDisplayName) === normalizedNew;
    });
    if (!trimmed || globalMovementOptions.includes(trimmed) || !onUpdateGlobalMovementOptions) return;
    if (displayNameTaken) {
      toast({
        variant: "destructive",
        title: "Duplicate Movement Name",
        description: `${trimmed} already exists as a movement name.`,
      });
      return;
    }
    await onUpdateGlobalMovementOptions(
      [...globalMovementOptions, trimmed],
      {
        [trimmed]: {
          classType: newMovementClass,
          displayName: trimmed,
        },
      }
    );
    setNewMovementName("");
    setNewMovementClass(5);
  };

  const handleMovementClassTypeChange = (movementName: string, classType: MovementProgressionIncrement) => {
    setLocalGlobalMovementSettings((prev) => ({
      ...prev,
      [movementName]: {
        ...(prev[movementName] || {}),
        classType,
        displayName: (prev[movementName]?.displayName || movementName).trim(),
      },
    }));
  };

  const handleRemoveMovementOption = async (movementName: string) => {
    if (!onUpdateGlobalMovementOptions) return;
    if (protectedMovementNames.has(movementName) || usedMovementNames.has(movementName)) return;
    await onUpdateGlobalMovementOptions(globalMovementOptions.filter((option) => option !== movementName));
  };

  const handleToggleCycleClient = (clientId: string, checked: boolean) => {
    setSelectedCycleClientIds((prev) => {
      if (checked) {
        return prev.includes(clientId) ? prev : [...prev, clientId];
      }
      return prev.filter((id) => id !== clientId);
    });
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
    void (async () => {
      const currentSettings = cycleSettingsByCycle[dialogCycleNumber] || cycleSettingsByCycle[1] || {};
      const currentClientIds = clients
        .filter((client) => (client.cycleMembership || []).includes(dialogCycleNumber))
        .map((client) => client.id)
        .sort();
      const nextClientIds = [...selectedCycleClientIds].sort();
      const movementOptionsChanged = JSON.stringify(dedupedMovementState.options) !== JSON.stringify(globalMovementOptions);
      const cycleSettingsChanged = JSON.stringify(localSettings) !== JSON.stringify(currentSettings);
      const cycleClientsChanged = JSON.stringify(nextClientIds) !== JSON.stringify(currentClientIds);
      const movementSettingsChanged = JSON.stringify(dedupedMovementState.settings) !== JSON.stringify(normalizedMovementSettings);

      if (!cycleSettingsChanged && !cycleClientsChanged && !movementSettingsChanged && !movementOptionsChanged) {
        setIsOpen(false);
        return;
      }

      setIsSavingAll(true);
      try {
        if (cycleSettingsChanged) {
          await Promise.resolve(onUpdateCycleSettings(dialogCycleNumber, localSettings));
        }
        if (cycleClientsChanged && onUpdateCycleClientMembership) {
          await onUpdateCycleClientMembership(dialogCycleNumber, selectedCycleClientIds);
        }
        if (movementOptionsChanged && onUpdateGlobalMovementOptions) {
          await onUpdateGlobalMovementOptions(dedupedMovementState.options, dedupedMovementState.settings);
        } else if (movementSettingsChanged && onUpdateGlobalMovementSettings) {
          await onUpdateGlobalMovementSettings(dedupedMovementState.settings);
        }

        if (dedupedMovementState.removed.length > 0) {
          toast({
            title: "Duplicate Movements Merged",
            description: `Removed duplicates: ${dedupedMovementState.removed.join(", ")}.`,
          });
        }
        setIsOpen(false);
        toast({
          title: "Settings Saved",
          description: "Changed settings were saved successfully.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: String(error),
        });
      } finally {
        setIsSavingAll(false);
      }
    })();
  };

  const hasDirtyChanges =
    JSON.stringify(localSettings) !== JSON.stringify(cycleSettingsByCycle[dialogCycleNumber] || cycleSettingsByCycle[1] || {}) ||
    JSON.stringify([...selectedCycleClientIds].sort()) !== JSON.stringify(
      clients.filter((client) => (client.cycleMembership || []).includes(dialogCycleNumber)).map((client) => client.id).sort()
    ) ||
    JSON.stringify(dedupedMovementState.settings) !== JSON.stringify(normalizedMovementSettings) ||
    JSON.stringify(dedupedMovementState.options) !== JSON.stringify(globalMovementOptions);

  const isDeloadWeek = (weekKey: string, weekName: string) => {
    return weekName.toLowerCase().includes("deload");
  };
  const selectedLocalGroup = localTrainingGroups.find((group) => group.id === selectedGroupId);
  const activeClients = getActiveClients(clients);
  const selectedGroupClients = selectedLocalGroup
    ? getClientsInTrainingGroup(clients, selectedLocalGroup.id)
    : activeClients;
  const unassignedClients = selectedLocalGroup
    ? activeClients.filter((client) => !client.activeGroupId)
    : [];
  const inactiveClients = clients.filter((client) => client.status === "inactive");

  const handleClose = () => {
    setLocalSettings(cycleSettingsByCycle[dialogCycleNumber] || cycleSettingsByCycle[1] || {});
    setIsOpen(false);
  };

  const getInitialGroupProgram = (): TrainingGroup["program"] => {
    const sourceCycleNumber = cycleSettingsByCycle[1]
      ? 1
      : Math.min(...Object.keys(cycleSettingsByCycle).map(Number).filter(Number.isFinite));
    const sourceSchedule = getEffectiveCycleSchedule(cycleSchedulesByCycle[sourceCycleNumber]);

    return {
      cycleSettingsByCycle: { 1: structuredClone(cycleSettingsByCycle[sourceCycleNumber] || {}) },
      cycleNames: { 1: "Cycle 1" },
      cycleSchedulesByCycle: {
        1: {
          ...sourceSchedule,
          cycleStartDate: "",
        },
      },
    };
  };

  const createGroup = async () => {
    if (!onUpdateTrainingGroups) return;

    const id = `group-${crypto.randomUUID()}`;
    const nextGroup: TrainingGroup = {
      id,
      name: `New Group ${trainingGroups.length + 1}`,
      sortOrder: trainingGroups.length,
      active: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
      sessionTimes: { day1StartTime: "06:00", day2StartTime: "06:00" },
      currentCycleNumber: 1,
      program: getInitialGroupProgram(),
    };

    try {
      const nextGroups = [...localTrainingGroups, nextGroup];
      setLocalTrainingGroups(nextGroups);
      await onUpdateTrainingGroups(nextGroups);
      onGroupSelect?.(id);
      toast({ title: "Group Created", description: "The new group has its own independent program copy." });
    } catch (error) {
      toast({ variant: "destructive", title: "Create Failed", description: String(error) });
    }
  };

  const updateLocalGroup = (groupId: string, updates: Partial<TrainingGroup>) => {
    setLocalTrainingGroups((groups) =>
      groups.map((group) => group.id === groupId ? { ...group, ...updates } : group)
    );
  };

  const saveGroups = async () => {
    if (!onUpdateTrainingGroups) return;
    try {
      await onUpdateTrainingGroups(localTrainingGroups);
    } catch (error) {
      toast({ variant: "destructive", title: "Save Failed", description: String(error) });
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!onUpdateTrainingGroups) return;

    const nextGroups = localTrainingGroups.filter((group) => group.id !== groupId);
    setLocalTrainingGroups(nextGroups);
    try {
      await onUnassignClientsFromGroup?.(groupId);
      await onUpdateTrainingGroups(nextGroups);
      toast({ title: "Group Deleted", description: "The group was deleted and its members are now unassigned." });
    } catch (error) {
      setLocalTrainingGroups(localTrainingGroups);
      toast({ variant: "destructive", title: "Delete Failed", description: String(error) });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="block w-full px-2 py-1 text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          title="Settings"
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage the selected group&apos;s program, calendar, and weekly templates.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Editing Program For</Label>
            <Select value={selectedGroupId || undefined} onValueChange={onGroupSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Shared legacy program" />
              </SelectTrigger>
              <SelectContent>
                {trainingGroups.filter((group) => group.active).map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" onClick={() => void createGroup()} disabled={!onUpdateTrainingGroups}>
            <Plus className="mr-1 h-4 w-4" /> Add Group
          </Button>
        </div>

        {selectedLocalGroup ? (
          <Card>
            <CardHeader className="py-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setGroupDetailsOpen((open) => !open)}
              >
                <div>
                  <CardTitle className="text-base">Group Details</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedLocalGroup.name} · {selectedLocalGroup.active ? "Active" : "Archived"}{selectedLocalGroup.isDefault ? " · Default" : ""} · Cycle {selectedLocalGroup.currentCycleNumber}
                  </p>
                </div>
                {isGroupDetailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </CardHeader>
            {isGroupDetailsOpen ? <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={selectedLocalGroup.name}
                  aria-label="Group name"
                  onChange={(event) => updateLocalGroup(selectedLocalGroup.id, { name: event.target.value })}
                  onBlur={() => void saveGroups()}
                />
                <Button
                  type="button"
                  variant={selectedLocalGroup.active ? "outline" : "secondary"}
                  size="sm"
                  onClick={() => {
                    const nextGroups = localTrainingGroups.map((entry) =>
                      entry.id === selectedLocalGroup.id ? { ...entry, active: !entry.active } : entry
                    );
                    setLocalTrainingGroups(nextGroups);
                    void onUpdateTrainingGroups?.(nextGroups);
                  }}
                >
                  {selectedLocalGroup.active ? "Archive" : "Restore"}
                </Button>
                <Button
                  type="button"
                  variant={selectedLocalGroup.isDefault ? "default" : "outline"}
                  size="sm"
                  disabled={!selectedLocalGroup.active}
                  onClick={() => {
                    const nextGroups = localTrainingGroups.map((entry) => ({
                      ...entry,
                      isDefault: entry.id === selectedLocalGroup.id,
                    }));
                    setLocalTrainingGroups(nextGroups);
                    void onUpdateTrainingGroups?.(nextGroups);
                  }}
                >
                  {selectedLocalGroup.isDefault ? "Default" : "Set Default"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${selectedLocalGroup.name}`} title="Delete group">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedLocalGroup.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the group and its independent program settings. Assigned clients will become unassigned; their client history is kept.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => void deleteGroup(selectedLocalGroup.id)}
                      >
                        Delete Group
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Timezone</Label>
                  <Input value={selectedLocalGroup.timeZone} onChange={(event) => updateLocalGroup(selectedLocalGroup.id, { timeZone: event.target.value })} onBlur={() => void saveGroups()} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Day 1 Start</Label>
                  <Input type="time" value={selectedLocalGroup.sessionTimes.day1StartTime} onChange={(event) => updateLocalGroup(selectedLocalGroup.id, { sessionTimes: { ...selectedLocalGroup.sessionTimes, day1StartTime: event.target.value } })} onBlur={() => void saveGroups()} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Day 2 Start</Label>
                  <Input type="time" value={selectedLocalGroup.sessionTimes.day2StartTime} onChange={(event) => updateLocalGroup(selectedLocalGroup.id, { sessionTimes: { ...selectedLocalGroup.sessionTimes, day2StartTime: event.target.value } })} onBlur={() => void saveGroups()} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cycle {selectedLocalGroup.currentCycleNumber} Start Date</Label>
                  <Input
                    type="date"
                    value={selectedLocalGroup.program.cycleSchedulesByCycle[selectedLocalGroup.currentCycleNumber]?.cycleStartDate || ""}
                    onChange={(event) => updateLocalGroup(selectedLocalGroup.id, {
                      program: {
                        ...selectedLocalGroup.program,
                        cycleSchedulesByCycle: {
                          ...selectedLocalGroup.program.cycleSchedulesByCycle,
                          [selectedLocalGroup.currentCycleNumber]: {
                            ...getEffectiveCycleSchedule(selectedLocalGroup.program.cycleSchedulesByCycle[selectedLocalGroup.currentCycleNumber]),
                            cycleStartDate: event.target.value,
                          },
                        },
                      },
                    })}
                    onBlur={() => void saveGroups()}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Day 1 Weekday</Label>
                  <Select
                    value={selectedLocalGroup.program.cycleSchedulesByCycle[selectedLocalGroup.currentCycleNumber]?.day1Weekday || "Tuesday"}
                    onValueChange={(value) => {
                      const nextGroups = localTrainingGroups.map((entry) => entry.id === selectedLocalGroup.id ? {
                        ...entry,
                        program: {
                          ...entry.program,
                          cycleSchedulesByCycle: {
                            ...entry.program.cycleSchedulesByCycle,
                            [entry.currentCycleNumber]: {
                              ...getEffectiveCycleSchedule(entry.program.cycleSchedulesByCycle[entry.currentCycleNumber]),
                              day1Weekday: value as CycleScheduleSettings["day1Weekday"],
                            },
                          },
                        },
                      } : entry);
                      setLocalTrainingGroups(nextGroups);
                      void onUpdateTrainingGroups?.(nextGroups);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{weekdayOptions.map((weekday) => <SelectItem key={weekday} value={weekday}>{weekday}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Day 2 Weekday</Label>
                  <Select
                    value={selectedLocalGroup.program.cycleSchedulesByCycle[selectedLocalGroup.currentCycleNumber]?.day2Weekday || "Thursday"}
                    onValueChange={(value) => {
                      const nextGroups = localTrainingGroups.map((entry) => entry.id === selectedLocalGroup.id ? {
                        ...entry,
                        program: {
                          ...entry.program,
                          cycleSchedulesByCycle: {
                            ...entry.program.cycleSchedulesByCycle,
                            [entry.currentCycleNumber]: {
                              ...getEffectiveCycleSchedule(entry.program.cycleSchedulesByCycle[entry.currentCycleNumber]),
                              day2Weekday: value as CycleScheduleSettings["day2Weekday"],
                            },
                          },
                        },
                      } : entry);
                      setLocalTrainingGroups(nextGroups);
                      void onUpdateTrainingGroups?.(nextGroups);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{weekdayOptions.map((weekday) => <SelectItem key={weekday} value={weekday}>{weekday}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{selectedLocalGroup.active ? "Active" : "Archived"}{selectedLocalGroup.isDefault ? " · Default" : ""} · Cycle {selectedLocalGroup.currentCycleNumber} · ID: {selectedLocalGroup.id}</p>
            </CardContent> : null}
          </Card>
        ) : null}

        <Tabs value={settingsTab} onValueChange={(value) => setSettingsTab(value as "roster" | "cycles" | "weeks" | "movements" | "about")} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-5">
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="cycles">Program Cycles</TabsTrigger>
            <TabsTrigger value="weeks">Program Weeks</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Roster</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedLocalGroup ? `Active members assigned to ${selectedLocalGroup.name}.` : "All active clients in the shared roster."}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={onAddClient} disabled={!onAddClient}>
                  <Plus className="mr-1 h-4 w-4" /> Add Client
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {selectedLocalGroup ? "Group Members" : "Active Clients"} ({selectedGroupClients.length})
                  </p>
                  {selectedGroupClients.length === 0 ? (
                    <p className="rounded-md border p-3 text-sm text-muted-foreground">No active clients assigned.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedGroupClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => onClientProfile?.(client)}
                        >
                          <span className="font-medium">{client.name}</span>
                          <span className="text-xs text-muted-foreground">Profile</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {unassignedClients.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unassigned ({unassignedClients.length})</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {unassignedClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => onClientProfile?.(client)}
                        >
                          <span className="font-medium">{client.name}</span>
                          <span className="text-xs text-muted-foreground">Profile</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Not in any group. Open a profile to transfer them into one.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inactive Clients ({inactiveClients.length})</p>
                  {inactiveClients.length === 0 ? (
                    <p className="rounded-md border p-3 text-sm text-muted-foreground">No inactive clients.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {inactiveClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                          onClick={() => onClientProfile?.(client)}
                        >
                          <span>{client.name}</span>
                          <span className="text-xs">Profile</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weeks" className="space-y-4">
            <p className="text-sm text-muted-foreground">Editing cycle {dialogCycleNumber}</p>
            {Object.keys(localSettings).length === 0 ? (
              <p className="text-sm text-muted-foreground">No week settings available.</p>
            ) : (
              <Tabs
                value={Object.prototype.hasOwnProperty.call(localSettings, selectedWeekKey) ? selectedWeekKey : Object.keys(localSettings)[0]}
                onValueChange={setSelectedWeekKey}
                className="w-full"
              >
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
                    .map((weekKey) => {
                      const weekName = localSettings[weekKey].name;
                      const shouldStrikeDeload =
                        Boolean(getCurrentCycleSchedule().skipDeloadWeek) &&
                        isDeloadWeek(weekKey, weekName);

                      return (
                        <TabsTrigger
                          key={weekKey}
                          value={weekKey}
                          className={`px-2 text-xs sm:text-sm ${shouldStrikeDeload ? "line-through opacity-70" : ""}`}
                          title={shouldStrikeDeload ? "Deload week skipped for this cycle" : undefined}
                        >
                          {weekName}
                        </TabsTrigger>
                      );
                    })}
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
                        <p className="text-xs text-muted-foreground">Use format: &quot;2X10 Exercise Name&quot;</p>
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
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Cycle Actions</CardTitle>
                  <p className="text-xs text-muted-foreground">Advance the active group&apos;s eligible members into the next cycle.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => (isGraduateFormOpen ? setGraduateFormOpen(false) : openGraduateForm())}
                >
                  <TrendingUp className="mr-1 h-4 w-4" /> {isGraduateFormOpen ? "Close" : "Graduate Team"}
                </Button>
              </CardHeader>
              {isGraduateFormOpen ? (
                <CardContent className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="next-cycle-start-date">Next Cycle Start Date</Label>
                    <Input
                      id="next-cycle-start-date"
                      type="date"
                      value={nextCycleStartDate}
                      onChange={(e) => setNextCycleStartDate(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Day 1 Weekday</Label>
                      <Select value={nextDay1Weekday} onValueChange={(value) => setNextDay1Weekday(value as GraduationOverrides["day1Weekday"])}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select weekday" />
                        </SelectTrigger>
                        <SelectContent>
                          {weekdayOptions.map((weekday) => (
                            <SelectItem key={`graduate-day1-${weekday}`} value={weekday}>
                              {weekday}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Day 2 Weekday</Label>
                      <Select value={nextDay2Weekday} onValueChange={(value) => setNextDay2Weekday(value as GraduationOverrides["day2Weekday"])}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select weekday" />
                        </SelectTrigger>
                        <SelectContent>
                          {weekdayOptions.map((weekday) => (
                            <SelectItem key={`graduate-day2-${weekday}`} value={weekday}>
                              {weekday}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Clients Moving To Next Cycle</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedGraduateClientIds((prev) =>
                            prev.length === graduationCandidates.length
                              ? []
                              : graduationCandidates.map((client) => client.id)
                          );
                        }}
                      >
                        {selectedGraduateClientIds.length === graduationCandidates.length ? "Clear All" : "Select All"}
                      </Button>
                    </div>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
                      {graduationCandidates.map((client) => {
                        const checked = selectedGraduateClientIds.includes(client.id);
                        return (
                          <label key={`graduate-client-${client.id}`} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setSelectedGraduateClientIds((prev) => {
                                  if (isChecked) {
                                    return prev.includes(client.id) ? prev : [...prev, client.id];
                                  }
                                  return prev.filter((id) => id !== client.id);
                                });
                              }}
                            />
                            <span>{client.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Selected: {selectedGraduateClientIds.length} of {graduationCandidates.length}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Movement Day Assignments</Label>
                    <p className="text-xs text-muted-foreground">
                      Movement label is display-only. Progression math follows the tracked slot:
                      Deadlift/Squat = 10 lbs, Bench/Press = 5 lbs.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {Lifts.map((movement) => (
                        <div key={`graduate-movement-day-${movement}`} className="space-y-2 rounded-md border border-border/70 p-2">
                          <Label className="text-xs text-muted-foreground">
                            Track Slot: {movement} {movement === "Squat" || movement === "Deadlift" ? "(10 lbs)" : "(5 lbs)"}
                          </Label>
                          <Select
                            value={nextLiftDisplayNames[movement]}
                            onValueChange={(value) => {
                              setNextLiftDisplayNames((prev) => ({
                                ...prev,
                                [movement]: value,
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select movement" />
                            </SelectTrigger>
                            <SelectContent>
                              {globalMovementOptions.map((option) => (
                                <SelectItem key={`movement-option-${movement}-${option}`} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={nextLiftDayAssignments[movement]}
                            onValueChange={(value) => {
                              setNextLiftDayAssignments((prev) => ({
                                ...prev,
                                [movement]: value as DaySlot,
                              }));
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

                  <div className="flex items-center justify-between rounded-md border border-border/70 p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="next-skip-deload">Skip Deload Week</Label>
                      <p className="text-xs text-muted-foreground">
                        Treat the new cycle as 3 weeks. Week 4 is omitted and graduation timing moves up by one week.
                      </p>
                    </div>
                    <Switch
                      id="next-skip-deload"
                      checked={nextSkipDeloadWeek}
                      onCheckedChange={setNextSkipDeloadWeek}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setGraduateFormOpen(false)} disabled={isGraduating}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={() => void handleGraduateTeam()} disabled={isGraduating}>
                      {isGraduating ? "Graduating..." : "Confirm & Graduate"}
                    </Button>
                  </div>
                </CardContent>
              ) : null}
            </Card>
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
                <CardTitle className="text-base">Cycle Client List</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Choose which clients belong to Cycle {dialogCycleNumber}. This is a manual override for cycle membership.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clients available.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedCycleClientIds(clients.map((client) => client.id))}
                      >
                        Check All
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedCycleClientIds([])}
                      >
                        Clear All
                      </Button>
                    </div>

                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                      {clients.map((client) => {
                        const checked = selectedCycleClientIds.includes(client.id);
                        return (
                          <label key={`cycle-client-${client.id}`} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => handleToggleCycleClient(client.id, e.target.checked)}
                            />
                            <span>{client.name}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Selected: {selectedCycleClientIds.length} of {clients.length}
                      </p>
                    </div>
                  </>
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

                <div className="flex items-start gap-3 rounded-md border p-3">
                  <input
                    id="skip-deload-week"
                    type="checkbox"
                    checked={Boolean(getCurrentCycleSchedule().skipDeloadWeek)}
                    onChange={(e) => {
                      void handleSchedulePatch({ skipDeloadWeek: e.target.checked });
                    }}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="skip-deload-week">Skip Deload Week</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, this cycle is treated as 3 weeks for transition timing. Graduating to the next cycle starts one week earlier.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Movement Day Assignments</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Lifts.map((movement) => (
                      <div key={`movement-day-${movement}`} className="space-y-2 rounded-md border p-3">
                        <Label className="text-xs text-muted-foreground">Tracked Slot: {movement}</Label>
                        <Select
                          value={getCurrentCycleSchedule().liftDisplayNames?.[movement] || movement}
                          onValueChange={(value) => {
                            void handleSchedulePatch({
                              liftDisplayNames: {
                                ...(getCurrentCycleSchedule().liftDisplayNames || {}),
                                [movement]: value,
                              },
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select movement" />
                          </SelectTrigger>
                          <SelectContent>
                            {globalMovementOptions.map((option) => (
                              <SelectItem key={`movement-name-${movement}-${option}`} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Global Movement Library</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Add a movement once, choose its progression class up front, and reuse it everywhere. Client-specific 1RM and calibration data still live in each client profile.
                  </p>
                </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_160px_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="global-movement-name">New Movement</Label>
                    <Input
                      id="global-movement-name"
                      value={newMovementName}
                      placeholder="Incline Press"
                      onChange={(e) => setNewMovementName(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleAddMovementOption();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="global-movement-class">Class</Label>
                    <Select
                      value={newMovementClass.toString()}
                      onValueChange={(value) => setNewMovementClass(Number(value) as MovementProgressionIncrement)}
                    >
                      <SelectTrigger id="global-movement-class">
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
                  <Button type="button" variant="outline" className="w-full lg:w-auto" onClick={() => void handleAddMovementOption()}>
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {dedupedMovementState.options.map((movementName) => {
                    const isProtected = protectedMovementNames.has(movementName);
                    const isUsed = usedMovementNames.has(movementName);
                    const movementSetting = localGlobalMovementSettings[movementName] || { classType: 5 as const };
                    const movementClass = coerceMovementProgressionIncrement(movementSetting.classType as number, 5);
                    const movementDisplayName = (movementSetting.displayName || movementName).trim();
                    return (
                      <div key={movementName} className="relative rounded-md border p-3 pr-11">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-2 text-destructive hover:text-destructive"
                          disabled={isProtected || isUsed}
                          onClick={() => void handleRemoveMovementOption(movementName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end">
                          <div className="space-y-1">
                            <Label className="text-xs">Movement Name</Label>
                            <Input
                              value={movementDisplayName}
                              onChange={(event) => {
                                const nextDisplayName = event.target.value;
                                setLocalGlobalMovementSettings((prev) => ({
                                  ...prev,
                                  [movementName]: {
                                    ...(prev[movementName] || { classType: movementClass }),
                                    displayName: nextDisplayName,
                                  },
                                }));
                              }}
                            />
                          </div>

                          {movementSetting ? (
                            <div className="space-y-1">
                              <Label className="text-xs">Progression Class</Label>
                              <Select
                                value={movementClass.toString()}
                                onValueChange={(value) => handleMovementClassTypeChange(movementName, Number(value) as MovementProgressionIncrement)}
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
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
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
                    <span className="font-medium text-foreground">Unified settings save:</span> Settings now use one
                    dirty-aware <span className="font-mono">Save Changes</span> action that only writes what changed.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Global movement library upgrade:</span> Add a movement
                    with progression class up front, edit display names, and prevent duplicate movement naming collisions.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Client tracked movement selection:</span> Each tracked
                    lift can now be switched per client and per cycle (for example Deadlift to Hex Bar Deadlift).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Calibration safeguards:</span> Switching to a custom
                    movement now forces calibration-required by default unless that exact movement already has validated data.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Auto TM from 1RM:</span> In client profiles, updating
                    movement 1RM now auto-calculates TM at 90% (rounded to nearest 5).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Copy + workout alignment:</span> Day/lift copy text,
                    calibration updates, and workout profile lookups now follow each client&apos;s selected movement mapping.
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
          <Button onClick={handleSave} disabled={!hasDirtyChanges || isSavingAll}>
            {isSavingAll ? "Saving..." : hasDirtyChanges ? "Save Changes" : "No Changes"}
          </Button>
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
