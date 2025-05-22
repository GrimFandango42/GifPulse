import { genkit } from 'genkit';
import { googleAI, gemini15Flash, imagen2 } from '@genkit-ai/googleai'; // Added imagen2 and gemini15Flash
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';

export default genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY, 
      // Specify models if needed, though often models are specified at call time.
      // However, you can define available models or defaults here.
      // For this task, models will be specified in the flows directly.
    }),
    openAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
  ],
  // flowStateStore: 'firebase', // Example if using Firebase for flow state
  // traceStore: 'firebase', // Example if using Firebase for traces
});
