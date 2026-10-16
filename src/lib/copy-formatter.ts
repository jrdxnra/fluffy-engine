import type { WorkoutSet } from "@/lib/types";

/**
 * The text the Copy button puts on the clipboard. Every name passed in is already the lifter's own movement name
 * (e.g. "Hex Bar Deadlift"), so nothing is found and replaced afterwards.
 */

/** What copying puts on the clipboard: plain text, and the same as HTML for places that keep a table's cells. */
export type Copied = { plain: string; rich: string };

export type ActualSet = { weight: number; reps: number };
/** Logged or typed actuals, keyed by the set's position in the workout's set list. */
export type ActualsBySet = Record<string, ActualSet | undefined>;

export type CopyLift = {
  /** The lifter's movement name for this lift. */
  name: string;
  sets: WorkoutSet[];
  accessories: string[];
  actuals?: ActualsBySet;
};

const actualAt = (actuals: ActualsBySet | undefined, index: number): ActualSet | null => {
  const actual = actuals?.[String(index)];
  return actual && actual.weight !== undefined && actual.reps !== undefined ? actual : null;
};

const describeSet = (weight: number, reps: string | number): string =>
  weight > 0 ? `${weight} lbs x ${reps}` : `x ${reps}`;

/** One lift as text to send a lifter: main sets, what they logged, then accessories. */
export const formatLiftCopyText = ({
  lift,
  dateLabel,
  includeWarmups,
}: {
  lift: CopyLift;
  dateLabel?: string;
  includeWarmups: boolean;
}): string => {
  const shown = lift.sets
    .map((set, index) => ({ set, index }))
    .filter(({ set }) => includeWarmups || set.type === "Work Set");

  const sections: string[][] = [[dateLabel ? `${lift.name} ${dateLabel}` : lift.name]];
  sections.push(["Main Sets", ...shown.map(({ set }) => `${set.label}: ${describeSet(set.weight, set.reps)}`)]);

  const logged = shown
    .map(({ set, index }) => {
      const actual = actualAt(lift.actuals, index);
      return actual ? `${set.label}: ${describeSet(actual.weight, actual.reps)}` : null;
    })
    .filter((line): line is string => line !== null);
  if (logged.length > 0) sections.push(["Logged Actuals", ...logged]);

  if (lift.accessories.length > 0) {
    sections.push([`${lift.name} Accessories`, ...lift.accessories.map((item) => `- ${item}`)]);
  }

  return sections.map((lines) => lines.join("\n")).join("\n\n");
};

const parseAccessoryPrescription = (
  text: string
): { movement: string; sets: string; target: string } | null => {
  const normalized = text.trim().replace(/\s+/g, " ");
  const prefix = normalized.match(/^\s*(\d+)\s*[xX]\s*([^\s]+)\s+(.+)$/);
  if (prefix) {
    const [, sets, target, movement] = prefix;
    return { movement: movement.trim(), sets, target };
  }

  const suffix = normalized.match(/^\s*(.+?)\s+(\d+)\s*[xX]\s*([^\s]+)\s*$/);
  if (suffix) {
    const [, movement, sets, target] = suffix;
    return { movement: movement.trim(), sets, target };
  }

  return null;
};

export const TABLE_COLUMNS = ["MOVEMENTS", "SETS", "REC REPS", "REC LOAD", "ACT REPS", "ACT LOAD"];
const load = (weight: number | undefined): string => (weight && weight > 0 ? String(weight) : "");

/** The rows of a session laid out like the coach's sheet: work sets for each lift, then the day's accessories. */
const sessionRows = (lifts: CopyLift[]): string[][] => {
  const rows: string[][] = [];
  const accessories: string[] = [];

  for (const lift of lifts) {
    const workSets = lift.sets.map((set, index) => ({ set, index })).filter(({ set }) => set.type === "Work Set");
    if (workSets.length === 0) continue;
    rows.push([`WORKING SETS: ${lift.name.toUpperCase()}`]);
    for (const { set, index } of workSets) {
      const actual = actualAt(lift.actuals, index);
      rows.push([lift.name, "1", String(set.reps), load(set.weight), actual ? String(actual.reps) : "", load(actual?.weight)]);
    }
    for (const accessory of lift.accessories) {
      if (!accessories.includes(accessory)) accessories.push(accessory);
    }
  }

  if (rows.length > 0 && accessories.length > 0) {
    rows.push(["WORKING SETS: ACCESSORIES"]);
    for (const accessory of accessories) {
      const parsed = parseAccessoryPrescription(accessory);
      rows.push(parsed ? [parsed.movement, parsed.sets, parsed.target, "", "", ""] : [accessory, "", "", "", "", ""]);
    }
  }
  return rows;
};

