import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CallInterface } from '@/components/chat/call-interface';

export default function CallPage() {
    const navigate = useNavigate();
    const [callData, setCallData] = useState<any>(null);

    useEffect(() => {
        const storedCall = sessionStorage.getItem('activeCall');
        if (!storedCall) {
            navigate('/dashboard'); // Redirect if no call data
            return;
        }
        setCallData(JSON.parse(storedCall));
    }, [navigate]);

    const handleClose = () => {
        sessionStorage.removeItem('activeCall');
        // Navigate back to previous location or dashboard
        // Try to go back, if not possible go to dashboard
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/dashboard');
        }
    };

    if (!callData) return <div className="flex items-center justify-center h-screen bg-slate-950 text-white">Loading call...</div>;

    return (
        <div className="h-screen w-screen bg-slate-950 overflow-hidden">
            <CallInterface
                callId={callData.callId}
                chatId={callData.chatId}
                channelName={callData.channelName}
                recipientName={callData.recipientName}
                recipientImage={callData.recipientImage}
                callType={callData.callType}
                isIncoming={callData.isIncoming}
                onClose={handleClose}
            />
        </div>
    );
}
