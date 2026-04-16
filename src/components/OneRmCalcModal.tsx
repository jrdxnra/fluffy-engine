"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mround } from "@/lib/utils";

function calcRM(e1RM: number, reps: number): number {
  if (reps === 1) return e1RM;
  return mround(e1RM / (1 + reps / 30));
}

export function OneRmCalcModal() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const w = parseFloat(weight);
  const r = parseFloat(reps);
  const valid = !isNaN(w) && w > 0 && !isNaN(r) && r > 0;

  const e1RM = valid ? Math.round(w * (1 + r / 30)) : null;
  const e2RM = e1RM ? calcRM(e1RM, 2) : null;
  const e3RM = e1RM ? calcRM(e1RM, 3) : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="block w-full px-2 py-1 text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          1RM Calc
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>1RM Calculator</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Weight (lbs)</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="225"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reps</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="5"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
          </div>

          {e1RM !== null ? (
            <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Estimated 1RM</span>
                <span className="font-semibold tabular-nums">{e1RM} lbs</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Estimated 2RM</span>
                <span className="font-semibold tabular-nums">{e2RM} lbs</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Estimated 3RM</span>
                <span className="font-semibold tabular-nums">{e3RM} lbs</span>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-4">
              Enter weight and reps above
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
