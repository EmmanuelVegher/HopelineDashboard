/**
 * @fileOverview An AI flow for translating text using Hugging Face models.
 *
 * - translateText - A function that handles translating text to a target language using Hugging Face API.
 */

import { TranslateTextInputSchema, TranslateTextOutputSchema, type TranslateTextInput } from '@/ai/schemas/translation';

// Language code mappings for Hugging Face models
const LANGUAGE_MODELS: Record<string, string> = {
  // English to Nigerian languages
  'en-yo': 'Helsinki-NLP/opus-mt-en-yo', // English to Yoruba
  'en-ha': 'Helsinki-NLP/opus-mt-en-ha', // English to Hausa
  'en-ig': 'Helsinki-NLP/opus-mt-en-ig', // English to Igbo

  // Nigerian languages to English
  'yo-en': 'Helsinki-NLP/opus-mt-yo-en', // Yoruba to English
  'ha-en': 'Helsinki-NLP/opus-mt-ha-en', // Hausa to English
  'ig-en': 'Helsinki-NLP/opus-mt-ig-en', // Igbo to English

  // Cross-language translations (if needed)
  'yo-ha': 'Helsinki-NLP/opus-mt-yo-ha', // Yoruba to Hausa
  'ha-yo': 'Helsinki-NLP/opus-mt-ha-yo', // Hausa to Yoruba
  'ig-yo': 'Helsinki-NLP/opus-mt-ig-yo', // Igbo to Yoruba
  'yo-ig': 'Helsinki-NLP/opus-mt-yo-ig', // Yoruba to Igbo
  'ha-ig': 'Helsinki-NLP/opus-mt-ha-ig', // Hausa to Igbo
  'ig-ha': 'Helsinki-NLP/opus-mt-ig-ha', // Igbo to Hausa
};

// Language code mappings (full name to ISO)
const LANGUAGE_CODES: Record<string, string> = {
  'English': 'en',
  'Yoruba': 'yo',
  'Hausa': 'ha',
  'Igbo': 'ig',
  'en': 'en',
  'yo': 'yo',
  'ha': 'ha',
  'ig': 'ig',
};

async function callHuggingFaceTranslate(text: string, model: string): Promise<string> {
  const HF_API_URL = `https://api-inference.huggingface.co/models/${model}`;
  const HF_API_KEY = process.env.HF_API_KEY;

  if (!HF_API_KEY) {
    console.error('HF_API_KEY not configured');
    throw new Error('Translation service not configured');
  }

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          max_length: 512,
          num_beams: 4,
          early_stopping: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();

    // Handle different response formats
    if (Array.isArray(data) && data.length > 0) {
      return data[0].translation_text || data[0].generated_text || '';
    }

    if (data.translation_text) {
      return data.translation_text;
    }

    if (data.generated_text) {
      return data.generated_text;
    }

    console.error('Unexpected API response format:', data);
    return text; // Fallback to original text
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

function getModelForLanguages(sourceLang: string, targetLang: string): string | null {
  const sourceCode = LANGUAGE_CODES[sourceLang] || sourceLang;
  const targetCode = LANGUAGE_CODES[targetLang] || targetLang;
  const key = `${sourceCode}-${targetCode}`;

  return LANGUAGE_MODELS[key] || null;
}

export async function translateText(input: TranslateTextInput): Promise<{ translatedText: string }> {
  if (!input.text || !input.targetLanguage) {
    return { translatedText: input.text };
  }

  // If source and target are the same, return original text
  const sourceCode = LANGUAGE_CODES[input.sourceLanguage || 'en'] || input.sourceLanguage || 'en';
  const targetCode = LANGUAGE_CODES[input.targetLanguage] || input.targetLanguage;

  if (sourceCode === targetCode) {
    return { translatedText: input.text };
  }

  // Get the appropriate model
  const model = getModelForLanguages(input.sourceLanguage || 'en', input.targetLanguage);

  if (!model) {
    console.warn(`No translation model found for ${input.sourceLanguage || 'en'} -> ${input.targetLanguage}`);
    // Fallback: try English as intermediate if direct translation not available
    let translatedText = input.text;

    if (sourceCode !== 'en') {
      // Try source -> English first
      const toEnglishModel = getModelForLanguages(input.sourceLanguage || 'en', 'English');
      if (toEnglishModel) {
        try {
          translatedText = await callHuggingFaceTranslate(input.text, toEnglishModel);
        } catch (error) {
          console.error('Source to English translation failed:', error);
        }
      }
    }

    if (targetCode !== 'en' && translatedText !== input.text) {
      // Then English -> target
      const fromEnglishModel = getModelForLanguages('English', input.targetLanguage);
      if (fromEnglishModel) {
        try {
          translatedText = await callHuggingFaceTranslate(translatedText, fromEnglishModel);
        } catch (error) {
          console.error('English to target translation failed:', error);
        }
      }
    }

    return { translatedText };
  }

  // Direct translation
  const translatedText = await callHuggingFaceTranslate(input.text, model);
  return { translatedText };
}
