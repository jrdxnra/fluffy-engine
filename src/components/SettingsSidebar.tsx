"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
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
import {
  Weight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { Client, CycleSettings, Lift, TrainingGroup } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { getActiveTrainingGroups, getClientsInTrainingGroup } from "@/lib/training-groups";
import { OneRmCalcModal } from "@/components/OneRmCalcModal";
import { useEffect, useState } from "react";
import { WeekOptionsModal } from "@/components/WeekOptionsModal";
import { useAdminModeContext } from "@/contexts/AdminModeContext";

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
  trainingGroups?: TrainingGroup[];
  selectedGroupId?: string | null;
  onGroupSelect?: (groupId: string) => void;
  onGroupSettingsOpen?: (groupId: string) => void;
  currentCycleNumber?: number;
  skipDeloadWeek?: boolean;
  availableCycleNumbers?: number[];
  onCycleChange?: (cycleNumber: number) => void;
  onClientProfile: (client: Client) => void;
  onAiInsight: (client: Client) => void;
  onLogAllReps: () => void;
  isBulkLoggingActive?: boolean;
  onDuplicateWeek: (weekKey: string) => Promise<void>;
  onDeleteWeek: (weekKey: string) => Promise<boolean>;
  globalSettingsControl?: React.ReactNode;
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
  trainingGroups = [],
  selectedGroupId = null,
  onGroupSelect,
  onGroupSettingsOpen,
  currentCycleNumber = 1,
  skipDeloadWeek = false,
  availableCycleNumbers = [],
  onCycleChange,
  onClientProfile,
  onAiInsight,
  onLogAllReps,
  isBulkLoggingActive = false,
  onDuplicateWeek,
  onDeleteWeek,
  globalSettingsControl,
}: SettingsSidebarProps) {
    const { isAdminMode } = useAdminModeContext();
  void onAiInsight;
  void onLogAllReps;
  void isBulkLoggingActive;
  void isAdminMode;
    const [openGroupIds, setOpenGroupIds] = useState<string[]>([]);

    const [isWeekOptionsOpen, setIsWeekOptionsOpen] = useState(false);
    const [selectedWeekForOptions, setSelectedWeekForOptions] = useState<string | null>(null);

    const sortedCycleNumbers = (availableCycleNumbers.length > 0
      ? [...availableCycleNumbers]
      : [1, ...clients.map(c => c.currentCycleNumber || 1)]
    )
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b);

    const currentCycleIndex = sortedCycleNumbers.indexOf(currentCycleNumber);
    const prevCycleNumber = currentCycleIndex > 0 ? sortedCycleNumbers[currentCycleIndex - 1] : null;
    const nextCycleNumber =
      currentCycleIndex >= 0 && currentCycleIndex < sortedCycleNumbers.length - 1
        ? sortedCycleNumbers[currentCycleIndex + 1]
        : null;

    const handleWeekClick = (weekKey: string) => {
      console.info("[week-nav-debug] sidebar week double-click", {
        weekKey,
        currentWeek,
        currentCycleNumber,
        href: typeof window !== "undefined" ? window.location.href : undefined,
      });
      setSelectedWeekForOptions(weekKey);
      setIsWeekOptionsOpen(true);
    };

    const handleWeekSelect = (weekKey: string) => {
      console.info("[week-nav-debug] sidebar week button click", {
        weekKey,
        currentWeek,
        currentCycleNumber,
        href: typeof window !== "undefined" ? window.location.href : undefined,
      });
      onWeekChange(weekKey);
    };

    const isDeloadWeek = (weekKey: string, weekName: string) => {
      return weekName.toLowerCase().includes("deload");
    };

    const currentWeekName = cycleSettings[currentWeek]?.name || currentWeek;
    const currentWeekSchemeLabel = getRepScheme(cycleSettings[currentWeek]?.reps?.workset3);
    const currentWeekIsSkippedDeload =
      skipDeloadWeek && isDeloadWeek(currentWeek, currentWeekName);
    const activeTrainingGroups = getActiveTrainingGroups(trainingGroups);

    const toggleGroupMembers = (groupId: string) => {
      setOpenGroupIds((current) =>
        current.includes(groupId)
          ? current.filter((id) => id !== groupId)
          : [...current, groupId]
      );
    };

    useEffect(() => {
      console.info("[week-nav-debug] sidebar props snapshot", {
        currentWeek,
        currentCycleNumber,
        weekKeys: Object.keys(cycleSettings),
      });
    }, [currentWeek, currentCycleNumber, cycleSettings]);

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
                          type="button"
                          onClick={() => handleWeekSelect(weekKey)}
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
          <SidebarMenu>
            {activeTrainingGroups.map((group) => {
              const groupClients = getClientsInTrainingGroup(clients, group.id);
              const areMembersOpen = openGroupIds.includes(group.id);

              return (
                <SidebarMenuItem key={group.id}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => toggleGroupMembers(group.id)}
                        aria-label={`${areMembersOpen ? "Collapse" : "Expand"} ${group.name}`}
                      >
                        {areMembersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <SidebarMenuButton
                        type="button"
                        isActive={selectedGroupId === group.id}
                        onClick={() => onGroupSelect?.(group.id)}
                        onDoubleClick={() => onGroupSettingsOpen?.(group.id)}
                        className="flex-1"
                      >
                        <span>{group.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{groupClients.length}</span>
                      </SidebarMenuButton>
                    </div>
                    {areMembersOpen ? (
                      <SidebarMenu className="ml-7 border-l pl-2">
                        {groupClients.length === 0 ? (
                          <SidebarMenuItem className="px-2 py-1 text-xs text-muted-foreground">No clients assigned</SidebarMenuItem>
                        ) : groupClients.map((client) => (
                          <SidebarMenuItem key={client.id}>
                            <SidebarMenuButton size="sm" onClick={() => onClientProfile(client)}>
                              <Sparkles className="text-primary" />
                              <span>{client.name}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    ) : null}
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
                            type="button"
                            onClick={() => handleWeekSelect(weekKey)}
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
