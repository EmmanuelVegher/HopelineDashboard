import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Clock, MapPin, User, Siren, X } from 'lucide-react';
import { type SosAlert } from '@/ai/schemas/sos';
import { useAdminData } from '@/contexts/AdminDataProvider';

interface EmergencySignalModalProps {
    alert: SosAlert | null;
    onClose: () => void;
}

export const EmergencySignalModal: React.FC<EmergencySignalModalProps> = ({ alert, onClose }) => {
    const { markSosAsSeen } = useAdminData();
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        if (!alert) {
            setTimeLeft(30);
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [alert, onClose]);

    if (!alert) return null;

    return (
        <Dialog open={!!alert} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl bg-slate-950 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3)] text-white overflow-hidden p-0">
                {/* Header with Pulse */}
                <div className="absolute top-0 left-0 w-full h-1 bg-red-600">
                    <div className="h-full bg-white/50 animate-[ping_1.5s_infinite]" style={{ width: `${(timeLeft / 30) * 100}%` }} />
                </div>

                <div className="p-8 relative">
                    {/* Background Siren Animation */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-600/10 rounded-full blur-3xl animate-pulse -z-10" />

                    <DialogHeader className="mb-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-600 rounded-full animate-bounce">
                                    <Siren className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <DialogTitle className="text-4xl font-black tracking-tighter text-red-500 uppercase">
                                        Emergency Signal Received
                                    </DialogTitle>
                                    <p className="text-slate-400 font-mono text-sm tracking-widest mt-1">
                                        SOURCE ID: {alert.id.substring(0, 8).toUpperCase()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-5xl font-black text-white/20 font-mono">
                                    {timeLeft}s
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Auto-Close</span>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Location Details */}
                        <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-3 text-red-400">
                                <MapPin className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-widest">Incident Location</span>
                            </div>
                            <p className="text-xl font-bold leading-tight">
                                {alert.location?.address || 'Geolocation Coordinates Only'}
                            </p>
                            <div className="pt-2">
                                <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-mono text-slate-400">
                                    LAT: {alert.location?.latitude?.toFixed(5) || 'N/A'} | LNG: {alert.location?.longitude?.toFixed(5) || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* Caller/User Details */}
                        <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-3 text-blue-400">
                                <User className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-widest">User Profile</span>
                            </div>
                            <p className="text-xl font-bold">
                                {alert.emergencyType ? `Type: ${alert.emergencyType}` : 'Emergency Signal'}
                            </p>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Clock className="w-4 h-4" />
                                    <span>{alert.timestamp ? new Date(alert.timestamp.seconds * 1000).toLocaleString() : 'Just now'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="capitalize">Status: <span className="text-red-500 font-bold">{alert.status}</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-4">
                        <button
                            onClick={async () => {
                                if (alert.id) {
                                    await markSosAsSeen(alert.id);
                                }
                                onClose();
                            }}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 group"
                        >
                            <Siren className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                            Acknowledge Incident
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 border border-white/20 hover:bg-white/5 rounded-xl transition-colors"
                        >
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
