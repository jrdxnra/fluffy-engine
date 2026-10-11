import type { Client } from "@/lib/types";

type RosterStatusProps = {
  client: Client;
  groupId?: string;
  groupCurrentCycle?: number;
};

/** One quiet line under a roster name: the client's cycle, and whether anything needs a look. */
export function RosterStatus({ client, groupId, groupCurrentCycle }: RosterStatusProps) {
  const cycle = (groupId ? client.programStateByGroup?.[groupId]?.currentCycleNumber : undefined) ?? client.currentCycleNumber ?? 1;
  const profiles = Object.values(client.movementProfilesByCycle?.[cycle] || {});
  const holds = profiles.filter((profile) => profile.progressionHoldActive).length;
  const isBehind = typeof groupCurrentCycle === "number" && cycle < groupCurrentCycle;
  const hasNumbers = profiles.some((profile) => profile.trainingMax > 0)
    || Object.values(client.trainingMaxesByCycle?.[cycle] || client.trainingMaxes || {}).some((value) => Number(value) > 0);

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-normal leading-none">
      <span className="text-muted-foreground">Cycle {cycle}</span>
      {isBehind ? <span className="font-semibold text-sky-600 dark:text-sky-400">Behind group</span> : null}
      {holds > 0 ? <span className="font-semibold text-amber-600 dark:text-amber-400">{holds} on hold</span> : null}
      {!hasNumbers ? <span className="font-semibold text-rose-600 dark:text-rose-400">No numbers yet</span> : null}
    </span>
  );
}
