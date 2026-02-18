'use server';
/**
 * @fileOverview An AI agent that provides personalized insights and strategic tips
 * based on a client's historical workout performance and current cycle parameters.
 *
 * - getAiPoweredProgressInsights - A function that handles the AI-powered progress insights process.
 * - AiPoweredProgressInsightsInput - The input type for the getAiPoweredProgressInsights function.
 * - AiPoweredProgressInsightsOutput - The return type for the getAiPoweredProgressInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClientWorkoutRecordSchema = z.object({
  date: z.string().describe('The date of the workout record (ISO string).'),
  lift: z
    .enum(['Bench', 'Squat', 'Deadlift', 'Press'])
    .describe('The specific lift performed.'),
  weight: z.number().describe('The weight lifted in pounds.'),
  reps: z.number().describe('The number of repetitions performed.'),
  estimated1RM: z
    .number()
    .describe('The estimated 1-Rep Max for that workout.'),
});

const AiPoweredProgressInsightsInputSchema = z.object({
  clientId: z.string().describe('The unique identifier for the client.'),
  liftType: z
    .enum(['Bench', 'Squat', 'Deadlift', 'Press'])
    .describe('The specific lift for which insights are requested.'),
  currentCycleParameters: z
    .object({
      currentWeek: z.string().describe('The current week of the workout cycle (e.g., "Week 1").'),
      globalPercentages: z
        .record(z.number())
        .describe('An object mapping set names to global percentage targets.'),
      repTargets: z
        .record(z.number())
        .describe('An object mapping set names to repetition targets.'),
    })
    .describe('Parameters defining the current workout cycle.'),
  clientTrainingMaxes: z
    .object({
      bench: z.number().describe('Client\'s current training max for Bench Press.'),
      squat: z.number().describe('Client\'s current training max for Squat.'),
      deadlift: z.number().describe('Client\'s current training max for Deadlift.'),
      press: z.number().describe('Client\'s current training max for Overhead Press.'),
    })
    .describe('Client\'s current 90% Training Maxes for various lifts.'),
  clientHistoricalPerformance: z
    .array(ClientWorkoutRecordSchema)
    .describe('An array of historical workout records for the client.'),
});
export type AiPoweredProgressInsightsInput = z.infer<
  typeof AiPoweredProgressInsightsInputSchema
>;

const AiPoweredProgressInsightsOutputSchema = z.object({
  insights: z.string().describe('Personalized insights about the client\'s progress.'),
  strategicTips: z.string().describe('Strategic tips to enhance training and guide future cycle planning.'),
});
export type AiPoweredProgressInsightsOutput = z.infer<
  typeof AiPoweredProgressInsightsOutputSchema
>;

export async function getAiPoweredProgressInsights(
  input: AiPoweredProgressInsightsInput
): Promise<AiPoweredProgressInsightsOutput> {
  return aiPoweredProgressInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiPoweredProgressInsightsPrompt',
  input: {schema: AiPoweredProgressInsightsInputSchema},
  output: {schema: AiPoweredProgressInsightsOutputSchema},
  prompt: `You are an expert strength and conditioning coach and data analyst specializing in powerlifting and strength training, particularly the 5/3/1 method.\n\nYour task is to analyze a client's workout data and provide personalized insights and strategic tips to optimize their training and inform future cycle adjustments. Focus on the {{liftType}} lift.\n\nClient ID: {{{clientId}}}\n\n-- Current Cycle Parameters --\nCurrent Week: {{{currentCycleParameters.currentWeek}}}\nGlobal Percentages: {{json currentCycleParameters.globalPercentages}}\nRep Targets: {{json currentCycleParameters.repTargets}}\n\n-- Client's Current Training Maxes (90% of 1RM) --\nBench: {{{clientTrainingMaxes.bench}}} lbs\nSquat: {{{clientTrainingMaxes.squat}}} lbs\nDeadlift: {{{clientTrainingMaxes.deadlift}}} lbs\nPress: {{{clientTrainingMaxes.press}}} lbs\n\n-- Client's Historical Performance for {{liftType}} (most recent first) --\n{{#each clientHistoricalPerformance}}\n  Date: {{{date}}}, Lift: {{{lift}}}, Weight: {{{weight}}} lbs, Reps: {{{reps}}}, Estimated 1RM: {{{estimated1RM}}} lbs\n{{/each}}\n\nBased on the provided data, generate the following:\n1.  **Personalized Insights**: Analyze trends, identify strengths, weaknesses, consistency, and adherence to the program for the {{liftType}} lift. Comment on the client's progress over time.\n2.  **Strategic Tips**: Provide actionable recommendations to enhance training for the {{liftType}} lift. This could include suggestions for future cycle adjustments, recovery, technique focus, or accessory work tailored to their performance.\n\nEnsure your output is structured as JSON with 'insights' and 'strategicTips' fields.`,
});

const aiPoweredProgressInsightsFlow = ai.defineFlow(
  {
    name: 'aiPoweredProgressInsightsFlow',
    inputSchema: AiPoweredProgressInsightsInputSchema,
    outputSchema: AiPoweredProgressInsightsOutputSchema,
  },
  async input => {
    // Filter historical performance to only include the requested lift type and sort by date descending
    const filteredPerformance = input.clientHistoricalPerformance
      .filter(record => record.lift === input.liftType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const {output} = await prompt({
      ...input,
      clientHistoricalPerformance: filteredPerformance,
    });
    return output!;
  }
);
