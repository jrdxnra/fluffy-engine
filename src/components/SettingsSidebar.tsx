"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Weight,
  Plus,
  Users,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Client, CycleSettings, Lift } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { OneRmCalcModal } from "@/components/OneRmCalcModal";
import { useToast } from "@/hooks/use-toast";
import { graduateTeamAction } from "@/app/actions";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { WeekOptionsModal } from "@/components/WeekOptionsModal";
import { Switch } from "@/components/ui/switch";
import { useAdminModeContext } from "@/contexts/AdminModeContext";

type DaySlot = "day1" | "day2";

type GraduationOverrides = {
  cycleStartDate: string;
  day1Weekday: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  day2Weekday: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  liftDayAssignments: Record<Lift, DaySlot>;
  liftDisplayNames: Record<Lift, string>;
  calibrationLifts: Lift[];
  skipDeloadWeek: boolean;
};

// Helper function to extract rep scheme from week settings
const getRepScheme = (workset3Reps: string | number | undefined): string => {
  if (workset3Reps === undefined) return '?';
  const repNum = typeof workset3Reps === 'string' 
    ? workset3Reps.replace(/\D/g, '') // Extract digits from "5+", "3+", "1+"
    : workset3Reps.toString();
  return repNum || '?';
};

type SettingsSidebarProps = {
  lift: Lift;
  onLiftChange: (lift: Lift) => void;
  showLiftSelector?: boolean;
  showCycleSelector?: boolean;
  footerSelectors?: boolean;
  topControls?: React.ReactNode;
  currentWeek: string;
  onWeekChange: (week: string) => void;
  cycleSettings: CycleSettings;
  clients: Client[];
  currentCycleNumber?: number;
  skipDeloadWeek?: boolean;
  availableCycleNumbers?: number[];
  onCycleChange?: (cycleNumber: number) => void;
  onAddClient: () => void;
  onClientProfile: (client: Client) => void;
  onAiInsight: (client: Client) => void;
  onReorderClient: (clientId: string, direction: "up" | "down") => void;
  onLogAllReps: () => void;
  isBulkLoggingActive?: boolean;
  onDuplicateWeek: (weekKey: string) => Promise<void>;
  onDeleteWeek: (weekKey: string) => Promise<boolean>;
  onGraduateTeam?: (updatedClients: Client[], newCycleNumber: number, overrides: GraduationOverrides) => void;
  canGraduate?: boolean;
  globalMovementOptions?: string[];
  globalSettingsControl?: React.ReactNode;
  currentCycleSchedule?: {
    cycleStartDate?: string;
    day1Weekday?: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
    day2Weekday?: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
    skipDeloadWeek?: boolean;
    liftDayAssignments?: Partial<Record<Lift, DaySlot>>;
    liftDisplayNames?: Partial<Record<Lift, string>>;
  };
};

