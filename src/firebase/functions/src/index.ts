
import * as functions from "firebase-functions";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

// Import flows for side effects (registration)
import '@/ai/flows/get-weather-flow';
import '@/ai/flows/send-sos-flow';
import '@/ai/flows/translate-text-flow';

admin.initializeApp();

/**
 * A scheduled function that runs every minute to process approved user requests.
 */
export const processapprovedusers = onSchedule("every 1 minutes", async () => {
  logger.info("Checking for approved users...", {structuredData: true});

  const db = admin.firestore();
  const pendingUsersRef = db.collection("pendingUsers");

  try {
    // Get all user requests that have been approved.
    const snapshot = await pendingUsersRef.where("status", "==", "approved")
        .get();

    if (snapshot.empty) {
      logger.info("No approved users to process.");
      return;
    }

    const promises = snapshot.docs.map(async (doc) => {
      const pendingUser = doc.data();
      const {email, role, language} = pendingUser;

      try {
        // 1. Create the user in Firebase Authentication.
        // The user will need to use the "Forgot Password" flow to set their
        // password for the first time.
        logger.info(`Creating user in Auth for: ${email}`);
        const userRecord = await admin.auth().createUser({
          email: email,
          emailVerified: true, // Assuming admin approval is sufficient.
        });
        const uid = userRecord.uid;
        logger.info(`Successfully created user ${email} with uid ${uid}`);

        // 2. Create the user profile in the 'users' collection in Firestore.
        logger.info(`Creating user profile in Firestore for uid: ${uid}`);
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
        logger.info(`Successfully created Firestore profile for ${email}`);


        // 3. Delete the request from the 'pendingUsers' collection.
        logger.info(`Deleting pending request for ${email}`);
        await doc.ref.delete();
        logger.info(`Successfully processed and deleted request for ${email}`);
      } catch (error) {
        logger.error(
            `Failed to process user ${email} with doc ID ${doc.id}`,
            error
        );
        // Optionally, update the status to "failed" to prevent retries.
        await doc.ref.update({status: "failed", error: (error as Error).message});
      }
    });

    await Promise.all(promises);
    logger.info("Finished processing batch of approved users.");
  } catch (error) {
    logger.error("Error querying for approved users:", error);
  }
});

/**
 * Send push notification when a task is assigned to a driver
 */
export const sendTaskAssignmentNotification = onDocumentUpdated("sosAlerts", async (event: any) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

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
            alertId: event.data?.after.id,
            type: "task_assigned",
            emergencyType: afterData.emergencyType,
            location: JSON.stringify(afterData.location),
          },
          token: userData.fcmToken,
        };

        await admin.messaging().send(message);
        logger.info(`Push notification sent to driver ${driverId} for task assignment`);
      } else {
        logger.warn(`No FCM token found for driver ${driverId}`);
      }
    } catch (error) {
      logger.error(`Error sending push notification to driver ${driverId}:`, error);
    }
  }
});

