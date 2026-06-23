"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Minus,
  RefreshCw,
  TriangleAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { buildAdminAnalyticsReport, type ClientAnalytics } from "@/lib/admin-analytics";
import type { Client, HistoricalRecord, Lift, CycleScheduleSettings } from "@/lib/types";

const statusBadgeClassNames: Record<string, string> = {
  "on-track": "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "needs-adjustment": "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  inactive: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "needs-data": "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const activityLabel: Record<string, string> = {
  active: "Active",
  watch: "Watch",
  inactive: "Inactive",
};

const activityBadgeClassNames: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  watch: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  inactive: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const statusLabel: Record<string, string> = {
  "on-track": "On track",
  "needs-adjustment": "Needs adjustment",
  inactive: "Inactive",
  "needs-data": "Needs data",
};

type AdminAnalyticsDashboardProps = {
  clients: Client[];
  historicalData: HistoricalRecord[];
  cycleSchedulesByCycle: Record<number, CycleScheduleSettings>;
  initialSelectedClientIds?: string[] | null;
  initialActiveClientId?: string | null;
  initialHistoricalOpen?: boolean;
};

export function AdminAnalyticsDashboard({
  clients,
  historicalData,
  cycleSchedulesByCycle,
  initialActiveClientId = null,
  initialHistoricalOpen = false,
}: AdminAnalyticsDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [localHistoricalData, setLocalHistoricalData] = useState(historicalData);
  const [activeClientId, setActiveClientId] = useState<string | null>(initialActiveClientId);
  const [selectedCycleView, setSelectedCycleView] = useState<number | "all" | null>(null);
  const [isHistoricalOpen, setIsHistoricalOpen] = useState(initialHistoricalOpen);
  const [navigatingRecordKey, setNavigatingRecordKey] = useState<string | null>(null);
  const [reviewingRecordKey, setReviewingRecordKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    console.info("[nav-debug] analytics mount", {
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      historyLength: window.history.length,
    });

    const onPopState = () => {
      console.info("[nav-debug] analytics popstate", {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        historyLength: window.history.length,
      });
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      console.info("[nav-debug] analytics unmount", {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
      });
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const searchParamsString = searchParams.toString();

  useEffect(() => {
    if (typeof window === "undefined") return;

    console.info("[nav-debug] analytics route", {
      pathname,
      search: searchParamsString,
      href: window.location.href,
    });

    const handlePopState = () => {
      console.info("[nav-debug] analytics popstate", {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [pathname, searchParamsString]);

  useEffect(() => {
    const now = new Date();
    const isFriday = now.getDay() === 5;
    if (!isFriday) return;

    const todayKey = now.toISOString().slice(0, 10);
    const localStorageKey = "admin-analytics-last-friday-refresh";
    const lastFridayRefresh = window.localStorage.getItem(localStorageKey);
    if (lastFridayRefresh === todayKey) return;

    window.localStorage.setItem(localStorageKey, todayKey);
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router]);

  const handleManualRefresh = () => {
    startRefreshTransition(() => {
      router.refresh();
    });
  };

  const report = useMemo(() => {
    return buildAdminAnalyticsReport(clients, localHistoricalData, new Date(), cycleSchedulesByCycle);
  }, [clients, localHistoricalData, cycleSchedulesByCycle]);

  const selectableClients = useMemo(() => {
    const reportByClientId = new Map(report.clients.map((client) => [client.clientId, client] as const));

    return clients
      .slice()
      .sort((a, b) => {
        const aOrder = typeof a.rosterOrder === "number" ? a.rosterOrder : Number.MAX_SAFE_INTEGER;
        const bOrder = typeof b.rosterOrder === "number" ? b.rosterOrder : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      })
      .map((client) => reportByClientId.get(client.id))
      .filter((client): client is NonNullable<typeof client> => Boolean(client));
  }, [clients, report.clients]);

  const filteredSelectableClients = selectableClients;

  const activeClient = useMemo(() => {
    if (selectableClients.length === 0) return null;
    return selectableClients.find((client) => client.clientId === activeClientId)
      || filteredSelectableClients[0]
      || selectableClients[0];
  }, [activeClientId, filteredSelectableClients, selectableClients]);

  const activeClientRecords = useMemo(() => {
    if (!activeClient) return [];
    return localHistoricalData
      .filter((record) => record.clientId === activeClient.clientId)
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 25);
  }, [activeClient, localHistoricalData]);

  const liftBaselineByLift = useMemo(() => {
    if (!activeClient) return {} as Record<string, number>;
    return Object.fromEntries(
      activeClient.liftAnalytics.map((lift) => [
        lift.lift,
        lift.currentTrainingMax > 0 ? lift.currentTrainingMax / 0.9 : 0,
      ])
    ) as Record<string, number>;
  }, [activeClient]);

  const clientById = useMemo(() => {
    return new Map(clients.map((client) => [client.id, client] as const));
  }, [clients]);

  const activeSourceClient = useMemo(() => {
    if (!activeClient) return null;
    return clientById.get(activeClient.clientId) || null;
  }, [activeClient, clientById]);

  const getMovementNameForClient = (client: ClientAnalytics, lift: Lift): string => {
    const sourceClient = clientById.get(client.clientId);
    if (!sourceClient) return lift;
    const currentCycleNumber = client.currentCycleNumber || 1;
    return (
      sourceClient.movementSelectionByCycle?.[currentCycleNumber]?.[lift] ||
      lift
    ).trim();
  };

  const availableCycles = useMemo(() => {
    if (!activeSourceClient) return [];
    return getClientCycleNumbers(activeSourceClient);
  }, [activeSourceClient]);

  useEffect(() => {
    if (!activeClient) {
      setSelectedCycleView(null);
      return;
    }

    setSelectedCycleView((previous) => {
      if (previous === "all") return previous;
      if (typeof previous === "number" && availableCycles.includes(previous)) return previous;
      return activeClient.currentCycleNumber || availableCycles[availableCycles.length - 1] || 1;
    });
  }, [activeClient, availableCycles]);

  const clientAnalyticsByCycle = useMemo(() => {
    const map = new Map<number, (typeof selectableClients)[number]>();
    if (!activeSourceClient) return map;

    for (const cycleNumber of availableCycles) {
      const reportForCycle = buildAdminAnalyticsReport(
        [{ ...activeSourceClient, currentCycleNumber: cycleNumber }],
        localHistoricalData,
        new Date(),
        cycleSchedulesByCycle,
      );
      const cycleAnalytics = reportForCycle.clients[0];
      if (cycleAnalytics) map.set(cycleNumber, cycleAnalytics);
    }

    return map;
  }, [activeSourceClient, availableCycles, cycleSchedulesByCycle, localHistoricalData]);

  const detailClient = useMemo(() => {
    if (!activeClient) return null;
    if (typeof selectedCycleView === "number") {
      return clientAnalyticsByCycle.get(selectedCycleView) || activeClient;
    }
    return activeClient;
  }, [activeClient, clientAnalyticsByCycle, selectedCycleView]);

  const allCycleReview = useMemo(() => {
    const rows: Array<{ cycleNumber: number; analytics: (typeof selectableClients)[number] }> = [];
    for (const cycleNumber of availableCycles) {
      const analytics = clientAnalyticsByCycle.get(cycleNumber);
      if (analytics) rows.push({ cycleNumber, analytics });
    }
    return rows;
  }, [availableCycles, clientAnalyticsByCycle]);

  const getRecordUiKey = (record: HistoricalRecord) => {
    return record.id || `${record.clientId}-${record.lift}-${record.date}-${record.weight}-${record.reps}`;
  };

  const toDayStamp = (iso: string): number | null => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  };

  const resolveSessionContext = (client: Client, record: HistoricalRecord): { cycleNumber: number; weekKey: string } => {
    const defaultContext = {
      cycleNumber: client.currentCycleNumber || 1,
      weekKey: "week1",
    };

    const cycleEntries = client.loggedSetInputsByCycle || {};
    const recordDayStamp = toDayStamp(record.date);
    if (recordDayStamp === null) return defaultContext;

    let exactAnyLiftMatch: { cycleNumber: number; weekKey: string } | null = null;
    let nearestMatch: { cycleNumber: number; weekKey: string; dayDistance: number } | null = null;

    for (const [cycleKey, weeks] of Object.entries(cycleEntries)) {
      const cycleNumber = Number(cycleKey);
      if (Number.isNaN(cycleNumber)) continue;

      for (const [weekKey, weekMap] of Object.entries(weeks || {})) {
        for (const [liftName, liftMap] of Object.entries(weekMap || {})) {
          if (!liftMap) continue;

          for (const entry of Object.values(liftMap)) {
            if (!entry?.updatedAt) continue;
            const entryDayStamp = toDayStamp(entry.updatedAt);
            if (entryDayStamp === null) continue;

            if (entryDayStamp === recordDayStamp && liftName === record.lift) {
              return { cycleNumber, weekKey };
            }

            if (entryDayStamp === recordDayStamp) {
              exactAnyLiftMatch = { cycleNumber, weekKey };
              continue;
            }

            const dayDistance = Math.abs(entryDayStamp - recordDayStamp);
            if (!nearestMatch || dayDistance < nearestMatch.dayDistance) {
              nearestMatch = { cycleNumber, weekKey, dayDistance };
            }
          }
        }
      }
    }

    if (exactAnyLiftMatch) return exactAnyLiftMatch;
    if (nearestMatch) return { cycleNumber: nearestMatch.cycleNumber, weekKey: nearestMatch.weekKey };
    return defaultContext;
  };

  const navigateToCoachSession = (record: HistoricalRecord) => {
    const recordKey = getRecordUiKey(record);
    setNavigatingRecordKey(recordKey);

    if (!activeClient) {
      setNavigatingRecordKey(null);
      return;
    }

    const sourceClient = clientById.get(activeClient.clientId);
    if (!sourceClient) {
      setNavigatingRecordKey(null);
      return;
    }

    const sessionContext = resolveSessionContext(sourceClient, record);

    const coachParams = new URLSearchParams();
    coachParams.set("layout", "vertical");
    coachParams.set("cycle", String(sessionContext.cycleNumber));
    coachParams.set("week", sessionContext.weekKey);
    coachParams.set("lift", record.lift);
    coachParams.set("clientId", activeClient.clientId);

    console.info("[nav-debug] analytics -> coach session", {
      from: typeof window !== "undefined" ? window.location.href : "server",
      to: `/?${coachParams.toString()}`,
      recordId: record.id,
      clientId: activeClient.clientId,
    });

    router.push(`/?${coachParams.toString()}`);
  };

  const resolveCurrentWeekKey = (client: Client): string => {
    const cycleNumber = client.currentCycleNumber || 1;
    const weekAssignments = client.weekAssignmentsByCycle?.[cycleNumber] || {};
    const now = new Date();

    const datedWeeks = Object.entries(weekAssignments)
      .map(([weekKey, value]) => {
        const date = new Date(value);
        return { weekKey, date };
      })
      .filter((item) => !Number.isNaN(item.date.getTime()));

    const pastWeeks = datedWeeks
      .filter((item) => item.date.getTime() <= now.getTime())
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    if (pastWeeks.length > 0) return pastWeeks[0].weekKey;

    const numericWeekKeys = Object.keys(weekAssignments).sort((a, b) => {
      const aNum = Number(a.replace(/[^0-9]/g, "")) || 0;
      const bNum = Number(b.replace(/[^0-9]/g, "")) || 0;
      return aNum - bNum;
    });
    if (numericWeekKeys.length > 0) return numericWeekKeys[0];

    const loggedWeekKeys = Object.keys(client.loggedSetInputsByCycle?.[cycleNumber] || {}).sort((a, b) => {
      const aNum = Number(a.replace(/[^0-9]/g, "")) || 0;
      const bNum = Number(b.replace(/[^0-9]/g, "")) || 0;
      return bNum - aNum;
    });
    return loggedWeekKeys[0] || "week1";
  };

  const navigateToCoachClient = (client: Client, preferredLift?: Lift) => {
    const coachParams = new URLSearchParams();
    coachParams.set("layout", "vertical");
    coachParams.set("cycle", String(client.currentCycleNumber || 1));
    coachParams.set("week", resolveCurrentWeekKey(client));
    coachParams.set("lift", preferredLift || "Deadlift");
    coachParams.set("clientId", client.id);

    console.info("[nav-debug] analytics -> coach client", {
      from: typeof window !== "undefined" ? window.location.href : "server",
      to: `/?${coachParams.toString()}`,
      clientId: client.id,
      preferredLift: preferredLift || "Deadlift",
    });

    router.push(`/?${coachParams.toString()}`);
  };

  const toggleReviewedIssue = async (record: HistoricalRecord, nextReviewedIssue: boolean) => {
    if (!record.id) {
      toast({
        variant: "destructive",
        title: "Review state unavailable",
        description: "This historical row is missing an ID, so its review state cannot be saved.",
      });
      return;
    }

    const recordKey = getRecordUiKey(record);
    setReviewingRecordKey(recordKey);

    try {
      const response = await fetch("/api/fix-historical-record", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recordId: record.id,
          reviewedIssue: nextReviewedIssue,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to update review state.");
      }

      setLocalHistoricalData((prev) =>
        prev.map((entry) =>
          entry.id === record.id
            ? {
                ...entry,
                reviewedIssue: nextReviewedIssue,
                reviewedAt: nextReviewedIssue ? payload.record?.reviewedAt || new Date().toISOString() : undefined,
              }
            : entry
        )
      );
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Review state failed",
        description: error instanceof Error ? error.message : "Failed to update the row review state.",
      });
    } finally {
      setReviewingRecordKey(null);
    }
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="max-w-2xl rounded-3xl border border-border bg-card/80 p-8 shadow-sm">
            <TriangleAlert className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">Admin analytics is desktop only</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This page is intentionally hidden from mobile workflow. Open the dashboard on desktop and use the hidden trigger above Add Client.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-6 md:py-8">
        <div className="rounded-[24px] border border-border bg-card/90 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Client Progression And Coaching</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Pick a client snapshot, review cycle-specific context, and take action from one focused view.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client snapshot</h2>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1">
            {filteredSelectableClients.map((client) => {
              const isActive = activeClient?.clientId === client.clientId;
              return (
              <button
                key={`snapshot-${client.clientId}`}
                type="button"
                className="shrink-0 text-left"
                onClick={() => setActiveClientId(client.clientId)}
              >
              <Card className={`relative w-fit border-border/80 transition ${isActive ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}>
                <CardHeader className="px-2.5 pb-1 pt-2.5">
                  {isActive ? (
                    <span className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate text-sm">{client.clientName}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-2.5 px-2.5">
                  <div className="space-y-0.5 text-xs">
                    {client.liftAnalytics.map((liftRow) => {
                      const trendIsUp = liftRow.trend === "up";
                      const trendIsDown = liftRow.trend === "down";
                      const movementName = getMovementNameForClient(client, liftRow.lift);
                      return (
                        <div
                          key={`snapshot-${client.clientId}-${liftRow.lift}`}
                          className="flex items-center gap-1.5 border-b border-border/50 py-0.5 last:border-b-0"
                        >
                          <span className="w-8 font-medium text-foreground">{movementName.slice(0, 3).toUpperCase()}</span>
                          <span className="w-9 text-center text-muted-foreground">{formatSigned(liftRow.estimated1RMDelta)}</span>
                          <span className="flex w-3.5 items-center justify-center">
                            {trendIsUp ? (
                              <TrendingUp className="h-3 w-3 text-emerald-600" />
                            ) : trendIsDown ? (
                              <TrendingDown className="h-3 w-3 text-rose-600" />
                            ) : (
                              <Minus className="h-3 w-3 text-muted-foreground" />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              </button>
            );
            })}
            </div>
          </div>
          {filteredSelectableClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients matched search.</p>
          ) : null}
        </div>

        <div className="space-y-4">
            {activeClient && detailClient ? (
              <>
                <Card className="overflow-hidden border-border/80">
                  <CardHeader className="gap-2 border-b border-border/70 bg-muted/20 pt-2 pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">{detailClient.clientName}</CardTitle>
                          <div className="relative inline-flex items-center">
                            <select
                              value={selectedCycleView === "all" ? "all" : String(detailClient.currentCycleNumber)}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setSelectedCycleView(nextValue === "all" ? "all" : Number(nextValue));
                              }}
                              className="appearance-none h-8 rounded-full border border-border bg-background pl-3 pr-8 text-xs font-medium text-foreground"
                            >
                              <option value="all">All cycles review</option>
                              {availableCycles.map((cycleNumber) => (
                                <option key={`cycle-option-${cycleNumber}`} value={String(cycleNumber)}>
                                  Cycle {cycleNumber}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                      <div className="grid min-w-[280px] grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                        <TwelveSliceProgress
                          completed={detailClient.quickReview.completedSessionSlots}
                          total={detailClient.quickReview.plannedSessionSlots}
                        />
                        <div className="h-full min-h-[52px] rounded-2xl border border-border/70 bg-background px-3 py-1.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Activity status</p>
                          <div className="mt-1">
                            <Badge
                              variant="outline"
                              className={activityBadgeClassNames[detailClient.activity.status]}
                            >
                              {activityLabel[detailClient.activity.status]}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-6 p-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-5">
                      {selectedCycleView === "all" ? (
                        <section>
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">All cycles review</h3>
                            <Badge variant="secondary">{allCycleReview.length} cycles</Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            {allCycleReview.map((entry) => (
                              <div key={`cycle-review-${entry.cycleNumber}`} className="rounded-xl border border-border/70 bg-background px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">Cycle {entry.cycleNumber}</Badge>
                                    <Badge variant="outline" className={statusBadgeClassNames[entry.analytics.overallStatus]}>
                                      {statusLabel[entry.analytics.overallStatus]}
                                    </Badge>
                                  </div>
                                  <button
                                    type="button"
                                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                                    onClick={() => setSelectedCycleView(entry.cycleNumber)}
                                  >
                                    View cycle
                                  </button>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Completion {entry.analytics.quickReview.completionPercent}% • Risk lifts {entry.analytics.quickReview.riskLiftCount}
                                </p>
                                {entry.analytics.coachingFocus.primaryIssue ? (
                                  <p className="mt-1 text-sm text-foreground">{entry.analytics.coachingFocus.primaryIssue.title}</p>
                                ) : (
                                  <p className="mt-1 text-sm text-foreground">No major issues detected.</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      <section>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status & Action</h3>
                          <Badge variant="outline" className={statusBadgeClassNames[detailClient.overallStatus]}>
                            {statusLabel[detailClient.overallStatus]}
                          </Badge>
                          {selectedCycleView === "all" ? <Badge variant="secondary">Current cycle detail</Badge> : null}
                        </div>

                        {detailClient.coachingFocus.primaryIssue ? (
                          <div className="mt-4 space-y-3">
                            <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                              <p className="text-sm font-medium text-foreground">{detailClient.coachingFocus.primaryIssue.title}</p>
                              <p className="mt-2 text-sm text-muted-foreground">{detailClient.coachingFocus.primaryIssue.action}</p>

                              {detailClient.coachingFocus.primaryEvidence ? (
                                <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                    Why this recommendation
                                  </p>
                                  <p className="text-sm text-foreground">{detailClient.coachingFocus.primaryEvidence.why}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Evidence strength: {detailClient.coachingFocus.primaryEvidence.evidenceStrength}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            {detailClient.coachingFocus.secondaryIssues.length > 0 && (
                              <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Also monitor</p>
                                <ul className="mt-2 space-y-1.5">
                                  {detailClient.coachingFocus.secondaryIssues.map((issue) => (
                                    <li key={issue} className="text-sm text-foreground">
                                      • {issue}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {detailClient.coachingFocus.opportunities.length > 0 && (
                              <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Opportunities</p>
                                <ul className="mt-2 space-y-1.5">
                                  {detailClient.coachingFocus.opportunities.map((opp) => (
                                    <li key={opp} className="text-sm text-foreground">
                                      ✓ {opp}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-border/70 bg-background px-4 py-3">
                            <p className="text-sm text-foreground">No major issues detected. Continue current progression.</p>
                            {detailClient.coachingFocus.opportunities.length > 0 && (
                              <div className="mt-3 space-y-1.5">
                                {detailClient.coachingFocus.opportunities.map((opp) => (
                                  <p key={opp} className="text-sm text-muted-foreground">
                                    ✓ {opp}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              const sourceClient = clientById.get(activeClient.clientId);
                              if (!sourceClient) return;
                              navigateToCoachClient(sourceClient);
                            }}
                          >
                            Open client in coach view
                          </button>
                          {(detailClient.downtrendLifts.length > 0 ? detailClient.downtrendLifts : detailClient.plateauLifts)
                            .slice(0, 2)
                            .map((lift) => (
                              <button
                                key={`action-${lift}`}
                                type="button"
                                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                  const sourceClient = clientById.get(activeClient.clientId);
                                  if (!sourceClient) return;
                                  navigateToCoachClient(sourceClient, lift);
                                }}
                              >
                                Review {lift}
                              </button>
                            ))}
                          <button
                            type="button"
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setIsHistoricalOpen(true)}
                          >
                            Open historical rows
                          </button>
                        </div>
                      </section>

                      {detailClient.coachingFocus.notesContext ? (
                        <section>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes Context</h3>
                          <div className="mt-3 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm leading-6 text-foreground">
                            {detailClient.coachingFocus.notesContext}
                          </div>
                        </section>
                      ) : null}

                      {(detailClient.coachingFocus.primaryEvidence?.references?.length ?? 0) > 0 ? (
                        <section>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">References</h3>
                          <ul className="mt-3 space-y-2">
                            {detailClient.coachingFocus.primaryEvidence?.references?.map((reference) => (
                              <li key={`${reference.title}-${reference.url}`}>
                                <a
                                  href={reference.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-primary underline-offset-2 hover:underline"
                                >
                                  {reference.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}
                    </div>

                    <section>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lift-by-lift snapshot</h3>
                      <div className="mt-3 overflow-hidden rounded-3xl border border-border/70">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3">Lift</th>
                              <th className="px-4 py-3">TM</th>
                              <th className="px-4 py-3">TM delta</th>
                              <th className="px-4 py-3">e1RM delta</th>
                              <th className="px-4 py-3">Trend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailClient.liftAnalytics.map((lift) => (
                              <tr key={`${detailClient.clientId}-${lift.lift}`} className="border-t border-border/70">
                                <td className="px-4 py-3 font-medium text-foreground">{getMovementNameForClient(detailClient, lift.lift)}</td>
                                <td className="px-4 py-3 text-muted-foreground">{lift.currentTrainingMax || "-"}</td>
                                <td className="px-4 py-3 text-muted-foreground">{formatSigned(lift.trainingMaxDelta)}</td>
                                <td className="px-4 py-3 text-muted-foreground">{formatSigned(lift.estimated1RMDelta)}</td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className={trendClassName(lift.trend, lift.plateauRisk)}>
                                    {lift.plateauRisk ? "Plateau watch" : trendLabel(lift.trend)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setIsHistoricalOpen((prev) => !prev)}
                    >
                      <div>
                        <CardTitle className="text-base">Historical rows</CardTitle>
                        <CardDescription>Click a row to open coach view for {activeClient.clientName}.</CardDescription>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isHistoricalOpen ? "rotate-180" : "rotate-0"}`} />
                    </button>
                  </CardHeader>
                  <CardContent className={isHistoricalOpen ? "block" : "hidden"}>
                    {activeClientRecords.length > 0 ? (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-border/70">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              <tr>
                                <th className="w-[72px] px-3 py-2">Review</th>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Lift</th>
                                <th className="px-3 py-2">Weight</th>
                                <th className="px-3 py-2">Reps</th>
                                <th className="px-3 py-2">e1RM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeClientRecords.map((record) => {
                                const recordKey = getRecordUiKey(record);
                                const isNavigating = navigatingRecordKey === recordKey;
                                const isReviewing = reviewingRecordKey === recordKey;
                                const baseline = liftBaselineByLift[record.lift] || 0;
                                const drift = baseline > 0 ? Math.abs(record.estimated1RM - baseline) / baseline : 0;
                                const hasHighlight = drift >= 0.35;
                                const isReviewed = record.reviewedIssue === true;
                                const rowClass =
                                  isReviewed
                                    ? "bg-emerald-500/10"
                                    : drift >= 0.6
                                      ? "bg-rose-500/10"
                                      : drift >= 0.35
                                        ? "bg-amber-500/10"
                                        : "";
                                return (
                                  <tr
                                    key={recordKey}
                                    className={`border-t border-border/70 cursor-pointer hover:bg-muted/30 ${rowClass} ${isNavigating ? "opacity-70" : ""}`}
                                    onClick={() => navigateToCoachSession(record)}
                                  >
                                    <td className="px-3 py-2">
                                      {hasHighlight || isReviewed ? (
                                        <button
                                          type="button"
                                          aria-label={isReviewed ? "Mark issue for re-review" : "Mark issue reviewed"}
                                          title={isReviewed ? "Mark for re-review" : "Mark reviewed"}
                                          disabled={isReviewing}
                                          className={`inline-flex h-7 w-7 items-center justify-center rounded border transition ${
                                            isReviewed
                                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                              : "border-amber-500/30 bg-background text-muted-foreground hover:bg-amber-500/10"
                                          } disabled:opacity-60`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void toggleReviewedIssue(record, !isReviewed);
                                          }}
                                        >
                                          {isReviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                        </button>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2">{record.date.slice(0, 10)}</td>
                                    <td className="px-3 py-2">{activeClient ? getMovementNameForClient(activeClient, record.lift) : record.lift}</td>
                                    <td className="px-3 py-2">{record.weight}</td>
                                    <td className="px-3 py-2">{record.reps}</td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <span>{record.estimated1RM}</span>
                                        {isNavigating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {navigatingRecordKey ? (
                          <p className="mt-2 text-xs text-muted-foreground">Opening coach view...</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No historical rows found for this client.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  No selected clients. Check names on the left to open analytics.
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}

function TwelveSliceProgress({ completed, total }: { completed: number; total: number }) {
  const normalizedTotal = Math.max(1, total);
  const normalizedCompleted = Math.max(0, Math.min(completed, normalizedTotal));
  const slices = 12;
  const filledSlices = Math.round((normalizedCompleted / normalizedTotal) * slices);
  const center = 20;
  const radius = 17;

  const polarToCartesian = (angleInDegrees: number) => {
    const radians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };

  const formatCoord = (value: number) => value.toFixed(3);

  const describeSlice = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(endAngle);
    const end = polarToCartesian(startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${formatCoord(center)} ${formatCoord(center)} L ${formatCoord(start.x)} ${formatCoord(start.y)} A ${formatCoord(radius)} ${formatCoord(radius)} 0 ${largeArcFlag} 0 ${formatCoord(end.x)} ${formatCoord(end.y)} Z`;
  };

  const sliceAngle = 360 / slices;

  return (
    <div className="h-full min-h-[52px] rounded-2xl border border-border/70 bg-background px-3 py-1.5">
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 40 40"
          className="h-8 w-8"
          role="img"
          aria-label={`Cycle progress ${normalizedCompleted}/${normalizedTotal}`}
        >
          {Array.from({ length: slices }).map((_, index) => {
            const start = index * sliceAngle + 1;
            const end = (index + 1) * sliceAngle - 1;
            const isFilled = index < filledSlices;
            return (
              <path
                key={`slice-${index}`}
                d={describeSlice(start, end)}
                className={isFilled ? "fill-primary" : "fill-muted"}
                stroke="hsl(var(--background))"
                strokeWidth="0.5"
              />
            );
          })}
        </svg>
        <div className="leading-tight">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cycle completion</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {normalizedCompleted}/{normalizedTotal}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatSigned(value: number | null) {
  if (value === null) return "-";
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function trendLabel(trend: "up" | "flat" | "down" | "no-data") {
  switch (trend) {
    case "up":
      return "Up";
    case "flat":
      return "Flat";
    case "down":
      return "Down";
    default:
      return "No data";
  }
}

function trendClassName(trend: "up" | "flat" | "down" | "no-data", plateauRisk: boolean) {
  if (plateauRisk) return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (trend === "up") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (trend === "down") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  if (trend === "flat") return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  return "border-border bg-background text-muted-foreground";
}

function getClientCycleNumbers(client: Client): number[] {
  const cycles = new Set<number>();
  const addCycle = (value: unknown) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) cycles.add(numeric);
  };

  addCycle(client.currentCycleNumber || 1);
  (client.cycleMembership || []).forEach(addCycle);
  Object.keys(client.trainingMaxesByCycle || {}).forEach(addCycle);
  Object.keys(client.oneRepMaxesByCycle || {}).forEach(addCycle);
  Object.keys(client.weekAssignmentsByCycle || {}).forEach(addCycle);
  Object.keys(client.loggedSetInputsByCycle || {}).forEach(addCycle);
  Object.keys(client.movementSelectionByCycle || {}).forEach(addCycle);
  Object.keys(client.movementProfilesByCycle || {}).forEach(addCycle);

  return Array.from(cycles).sort((a, b) => a - b);
}
