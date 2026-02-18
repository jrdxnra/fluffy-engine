"use client";

import { format } from "date-fns";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { HistoricalRecord, Lift } from "@/lib/types";

type ClientProgressChartProps = {
  data: HistoricalRecord[];
  lift: Lift;
};

const chartConfig = {
  estimated1RM: {
    label: "e1RM",
    color: "hsl(var(--primary))",
  },
} as const;


export function ClientProgressChart({ data }: ClientProgressChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    date: new Date(item.date),
    formattedDate: format(new Date(item.date), "MMM d"),
  }));

  if (formattedData.length < 2) {
      return (
          <div className="flex h-full w-full items-center justify-center">
              <p className="text-muted-foreground">Not enough data to display a chart. Log at least two workouts for this lift.</p>
          </div>
      )
  }

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
                  <div className="font-bold text-foreground">e1RM: {props.payload.estimated1RM} lbs</div>
                  <div className="text-xs text-muted-foreground">
                    {props.payload.weight} lbs x {props.payload.reps} reps
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(props.payload.date), "PPP")}
                  </div>
                </div>
              )}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="estimated1RM"
          stroke="var(--color-estimated1RM)"
          strokeWidth={2}
          dot={{
            r: 4,
            fill: "var(--color-estimated1RM)",
            stroke: "hsl(var(--background))",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ChartContainer>
  );
}
