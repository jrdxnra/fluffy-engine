"use server";

import {
  getAiPoweredProgressInsights,
  type AiPoweredProgressInsightsInput,
} from "@/ai/flows/ai-powered-progress-insights-flow";

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
