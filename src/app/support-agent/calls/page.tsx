"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  VolumeX,
  Clock,
  MapPin,
  Globe,
  User,
  VideoOff
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { agoraManager } from "@/utils/agora";
import { generateAgoraToken } from "@/ai/client";
import { useTranslation } from "react-i18next";

interface CallSession {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  status: 'ringing' | 'active' | 'ended' | 'missed';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  language: string;
  location?: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  callType: 'voice' | 'video';
}

export default function SupportAgentCallsPage() {
  const { t } = useTranslation();
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallSession | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAgoraConnected, setIsAgoraConnected] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Listen for active calls
    const activeCallsQuery = query(
      collection(db, 'calls'),
      where('status', 'in', ['ringing', 'active']),
      orderBy('startTime', 'desc')
    );

    const unsubscribeActive = onSnapshot(activeCallsQuery, (snapshot) => {
      const calls: CallSession[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        calls.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || t('common.unknownUser'),
          userImage: data.userImage,
          status: data.status || 'ringing',
          startTime: data.startTime?.toDate(),
          language: data.language || 'English',
          location: data.location,
          priority: data.priority || 'medium',
          callType: data.callType || 'voice'
        });
      });
      setActiveCalls(calls);
    });

    // Listen for call history (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const historyQuery = query(
      collection(db, 'calls'),
      where('status', '==', 'ended'),
      where('endTime', '>=', yesterday),
      orderBy('endTime', 'desc'),
      orderBy('startTime', 'desc')
    );

    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const calls: CallSession[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        calls.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || t('common.unknownUser'),
          userImage: data.userImage,
          status: data.status || 'ended',
          startTime: data.startTime?.toDate(),
          endTime: data.endTime?.toDate(),
          duration: data.duration,
          language: data.language || 'English',
          location: data.location,
          priority: data.priority || 'medium',
          callType: data.callType || 'voice'
        });
      });
      setCallHistory(calls);
    });

    return () => {
      unsubscribeActive();
      unsubscribeHistory();
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInCall && selectedCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCall, selectedCall]);

  // Handle remote video
  useEffect(() => {
    if (isVideoEnabled && remoteVideoRef.current) {
      const remoteTrack = agoraManager.getRemoteVideoTrack();
      if (remoteTrack) {
        remoteTrack.play(remoteVideoRef.current);
      }
    }
  }, [isVideoEnabled, isAgoraConnected]);

  const handleAcceptCall = async (call: CallSession) => {
    try {
      // Generate Agora token via Firebase Function
      const channelName = `call_${call.id}`;

      // IMPORTANT: Generate token for UID 0 to be compatible with null/anonymous join
      // This matches the implementation in CallInterface.tsx
      const { token } = await generateAgoraToken({
        channelName,
        uid: "0",
        role: 'publisher'
      });

      // Update Firestore
      await updateDoc(doc(db, 'calls', call.id), {
        status: 'active',
        agentId: auth.currentUser?.uid,
        acceptedAt: new Date()
      });

      // Initialize Agora
      await agoraManager.initializeClient();
      await agoraManager.setupRemoteTracks();

      // Create tracks based on call type
      const hasVideo = call.callType === 'video';
      await agoraManager.createLocalTracks(true, hasVideo);

      // Join channel with token
      // Passing undefined for uid to match the token generated for uid 0
      await agoraManager.joinChannel(channelName, token, undefined);

      // Publish tracks
      await agoraManager.publishTracks();

      // Set video enabled if video call
      setIsVideoEnabled(hasVideo);

      // Play local video if video call
      if (hasVideo && localVideoRef.current) {
        const localTrack = agoraManager.getLocalVideoTrack();
        if (localTrack) {
          localTrack.play(localVideoRef.current);
        }
      }

      setSelectedCall(call);
      setIsInCall(true);
      setIsAgoraConnected(true);
      setCallDuration(0);
      toast({ title: t('supportAgent.calls.connectedTitle'), description: t('supportAgent.calls.connectedTo', { userName: call.userName }) });
    } catch (error) {
      console.error("Error accepting call:", error);
      toast({ title: "Error", description: "Failed to accept call", variant: "destructive" });
    }
  };

  const handleDeclineCall = async (call: CallSession) => {
    try {
      await updateDoc(doc(db, 'calls', call.id), {
        status: 'declined',
        endTime: new Date(),
        agentId: auth.currentUser?.uid
      });
      setSelectedCall(null);
      toast({ title: t('supportAgent.calls.declinedTitle'), description: t('supportAgent.calls.declinedDesc', { userName: call.userName }) });
    } catch (error) {
      console.error("Error declining call:", error);
      toast({ title: "Error", description: "Failed to decline call", variant: "destructive" });
    }
  };

  const handleEndCall = async () => {
    if (!selectedCall) return;

    try {
      const duration = callDuration;
      await updateDoc(doc(db, 'calls', selectedCall.id), {
        status: 'ended',
        endTime: new Date(),
        duration: duration
      });

      // Leave Agora channel
      await agoraManager.leaveChannel();

      setIsInCall(false);
      setSelectedCall(null);
      setIsAgoraConnected(false);
      setIsVideoEnabled(false);
      setCallDuration(0);
      toast({ title: t('supportAgent.calls.endedTitle'), description: t('supportAgent.calls.endedDesc', { userName: selectedCall.userName }) });
    } catch (error) {
      console.error("Error ending call:", error);
      toast({ title: "Error", description: "Failed to end call", variant: "destructive" });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    agoraManager.muteAudio(newMuted);
  };

  const toggleVideo = () => {
    if (!isVideoEnabled) return; // Only allow if video was enabled for this call
    const newVideoMuted = !isVideoEnabled;
    setIsVideoEnabled(!newVideoMuted);
    agoraManager.muteVideo(newVideoMuted);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-destructive';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-cyan-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
            <PhoneCall className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-green-600 to-cyan-600 bg-clip-text text-transparent mb-3 sm:mb-4">
            {t('supportAgent.calls.title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            {t('supportAgent.calls.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Calls */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {t('supportAgent.calls.active')}
              </CardTitle>
              <CardDescription>{activeCalls.length} {t('supportAgent.calls.inProgress')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {activeCalls.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('supportAgent.calls.noActive')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {activeCalls.map((call) => (
                      <div
                        key={call.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedCall?.id === call.id
                          ? 'border-green-500 bg-accent'
                          : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={call.userImage} />
                            <AvatarFallback>{call.userName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-foreground truncate">{call.userName}</p>
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(call.priority)}`} />
                                <Badge variant={call.status === 'ringing' ? 'destructive' : 'default'} className="text-xs">
                                  {call.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                <Globe className="h-3 w-3 mr-1" />
                                {call.language}
                              </Badge>
                              {call.callType === 'video' && (
                                <Badge variant="outline" className="text-xs">
                                  <User className="h-3 w-3 mr-1" />
                                  Video
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Call Interface */}
          <Card className="lg:col-span-2">
            {isInCall && selectedCall ? (
              <>
                <CardHeader className="text-center border-b">
                  <div className="flex items-center justify-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedCall.userImage} />
                      <AvatarFallback className="text-2xl">{selectedCall.userName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedCall.userName}</h3>
                      <p className="text-muted-foreground">{selectedCall.language}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-mono text-lg">{formatDuration(callDuration)}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                  {/* Video Elements */}
                  {isVideoEnabled && (
                    <div className="flex gap-4 w-full max-w-4xl">
                      <div className="flex-1">
                        <div className="bg-black rounded-lg overflow-hidden aspect-video">
                          <div ref={remoteVideoRef} className="w-full h-full bg-gray-900 flex items-center justify-center">
                            <User className="h-12 w-12 text-gray-400" />
                          </div>
                        </div>
                        <p className="text-sm text-center mt-2 text-muted-foreground">{t('supportAgent.calls.remoteVideo')}</p>
                      </div>
                      <div className="w-48">
                        <div className="bg-black rounded-lg overflow-hidden aspect-video">
                          <div ref={localVideoRef} className="w-full h-full bg-gray-900 flex items-center justify-center">
                            <User className="h-8 w-8 text-gray-400" />
                          </div>
                        </div>
                        <p className="text-sm text-center mt-2 text-muted-foreground">{t('supportAgent.calls.localVideo')}</p>
                      </div>
                    </div>
                  )}

                  {/* Call Controls */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant={isMuted ? "destructive" : "outline"}
                      size="lg"
                      className="w-16 h-16 rounded-full"
                      onClick={toggleMute}
                    >
                      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>

                    {isVideoEnabled && (
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-16 h-16 rounded-full"
                        onClick={toggleVideo}
                      >
                        <VideoOff className="h-6 w-6" />
                      </Button>
                    )}

                    <Button
                      variant={isOnHold ? "secondary" : "outline"}
                      size="lg"
                      className="w-16 h-16 rounded-full"
                      onClick={() => setIsOnHold(!isOnHold)}
                    >
                      <VolumeX className="h-6 w-6" />
                    </Button>

                    <Button
                      variant="destructive"
                      size="lg"
                      className="w-20 h-20 rounded-full"
                      onClick={handleEndCall}
                    >
                      <PhoneOff className="h-8 w-8" />
                    </Button>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {isOnHold ? "Call on hold" : "Call in progress"}
                    </p>
                    {selectedCall.location && (
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {selectedCall.location}
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
            ) : selectedCall && !isInCall ? (
              <>
                <CardHeader className="text-center border-b">
                  <div className="flex items-center justify-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedCall.userImage} />
                      <AvatarFallback className="text-2xl">{selectedCall.userName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedCall.userName}</h3>
                      <p className="text-muted-foreground">{selectedCall.language}</p>
                      <Badge variant="outline" className="mt-2">
                        {selectedCall.priority.toUpperCase()} {t('supportAgent.calls.priorityLabel')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <PhoneCall className="h-12 w-12 text-green-600 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">{t('supportAgent.calls.incoming')}</h4>
                      <p className="text-muted-foreground">{t('supportAgent.calls.fromUser', { userName: selectedCall.userName })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className="px-8"
                      onClick={() => handleDeclineCall(selectedCall)}
                    >
                      {t('supportAgent.calls.decline')}
                    </Button>
                    <Button
                      size="lg"
                      className="px-8 bg-green-600 hover:bg-green-700"
                      onClick={() => handleAcceptCall(selectedCall)}
                    >
                      <Phone className="h-5 w-5 mr-2" />
                      {t('supportAgent.calls.accept')}
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-center">
                <div>
                  <Phone className="h-16 w-16 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">{t('supportAgent.calls.selectCall')}</h3>
                  <p className="text-slate-500">{t('supportAgent.calls.selectCallHint')}</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Call History */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('supportAgent.calls.history')}
            </CardTitle>
            <CardDescription>{t('supportAgent.calls.historySubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {callHistory.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-muted-foreground">{t('supportAgent.calls.noHistory')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {callHistory.map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={call.userImage} />
                        <AvatarFallback>{call.userName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{call.userName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {call.language}
                          </Badge>
                          {call.duration && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(call.duration)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={call.status === 'ended' ? 'secondary' : 'destructive'}
                        className="text-xs"
                      >
                        {call.status}
                      </Badge>
                      {call.endTime && (
                        <span className="text-xs text-muted-foreground">
                          {call.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}