"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { CycleSettings } from "@/lib/types";

type WeekOptionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekKey: string | null;
  cycleSettings: CycleSettings;
  onDuplicateWeek: (weekKey: string) => Promise<void>;
  onDeleteWeek: (weekKey: string) => Promise<boolean>;
};

export function WeekOptionsModal({
  open,
  onOpenChange,
  weekKey,
  cycleSettings,
  onDuplicateWeek,
  onDeleteWeek,
}: WeekOptionsModalProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { toast } = useToast();

  if (!weekKey) return null;

  const weekName = cycleSettings[weekKey]?.name || "Unknown Week";
  const repScheme = cycleSettings[weekKey]?.reps.workset3 || "";
  const repNum = String(repScheme).replace(/\D/g, '') || "?";
  const weekCount = Object.keys(cycleSettings).length;

  const handleDuplicate = async () => {
    await onDuplicateWeek(weekKey);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    const success = await onDeleteWeek(weekKey);
    if (success) {
      toast({
        title: "Week Deleted",
        description: `${weekName} has been deleted successfully.`,
      });
      onOpenChange(false);
      return;
    }

    toast({
      variant: "destructive",
      title: "Error",
      description: "Failed to delete week.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{weekName} ({repNum}) Options</DialogTitle>
          <DialogDescription>
            Manage options for this week configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2"
            variant="outline"
          >
            <Copy className="h-4 w-4" />
            Duplicate Week
          </Button>
          <Button
            onClick={() => setConfirmDeleteOpen(true)}
            className="w-full flex items-center gap-2"
            variant="destructive"
            disabled={weekCount <= 1}
            title={weekCount <= 1 ? "Cannot delete the only week" : "Delete this week"}
          >
            <Trash2 className="h-4 w-4" />
            Delete Week
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {weekName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected week and renumber following weeks accordingly. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Week
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