/** A whole day as a table that pastes into the coach's sheet. */
export const formatDayCopyText = ({ lifts, dateLabel }: { lifts: CopyLift[]; dateLabel?: string }): string => {
  const header = `${lifts.map((lift) => lift.name).join(" + ")}${dateLabel ? ` ${dateLabel}` : ""}`;
  const lines = [header, TABLE_COLUMNS.join("\t"), ""];
  let previousWasLift = false;
  for (const row of sessionRows(lifts)) {
    const isHeading = row.length === 1;
    if (isHeading && previousWasLift) lines.push("");
    lines.push(isHeading ? row[0] : row.join("\t"));
    previousWasLift = !isHeading;
  }
  return lines.join("\n");
};

// ── Month so far ───────────────────────────────────────────────────────────────

export type MonthSession = {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** e.g. "Cycle 3 · Week 2 (3s)". */
  label: string;
  lifts: CopyLift[];
};

type CellKind = "title" | "date" | "head" | "section" | "body" | "gap";
type Cell = { text: string; kind: CellKind; span?: number; covered?: boolean };
type Grid = Cell[][];

const BLOCK_WIDTH = TABLE_COLUMNS.length;
const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const parseDate = (iso: string) => new Date(`${iso}T00:00:00`);
const gapCells = (count: number): Cell[] => Array.from({ length: count }, () => ({ text: "", kind: "gap" }));
const wide = (text: string, kind: CellKind, width = BLOCK_WIDTH): Cell[] => [
  { text, kind, span: width },
  ...Array.from({ length: width - 1 }, () => ({ text: "", kind, covered: true })),
];

/**
 * The month's columns, laid out so the PCA app's history import reads them: a full date (10/13/2026) at the top
 * of each block, then MOVEMENT, SETS, REPS and LOAD. REPS and LOAD are what was done; the planned numbers sit
 * beside them, where the import ignores them.
 */
export const MONTH_COLUMNS = ["MOVEMENT", "SETS", "REPS", "LOAD", "PLANNED REPS", "PLANNED LOAD"];

/**
 * One lift as rows: the name on its first set only, so the import keeps the sets together as one movement. A set
 * with logged numbers shows them; a set without shows the plan, and the heading says when nothing was logged.
 */
const monthLiftRows = (lift: CopyLift): Grid => {
  const workSets = lift.sets.map((set, index) => ({ set, index })).filter(({ set }) => set.type === "Work Set");
  if (workSets.length === 0) return [];
  const anyLogged = workSets.some(({ index }) => actualAt(lift.actuals, index));
  const rows: Grid = [wide(`WORKING SETS: ${lift.name.toUpperCase()}${anyLogged ? "" : " (NOT LOGGED, PLANNED SHOWN)"}`, "section", MONTH_COLUMNS.length)];
  workSets.forEach(({ set, index }, position) => {
    const actual = actualAt(lift.actuals, index);
    const cells = [
      position === 0 ? lift.name : "",
      "1",
      actual ? String(actual.reps) : String(set.reps),
      actual ? load(actual.weight) : load(set.weight),
      String(set.reps),
      load(set.weight),
    ];
    rows.push(cells.map((text) => ({ text, kind: "body" })));
  });
  return rows;
};

