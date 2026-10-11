import type { LiftProgressStatus } from "@/lib/types";

type LifterStatusLineProps = {
  trainingMax?: number;
  status?: LiftProgressStatus;
  /** True once this lifter has a set logged for the lift this week. */
  logged?: boolean;
  className?: string;
};

/**
 * One compact line under a lifter's name: the training max the weights come from,
 * plus plain-word markers for anything that changes how the lift progresses.
 */
export function LifterStatusLine({ trainingMax, status, logged = false, className = "" }: LifterStatusLineProps) {
  const hasTrainingMax = typeof trainingMax === "number" && trainingMax > 0;
  if (!hasTrainingMax && !status?.hold && !status?.calibrating && !logged) return null;

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-normal leading-none ${className}`}>
      {hasTrainingMax ? (
        <span className="whitespace-nowrap font-code text-muted-foreground" title="Training max the weights are calculated from">
          TM {trainingMax}
        </span>
      ) : null}
      {status?.hold ? (
        <span className="whitespace-nowrap font-semibold text-amber-600 dark:text-amber-400" title="On hold: will not go up at graduation">
          Hold
        </span>
      ) : null}
      {status?.calibrating ? (
        <span className="whitespace-nowrap font-semibold text-sky-600 dark:text-sky-400" title="Calibrating: numbers come from the first logged sets">
          Calibrating
        </span>
      ) : null}
      {logged ? (
        <span className="whitespace-nowrap font-semibold text-emerald-600 dark:text-emerald-400" title="Logged this week">
          Logged
        </span>
      ) : null}
    </div>
  );
}
