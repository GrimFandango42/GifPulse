import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai'; // Community plugin for OpenAI
import { anthropic } from 'genkitx-anthropic'; // Community plugin for Anthropic

/**
 * @file Genkit configuration for the AI GIF Generator server.
 * This file initializes and configures the Genkit instance with necessary plugins
 * for various AI providers. API keys are expected to be provided via environment variables.
 */

export default genkit({
  /**
   * An array of Genkit plugins to enable specific AI providers and functionalities.
   */
  plugins: [
    /**
     * Google AI plugin configuration.
     * Enables access to Google's AI models like Gemini and Imagen.
     * Requires the GEMINI_API_KEY environment variable to be set.
     */
    googleAI({
      apiKey: process.env.GEMINI_API_KEY, 
      // Models like 'gemini-1.5-flash' or 'imagen-2' are typically specified
      // at the point of use within Genkit flows (e.g., googleAI.generateImage({ model: imagen2, ... })).
      // They are not required to be pre-declared here unless setting up global defaults or aliases.
    }),
    /**
     * OpenAI plugin configuration (using the community 'genkitx-openai' plugin).
     * Enables access to OpenAI's models like DALL-E and GPT.
     * Requires the OPENAI_API_KEY environment variable to be set.
     */
    openAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    /**
     * Anthropic plugin configuration (using the community 'genkitx-anthropic' plugin).
     * Enables access to Anthropic's Claude models.
     * Requires the ANTHROPIC_API_KEY environment variable to be set.
     */
    anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
  ],
  /**
   * Optional: Configure where Genkit flow state is stored.
   * Example: use 'firebase' if you have the Firebase plugin configured.
   * Defaults to local file system if not specified.
   */
  // flowStateStore: 'firebase', 

  /**
   * Optional: Configure where Genkit traces (logs of flow runs) are stored.
   * Example: use 'firebase' if you have the Firebase plugin configured.
   * Defaults to local file system if not specified.
   */
  // traceStore: 'firebase',

  /**
   * Log level for Genkit's internal logging.
   * Options: 'debug', 'info', 'warn', 'error'.
   */
  logLevel: 'info', // Set to 'debug' for more verbose logging during development

  /**
   * Enable or disable Genkit's telemetry collection.
   * Set to false to disable.
   */
  enableTelemetry: true, // Default is true
});
