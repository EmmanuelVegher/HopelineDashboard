import React, { useState } from 'react';
import { NigerianMapSVG } from '@/components/NigerianMapSVG';
import { StateData, ActivityItem } from '@/hooks/useSituationData';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { geoToSvg } from '@/lib/map-utils';
import { Search, Info, Maximize2, Minimize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface DisplacementMapProps {
    data: StateData[];
    alerts?: ActivityItem[];
    onStateSelect?: (state: StateData) => void;
    isSuperAdmin?: boolean;
}

export const DisplacementMap: React.FC<DisplacementMapProps> = ({ data, alerts = [], onStateSelect, isSuperAdmin }) => {
    const [hoveredState, setHoveredState] = useState<StateData | null>(null);
    const [hoveredAlert, setHoveredAlert] = useState<ActivityItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const mapRef = React.useRef<HTMLDivElement>(null);

    const toggleFullScreen = () => {
        if (!mapRef.current) return;
        if (!document.fullscreenElement) {
            mapRef.current.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullScreen(true);
        } else {
            document.exitFullscreen();
            setIsFullScreen(false);
        }
    };

    const filteredData = data.map(s => ({
        ...s,
        isHighlighted: searchQuery && s.name.toLowerCase().includes(searchQuery.toLowerCase())
    }));

    return (
        <Card ref={mapRef} className="relative w-full h-[650px] bg-white border border-slate-100 shadow-none overflow-hidden flex items-center justify-center p-0 rounded-xl group/map">

            {/* Very Subtle Grid - Light Mode */}
            <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }}
            />

            {/* Map Controls: Filter Box & Fullscreen */}
            <div className="absolute top-6 left-6 z-50 flex items-center gap-4">
                {isSuperAdmin && (
                    <div className="w-64 group/filter">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover/filter:text-blue-500 transition-colors" />
                            <Input
                                placeholder="Filter states..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white/90 backdrop-blur-sm border-slate-200 shadow-lg rounded-full h-10 transition-all focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                )}
                <div className="bg-white/90 backdrop-blur-sm border-slate-200 shadow-lg rounded-full h-10 px-4 flex items-center gap-2 hover:bg-slate-50 cursor-pointer"
                    onClick={toggleFullScreen}
                >
                    {isFullScreen ? (
                        <Minimize2 className="w-4 h-4 text-blue-600" />
                    ) : (
                        <Maximize2 className="w-4 h-4 text-blue-600" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider">{isFullScreen ? 'Exit Fullscreen' : 'Fullscreen Map'}</span>
                </div>
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-6 right-6 z-50 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl min-w-[180px]">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Map Legend</span>
                </div>
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FF4D4D] border border-white" />
                            <div className="absolute inset-0 w-full h-full rounded-full bg-[#FF4D4D] opacity-40 animate-pulse scale-[2.2]" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600">Active SOS Alert</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-white" />
                        <span className="text-[11px] font-semibold text-slate-600">Stable Region</span>
                    </div>
                    <div className="flex items-center gap-2.5 pt-1 border-t border-slate-100">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">00% (0)</span>
                            <span className="text-[10px] font-medium text-slate-400 leading-none">Occupancy Metric</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10 w-full h-full transform transition-all duration-700 ease-out">
                <NigerianMapSVG
                    fill="#1F4D36" // Dark Forest Green for professional "control tower" feel
                    stroke="#FFFFFF" // Crisp white borders
                    strokeWidth={1}
                    className="w-full h-full"
                >
                    {filteredData.map((state) => {
                        const hasSOS = state.criticalAlerts > 0;
                        const occupancyPercent = state.totalCapacity > 0
                            ? Math.round((state.occupiedCapacity / state.totalCapacity) * 100)
                            : 0;

                        // Precise geographical markers
                        const iconColor = hasSOS ? '#FF4D4D' : '#60A5FA'; // Vibrant red/blue for dark background
                        const pulseColor = hasSOS ? 'rgba(255, 77, 77, 0.4)' : 'rgba(96, 165, 250, 0.4)';

                        return (
                            <foreignObject
                                key={state.name}
                                x={state.coordinates.x - 50}
                                y={state.coordinates.y - 20}
                                width={100}
                                height={80}
                                className="overflow-visible pointer-events-none"
                            >
                                <div
                                    className="relative w-full h-full flex flex-col items-center justify-start pointer-events-auto cursor-pointer group"
                                    onMouseEnter={() => setHoveredState(state)}
                                    onMouseLeave={() => setHoveredState(null)}
                                    onClick={() => onStateSelect?.(state)}
                                >
                                    {/* Precise Icon at Centroid - ONLY FOR SOS STATES */}
                                    {hasSOS && (
                                        <div className="relative mb-1">
                                            <div
                                                className={cn(
                                                    "w-3 h-3 rounded-full border-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-opacity duration-300 group-hover:opacity-100",
                                                    !hasSOS && "opacity-90"
                                                )}
                                                style={{ backgroundColor: iconColor }}
                                            />
                                            {/* Pulse Effect */}
                                            <div
                                                className="absolute inset-0 w-full h-full rounded-full animate-pulse"
                                                style={{ backgroundColor: pulseColor, transform: 'scale(2.5)', opacity: 0.3 }}
                                            />
                                        </div>
                                    )}

                                    {/* Topographic Labeling - Optimized for Dark Theme */}
                                    <div className="flex flex-col items-center text-center">
                                        <span
                                            className={cn(
                                                "text-[10px] uppercase tracking-wider leading-none transition-all duration-300",
                                                state.isHighlighted ? "font-black text-yellow-400 scale-125" :
                                                    hasSOS ? "font-black text-white" : "font-semibold text-slate-300/80 group-hover:text-white"
                                            )}
                                            style={{ textShadow: (hasSOS || state.isHighlighted) ? '1px 1px 2px rgba(0,0,0,0.8)' : '0.5px 0.5px 1px rgba(0,0,0,0.5)' }}
                                        >
                                            {state.name}
                                        </span>
                                        {/* Data Sub-labels - ONLY FOR SOS STATES, HIGHLIGHTED STATES, OR ON HOVER */}
                                        {(hasSOS || state.isHighlighted || hoveredState?.name === state.name) && (
                                            <div className="flex items-center gap-1 mt-0.5 animate-in fade-in zoom-in duration-200">
                                                <span className="text-[8px] font-black text-blue-300">{occupancyPercent}%</span>
                                                <span className="text-[8px] font-bold text-slate-300">({state.occupiedCapacity})</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </foreignObject>
                        );
                    })}

                    {/* SOS Alert Markers - Geographically Precise */}
                    {alerts.map((alert) => {
                        if (!alert.coordinates || !alert.coordinates.latitude || !alert.coordinates.longitude) return null;

                        // Only show active alerts on the map as pulsing red dots
                        if (alert.status !== 'Active' && alert.status !== 'transmitting') return null;

                        const { x, y } = geoToSvg(alert.coordinates.latitude, alert.coordinates.longitude);

                        if (x < 0 || x > 800 || y < 0 || y > 650) return null;

                        return (
                            <foreignObject
                                key={alert.id}
                                x={x - 15}
                                y={y - 15}
                                width={30}
                                height={30}
                                className="overflow-visible pointer-events-none z-50"
                            >
                                <div
                                    className="relative w-full h-full flex items-center justify-center pointer-events-auto cursor-pointer"
                                    onMouseEnter={() => setHoveredAlert(alert)}
                                    onMouseLeave={() => setHoveredAlert(null)}
                                >
                                    {/* Urgent Radar Wave */}
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF4D4D] opacity-30 animate-[ping_1.2s_cubic-bezier(0,0,0.2,1)_infinite]"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF4D4D] border-2 border-white shadow-[0_0_15px_rgba(255,77,77,1)] z-10"></span>
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
