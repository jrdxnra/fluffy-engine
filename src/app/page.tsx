import { Suspense } from "react";
import { ControlShellClient } from "@/components/ControlShellClient";
import { getAppSettings, getClients, getHistoricalData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function ControlContent() {
  const clients = await getClients();
  const { cycleSettingsByCycle, cycleNames, cycleSchedulesByCycle, globalMovementOptions, globalMovementSettings, trainingGroups } = await getAppSettings();
  const historicalData = await getHistoricalData();

  const sharedProps = {
    initialClients: clients,
    initialCycleSettingsByCycle: cycleSettingsByCycle,
    initialCycleNames: cycleNames,
    initialCycleSchedulesByCycle: cycleSchedulesByCycle || {},
    initialGlobalMovementOptions: globalMovementOptions || [],
    initialGlobalMovementSettings: globalMovementSettings || {},
    initialTrainingGroups: trainingGroups || [],
    initialHistoricalData: historicalData,
  };

  return (
    <ControlShellClient {...sharedProps} />
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex-1 flex flex-col">
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
          <ControlContent />
        </Suspense>
      </main>
    </div>
  );
}
