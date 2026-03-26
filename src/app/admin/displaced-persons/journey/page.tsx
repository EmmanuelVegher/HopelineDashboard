"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
    Users, 
    History, 
    TrendingUp, 
    Calendar, 
    MapPin, 
    Building2, 
    ArrowRight, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Info,
    ChevronRight,
    Search,
    Filter,
    ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from "@/components/ui/card";
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
    Bar, 
    BarChart, 
    CartesianGrid, 
    XAxis, 
    YAxis, 
    Tooltip, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function BeneficiaryJourneyPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { persons, organizations, adminProfile } = useAdminData();
    const [activeTab, setActiveTab] = useState("individual");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [orgFilter, setOrgFilter] = useState("all");

    const isSuperAdmin = adminProfile?.role?.toLowerCase().includes('super');
    const isFederalGov = adminProfile?.role?.toLowerCase().includes('federal');
    const isStateGov = adminProfile?.role?.toLowerCase().includes('state');
    const adminState = adminProfile?.state || '';

    // Helper for complex DD/MM/YYYY parsing
    const parseEventDate = (dateStr: string) => {
        if (!dateStr) return 0;
        let ts = new Date(dateStr).getTime();
        if (!isNaN(ts)) return ts;
        try {
            const partsStr = dateStr.includes(', ') ? dateStr.split(', ') : [dateStr, '00:00:00'];
            const dPart = partsStr[0];
            const tPart = partsStr[1];
            
            if (dPart && dPart.includes('/')) {
                const parts = dPart.split('/');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    let hours = 0, mins = 0, secs = 0;
                    if (tPart) {
                        const tParts = tPart.split(':');
                        hours = parseInt(tParts[0], 10) || 0;
                        mins = parseInt(tParts[1], 10) || 0;
                        secs = parseInt(tParts[2], 10) || 0;
                    }
                    return new Date(year, month, day, hours, mins, secs).getTime();
                }
            }
        } catch (e) {}
        return 0;
    };

    // Filter persons based on role and search
    const filteredPersons = useMemo(() => {
        if (!persons) return [];
        return persons.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (p.shortId || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesOrg = orgFilter === 'all' || p.organizationId === orgFilter;
            
            return matchesSearch && matchesOrg;
        });
    }, [persons, searchTerm, orgFilter]);

    const selectedPerson = useMemo(() => {
        return persons?.find(p => p.id === selectedPersonId) || null;
    }, [persons, selectedPersonId]);

    // Aggregate Analytics Data
    const analyticsData = useMemo(() => {
        if (!persons) return null;

        const filteredForAnalytics = persons.filter(p => {
            if (isSuperAdmin || isFederalGov) return true;
            if (isStateGov) return p.state === adminState;
            return p.organizationId === adminProfile?.organizationId;
        });

        const statusDistribution = filteredForAnalytics.reduce((acc: any, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {});

        const causeDistribution = filteredForAnalytics.reduce((acc: any, p) => {
            if (p.displacementCause) {
                acc[p.displacementCause] = (acc[p.displacementCause] || 0) + 1;
            }
            return acc;
        }, {});

        const totalTokens = filteredForAnalytics.length;
        const activeInShelter = filteredForAnalytics.filter(p => p.status === 'Safe').length;
        const resettlementSuccess = filteredForAnalytics.filter(p => p.status === 'Resettled' || p.status === 'Homebound').length;

        const allExits: any[] = [];
        filteredForAnalytics.forEach(p => {
            if (p.movements && p.movements.length > 0) {
                // Pre-sort movements chronologically to trace lineage
                const sortedMovements = [...p.movements].sort((a, b) => {
                    const timeA = parseEventDate(a.date);
                    const timeB = parseEventDate(b.date);
                    return timeA - timeB;
                });

                let lastKnownShelter = p.currentLocation || 'Unknown Shelter';
                
                sortedMovements.forEach((m: any) => {
                    if (m.action === 'Entry' || m.action === 'Transfer') {
                        if (m.shelterName) lastKnownShelter = m.shelterName;
                        if (m.destination) lastKnownShelter = m.destination;
                    }
                    if (m.action === 'Exit') {
                        allExits.push({
                            ...m,
                            shelterName: m.shelterName || lastKnownShelter,
                            personName: p.name,
                            personId: p.id
                        });
                    }
                });
            }
        });

        const exitsByShelter = allExits.reduce((acc: any, exit) => {
            const shelterName = exit.shelterName || 'Unknown Shelter';
            acc[shelterName] = (acc[shelterName] || 0) + 1;
            return acc;
        }, {});

        return {
            total: totalTokens,
            activeInShelter,
            resettlementSuccess,
            statusChart: Object.entries(statusDistribution).map(([name, value]) => ({ name, value })),
            causeChart: Object.entries(causeDistribution).map(([name, value]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value).slice(0, 5),
            exitStats: {
                total: allExits.length,
                exitsByShelter: Object.entries(exitsByShelter).map(([name, value]) => ({ name, value })),
                history: allExits.sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date))
            }
        };
    }, [persons, isSuperAdmin, isFederalGov, isStateGov, adminState, adminProfile]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="-ml-2 mb-2 text-muted-foreground hover:text-blue-600"
                        onClick={() => navigate("/admin/displaced-persons")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('admin.displacedPersons.journey.backToBeneficiaries')}
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">{t('admin.displacedPersons.journey.title')}</h1>
                    <p className="text-muted-foreground">{t('admin.displacedPersons.journey.description')}</p>
                </div>
                
                {(isSuperAdmin || isFederalGov || isStateGov) && (
                    <div className="flex gap-2">
                        <Select value={orgFilter} onValueChange={setOrgFilter}>
                            <SelectTrigger className="w-[200px]">
                                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder={t('admin.displacedPersons.form.chooseOrganization') || "All Organizations"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('admin.displacedPersons.form.allOrganizations') || "All Organizations"}</SelectItem>
                                {organizations?.map(org => (
                                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <Tabs defaultValue="individual" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-slate-100 p-1 grid grid-cols-3 w-full">
                    <TabsTrigger value="individual" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Users className="mr-2 h-4 w-4" />
                        {t('admin.displacedPersons.journey.individualJourney')}
                    </TabsTrigger>
                    <TabsTrigger value="programmatic" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        {t('admin.displacedPersons.journey.programmaticReports')}
                    </TabsTrigger>
                    <TabsTrigger value="exits" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('admin.displacedPersons.journey.exits')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="individual" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Sidebar: Beneficiary List */}
                        <Card className="md:col-span-1 h-[calc(100vh-280px)] flex flex-col">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm">{t('admin.displacedPersons.journey.selectBeneficiary')}</CardTitle>
                                <div className="relative mt-2">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder={t('admin.displacedPersons.searchPlaceholder') || "Search..."} 
                                        className="pl-8 h-9" 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 overflow-hidden">
                                <ScrollArea className="h-full">
                                    <div className="p-2 space-y-1">
                                        {filteredPersons.length > 0 ? (
                                            filteredPersons.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setSelectedPersonId(p.id)}
                                                    className={cn(
                                                        "w-full text-left p-3 rounded-md transition-colors flex flex-col gap-1 border",
                                                        selectedPersonId === p.id 
                                                            ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100" 
                                                            : "hover:bg-slate-50 border-transparent"
                                                    )}
                                                >
                                                    <span className="font-semibold text-sm truncate">{p.name}</span>
                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                        <span>{p.shortId || p.id.slice(0, 8)}</span>
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                                                            {t(`admin.displacedPersons.statusEnum.${p.status.toLowerCase().replace(/ /g, '_')}`) || p.status}
                                                        </Badge>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-muted-foreground italic text-sm">
                                                {t('admin.displacedPersons.journey.noMatches')}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Main Content: Timeline */}
                        <Card className="md:col-span-3 h-[calc(100vh-280px)] overflow-hidden flex flex-col shadow-sm border-blue-50">
                            {selectedPerson ? (
                                <>
                                    <CardHeader className="border-b bg-slate-50/50 p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4 items-center">
                                                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm">
                                                    {selectedPerson.imageUrl ? (
                                                        <img src={selectedPerson.imageUrl} alt={selectedPerson.name} className="h-full w-full object-cover rounded-full" />
                                                    ) : (
                                                        <Users className="h-6 w-6 text-blue-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <CardTitle className="text-xl">{selectedPerson.name}</CardTitle>
                                                        <Badge className="bg-blue-600">
                                                            {t(`admin.displacedPersons.statusEnum.${selectedPerson.status.toLowerCase().replace(/ /g, '_')}`) || selectedPerson.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedPerson.currentLocation}</span>
                                                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {selectedPerson.organizationName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-inter">{t('admin.displacedPersons.journey.uniqueId')}</p>
                                                <p className="font-mono text-sm font-bold text-blue-700">{selectedPerson.shortId || selectedPerson.id}</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-hidden relative">
                                        <ScrollArea className="h-full">
                                            <div className="p-8 pb-16">
                                                <div className="relative border-l-2 border-slate-200 ml-4 space-y-12 pb-4">
                                                    {(() => {
                                                        const parseEventDate = (dateStr: string) => {
                                                            if (!dateStr) return 0;
                                                            let ts = new Date(dateStr).getTime();
                                                            if (!isNaN(ts)) return ts;
                                                            // Fallback for DD/MM/YYYY or DD/MM/YYYY, HH:MM:SS
                                                            try {
                                                                const partsStr = dateStr.includes(', ') ? dateStr.split(', ') : [dateStr, '00:00:00'];
                                                                const dPart = partsStr[0];
                                                                const tPart = partsStr[1];
                                                                
                                                                if (dPart && dPart.includes('/')) {
                                                                    const parts = dPart.split('/');
                                                                    if (parts.length === 3) {
                                                                        const day = parseInt(parts[0], 10);
                                                                        const month = parseInt(parts[1], 10) - 1;
                                                                        const year = parseInt(parts[2], 10);
                                                                        let hours = 0, mins = 0, secs = 0;
                                                                        if (tPart) {
                                                                            const tParts = tPart.split(':');
                                                                            hours = parseInt(tParts[0], 10) || 0;
                                                                            mins = parseInt(tParts[1], 10) || 0;
                                                                            secs = parseInt(tParts[2], 10) || 0;
                                                                        }
                                                                        return new Date(year, month, day, hours, mins, secs).getTime();
                                                                    }
                                                                }
                                                            } catch (e) {}
                                                            return 0;
                                                        };

                                                        const events: any[] = [];
                                                        
                                                        if (selectedPerson.movements && selectedPerson.movements.length > 0) {
                                                            selectedPerson.movements.forEach((mv: any, idx: number) => {
                                                                events.push({
                                                                    type: idx === 0 ? 'onboarding' : 'movement',
                                                                    dateStr: mv.date,
                                                                    time: idx === 0 ? 0 : parseEventDate(mv.date), // Enforce onboarding is always 0 (bottom)
                                                                    data: mv
                                                                });
                                                            });
                                                        } else {
                                                            const dStr = selectedPerson.lastUpdate || new Date().toLocaleString();
                                                            events.push({
                                                                type: 'onboarding',
                                                                dateStr: dStr,
                                                                time: 0, // Enforce onboarding is always 0 (bottom)
                                                                data: { performedBy: t('admin.displacedPersons.journey.systemAdmin') }
                                                            });
                                                        }

                                                        if (selectedPerson.activityLog) {
                                                            selectedPerson.activityLog.forEach((log: any) => {
                                                                events.push({
                                                                    type: 'activity',
                                                                    dateStr: log.date,
                                                                    time: parseEventDate(log.date),
                                                                    data: log
                                                                });
                                                            });
                                                        }

                                                        events.push({
                                                            type: 'current_status',
                                                            dateStr: new Date().toLocaleString(),
                                                            time: Date.now() + 1000,
                                                            data: {}
                                                        });

                                                        return events.sort((a, b) => b.time - a.time).map((evt, idx) => {
                                                            if (evt.type === 'onboarding') {
                                                                return (
                                                                    <TimelineItem 
                                                                        key={`evt-${idx}`}
                                                                        icon={<CheckCircle2 className="h-4 w-4 text-white" />}
                                                                        iconClass="bg-green-500 ring-4 ring-green-100"
                                                                        date={evt.dateStr}
                                                                        title={t('admin.displacedPersons.cardView.onboard')}
                                                                        description={t('admin.displacedPersons.journey.onboardingDesc', { location: selectedPerson.currentLocation })}
                                                                        actor={evt.data.performedBy || t('admin.displacedPersons.journey.systemAdmin')}
                                                                        badge={t('admin.displacedPersons.journey.start')}
                                                                    />
                                                                );
                                                            } else if (evt.type === 'movement') {
                                                                const mv = evt.data;
                                                                return (
                                                                    <TimelineItem 
                                                                        key={`evt-${idx}`}
                                                                        icon={mv.action === 'Entry' ? <Building2 className="h-4 w-4 text-white" /> : mv.action === 'Exit' ? <XCircle className="h-4 w-4 text-white" /> : <History className="h-4 w-4 text-white" />}
                                                                        iconClass={mv.action === 'Entry' ? "bg-blue-500 ring-4 ring-blue-100" : mv.action === 'Exit' ? "bg-red-500 ring-4 ring-red-100" : "bg-orange-500 ring-4 ring-orange-100"}
                                                                        date={mv.date}
                                                                        title={`${mv.action}: ${mv.shelterName || t('common.location')}`}
                                                                        description={mv.notes || (mv.action === 'Transfer' ? `${t('admin.displacedPersons.actions.relocation')} ${t('admin.displacedPersons.journey.to')} ${mv.destination || t('admin.displacedPersons.journey.anotherOrganization')}.` : '')}
                                                                        actor={mv.performedBy}
                                                                        meta={mv.destination && `${t('admin.displacedPersons.cardView.destination')}: ${mv.destination}`}
                                                                    />
                                                                );
                                                            } else if (evt.type === 'activity') {
                                                                const log = evt.data;
                                                                return (
                                                                    <TimelineItem 
                                                                        key={`evt-${idx}`}
                                                                        icon={<Info className="h-4 w-4 text-white" />}
                                                                        iconClass="bg-slate-400 ring-4 ring-slate-100"
                                                                        date={log.date}
                                                                        title={log.action}
                                                                        description={log.notes}
                                                                        actor={log.performedBy}
                                                                        isActivity
                                                                    />
                                                                );
                                                            } else if (evt.type === 'current_status') {
                                                                return (
                                                                    <TimelineItem 
                                                                        key={`evt-${idx}`}
                                                                        icon={<Clock className="h-4 w-4 text-white" />}
                                                                        iconClass="bg-blue-600 ring-4 ring-blue-100 animate-pulse"
                                                                        date={evt.dateStr}
                                                                        title={t('common.status')}
                                                                        description={`${t('common.status')}: ${t(`admin.displacedPersons.statusEnum.${selectedPerson.status.toLowerCase().replace(/ /g, '_')}`) || selectedPerson.status} ${t('admin.displacedPersons.journey.in')} ${selectedPerson.currentLocation}.`}
                                                                        actor={t('admin.displacedPersons.journey.liveData')}
                                                                    />
                                                                );
                                                            }
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50/30">
                                    <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                                        <History className="h-10 w-10 text-blue-200" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-700">{t('admin.displacedPersons.journey.noBeneficiarySelected') || "No Beneficiary Selected"}</h3>
                                    <p className="text-muted-foreground mt-2 max-w-xs">{t('admin.displacedPersons.journey.selectBeneficiaryPrompt') || "Select a beneficiary from the left list to view their full journey timeline and service history."}</p>
                                </div>
                            )}
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="programmatic" className="space-y-4">
                    {analyticsData && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <AnalyticsStatCard 
                                    title={t('admin.displacedPersons.journey.totalEnrolled')} 
                                    value={analyticsData.total} 
                                    icon={<Users className="h-5 w-5 text-blue-600" />} 
                                    color="text-blue-600"
                                    percentage={t('admin.displacedPersons.journey.percentageChange')}
                                />
                                <AnalyticsStatCard 
                                    title={t('admin.displacedPersons.journey.activeInShelters')} 
                                    value={analyticsData.activeInShelter} 
                                    icon={<Building2 className="h-5 w-5 text-emerald-600" />} 
                                    color="text-emerald-600"
                                    percentage={t('admin.displacedPersons.journey.percentageChange')}
                                />
                                <AnalyticsStatCard 
                                    title={t('admin.displacedPersons.journey.resettlementSuccess')} 
                                    value={analyticsData.resettlementSuccess} 
                                    icon={<CheckCircle2 className="h-5 w-5 text-purple-600" />} 
                                    color="text-purple-600"
                                    percentage={t('admin.displacedPersons.journey.percentageChange')}
                                />
                                <AnalyticsStatCard 
                                    title={t('admin.displacedPersons.journey.reportingPeriod')} 
                                    value={t('admin.displacedPersons.journey.lifetime')} 
                                    icon={<Calendar className="h-5 w-5 text-orange-600" />} 
                                    color="text-orange-600"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="p-6">
                                    <CardHeader className="px-0 pt-0">
                                        <CardTitle className="text-lg">{t('admin.displacedPersons.journey.statusDistribution')}</CardTitle>
                                        <CardDescription>{t('admin.displacedPersons.journey.statusDistributionDesc')}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="px-0 flex justify-center h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={analyticsData.statusChart}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {analyticsData.statusChart.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    formatter={(value, _name: string) => [
                                                        value, 
                                                        t(`admin.displacedPersons.statusEnum.${_name.toLowerCase().replace(/ /g, '_')}`) || _name
                                                    ]}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex flex-col justify-center gap-2 ml-4">
                                            {analyticsData.statusChart.map((entry: any, index) => (
                                                <div key={entry.name} className="flex items-center gap-2 text-xs">
                                                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                    <span className="font-medium">
                                                        {t(`admin.displacedPersons.statusEnum.${entry.name.toLowerCase().replace(/ /g, '_')}`) || entry.name}
                                                    </span>
                                                    <span className="text-muted-foreground">({entry.value})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="p-6">
                                    <CardHeader className="px-0 pt-0">
                                        <CardTitle className="text-lg">{t('admin.displacedPersons.journey.topCauses')}</CardTitle>
                                        <CardDescription>{t('admin.displacedPersons.journey.topCausesDesc')}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="px-0 h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analyticsData.causeChart} layout="vertical" margin={{ left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                                <XAxis type="number" hide />
                                                <YAxis 
                                                    dataKey="name" 
                                                    type="category" 
                                                    width={100} 
                                                    fontSize={11} 
                                                    tickLine={false} 
                                                    axisLine={false}
                                                    tickFormatter={(name: string) => t(`admin.displacedPersons.causes.${name.toLowerCase()}`) || name}
                                                />
                                                <Tooltip 
                                                    cursor={{ fill: 'transparent' }} 
                                                    formatter={(value, _name, props: any) => [
                                                        value, 
                                                        t(`admin.displacedPersons.causes.${props.payload.name.toLowerCase()}`) || props.payload.name
                                                    ]}
                                                />
                                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="exits" className="space-y-4">
                    {analyticsData?.exitStats && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <AnalyticsStatCard 
                                    title={t('admin.displacedPersons.journey.totalExits')} 
                                    value={analyticsData.exitStats.total} 
                                    icon={<XCircle className="h-5 w-5 text-red-600" />} 
                                    color="text-red-600"
                                    percentage={t('admin.displacedPersons.journey.percentageChange')}
                                />
                                <AnalyticsStatCard 
                                    title={t('admin.displacedPersons.journey.liveData')} 
                                    value={analyticsData.exitStats.history[0]?.date.split(',')[0] || "N/A"} 
                                    icon={<Clock className="h-5 w-5 text-blue-600" />} 
                                    color="text-blue-600"
                                />
                                <AnalyticsStatCard 
                                    title={t('admin.displacedPersons.journey.reportingPeriod')} 
                                    value={t('admin.displacedPersons.journey.lifetime')} 
                                    icon={<Calendar className="h-5 w-5 text-orange-600" />} 
                                    color="text-orange-600"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card className="lg:col-span-1 p-6">
                                    <CardHeader className="px-0 pt-0">
                                        <CardTitle className="text-lg">{t('admin.displacedPersons.journey.exitsByShelter')}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-0 h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analyticsData.exitStats.exitsByShelter} layout="vertical" margin={{ left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                                <XAxis type="number" hide />
                                                <YAxis 
                                                    dataKey="name" 
                                                    type="category" 
                                                    width={100} 
                                                    fontSize={10} 
                                                    tickLine={false} 
                                                    axisLine={false}
                                                />
                                                <Tooltip cursor={{ fill: 'transparent' }} />
                                                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{t('admin.displacedPersons.journey.exitHistory')}</CardTitle>
                                        <CardDescription>{t('admin.displacedPersons.journey.exitHistoryDesc')}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-[400px]">
                                            <div className="p-4 space-y-4">
                                                {analyticsData.exitStats.history.map((exit: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                                                <XCircle className="h-5 w-5 text-red-600" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm text-slate-900">{exit.personName}</p>
                                                                <p className="text-xs text-muted-foreground">{exit.shelterName} &middot; {exit.notes}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold text-slate-800">{exit.date.split(',')[0]}</p>
                                                            <p className="text-[10px] text-blue-600 font-medium">→ {exit.destination || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {analyticsData.exitStats.history.length === 0 && (
                                                    <div className="text-center py-8 text-muted-foreground text-sm italic">
                                                        No exit records found.
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function TimelineItem({ icon, iconClass, date, title, description, actor, badge, meta, isActivity }: any) {
    const { t } = useTranslation();
    return (
        <div className="relative pl-10">
            <div className={cn(
                "absolute -left-[19px] top-0 h-9 w-9 rounded-full border-4 border-white flex items-center justify-center shadow-md z-10 transition-transform hover:scale-110",
                iconClass
            )}>
                {icon}
            </div>
            <div className={cn(
                "p-4 rounded-xl border-2 transition-all hover:shadow-md group",
                isActivity ? "bg-slate-50 border-slate-100" : "bg-white border-blue-50"
            )}>
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{date}</span>
                    {badge && <Badge variant="secondary" className="text-[9px] px-1 h-3.5 bg-slate-800 text-white border-none">{badge}</Badge>}
                </div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {title}
                    <ChevronRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
                {description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>}
                {meta && <p className="text-[10px] text-blue-500 font-semibold mt-2 flex items-center gap-1"><ArrowRight className="h-2.5 w-2.5" /> {meta}</p>}
                
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {actor?.[0]?.toUpperCase() || "A"}
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">{t('admin.displacedPersons.journey.by') || "By"} {actor}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AnalyticsStatCard({ title, value, icon, color, percentage }: any) {
    const { t: _t } = useTranslation();
    return (
        <Card className="overflow-hidden border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
                    {percentage && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                            {percentage}
                        </Badge>
                    )}
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                    <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
