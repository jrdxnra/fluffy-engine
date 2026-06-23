"use client";

import nextDynamic from "next/dynamic";
import type {
  Client,
  CycleScheduleSettings,
  CycleSettings,
  GlobalMovementSettings,
  HistoricalRecord,
} from "@/lib/types";

const SbdohControl = nextDynamic(
  () => import("@/components/SbdohControl").then((mod) => mod.SbdohControl),
  { ssr: false }
);

const MobileDevShell = nextDynamic(
  () => import("@/components/dev-dashboard/MobileDevShell").then((mod) => mod.MobileDevShell),
  { ssr: false }
);

type ControlShellClientProps = {
  initialClients: Client[];
  initialCycleSettingsByCycle: Record<number, CycleSettings>;
  initialCycleNames: Record<number, string>;
  initialCycleSchedulesByCycle: Record<number, CycleScheduleSettings>;
  initialGlobalMovementOptions: string[];
  initialGlobalMovementSettings: GlobalMovementSettings;
  initialHistoricalData: HistoricalRecord[];
};

export function ControlShellClient(props: ControlShellClientProps) {
  return (
    <>
      <div className="hidden md:flex md:flex-col md:flex-1">
        <SbdohControl {...props} />
      </div>
      <div className="flex flex-col flex-1 md:hidden">
        <MobileDevShell {...props} />
      </div>
    </>
  );
}
