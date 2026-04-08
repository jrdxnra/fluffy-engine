"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Client,
  CycleScheduleSettings,
  CycleSettings,
  HistoricalRecord,
  Lift,
  LoggedSetInputsByCycle,
  LoggedSetMap,
  SessionMode,
} from "@/lib/types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { AddClientSheet } from "@/components/AddClientSheet";
import { AiInsightsDialog } from "@/components/AiInsightsDialog";
import { ProgressChartDialog } from "@/components/ProgressChartDialog";
import { ClientProfileModal } from "@/components/ClientProfileModal";
import { ConfigSettingsDialog } from "@/components/ConfigSettingsDialog";
import { AccessoryDisplay } from "@/components/AccessoryDisplay";
import { MobileHeader } from "@/components/dev-dashboard/MobileHeader";
import { MobileActionBar } from "@/components/dev-dashboard/MobileActionBar";
import { MobileWorkoutCard } from "@/components/dev-dashboard/MobileWorkoutCard";
import { useAdminModeContext } from "@/contexts/AdminModeContext";
import { useAdminModeKeyboardToggle } from "@/hooks/use-admin-mode-keyboard-toggle";
import { useToast } from "@/hooks/use-toast";
import { calculateWorkout } from "@/lib/utils";
import {
  getEffectiveCycleSchedule,
  getLiftDaySlot,
  getLiftsForDaySlot,
  getCycleWeekSchedule,
} from "@/lib/schedule";
import { calculateTrainingMaxes } from "@/lib/training-max";
import { formatBasicWorkoutCopyText } from "@/lib/copy-formatter";
import { resolveVisibleAccessories } from "@/lib/accessory-utils";
import {
  upsertClientLoggedSetEntriesAction,
  updateClientProfileAction,
  resetClientTrainingMaxAction,
  deleteClientAction,
  saveCycleSettingsAction,
} from "@/app/actions";
import type { CalculatedWorkout } from "@/lib/types";

type MobileDevShellProps = {
  initialClients: Client[];
  initialCycleSettingsByCycle: Record<number, CycleSettings>;
  initialCycleNames: Record<number, string>;
  initialCycleSchedulesByCycle: Record<number, CycleScheduleSettings>;
  initialHistoricalData: HistoricalRecord[];
};

