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
      <header className="sticky top-0 z-30 flex h-14 items-center justify-center border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
         <h1 className="relative top-5 flex items-center gap-2 text-2xl font-bold font-headline">
            <Weight className="h-6 w-6 text-primary" />
            <span className="leading-none">
              Power
              <sup className="relative -top-1.5 ml-1 text-[1em] font-semibold text-primary">Lift</sup>
            </span>
          </h1>
      </header>
      <main className="flex-1">
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
          <ControlContent />
        </Suspense>
      </main>
    </div>
  );
}
