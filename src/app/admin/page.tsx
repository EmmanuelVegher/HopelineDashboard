"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowDown, ArrowUp, Clock, Users, Shield, RefreshCw, MapPin, User, Calendar, Car, Edit, FileText, BarChart3, Activity, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useState } from "react";
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
import { useAdminData } from "@/contexts/AdminDataProvider";
import { formatTimestamp } from "@/lib/utils";
import DriverMap from "@/components/driver-map";


const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Active': return 'destructive';
        case 'Responding': return 'default';
        case 'Resolved': return 'secondary';
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

export default function AdminDashboardPage() {
    const { alerts, persons, shelters, drivers, loading, permissionError, fetchData } = useAdminData();
    const { toast } = useToast();
    const [selectedAlert, setSelectedAlert] = useState<SosAlert | null>(null);
    const [assignAlert, setAssignAlert] = useState<SosAlert | null>(null);
    const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
    const [driversLoading, setDriversLoading] = useState(false);
    const [assigningDriver, setAssigningDriver] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('active-alerts');
    const [selectedDriver, setSelectedDriver] = useState<Driver | undefined>(undefined);

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


    const handleUpdateStatus = async (alertId: string, status: 'Responding' | 'Resolved') => {
        const alertRef = doc(db, "sosAlerts", alertId);
        try {
            await updateDoc(alertRef, { status: status });
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
        batch.update(alertRef, { 
            status: "Responding",
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
            toast({ title: "Success", description: `${driver.name} has been dispatched.`});
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
                                     <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <Car className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-blue-600 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-blue-800">Assigned Team</p>
                                            <p className="text-blue-700">{selectedAlert.assignedTeam.driverName} ({selectedAlert.assignedTeam.vehicle})</p>
                                        </div>
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

            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-emerald-700 bg-clip-text text-transparent">
                            Emergency Response Dashboard
                        </h1>
                        <p className="text-sm sm:text-base text-slate-600 flex items-center gap-2 mt-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            CARITAS Nigeria | CITI Foundation Project
                        </p>
                    </div>
                    <Button 
                        onClick={fetchData} 
                        disabled={loading} 
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    >
                        <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                        Refresh Data
                    </Button>
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
                                <ArrowUp className="h-3 w-3 mr-1"/>
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
                                <ArrowDown className="h-3 w-3 mr-1"/>
                                -1.2 min from yesterday
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Tabs */}
                <Tabs defaultValue="active-alerts" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-12 bg-slate-100 p-1 rounded-lg">
                        <TabsTrigger value="active-alerts" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Active Alerts
                        </TabsTrigger>
                        <TabsTrigger value="shelter-status" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Shield className="h-4 w-4 mr-2" />
                            Shelter Status
                        </TabsTrigger>
                        <TabsTrigger value="driver-tracking" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Car className="h-4 w-4 mr-2" />
                            Driver Tracking
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="text-sm sm:text-base font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Analytics
                        </TabsTrigger>
                    </TabsList>
                    
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
                                                             {alert.status === 'Active' && (
                                                                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(alert.id, 'Responding')}>
                                                                    Mark Responding
                                                                </Button>
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
                         <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                                    <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                                    Shelter Capacity Management
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base">View detailed capacity information and manage shelter spaces.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Shelter</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Occupied</TableHead>
                                                <TableHead className="text-right">Available</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                                <TableHead>Occupancy</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {shelters.map(shelter => {
                                                const occupied = shelter.capacity - shelter.availableCapacity;
                                                const percentage = shelter.capacity > 0 ? Math.round((occupied / shelter.capacity) * 100) : 0;
                                                return (
                                                    <TableRow key={shelter.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                        <TableCell>
                                                            <div className="font-medium text-slate-800">{shelter.name}</div>
                                                            <div className="text-xs text-slate-500">{shelter.location}</div>
                                                        </TableCell>
                                                        <TableCell><Badge variant={getShelterStatusBadgeVariant(shelter.status)}>{shelter.status}</Badge></TableCell>
                                                        <TableCell className="text-right font-medium text-slate-800">{occupied}</TableCell>
                                                        <TableCell className="text-right font-medium text-green-600">{shelter.availableCapacity}</TableCell>
                                                        <TableCell className="text-right font-medium text-slate-800">{shelter.capacity}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Progress value={percentage} className="h-2 w-16 sm:w-20" />
                                                                <span className="text-xs text-slate-600 w-10 text-right">{percentage}%</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="outline" size="sm" asChild className="border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                <Link to={`/admin/track-shelter`}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Manage
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                     <TabsContent value="driver-tracking" className="mt-6">
                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                                    <Car className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                                    Driver Tracking
                                </CardTitle>
                                 <CardDescription className="text-sm sm:text-base">
                                    Real-time driver locations and status monitoring. For full management features, visit the <Link to="/admin/track-drivers" className="text-blue-600 hover:text-blue-800 underline font-medium">Driver Tracking page</Link>.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Label htmlFor="driver-select">Select Driver to Track:</Label>
                                    <Select value={selectedDriver?.id || ""} onValueChange={(value) => {
                                        const driver = drivers.find(d => d.id === value);
                                        setSelectedDriver(driver || undefined);
                                    }}>
                                        <SelectTrigger id="driver-select" className="w-64">
                                            <SelectValue placeholder="Choose a driver..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {drivers.map(driver => (
                                                <SelectItem key={driver.id} value={driver.id}>
                                                    {driver.name} - {driver.vehicle}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DriverMap
                                    drivers={drivers}
                                    selectedDriver={selectedDriver}
                                    onDriverSelect={setSelectedDriver}
                                    className="h-96 w-full"
                                />
                            </CardContent>
                        </Card>
                     </TabsContent>
                     <TabsContent value="analytics" className="mt-6">
                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                                    Operational Analytics
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
