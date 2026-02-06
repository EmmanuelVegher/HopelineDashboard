import React, { useState } from 'react';
import { NigerianMapSVG } from '@/components/NigerianMapSVG';
import { StateData, ActivityItem } from '@/hooks/useSituationData';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { geoToSvg } from '@/lib/map-utils';

interface DisplacementMapProps {
    data: StateData[];
    alerts?: ActivityItem[];
    onStateSelect?: (state: StateData) => void;
}

export const DisplacementMap: React.FC<DisplacementMapProps> = ({ data, alerts = [], onStateSelect }) => {
    const [hoveredState, setHoveredState] = useState<StateData | null>(null);
    const [hoveredAlert, setHoveredAlert] = useState<ActivityItem | null>(null);

    return (
        <Card className="relative w-full h-[650px] bg-white border border-slate-100 shadow-none overflow-hidden flex items-center justify-center p-0 rounded-xl group/map">

            {/* Very Subtle Grid - Light Mode */}
            <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }}
            />

            <div className="relative z-10 w-full h-full transform transition-all duration-700 ease-out">
                <NigerianMapSVG
                    fill="#1F4D36" // Dark Forest Green
                    stroke="#FFFFFF" // White borders
                    strokeWidth={1}
                    className="w-full h-full"
                >
                    {data.map((state) => {
                        const size = Math.max(16, Math.min(70, Math.log10(state.displacedCount + 10) * 16));

                        // Existing Dashboard Style: Soft colors
                        const colors =
                            state.riskLevel === 'high' ? 'bg-red-500 border-red-200' :
                                state.riskLevel === 'medium' ? 'bg-amber-500 border-amber-200' :
                                    'bg-blue-500 border-blue-200';

                        const pulseClass = state.riskLevel === 'high' || state.criticalAlerts > 0 ? 'animate-ping' : '';

                        return (
                            <foreignObject
                                key={state.name}
                                x={state.coordinates.x - size / 2}
                                y={state.coordinates.y - size / 2}
                                width={size + 40}
                                height={size + 40}
                                className="overflow-visible pointer-events-none"
                            >
                                <div
                                    className="relative w-full h-full flex items-center justify-center pointer-events-auto cursor-pointer"
                                    onMouseEnter={() => setHoveredState(state)}
                                    onMouseLeave={() => setHoveredState(null)}
                                    onClick={() => onStateSelect?.(state)}
                                >
                                    {/* Pulse Effect - Subtler for Light Mode */}
                                    <span className={cn("absolute inline-flex w-full h-full opacity-15 rounded-full", colors, pulseClass)}></span>

                                    {/* Main Bubble - Semi-opaque with Border */}
                                    <span className={cn("relative inline-flex rounded-full border-2 border-white shadow-sm transition-all duration-300 hover:scale-125 items-center justify-center", colors)}
                                        style={{ width: size, height: size, opacity: 0.9 }}>

                                        {/* Value Display */}
                                        {state.displacedCount > 0 && (
                                            <span className="text-[9px] font-bold text-white tracking-tighter">
                                                {state.displacedCount > 1000 ? `${(state.displacedCount / 1000).toFixed(1)}k` : state.displacedCount}
                                            </span>
                                        )}
                                        {/* Minimal Alert Indicator */}
                                        {state.criticalAlerts > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 border border-white text-[8px] font-bold text-white shadow-sm">
                                                !
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </foreignObject>
                        );
                    })}

                    {/* SOS Alert Markers */}
                    {alerts.map((alert) => {
                        if (!alert.coordinates || !alert.coordinates.latitude || !alert.coordinates.longitude) return null;

                        const { x, y } = geoToSvg(alert.coordinates.latitude, alert.coordinates.longitude);

                        // Safety check to ensure point is within map bounds (approx)
                        if (x < 0 || x > 800 || y < 0 || y > 650) return null;

                        return (
                            <foreignObject
                                key={alert.id}
                                x={x - 20}
                                y={y - 20}
                                width={40}
                                height={40}
                                className="overflow-visible pointer-events-none z-50"
                            >
                                <div
                                    className="relative w-full h-full flex items-center justify-center pointer-events-auto cursor-pointer group"
                                    onMouseEnter={() => setHoveredAlert(alert)}
                                    onMouseLeave={() => setHoveredAlert(null)}
                                >
                                    {/* Outer Radar Wave - Large & Soft */}
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></span>

                                    {/* Inner Urgent Pulse - Sharp & Fast */}
                                    <span className="absolute inline-flex h-3/4 w-3/4 rounded-full bg-red-600 opacity-75 animate-ping"></span>

                                    {/* Core Marker - Glowing */}
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white shadow-[0_0_15px_rgba(220,38,38,1)] z-10"></span>
                                </div>
                            </foreignObject>
                        );
                    })}
                </NigerianMapSVG>
            </div>

            {/* Tooltip - Matching Dashboard Card Styles */}
            {hoveredState && (
                <div
                    className="absolute z-50 pointer-events-none transition-all duration-200"
                    style={{
                        left: '50%',
                        top: '15%',
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="bg-white text-slate-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100 min-w-[240px] overflow-hidden">
                        <div className={cn("px-4 py-2 border-b text-[10px] font-bold uppercase tracking-widest flex justify-between items-center",
                            hoveredState.riskLevel === 'high' ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"
                        )}>
                            <span>{hoveredState.name} State</span>
                            <span className="opacity-60">{hoveredState.riskLevel} impact</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Displaced Population</span>
                                <span className="text-xl font-bold text-slate-900">{hoveredState.displacedCount.toLocaleString()}</span>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                    <span>Resource Coverage</span>
                                    <span className={cn(hoveredState.occupiedCapacity / hoveredState.totalCapacity > 0.8 ? "text-red-500" : "text-emerald-500")}>
                                        {hoveredState.totalCapacity > 0
                                            ? Math.round((hoveredState.occupiedCapacity / hoveredState.totalCapacity) * 100)
                                            : 0}%
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all duration-500",
                                        hoveredState.riskLevel === 'high' ? "bg-red-500" : "bg-emerald-500"
                                    )} style={{ width: `${Math.min(100, (hoveredState.occupiedCapacity / hoveredState.totalCapacity) * 100)}%` }}></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                <div>
                                    <div className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Shelters</div>
                                    <div className="text-sm font-bold text-slate-900">{hoveredState.shelterCount}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Total Capacity</div>
                                    <div className="text-sm font-bold text-slate-900">{hoveredState.totalCapacity.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Alert Tooltip */}
            {hoveredAlert && (
                <div
                    className="absolute z-50 pointer-events-none transition-all duration-200"
                    style={{
                        left: '50%',
                        bottom: '10%',
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="bg-red-600 text-white rounded-xl shadow-[0_20px_50px_rgba(220,38,38,0.3)] border border-red-500 min-w-[260px] overflow-hidden">
                        <div className="px-4 py-2 border-b border-red-500/30 bg-red-700/50 text-[10px] font-bold uppercase tracking-widest flex justify-between items-center">
                            <span>{hoveredAlert.type === 'alert' ? 'SOS SIGNAL' : 'ALERT'}</span>
                            <span className="animate-pulse">LIVE</span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <div className="text-red-100/70 text-[9px] font-bold uppercase tracking-widest mb-1">Details</div>
                                <div className="text-sm font-medium leading-tight">{hoveredAlert.description}</div>
                            </div>
                            <div className="flex justify-between items-end pt-2 border-t border-red-500/30">
                                <div>
                                    <div className="text-red-100/70 text-[9px] font-bold uppercase tracking-widest mb-0.5">Location</div>
                                    <div className="text-xs font-mono">{hoveredAlert.location}</div>
                                </div>
                                <div className="text-[10px] bg-red-800/50 px-2 py-1 rounded text-red-100">
                                    {hoveredAlert.time}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
