import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openai } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';
export default genkit({
    plugins: [
        googleAI({
            apiKey: process.env.GEMINI_API_KEY,
        }),
        openai({
            apiKey: process.env.OPENAI_API_KEY,
        }),
        anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        }),
    ],
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});
