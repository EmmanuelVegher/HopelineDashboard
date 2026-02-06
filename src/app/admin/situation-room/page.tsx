"use client";

import { useSituationData, StateData, ActivityItem } from '@/hooks/useSituationData';
import { SituationWidgets } from '@/components/situation-room/dashboard-widgets';
import { DisplacementMap } from '@/components/situation-room/displacement-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Map as MapIcon, Shield, Radio, Siren, CheckCircle2, Users as UsersIcon, Home as HomeIcon, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function SituationRoomPage() {
    const { kpis, stateData, recentActivity, loading } = useSituationData();
    const [selectedState, setSelectedState] = useState<StateData | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh] flex-col gap-4 bg-white rounded-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-slate-500 font-medium text-sm">Loading Situation Room...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 bg-slate-50 min-h-screen p-6 pb-20">
            {/* Header - Matching existing Dashboard */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#004d40] tracking-tight">Situation Room Dashboard</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <p className="text-sm text-slate-500 font-medium">
                            CARITAS Nigeria | CITI Foundation Project
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end mr-4">
                        <p className="text-sm font-bold text-slate-700">
                            {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 px-4 shadow-sm">
                        <RefreshCw className="h-4 w-4" />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* KPI Widgets */}
            <SituationWidgets kpis={kpis} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Central Interactive Map */}
                <div className="xl:col-span-2 space-y-4">
                    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col rounded-xl">
                        <CardHeader className="bg-white border-b border-slate-100 pb-4">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <MapIcon className="h-5 w-5 text-blue-600" />
                                        <CardTitle className="text-lg text-slate-900 font-bold">Regional Impact Assessment</CardTitle>
                                    </div>
                                    <CardDescription className="text-slate-500 text-xs">Real-time heat coverage of all 37 states</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100 font-semibold px-3">Critical</Badge>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 font-semibold px-3">Warning</Badge>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-semibold px-3">Stable</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 relative min-h-[600px] bg-white">
                            <DisplacementMap data={stateData} onStateSelect={setSelectedState} />
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Feed / State Detail */}
                <div className="xl:col-span-1">
                    <Card className="h-full flex flex-col border-slate-200 shadow-sm bg-white rounded-xl">
                        <CardHeader className={cn("border-b border-slate-100 pb-4", selectedState ? "bg-slate-50/50" : "bg-white")}>
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 uppercase tracking-tight">
                                {selectedState ? (
                                    <>
                                        <button onClick={() => setSelectedState(null)} className="hover:bg-slate-200 rounded-full p-1 mr-1 transition-colors">
                                            ←
                                        </button>
                                        {selectedState.name} Details
                                    </>
                                ) : (
                                    <>
                                        <Activity className="h-4 w-4 text-blue-600" />
                                        <span>Emergency SOS Alerts</span>
                                    </>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden relative">
                            <ScrollArea className="h-[600px]">
                                {selectedState ? (
                                    // State Detailed View
                                    <div className="p-6 space-y-8 animate-in slide-in-from-right duration-300">
                                        {/* State Header Stats */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                                                <div className="text-3xl font-bold text-slate-900">{selectedState.shelterCount}</div>
                                                <div className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider text-[10px]">Active Shelters</div>
                                            </div>
                                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                                                <div className="text-3xl font-bold text-slate-900">{selectedState.displacedCount.toLocaleString()}</div>
                                                <div className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider text-[10px]">Displaced Persons</div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between text-sm items-end font-bold text-slate-900">
                                                <span className="text-slate-500 uppercase text-[10px] tracking-widest font-bold">Resource Usage</span>
                                                <span className={cn("font-bold text-sm",
                                                    selectedState.occupiedCapacity / selectedState.totalCapacity > 0.8 ? "text-red-600" : "text-emerald-600"
                                                )}>
                                                    {selectedState.totalCapacity > 0
                                                        ? Math.round((selectedState.occupiedCapacity / selectedState.totalCapacity) * 100)
                                                        : 0}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={(selectedState.occupiedCapacity / selectedState.totalCapacity) * 100}
                                                className={cn("h-2 bg-slate-100 rounded-full", selectedState.riskLevel === 'high' ? "[&>div]:bg-red-500" : "[&>div]:bg-emerald-500")}
                                            />
                                            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                <span>{selectedState.occupiedCapacity.toLocaleString()} Occupied</span>
                                                <span>{selectedState.totalCapacity.toLocaleString()} Total</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Recent Regional Events</h4>
                                            {recentActivity.filter(a => a.location.includes(selectedState.name)).length > 0 ? (
                                                <div className="space-y-4 pt-2">
                                                    {recentActivity.filter(a => a.location.includes(selectedState.name)).map(item => (
                                                        <ActivityFeedItem key={item.id} item={item} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 text-slate-400 italic text-sm">No recent activity logs for this region.</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // Default Live Feed
                                    <div className="divide-y divide-slate-100">
                                        {recentActivity.length > 0 ? (
                                            recentActivity.map((item) => (
                                                <ActivityFeedItem key={item.id} item={item} />
                                            ))
                                        ) : (
                                            <div className="p-12 text-center space-y-4">
                                                <div className="inline-block p-4 rounded-full bg-slate-50 text-slate-300">
                                                    <CheckCircle2 className="h-8 w-8" />
                                                </div>
                                                <p className="text-slate-500 text-sm font-medium">All national sectors reporting stable.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

const ActivityFeedItem = ({ item }: { item: ActivityItem }) => (
    <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-transparent hover:border-blue-600 group">
        <div className="flex gap-4">
            <div className="mt-1 shrink-0">
                {item.severity === 'critical' ? (
                    <div className="p-2 bg-red-50 text-red-600 rounded-full group-hover:bg-red-100 transition-colors">
                        <Siren className="h-4 w-4" />
                    </div>
                ) : item.type === 'displacement' ? (
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-100 transition-colors">
                        <UsersIcon className="h-4 w-4" />
                    </div>
                ) : (
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full group-hover:bg-emerald-100 transition-colors">
                        <HomeIcon className="h-4 w-4" />
                    </div>
                )}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                    <h4 className={cn("text-xs font-bold truncate tracking-tight uppercase",
                        item.severity === 'critical' ? "text-red-700" : "text-slate-900"
                    )}>
                        {item.title}
                    </h4>
                    <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                        {item.time}
                    </span>
                </div>
                <p className="text-xs text-slate-500 leading-tight font-medium line-clamp-2">
                    {item.description}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                    <MapIcon className="h-3 w-3 text-slate-400" />
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">
                        {item.location}
                    </p>
                </div>
            </div>
        </div>
    </div>
);
