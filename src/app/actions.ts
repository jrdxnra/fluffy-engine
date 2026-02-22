"use server";

import { revalidatePath } from "next/cache";
import type { CycleScheduleSettings, CycleSettings, Lift, LoggedSetInputsByCycle, LoggedSetMap, SessionMode } from "@/lib/types";
import { calculateTrainingMaxes } from "@/lib/training-max";

const getRepScheme = (workset3Reps: string | number | undefined): string => {
  if (workset3Reps === undefined || workset3Reps === null) return "?";
  return typeof workset3Reps === "string"
    ? workset3Reps.replace(/\D/g, "") || "?"
    : workset3Reps.toString();
};

const normalizeWeekAssignmentsForCycle = (
  assignments: Record<string, string> | undefined,
  cycleSettings: CycleSettings | undefined
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  if (!assignments || !cycleSettings) return normalized;

  for (const [weekKey, repScheme] of Object.entries(assignments)) {
    const weekSettings = cycleSettings[weekKey];
    if (!weekSettings) continue;

    const globalRepScheme = getRepScheme(weekSettings.reps?.workset3);
    if (repScheme === "N/A" || repScheme !== globalRepScheme) {
      normalized[weekKey] = repScheme;
    }
  }

  return normalized;
};

const normalizeAssignmentsByCycle = (
  assignmentsByCycle: Record<number, Record<string, string>>,
  cycleSettingsByCycle: Record<number, CycleSettings>
): Record<number, Record<string, string>> => {
  const cleaned: Record<number, Record<string, string>> = {};

  for (const [cycleKey, assignments] of Object.entries(assignmentsByCycle || {})) {
    const cycleNumber = Number(cycleKey);
    if (Number.isNaN(cycleNumber)) continue;

    const normalizedCycleAssignments = normalizeWeekAssignmentsForCycle(
      assignments,
      cycleSettingsByCycle[cycleNumber]
    );

    if (Object.keys(normalizedCycleAssignments).length > 0) {
      cleaned[cycleNumber] = normalizedCycleAssignments;
    }
  }

  return cleaned;
};

// Inline 1RM calculation (Epley formula)
const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};

export async function addClientAction(clientData: {
  name: string;
  oneRepMaxes: { Squat: number; Bench: number; Deadlift: number; Press: number };
  trainingMaxes?: { Squat: number; Bench: number; Deadlift: number; Press: number };
  trainingMaxesByCycle?: { [cycleNumber: number]: { Squat: number; Bench: number; Deadlift: number; Press: number } };
  currentCycleNumber?: number;
  weekAssignmentsByCycle?: { [cycleNumber: number]: { [weekKey: string]: string } };
}) {
  "use server";
  try {
    // Dynamic import to avoid module issues
    const { addClient, getClients } = await import("@/lib/data");
    const existingClients = await getClients();

    const computedTrainingMaxes = calculateTrainingMaxes(clientData.oneRepMaxes);

    const normalizedClientData = {
      name: clientData.name,
      oneRepMaxes: clientData.oneRepMaxes,
      trainingMaxes: computedTrainingMaxes,
      trainingMaxesByCycle: {
        ...(clientData.trainingMaxesByCycle || {}),
        1: computedTrainingMaxes,
      },
      currentCycleNumber: clientData.currentCycleNumber || 1,
      weekAssignmentsByCycle: clientData.weekAssignmentsByCycle || { 1: { week1: "5", week2: "3", week3: "1" } },
      rosterOrder: existingClients.length,
    };

    console.log("Server Action: Adding client", normalizedClientData);
    await addClient(normalizedClientData as any);
    revalidatePath("/");
    return { success: true, message: "Client added successfully." };
  } catch (error) {
    console.error("Error adding client:", error);
    return { success: false, message: `Failed to add client: ${error}` };
  }
}

