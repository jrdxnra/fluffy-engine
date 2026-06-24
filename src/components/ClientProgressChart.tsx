"use client";

import { format } from "date-fns";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { HistoricalRecord } from "@/lib/types";
import { mround } from "@/lib/utils";

type ClientProgressChartProps = {
  data: HistoricalRecord[];
  movementLabel: string;
};

const chartConfig = {
  actual1RM: {
    label: "Actual 1RM",
    color: "hsl(var(--primary))",
  },
  recommendedTarget: {
    label: "Recommended 1RM",
    color: "hsl(var(--muted-foreground))",
  },
} as const;


export function ClientProgressChart({
  data,
  movementLabel,
}: ClientProgressChartProps) {
  const historicalPoints = (() => {
    // Deduplicate by calendar day — keep the best estimated1RM per day
    const byDay = new Map<string, HistoricalRecord>();
    for (const item of data) {
      const day = format(new Date(item.date), "yyyy-MM-dd");
      const existing = byDay.get(day);
      if (!existing || item.estimated1RM > existing.estimated1RM) {
        byDay.set(day, item);
      }
    }
    return Array.from(byDay.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        formattedDate: format(new Date(item.date), "MMM d"),
        actual1RM: item.estimated1RM,
        recommendedTarget:
          item.recommendedTarget1RM ??
          (item.recommendedTopSetWeight && item.recommendedTopSetReps
            ? Math.round(item.recommendedTopSetWeight * (1 + item.recommendedTopSetReps / 30))
            : item.recommendedTrainingMax ?? mround(item.estimated1RM * 0.9)),
        isCurrent: false,
      }));
  })();

  const formattedData = historicalPoints;

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <LineChart
        accessibilityLayer
        data={formattedData}
        margin={{
          top: 5,
          right: 20,
          left: 10,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="formattedDate"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
        />
        <YAxis
          domain={['dataMin - 10', 'dataMax + 10']}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
          tickFormatter={(value) => `${value} lbs`}
        />
        <Tooltip
          cursor={true}
          content={
            <ChartTooltipContent
              hideLabel
              indicator="dot"
              formatter={(_value, _name, props, index) => {
                // Only render custom content for the first item to avoid duplication
                if (index !== 0) return null;
                return (
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="font-bold text-foreground">{movementLabel} - {format(new Date(props.payload.date), "PPP")}</div>
                    <div className="text-xs text-muted-foreground">
                      Actual 1RM: {props.payload.actual1RM} lbs
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Recommended 1RM: {props.payload.recommendedTarget} lbs
                    </div>
                    {props.payload.weight && props.payload.reps ? (
                      <div className="text-xs text-muted-foreground">
                        {props.payload.weight} lbs x {props.payload.reps} reps
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="actual1RM"
          stroke="var(--color-actual1RM)"
          strokeWidth={2}
          dot={{
            r: 4,
            fill: "var(--color-actual1RM)",
            stroke: "hsl(var(--background))",
            strokeWidth: 2,
          }}
        />
        <Line
          type="monotone"
          dataKey="recommendedTarget"
          stroke="var(--color-recommendedTarget)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{
            r: 3,
            fill: "var(--color-recommendedTarget)",
            stroke: "hsl(var(--background))",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ChartContainer>
  );
}
