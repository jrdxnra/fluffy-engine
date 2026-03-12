"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";
import { updateClientNotesAction } from "@/app/actions";

type ClientNotesDialogProps = {
  clientId: string;
  clientName: string;
  currentNotes: string | undefined;
  onNotesSaved: (notes: string) => void;
  compact?: boolean;
  showLabel?: boolean;
};

export function ClientNotesDialog({
  clientId,
  clientName,
  currentNotes,
  onNotesSaved,
  compact = false,
  showLabel = true,
}: ClientNotesDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(currentNotes || "");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateClientNotesAction(clientId, notes);
      if (result.success) {
        toast({ title: "Saved!", description: "Notes updated." });
        onNotesSaved(notes);
        setOpen(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to save notes." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save notes." });
    }
    setIsSaving(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={compact ? "h-7 w-7 p-0" : "h-7 justify-center text-xs gap-1 px-2"}
        onClick={() => setOpen(true)}
        aria-label={showLabel ? undefined : `Open notes for ${clientName}`}
      >
        <FileText className="h-3 w-3" />
        {showLabel ? "Notes" : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notes for {clientName}</DialogTitle>
            <DialogDescription>
              Add or edit notes about this client.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Textarea
              placeholder="Add notes about this client..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-32"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
