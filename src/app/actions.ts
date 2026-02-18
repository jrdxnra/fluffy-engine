"use server";

import { revalidatePath } from "next/cache";
import {
  getAiPoweredProgressInsights,
  type AiPoweredProgressInsightsInput,
} from "@/ai/flows/ai-powered-progress-insights-flow";
import { addClient as dbAddClient, addHistoricalRecord as dbAddHistoricalRecord, graduateTeam as dbGraduateTeam } from "@/lib/data";
import { Client, HistoricalRecord, Lift } from "@/lib/types";
import { calculate1RM } from "@/lib/utils";


export async function getAiInsightsAction(
  input: AiPoweredProgressInsightsInput
) {
  try {
    const insights = await getAiPoweredProgressInsights(input);
    return { success: true, data: insights };
  } catch (error) {
    console.error("Error getting AI insights:", error);
    return { success: false, error: "Failed to generate AI insights." };
  }
}

export async function addClientAction(clientData: Omit<Client, 'id'>) {
  console.log("Server Action: Adding client", clientData);
  dbAddClient(clientData);
  revalidatePath("/");
  return { success: true, message: "Client added successfully." };
}

export async function logRepRecordAction(
  clientId: string,
  lift: Lift,
  weight: number,
  reps: number
) {
  const record: Omit<HistoricalRecord, 'estimated1RM'> & { estimated1RM?: number } = {
    clientId,
    date: new Date().toISOString(),
    lift,
    weight,
    reps,
  };
  record.estimated1RM = calculate1RM(weight, reps);
  
  console.log("Server Action: Logging rep record", record);
  dbAddHistoricalRecord(record as HistoricalRecord);
  revalidatePath("/"); // Revalidate to update PR targets etc.
  return { success: true, message: "Workout logged.", record: record as HistoricalRecord };
}


export async function graduateTeamAction() {
    console.log("Server Action: Graduating team");
    dbGraduateTeam();
    revalidatePath("/");
    return { success: true, message: "Team graduated successfully!" };
}
