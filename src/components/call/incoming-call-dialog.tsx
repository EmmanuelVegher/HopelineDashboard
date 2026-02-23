"use client";


import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff, Video } from "lucide-react";

interface IncomingCallDialogProps {
    callerName: string;
    callerImage?: string;
    callType: 'video' | 'voice';
    onAccept: () => void;
    onDecline: () => void;
}

export function IncomingCallDialog({
    callerName,
    callerImage,
    callType,
    onAccept,
    onDecline
}: IncomingCallDialogProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-sm bg-white border-0 shadow-2xl mx-4">
                <div className="p-8 flex flex-col items-center text-center space-y-6">
                    {/* Caller Avatar */}
                    <div className="relative">
                        <Avatar className="h-24 w-24 border-4 border-blue-100 ring-4 ring-blue-50 animate-pulse">
                            <AvatarImage src={callerImage} />
                            <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                                {callerName?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                        </Avatar>
                        {callType === 'video' && (
                            <div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-2">
                                <Video className="h-4 w-4 text-white" />
                            </div>
                        )}
                    </div>

                    {/* Caller Info */}
                    <div>
                        <h3 className="text-xl font-semibold text-slate-900">{callerName}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Incoming {callType} call...
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 w-full pt-2">
                        <Button
                            variant="outline"
                            size="lg"
                            className="flex-1 h-14 rounded-full border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                            onClick={onDecline}
                        >
                            <PhoneOff className="h-5 w-5 mr-2" />
                            Decline
                        </Button>
                        <Button
                            size="lg"
                            className="flex-1 h-14 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
                            onClick={onAccept}
                        >
                            <Phone className="h-5 w-5 mr-2" />
                            Accept
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
