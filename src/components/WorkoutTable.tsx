"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { CalculatedWorkout, HistoricalRecord, Lift } from "@/lib/types";
import { Target, Check } from "lucide-react";
import { logRepRecordAction } from "@/app/actions";

type RepLog = {
  [clientId: string]: { reps: string; isSaving: boolean; isSaved: boolean };
};

type WorkoutTableProps = {
  workouts: CalculatedWorkout[];
  lift: Lift;
  weekName: string;
  onRepRecordUpdate: (newRecord: HistoricalRecord) => void;
};

const RepInput = ({ clientId, weight, lift, onRepRecordUpdate }: { clientId: string, weight: number, lift: Lift, onRepRecordUpdate: (newRecord: HistoricalRecord) => void; }) => {
  const [reps, setReps] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const repCount = parseInt(reps, 10);
    if (isNaN(repCount) || repCount <= 0) {
      toast({ variant: "destructive", title: "Invalid input", description: "Please enter a valid number of reps." });
      return;
    }

    setIsSaving(true);
    const result = await logRepRecordAction(clientId, lift, weight, repCount);

    if (result.success && result.record) {
      toast({ title: "Logged!", description: `${lift} ${weight}x${repCount} saved.` });
      setIsSaved(true);
      onRepRecordUpdate(result.record);
      setTimeout(() => setIsSaved(false), 2000);
    } else {
      toast({ variant: "destructive", title: "Error", description: "Failed to save record." });
    }
    setIsSaving(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        placeholder="Reps"
        className="h-8 w-20 font-code"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        disabled={isSaving || isSaved}
      />
      <Button size="icon" className="h-8 w-8" onClick={handleSave} disabled={isSaving || isSaved || !reps}>
        {isSaved ? <Check /> : isSaving ? "..." : <Check />}
      </Button>
    </div>
  );
};


export function WorkoutTable({ workouts, lift, weekName, onRepRecordUpdate }: WorkoutTableProps) {
  if (!workouts.length) {
    return <p>No clients on the roster. Add one to get started!</p>;
  }

  const headerSets = workouts[0]?.sets.map(s => ({label: s.label, type: s.type, set: s.set})) || [];

  return (
    <div className="border rounded-lg w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Client</TableHead>
            {headerSets.map((s, index) => (
              <TableHead key={index} className={s.type === "Work Set" && s.set === 3 ? "text-primary" : ""}>
                {s.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {workouts.map(({ client, sets, prTarget }) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">{client.name}</TableCell>
              {sets.map((set, index) => {
                const isTopSet = set.type === "Work Set" && set.set === 3;
                return (
                  <TableCell key={index} className={isTopSet ? "bg-primary/10" : ""}>
                    <div className="flex flex-col gap-1">
                      <div className="font-code font-bold text-lg text-foreground">
                        {set.weight} lbs
                        <Badge variant="secondary" className="ml-2 font-sans">
                          {set.reps} reps
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-code">
                        {set.plates ? `Plates: ${set.plates}` : "Bar only"}
                      </div>
                      {isTopSet && (
                        <div className="mt-2">
                          <RepInput clientId={client.id} weight={set.weight} lift={lift} onRepRecordUpdate={onRepRecordUpdate} />
                           {prTarget && prTarget.reps > 0 && (
                             <div className="flex items-center gap-1 text-xs mt-2 text-amber-400">
                               <Target className="h-3 w-3" />
                               <span>
                                 Hit <b>{prTarget.reps} reps</b> to beat last month's PR!
                               </span>
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