export function MobileDevShell({
  initialClients,
  initialCycleSettingsByCycle,
  initialCycleNames,
  initialCycleSchedulesByCycle,
  initialHistoricalData,
}: MobileDevShellProps) {
  const { toast } = useToast();
  const { isAdminMode, toggleAdminMode } = useAdminModeContext();
  useAdminModeKeyboardToggle(toggleAdminMode);

  const themeStorageKey = "sbdoh:theme";
  const dayViewStorageKey = "sbdoh:dayViewSlot";

  // ── Core state ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>(() =>
    initialClients.map((client) => {
      const currentCycle = client.currentCycleNumber || 1;
      const trainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
      if (!trainingMaxesByCycle[1]) trainingMaxesByCycle[1] = client.trainingMaxes;
      return { ...client, trainingMaxesByCycle };
    })
  );

  const [historicalData, setHistoricalData] = useState<HistoricalRecord[]>(initialHistoricalData);
  const [cycleSettingsByCycle, setCycleSettingsByCycle] = useState<Record<number, CycleSettings>>(
    () => (Object.keys(initialCycleSettingsByCycle).length > 0 ? initialCycleSettingsByCycle : { 1: {} as CycleSettings })
  );
  const [cycleNames, setCycleNames] = useState<Record<number, string>>(
    () => (Object.keys(initialCycleNames).length > 0 ? initialCycleNames : { 1: "Cycle 1" })
  );
  const [cycleSchedulesByCycle, setCycleSchedulesByCycle] = useState<Record<number, CycleScheduleSettings>>(
    () =>
      Object.keys(initialCycleSchedulesByCycle).length > 0
        ? initialCycleSchedulesByCycle
        : {
            1: {
              cycleStartDate: "",
              day1Weekday: "Tuesday",
              day2Weekday: "Thursday",
              skipDeloadWeek: false,
            },
          }
  );

  const [currentCycleNumber, setCurrentCycleNumber] = useState<number>(() =>
    initialClients.length > 0 ? (initialClients[0]?.currentCycleNumber || 1) : 1
  );
  const [currentWeek, setCurrentWeek] = useState<string>("week1");
  const [lift, setLift] = useState<Lift>("Deadlift");
  const [viewMode, setViewMode] = useState<"day" | "lift">("day");
  const [dayViewSlot, setDayViewSlot] = useState<"day1" | "day2">("day1");

  // Collapse any open card when the visible workout set changes
  const handleLiftChange = (newLift: Lift) => { setFocusedClientId(null); setLift(newLift); };
  const handleViewModeChange = (mode: "day" | "lift") => { setFocusedClientId(null); setActiveDayLift(null); setViewMode(mode); };
  const handleDaySlotChange = (slot: "day1" | "day2") => { setFocusedClientId(null); setActiveDayLift(null); setDayViewSlot(slot); };
  const [showWarmups, setShowWarmups] = useState(false);
  const [focusedClientId, setFocusedClientId] = useState<string | null>(null);
  const [activeDayLift, setActiveDayLift] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── Dialog states ────────────────────────────────────────────────────────────
  const [isAddClientSheetOpen, setAddClientSheetOpen] = useState(false);
  const [isAiDialogOpen, setAiDialogOpen] = useState(false);
  const [isProgressChartOpen, setProgressChartOpen] = useState(false);
  const [isClientProfileOpen, setClientProfileOpen] = useState(false);
  const [selectedClientForAi, setSelectedClientForAi] = useState<Client | null>(null);
  const [selectedClientForProfile, setSelectedClientForProfile] = useState<Client | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const cycleSettings = cycleSettingsByCycle[currentCycleNumber] || cycleSettingsByCycle[1] || ({} as CycleSettings);

  const currentCycleSchedule = useMemo(
    () => getEffectiveCycleSchedule(cycleSchedulesByCycle[currentCycleNumber]),
    [cycleSchedulesByCycle, currentCycleNumber]
  );

  const currentWeekSchedule = useMemo(
    () => getCycleWeekSchedule(currentCycleSchedule, currentWeek),
    [currentCycleSchedule, currentWeek]
  );

  const availableCycles = useMemo(
    () =>
      Object.keys(cycleSettingsByCycle)
        .map(Number)
        .sort((a, b) => a - b)
        .map((n) => ({ cycleNumber: n, name: cycleNames[n] || `Cycle ${n}` })),
    [cycleSettingsByCycle, cycleNames]
  );

  const dayLifts: Lift[] = getLiftsForDaySlot(dayViewSlot, currentCycleSchedule);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(dayViewStorageKey);
    if (stored === "day1" || stored === "day2") setDayViewSlot(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(themeStorageKey);
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: "light" | "dark" =
      stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light";
    document.documentElement.classList.toggle("dark", initial === "dark");
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(dayViewStorageKey, dayViewSlot);
  }, [dayViewSlot]);

  // Auto-select today's day slot
  useEffect(() => {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
    const today = weekdays[new Date().getDay()];
    if (today === currentCycleSchedule.day1Weekday) setDayViewSlot("day1");
    else if (today === currentCycleSchedule.day2Weekday) setDayViewSlot("day2");
  }, [currentCycleSchedule.day1Weekday, currentCycleSchedule.day2Weekday, currentCycleNumber]);

  // Fallback to first available week if current week is gone
  useEffect(() => {
    if (cycleSettings[currentWeek]) return;
    const first = Object.keys(cycleSettings).sort((a, b) => {
      const an = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const bn = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return an - bn;
    })[0];
    if (first) setCurrentWeek(first);
  }, [cycleSettings, currentWeek]);

  // ── Scroll spy: track which lift section is at the top of the viewport ───────
  useEffect(() => {
    if (viewMode !== "day") { setActiveDayLift(null); return; }
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const updateActiveLift = () => {
      const mainTop = mainEl.getBoundingClientRect().top;
      let current: string | null = null;
      for (const [liftName, el] of sectionRefs.current.entries()) {
        const elTop = el.getBoundingClientRect().top - mainTop;
        // The section whose top has scrolled past (or just at) the main top edge
        if (elTop <= 8) current = liftName;
      }
      setActiveDayLift(current);
    };

    mainEl.addEventListener("scroll", updateActiveLift, { passive: true });
    updateActiveLift();
    return () => mainEl.removeEventListener("scroll", updateActiveLift);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, dayViewSlot, currentCycleNumber, dayLifts.join(",")]);

  // ── Theme ────────────────────────────────────────────────────────────────────
  const toggleTheme = () => {
    const next: "light" | "dark" = theme === "dark" ? "light" : "dark";
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
      window.localStorage.setItem(themeStorageKey, next);
    }
    setTheme(next);
  };

  // ── Workout computation ───────────────────────────────────────────────────────
  const getCalculatedWorkoutsForLift = (targetLift: Lift): CalculatedWorkout[] => {
    const weekSettings = cycleSettings[currentWeek];
    if (!weekSettings) {
      return clients.map((client) => ({ client, sets: [], prTarget: undefined }));
    }

    const sortedWeekKeys = Object.keys(cycleSettings).sort((a, b) => {
      const an = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const bn = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return an - bn;
    });

    return clients.map((client) => {
      const sessionState = client.sessionStateByCycle?.[currentCycleNumber];
      const mode: SessionMode =
        sessionState?.modeByWeek?.[currentWeek] || sessionState?.mode || "normal";

      let effectiveWeekKey = currentWeek;
      if (mode === "slide") {
        const flowKey = sessionState?.flowWeekKeyByWeek?.[currentWeek] || sessionState?.flowWeekKey;
        if (flowKey && cycleSettings[flowKey]) {
          effectiveWeekKey = flowKey;
        } else {
          const idx = sortedWeekKeys.indexOf(currentWeek);
          if (idx > 0) effectiveWeekKey = sortedWeekKeys[idx - 1];
        }
      }

      if (mode === "pause_week") {
        return { client, sets: [], prTarget: undefined, sessionMode: mode, effectiveWeekKey };
      }

      const effectiveWeekSettings = cycleSettings[effectiveWeekKey];
      if (!effectiveWeekSettings) {
        return { client, sets: [], prTarget: undefined, sessionMode: mode, effectiveWeekKey };
      }

      const clientAssignments = client.weekAssignmentsByCycle?.[currentCycleNumber] || {};
      const globalScheme =
        String(cycleSettings[effectiveWeekKey]?.reps?.workset3 ?? "").replace(/\D/g, "") || "5";
      const assignedScheme = clientAssignments[effectiveWeekKey] || globalScheme;

      if (assignedScheme === "N/A") {
        return { client, sets: [], prTarget: undefined, sessionMode: mode, effectiveWeekKey };
      }

      const workout = calculateWorkout(
        client,
        targetLift,
        effectiveWeekSettings,
        historicalData,
        currentCycleNumber
      );

      if (mode === "recovery") {
        workout.prTarget = undefined;
        workout.sets = workout.sets.map((s) =>
          s.type === "Work Set" && s.set === 3
            ? { ...s, reps: typeof s.reps === "string" ? s.reps.replace("+", "") : s.reps }
            : s
        );
      }
      if (mode === "jack_shit") {
        workout.prTarget = undefined;
        workout.sets = workout.sets.filter((s) => s.type === "Work Set");
      }

      workout.sessionMode = mode;
      workout.effectiveWeekKey = effectiveWeekKey;
      return workout;
    });
  };

  const liftWorkouts = useMemo(
    () => getCalculatedWorkoutsForLift(lift),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, lift, currentWeek, cycleSettings, historicalData, currentCycleNumber]
  );

  const dayWorkoutsByLift = useMemo(() => {
    const map: Partial<Record<Lift, CalculatedWorkout[]>> = {};
    for (const dl of dayLifts) {
      map[dl] = getCalculatedWorkoutsForLift(dl);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, dayLifts, currentWeek, cycleSettings, historicalData, currentCycleNumber]);

  // ── Header labels ─────────────────────────────────────────────────────────────
  const weekdayAbbr: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tues", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
  };
  const liftAbbr: Record<Lift, string> = { Deadlift: "DL", Bench: "B", Squat: "SQ", Press: "P" };

  const getDayLabel = (slot: "day1" | "day2") => {
    const liftsForSlot = getLiftsForDaySlot(slot, currentCycleSchedule);
    const liftText = liftsForSlot.map((l) => liftAbbr[l]).join("+");
    const weekday = slot === "day1" ? currentWeekSchedule.day1Weekday : currentWeekSchedule.day2Weekday;
    return `${liftText} (${weekdayAbbr[weekday] || weekday.slice(0, 3)})`;
  };

  const currentWeekLabel = cycleSettings[currentWeek]?.name || currentWeek;
  const isDeload =
    parseInt(currentWeek.match(/\d+/)?.[0] || "0", 10) === 4 ||
    currentWeekLabel.toLowerCase().includes("deload");
  const strikeTitle = Boolean(currentCycleSchedule.skipDeloadWeek) && isDeload;

  const sessionTitle =
    viewMode === "day"
      ? `${getDayLabel(dayViewSlot)} · C${currentCycleNumber} ${currentWeekLabel}`
      : `${lift} · C${currentCycleNumber} ${currentWeekLabel}`;

  // ── Action handlers ───────────────────────────────────────────────────────────
  const handleRepRecordUpdate = (record: HistoricalRecord) => {
    setHistoricalData((prev) => [...prev, record]);
  };

  const handlePersistLoggedSets = async ({
    clientId,
    weekKey,
    lift: targetLift,
    setEntries,
  }: {
    clientId: string;
    weekKey: string;
    lift: Lift;
    setEntries: LoggedSetMap;
  }) => {
    const target = clients.find((c) => c.id === clientId);
    if (!target) return;

    const existing = target.loggedSetInputsByCycle || {};
    const cycleData = existing[currentCycleNumber] || {};
    const weekData = cycleData[weekKey] || {};
    const liftData = (weekData[targetLift] as LoggedSetMap) || {};

    const updated: LoggedSetInputsByCycle = {
      ...existing,
      [currentCycleNumber]: {
        ...cycleData,
        [weekKey]: { ...weekData, [targetLift]: { ...liftData, ...setEntries } },
      },
    };

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, loggedSetInputsByCycle: updated } : c))
    );

    const result = await upsertClientLoggedSetEntriesAction({
      clientId,
      cycleNumber: currentCycleNumber,
      weekKey,
      lift: targetLift,
      setEntries,
    });

    if (!result.success) {
      toast({ variant: "destructive", title: "Save Failed", description: result.message });
      return;
    }

    if (result.merged) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId ? { ...c, loggedSetInputsByCycle: result.merged } : c
        )
      );
    }
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    const cycleForClient = updatedClient.currentCycleNumber || currentCycleNumber || 1;
    const cycleOneRepMaxes =
      updatedClient.oneRepMaxesByCycle?.[cycleForClient] || updatedClient.oneRepMaxes;
    const recalcTMs = calculateTrainingMaxes(cycleOneRepMaxes);

    const normalizedClient: Client = {
      ...updatedClient,
      oneRepMaxes: cycleOneRepMaxes,
      trainingMaxes: recalcTMs,
      trainingMaxesByCycle: {
        ...(updatedClient.trainingMaxesByCycle || {}),
        [cycleForClient]: recalcTMs,
      },
    };

    setClients((prev) => prev.map((c) => (c.id === updatedClient.id ? normalizedClient : c)));

    const result = await updateClientProfileAction(normalizedClient.id, {
      oneRepMaxes: normalizedClient.oneRepMaxes,
      trainingMaxes: normalizedClient.trainingMaxes,
      trainingMaxesByCycle: normalizedClient.trainingMaxesByCycle,
      weekAssignmentsByCycle: normalizedClient.weekAssignmentsByCycle,
      sessionStateByCycle: normalizedClient.sessionStateByCycle as Parameters<typeof updateClientProfileAction>[1]["sessionStateByCycle"],
    });

    if (!result.success) {
      toast({ variant: "destructive", title: "Profile Save Failed", description: result.message });
      return;
    }

    setSelectedClientForProfile(null);
    toast({ title: "Profile Updated", description: "Client settings saved." });
  };

  const handleResetClientTrainingMax = async (clientId: string, cycleNumber: number) => {
    const result = await resetClientTrainingMaxAction(clientId, cycleNumber);
    if (!result.success) {
      toast({ variant: "destructive", title: "Reset Failed", description: result.message });
      return;
    }
    if (result.updatedClient) {
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? (result.updatedClient as Client) : c))
      );
      if (selectedClientForProfile?.id === clientId) {
        setSelectedClientForProfile(result.updatedClient as Client);
      }
    }
    toast({ title: "Training Max Reset", description: result.message });
  };

  const handleDeleteClient = async (clientId: string) => {
    const result = await deleteClientAction(clientId);
    if (!result.success) {
      toast({ variant: "destructive", title: "Delete Failed", description: result.message });
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    if (selectedClientForProfile?.id === clientId) {
      setSelectedClientForProfile(null);
      setClientProfileOpen(false);
    }
    toast({ title: "Client Deleted", description: "Removed from roster." });
  };

  const handleUpdateCycleSettings = async (cycleNumber: number, newSettings: CycleSettings) => {
    const updated = { ...cycleSettingsByCycle, [cycleNumber]: newSettings };
    setCycleSettingsByCycle(updated);
    await saveCycleSettingsAction(updated, cycleNames, cycleSchedulesByCycle).catch(console.error);
  };

  const handleUpdateCycleSchedule = async (cycleNumber: number, schedule: CycleScheduleSettings) => {
    const updated = { ...cycleSchedulesByCycle, [cycleNumber]: schedule };
    setCycleSchedulesByCycle(updated);
    await saveCycleSettingsAction(cycleSettingsByCycle, cycleNames, updated).catch(console.error);
  };

  // ── Copy text builder ──────────────────────────────────────────────────────────
  const buildCopyText = (workout: CalculatedWorkout): string => {
    const effectiveWeekKey = workout.effectiveWeekKey || currentWeek;
    const accessories = resolveVisibleAccessories(cycleSettings, effectiveWeekKey, lift);
    const persistedSetMap =
      workout.client.loggedSetInputsByCycle?.[currentCycleNumber]?.[effectiveWeekKey]?.[lift] || {};

    return formatBasicWorkoutCopyText({
      lift,
      sets: workout.sets,
      accessories,
      persistedSetMap,
    });
  };

  // ── Sidebar controls ──────────────────────────────────────────────────────────
  const sidebarTopControls = null;

  // ── Render ────────────────────────────────────────────────────────────────────
  const renderWorkoutCards = (workouts: CalculatedWorkout[], cardLift: Lift) =>
    workouts.map((workout) => (
      <MobileWorkoutCard
        key={workout.client.id}
        workout={workout}
        lift={cardLift}
        currentWeek={currentWeek}
        currentCycleNumber={currentCycleNumber}
        showWarmups={showWarmups}
        isExpanded={focusedClientId === workout.client.id}
        onToggle={() =>
          setFocusedClientId((prev) =>
            prev === workout.client.id ? null : workout.client.id
          )
        }
        onPersistLoggedSets={handlePersistLoggedSets}
        onRepRecordUpdate={handleRepRecordUpdate}
        onCopyText={buildCopyText}
      />
    ));

  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setIsSidebarOpen} className="h-svh">
      {/*
        SidebarProvider renders a flex-row div. SettingsSidebar (the panel)
        must be the first direct child; everything else goes inside a
        flex-col wrapper so the header/content/action-bar stack vertically.
      */}
      <SettingsSidebar
        lift={lift}
        onLiftChange={setLift}
        showLiftSelector={false}
        showCycleSelector={true}
        footerSelectors={true}
        topControls={sidebarTopControls}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
        cycleSettings={cycleSettings}
        clients={clients}
        currentCycleNumber={currentCycleNumber}
        skipDeloadWeek={Boolean(currentCycleSchedule.skipDeloadWeek)}
        availableCycleNumbers={availableCycles.map((c) => c.cycleNumber)}
        onCycleChange={setCurrentCycleNumber}
        onAddClient={() => setAddClientSheetOpen(true)}
        onClientProfile={(client) => {
          setSelectedClientForProfile(client);
          setClientProfileOpen(true);
        }}
        onAiInsight={(client) => {
          setSelectedClientForAi(client);
          setAiDialogOpen(true);
        }}
        onReorderClient={() => {}}
        onLogAllReps={() => {}}
        isBulkLoggingActive={false}
        onDuplicateWeek={async (_weekKey: string): Promise<void> => {}}
        onDeleteWeek={async (_weekKey: string): Promise<boolean> => false}
        onGraduateTeam={() => {}}
      />

      {/* Column wrapper: sticky header + scrollable content + fixed bottom bar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader
          title={sessionTitle}
          strikeTitle={strikeTitle}
          theme={theme}
          onToggleTheme={toggleTheme}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          dayViewSlot={dayViewSlot}
          onDayViewSlotChange={handleDaySlotChange}
          day1Label={getDayLabel("day1")}
          day2Label={getDayLabel("day2")}
          lift={lift}
          onLiftChange={handleLiftChange}
          scrollLift={activeDayLift ?? undefined}
          onTitleClick={() => {
            if (viewMode !== "day" || dayLifts.length === 0) return;
            const currentIdx = activeDayLift ? dayLifts.indexOf(activeDayLift as Lift) : -1;
            const nextLift = dayLifts[(currentIdx + 1) % dayLifts.length];
            const el = sectionRefs.current.get(nextLift);
            const mainEl = mainRef.current;
            if (!el || !mainEl) return;
            const mainRect = mainEl.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            mainEl.scrollBy({ top: elRect.top - mainRect.top, behavior: "smooth" });
          }}
        />

      {/* Main scrollable content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto px-3 pb-20 pt-2">
        {viewMode === "lift" ? (
          <div className="flex flex-col gap-3">
            {renderWorkoutCards(liftWorkouts, lift)}
            <AccessoryDisplay lift={lift} cycleSettings={cycleSettings} currentWeek={currentWeek} />
          </div>
        ) : (
          <div className="space-y-5">
            {dayLifts.length === 0 ? (
              <p className="rounded border p-3 text-sm text-muted-foreground">
                No movements assigned to this day. Configure in Settings → Cycle Schedule.
              </p>
            ) : null}
            {dayLifts.map((dayLift, idx) => (
              <div
                key={dayLift}
                ref={(el) => {
                  if (el) sectionRefs.current.set(dayLift, el);
                  else sectionRefs.current.delete(dayLift);
                }}
                className={idx > 0 ? "border-t border-border/50 pt-4" : undefined}
              >
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayLift}
                </h2>
                <div className="flex flex-col gap-3">
                  {renderWorkoutCards(dayWorkoutsByLift[dayLift] || [], dayLift)}
                </div>
              </div>
            ))}
            <AccessoryDisplay
              lifts={dayLifts}
              cycleSettings={cycleSettings}
              currentWeek={currentWeek}
            />
          </div>
        )}
      </main>

      {/* Sticky bottom action bar */}
      <MobileActionBar
        showWarmups={showWarmups}
        onToggleWarmups={() => setShowWarmups((v) => !v)}
        isAdmin={isAdminMode}
      />
      </div>{/* end column wrapper */}

      {/* Config dialog — rendered in fixed position; admin users access via its own Settings trigger */}
      {isAdminMode && (
        <div className="fixed bottom-20 right-4 z-40">
          <ConfigSettingsDialog
            cycleSettingsByCycle={cycleSettingsByCycle}
            onUpdateCycleSettings={handleUpdateCycleSettings}
            cycleSchedulesByCycle={cycleSchedulesByCycle}
            onUpdateCycleSchedule={handleUpdateCycleSchedule}
            currentWeekKey={currentWeek}
            cycles={availableCycles}
            currentCycleNumber={currentCycleNumber}
            onRenameCycle={async (cycleNumber, newName) => {
              const updated = { ...cycleNames, [cycleNumber]: newName };
              setCycleNames(updated);
              await saveCycleSettingsAction(cycleSettingsByCycle, updated, cycleSchedulesByCycle).catch(console.error);
            }}
            onDeleteCycle={async (_cycleNumber: number): Promise<void> => {}}
            onCycleChange={setCurrentCycleNumber}
          />
        </div>
      )}

      {/* Shared dialogs */}
      <AddClientSheet
        open={isAddClientSheetOpen}
        onOpenChange={setAddClientSheetOpen}
        onClientAdded={(newClient) => setClients((prev) => [...prev, newClient])}
      />
      <AiInsightsDialog
        open={isAiDialogOpen}
        onOpenChange={setAiDialogOpen}
        client={selectedClientForAi}
        lift={lift}
        cycleSettings={cycleSettings}
        currentWeek={currentWeek}
        historicalData={historicalData}
        onOpenChart={() => setProgressChartOpen(true)}
      />
      <ProgressChartDialog
        open={isProgressChartOpen}
        onOpenChange={setProgressChartOpen}
        client={selectedClientForAi}
        lift={lift}
        historicalData={historicalData}
      />
      <ClientProfileModal
        open={isClientProfileOpen}
        onOpenChange={setClientProfileOpen}
        client={selectedClientForProfile}
        cycleSettings={cycleSettings}
        currentGlobalWeek={currentWeek}
        currentCycleNumber={currentCycleNumber}
        historicalData={historicalData}
        onUpdateClient={handleUpdateClient}
        onResetTrainingMax={handleResetClientTrainingMax}
        onDeleteClient={handleDeleteClient}
      />
    </SidebarProvider>
  );
}
