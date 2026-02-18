"use client";

import type { Lift } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Repeat } from "lucide-react";

type AccessoryDisplayProps = {
  lift: Lift;
};

const accessoryMap: { [key in Lift]: { title: string; exercises: string[] } } = {
  Deadlift: {
    title: "Vertical Pull / Core",
    exercises: ["Lat Pulldowns 3x10", "Hanging Leg Raises 3x15"],
  },
  Bench: {
    title: "Vertical Pull / Core",
    exercises: ["Lat Pulldowns 3x10", "Hanging Leg Raises 3x15"],
  },
  Squat: {
    title: "Dumbbell Rows / Single Leg",
    exercises: ["Dumbbell Rows 3x10 (each arm)", "Bulgarian Split Squats 3x12 (each leg)"],
  },
  Press: {
    title: "Dumbbell Rows / Single Leg",
    exercises: ["Dumbbell Rows 3x10 (each arm)", "Bulgarian Split Squats 3x12 (each leg)"],
  },
};

export function AccessoryDisplay({ lift }: AccessoryDisplayProps) {
  const accessories = accessoryMap[lift];

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Today's Accessories: {accessories.title}
          </CardTitle>
          <Dumbbell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {accessories.exercises.map((ex) => (
              <li key={ex}>{ex}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conditioning</CardTitle>
          <Repeat className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Don't forget to get your conditioning in. Sled work, sprints, or circuits are great options.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
