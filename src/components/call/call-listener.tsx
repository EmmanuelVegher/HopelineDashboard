"use client";

import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from "@/lib/firebase";
import { IncomingCallDialog } from './incoming-call-dialog';
import { useNavigate } from 'react-router-dom';

interface CallData {
    id: string;
    userId: string;
    agentId: string;
    userName: string;
    userImage?: string;
    agentName: string;
    agentImage?: string;
    callType: 'video' | 'voice';
    channelName: string;
    callerId: string;
    status: string;
    chatId?: string;
}

/**
 * Global component that listens for incoming calls
 * Should be mounted at the app root level
 */
export function CallListener() {
    const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // Determine which field to listen to based on user role
        // For now, we'll listen to both userId and agentId
        // In production, you'd check the user's role from their profile
        const userDoc = currentUser;

        // Listen for calls where current user is the recipient
        const q1 = query(
            collection(db, 'calls'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'ringing')
        );

        const q2 = query(
            collection(db, 'calls'),
            where('agentId', '==', currentUser.uid),
            where('status', '==', 'ringing')
        );

        const unsubscribe1 = onSnapshot(q1, (snapshot) => {
            snapshot.docs.forEach((docSnap) => {
                const callData = { id: docSnap.id, ...docSnap.data() } as CallData;

                // Only show dialog if I didn't initiate the call
                if (callData.callerId !== currentUser.uid) {
                    setIncomingCall(callData);
                    playRingtone();
                }
            });
        });

        const unsubscribe2 = onSnapshot(q2, (snapshot) => {
            snapshot.docs.forEach((docSnap) => {
                const callData = { id: docSnap.id, ...docSnap.data() } as CallData;

                // Only show dialog if I didn't initiate the call
                if (callData.callerId !== currentUser.uid) {
                    setIncomingCall(callData);
                    playRingtone();
                }
            });
        });

        return () => {
            unsubscribe1();
            unsubscribe2();
        };
    }, []);

    // Monitor call status changes to auto-close dialog
    useEffect(() => {
        if (!incomingCall) return;

        const unsubscribe = onSnapshot(doc(db, 'calls', incomingCall.id), (snapshot) => {
            if (!snapshot.exists()) {
                closeDialog();
                return;
            }

            const status = snapshot.data().status;

            // Auto-close if call is no longer ringing
            if (status !== 'ringing') {
                closeDialog();
            }
        });

        return () => unsubscribe();
    }, [incomingCall]);

    const playRingtone = () => {
        // Create audio element for ringtone
        if (!audioRef.current) {
            audioRef.current = new Audio('/ringtone.mp3'); // Add ringtone file to public folder
            audioRef.current.loop = true;
        }
        audioRef.current.play().catch(err => console.log('Ringtone play failed:', err));
    };

    const stopRingtone = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const closeDialog = () => {
        stopRingtone();
        setIncomingCall(null);
    };

    const handleAccept = async () => {
        if (!incomingCall) return;

        // Update call status to 'active'
        await updateDoc(doc(db, 'calls', incomingCall.id), {
            status: 'active',
            acceptedAt: Timestamp.now()
        });

        stopRingtone();

        // Navigate to call page
        const recipientName = incomingCall.callerId === incomingCall.agentId
            ? incomingCall.agentName
            : incomingCall.userName;
        const recipientImage = incomingCall.callerId === incomingCall.agentId
            ? incomingCall.agentImage
            : incomingCall.userImage;

        // Store call info in sessionStorage for the call page
        sessionStorage.setItem('activeCall', JSON.stringify({
            callId: incomingCall.id,
            chatId: incomingCall.chatId,
            channelName: incomingCall.channelName,
            recipientName,
            recipientImage,
            callType: incomingCall.callType,
            isIncoming: true
        }));

        // Navigate to call page
        navigate('/call');

        setIncomingCall(null);
    };

    const handleDecline = async () => {
        if (!incomingCall) return;

        // Update call status to 'declined'
        await updateDoc(doc(db, 'calls', incomingCall.id), {
            status: 'declined',
            endTime: Timestamp.now()
        });

        // ✅ Log message if chatId exists
        if (incomingCall.chatId) {
            try {
                await addDoc(collection(db, `chats/${incomingCall.chatId}/messages`), {
                    content: `📞 Missed ${incomingCall.callType} call (Declined)`,
                    messageType: 'call_status',
                    callType: incomingCall.callType,
                    originalText: `Missed ${incomingCall.callType} call`,
                    agentTranslatedText: `Missed ${incomingCall.callType} call`, // ✅ Added for localization consistency
                    userTranslatedText: `Missed ${incomingCall.callType} call`,  // ✅ Added for localization consistency
                    receiverId: incomingCall.callerId,
                    senderEmail: auth.currentUser?.email || '',
                    senderId: auth.currentUser?.uid,
                    timestamp: serverTimestamp(),
                    status: 'read'
                });
            } catch (e) {
                console.error("Error logging declined call:", e);
            }
        }

        closeDialog();
    };

    if (!incomingCall) return null;

    const displayName = incomingCall.callerId === incomingCall.agentId
        ? incomingCall.agentName
        : incomingCall.userName;
    const displayImage = incomingCall.callerId === incomingCall.agentId
        ? incomingCall.agentImage
        : incomingCall.userImage;

    return (
        <IncomingCallDialog
            callerName={displayName}
            callerImage={displayImage}
            callType={incomingCall.callType}
            onAccept={handleAccept}
            onDecline={handleDecline}
        />
    );
}
