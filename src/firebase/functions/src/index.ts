import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Import flows for side effects (registration)
// import '../../ai/flows/get-weather-flow';
// import '../../ai/flows/send-sos-flow';
// import '../../ai/flows/translate-text-flow';

// Import translation function
export { translateNewMessage } from './translate-only';

admin.initializeApp();

/**
 * A scheduled function that runs every minute to process approved user requests.
 */
export const processapprovedusers = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
  console.log("Checking for approved users...");

  const db = admin.firestore();
  const pendingUsersRef = db.collection("pendingUsers");

  try {
    // Get all user requests that have been approved.
    const snapshot = await pendingUsersRef.where("status", "==", "approved")
        .get();

    if (snapshot.empty) {
      console.log("No approved users to process.");
      return;
    }

    const promises = snapshot.docs.map(async (doc) => {
      const pendingUser = doc.data();
      const {email, role, language} = pendingUser;

      try {
        // 1. Create the user in Firebase Authentication.
        // The user will need to use the "Forgot Password" flow to set their
        // password for the first time.
        console.log(`Creating user in Auth for: ${email}`);
        const userRecord = await admin.auth().createUser({
          email: email,
          emailVerified: true, // Assuming admin approval is sufficient.
        });
        const uid = userRecord.uid;
        console.log(`Successfully created user ${email} with uid ${uid}`);

        // 2. Create the user profile in the 'users' collection in Firestore.
        console.log(`Creating user profile in Firestore for uid: ${uid}`);
        const userDocRef = db.collection("users").doc(uid);
        await userDocRef.set({
          uid: uid,
          email: email,
          role: role,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isOnline: false,
          displayName: email.split('@')[0] || 'New Staff',
          firstName: '',
          lastName: '',
          gender: '',
          image: '',
          mobile: 0,
          profileCompleted: 0,
          language: language || 'English', // Default to English if not provided
        });
        console.log(`Successfully created Firestore profile for ${email}`);


        // 3. Delete the request from the 'pendingUsers' collection.
        console.log(`Deleting pending request for ${email}`);
        await doc.ref.delete();
        console.log(`Successfully processed and deleted request for ${email}`);
      } catch (error) {
        console.error(
            `Failed to process user ${email} with doc ID ${doc.id}`,
            error
        );
        // Optionally, update the status to "failed" to prevent retries.
        await doc.ref.update({status: "failed", error: (error as Error).message});
      }
    });

    await Promise.all(promises);
    console.log("Finished processing batch of approved users.");
  } catch (error) {
    console.error("Error querying for approved users:", error);
  }
});

/**
 * Send push notification when a task is assigned to a driver
 */
export const sendTaskAssignmentNotification = functions.firestore.document("sosAlerts/{alertId}").onUpdate(async (change: any, context: any) => {
  const beforeData = change.before.data();
  const afterData = change.after.data();

  // Check if assignedTeam was added (task assignment)
  if (!beforeData?.assignedTeam && afterData?.assignedTeam) {
    const driverId = afterData.assignedTeam.driverId;

    try {
      // Get driver's FCM token
      const userDoc = await admin.firestore().collection("users").doc(driverId).get();
      const userData = userDoc.data();

      if (userData?.fcmToken) {
        const message = {
          notification: {
            title: "🚨 New Emergency Task Assigned",
            body: `Respond to ${afterData.emergencyType} at ${afterData.location.address || 'specified location'}`,
          },
          data: {
            alertId: context.params.alertId,
            type: "task_assigned",
            emergencyType: afterData.emergencyType,
            location: JSON.stringify(afterData.location),
          },
          token: userData.fcmToken,
        };

        await admin.messaging().send(message);
        console.log(`Push notification sent to driver ${driverId} for task assignment`);
      } else {
        console.warn(`No FCM token found for driver ${driverId}`);
      }
    } catch (error) {
      console.error(`Error sending push notification to driver ${driverId}:`, error);
    }
  }
});

/**
 * Callable function for translating text using Google Translate API v2
 */
export const translateText = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { text, targetLanguage } = data;

  if (!text || !targetLanguage) {
    throw new functions.https.HttpsError('invalid-argument', 'Text and targetLanguage are required');
  }

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

  const sourceCode = 'en'; // Assuming source is always English
  const targetCode = LANGUAGE_CODES[targetLanguage] || targetLanguage;

  // If same language, return original text
  if (sourceCode === targetCode) {
    return { translatedText: text };
  }

  const API_KEY = functions.config().googletranslate?.key;
  if (!API_KEY) {
    console.error('GOOGLE_TRANSLATE_API_KEY not configured');
    throw new functions.https.HttpsError('internal', 'Translation service not configured');
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        method: 'POST',
        body: JSON.stringify({
          q: text,
          target: targetCode,
          // omit source to allow auto-detection
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Translate API error:', response.status, errorData);
      throw new functions.https.HttpsError('internal', 'Translation API error');
    }

    const data = await response.json();
    if (data.error) {
      console.error('Google Translate API error:', data.error);
      throw new functions.https.HttpsError('internal', 'Translation failed');
    }

    const translatedText = data.data.translations[0].translatedText;

    return { translatedText };
  } catch (error) {
    console.error('Translation error:', error);
    throw new functions.https.HttpsError('internal', 'Translation failed');
  }
});
