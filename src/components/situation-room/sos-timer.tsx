"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface SOSTimerProps {
    timestamp: any;
    className?: string;
    warningThresholdSeconds?: number;
    showIcon?: boolean;
}

export function SOSTimer({ timestamp, className, warningThresholdSeconds = 120, showIcon = true }: SOSTimerProps) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!timestamp) return;

        let startTime = 0;
        if (typeof timestamp === 'number') {
            // Assume milliseconds if it's very large, otherwise seconds (Firebase)
            if (timestamp > 1e11) {
                startTime = timestamp;
            } else {
                startTime = timestamp * 1000;
            }
        } else if (timestamp?.toMillis) {
            startTime = timestamp.toMillis();
        } else if (timestamp?.seconds) {
            startTime = timestamp.seconds * 1000;
        } else if (timestamp instanceof Date) {
            startTime = timestamp.getTime();
        } else {
            const parsed = new Date(timestamp).getTime();
            if (!isNaN(parsed)) {
                startTime = parsed;
            }
        }

        if (!startTime) return;

        const updateTimer = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            setElapsedSeconds(Math.max(0, elapsed));
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [timestamp]);

    const formatTime = (totalSeconds: number) => {
        const d = Math.floor(totalSeconds / (3600 * 24));
        const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        const pad = (num: number) => num.toString().padStart(2, '0');

        if (d > 0) {
            return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
        }
        if (h > 0) {
            return `${h}h ${pad(m)}m ${pad(s)}s`;
        }
        return `${pad(m)}m ${pad(s)}s`;
    };

    const isWarning = elapsedSeconds >= warningThresholdSeconds;

    return (
        <div className={cn(
            "flex items-center gap-1 font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded transition-colors",
            isWarning ? "bg-red-100 text-red-600 border border-red-200" : "bg-slate-100 text-slate-600 border border-slate-200",
            className
        )}>
            {showIcon && <Clock className={cn("h-3 w-3", isWarning && "text-red-500 animate-pulse")} />}
            <span>{formatTime(elapsedSeconds)}</span>
        </div>
    );
}
