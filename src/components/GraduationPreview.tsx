import type { Client, CycleScheduleSettings, GlobalMovementSettings, Lift } from "@/lib/types";
import { getGraduationPreview, type GraduationPreviewRow } from "@/lib/graduation";

type GraduationPreviewProps = {
  clients: Client[];
  groupId?: string;
  groupCurrentCycle: number;
  currentCycleSchedule?: CycleScheduleSettings;
  globalMovementSettings?: GlobalMovementSettings;
  /** Lift slots whose movement changes next cycle. */
  changedLifts: Lift[];
};

const outcomeLabel: Record<GraduationPreviewRow["outcome"], { text: string; className: string }> = {
  up: { text: "", className: "text-emerald-600 dark:text-emerald-400" },
  hold: { text: "Hold", className: "text-amber-600 dark:text-amber-400" },
  calibrating: { text: "Calibrating", className: "text-sky-600 dark:text-sky-400" },
  "new-movement": { text: "New movement", className: "text-sky-600 dark:text-sky-400" },
  "no-numbers": { text: "No numbers", className: "text-muted-foreground" },
};

/** Read-only table of what graduation will do to each selected lifter's training maxes. */
export function GraduationPreview({
  clients,
  groupId,
  groupCurrentCycle,
  currentCycleSchedule,
  globalMovementSettings,
  changedLifts,
}: GraduationPreviewProps) {
  if (clients.length === 0) {
    return <p className="text-xs text-muted-foreground">Select at least one client to see what will change.</p>;
  }

  const previews = clients.map((client) => ({
    client,
    rows: getGraduationPreview(client, {
      groupId,
      targetCycle: groupCurrentCycle + 1,
      groupCurrentCycle: groupId ? groupCurrentCycle : undefined,
      currentCycleSchedule,
      globalMovementSettings,
      options: { noIncrementLifts: changedLifts, calibrationLifts: changedLifts },
    }),
  }));
  const liftOrder = previews[0].rows.map((row) => row.lift);
  const behind = (client: Client) => (client.currentCycleNumber || 1) < groupCurrentCycle;

  return (
    <div className="overflow-x-auto rounded-md border border-border/70">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-1.5">Client</th>
            {liftOrder.map((lift) => (
              <th key={lift} className="px-3 py-1.5">{currentCycleSchedule?.liftDisplayNames?.[lift] || lift}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previews.map(({ client, rows }) => (
            <tr key={client.id} className="border-b last:border-b-0">
              <td className="whitespace-nowrap px-3 py-1.5 font-medium">
                {client.name}
                {behind(client) ? (
                  <span className="ml-1.5 text-[11px] font-normal text-sky-600 dark:text-sky-400" title={`On cycle ${client.currentCycleNumber || 1}; will catch up to the group`}>
                    catching up
                  </span>
                ) : null}
              </td>
              {rows.map((row) => {
                const label = outcomeLabel[row.outcome];
                return (
                  <td key={row.lift} className="whitespace-nowrap px-3 py-1.5 font-code">
                    {row.outcome === "new-movement" || row.outcome === "no-numbers" ? (
                      <span className={`font-sans text-xs ${label.className}`}>{label.text}</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">{row.before}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className={row.after > row.before ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold"}>{row.after}</span>
                        {label.text ? <span className={`ml-1.5 font-sans text-[11px] font-semibold ${label.className}`}>{label.text}</span> : null}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
