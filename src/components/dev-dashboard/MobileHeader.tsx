"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lift } from "@/lib/types";

type ViewMode = "day" | "lift";

type MobileHeaderProps = {
  title: string;
  strikeTitle?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  dayViewSlot: "day1" | "day2";
  onDayViewSlotChange: (slot: "day1" | "day2") => void;
  day1Label: string;
  day2Label: string;
  lift: Lift;
  onLiftChange: (lift: Lift) => void;
  scrollLift?: string;
  onTitleClick?: () => void;
};

export function MobileHeader({
  title,
  strikeTitle = false,
  theme,
  onToggleTheme,
  viewMode,
  onViewModeChange,
  dayViewSlot,
  onDayViewSlotChange,
  day1Label,
  day2Label,
  lift,
  onLiftChange,
  scrollLift,
  onTitleClick,
}: MobileHeaderProps) {
  const lifts: Lift[] = ["Deadlift", "Bench", "Squat", "Press"];
  const liftAbbr: Record<Lift, string> = {
    Deadlift: "DL",
    Bench: "B",
    Squat: "SQ",
    Press: "P",
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      {/* Row 1: title (absolutely centered) | theme toggle */}
      <div className="relative flex h-12 items-center px-3">
        {/* Absolutely centered title — unaffected by button widths */}
        {viewMode === "day" && onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className={`absolute inset-x-0 mx-auto w-fit text-center text-xl font-black tracking-widest text-primary uppercase transition-opacity active:opacity-60 ${strikeTitle ? "opacity-60" : ""}`}
          >
            {scrollLift ?? title}
          </button>
        ) : (
          <p className={`absolute inset-x-0 mx-auto w-fit truncate text-center text-xl font-black tracking-tight ${strikeTitle ? "line-through opacity-60" : ""}`}>
            {title}
          </p>
        )}
        {/* Theme toggle — pushed to the right */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-9 w-9 shrink-0 p-0"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      {/* Row 2: view mode toggle (left) | day/lift selector (right) */}
      <div className="flex h-10 items-center justify-between gap-2 overflow-x-auto px-3 pb-1">
        {/* View mode segmented control */}
        <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border text-xs">
          <button
            type="button"
            className={`h-8 px-3 font-medium transition-colors ${viewMode === "day" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
            onClick={() => onViewModeChange("day")}
          >
            Day
          </button>
          <button
            type="button"
            className={`h-8 border-l px-3 font-medium transition-colors ${viewMode === "lift" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
            onClick={() => onViewModeChange("lift")}
          >
            Lift
          </button>
        </div>

        {/* Day selector */}
        {viewMode === "day" && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={dayViewSlot === "day1" ? "default" : "outline"}
              className="h-8 px-3 text-xs whitespace-nowrap"
              onClick={() => onDayViewSlotChange("day1")}
            >
              {day1Label}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={dayViewSlot === "day2" ? "default" : "outline"}
              className="h-8 px-3 text-xs whitespace-nowrap"
              onClick={() => onDayViewSlotChange("day2")}
            >
              {day2Label}
            </Button>
          </div>
        )}

        {/* Lift selector */}
        {viewMode === "lift" && (
          <div className="flex shrink-0 items-center gap-1">
            {lifts.map((l) => (
              <Button
                key={l}
                type="button"
                size="sm"
                variant={lift === l ? "default" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() => onLiftChange(l)}
              >
                {liftAbbr[l]}
              </Button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
