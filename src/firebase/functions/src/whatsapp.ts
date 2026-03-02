import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// ─── WhatsApp Configuration ────────────────────────────────────────────────────
// Set these in Firebase Functions config:
// firebase functions:config:set whatsapp.token="YOUR_META_ACCESS_TOKEN"
// firebase functions:config:set whatsapp.phone_id="YOUR_PHONE_NUMBER_ID"
// firebase functions:config:set whatsapp.verify_token="YOUR_WEBHOOK_VERIFY_TOKEN"

const WHATSAPP_SUPPORT_NUMBER = "447397136870"; // +44 7397 136870

// ── Option 2: WhatsApp Business API ──────────────────────────────────────────
/**
 * Sends a WhatsApp message to a user via the Meta Cloud API.
 * Called from an admin/agent action or automated notification.
 *
 * Usage: call from admin dashboard to notify beneficiaries via WhatsApp.
 * Input: { to: "234XXXXXXXXXX", message: "Hello from Hopeline" }
 */
export const sendWhatsAppMessage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { to, message, templateName, templateLanguage, templateParams } = data;

    if (!to || (!message && !templateName)) {
        throw new functions.https.HttpsError("invalid-argument", "Recipient number and message are required");
    }

    const ACCESS_TOKEN = functions.config().whatsapp?.token;
    const PHONE_NUMBER_ID = functions.config().whatsapp?.phone_id;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
        console.error("WhatsApp Business API not configured. Set whatsapp.token and whatsapp.phone_id");
        throw new functions.https.HttpsError("internal", "WhatsApp API not configured");
    }

    // Clean phone number — remove all non-digit chars
    const cleanTo = String(to).replace(/\D/g, "");

    let body: any;

    if (templateName) {
        // Send a pre-approved template message
        body = {
            messaging_product: "whatsapp",
            to: cleanTo,
            type: "template",
            template: {
                name: templateName,
                language: { code: templateLanguage || "en_GB" },
                components: templateParams ? [
                    {
                        type: "body",
                        parameters: templateParams.map((p: string) => ({ type: "text", text: p }))
                    }
                ] : []
            }
        };
    } else {
        // Send a free-form text message
        body = {
            messaging_product: "whatsapp",
            to: cleanTo,
            type: "text",
            text: { body: message, preview_url: false }
        };
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        const result = await response.json() as any;

        if (!response.ok) {
            console.error("WhatsApp API error:", result);
            throw new functions.https.HttpsError("internal", result?.error?.message || "WhatsApp API error");
        }

        console.log(`WhatsApp message sent to ${cleanTo}: ${result.messages?.[0]?.id}`);

        // Log to Firestore for audit trail
        const db = admin.firestore();
        await db.collection("whatsappMessages").add({
            to: cleanTo,
            message: message || `[template: ${templateName}]`,
            messageId: result.messages?.[0]?.id || null,
            sentBy: context.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "sent"
        });

        return { success: true, messageId: result.messages?.[0]?.id };

    } catch (error: any) {
        console.error("Error sending WhatsApp message:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to send WhatsApp message");
    }
});

/**
 * Callable function: Send WhatsApp notification when an SOS alert is assigned.
 * Triggered from admin dashboard when assigning a response team.
 */
