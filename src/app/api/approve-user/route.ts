
import { type NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
// This self-invoking function ensures that the SDK is initialized only once.
try {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("FIREBASE_PRIVATE_KEY is not set in environment variables.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (error: any) {
  console.error("Firebase Admin SDK initialization error:", error.message);
}


export async function POST(req: NextRequest) {
  if (admin.apps.length === 0) {
    return NextResponse.json(
      { success: false, error: "Firebase Admin SDK not initialized. Check server logs for details." },
      { status: 500 }
    );
  }

  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return NextResponse.json({ success: false, error: "Request ID is missing" }, { status: 400 });
    }

    const db = admin.firestore();
    const pendingUserDocRef = db.collection("pendingUsers").doc(requestId);
    
    await pendingUserDocRef.update({
      status: 'approved'
    });

    return NextResponse.json({ success: true, message: `Request ${requestId} marked as approved.` });
  } catch (error: any) {
    console.error("Error approving user:", error);
    return NextResponse.json({ success: false, error: error.message || "An unexpected error occurred on the server." }, { status: 500 });
  }
}