export async function logRepRecordAction(
  clientId: string,
  lift: string,
  weight: number,
  reps: number
) {
  "use server";
  try {
    const { addHistoricalRecord } = await import("@/lib/data");
    const record = {
      clientId,
      date: new Date().toISOString(),
      lift: lift as 'Squat' | 'Bench' | 'Deadlift' | 'Press',
      weight,
      reps,
      estimated1RM: calculate1RM(weight, reps),
    };
    
    console.log("Server Action: Logging rep record", record);
    await addHistoricalRecord(record);
    revalidatePath("/");
    return { success: true, message: "Workout logged." };
  } catch (error) {
    console.error("Error logging rep record:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Failed to log workout.";
    return { success: false, message };
  }
}


export async function graduateTeamAction(clients: any[]) {
  "use server";
  try {
    const { graduateTeam, getClients } = await import("@/lib/data");
    console.log("Server Action: Graduating team");
    await graduateTeam(clients);
    const updatedClients = await getClients();
    revalidatePath("/");
    
    const nextCycleNumber = (updatedClients[0]?.currentCycleNumber) || 2;
    return { 
      success: true, 
      message: "Team graduated successfully!",
      newCycleNumber: nextCycleNumber
    };
  } catch (error) {
    console.error("Error graduating team:", error);
    return { 
      success: false, 
      message: "Failed to graduate team."
    };
  }
}

export async function updateClientNotesAction(clientId: string, notes: string) {
  "use server";
  try {
    const { updateClient } = await import("@/lib/data");
    console.log("Server Action: Updating client notes", clientId, notes);
    await updateClient(clientId, { notes });
    revalidatePath("/");
    return { success: true, message: "Notes updated." };
  } catch (error) {
    console.error("Error updating client notes:", error);
    return { success: false, message: "Failed to update notes." };
  }
}

export async function updateClientProfileAction(
  clientId: string,
  updates: {
    initialWeights?: Record<string, number>;
    weekAssignmentsByCycle?: Record<number, Record<string, string>>;
    sessionStateByCycle?: Record<number, {
      mode: SessionMode;
      flowWeekKey?: string;
      applyUntilChanged?: boolean;
      note?: string;
      modeByWeek?: Record<string, SessionMode>;
      flowWeekKeyByWeek?: Record<string, string>;
    }>;
  }
) {
  "use server";
  try {
    const { updateClient } = await import("@/lib/data");
    await updateClient(clientId, updates as any);
    revalidatePath("/");
    return { success: true, message: "Client profile updated." };
  } catch (error) {
    console.error("Error updating client profile:", error);
    return { success: false, message: "Failed to update client profile." };
  }
}

export async function resetClientTrainingMaxAction(clientId: string, cycleNumber: number) {
  "use server";
  try {
    const { getClients, getHistoricalData, updateClient } = await import("@/lib/data");
    const clients = await getClients();
    const historicalData = await getHistoricalData();
    const client = clients.find((entry) => entry.id === clientId);

    if (!client) {
      return { success: false, message: "Client not found." };
    }

    const lifts = ["Squat", "Bench", "Deadlift", "Press"] as const;
    const mround = (value: number) => Math.round(value / 5) * 5;

    const updatedOneRepMaxes = { ...client.oneRepMaxes } as any;
    const updatedTrainingMaxes = { ...client.trainingMaxes } as any;
    const currentCycleMaxes = { ...(client.trainingMaxesByCycle?.[cycleNumber] || client.trainingMaxes) } as any;

    for (const lift of lifts) {
      const recentLiftRecords = historicalData
        .filter((record) => record.clientId === clientId && record.lift === lift)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);

      const bestEstimated1RM = Math.max(
        client.oneRepMaxes[lift],
        ...recentLiftRecords.map((record) => record.estimated1RM)
      );

      updatedOneRepMaxes[lift] = bestEstimated1RM;
      const nextTrainingMax = mround(bestEstimated1RM * 0.9);
      updatedTrainingMaxes[lift] = nextTrainingMax;
      currentCycleMaxes[lift] = nextTrainingMax;
    }

    const updatedTrainingMaxesByCycle = {
      ...(client.trainingMaxesByCycle || {}),
      [cycleNumber]: currentCycleMaxes,
    };

    await updateClient(clientId, {
      oneRepMaxes: updatedOneRepMaxes,
      trainingMaxes: updatedTrainingMaxes,
      trainingMaxesByCycle: updatedTrainingMaxesByCycle,
    } as any);

    revalidatePath("/");

    return {
      success: true,
      message: "Training max reset from recent performance.",
      updatedClient: {
        ...client,
        oneRepMaxes: updatedOneRepMaxes,
        trainingMaxes: updatedTrainingMaxes,
        trainingMaxesByCycle: updatedTrainingMaxesByCycle,
      },
    };
  } catch (error) {
    console.error("Error resetting client training max:", error);
    return { success: false, message: "Failed to reset training max." };
  }
}

