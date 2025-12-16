
/**
 * @fileOverview Defines the data schemas and types for the translation feature.
 */

import { z } from 'zod';

export const TranslateTextInputSchema = z.object({
  text: z.string().describe('The text to be translated.'),
  targetLanguage: z.string().describe('The target language for translation (e.g., "French", "Igbo", "Hausa").'),
  sourceLanguage: z.string().optional().describe('The source language of the text (defaults to "en" for English).'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

export const TranslateTextOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;
