"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowDown, ArrowUp, Clock, Users, Shield, RefreshCw, MapPin, User, Calendar, Car, Edit, FileText, BarChart3, Activity, AlertCircle, CheckCircle, Siren, HomeIcon, Play, Pause, SkipBack, SkipForward, RotateCcw, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { doc, updateDoc, writeBatch, query, collection, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type SosAlert } from "@/ai/schemas/sos";
import { type Driver } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertsOverTimeChart, ShelterOccupancyChart, EmergencyTypesChart, DisplacedPersonsStatusChart } from "./charts";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { formatTimestamp } from "@/lib/utils";
import DriverMap from "@/components/driver-map";
import { useSituationData, type StateData } from "@/hooks/useSituationData";
import { DisplacementMap } from "@/components/situation-room/displacement-map";
import { ActivityItem } from "@/hooks/useSituationData";
import { useTranslation } from "react-i18next";


const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Active': return 'destructive';
        case 'Responding': return 'default';
        case 'Resolved': return 'secondary';
        case 'False Alarm': return 'secondary';
        case 'Investigating': return 'secondary'; // Using secondary for now, could be customized
        default: return 'outline';
    }
};

const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
        case 'High Priority': return 'destructive';
        case 'Medium Priority': return 'default';
        default: return 'outline';
    }
};

const getShelterStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Operational': return 'secondary';
        case 'Full': return 'destructive';
        case 'Emergency Only': return 'default';
        default: return 'outline';
    }
}

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
                <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
                <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
                <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            </div>
            <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-80 w-full" /></CardContent></Card>
        </div>
    )
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
                        <Users className="h-4 w-4" />
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
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">
                        {item.location}
                    </p>
                </div>
            </div>
        </div>
    </div>
);