export async function deleteCycleAction(
  clients: any[],
  cycleNumber: number,
  cycleSettingsByCycle: Record<number, CycleSettings>,
  cycleNames: Record<number, string>,
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>
) {
  "use server";
  try {
    const { updateClient, getClients, saveAppSettings } = await import("@/lib/data");
    console.log("Server Action: Deleting cycle", cycleNumber);
    console.log("Total clients to process:", clients.length);
    
    // Update all clients that are on this cycle
    for (const client of clients) {
      console.log(`Processing client: ${client.name}, currentCycleNumber: ${client.currentCycleNumber}`);
      
      if (client.currentCycleNumber === cycleNumber) {
        // Remove from their cycle assignments
        const newAssignments = { ...(client.weekAssignmentsByCycle || {}) };
        delete newAssignments[cycleNumber];
        
        // Remove from training maxes per cycle
        const newTrainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
        delete newTrainingMaxesByCycle[cycleNumber];
        
        console.log(`Moving ${client.name} from cycle ${cycleNumber} to cycle 1`);
        
        // Reassign to Cycle 1
        await updateClient(client.id, {
          currentCycleNumber: 1,
          weekAssignmentsByCycle: newAssignments,
          trainingMaxesByCycle: newTrainingMaxesByCycle,
        });
      } else {
        // Just remove this cycle from their assignments
        const newAssignments = { ...(client.weekAssignmentsByCycle || {}) };
        delete newAssignments[cycleNumber];
        
        const newTrainingMaxesByCycle = { ...(client.trainingMaxesByCycle || {}) };
        delete newTrainingMaxesByCycle[cycleNumber];
        
        console.log(`Removing cycle ${cycleNumber} references from ${client.name}`);
        
        await updateClient(client.id, {
          weekAssignmentsByCycle: newAssignments,
          trainingMaxesByCycle: newTrainingMaxesByCycle,
        });
      }
    }

    const updatedCycleSettingsByCycle = { ...cycleSettingsByCycle };
    delete updatedCycleSettingsByCycle[cycleNumber];
    if (Object.keys(updatedCycleSettingsByCycle).length === 0) {
      updatedCycleSettingsByCycle[1] = {} as CycleSettings;
    }

    const updatedCycleNames = { ...cycleNames };
    delete updatedCycleNames[cycleNumber];
    if (Object.keys(updatedCycleNames).length === 0) {
      updatedCycleNames[1] = "Cycle 1";
    }

    const updatedCycleSchedulesByCycle = { ...(cycleSchedulesByCycle || {}) };
    delete updatedCycleSchedulesByCycle[cycleNumber];

    const saveResult = await saveAppSettings({
      cycleSettingsByCycle: updatedCycleSettingsByCycle,
      cycleNames: updatedCycleNames,
      cycleSchedulesByCycle: updatedCycleSchedulesByCycle,
    });

    // Mirror settings to clients for fallback/shared settings consistency
    try {
      const freshClients = await getClients();
      for (const client of freshClients) {
        await updateClient(client.id, {
          cycleSettingsByCycle: updatedCycleSettingsByCycle as any,
          cycleNames: updatedCycleNames as any,
          cycleSchedulesByCycle: updatedCycleSchedulesByCycle as any,
          settingsUpdatedAt: saveResult.settingsUpdatedAt as any,
        } as any);
      }
    } catch (mirrorError) {
      console.error("Warning: failed to mirror deleted cycle settings to clients:", mirrorError);
    }
    
    console.log("Server: All clients updated, calling revalidatePath");
    revalidatePath("/");
    return {
      success: true,
      message: "Cycle deleted successfully.",
      updatedCycleSettingsByCycle,
      updatedCycleNames,
      updatedCycleSchedulesByCycle,
    };
  } catch (error) {
    console.error("Error deleting cycle:", error);
    return { success: false, message: "Failed to delete cycle." };
  }
}

export async function saveCycleSettingsAction(
  cycleSettingsByCycle: Record<number, CycleSettings>,
  cycleNames: Record<number, string>,
  cycleSchedulesByCycle?: Record<number, CycleScheduleSettings>
) {
  "use server";
  try {
    const { saveAppSettings, getClients, updateClient } = await import("@/lib/data");
    console.log("Server Action: Saving cycle settings");
    const saveResult = await saveAppSettings({
      cycleSettingsByCycle,
      cycleNames,
      cycleSchedulesByCycle,
    }) as any;

    // Keep fallback/shared client-stored settings in sync.
    // Do not fail the request if this mirror step fails.
    try {
      const clients = await getClients();
      for (const client of clients) {
        await updateClient(client.id, {
          cycleSettingsByCycle: cycleSettingsByCycle as any,
          cycleNames: cycleNames as any,
          cycleSchedulesByCycle: (saveResult.cycleSchedulesByCycle || cycleSchedulesByCycle || {}) as any,
          settingsUpdatedAt: saveResult.settingsUpdatedAt as any,
        } as any);
      }
    } catch (mirrorError) {
      console.error("Warning: failed to mirror cycle settings to clients:", mirrorError);
    }

    revalidatePath("/");
    return { success: true, message: "Cycle settings saved." };
  } catch (error) {
    console.error("Error saving cycle settings to appSettings:", error);

    // Fallback: persist shared settings on client docs (uses existing write permissions)
    try {
      const { getClients, updateClient } = await import("@/lib/data");
      const fallbackUpdatedAt = new Date().toISOString();
      const clients = await getClients();
      for (const client of clients) {
        await updateClient(client.id, {
          cycleSettingsByCycle: cycleSettingsByCycle as any,
          cycleNames: cycleNames as any,
          cycleSchedulesByCycle: (cycleSchedulesByCycle || {}) as any,
          settingsUpdatedAt: fallbackUpdatedAt as any,
        } as any);
      }
      revalidatePath("/");
      return { success: true, message: "Cycle settings saved (fallback)." };
    } catch (fallbackError) {
      console.error("Error saving cycle settings fallback:", fallbackError);
      return { success: false, message: "Failed to save cycle settings." };
    }
  }
}

