import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SbdohControl } from "@/components/SbdohControl";
import { MobileDevShell } from "@/components/dev-dashboard/MobileDevShell";
import { getAppSettings, getClients, getHistoricalData } from "@/lib/data";
import { Weight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Dev Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

async function DevContent() {
  const clients = await getClients();
  const { cycleSettingsByCycle, cycleNames, cycleSchedulesByCycle } = await getAppSettings();
  const historicalData = await getHistoricalData();

  const sharedProps = {
    initialClients: clients,
    initialCycleSettingsByCycle: cycleSettingsByCycle,
    initialCycleNames: cycleNames,
    initialCycleSchedulesByCycle: cycleSchedulesByCycle || {},
    initialHistoricalData: historicalData,
  };

  return (
    <>
      {/* Desktop: existing production shell — untouched */}
      <div className="hidden md:flex md:flex-col md:flex-1">
        <SbdohControl {...sharedProps} />
      </div>

      {/* Mobile: new mobile shell — isolated to <md */}
      <div className="flex flex-col flex-1 md:hidden">
        <MobileDevShell {...sharedProps} />
      </div>
    </>
  );
}

export default function DevDashboardPage() {
  if (process.env.ENABLE_DEV_DASHBOARD !== "true") {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="hidden md:block bg-background/90">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-center px-4 md:px-6">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <Weight className="h-5 w-5 text-primary" />
            <span className="leading-none">
              Power
              <sup className="relative -top-1.5 ml-0.5 text-[0.78em] font-semibold text-primary">Lift</sup>
            </span>
          </h1>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
          <DevContent />
        </Suspense>
      </main>
    </div>
  );
}
