"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Client, CycleSettings, HistoricalRecord, Lift } from "@/lib/types";
import { getAiInsightsAction } from "@/app/actions";
import { Sparkles, LineChart as LineChartIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressChartDialog } from "./ProgressChartDialog";

type AiInsightsDialogProps = {
  client: Client | null;
  lift: Lift;
  cycleSettings: CycleSettings;
  currentWeek: string;
  historicalData: HistoricalRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChart: () => void;
};

type AiOutput = {
  insights: string;
  strategicTips: string;
};

export function AiInsightsDialog({
  client,
  lift,
  cycleSettings,
  currentWeek,
  historicalData,
  open,
  onOpenChange,
  onOpenChart,
}: AiInsightsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiOutput | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!client) return;

    setLoading(true);
    setResult(null);

    const clientHistoricalPerformance = historicalData.filter(
      (record) => record.clientId === client.id && record.lift === lift
    );

    const input = {
      clientId: client.id,
      liftType: lift,
      currentCycleParameters: {
        currentWeek: cycleSettings[currentWeek].name,
        globalPercentages: cycleSettings[currentWeek].percentages,
        repTargets: cycleSettings[currentWeek].reps,
      },
      clientTrainingMaxes: client.trainingMaxes,
      clientHistoricalPerformance,
    };

    const response = await getAiInsightsAction(input);

    if (response.success && response.data) {
      setResult(response.data);
    } else {
      toast({
        variant: "destructive",
        title: "AI Insights Error",
        description: response.error || "Could not generate insights.",
      });
    }

    setLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI-Powered Progress Insights</DialogTitle>
          <DialogDescription>
            For {client?.name} on the {lift}. Generate personalized insights and strategic tips based on their historical performance.
          </DialogDescription>
        </DialogHeader>

        <div className="absolute right-14 top-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onOpenChart}>
                <LineChartIcon className="h-5 w-5" />
                <span className="sr-only">View Progress Chart</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View Progress Chart</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {!result && (
          <div className="flex justify-center py-8">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={loading}
              className="font-bold"
            >
              {loading ? (
                "Generating..."
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-6 mt-4">
            <div>
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full mt-2" />
              <Skeleton className="h-4 w-3/4 mt-2" />
            </div>
            <div>
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full mt-2" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6 mt-4 text-sm max-h-[60vh] overflow-y-auto pr-4">
            <div>
              <h3 className="font-bold text-primary mb-2">Personalized Insights</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{result.insights}</p>
            </div>
            <div>
              <h3 className="font-bold text-primary mb-2">Strategic Tips</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{result.strategicTips}</p>
            </div>
            <div className="text-center pt-4">
               <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate
               </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}