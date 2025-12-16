import { NextRequest, NextResponse } from 'next/server';
import { Translate } from '@google-cloud/translate/build/src/v2';

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

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: 'Missing text or targetLanguage' }, { status: 400 });
    }

    const sourceCode = 'en'; // Assuming source is always English
    const targetCode = LANGUAGE_CODES[targetLanguage] || targetLanguage;

    // If same language, return original text
    if (sourceCode === targetCode) {
      return NextResponse.json({ translatedText: text });
    }

    const translate = new Translate();

    const [translations] = await translate.translate(text, {
      from: sourceCode,
      to: targetCode,
    });

    const translatedText = Array.isArray(translations) ? translations[0] : translations;

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}