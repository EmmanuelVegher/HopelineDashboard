
"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type Shelter } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bed, CheckCircle, Shield, AlertTriangle, RefreshCw, Plus, MapPin, User, Clock, TrendingUp, TrendingDown, Minus, Phone, Edit, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { addDoc, updateDoc, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription as AlertDesc, AlertTitle as AlertDialogTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { useNavigate } from "react-router-dom";


const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Operational': return 'success';
        case 'Full': return 'destructive';
        case 'Emergency Only': return 'warning';
        default: return 'secondary';
    }
}

const getTrendInfo = (trend?: string) => {
    switch (trend) {
        case 'Increasing': return { icon: <TrendingUp className="h-4 w-4 text-red-500" />, text: 'Increasing' };
        case 'Decreasing': return { icon: <TrendingDown className="h-4 w-4 text-green-500" />, text: 'Decreasing' };
        case 'Stable':
        default: return { icon: <Minus className="h-4 w-4 text-gray-500" />, text: 'Stable' };
    }
}

const getCardBorderColor = (status: string) => {
     switch (status) {
        case 'Full': return 'border-red-200 bg-red-50/50';
        case 'Emergency Only': return 'border-yellow-200 bg-yellow-50/50';
        default: return '';
    }
}

function ShelterForm({ shelter, onSave, onCancel }: { shelter?: Shelter | null, onSave: () => void, onCancel: () => void }) {
    const [formData, setFormData] = useState<Partial<Shelter>>(shelter || {
        name: '',
        organization: '',
        location: '',
        capacity: 0,
        availableCapacity: 0,
        facilities: [],
        security: '',
        phone: '',
        managerName: '',
        latitude: 0,
        longitude: 0,
        status: 'Operational',
        requests: 0,
        trend: 'Stable',
        lastUpdate: new Date().toLocaleDateString(),
    });
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (shelter) {
            setFormData(shelter);
        }
    }, [shelter]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'capacity' || name === 'availableCapacity' || name === 'requests' ? Number(value) : value }));
    };

    const handleFacilitiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, facilities: e.target.value.split(',').map(f => f.trim()) }));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (shelter) {
                // Update existing shelter
                const shelterRef = doc(db, "shelters", shelter.id);
                await updateDoc(shelterRef, formData);
                toast({ title: "Success", description: "Shelter updated successfully." });
            } else {
                // Create new shelter
                await addDoc(collection(db, "shelters"), formData);
                toast({ title: "Success", description: "Shelter created successfully." });
            }
            onSave();
        } catch (error) {
            console.error("Error saving shelter: ", error);
            toast({ title: "Error", description: "Could not save shelter. Check Firestore permissions.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Shelter Name</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <Input id="organization" name="organization" value={formData.organization} onChange={handleChange} />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" value={formData.location} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="capacity">Total Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" value={formData.capacity} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="availableCapacity">Available Capacity</Label>
                    <Input id="availableCapacity" name="availableCapacity" type="number" value={formData.availableCapacity} onChange={handleChange} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="requests">Emergency Requests</Label>
                    <Input id="requests" name="requests" type="number" value={formData.requests} onChange={handleChange} />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="facilities">Facilities (comma-separated)</Label>
                <Input id="facilities" name="facilities" value={formData.facilities?.join(', ')} onChange={handleFacilitiesChange} placeholder="e.g. Medical, Food, Water" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="security">Security Details</Label>
                <Textarea id="security" name="security" value={formData.security} onChange={handleChange} placeholder="Describe security measures..."/>
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="managerName">Manager Name</Label>
                    <Input id="managerName" name="managerName" value={formData.managerName} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Contact Phone</Label>
                    <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Shelter'}</Button>
            </DialogFooter>
        </form>
    );
}

export default function TrackShelterPage() {
    const { shelters, loading, permissionError, fetchData } = useAdminData();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactShelter, setContactShelter] = useState<Shelter | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleAddNew = () => {
        setSelectedShelter(null);
        setIsDialogOpen(true);
    };

    const handleManage = (shelter: Shelter) => {
        setSelectedShelter(shelter);
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        setIsDialogOpen(false);
        fetchData(); // Refresh data after save
    };
    
    const handleCancel = () => {
        setIsDialogOpen(false);
    }

    const handleViewDetails = (shelter: Shelter) => {
        navigate(`/shelter/${shelter.id}`);
    };

    const handleContact = (shelter: Shelter) => {
        setContactShelter(shelter);
        setContactDialogOpen(true);
    };

    const totalCapacity = shelters?.reduce((acc, s) => acc + s.capacity, 0) || 0;
    const totalOccupied = shelters?.reduce((acc, s) => acc + (s.capacity - s.availableCapacity), 0) || 0;
    const availableSpaces = totalCapacity - totalOccupied;
    const activeShelters = shelters?.filter(s => s.status === 'Operational').length || 0;
    const emergencyRequests = shelters?.reduce((acc, s) => acc + (s.requests || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedShelter ? "Manage Shelter" : "Add New Shelter"}</DialogTitle>
                        <DialogDescription>
                            {selectedShelter ? "Update the details for this shelter." : "Fill in the details for the new shelter."}
                        </DialogDescription>
                    </DialogHeader>
                    <ShelterForm shelter={selectedShelter} onSave={handleSave} onCancel={handleCancel} />
                </DialogContent>
            </Dialog>

            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Contact Shelter Manager</DialogTitle>
                        <DialogDescription>
                            Get in touch with the shelter manager for urgent matters or coordination.
                        </DialogDescription>
                    </DialogHeader>
                    {contactShelter && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <h3 className="font-semibold text-lg">{contactShelter.name}</h3>
                                <p className="text-sm text-muted-foreground">{contactShelter.location}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">{contactShelter.managerName}</p>
                                        <p className="text-sm text-muted-foreground">Shelter Manager</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                    <Phone className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">{contactShelter.phone}</p>
                                        <p className="text-sm text-muted-foreground">Contact Number</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button asChild className="flex-1">
                                    <a href={`tel:${contactShelter.phone}`}>
                                        <Phone className="mr-2 h-4 w-4" />
                                        Call Now
                                    </a>
                                </Button>
                                <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Shelter Management</h1>
                    <p className="text-muted-foreground">Monitor and manage shelter capacity, operations, and resources</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh Data</Button>
                    <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" />Add New Shelter</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{totalCapacity}</div> }
                        {loading ? <Skeleton className="h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{totalOccupied} occupied</p> }
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Available Spaces</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{availableSpaces}</div>}
                        {loading ? <Skeleton className="h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{totalCapacity > 0 ? `${Math.round((availableSpaces / totalCapacity) * 100)}%` : '0%'} available</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Shelters</CardTitle>
                        <Shield className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{activeShelters}</div>}
                        {loading ? <Skeleton className="h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">of {shelters?.length || 0} total</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Emergency Requests</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{emergencyRequests}</div>}
                        {loading ? <Skeleton className="h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">pending response</p>}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Shelter Overview</TabsTrigger>
                    <TabsTrigger value="capacity">Capacity Management</TabsTrigger>
                    <TabsTrigger value="operations">Operations</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                     {permissionError && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDialogTitle>Permission Denied</AlertDialogTitle>
                            <AlertDesc>
                                You do not have permission to view shelter data. Please check your Firestore security rules to allow read access to the &apos;shelters&apos; collection for administrators.
                            </AlertDesc>
                        </Alert>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                        {loading || !shelters ? (
                             Array.from({ length: 4 }).map((_, i) => (
                                <Card key={i}><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
                            ))
                        ) : shelters.length > 0 ? (
                            shelters.map(shelter => {
                                const currentOccupancy = shelter.capacity - shelter.availableCapacity;
                                const capacityPercentage = shelter.capacity > 0 ? Math.round((currentOccupancy / shelter.capacity) * 100) : 0;
                                const trendInfo = getTrendInfo(shelter.trend);
                                return (
                                    <Card key={shelter.id} className={cn("shadow-sm hover:shadow-md transition-shadow", getCardBorderColor(shelter.status))}>
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-lg">{shelter.name}</CardTitle>
                                                    <p className="text-sm text-muted-foreground">{shelter.organization}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Badge variant={getStatusBadgeVariant(shelter.status)}>{shelter.status}</Badge>
                                                    <Badge variant="secondary">{shelter.requests} Requests</Badge>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="text-center space-y-1">
                                                <p className="text-sm text-muted-foreground">Total Capacity</p>
                                                <p className="text-2xl font-bold">{shelter.capacity}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Progress value={capacityPercentage} className="h-2" />
                                                <div className="flex justify-between text-sm font-medium">
                                                    <p>{currentOccupancy} Occupied</p>
                                                    <p className="text-green-600">{shelter.availableCapacity} Available</p>
                                                </div>
                                            </div>
                                            <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
                                                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {shelter.location}</div>
                                                <div className="flex items-center gap-2"><User className="h-4 w-4" /> Manager: {shelter.managerName}</div>
                                            </div>
                                            <div className="flex justify-between items-center text-sm text-muted-foreground pt-4 border-t">
                                                <div className="flex items-center gap-1">
                                                    {trendInfo.icon}
                                                    <span>{trendInfo.text}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4" />
                                                    <span>{shelter.lastUpdate} ago</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-4 border-t">
                                                <Button size="sm" className="flex-1" onClick={() => handleViewDetails(shelter)}>View Details</Button>
                                                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleContact(shelter)}><Phone className="mr-2 h-4 w-4"/>Contact</Button>
                                                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleManage(shelter)}><Edit className="mr-2 h-4 w-4"/>Manage</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        ) : !permissionError ? (
                            <p className="text-muted-foreground col-span-2 text-center">No shelters found in the database.</p>
                        ) : null}
                    </div>
                </TabsContent>
                <TabsContent value="capacity" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Capacity Management</CardTitle>
                            <CardDescription>View detailed capacity information and manage shelter spaces.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
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
                                    {loading || !shelters ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : shelters.map(shelter => {
                                        const occupied = shelter.capacity - shelter.availableCapacity;
                                        const percentage = shelter.capacity > 0 ? Math.round((occupied / shelter.capacity) * 100) : 0;
                                        return (
                                            <TableRow key={shelter.id}>
                                                <TableCell>
                                                    <div className="font-medium">{shelter.name}</div>
                                                    <div className="text-xs text-muted-foreground">{shelter.location}</div>
                                                </TableCell>
                                                <TableCell><Badge variant={getStatusBadgeVariant(shelter.status)}>{shelter.status}</Badge></TableCell>
                                                <TableCell className="text-right font-medium">{occupied}</TableCell>
                                                <TableCell className="text-right font-medium text-green-600">{shelter.availableCapacity}</TableCell>
                                                <TableCell className="text-right font-medium">{shelter.capacity}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={percentage} className="h-2 w-20"/>
                                                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => handleManage(shelter)}>
                                                        <Edit className="mr-2 h-4 w-4" /> Manage
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="operations" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shelter Operations</CardTitle>
                            <CardDescription>
                                Monitor operational status, requests, and contact managers.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Shelter</TableHead>
                                        <TableHead>Manager</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead className="text-center">Emergency Requests</TableHead>
                                        <TableHead>Occupancy Trend</TableHead>
                                        <TableHead>Last Update</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading || !shelters ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : shelters.map(shelter => {
                                        const trendInfo = getTrendInfo(shelter.trend);
                                        return (
                                            <TableRow key={shelter.id}>
                                                <TableCell className="font-medium">{shelter.name}</TableCell>
                                                <TableCell>{shelter.managerName}</TableCell>
                                                <TableCell>{shelter.phone}</TableCell>
                                                <TableCell className="text-center font-bold">{shelter.requests}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {trendInfo.icon}
                                                        <span>{trendInfo.text}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{shelter.lastUpdate}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="outline" size="sm" asChild>
                                                            <a href={`tel:${shelter.phone}`}><Phone className="mr-2 h-3 w-3" /> Call</a>
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleManage(shelter)}>
                                                            <Edit className="mr-2 h-3 w-3" /> Manage
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