export async function updateClientWeekAssignmentsAction(
  updates: Array<{ id: string; weekAssignmentsByCycle: Record<number, Record<string, string>> }>
) {
  "use server";
  try {
    const { updateClient, getAppSettings } = await import("@/lib/data");
    const { cycleSettingsByCycle } = await getAppSettings();
    console.log("Server Action: Updating client week assignments", updates.length);

    for (const update of updates) {
      const cleanedAssignmentsByCycle = normalizeAssignmentsByCycle(
        update.weekAssignmentsByCycle,
        cycleSettingsByCycle
      );

      await updateClient(update.id, {
        weekAssignmentsByCycle: cleanedAssignmentsByCycle,
      });
    }

    revalidatePath("/");
    return { success: true, message: "Week assignments updated." };
  } catch (error) {
    console.error("Error updating week assignments:", error);
    return { success: false, message: "Failed to update week assignments." };
  }
}

export async function updateClientLoggedSetInputsAction(
  clientId: string,
  loggedSetInputsByCycle: LoggedSetInputsByCycle
) {
  "use server";
  try {
    const { updateClient } = await import("@/lib/data");
    await updateClient(clientId, {
      loggedSetInputsByCycle: loggedSetInputsByCycle as any,
    } as any);
    revalidatePath("/");
    return { success: true, message: "Logged set inputs updated." };
  } catch (error) {
    console.error("Error updating logged set inputs:", error);
    return { success: false, message: "Failed to update logged set inputs." };
  }
}

export async function updateClientLoggedSetInputsBulkAction(
  updates: Array<{ id: string; loggedSetInputsByCycle: LoggedSetInputsByCycle }>
) {
  "use server";
  try {
    const { updateClient } = await import("@/lib/data");
    for (const update of updates) {
      await updateClient(update.id, {
        loggedSetInputsByCycle: update.loggedSetInputsByCycle as any,
      } as any);
    }
    revalidatePath("/");
    return { success: true, message: "Logged set inputs bulk-updated." };
  } catch (error) {
    console.error("Error bulk updating logged set inputs:", error);
    return { success: false, message: "Failed to bulk update logged set inputs." };
  }
}

export async function upsertClientLoggedSetEntriesAction(args: {
  clientId: string;
  cycleNumber: number;
  weekKey: string;
  lift: Lift;
  setEntries: LoggedSetMap;
}) {
  "use server";
  try {
    const { getClients, updateClient } = await import("@/lib/data");
    const targetClient = (await getClients()).find((client) => client.id === args.clientId);
    if (!targetClient) {
      return { success: false, message: "Client not found." };
    }

    const existing = targetClient.loggedSetInputsByCycle || {};
    const cycleData = existing[args.cycleNumber] || {};
    const weekData = cycleData[args.weekKey] || {};
    const liftData = weekData[args.lift] || {};

    const merged: LoggedSetInputsByCycle = {
      ...existing,
      [args.cycleNumber]: {
        ...cycleData,
        [args.weekKey]: {
          ...weekData,
          [args.lift]: {
            ...liftData,
            ...args.setEntries,
          },
        },
      },
    };

    await updateClient(args.clientId, {
      loggedSetInputsByCycle: merged as any,
    } as any);

    revalidatePath("/");
    return { success: true, message: "Logged set entries updated.", merged };
  } catch (error) {
    console.error("Error upserting logged set entries:", error);
    return { success: false, message: "Failed to update logged set entries." };
  }
}

export async function updateClientRosterOrderAction(
  updates: Array<{ id: string; rosterOrder: number }>
) {
  "use server";
  try {
    const { updateClient } = await import("@/lib/data");
    for (const update of updates) {
      await updateClient(update.id, { rosterOrder: update.rosterOrder } as any);
    }
    revalidatePath("/");
    return { success: true, message: "Roster order updated." };
  } catch (error) {
    console.error("Error updating roster order:", error);
    return { success: false, message: "Failed to update roster order." };
  }
}