function RegionalDeepDiveModal({ state, isOpen, onClose, recentActivity }: { state: StateData | null, isOpen: boolean, onClose: () => void, recentActivity: ActivityItem[] }) {
    const { t } = useTranslation();
    if (!state) return null;

    const occupancyRate = state.totalCapacity > 0 ? Math.round((state.occupiedCapacity / state.totalCapacity) * 100) : 0;
    const regionalActivity = recentActivity.filter(a => a.location.includes(state.name));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={cn("w-3 h-3 rounded-full", state.riskLevel === 'high' ? "bg-red-600" : "bg-blue-600")} />
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter tabular-nums">
                            {state.name} {t("admin.dashboard.regionalDeepDive")}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                        Tactical metrics and field status for {state.name} region
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
                    {/* Key Metrics */}
                    <div className="md:col-span-1 space-y-4">
                        <Card className="bg-slate-50 border-slate-200 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("admin.dashboard.displacedPopulation")}</p>
                                <p className="text-3xl font-black text-slate-900 tabular-nums">{state.displacedCount.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 border-slate-200 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("admin.dashboard.activeShelters")}</p>
                                <p className="text-3xl font-black text-slate-900 tabular-nums">{state.shelterCount}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 border-slate-200 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("admin.dashboard.sosAlerts")}</p>
                                <p className={cn("text-3xl font-black tabular-nums", state.criticalAlerts > 0 ? "text-red-600" : "text-slate-900")}>
                                    {state.criticalAlerts}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Occupancy Chart/Progress */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="space-y-4 bg-slate-900 p-6 rounded-xl text-white">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("admin.dashboard.capacityUtilization")}</h4>
                                    <p className="text-4xl font-black tracking-tighter">{occupancyRate}%</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{state.occupiedCapacity.toLocaleString()} / {state.totalCapacity.toLocaleString()}</p>
                                    <p className="text-[9px] font-bold text-blue-400">BED SPACES OCCUPIED</p>
                                </div>
                            </div>
                            <Progress
                                value={occupancyRate}
                                className="h-3 bg-white/10 [&>div]:bg-blue-500"
                            />
                            <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] pt-2">
                                <span>Zero Occupancy</span>
                                <span>Critical Limit</span>
                            </div>
                        </div>

                        {/* Regional Feed */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                <Activity className="h-3 w-3" /> {t("admin.dashboard.regionalSosFeed")}
                            </h4>
                            <ScrollArea className="h-[250px] pr-4">
                                {regionalActivity.length > 0 ? (
                                    <div className="space-y-2">
                                        {regionalActivity.map(item => (
                                            <ActivityFeedItem key={item.id} item={item} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <CheckCircle className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-xs italic">No critical incidents reported in this region</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}


function SosAlertOverlay({ alerts, onClear }: { alerts: SosAlert[], onClear: (id: string) => void }) {
    const { t } = useTranslation();
    if (!alerts || alerts.length === 0) return null;

    // Sort alerts by timestamp to ensure consistent ordering (newest first)
    const sortedAlerts = [...alerts].sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || a.timestamp?.seconds * 1000 || 0;
        const timeB = b.timestamp?.toMillis?.() || b.timestamp?.seconds * 1000 || 0;
        return timeB - timeA;
    });

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center p-4">
            <div className="flex flex-wrap items-center justify-center gap-8 max-w-[95vw] max-h-[90vh] overflow-y-auto p-12 pointer-events-auto">
                {sortedAlerts.map((alert, index) => {
                    const isNewest = index === 0;
                    return (
                        <Card
                            key={alert.id}
                            className={cn(
                                "w-full max-w-sm border-4 bg-white transition-all duration-500",
                                isNewest
                                    ? "border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.7)] scale-105 z-10 animate-in zoom-in-75 slide-in-from-bottom-10"
                                    : "border-red-400 shadow-xl opacity-90 scale-95 grayscale-[0.2]",
                                "hover:scale-100 hover:grayscale-0 hover:opacity-100 hover:z-20 cursor-default"
                            )}
                            style={{
                                transform: `rotate(${index % 2 === 0 ? '-0.5deg' : '0.5deg'}) translateY(${index * 2}px)`
                            }}
                        >
                            <CardHeader className={cn("p-4 transition-colors", isNewest ? "bg-red-600" : "bg-red-500")}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Siren className={cn("h-6 w-6", isNewest && "animate-pulse")} />
                                        <CardTitle className="text-xl font-black uppercase tracking-tighter text-white">Emergency SOS</CardTitle>
                                    </div>
                                    <div className="flex gap-2">
                                        {isNewest && (
                                            <Badge variant="secondary" className="bg-white text-red-600 animate-bounce font-black text-[10px]">NEW ALERT</Badge>
                                        )}
                                        <Badge variant="outline" className="text-white border-white/50 bg-red-700/50 font-bold">CRITICAL</Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                        <Activity className="h-3 w-3" />
                                        <span>{t("admin.dashboard.incidentProfile")}</span>
                                    </div>
                                    <p className="text-2xl font-black text-slate-900 leading-none tracking-tight">{alert.emergencyType}</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                        <MapPin className="h-3 w-3" />
                                        <span>{t("admin.dashboard.tacticalLocation")}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 leading-snug line-clamp-2">{alert.location.address || 'Coordinates Only'}</p>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${alert.location.latitude},${alert.location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline text-[10px] flex items-center gap-1 mt-1 font-black uppercase tracking-widest"
                                    >
                                        {t("admin.dashboard.viewOnGoogleMaps")}
                                    </a>
                                </div>

                                {alert.additionalInfo && (
                                    <div className="p-3 bg-slate-50 border-l-4 border-slate-900 text-slate-900 rounded-r-md">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1 opacity-40">Field Intelligence</p>
                                        <p className="text-xs font-bold leading-relaxed italic">"{alert.additionalInfo}"</p>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <Button
                                        className={cn(
                                            "w-full font-black uppercase tracking-[0.15em] text-xs h-12 shadow-lg transition-all",
                                            isNewest ? "bg-red-600 hover:bg-red-700 text-white" : "bg-slate-900 hover:bg-black text-white"
                                        )}
                                        onClick={() => onClear(alert.id)}
                                    >
                                        {t("admin.dashboard.acknowledgeAndDeploy")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            {/* Darken background slightly */}
            <div className="fixed inset-0 bg-red-950/60 -z-10 animate-in fade-in duration-700 backdrop-blur-md" />
        </div>
    );
}

export default function AdminDashboardPage() {
    const { t } = useTranslation();
    const {
        alerts, persons, shelters, drivers, loading, permissionError,
        activeAlerts, locationHistory,
        clearAlert, fetchData, fetchLocationHistoryRange, isAudioUnlocked, unlockAudio, adminProfile
    } = useAdminData();
    const { toast } = useToast();
    const [selectedAlert, setSelectedAlert] = useState<SosAlert | null>(null);
    const [assignAlert, setAssignAlert] = useState<SosAlert | null>(null);
    const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
    const [driversLoading, setDriversLoading] = useState(false);
    const [assigningDriver, setAssigningDriver] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('situation-map');
    const [selectedDriver, setSelectedDriver] = useState<Driver | undefined>(undefined);
    const [trackedDriverId, setTrackedDriverId] = useState<string | undefined>(undefined);

    // Simulation / Playback State
    const [isPlaybackMode, setIsPlaybackMode] = useState(false);
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setHours(d.getHours() - 3); // Default to last 3 hours
        return d.toISOString().slice(0, 16);
    });
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 16));
    const [playbackData, setPlaybackData] = useState<any[]>([]);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(2);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

    // Robust role and state detection
    const role = adminProfile?.role?.toLowerCase() || '';
    const filterState = (role === 'admin' || role === 'support agent') ? adminProfile?.state : undefined;

    const { stateData, recentActivity, allAlerts, loading: _mapsLoading } = useSituationData(filterState);
    const [selectedState, setSelectedState] = useState<StateData | null>(null);
    const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            setPlaybackIndex(prev => {
                if (prev >= playbackData.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 1000 / playbackSpeed);

        return () => clearInterval(interval);
    }, [isPlaying, playbackData.length, playbackSpeed]);

    const handleFetchHistory = async () => {
        if (!selectedDriver) {
            toast({ title: "No Driver Selected", description: "Select a driver to fetch history for simulation.", variant: "destructive" });
            return;
        }

        setIsFetchingHistory(true);
        const start = new Date(startDate);
        const end = new Date(endDate);

        const history = await fetchLocationHistoryRange(selectedDriver.id, start, end);
        setPlaybackData(history);
        setPlaybackIndex(0);
        setIsPlaybackMode(true);
        setIsPlaying(true); // Automatically start playback
        setIsFetchingHistory(false);

        if (history.length === 0) {
            toast({ title: "No Data Found", description: "No location records found for the selected time range." });
        } else {
            toast({ title: "History Loaded", description: `Found ${history.length} data points for simulation.` });
        }
    };

    const handleSimulateTaskRoute = async (alert: SosAlert) => {
        if (!alert.assignedTeam?.driverId) {
            toast({ title: "Incomplete Data", description: "This task does not have an assigned driver.", variant: "destructive" });
            return;
        }

        const driver = drivers?.find(d => d.id === alert.assignedTeam!.driverId);
        if (!driver) {
            toast({ title: "Driver Not Found", description: "The assigned driver is no longer in the system.", variant: "destructive" });
            return;
        }

        setSelectedDriver(driver);
        setActiveTab("driver-tracking");

        // Convert mission timing with multiple fallbacks
        const getMissionStart = (a: any) => {
            if (a.assignedAt) {
                if (typeof a.assignedAt === 'object' && 'toDate' in a.assignedAt) return a.assignedAt.toDate();
                if (a.assignedAt.seconds) return new Date(a.assignedAt.seconds * 1000);
                return new Date(a.assignedAt);
            }
            if (a.trackingData?.startTime) return new Date(a.trackingData.startTime);
            if (a.timestamp) {
                if (typeof a.timestamp === 'object' && 'toDate' in a.timestamp) return a.timestamp.toDate();
                if (a.timestamp.seconds) return new Date(a.timestamp.seconds * 1000);
                return new Date(a.timestamp);
            }
            return new Date();
        };

        const getMissionEnd = (a: any) => {
            if (a.resolvedAt) {
                if (typeof a.resolvedAt === 'object' && 'toDate' in a.resolvedAt) return a.resolvedAt.toDate();
                if (a.resolvedAt.seconds) return new Date(a.resolvedAt.seconds * 1000);
                return new Date(a.resolvedAt);
            }
            if (a.trackingData?.endTime) return new Date(a.trackingData.endTime);
            if (a.lastUpdated) {
                if (typeof a.lastUpdated === 'object' && 'toDate' in a.lastUpdated) return a.lastUpdated.toDate();
                if (a.lastUpdated.seconds) return new Date(a.lastUpdated.seconds * 1000);
                return new Date(a.lastUpdated);
            }
            return new Date();
        };

        const start = getMissionStart(alert);
        const end = getMissionEnd(alert);

        setStartDate(start.toISOString().slice(0, 16));
        setEndDate(end.toISOString().slice(0, 16));

        // Close current dialog
        setSelectedAlert(null);

        setIsFetchingHistory(true);

        // Prioritize trackingData from the SOS alert itself
        let history = [];
        if (alert.trackingData?.coordinates && Array.isArray(alert.trackingData.coordinates) && alert.trackingData.coordinates.length > 0) {
            console.log(`[Admin] Using session-specific trackingData for playback: ${alert.trackingData.coordinates.length} points`);
            history = alert.trackingData.coordinates
                .filter((p: any) => p && (
                    (typeof p.latitude === 'number' && typeof p.longitude === 'number' && p.latitude !== 0 && p.longitude !== 0) ||
                    (typeof p.lat === 'number' && typeof p.lng === 'number' && p.lat !== 0 && p.lng !== 0)
                ))
                .map((p: any) => ({
                    latitude: p.latitude ?? p.lat,
                    longitude: p.longitude ?? p.lng,
                    timestamp: p.timestamp || start.getTime(),
                    sortTime: p.timestamp || start.getTime()
                }));
        } else {
            console.log(`[Admin] No trackingData found in SOS, falling back to locationHistory query`);
            history = await fetchLocationHistoryRange(driver.id, start, end);
        }

        // Prepend the actual SOS location to ensure the trail starts at the "fetch geo position"
        const fullTrajectory = [
            {
                latitude: alert.location.latitude,
                longitude: alert.location.longitude,
                timestamp: start.getTime(),
                sortTime: start.getTime()
            },
            ...history
        ];

        setPlaybackData(fullTrajectory);
        setPlaybackIndex(0);
        setIsPlaybackMode(true);
        setIsPlaying(true);
        setIsFetchingHistory(false);

        if (history.length === 0) {
            toast({ title: t("admin.dashboard.noRouteData"), description: "No signals recorded for this driver during the mission window." });
        } else {
            toast({ title: t("admin.dashboard.tacticalReplayLoaded"), description: `Simulating mission route with ${history.length} signals.` });
        }
    };

    const handleTogglePlayback = () => {
        if (playbackData.length === 0) {
            handleFetchHistory();
        } else {
            setIsPlaying(!isPlaying);
        }
    };

    useEffect(() => {
        setIsPlaybackMode(false);
        setPlaybackData([]);
        setPlaybackIndex(0);
        setIsPlaying(false);
    }, [selectedDriver?.id]);

    if (loading || !alerts || !persons || !shelters || !drivers) {
        return <PageSkeleton />;
    }

    const recentAlerts = alerts.slice(0, 5);

    const dashboardStats = (() => {
        if (!shelters || shelters.length === 0) {
            return { totalOccupied: 0, totalCapacity: 0, occupancyPercentage: 0 };
        }
        const totalCapacity = shelters.reduce((acc, s) => acc + s.capacity, 0);
        const totalOccupied = shelters.reduce((acc, s) => acc + (s.capacity - s.availableCapacity), 0);
        const occupancyPercentage = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

        return {
            totalOccupied,
            totalCapacity,
            occupancyPercentage
        }
    })();


    const handleUpdateStatus = async (alertId: string, status: 'Responding' | 'Resolved' | 'Investigating' | 'False Alarm') => {
        const alertRef = doc(db, "sosAlerts", alertId);
        try {
            const updateData: any = { status: status };
            if (status === 'Resolved') {
                updateData.resolvedAt = new Date(); // Using local date for immediate feedback, though serverTimestamp is better
                // Actually, for consistency with other parts of the app:
                const { serverTimestamp } = await import('firebase/firestore');
                updateData.resolvedAt = serverTimestamp();
            }
            await updateDoc(alertRef, updateData);
            fetchData(); // Refresh all data
            toast({ title: "Success", description: `Alert status updated to ${status}.` });
        } catch (error) {
            console.error("Error updating alert status: ", error);
            toast({ title: "Error", description: "Could not update alert status.", variant: "destructive" });
        }
    };

    const handleOpenAssignDialog = async (alert: SosAlert) => {
        setAssignAlert(alert);
        setDriversLoading(true);
        try {
            const driversQuery = query(collection(db, "users"), where("role", "in", ["driver", "pilot", "responder", "rider"]));
            const querySnapshot = await getDocs(driversQuery);
            const drivers = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
                    vehicle: data.vehicle || '',
                    phone: data.phone || data.mobile || '',
                    location: data.location || '',
                    status: data.status || 'Available',
                    task: data.task || '',
                    lastUpdate: data.lastUpdate || '',
                    latitude: data.latitude || 0,
                    longitude: data.longitude || 0,
                    role: data.role,
                    email: data.email || 'driver@hopeline.org' // Placeholder for type safety
                } as Driver;
            });
            setAvailableDrivers(drivers);
        } catch (error) {
            console.error("Error fetching available drivers:", error);
            toast({ title: "Error", description: "Could not fetch available drivers.", variant: "destructive" });
        } finally {
            setDriversLoading(false);
        }
    }

    const handleAssignDriver = async (driver: Driver) => {
        if (!assignAlert) return;
        setAssigningDriver(driver.id);

        const batch = writeBatch(db);

        const alertRef = doc(db, "sosAlerts", assignAlert.id);
        const { serverTimestamp } = await import('firebase/firestore');
        batch.update(alertRef, {
            status: "Responding",
            assignedAt: serverTimestamp(),
            assignedTeam: {
                driverId: driver.id,
                driverName: driver.name,
                vehicle: driver.vehicle,
            }
        });

        const driverRef = doc(db, "users", driver.id);
        batch.update(driverRef, {
            status: "En Route",
            task: `Respond to ${assignAlert.emergencyType} at ${assignAlert.location.address || 'specified location'}`
        });

        try {
            await batch.commit();
            toast({ title: "Success", description: `${driver.name} has been dispatched.` });
            fetchData(); // Refresh all data
            setAssignAlert(null);
        } catch (error) {
            console.error("Error assigning driver:", error);
            toast({ title: "Error", description: "Could not assign driver.", variant: "destructive" });
        } finally {
            setAssigningDriver(null);
        }
    }

    return (
        <>
            <Dialog open={!!selectedAlert} onOpenChange={(isOpen) => !isOpen && setSelectedAlert(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selectedAlert && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                    <AlertTriangle className="text-red-500 h-5 w-5 sm:h-6 sm:w-6" />
                                    SOS Alert Details
                                </DialogTitle>
                                <DialogDescription className="text-sm sm:text-base">
                                    ID: {selectedAlert.id}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4 text-sm sm:text-base">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="font-medium">{selectedAlert.emergencyType}</Badge>
                                    <Badge variant={getPriorityBadgeVariant("High Priority")}>High Priority</Badge>
                                    <Badge variant={getStatusBadgeVariant(selectedAlert.status)}>{selectedAlert.status}</Badge>
                                </div>
                                <div className="grid gap-4">
                                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                        <User className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-slate-500 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-slate-800">User</p>
                                            <p className="text-slate-600">{selectedAlert.userEmail || 'Anonymous'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-slate-500 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-800">Location</p>
                                            <p className="text-slate-600">{selectedAlert.location.address || 'Address not specified'}</p>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${selectedAlert.location.latitude},${selectedAlert.location.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline text-xs sm:text-sm inline-block mt-1"
                                            >
                                                View on Google Maps →
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-slate-500 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-slate-800">Time</p>
                                            <p className="text-slate-600">{formatTimestamp(selectedAlert.timestamp)}</p>
                                        </div>
                                    </div>
                                    {selectedAlert.additionalInfo && (
                                        <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-yellow-600 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium text-yellow-800">Additional Info</p>
                                                <p className="text-yellow-700 p-2 bg-yellow-100 rounded-md mt-1 text-sm sm:text-base">{selectedAlert.additionalInfo}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedAlert.assignedTeam && (
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <Car className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-blue-600 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium text-blue-800">Assigned Team</p>
                                                            <p className="text-blue-700">{selectedAlert.assignedTeam.driverName} ({selectedAlert.assignedTeam.vehicle})</p>
                                                        </div>
                                                        {(selectedAlert as any).assignedAt && (
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Assigned At</p>
                                                                <p className="text-xs font-bold text-blue-600">{formatTimestamp((selectedAlert as any).assignedAt)}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleSimulateTaskRoute(selectedAlert)}
                                                className="w-full bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-[10px] h-11 shadow-md border-t-2 border-slate-700"
                                            >
                                                <Activity className="h-4 w-4 mr-2 text-blue-400" /> {t("admin.dashboard.missionSimulation")}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!assignAlert} onOpenChange={() => setAssignAlert(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg sm:text-xl">Assign Dispatch Team</DialogTitle>
                        <DialogDescription className="text-sm sm:text-base">Select an available driver to respond to this SOS alert.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[60vh] overflow-y-auto">
                        {driversLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        ) : availableDrivers.length > 0 ? (
                            <div className="space-y-3">
                                {availableDrivers.map(driver => (
                                    <Card key={driver.id} className="border-0 shadow-sm">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded-lg">
                                                    <User className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800">{driver.name}</p>
                                                    <p className="text-sm text-slate-600">{driver.vehicle}</p>
                                                </div>
                                            </div>
                                            <Button size="sm" onClick={() => handleAssignDriver(driver)} disabled={!!assigningDriver} className="ml-3">
                                                {assigningDriver === driver.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Assign'
                                                )}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-500">No drivers are currently available.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <SosAlertOverlay alerts={activeAlerts || []} onClear={clearAlert} />

            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-emerald-700 bg-clip-text text-transparent">
                                {t("admin.dashboard.title")}
                            </h1>
                            <p className="text-sm sm:text-base text-slate-600 flex items-center gap-2 mt-2">
                                <Shield className="h-4 w-4 text-blue-500" />
                                {t("admin.dashboard.projectInfo")}
                            </p>
                        </div>
                        {/* Tactical Digital Clock Segment */}
                        <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-slate-200">
                            <div className="flex flex-col items-end">
                                <span className="text-2xl font-mono font-black text-slate-800 tracking-tighter tabular-nums">
                                    {currentTime ? currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "00:00:00"}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">UTC+1</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">
                                    {currentTime ? currentTime.toLocaleDateString('en-GB', { weekday: 'long' }) : "---"}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                    {currentTime ? currentTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : "-- --- ----"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Live System Active</span>
                        </div>

                        {/* Audio Toggle/Unlock */}
                        <Button
                            variant={isAudioUnlocked ? "outline" : "destructive"}
                            size="sm"
                            onClick={unlockAudio}
                            className={cn(
                                "font-black uppercase tracking-widest text-[10px] h-10 px-4 transition-all duration-300",
                                isAudioUnlocked
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "bg-red-600 hover:bg-red-700 text-white shadow-lg animate-bounce"
                            )}
                        >
                            <Siren className={cn("mr-2 h-4 w-4", !isAudioUnlocked && "animate-pulse")} />
                            {isAudioUnlocked ? "Alarm Audio Active" : "Enable Alarm Audio"}
                        </Button>

                        <Button
                            onClick={fetchData}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 h-10"
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                            Refresh Data
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm font-semibold text-red-800">Active Alerts</CardTitle>
                            <div className="bg-red-100 p-2 rounded-lg">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl sm:text-3xl font-bold text-red-800">{alerts.filter(a => a.status === 'Active').length}</div>
                            <p className="text-xs text-red-600 flex items-center mt-1">
                                <ArrowUp className="h-3 w-3 mr-1" />
                                from last hour
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm font-semibold text-blue-800">People Assisted</CardTitle>
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Users className="h-4 w-4 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl sm:text-3xl font-bold text-blue-800">{dashboardStats.totalOccupied.toLocaleString()}</div>
                            <p className="text-xs text-blue-600 mt-1">
                                Total individuals in shelters
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm font-semibold text-green-800">Shelter Occupancy</CardTitle>
                            <div className="bg-green-100 p-2 rounded-lg">
                                <Shield className="h-4 w-4 text-green-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl sm:text-3xl font-bold text-green-800">{dashboardStats.occupancyPercentage}%</div>
                            <p className="text-xs text-green-600 mt-1">{dashboardStats.totalOccupied.toLocaleString()}/{dashboardStats.totalCapacity.toLocaleString()} capacity</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm font-semibold text-purple-800">Avg Response Time</CardTitle>
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <Clock className="h-4 w-4 text-purple-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl sm:text-3xl font-bold text-purple-800">12.5 min</div>
                            <p className="text-xs text-purple-600 flex items-center mt-1">
                                <ArrowDown className="h-3 w-3 mr-1" />
                                -1.2 min from yesterday
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Tabs */}
                <Tabs defaultValue="active-alerts" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-lg">
                        <TabsTrigger value="situation-map" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <MapPin className="h-4 w-4 mr-2" />
                            Situation Map
                        </TabsTrigger>
                        <TabsTrigger value="active-alerts" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Active Alerts
                        </TabsTrigger>
                        <TabsTrigger value="shelter-status" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Shield className="h-4 w-4 mr-2" />
                            Shelter Status
                        </TabsTrigger>
                        <TabsTrigger value="driver-tracking" className="px-6 py-2.5 rounded-full data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 font-bold text-xs uppercase tracking-widest border border-slate-200">
                            <Car className="h-4 w-4 mr-2" /> Fleet Tracking
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Analytics
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="situation-map" className="mt-6">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            {/* Central Interactive Map */}
                            <div className="xl:col-span-2 space-y-4">
                                <Card className="border-0 shadow-lg bg-white overflow-hidden flex flex-col rounded-xl">
                                    <CardHeader className="bg-white border-b border-slate-100 pb-4">
                                        <div className="flex justify-between items-center">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-5 w-5 text-blue-600" />
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
                                        <DisplacementMap
                                            data={stateData}
                                            alerts={allAlerts}
                                            onStateSelect={(state) => {
                                                setSelectedState(state);
                                                setIsDeepDiveOpen(true);
                                            }}
                                            isSuperAdmin={role.includes('super')}
                                        />
                                    </CardContent>
                                </Card>
                            </div>


                            <RegionalDeepDiveModal
                                state={selectedState}
                                isOpen={isDeepDiveOpen}
                                onClose={() => setIsDeepDiveOpen(false)}
                                recentActivity={recentActivity}
                            />

                            {/* Sidebar Detail */}
                            <div className="xl:col-span-1">
                                <Card className="h-full flex flex-col border-0 shadow-lg bg-white rounded-xl">
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
                                                    <span>Regional SOS Feed</span>
                                                </>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-1 p-0 overflow-hidden relative">
                                        <ScrollArea className="h-[600px]">
                                            {selectedState ? (
                                                <div className="p-6 space-y-8 animate-in slide-in-from-right duration-300">
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
                                                <div className="divide-y divide-slate-100">
                                                    {recentActivity.length > 0 ? (
                                                        recentActivity.map((item) => (
                                                            <ActivityFeedItem key={item.id} item={item} />
                                                        ))
                                                    ) : (
                                                        <div className="p-12 text-center space-y-4">
                                                            <div className="inline-block p-4 rounded-full bg-slate-50 text-slate-300">
                                                                <CheckCircle className="h-8 w-8" />
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
                    </TabsContent>

                    <TabsContent value="active-alerts" className="mt-6">
                        <Card className="border-0 shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between pb-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                        <AlertTriangle className="text-red-500 h-5 w-5 sm:h-6 sm:w-6" />
                                        Emergency SOS Alerts
                                    </CardTitle>
                                    <CardDescription className="text-sm sm:text-base">Active emergency situations requiring immediate attention</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {permissionError && (
                                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle className="text-red-800">Permission Denied</AlertTitle>
                                        <AlertDescription className="text-red-700">
                                            You do not have permission to view SOS alerts. Please check your Firestore security rules to allow read access to the 'sosAlerts' collection for administrators.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {recentAlerts.length > 0 ? (
                                    recentAlerts.map((alert) => (
                                        <Card key={alert.id} className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
                                            <CardContent className="p-4 sm:p-6">
                                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            <Badge variant="secondary" className="font-medium">{alert.emergencyType}</Badge>
                                                            <Badge variant={getPriorityBadgeVariant("High Priority")}>High Priority</Badge>
                                                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{alert.id.substring(0, 6)}...</span>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-800 mb-1">{alert.location.address || 'Location not specified'}</p>
                                                            <p className="text-sm text-slate-600 mb-2">
                                                                User: {alert.userEmail || 'Anonymous'}
                                                            </p>
                                                            {alert.additionalInfo && (
                                                                <p className="text-sm bg-yellow-50 border border-yellow-200 p-3 rounded-md mb-2 text-yellow-800">Note: {alert.additionalInfo}</p>
                                                            )}
                                                            {alert.assignedTeam && (
                                                                <p className="text-sm bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-md">Assigned to: {alert.assignedTeam.driverName} ({alert.assignedTeam.vehicle})</p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mt-4">
                                                            <Button size="sm" onClick={() => setSelectedAlert(alert)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                                                View Details
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => handleOpenAssignDialog(alert)} disabled={alert.status === 'Resolved'}>
                                                                Assign Team
                                                            </Button>
                                                            {(alert.status === 'Active' || alert.status === 'Investigating') && (
                                                                <>
                                                                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(alert.id, 'Responding')} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                                                                        Mark Responding
                                                                    </Button>
                                                                    {alert.status !== 'Investigating' && (
                                                                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(alert.id, 'Investigating')} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                                                                            Investigating
                                                                        </Button>
                                                                    )}
                                                                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(alert.id, 'False Alarm')} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                                                                        False Alarm
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {alert.status === 'Responding' && (
                                                                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(alert.id, 'Resolved')}>
                                                                    Mark Resolved
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <Badge variant={getStatusBadgeVariant(alert.status)} className="mb-3">{alert.status}</Badge>
                                                        <p className="text-xs text-slate-500">Time</p>
                                                        <p className="font-medium text-slate-800">{formatTimestamp(alert.timestamp)}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : !permissionError ? (
                                    <div className="text-center py-12">
                                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                        <p className="text-lg font-medium text-slate-800">No active SOS alerts</p>
                                        <p className="text-slate-600 mt-1">All systems are running smoothly.</p>
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="shelter-status" className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {shelters.map(shelter => {
                                const occupied = shelter.capacity - shelter.availableCapacity;
                                const percentage = shelter.capacity > 0 ? Math.round((occupied / shelter.capacity) * 100) : 0;
                                return (
                                    <Card key={shelter.id} className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 group flex flex-col">
                                        <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                                            {shelter.imageUrl ? (
                                                <img
                                                    src={shelter.imageUrl}
                                                    alt={shelter.name}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                                                    <HomeIcon className="h-12 w-12 mb-2 opacity-20" />
                                                    <span className="text-xs font-medium uppercase tracking-widest opacity-40">No Image</span>
                                                </div>
                                            )}
                                            <div className="absolute top-3 right-3">
                                                <Badge variant={getShelterStatusBadgeVariant(shelter.status)} className="shadow-sm">
                                                    {shelter.status}
                                                </Badge>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                                                <h3 className="text-white font-bold text-lg leading-tight truncate">{shelter.name}</h3>
                                                <p className="text-slate-200 text-xs flex items-center gap-1 mt-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {shelter.location}
                                                </p>
                                            </div>
                                        </div>
                                        <CardContent className="p-4 flex-1 flex flex-col gap-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500 font-medium text-xs uppercase tracking-wider">Occupancy</span>
                                                    <span className={cn("font-bold", percentage > 90 ? "text-red-600" : "text-emerald-600")}>
                                                        {percentage}%
                                                    </span>
                                                </div>
                                                <Progress value={percentage} className={cn("h-2", percentage > 90 ? "[&>div]:bg-red-500" : "[&>div]:bg-emerald-500")} />
                                                <div className="flex justify-between text-xs text-slate-400 font-medium">
                                                    <span>{occupied.toLocaleString()} Occupied</span>
                                                    <span>{shelter.availableCapacity.toLocaleString()} Available</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 mt-auto">
                                                <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                    <div className="text-slate-400 font-bold uppercase tracking-tighter text-[10px]">Total Capacity</div>
                                                    <div className="font-bold text-slate-700 text-sm">{shelter.capacity.toLocaleString()}</div>
                                                </div>
                                                <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                    <div className="text-slate-400 font-bold uppercase tracking-tighter text-[10px]">Requests</div>
                                                    <div className="font-bold text-slate-700 text-sm">{shelter.requests || 0}</div>
                                                </div>
                                            </div>

                                            <Button variant="outline" className="w-full mt-2 border-blue-100 text-blue-600 hover:bg-blue-50 group-hover:border-blue-200" asChild>
                                                <Link to={`/admin/track-shelter`}>
                                                    Manage Shelter <ArrowUp className="ml-2 h-3 w-3 rotate-45" />
                                                </Link>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </TabsContent>
                    <TabsContent value="driver-tracking" className="mt-6">
                        <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-sm">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                                    <Car className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                                    Fleet Tracking Intelligence
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base">
                                    Real-time fleet monitoring and historical mission intelligence.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6 space-y-6">
                                <div className="flex flex-col sm:flex-row items-center gap-4 relative z-50 bg-white p-4 rounded-xl border border-blue-50 shadow-sm">
                                    <div className="flex items-center gap-2 min-w-max">
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">STEP 1</Badge>
                                        <Label htmlFor="driver-select" className="font-bold text-slate-700">Select Asset to Track:</Label>
                                    </div>
                                    <Select value={selectedDriver?.id || "all"} onValueChange={(value) => {
                                        if (value === "all") {
                                            setSelectedDriver(undefined);
                                        } else {
                                            const driver = drivers?.find(d => d.id === value);
                                            setSelectedDriver(driver || undefined);
                                        }
                                    }}>
                                        <SelectTrigger id="driver-select" className="flex-1 bg-white border-blue-100 h-11">
                                            <SelectValue placeholder="Choose a driver or vehicle..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[1001] max-h-[300px]">
                                            <SelectItem value="all" className="font-semibold text-blue-600">📡 Track Entire Fleet (Live)</SelectItem>
                                            {drivers?.map(driver => (
                                                <SelectItem key={driver.id} value={driver.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-2 h-2 rounded-full", driver.status === 'Available' ? 'bg-green-500' : 'bg-orange-500')} />
                                                        <span className="font-medium">{driver.name}</span>
                                                        <span className="text-slate-400 text-xs">[{driver.vehicle}]</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedDriver && (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        {/* Left Side: General History & Missions */}
                                        <div className="space-y-6">
                                            {/* Date/Time Filter Side */}
                                            <Card className="border shadow-sm overflow-hidden bg-slate-50/50">
                                                <CardHeader className="py-3 px-4 bg-slate-100/50 border-b border-slate-200">
                                                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-blue-500" /> 1. Manual Window Playback
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 space-y-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Start Window</Label>
                                                            <Input
                                                                type="datetime-local"
                                                                value={startDate}
                                                                onChange={(e) => setStartDate(e.target.value)}
                                                                className="bg-white border-slate-200 h-9 text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">End Window</Label>
                                                            <Input
                                                                type="datetime-local"
                                                                value={endDate}
                                                                onChange={(e) => setEndDate(e.target.value)}
                                                                className="bg-white border-slate-200 h-9 text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={handleFetchHistory}
                                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] h-9 shadow-sm"
                                                        disabled={isFetchingHistory}
                                                    >
                                                        {isFetchingHistory ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                FETCHING...
                                                            </div>
                                                        ) : "Load Selected Timeframe"}
                                                    </Button>
                                                </CardContent>
                                            </Card>

                                            {/* Mission Specific Section */}
                                            <Card className="border shadow-sm overflow-hidden border-blue-100">
                                                <CardHeader className="py-3 px-4 bg-blue-50/50 border-b border-blue-100">
                                                    <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                                                        <Target className="h-4 w-4" /> 2. Mission-Specific Playback
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <ScrollArea className="h-[200px]">
                                                        <div className="divide-y divide-slate-100">
                                                            {alerts?.filter(a => a.assignedTeam?.driverId === selectedDriver.id).length === 0 ? (
                                                                <div className="p-8 text-center text-slate-400 text-sm italic">
                                                                    No mission records found for this asset.
                                                                </div>
                                                            ) : (
                                                                alerts?.filter(a => a.assignedTeam?.driverId === selectedDriver.id)
                                                                    .sort((a, b) => {
                                                                        const getSortTime = (mission: any) => {
                                                                            if (mission.assignedAt?.seconds) return mission.assignedAt.seconds;
                                                                            if (mission.trackingData?.startTime) return new Date(mission.trackingData.startTime).getTime() / 1000;
                                                                            if (mission.timestamp?.seconds) return mission.timestamp.seconds;
                                                                            return 0;
                                                                        };
                                                                        return getSortTime(b) - getSortTime(a);
                                                                    })
                                                                    .map(mission => (
                                                                        <div key={mission.id} className="p-3 hover:bg-blue-50/30 transition-colors group flex items-center justify-between">
                                                                            <div className="min-w-0">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <Badge variant={mission.status === 'Resolved' ? 'secondary' : 'default'} className="text-[9px] h-4">
                                                                                        {mission.status}
                                                                                    </Badge>
                                                                                    <span className="text-[10px] font-bold text-slate-400">
                                                                                        {formatTimestamp((mission as any).assignedAt || (mission as any).trackingData?.startTime || mission.timestamp)}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-xs font-bold text-slate-700 truncate">{mission.emergencyType}</p>
                                                                                <p className="text-[10px] text-slate-400 truncate">{mission.location.address || 'Unknown Location'}</p>
                                                                            </div>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-7 px-2 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white"
                                                                                onClick={() => handleSimulateTaskRoute(mission)}
                                                                                disabled={isFetchingHistory}
                                                                            >
                                                                                {isFetchingHistory ? "..." : "Replay"}
                                                                            </Button>
                                                                        </div>
                                                                    ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Right Side: Playback Controls Side */}
                                        <div className="space-y-6">
                                            {playbackData.length > 0 ? (
                                                <Card className="border shadow-sm border-emerald-100 bg-emerald-50/20 h-full">
                                                    <CardHeader className="py-3 px-4 bg-emerald-100/30 border-b border-emerald-100">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                                                <Activity className="h-4 w-4" /> 3. Tactical Playback
                                                            </CardTitle>
                                                            <Badge className="bg-emerald-600 text-white font-black text-[9px]">
                                                                {playbackIndex + 1} / {playbackData.length} SIGNALS
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-4 space-y-6">
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => setPlaybackIndex(0)}
                                                                className="h-10 w-10 bg-white border-emerald-100 text-emerald-600"
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                onClick={handleTogglePlayback}
                                                                className={cn(
                                                                    "flex-1 font-black uppercase tracking-widest text-xs h-10 shadow-md transform transition-all active:scale-95",
                                                                    isPlaying ? "bg-slate-900 hover:bg-black text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                )}
                                                            >
                                                                {isPlaying ? <><Pause className="h-4 w-4 mr-2 text-emerald-400" /> Pause Intel</> : <><Play className="h-4 w-4 mr-2" /> Resume Signal</>}
                                                            </Button>
                                                        </div>

                                                        <div className="space-y-4 bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                    <span>Timeline Intelligence</span>
                                                                    <span className="text-emerald-600">{Math.round(((playbackIndex + 1) / playbackData.length) * 100)}%</span>
                                                                </div>
                                                                <Slider
                                                                    value={[playbackIndex]}
                                                                    max={playbackData.length - 1}
                                                                    step={1}
                                                                    onValueChange={(val) => {
                                                                        setPlaybackIndex(val[0]);
                                                                        setIsPlaying(false);
                                                                    }}
                                                                    className="cursor-pointer"
                                                                />
                                                            </div>

                                                            <div className="flex items-center gap-6">
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Warp Speed: <span className="text-emerald-600">{playbackSpeed}x</span></div>
                                                                    <Slider
                                                                        value={[playbackSpeed]}
                                                                        min={1}
                                                                        max={10}
                                                                        step={1}
                                                                        onValueChange={(val) => setPlaybackSpeed(val[0])}
                                                                        className="cursor-pointer"
                                                                    />
                                                                </div>
                                                                <div className="bg-slate-900 rounded-lg p-3 text-right shadow-inner min-w-[120px]">
                                                                    <div className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest opacity-70">Signal Timestamp</div>
                                                                    <div className="text-sm font-black tabular-nums text-white">
                                                                        {formatTimestamp(playbackData[playbackIndex]?.timestamp)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ) : (
                                                <div className="h-full min-h-[300px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 space-y-4 p-8 bg-slate-50/30">
                                                    <div className="p-4 bg-white rounded-full shadow-sm border border-slate-100">
                                                        <Activity className="h-8 w-8 text-slate-200" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Awaiting Target Selection</p>
                                                        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Select a timeframe or a specific mission to begin tactical playback.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner group">
                                    <DriverMap
                                        drivers={isPlaybackMode ? [] : (selectedDriver ? [selectedDriver] : drivers || [])}
                                        selectedDriver={selectedDriver}
                                        onDriverSelect={setSelectedDriver}
                                        className="h-[500px] w-full z-0 relative transition-all duration-700"
                                        showMovementTrails={!isPlaybackMode}
                                        locationHistory={locationHistory}
                                        playbackPoint={isPlaybackMode ? playbackData[playbackIndex] : undefined}
                                        playbackTrail={isPlaybackMode ? playbackData.slice(0, playbackIndex + 1) : undefined}
                                        fullMissionTrail={isPlaybackMode ? playbackData : undefined}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="analytics" className="mt-6">
                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg sm:text-xl flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                                        Operational Analytics
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "ml-auto text-[10px] uppercase tracking-tighter font-bold",
                                        adminProfile?.role?.toLowerCase().includes('super')
                                            ? "bg-purple-50 text-purple-700 border-purple-100"
                                            : "bg-blue-50 text-blue-700 border-blue-100"
                                    )}>
                                        {adminProfile?.role?.toLowerCase().includes('super') ? "Global Intelligence" : `${adminProfile?.state || 'State'} Operations`}
                                    </Badge>
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base">
                                    Visualizing key metrics for better decision-making.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    <AlertsOverTimeChart alerts={alerts || []} />
                                    <ShelterOccupancyChart shelters={shelters || []} />
                                    <EmergencyTypesChart alerts={alerts || []} />
                                    <DisplacedPersonsStatusChart persons={persons || []} />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
