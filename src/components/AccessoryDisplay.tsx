"use client";

import { useMemo } from "react";
import type { Lift, CycleSettings } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Repeat } from "lucide-react";
import { accessoryMap, mobilityChecklist, conditioningChecklist } from "@/lib/workout-content";
import { resolveVisibleAccessories } from "@/lib/accessory-utils";

type AccessoryDisplayProps = {
  lift?: Lift;
  lifts?: Lift[];
  cycleSettings?: CycleSettings;
  currentWeek?: string;
  weekByLift?: Partial<Record<Lift, string>>;
};

export function AccessoryDisplay({
  lift,
  lifts,
  cycleSettings,
  currentWeek,
  weekByLift,
}: AccessoryDisplayProps) {
  const targetLifts = lifts && lifts.length > 0 ? lifts : lift ? [lift] : [];
  const accessoryCardTitle = targetLifts.length > 1
    ? "Day Accessories"
    : targetLifts[0]
      ? `${targetLifts[0]} Accessories`
      : "Accessories";

  const accessoriesByLift = useMemo(() => {
    const result: Array<{ lift: Lift; accessories: string[]; effectiveWeekKey?: string }> = [];
    for (const targetLift of targetLifts) {
      if (!cycleSettings || !currentWeek) {
        result.push({
          lift: targetLift,
          accessories: accessoryMap[targetLift].exercises,
          effectiveWeekKey: currentWeek,
        });
        continue;
      }
      const effectiveWeekKey = weekByLift?.[targetLift] || currentWeek;
      result.push({
        lift: targetLift,
        accessories: resolveVisibleAccessories(cycleSettings, effectiveWeekKey, targetLift),
        effectiveWeekKey,
      });
    }
    return result;
  }, [cycleSettings, currentWeek, targetLifts, weekByLift]);

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mobility / Warm-up</CardTitle>
          <Repeat className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {mobilityChecklist.map((item) => (
              <li key={item}>☐ {item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{accessoryCardTitle}</CardTitle>
          <Dumbbell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            {accessoriesByLift.map(({ lift: accessoryLift, accessories, effectiveWeekKey }) => (
              <div key={`accessory-group-${accessoryLift}`}>
                {targetLifts.length > 1 ? (
                  <div className="mb-1">
                    <div className="font-medium text-foreground">{accessoryLift}</div>
                    {effectiveWeekKey ? (
                      <div className="text-[11px] text-muted-foreground">Using {effectiveWeekKey.replace("week", "Week ")}</div>
                    ) : null}
                  </div>
                ) : null}
                <ul className="space-y-1">
                  {accessories.map((ex) => (
                    <li key={`${accessoryLift}-${ex}`}>• {ex}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conditioning</CardTitle>
          <Repeat className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {conditioningChecklist.map((item) => (
              <li key={item}>☐ {item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
