"use client";

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, addDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
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
    callerName?: string;
    callerAvatar?: string;
    participants: string[];
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
        const unsubscribeAuth = onAuthStateChanged(auth, (user: User | null) => {
            if (!user) {
                setIncomingCall(null);
                stopRingtone();
                return;
            }

            const handleCalls = (snapshot: any, source: string) => {
                const now = Date.now();
                const twoMinutesAgo = now - 120000;

                snapshot.docs.forEach((docSnap: any) => {
                    const data = docSnap.data();
                    const callData = { id: docSnap.id, ...data } as CallData;

                    const startTimeMillis = data.startTime?.toMillis?.() || 0;
                    const isFresh = startTimeMillis > twoMinutesAgo;

                    console.log(`Call detection (${source}):`, {
                        id: callData.id,
                        status: callData.status,
                        startTime: new Date(startTimeMillis).toLocaleTimeString(),
                        isFresh,
                        caller: callData.callerId,
                        channel: callData.channelName
                    });

                    // Only show dialog if I didn't initiate the call AND it's a fresh signal
                    // If we already have an incomingCall, we only replace it if this one is NEWER
                    if (callData.callerId !== user.uid && isFresh) {
                        setIncomingCall(prev => {
                            if (!prev) return callData;
                            const prevStart = (prev as any).startTime?.toMillis?.() || 0;
                            return startTimeMillis > prevStart ? callData : prev;
                        });
                        playRingtone();
                    }
                });
            };

            // New Standard: Listen for any call where I am a participant
            const qStandard = query(
                collection(db, 'calls'),
                where('participants', 'array-contains', user.uid),
                where('status', '==', 'ringing')
            );

            // Fallback 1: Listen for calls via receiverId
            const qFallback1 = query(
                collection(db, 'calls'),
                where('receiverId', '==', user.uid),
                where('status', '==', 'ringing')
            );

            // Fallback 2: Listen for calls via userId (Common legacy mobile pattern)
            const qFallback2 = query(
                collection(db, 'calls'),
                where('userId', '==', user.uid),
                where('status', '==', 'ringing')
            );

            // Fallback 3: Listen for calls via agentId (Alternative legacy pattern)
            const qFallback3 = query(
                collection(db, 'calls'),
                where('agentId', '==', user.uid),
                where('status', '==', 'ringing')
            );

            const handleError = (error: any, source: string) => {
                console.error(`Call listener error (${source}):`, error);
            };

            const unsubscribeStandard = onSnapshot(qStandard, (s) => handleCalls(s, 'standard'), (e) => handleError(e, 'standard'));
            const unsubscribeF1 = onSnapshot(qFallback1, (s) => handleCalls(s, 'f1-receiverId'), (e) => handleError(e, 'f1-receiverId'));
            const unsubscribeF2 = onSnapshot(qFallback2, (s) => handleCalls(s, 'f2-userId'), (e) => handleError(e, 'f2-userId'));
            const unsubscribeF3 = onSnapshot(qFallback3, (s) => handleCalls(s, 'f3-agentId'), (e) => handleError(e, 'f3-agentId'));

            return () => {
                unsubscribeStandard();
                unsubscribeF1();
                unsubscribeF2();
                unsubscribeF3();
            };
        });

        return () => unsubscribeAuth();
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
        if (!audioRef.current && typeof Audio !== 'undefined') {
            // Using a more professional and melodious Zen bell ringtone
            audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audioRef.current.loop = true;
        }
        audioRef.current?.play().catch(err => console.log('Ringtone play failed:', err));
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

        console.log(`[Call] Accepting call: ${incomingCall.id}, Status: active`);

        // Update call status to 'active' (standard for connection)
        await updateDoc(doc(db, 'calls', incomingCall.id), {
            status: 'active',
            acceptedAt: Timestamp.now()
        });

        stopRingtone();

        // Navigate to call page
        const recipientName = incomingCall.callerName || (incomingCall.callerId === incomingCall.agentId
            ? incomingCall.agentName
            : incomingCall.userName) || 'Unknown User';
        const recipientImage = incomingCall.callerAvatar || (incomingCall.callerId === incomingCall.agentId
            ? incomingCall.agentImage
            : incomingCall.userImage);

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

        try {
            // Update call status to 'declined'
            await updateDoc(doc(db, 'calls', incomingCall.id), {
                status: 'declined',
                endTime: Timestamp.now()
            });

            // ✅ Log message if chatId exists
            if (incomingCall.chatId) {
                const messagesRef = collection(db, `chats/${incomingCall.chatId}/messages`);
                const q = query(messagesRef, where('callId', '==', incomingCall.id), limit(1));
                const querySnapshot = await getDocs(q);

                const content = `📞 Missed ${incomingCall.callType} call (Declined)`;

                if (!querySnapshot.empty) {
                    await updateDoc(querySnapshot.docs[0].ref, {
                        content: content,
                        originalText: `Missed ${incomingCall.callType} call`,
                        agentTranslatedText: content,
                        userTranslatedText: content,
                        timestamp: serverTimestamp(),
                        status: 'read'
                    });
                } else {
                    await addDoc(messagesRef, {
                        content: content,
                        messageType: 'call',
                        callType: incomingCall.callType,
                        callId: incomingCall.id,
                        originalText: `Missed ${incomingCall.callType} call`,
                        agentTranslatedText: content,
                        userTranslatedText: content,
                        receiverId: incomingCall.callerId,
                        senderEmail: auth.currentUser?.email || '',
                        senderId: auth.currentUser?.uid,
                        timestamp: serverTimestamp(),
                        status: 'read'
                    });
                }
            }
        } catch (e) {
            console.error("Error logging declined call:", e);
        }

        setIncomingCall(null);
    };

    if (!incomingCall) return null;

    const displayName = incomingCall.callerName || (incomingCall.callerId === incomingCall.agentId
        ? incomingCall.agentName
        : incomingCall.userName) || 'Unknown User';

    const displayImage = incomingCall.callerAvatar || (incomingCall.callerId === incomingCall.agentId
        ? incomingCall.agentImage
        : incomingCall.userImage);

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
