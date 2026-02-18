import { SbdohControl } from "@/components/SbdohControl";
import { getClients, getCycleSettings, getHistoricalData } from "@/lib/data";
import { Weight } from "lucide-react";

export default function Home() {
  // In a real app, these would be API calls to your database (e.g., Firebase)
  const clients = getClients();
  const cycleSettings = getCycleSettings();
  const historicalData = getHistoricalData();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
         <h1 className="flex items-center gap-2 text-2xl font-bold font-headline">
            <Weight className="h-7 w-7 text-primary" />
            SBDOH 5/3/1 Control
          </h1>
      </header>
      <main className="flex-1">
        <SbdohControl
          initialClients={clients}
          initialCycleSettings={cycleSettings}
          initialHistoricalData={historicalData}
        />
      </main>
    </div>
  );
}
