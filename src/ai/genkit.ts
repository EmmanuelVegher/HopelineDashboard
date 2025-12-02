
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This file provides a client-safe AI configuration for use in Next.js components.
// The main server-side configuration is located in src/firebase/functions/src/genkit.ts.

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
  enableTracingAndMetrics: true,
});
