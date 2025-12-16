import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Translate new chat messages using Google Translate API v2
 */
export const translateNewMessage = functions
  .runWith({ secrets: ["GOOGLE_TRANSLATE_API_KEY"] })
  .firestore.document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap: any, context: any) => {
  const messageData = snap.data();
  if (!messageData || !messageData.content) {
    console.log("No message content to translate");
    return;
  }

  const receiverId = messageData.receiverId;
  if (!receiverId) {
    console.warn("No receiver ID found for message translation");
    return;
  }

  try {
    // Get sender's data
    const senderDoc = await admin.firestore().collection("users").doc(messageData.senderId).get();
    const senderData = senderDoc.data();
    const senderRole = senderData?.role || 'user';
    const senderLanguage = senderData?.settings?.language || senderData?.language || 'en';

    // Get receiver's data
    const receiverDoc = await admin.firestore().collection("users").doc(receiverId).get();
    const receiverData = receiverDoc.data();
    const receiverRole = receiverData?.role || 'user';
    const receiverLanguage = receiverData?.settings?.language || receiverData?.language || 'en';

    // Skip if both are English
    if ((senderLanguage === 'en' || senderLanguage === 'English') &&
        (receiverLanguage === 'en' || receiverLanguage === 'English')) {
      console.log("Both sender and receiver are English, no translation needed");
      return;
    }

    // Skip if sender is receiver
    if (messageData.senderId === receiverId) {
      console.log("Message is from receiver to themselves, skipping translation");
      return;
    }

    const updateData: any = {
      translationTimestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    // Determine which field to use for user and agent translations
    const isSenderAgent = senderRole === 'support agent';
    const isReceiverAgent = receiverRole === 'support agent';

    // Translate for sender if needed
    if (senderLanguage !== 'en' && senderLanguage !== 'English') {
      const senderTranslatedText = await callGoogleTranslate(messageData.content, senderLanguage);
      if (senderTranslatedText && senderTranslatedText !== messageData.content) {
        if (isSenderAgent) {
          updateData.agentTranslatedText = senderTranslatedText;
        } else {
          updateData.userTranslatedText = senderTranslatedText;
        }
        console.log(`Message translated to ${senderLanguage} for sender`);
      }
    }

    // Translate for receiver if needed
    if (receiverLanguage !== 'en' && receiverLanguage !== 'English') {
      const receiverTranslatedText = await callGoogleTranslate(messageData.content, receiverLanguage);
      if (receiverTranslatedText && receiverTranslatedText !== messageData.content) {
        if (isReceiverAgent) {
          updateData.agentTranslatedText = receiverTranslatedText;
        } else {
          updateData.userTranslatedText = receiverTranslatedText;
        }
        console.log(`Message translated to ${receiverLanguage} for receiver`);
      }
    }

    // Update the message with translated texts
    if (Object.keys(updateData).length > 1) { // More than just timestamp
      await snap.ref.update(updateData);
      console.log(`Message translations updated for chat`);
    }

  } catch (error) {
    console.error(`Error translating message:`, error);
  }
});

// Language code mappings (full name to ISO)
const LANGUAGE_CODES: Record<string, string> = {
  'English': 'en',
  'Yoruba': 'yo',
  'Hausa': 'ha',
  'Igbo': 'ig',
  'Tiv': 'tiv',
  'Kanuri': 'kr',
  'en': 'en',
  'yo': 'yo',
  'ha': 'ha',
  'ig': 'ig',
  'tiv': 'tiv',
  'kr': 'kr',
};

async function callGoogleTranslate(text: string, targetLang: string): Promise<string> {
  const targetCode = LANGUAGE_CODES[targetLang] || targetLang;

  // If same language, return original text
  if (targetCode === 'en') {
    return text;
  }

  const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!API_KEY) {
    console.error('GOOGLE_TRANSLATE_API_KEY not configured');
    return text;
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: targetCode,
          // omit source to allow auto-detection
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Translate API error:', response.status, errorData);
      return text;
    }

    const data = await response.json();
    if (data.error) {
      console.error('Google Translate API error:', data.error);
      return text;
    }

    const translatedText = data.data.translations[0].translatedText;

    return translatedText;
  } catch (error) {
    console.error('Google Translate API error:', error);
    return text;
  }
}