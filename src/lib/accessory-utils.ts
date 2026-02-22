import type { CycleSettings, Lift } from "@/lib/types";
import { accessoryMap } from "@/lib/workout-content";

const normalizeAccessoryName = (name: string): string => {
  return name
    .replace(/^\s*\d+\s*x\s*\d+[a-z]*\s+/i, "")
    .replace(/^\s*\d+\s*x\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const stripAccessoryPrefix = (name: string): string => {
  return name
    .replace(/^\s*\d+\s*x\s*\d+[a-z]*\s+/i, "")
    .replace(/^\s*\d+\s*x\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

const hasVisibilityMap = (map: Record<string, boolean> | undefined): map is Record<string, boolean> => {
  return Boolean(map && Object.keys(map).length > 0);
};

export const resolveVisibleAccessories = (
  cycleSettings: CycleSettings | undefined,
  weekKey: string | undefined,
  lift: Lift
): string[] => {
  if (!cycleSettings || !weekKey) {
    return accessoryMap[lift].exercises;
  }

  const week = cycleSettings[weekKey];
  const configured = week?.accessories?.[lift];
  const baseList = configured && configured.length > 0 ? configured : accessoryMap[lift].exercises;

  const currentVisibilityMap = week?.accessoryVisibility?.[lift];
  if (hasVisibilityMap(currentVisibilityMap)) {
    return baseList.filter((exercise) => currentVisibilityMap[exercise] === true);
  }

  if (weekKey !== "week1") {
    const week1VisibilityMap = cycleSettings.week1?.accessoryVisibility?.[lift];
    if (hasVisibilityMap(week1VisibilityMap)) {
      const week1Selected = Object.entries(week1VisibilityMap)
        .filter(([, visible]) => visible === true)
        .map(([name]) => stripAccessoryPrefix(name))
        .filter((name) => name.length > 0);

      const normalizedVisible = new Set(
        week1Selected.map((name) => normalizeAccessoryName(name))
      );

      if (normalizedVisible.size > 0) {
        const byNormalizedBase = new Map(
          baseList.map((exercise) => [normalizeAccessoryName(exercise), exercise])
        );

        const resolved = week1Selected
          .map((selected) => byNormalizedBase.get(normalizeAccessoryName(selected)) || selected)
          .filter((value, index, array) => array.indexOf(value) === index);

        if (resolved.length > 0) {
          return resolved;
        }
      }

      const fallbackNormalized = new Set(
        Object.entries(week1VisibilityMap)
          .filter(([, visible]) => visible === true)
          .map(([name]) => normalizeAccessoryName(name))
      );

      if (fallbackNormalized.size > 0) {
        return baseList.filter((exercise) => fallbackNormalized.has(normalizeAccessoryName(exercise)));
      }
    }
  }

  return baseList;
};
