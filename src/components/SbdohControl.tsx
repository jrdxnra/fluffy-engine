"use client";

import { useState, useMemo, useTransition } from "react";
import type {
  Client,
  CycleSettings,
  HistoricalRecord,
  Lift,
  CalculatedWorkout,
} from "@/lib/types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { WorkoutTable } from "@/components/WorkoutTable";
import { AddClientSheet } from "@/components/AddClientSheet";
import { AccessoryDisplay } from "@/components/AccessoryDisplay";
import { AiInsightsDialog } from "@/components/AiInsightsDialog";
import { calculateWorkout, exportToCsv } from "@/lib/utils";
import { ProgressChartDialog } from "@/components/ProgressChartDialog";

type SbdohControlProps = {
  initialClients: Client[];
  initialCycleSettings: CycleSettings;
  initialHistoricalData: HistoricalRecord[];
};

export function SbdohControl({
  initialClients,
  initialCycleSettings,
  initialHistoricalData,
}: SbdohControlProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [historicalData, setHistoricalData] = useState<HistoricalRecord[]>(initialHistoricalData);
  const [lift, setLift] = useState<Lift>("Squat");
  const [currentWeek, setCurrentWeek] = useState<string>("week1");
  
  const [isAddClientSheetOpen, setAddClientSheetOpen] = useState(false);
  const [isAiInsightsDialogOpen, setAiInsightsDialogOpen] = useState(false);
  const [isProgressChartDialogOpen, setProgressChartDialogOpen] = useState(false);
  const [selectedClientForAi, setSelectedClientForAi] = useState<Client | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleLiftChange = (newLift: Lift) => {
    startTransition(() => {
      setLift(newLift);
    });
  };
  const handleWeekChange = (newWeek: string) => {
    startTransition(() => {
      setCurrentWeek(newWeek);
    });
  };

  const calculatedWorkouts: CalculatedWorkout[] = useMemo(() => {
    return clients.map((client) =>
      calculateWorkout(
        client,
        lift,
        initialCycleSettings[currentWeek],
        historicalData
      )
    );
  }, [clients, lift, currentWeek, initialCycleSettings, historicalData]);

  const handleExport = () => {
    exportToCsv(calculatedWorkouts, lift, initialCycleSettings[currentWeek].name);
  };
  
  const handleAiInsight = (client: Client) => {
    setSelectedClientForAi(client);
    setAiInsightsDialogOpen(true);
  };
  
  const handleRepRecordUpdate = (newRecord: HistoricalRecord) => {
    setHistoricalData(prev => [...prev, newRecord]);
  };

  return (
    <SidebarProvider>
      <div className="flex">
        <SettingsSidebar
          lift={lift}
          onLiftChange={handleLiftChange}
          currentWeek={currentWeek}
          onWeekChange={handleWeekChange}
          cycleSettings={initialCycleSettings}
          clients={clients}
          onAddClient={() => setAddClientSheetOpen(true)}
          onExport={handleExport}
          onAiInsight={handleAiInsight}
        />
        <main className="flex-1 p-4 md:p-6">
          <div style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 300ms ease-in-out' }}>
            <WorkoutTable 
              workouts={calculatedWorkouts} 
              lift={lift}
              weekName={initialCycleSettings[currentWeek].name}
              onRepRecordUpdate={handleRepRecordUpdate}
            />
            <AccessoryDisplay lift={lift} />
          </div>
        </main>
      </div>
      <AddClientSheet open={isAddClientSheetOpen} onOpenChange={setAddClientSheetOpen} />
      <AiInsightsDialog 
        open={isAiInsightsDialogOpen}
        onOpenChange={setAiInsightsDialogOpen}
        client={selectedClientForAi}
        lift={lift}
        cycleSettings={initialCycleSettings}
        currentWeek={currentWeek}
        historicalData={historicalData}
        onOpenChart={() => setProgressChartDialogOpen(true)}
      />
      <ProgressChartDialog
        open={isProgressChartDialogOpen}
        onOpenChange={setProgressChartDialogOpen}
        client={selectedClientForAi}
        lift={lift}
        historicalData={historicalData}
      />
    </SidebarProvider>
  );
}