const sessionBlock = (session: MonthSession): Grid => {
  const day = parseDate(session.date);
  const width = MONTH_COLUMNS.length;
  const rows: Grid = [
    [
      { text: `${day.getMonth() + 1}/${day.getDate()}/${day.getFullYear()}`, kind: "date" },
      ...wide(`${weekdayNames[day.getDay()]} · ${session.label}`, "date", width - 1),
    ],
    MONTH_COLUMNS.map((text) => ({ text, kind: "head" })),
  ];
  const accessories: string[] = [];
  for (const lift of session.lifts) {
    rows.push(...monthLiftRows(lift));
    for (const accessory of lift.accessories) {
      if (!accessories.includes(accessory)) accessories.push(accessory);
    }
  }
  if (accessories.length > 0) {
    // Accessories are names only (the program has no sets or reps for them), so the import skips them.
    rows.push(wide("ACCESSORIES (PROGRAMMED)", "section", width));
    for (const accessory of accessories) rows.push([{ text: accessory, kind: "body" }, ...gapCells(width - 1).map((cell) => ({ ...cell, kind: "body" as const }))]);
  }
  return rows;
};

const mondayOf = (date: Date): Date => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};
const isoOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Sessions as a grid: a week to a row, each training day in its own column (only the weekdays the lifter trains,
 * Monday first), so the month reads across and down like the coach's sheet.
 */
export const buildMonthGrid = (sessions: MonthSession[], title: string): Grid => {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const weekdays = Array.from(new Set(sorted.map((session) => parseDate(session.date).getDay()))).sort(
    (a, b) => ((a + 6) % 7) - ((b + 6) % 7)
  );
  const columns = Math.max(1, weekdays.length);
  const width = columns * BLOCK_WIDTH + (columns - 1);
  const grid: Grid = [wide(title, "title", width)];

  const weeks = new Map<string, MonthSession[]>();
  for (const session of sorted) {
    const key = isoOf(mondayOf(parseDate(session.date)));
    weeks.set(key, [...(weeks.get(key) || []), session]);
  }

  for (const weekSessions of weeks.values()) {
    const blocks = weekdays.map((weekday) => {
      const rows: Grid = [];
      weekSessions
        .filter((session) => parseDate(session.date).getDay() === weekday)
        .forEach((session, position) => {
          if (position > 0) rows.push(gapCells(BLOCK_WIDTH));
          rows.push(...sessionBlock(session));
        });
      return rows;
    });
    const height = Math.max(0, ...blocks.map((rows) => rows.length));
    grid.push(gapCells(width));
    for (let row = 0; row < height; row += 1) {
      const line: Cell[] = [];
      blocks.forEach((rows, column) => {
        if (column > 0) line.push(...gapCells(1));
        line.push(...(rows[row] || gapCells(BLOCK_WIDTH)));
      });
      grid.push(line);
    }
  }
  return grid;
};

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const STYLE: Record<CellKind, string> = {
  gap: "border:none;",
  title: "border:none;font-weight:bold;font-size:12pt;",
  date: "border:1px solid #000;font-weight:bold;text-align:center;background:#f3f3f3;",
  head: "border:1px solid #000;font-weight:bold;text-align:center;",
  section: "border:1px solid #000;font-weight:bold;text-align:center;background:#d9d9d9;",
  body: "border:1px solid #000;",
};

export const gridToTsv = (grid: Grid): string =>
  grid.map((row) => row.map((cell) => cell.text.replace(/[\t\n]+/g, " ")).join("\t").replace(/\t+$/, "")).join("\n");

export const gridToHtml = (grid: Grid): string => {
  const rows = grid
    .map((row) => {
      const cells = row
        .filter((cell) => !cell.covered)
        .map(
          (cell) =>
            `<td${cell.span ? ` colspan="${cell.span}"` : ""} style="${STYLE[cell.kind]}padding:2px 4px;font-family:Arial,sans-serif;font-size:10pt;white-space:nowrap;">${escapeHtml(cell.text)}</td>`
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;">${rows}</table>`;
};

export const formatMonthCopy = (sessions: MonthSession[], title: string): Copied => {
  const grid = buildMonthGrid(sessions, title);
  return { plain: gridToTsv(grid), rich: gridToHtml(grid) };
};

/** Puts plain text, and HTML when given, on the clipboard. */
export const writeClipboard = async (content: string | Copied): Promise<void> => {
  const { plain, rich } = typeof content === "string" ? { plain: content, rich: "" } : content;
  if (rich && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([rich], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(plain);
};
