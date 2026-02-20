
'use server';
/**
 * @fileOverview A flow for handling and saving SOS emergency alerts.
 *
 * - sendSos - Saves an SOS alert to the database.
 */

import { ai } from '@/ai/genkit';
import { SendSosInputSchema, type SendSosInput, isDisplacementEmergency } from '@/ai/schemas/sos';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { z } from 'zod';


export async function sendSos(input: SendSosInput): Promise<{ success: boolean; alertId: string }> {
    return sendSosFlow(input);
}

const sendSosFlow = ai.defineFlow(
    {
        name: 'sendSosFlow',
        inputSchema: SendSosInputSchema,
        outputSchema: z.object({ success: z.boolean(), alertId: z.string() }),
    },
    async (input) => {
        try {
            const sosAlertsRef = collection(db, 'sosAlerts');
            const docRef = await addDoc(sosAlertsRef, {
                ...input,
                status: 'Active', // Set initial status
                timestamp: serverTimestamp(),
                readByAdmin: false,
                readBySuperAdmin: false
            });

            console.log("SOS Alert saved with ID: ", docRef.id);

            // Check if this is a displacement-related emergency
            if (isDisplacementEmergency(input.emergencyType)) {
                console.log("Displacement emergency detected, checking for existing displaced person record");

                // Fetch user data if userId is provided
                let userData = null;
                if (input.userId) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', input.userId));
                        if (userDoc.exists()) {
                            userData = userDoc.data();
                            console.log("User data fetched:", userData);
                        } else {
                            console.log("User document does not exist for userId:", input.userId);
                        }
                    } catch (userError) {
                        console.warn("Could not fetch user data:", userError);
                    }
                } else {
                    console.log("No userId provided, userData remains null");
                }

                // Check for existing displaced person record to prevent duplicates
                const displacedPersonsRef = collection(db, 'displacedPersons');
                let existingQuery = null;
                if (input.userId) {
                    existingQuery = query(displacedPersonsRef, where('userId', '==', input.userId));
                    console.log("Querying displacedPersons by userId:", input.userId);
                } else {
                    console.log("No userId provided, skipping duplicate check for anonymous user");
                }

                let existingDocs = null;
                if (existingQuery) {
                    existingDocs = await getDocs(existingQuery);
                    console.log("Existing docs found:", existingDocs.size);
                }

                if (existingDocs && !existingDocs.empty) {
                    console.log("Duplicate displaced person record found, skipping creation");
                } else if (input.userId) {
                    // Create displaced person record
                    const name = userData?.displayName || (userData?.firstName && userData?.lastName)
                        ? `${userData.firstName} ${userData.lastName}`
                        : input.userEmail || 'Unknown Person';
                    const details = userData?.email || input.userEmail || '';
                    console.log("Constructed name:", name, "details:", details);

                    const displacedPersonData = {
                        name,
                        details,
                        userId: input.userId,
                        status: 'Emergency',
                        currentLocation: input.location.address || `${input.location.latitude}, ${input.location.longitude}`,
                        destination: '',
                        vulnerabilities: [],
                        medicalNeeds: [],
                        assistanceRequested: input.additionalInfo || `Displacement emergency: ${input.emergencyType}`,
                        priority: 'High Priority',
                        lastUpdate: new Date().toLocaleString(),
                    };

                    await addDoc(displacedPersonsRef, displacedPersonData);
                    console.log("Displaced person record created");
                }

                // Update SOS alert to mark as displacement-related
                await updateDoc(docRef, {
                    isDisplacementRelated: true
                });
            }

            return { success: true, alertId: docRef.id };

        } catch (error) {
            console.error("Error in sendSosFlow: ", error);
            // In a real app, you might have more sophisticated error handling,
            // like sending a notification to an admin channel.
            return { success: false, alertId: '' };
        }
    }
);
