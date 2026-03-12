import { Suspense } from "react";
import { SbdohControl } from "@/components/SbdohControl";
import { getAppSettings, getClients, getHistoricalData } from "@/lib/data";
import { Weight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function ControlContent() {
  const clients = await getClients();
  const { cycleSettingsByCycle, cycleNames, cycleSchedulesByCycle } = await getAppSettings();
  const historicalData = await getHistoricalData();

  return (
    <SbdohControl
      initialClients={clients}
      initialCycleSettingsByCycle={cycleSettingsByCycle}
      initialCycleNames={cycleNames}
      initialCycleSchedulesByCycle={cycleSchedulesByCycle || {}}
      initialHistoricalData={historicalData}
    />
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="bg-background/90">
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
      <main className="flex-1">
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
          <ControlContent />
        </Suspense>
      </main>
    </div>
  );
}
