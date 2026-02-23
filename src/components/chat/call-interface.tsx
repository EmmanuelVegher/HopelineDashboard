"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import { db, functions, auth } from "@/lib/firebase";
import { doc, updateDoc, Timestamp, addDoc, collection, serverTimestamp, query, where, getDocs, limit, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { AGORA_APP_ID } from "@/lib/agora";

interface CallInterfaceProps {
    callId: string;
    chatId: string; // ✅ Added chatId
    channelName: string;
    recipientName: string;
    recipientImage?: string;
    userName?: string; // ✅ Added optional userName
    userImage?: string; // ✅ Added optional userImage
    callType: 'video' | 'voice';
    isIncoming: boolean;
    onClose: () => void;
}

export function CallInterface({
    callId,
    chatId,
    channelName,
    recipientName,
    recipientImage,
    callType,
    isIncoming,
    onClose
}: CallInterfaceProps) {
    const [callStatus, setCallStatus] = useState<'calling' | 'ringing' | 'connected' | 'ended'>(
        isIncoming ? 'ringing' : 'calling'
    );
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
    const [isMinimized, setIsMinimized] = useState(false);
    const [connectionTime, setConnectionTime] = useState(0);
    const [callData, setCallData] = useState<any>(null);

    const localVideoRef = useRef<HTMLDivElement>(null);
    const remoteVideoRef = useRef<HTMLDivElement>(null);
    const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);

    const clientRef = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
    const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);

    // Initial fetch of call data
    useEffect(() => {
        const fetchCall = async () => {
            const docSnap = await getDoc(doc(db, 'calls', callId));
            if (docSnap.exists()) {
                setCallData(docSnap.data());
            }
        };
        fetchCall();
    }, [callId]);

    // Handle Ringback Audio
    useEffect(() => {
        if (!isIncoming && (callStatus === 'calling' || callStatus === 'ringing')) {
            if (!ringbackAudioRef.current && typeof Audio !== 'undefined') {
                // Melodious Marimba for ringback
                ringbackAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/607/607-preview.mp3');
                ringbackAudioRef.current.loop = true;
            }
            ringbackAudioRef.current?.play().catch(err => console.log('[Call] Ringback play failed:', err));
        } else {
            ringbackAudioRef.current?.pause();
            if (ringbackAudioRef.current) ringbackAudioRef.current.currentTime = 0;
        }

        return () => {
            ringbackAudioRef.current?.pause();
            if (ringbackAudioRef.current) ringbackAudioRef.current.currentTime = 0;
        };
    }, [callStatus, isIncoming]);

    useEffect(() => {
        let isMounted = true;
        let timerInterval: NodeJS.Timeout | null = null;

        const joinChannel = async () => {
            try {
                // Create Agora client
                const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                clientRef.current = client;

                // Get Agora token from Cloud Function
                const generateToken = httpsCallable(functions, 'generateAgoraToken');
                const result = await generateToken({
                    channelName: channelName,
                    uid: 0,
                    role: 'publisher'
                });

                // ✅ Extract the token string from the Cloud Function response
                // The Cloud Function returns an object: {token: 'string'}
                // So we need to access result.data.token
                const responseData = result.data as any;
                const token = typeof responseData === 'string'
                    ? responseData
                    : responseData.token;

                if (!token || typeof token !== 'string') {
                    throw new Error(`Invalid token format. Expected string, got: ${typeof token}`);
                }

                if (!isMounted) return;

                // Listen for remote users (BEFORE joining for reliability)
                client.on('user-published', async (user, mediaType) => {
                    console.log(`[Agora] Remote user published: ${user.uid}, type: ${mediaType}`);
                    await client.subscribe(user, mediaType);
                    console.log(`[Agora] Subscribed to remote user: ${user.uid}`);

                    if (mediaType === 'video' && remoteVideoRef.current) {
                        user.videoTrack?.play(remoteVideoRef.current);
                    }
                    if (mediaType === 'audio') {
                        user.audioTrack?.play();
                    }

                    // Update status to connected when remote user joins
                    if (isMounted) {
                        console.log(`[Agora] Connection established with user: ${user.uid}`);
                        setCallStatus('connected');

                        // Start timer
                        if (!timerInterval) {
                            timerInterval = setInterval(() => {
                                setConnectionTime(prev => prev + 1);
                            }, 1000);
                        }
                    }
                });

                client.on('user-joined', (user) => {
                    console.log(`[Agora] Remote user joined: ${user.uid}`);
                });

                client.on('user-left', (user) => {
                    console.log(`[Agora] Remote user left: ${user.uid}`);
                    endCall();
                });

                // Join channel with the extracted token
                console.log(`[Agora] Joining channel: ${channelName} as Anonymous UID...`);
                await client.join(AGORA_APP_ID, channelName, token, null);
                console.log(`[Agora] Successfully joined channel: ${channelName}`);

                if (!isMounted) {
                    await client.leave();
                    return;
                }

                // Create and publish local tracks
                if (callType === 'video') {
                    console.log(`[Agora] Creating camera and microphone tracks...`);
                    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
                    localAudioTrackRef.current = audioTrack;
                    localVideoTrackRef.current = videoTrack;

                    // Play local video
                    if (localVideoRef.current) {
                        videoTrack.play(localVideoRef.current);
                    }

                    await client.publish([audioTrack, videoTrack]);
                    console.log(`[Agora] Published local video and audio tracks`);
                } else {
                    console.log(`[Agora] Creating microphone track...`);
                    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                    localAudioTrackRef.current = audioTrack;
                    await client.publish(audioTrack);
                    console.log(`[Agora] Published local audio track`);
                }

            } catch (error) {
                console.error('Error joining Agora channel:', error);
                if (isMounted) {
                    endCall();
                }
            }
        };

        joinChannel();

        return () => {
            isMounted = false;
            if (timerInterval) clearInterval(timerInterval);

            // Cleanup
            localAudioTrackRef.current?.close();
            localVideoTrackRef.current?.close();
            clientRef.current?.leave();
        };
    }, []);

    const endCall = async () => {
        // Determine final status before setting state to 'ended'
        const finalStatus = callStatus === 'connected' ? 'answered' : 'missed';

        setCallStatus('ended');

        // Update Firestore call document
        await updateDoc(doc(db, 'calls', callId), {
            status: finalStatus, // 'answered' or 'missed' (or 'ended' if we want to stick to that)
            endTime: Timestamp.now(),
            duration: connectionTime
        });

        // ✅ Save "Call Ended" or "Missed Call" message to chat sub-collection
        try {
            const receiverId = isIncoming ? callData?.agentId : callData?.userId;
            const messageData = {
                timestamp: serverTimestamp(),
                translationTimestamp: serverTimestamp(),
                senderEmail: auth.currentUser?.email || '',
                senderId: auth.currentUser?.uid,
                receiverId: receiverId || recipientName, // Use ID if available, otherwise name
                status: 'read',
            };

            const messagesRef = collection(db, `chats/${chatId}/messages`);
            const q = query(messagesRef, where('callId', '==', callId), limit(1));
            const querySnapshot = await getDocs(q);

            if (finalStatus === 'answered') {
                const durationText = formatTime(connectionTime);
                const content = callType === 'voice'
                    ? `📞 Voice call ended (${durationText})`
                    : `📹 Video call ended (${durationText})`;

                if (!querySnapshot.empty) {
                    await updateDoc(querySnapshot.docs[0].ref, {
                        content: content,
                        originalText: content,
                        agentTranslatedText: content,
                        userTranslatedText: content,
                        timestamp: serverTimestamp(),
                    });
                } else {
                    await addDoc(messagesRef, {
                        ...messageData,
                        messageType: "call",
                        callType: callType,
                        callId: callId,
                        content: content,
                        originalText: content,
                        agentTranslatedText: content,
                        userTranslatedText: content,
                    });
                }
            } else {
                const content = callType === 'voice'
                    ? `📞 Missed voice call`
                    : `📹 Missed video call`;

                if (!querySnapshot.empty) {
                    await updateDoc(querySnapshot.docs[0].ref, {
                        content: content,
                        originalText: content,
                        agentTranslatedText: content,
                        userTranslatedText: content,
                        timestamp: serverTimestamp(),
                        status: 'read'
                    });
                } else {
                    await addDoc(messagesRef, {
                        ...messageData,
                        messageType: "call",
                        callType: callType,
                        callId: callId,
                        content: content,
                        originalText: content,
                        agentTranslatedText: content,
                        userTranslatedText: content,
                    });
                }
            }
        } catch (error) {
            console.error("Error saving call status message:", error);
        }

        // Leave channel
        await clientRef.current?.leave();

        // Close tracks
        localAudioTrackRef.current?.close();
        localVideoTrackRef.current?.close();

        onClose();
    };

    const toggleMute = () => {
        if (localAudioTrackRef.current) {
            localAudioTrackRef.current.setEnabled(isMuted);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localVideoTrackRef.current) {
            localVideoTrackRef.current.setEnabled(!isVideoEnabled);
            setIsVideoEnabled(!isVideoEnabled);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-50 bg-white p-2 rounded-lg shadow-xl cursor-pointer border border-blue-200" onClick={() => setIsMinimized(false)}>
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={recipientImage} />
                        <AvatarFallback>{recipientName ? recipientName[0] : 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold capitalize">{callStatus}</span>
                    {callStatus === 'connected' && (
                        <span className="text-xs text-muted-foreground">{formatTime(connectionTime)}</span>
                    )}
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-4xl bg-slate-900 border-slate-800 text-white overflow-hidden shadow-2xl flex flex-col h-[80vh]">
                <div className="p-4 bg-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white/20">
                            <AvatarImage src={recipientImage} />
                            <AvatarFallback>{recipientName ? recipientName[0] : 'U'}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-semibold">{recipientName}</h3>
                            <p className="text-sm text-slate-400 capitalize">
                                {callStatus === 'connected' ? formatTime(connectionTime) : callStatus}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsMinimized(true)}>
                        <Minimize2 className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 relative bg-black flex items-center justify-center">
                    {/* Remote Video */}
                    <div
                        ref={remoteVideoRef}
                        className="w-full h-full"
                    />

                    {/* Local Video (PIP) */}
                    {callType === 'video' && (
                        <div className="absolute bottom-4 right-4 w-48 h-36 bg-slate-800 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
                            <div
                                ref={localVideoRef}
                                className={`w-full h-full ${!isVideoEnabled ? 'hidden' : ''}`}
                            />
                            {!isVideoEnabled && (
                                <div className="w-full h-full flex items-center justify-center text-slate-500">
                                    <VideoOff className="h-8 w-8" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Placeholder when no video */}
                    {callStatus !== 'connected' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Avatar className="h-32 w-32 opacity-50">
                                <AvatarImage src={recipientImage} />
                                <AvatarFallback className="text-4xl">{recipientName[0]}</AvatarFallback>
                            </Avatar>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-800 flex justify-center gap-6">
                    <Button
                        variant={isMuted ? "destructive" : "secondary"}
                        size="lg"
                        className="rounded-full h-14 w-14"
                        onClick={toggleMute}
                    >
                        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>

                    {callType === 'video' && (
                        <Button
                            variant={isVideoEnabled ? "secondary" : "destructive"}
                            size="lg"
                            className="rounded-full h-14 w-14"
                            onClick={toggleVideo}
                        >
                            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                        </Button>
                    )}

                    <Button
                        variant="destructive"
                        size="lg"
                        className="rounded-full h-14 w-14 bg-red-600 hover:bg-red-700"
                        onClick={endCall}
                    >
                        <PhoneOff className="h-6 w-6" />
                    </Button>
                </div>
            </Card>
        </div>
    );
}
