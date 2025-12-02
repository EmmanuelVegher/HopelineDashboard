
'use server';
/**
 * @fileOverview An AI flow for translating text.
 *
 * - translateText - A function that handles translating text to a target language.
 */

import { ai } from '@/ai/genkit';
import { TranslateTextInputSchema, TranslateTextOutputSchema, type TranslateTextInput } from '@/ai/schemas/translation';
import { z } from 'zod';

export async function translateText(input: TranslateTextInput): Promise<string> {
  const result = await translateTextFlow(input);
  return result.translatedText;
}

const translatePrompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: { schema: TranslateTextInputSchema },
  output: { schema: TranslateTextOutputSchema },
  prompt: `Translate the following text to {{targetLanguage}}.
  
  Text: {{{text}}}
  
  Return only the translated text.`,
});


const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    
    if (!input.text || !input.targetLanguage) {
        return { translatedText: input.text };
    }

    const llmResponse = await translatePrompt(input);
    return llmResponse.output ?? { translatedText: input.text };
  }
);
