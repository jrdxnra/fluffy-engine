"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Client, HistoricalRecord, Lift } from "@/lib/types";
import { ClientProgressChart } from "./ClientProgressChart";
import { useMemo } from "react";

type ProgressChartDialogProps = {
  client: Client | null;
  lift: Lift;
  historicalData: HistoricalRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProgressChartDialog({
  client,
  lift,
  historicalData,
  open,
  onOpenChange,
}: ProgressChartDialogProps) {
  
  const chartData = useMemo(() => {
    if (!client) return [];
    return historicalData
      .filter((record) => record.clientId === client.id && record.lift === lift)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [client, lift, historicalData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Progress Chart: {client?.name}</DialogTitle>
          <DialogDescription>
            Estimated 1RM progression for the {lift} over time.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[450px] w-full pt-4">
            <ClientProgressChart data={chartData} lift={lift} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