export const notifyBeneficiaryViaWhatsApp = functions.firestore
    .document("displacedPersons/{personId}")
    .onUpdate(async (change) => {
        const before = change.before.data();
        const after = change.after.data();

        // Only trigger when shelter assignment changes
        if (before.assignedShelterId === after.assignedShelterId) return null;

        if (!after.phone || !after.assignedShelterId) return null;

        const ACCESS_TOKEN = functions.config().whatsapp?.token;
        const PHONE_NUMBER_ID = functions.config().whatsapp?.phone_id;

        if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
            console.warn("WhatsApp not configured, skipping shelter assignment notification");
            return null;
        }

        try {
            // Fetch shelter details
            const db = admin.firestore();
            const shelterDoc = await db.collection("shelters").doc(after.assignedShelterId).get();
            const shelter = shelterDoc.data();

            const cleanPhone = String(after.phone).replace(/\D/g, "");
            const message = `🏠 *Hopeline Update*\n\nDear ${after.name || "Beneficiary"},\n\nYou have been assigned to *${shelter?.name || "a shelter"}*.\n\nLocation: ${shelter?.location || shelter?.state || "See details in the app"}\nContact: ${shelter?.phone || "See in app"}\n\nStay safe. Reply to this message or open the Hopeline app for more details.`;

            await fetch(
                `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${ACCESS_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: cleanPhone,
                        type: "text",
                        text: { body: message }
                    })
                }
            );

            console.log(`Shelter assignment WhatsApp notification sent to: ${cleanPhone}`);
        } catch (err) {
            console.error("Error sending shelter assignment WhatsApp:", err);
        }

        return null;
    });

// ── Option 3: WhatsApp Webhook Integration ────────────────────────────────────
/**
 * Webhook verification endpoint (GET).
 * Meta will call this to verify your webhook during setup.
 * URL will be: https://[region]-[project].cloudfunctions.net/whatsappWebhook
 */
export const whatsappWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method === "GET") {
        // Webhook Verification
        const VERIFY_TOKEN = functions.config().whatsapp?.verify_token || "hopeline_verify_token";
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WhatsApp webhook verified");
            res.status(200).send(challenge);
        } else {
            res.status(403).send("Forbidden");
        }
        return;
    }

    if (req.method === "POST") {
        // Incoming message handler
        const body = req.body;

        if (body?.object !== "whatsapp_business_account") {
            res.status(404).send("Not Found");
            return;
        }

        try {
            const db = admin.firestore();
            const ACCESS_TOKEN = functions.config().whatsapp?.token;
            const PHONE_NUMBER_ID = functions.config().whatsapp?.phone_id;

            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    const value = change.value;

                    // Process incoming messages
                    for (const message of value.messages || []) {
                        const from = message.from; // Sender's WhatsApp number
                        const msgId = message.id;
                        const timestamp = new Date(parseInt(message.timestamp) * 1000);

                        // Extract text content
                        let content = "";
                        if (message.type === "text") {
                            content = message.text?.body || "";
                        } else if (message.type === "image") {
                            content = "[Image received]";
                        } else if (message.type === "audio") {
                            content = "[Voice message received]";
                        } else if (message.type === "document") {
                            content = `[Document: ${message.document?.filename || "file"}]`;
                        } else {
                            content = `[${message.type} message]`;
                        }

                        // Get or create a "WhatsApp chat" document in Firestore
                        const whatsappChatId = `wa_${from}`;
                        const chatRef = db.collection("whatsappChats").doc(whatsappChatId);

                        // Get sender's contact name (from contacts array) 
                        const contact = value.contacts?.find((c: any) => c.wa_id === from);
                        const senderName = contact?.profile?.name || `+${from}`;

                        // Upsert chat document
                        await chatRef.set({
                            whatsappNumber: from,
                            senderName,
                            status: "open",
                            lastMessage: content,
                            lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                            unreadCount: admin.firestore.FieldValue.increment(1),
                            source: "whatsapp",
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        // Add message to subcollection
                        await chatRef.collection("messages").add({
                            from,
                            senderName,
                            content,
                            messageId: msgId,
                            type: message.type,
                            timestamp,
                            direction: "inbound",
                            status: "received",
                            rawMessage: message
                        });

                        console.log(`WhatsApp message from ${from} (${senderName}): ${content}`);

                        // Auto-reply to acknowledge receipt
                        if (ACCESS_TOKEN && PHONE_NUMBER_ID && content && !content.startsWith("[")) {
                            const autoReply = `👋 Hi ${senderName}! Your message has been received by Hopeline Support.\n\nA support agent will respond shortly. You can also reach us in the app.\n\n*Hopeline Emergency Support*`;

                            await fetch(
                                `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
                                {
                                    method: "POST",
                                    headers: {
                                        Authorization: `Bearer ${ACCESS_TOKEN}`,
                                        "Content-Type": "application/json"
                                    },
                                    body: JSON.stringify({
                                        messaging_product: "whatsapp",
                                        to: from,
                                        type: "text",
                                        text: { body: autoReply }
                                    })
                                }
                            );
                        }
                    }

                    // Handle message status updates (delivered, read, failed)
                    for (const status of value.statuses || []) {
                        const db = admin.firestore();
                        const msgId = status.id;
                        const newStatus = status.status; // sent, delivered, read, failed

                        // Update message status in Firestore
                        const msgQuery = await db.collectionGroup("messages")
                            .where("messageId", "==", msgId)
                            .limit(1)
                            .get();

                        if (!msgQuery.empty) {
                            await msgQuery.docs[0].ref.update({ status: newStatus });
                        }
                    }
                }
            }

            res.status(200).send("OK");
        } catch (error) {
            console.error("WhatsApp webhook error:", error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.status(405).send("Method Not Allowed");
    }
});

/**
 * Callable: Agent replies to a WhatsApp conversation from the dashboard.
 * Input: { whatsappChatId: "wa_2348XXXXXXXXX", message: "..." }
 */
export const replyToWhatsApp = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const { whatsappChatId, message } = data;
    if (!whatsappChatId || !message) {
        throw new functions.https.HttpsError("invalid-argument", "whatsappChatId and message are required");
    }

    const ACCESS_TOKEN = functions.config().whatsapp?.token;
    const PHONE_NUMBER_ID = functions.config().whatsapp?.phone_id;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
        throw new functions.https.HttpsError("internal", "WhatsApp API not configured");
    }

    // Extract phone number from chat ID (wa_PHONENUMBER)
    const to = whatsappChatId.replace("wa_", "");

    try {
        const response = await fetch(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to,
                    type: "text",
                    text: { body: message }
                })
            }
        );

        const result = await response.json() as any;
        if (!response.ok) {
            throw new functions.https.HttpsError("internal", result?.error?.message || "WhatsApp API error");
        }

        // Save outbound message to Firestore
        const db = admin.firestore();
        const chatRef = db.collection("whatsappChats").doc(whatsappChatId);

        await chatRef.collection("messages").add({
            from: PHONE_NUMBER_ID,
            senderName: "Hopeline Support",
            content: message,
            messageId: result.messages?.[0]?.id || null,
            type: "text",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            direction: "outbound",
            status: "sent",
            repliedBy: context.auth.uid
        });

        await chatRef.update({
            lastMessage: message,
            lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            unreadCount: 0
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error replying on WhatsApp:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to send reply");
    }
});

export { WHATSAPP_SUPPORT_NUMBER };
