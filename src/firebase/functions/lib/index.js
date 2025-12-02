"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTaskAssignmentNotification = exports.processapprovedusers = void 0;
const logger = require("firebase-functions/logger");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
// Import flows for side effects (registration)
require("@/ai/flows/get-weather-flow");
require("@/ai/flows/send-sos-flow");
require("@/ai/flows/translate-text-flow");
admin.initializeApp();
/**
 * A scheduled function that runs every minute to process approved user requests.
 */
exports.processapprovedusers = (0, scheduler_1.onSchedule)("every 1 minutes", async () => {
    logger.info("Checking for approved users...", { structuredData: true });
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
            const { email, role, language } = pendingUser;
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
            }
            catch (error) {
                logger.error(`Failed to process user ${email} with doc ID ${doc.id}`, error);
                // Optionally, update the status to "failed" to prevent retries.
                await doc.ref.update({ status: "failed", error: error.message });
            }
        });
        await Promise.all(promises);
        logger.info("Finished processing batch of approved users.");
    }
    catch (error) {
        logger.error("Error querying for approved users:", error);
    }
});
/**
 * Send push notification when a task is assigned to a driver
 */
exports.sendTaskAssignmentNotification = (0, firestore_1.onDocumentUpdated)("sosAlerts", async (event) => {
    var _a, _b, _c;
    const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    // Check if assignedTeam was added (task assignment)
    if (!(beforeData === null || beforeData === void 0 ? void 0 : beforeData.assignedTeam) && (afterData === null || afterData === void 0 ? void 0 : afterData.assignedTeam)) {
        const driverId = afterData.assignedTeam.driverId;
        try {
            // Get driver's FCM token
            const userDoc = await admin.firestore().collection("users").doc(driverId).get();
            const userData = userDoc.data();
            if (userData === null || userData === void 0 ? void 0 : userData.fcmToken) {
                const message = {
                    notification: {
                        title: "🚨 New Emergency Task Assigned",
                        body: `Respond to ${afterData.emergencyType} at ${afterData.location.address || 'specified location'}`,
                    },
                    data: {
                        alertId: (_c = event.data) === null || _c === void 0 ? void 0 : _c.after.id,
                        type: "task_assigned",
                        emergencyType: afterData.emergencyType,
                        location: JSON.stringify(afterData.location),
                    },
                    token: userData.fcmToken,
                };
                await admin.messaging().send(message);
                logger.info(`Push notification sent to driver ${driverId} for task assignment`);
            }
            else {
                logger.warn(`No FCM token found for driver ${driverId}`);
            }
        }
        catch (error) {
            logger.error(`Error sending push notification to driver ${driverId}:`, error);
        }
    }
});
//# sourceMappingURL=index.js.map