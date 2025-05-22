import { defineFlow, startFlowsServer } from '@genkit-ai/flow';
import { googleAI } from '@genkit-ai/googleai';
import * as z from 'zod';
// Import config to ensure it's initialized
import ai from './genkit.config';


// Define a simple test flow
export const testFlow = defineFlow(
  {
    name: 'testFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (prompt: string) => {
    const llmResponse = await ai.generate({
      model: 'gemini-1.0-pro', // Corrected model name
      prompt,
    });
    return llmResponse.text;
  }
);

// Start the flows server (optional, for exposing flows as API endpoints)
// startFlowsServer();