export function SettingsSidebar({
  lift,
  onLiftChange,
  showLiftSelector = true,
  showCycleSelector = true,
  footerSelectors = false,
  topControls,
  currentWeek,
  onWeekChange,
  cycleSettings,
  clients,
  currentCycleNumber = 1,
  skipDeloadWeek = false,
  availableCycleNumbers = [],
  onCycleChange,
  onAddClient,
  onClientProfile,
  onAiInsight,
  onReorderClient,
  onLogAllReps,
  isBulkLoggingActive = false,
  onDuplicateWeek,
  onDeleteWeek,
  onGraduateTeam,
  canGraduate = true,
  globalMovementOptions = ["Deadlift", "Bench", "Squat", "Press"],
  globalSettingsControl,
  currentCycleSchedule,
}: SettingsSidebarProps) {
    const { toast } = useToast();
    const { isAdminMode } = useAdminModeContext();
    const [isGraduating, setIsGraduating] = useState(false);
    const [isGraduateModalOpen, setIsGraduateModalOpen] = useState(false);
    const [isWeekOptionsOpen, setIsWeekOptionsOpen] = useState(false);
    const [selectedWeekForOptions, setSelectedWeekForOptions] = useState<string | null>(null);
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
    const weekdayOptions: GraduationOverrides["day1Weekday"][] = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

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

    const defaultLiftAssignments = useMemo(
      () => ({
        Deadlift: currentCycleSchedule?.liftDayAssignments?.Deadlift || "day1",
        Bench: currentCycleSchedule?.liftDayAssignments?.Bench || "day1",
        Squat: currentCycleSchedule?.liftDayAssignments?.Squat || "day2",
        Press: currentCycleSchedule?.liftDayAssignments?.Press || "day2",
      }),
      [currentCycleSchedule]
    );

    const defaultLiftDisplayNames = useMemo(
      () => ({
        Deadlift: currentCycleSchedule?.liftDisplayNames?.Deadlift || "Deadlift",
        Bench: currentCycleSchedule?.liftDisplayNames?.Bench || "Bench",
        Squat: currentCycleSchedule?.liftDisplayNames?.Squat || "Squat",
        Press: currentCycleSchedule?.liftDisplayNames?.Press || "Press",
      }),
      [currentCycleSchedule]
    );

    const sortedCycleNumbers = (availableCycleNumbers.length > 0
      ? [...availableCycleNumbers]
      : [1, ...clients.map(c => c.currentCycleNumber || 1)]
    )
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b);

    const currentCycleIndex = sortedCycleNumbers.indexOf(currentCycleNumber);
    const graduationCandidates = clients;
    const prevCycleNumber = currentCycleIndex > 0 ? sortedCycleNumbers[currentCycleIndex - 1] : null;
    const nextCycleNumber =
      currentCycleIndex >= 0 && currentCycleIndex < sortedCycleNumbers.length - 1
        ? sortedCycleNumbers[currentCycleIndex + 1]
        : null;

    const handleWeekClick = (weekKey: string) => {
      setSelectedWeekForOptions(weekKey);
      setIsWeekOptionsOpen(true);
    };

    const isDeloadWeek = (weekKey: string, weekName: string) => {
      return weekName.toLowerCase().includes("deload");
    };

    const currentWeekName = cycleSettings[currentWeek]?.name || currentWeek;
    const currentWeekSchemeLabel = getRepScheme(cycleSettings[currentWeek]?.reps?.workset3);
    const currentWeekIsSkippedDeload =
      skipDeloadWeek && isDeloadWeek(currentWeek, currentWeekName);

    const openGraduateModal = () => {
      const cycleLengthWeeks = currentCycleSchedule?.skipDeloadWeek ? 3 : 4;
      const inferredStartDate = addDaysToIso(currentCycleSchedule?.cycleStartDate || "", cycleLengthWeeks * 7);
      setNextCycleStartDate(inferredStartDate);
      setNextDay1Weekday(currentCycleSchedule?.day1Weekday || "Tuesday");
      setNextDay2Weekday(currentCycleSchedule?.day2Weekday || "Thursday");
      setNextLiftDayAssignments(defaultLiftAssignments);
      setNextLiftDisplayNames(defaultLiftDisplayNames);
      setSelectedGraduateClientIds(graduationCandidates.map((client) => client.id));
      setNextSkipDeloadWeek(false);
      setIsGraduateModalOpen(true);
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
        });
        if (result.success) {
            toast({
                title: "Success!",
                description: result.message,
            });
            // Notify parent component to update cycle number
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
            setIsGraduateModalOpen(false);
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to graduate team.",
            });
        }
        setIsGraduating(false);
    }

  return (
    <>
    <Sidebar
      variant="sidebar"
      collapsible="offcanvas"
      className="border-r"
      side="left"
    >
      <SidebarContent>
        <SidebarHeader>
          {topControls ? <div className="space-y-1">{topControls}</div> : null}
          {showLiftSelector ? (
            <div className="space-y-1">
              <Label>Main Lift</Label>
              <Select value={lift} onValueChange={(value) => onLiftChange(value as Lift)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lift" />
                </SelectTrigger>
                <SelectContent>
                  {Lifts.map((l) => (
                    <SelectItem key={l} value={l}>
                      <div className="flex items-center gap-2">
                        <Weight className="h-4 w-4" /> {l}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {!footerSelectors && showCycleSelector ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => prevCycleNumber && onCycleChange?.(prevCycleNumber)}
                  disabled={prevCycleNumber === null}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">Cycle {currentCycleNumber}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => nextCycleNumber && onCycleChange?.(nextCycleNumber)}
                  disabled={nextCycleNumber === null}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
          {!footerSelectors ? (
            <div className="space-y-1">
              <div className={`mb-2 text-xs font-semibold text-primary ${currentWeekIsSkippedDeload ? "line-through opacity-70" : ""}`}>
                {currentWeekName}
                {currentWeekIsSkippedDeload ? " (Skipped)" : ""}
              </div>
              <div className="mb-2 text-[10px] text-muted-foreground">
                Click to open week, double-click for options.
              </div>
              <div
                className={`grid w-full ${
                  Object.keys(cycleSettings).length > 3 ? "grid-cols-4" : "grid-cols-3"
                } h-auto gap-0 border rounded-md overflow-hidden`}
              >
                {Object.keys(cycleSettings)
                  .sort((a, b) => {
                    const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
                    const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
                    return aNum - bNum;
                  })
                  .map((weekKey) => {
                    const weekName = cycleSettings[weekKey].name;
                    const shouldStrikeDeload = skipDeloadWeek && isDeloadWeek(weekKey, weekName);
                    return (
                      <div key={weekKey} className="flex-1 border-r last:border-r-0">
                        <button
                          onClick={() => onWeekChange(weekKey)}
                          onDoubleClick={() => handleWeekClick(weekKey)}
                          className={`w-full px-1 py-2 text-xs hover:bg-muted rounded-none text-center cursor-pointer transition-colors ${
                            currentWeek === weekKey ? 'bg-muted border-b-2 border-b-primary' : ''
                          }`}
                          title="Click to open week. Double-click for week options."
                        >
                          <div className="flex flex-col items-center leading-tight">
                            <span className={`font-medium ${shouldStrikeDeload ? "line-through opacity-70" : ""}`}>
                              {weekName}
                            </span>
                            <span className="text-xxs text-muted-foreground">
                              ({getRepScheme(cycleSettings[weekKey].reps.workset3)})
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </SidebarHeader>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center">
            <Users className="mr-2" />
            All Clients ({clients.length})
          </SidebarGroupLabel>
          <SidebarMenu>
            {clients.map((client, index) => {
              return (
                <SidebarMenuItem key={client.id}>
                  <div className="flex items-center gap-1 w-full">
                    <SidebarMenuButton
                      className="justify-start flex-1 min-w-0"
                      size="default"
                      onClick={() => onClientProfile(client)}
                      tooltip={{
                        children: `Edit profile for ${client.name}`,
                        side: "right",
                        align: "center",
                      }}
                    >
                      <Sparkles className="text-primary" />
                      <span>{client.name}</span>
                    </SidebarMenuButton>
                    <div className="flex flex-col">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        disabled={index === 0}
                        onClick={() => onReorderClient(client.id, "up")}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        disabled={index === clients.length - 1}
                        onClick={() => onReorderClient(client.id, "down")}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {/* Cycle + week selectors — only in footer when footerSelectors=true (mobile) */}
          {footerSelectors && showCycleSelector ? (
            <SidebarMenuItem>
              <div className="px-1 pb-1 space-y-2">
                <div className={`text-xs font-semibold text-primary ${currentWeekIsSkippedDeload ? "line-through opacity-70" : ""}`}>
                  {currentWeekName} ({currentWeekSchemeLabel}){currentWeekIsSkippedDeload ? " (Skipped)" : ""}
                </div>
                <div
                  className={`grid w-full ${
                    Object.keys(cycleSettings).length > 3 ? "grid-cols-4" : "grid-cols-3"
                  } h-auto gap-0 border rounded-md overflow-hidden`}
                >
                  {Object.keys(cycleSettings)
                    .sort((a, b) => {
                      const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
                      const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
                      return aNum - bNum;
                    })
                    .map((weekKey) => {
                      const weekName = cycleSettings[weekKey].name;
                      const shouldStrikeDeload = skipDeloadWeek && isDeloadWeek(weekKey, weekName);
                      return (
                        <div key={weekKey} className="flex-1 border-r last:border-r-0">
                          <button
                            onClick={() => onWeekChange(weekKey)}
                            onDoubleClick={() => handleWeekClick(weekKey)}
                            className={`w-full px-1 py-2 text-xs hover:bg-muted rounded-none text-center cursor-pointer transition-colors ${
                              currentWeek === weekKey ? 'bg-muted border-b-2 border-b-primary' : ''
                            }`}
                            title="Click to open week. Double-click for week options."
                          >
                            <div className="flex flex-col items-center leading-tight">
                              <span className={`font-medium ${shouldStrikeDeload ? "line-through opacity-70" : ""}`}>
                                {weekName}
                              </span>
                              <span className="text-xxs text-muted-foreground">
                                ({getRepScheme(cycleSettings[weekKey].reps.workset3)})
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => prevCycleNumber && onCycleChange?.(prevCycleNumber)}
                    disabled={prevCycleNumber === null}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">Cycle {currentCycleNumber}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => nextCycleNumber && onCycleChange?.(nextCycleNumber)}
                    disabled={nextCycleNumber === null}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onAddClient} tooltip="Add New Client">
              <Plus /> <span>Add Client</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Dialog open={isGraduateModalOpen} onOpenChange={setIsGraduateModalOpen}>
              <DialogTrigger asChild>
                <SidebarMenuButton
                  variant="outline"
                  tooltip="Graduate Team"
                  disabled={isGraduating || !canGraduate}
                  onClick={openGraduateModal}
                >
                  <TrendingUp /> <span>Graduate Team</span>
                </SidebarMenuButton>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Graduate Team</DialogTitle>
                  <DialogDescription>
                    Confirm the next-cycle schedule before graduation. This advances all clients and keeps the next cycle explicit.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
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
                      Deadlift/Squat = lower (+10 per cycle), Bench/Press = upper (+5 per cycle).
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {Lifts.map((movement) => (
                        <div key={`graduate-movement-day-${movement}`} className="space-y-2 rounded-md border border-border/70 p-2">
                          <Label className="text-xs text-muted-foreground">
                            Track Slot: {movement} {movement === "Squat" || movement === "Deadlift" ? "(Lower +10)" : "(Upper +5)"}
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsGraduateModalOpen(false)} disabled={isGraduating}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleGraduateTeam} disabled={isGraduating}>
                    {isGraduating ? "Graduating..." : "Confirm & Graduate"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex w-full items-center">
              <div className="flex flex-1 justify-center">
                <a
                  href="/how-to.html"
                  className="px-2 py-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  How To
                </a>
              </div>
              <div className="flex flex-1 justify-center">
                <OneRmCalcModal />
              </div>
              <div className="flex flex-1 justify-center">
                {globalSettingsControl}
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    <WeekOptionsModal
      open={isWeekOptionsOpen}
      onOpenChange={setIsWeekOptionsOpen}
      weekKey={selectedWeekForOptions}
      cycleSettings={cycleSettings}
      onDuplicateWeek={onDuplicateWeek}
      onDeleteWeek={onDeleteWeek}
    />
    </>
  );
}
