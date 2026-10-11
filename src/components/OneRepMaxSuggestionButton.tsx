"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { OneRepMaxSuggestion } from "@/lib/types";

type OneRepMaxSuggestionButtonProps = {
  clientName: string;
  suggestion: OneRepMaxSuggestion;
  onAccept: () => Promise<void> | void;
};

/** Small flag on a lifter's row when a logged set beats their stored 1RM; opens a confirm. */
export function OneRepMaxSuggestionButton({ clientName, suggestion, onAccept }: OneRepMaxSuggestionButtonProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAccept = async () => {
    setIsSaving(true);
    try {
      await onAccept();
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20"
        title="A logged set beat the stored 1RM"
      >
        <TrendingUp className="h-3 w-3" />
        TM {suggestion.suggestedTrainingMax}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Update {clientName}&apos;s {suggestion.movementName}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Logged <span className="font-mono font-semibold text-foreground">{suggestion.weight} × {suggestion.reps}</span>,
                  an estimated 1RM of <span className="font-mono font-semibold text-foreground">{suggestion.estimatedOneRepMax}</span>.
                </p>
                <p>
                  1RM <span className="font-mono">{suggestion.currentOneRepMax}</span> →{" "}
                  <span className="font-mono font-semibold text-foreground">{suggestion.suggestedOneRepMax}</span>
                  <br />
                  Training max <span className="font-mono">{suggestion.currentTrainingMax}</span> →{" "}
                  <span className="font-mono font-semibold text-foreground">{suggestion.suggestedTrainingMax}</span>
                </p>
                {suggestion.capped ? (
                  <p>Limited to a 10% increase per update. High-rep sets overestimate a true max.</p>
                ) : null}
                <p>Weights change from the next set calculated. Holds and graduation are not affected.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Not now</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={(event) => {
                event.preventDefault();
                void handleAccept();
              }}
            >
              {isSaving ? "Saving..." : "Update numbers"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
