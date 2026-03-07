"use client";

import { format } from "date-fns";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { HistoricalRecord, Lift } from "@/lib/types";
import { mround } from "@/lib/utils";

type ClientProgressChartProps = {
  data: HistoricalRecord[];
  lift: Lift;
  currentOneRepMax?: number;
  currentTrainingMax?: number;
};

const chartConfig = {
  actual1RM: {
    label: "Actual 1RM",
    color: "hsl(var(--primary))",
  },
  recommendedTM: {
    label: "Recommended TM",
    color: "hsl(var(--muted-foreground))",
  },
} as const;


export function ClientProgressChart({
  data,
  lift,
  currentOneRepMax,
  currentTrainingMax,
}: ClientProgressChartProps) {
  const historicalPoints = data.map(item => ({
    ...item,
    date: item.date,
    formattedDate: format(new Date(item.date), "MMM d"),
    actual1RM: item.estimated1RM,
    recommendedTM: mround(item.estimated1RM * 0.9),
    isCurrent: false,
  }));

  const latestHistorical = historicalPoints[historicalPoints.length - 1];
  const effectiveCurrentOneRepMax = currentOneRepMax ?? latestHistorical?.actual1RM ?? 0;
  const effectiveCurrentTrainingMax = currentTrainingMax ?? latestHistorical?.recommendedTM ?? 0;
  const shouldAppendCurrentPoint =
    effectiveCurrentOneRepMax > 0 &&
    (
      !latestHistorical ||
      latestHistorical.actual1RM !== effectiveCurrentOneRepMax ||
      latestHistorical.recommendedTM !== effectiveCurrentTrainingMax
    );

  const currentPoint = {
    date: new Date().toISOString(),
    formattedDate: "Now",
    actual1RM: effectiveCurrentOneRepMax,
    recommendedTM: effectiveCurrentTrainingMax,
    weight: null,
    reps: null,
    isCurrent: true,
  };

  const formattedData = shouldAppendCurrentPoint
    ? [...historicalPoints, currentPoint]
    : historicalPoints;

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
              formatter={(_value, _name, props) => (
                <div className="flex flex-col gap-1 text-sm">
                  <div className="font-bold text-foreground">{lift} - {format(new Date(props.payload.date), "PPP")}</div>
                  <div className="text-xs text-muted-foreground">
                    Actual 1RM: {props.payload.actual1RM} lbs
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Recommended TM: {props.payload.recommendedTM} lbs
                  </div>
                  {props.payload.weight && props.payload.reps ? (
                    <div className="text-xs text-muted-foreground">
                      {props.payload.weight} lbs x {props.payload.reps} reps
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Current profile settings</div>
                  )}
                </div>
              )}
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
          dataKey="recommendedTM"
          stroke="var(--color-recommendedTM)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{
            r: 3,
            fill: "var(--color-recommendedTM)",
            stroke: "hsl(var(--background))",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ChartContainer>
  );
}
