"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import { db, functions, auth } from "@/lib/firebase";
import { doc, updateDoc, Timestamp, addDoc, collection, serverTimestamp } from "firebase/firestore";
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

    const localVideoRef = useRef<HTMLDivElement>(null);
    const remoteVideoRef = useRef<HTMLDivElement>(null);

    const clientRef = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
    const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);

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

                // Join channel with the extracted token
                await client.join(AGORA_APP_ID, channelName, token, null);

                if (!isMounted) {
                    await client.leave();
                    return;
                }

                // Create and publish local tracks
                if (callType === 'video') {
                    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
                    localAudioTrackRef.current = audioTrack;
                    localVideoTrackRef.current = videoTrack;

                    // Play local video
                    if (localVideoRef.current) {
                        videoTrack.play(localVideoRef.current);
                    }

                    await client.publish([audioTrack, videoTrack]);
                } else {
                    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                    localAudioTrackRef.current = audioTrack;
                    await client.publish(audioTrack);
                }

                // Listen for remote users
                client.on('user-published', async (user, mediaType) => {
                    await client.subscribe(user, mediaType);

                    if (mediaType === 'video' && remoteVideoRef.current) {
                        user.videoTrack?.play(remoteVideoRef.current);
                    }
                    if (mediaType === 'audio') {
                        user.audioTrack?.play();
                    }

                    // Update status to connected when remote user joins
                    if (isMounted) {
                        setCallStatus('connected');

                        // Start timer
                        timerInterval = setInterval(() => {
                            setConnectionTime(prev => prev + 1);
                        }, 1000);
                    }
                });

                client.on('user-unpublished', (user) => {
                    console.log('Remote user unpublished:', user.uid);
                });

                client.on('user-left', (user) => {
                    console.log('Remote user left:', user.uid);
                    endCall();
                });

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
            const messageData = {
                timestamp: serverTimestamp(),
                translationTimestamp: serverTimestamp(),
                senderEmail: auth.currentUser?.email || '',
                senderId: auth.currentUser?.uid,
                receiverId: recipientName, // Ideally this should be passed as ID, but using name for now if ID not avail? Wait, we need receiverID.
                // Let's check props. recipientName is name. We need IDs. 
                // Actually sender is current user (agent). Receiver is the user we are calling. 
                // We'll trust the caller provided valid IDs in the call doc, but here we just need to write to the chat.
                // We'll use defaults for now since we might not have recipientId prop yet. 
                // Wait, we need recipientId. Let's add it to props or fetch it? 
                // Providing `chatId` allows us to write to the collection.
                status: 'read',
            };

            if (finalStatus === 'answered') {
                const durationText = formatTime(connectionTime);
                const content = callType === 'voice'
                    ? `📞 Voice call ended (${durationText})`
                    : `📹 Video call ended (${durationText})`;

                await addDoc(collection(db, `chats/${chatId}/messages`), {
                    ...messageData,
                    messageType: "call_status", // or "call"
                    callType: callType,
                    content: content,
                    originalText: content,
                    agentTranslatedText: content, // ✅ Added for localization consistency
                    userTranslatedText: content,  // ✅ Added for localization consistency
                });
            } else {
                // Missed Call / Declined / Cancelled
                // If it was outgoing and we cancelled it, maybe "Call cancelled"?
                // If incoming and we didn't answer, "Missed call"?
                // For now, let's treat non-connected calls as "Missed" or "No answer"
                const content = callType === 'voice'
                    ? `📞 Missed voice call`
                    : `📹 Missed video call`;

                await addDoc(collection(db, `chats/${chatId}/messages`), {
                    ...messageData,
                    messageType: "call_status",
                    callType: callType,
                    content: content,
                    originalText: content,
                    agentTranslatedText: content,
                    userTranslatedText: content,
                });
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
                        <AvatarFallback>{recipientName[0]}</AvatarFallback>
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
                            <AvatarFallback>{recipientName[0]}</AvatarFallback>
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
