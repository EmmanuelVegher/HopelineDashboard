
"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type Shelter } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bed, CheckCircle, Shield, AlertTriangle, RefreshCw, Plus, MapPin, User, Clock, TrendingUp, TrendingDown, Minus, Phone, Edit, Building2, X } from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import { useState, useEffect } from "react";
import { addDoc, updateDoc, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

    const [uploadingImage, setUploadingImage] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setUploadingImage(true);
        try {
            const storage = getStorage();
            const storageRef = ref(storage, `shelters/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
            toast({ title: "Image Uploaded", description: "Shelter image uploaded successfully." });
        } catch (error) {
            console.error("Upload error:", error);
            toast({ title: "Upload Failed", description: "Could not upload image.", variant: "destructive" });
        } finally {
            setUploadingImage(false);
        }
    };

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
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto pr-2 sm:pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="capacity">Total Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" value={formData.capacity} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="availableCapacity">Available Capacity</Label>
                    <Input id="availableCapacity" name="availableCapacity" type="number" value={formData.availableCapacity} onChange={handleChange} />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                <Textarea id="security" name="security" value={formData.security} onChange={handleChange} placeholder="Describe security measures..." className="min-h-[80px] sm:min-h-[100px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="managerName">Manager Name</Label>
                    <Input id="managerName" name="managerName" value={formData.managerName} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Contact Phone</Label>
                    <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Shelter Image</Label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-lg bg-slate-50">
                    {formData.imageUrl ? (
                        <div className="relative w-full sm:w-32 h-32 rounded-md overflow-hidden border">
                            <img src={formData.imageUrl} alt="Shelter" className="w-full h-full object-cover" />
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                            >
                                <Plus className="h-4 w-4 rotate-45" />
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full sm:w-32 h-32 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground bg-white">
                            <Building2 className="h-8 w-8 mb-1 opacity-20" />
                            <span className="text-[10px]">No Image</span>
                        </div>
                    )}
                    <div className="flex-grow space-y-2">
                        <Label htmlFor="shelter-image" className="cursor-pointer">
                            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                                {uploadingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {uploadingImage ? 'Uploading...' : formData.imageUrl ? 'Change Image' : 'Upload Shelter Image'}
                            </div>
                        </Label>
                        <Input
                            id="shelter-image"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                        />
                        <p className="text-[10px] text-muted-foreground">Recommend 800x600px or larger. Max 5MB.</p>
                    </div>
                </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">{loading ? 'Saving...' : 'Save Shelter'}</Button>
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
    const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
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
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button asChild className="w-full sm:flex-1">
                                    <a href={`tel:${contactShelter.phone}`}>
                                        <Phone className="mr-2 h-4 w-4" />
                                        Call Now
                                    </a>
                                </Button>
                                <Button variant="outline" onClick={() => setContactDialogOpen(false)} className="w-full sm:w-auto">
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Shelter Management</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Monitor and manage shelter capacity, operations, and resources</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto"><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh Data</Button>
                    <Button onClick={handleAddNew} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Add New Shelter</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-6">
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Total Capacity</CardTitle>
                        <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{totalCapacity}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{totalOccupied} occupied</p>}
                    </CardContent>
                </Card>
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Available Spaces</CardTitle>
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{availableSpaces}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{totalCapacity > 0 ? `${Math.round((availableSpaces / totalCapacity) * 100)}%` : '0%'} available</p>}
                    </CardContent>
                </Card>
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Active Shelters</CardTitle>
                        <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{activeShelters}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">of {shelters?.length || 0} total</p>}
                    </CardContent>
                </Card>
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">Emergency Requests</CardTitle>
                        <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{emergencyRequests}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">pending response</p>}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview">
                <TabsList className="w-full overflow-x-auto">
                    <TabsTrigger value="overview" className="truncate">Shelter Overview</TabsTrigger>
                    <TabsTrigger value="capacity">
                        <span className="sm:hidden text-center">Capacity<br />Management</span>
                        <span className="hidden sm:inline">Capacity Management</span>
                    </TabsTrigger>
                    <TabsTrigger value="operations" className="truncate">Operations</TabsTrigger>
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 overflow-x-auto">
                        {loading || !shelters ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <Card key={i} className="max-w-[90vw] sm:max-w-full"><CardContent className="p-2 sm:p-6"><Skeleton className="h-48 sm:h-64 w-full" /></CardContent></Card>
                            ))
                        ) : shelters.length > 0 ? (
                            shelters.map(shelter => {
                                const currentOccupancy = shelter.capacity - shelter.availableCapacity;
                                const capacityPercentage = shelter.capacity > 0 ? Math.round((currentOccupancy / shelter.capacity) * 100) : 0;
                                const trendInfo = getTrendInfo(shelter.trend);
                                return (
                                    <Card key={shelter.id} className={cn("shadow-sm hover:shadow-md transition-shadow max-w-[50vw] sm:max-w-full overflow-hidden", getCardBorderColor(shelter.status))}>
                                        <CardHeader className="p-2 sm:p-6">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                                <div>
                                                    <CardTitle className="text-base sm:text-lg">{shelter.name}</CardTitle>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">{shelter.organization}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-1 sm:gap-2">
                                                    <Badge variant={getStatusBadgeVariant(shelter.status)} className="text-xs">{shelter.status}</Badge>
                                                    <Badge variant="secondary" className="text-xs">{shelter.requests} Requests</Badge>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-2 sm:p-6 space-y-2 sm:space-y-4">
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                {shelter.imageUrl && (
                                                    <div
                                                        className="w-full sm:w-1/3 h-32 sm:h-auto rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => setSelectedPreviewImage(shelter.imageUrl!)}
                                                    >
                                                        <img src={shelter.imageUrl} alt={shelter.name} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className={cn("flex-1 text-center sm:text-left space-y-1", !shelter.imageUrl && "text-center")}>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">Total Capacity</p>
                                                    <p className="text-xl sm:text-2xl font-bold">{shelter.capacity}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Progress value={capacityPercentage} className="h-1 sm:h-2" />
                                                <div className="flex justify-between text-xs sm:text-sm font-medium">
                                                    <p>{currentOccupancy} Occupied</p>
                                                    <p className="text-green-600">{shelter.availableCapacity} Available</p>
                                                </div>
                                            </div>
                                            <div className="text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-2 pt-2 sm:pt-4 border-t">
                                                <div className="flex items-center gap-1 sm:gap-2"><MapPin className="h-3 w-3 sm:h-4 sm:w-4" /> {shelter.location}</div>
                                                <div className="flex items-center gap-1 sm:gap-2"><User className="h-3 w-3 sm:h-4 sm:w-4" /> Manager: {shelter.managerName}</div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm text-muted-foreground pt-2 sm:pt-4 border-t gap-1">
                                                <div className="flex items-center gap-1">
                                                    {trendInfo.icon}
                                                    <span>{trendInfo.text}</span>
                                                </div>
                                                <div className="flex items-center gap-1 sm:gap-2">
                                                    <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    <span>{formatTimestamp(shelter.lastUpdate)}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 pt-2 sm:pt-4 border-t">
                                                <Button size="sm" className="w-full sm:flex-1" onClick={() => handleViewDetails(shelter)}>View Details</Button>
                                                <Button size="sm" variant="outline" className="w-full sm:flex-1" onClick={() => handleContact(shelter)}><Phone className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />Contact</Button>
                                                <Button size="sm" variant="outline" className="w-full sm:flex-1" onClick={() => handleManage(shelter)}><Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />Manage</Button>
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
                    <Card className="max-w-4xl overflow-hidden">
                        <CardHeader className="p-3 sm:p-6">
                            <CardTitle className="text-lg sm:text-xl">Capacity Management</CardTitle>
                            <CardDescription className="text-sm sm:text-base">View detailed capacity information and manage shelter spaces.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-2 sm:p-6">
                            {/* Mobile Card Layout */}
                            <div className="block md:hidden">
                                <div className="grid grid-cols-1 gap-4">
                                    {loading || !shelters ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <Card key={i} className="p-4">
                                                <Skeleton className="h-6 w-3/4 mb-2" />
                                                <Skeleton className="h-4 w-1/2 mb-2" />
                                                <Skeleton className="h-4 w-full mb-2" />
                                                <Skeleton className="h-8 w-24" />
                                            </Card>
                                        ))
                                    ) : shelters.map(shelter => {
                                        const occupied = shelter.capacity - shelter.availableCapacity;
                                        const percentage = shelter.capacity > 0 ? Math.round((occupied / shelter.capacity) * 100) : 0;
                                        return (
                                            <Card key={shelter.id} className="p-4">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-start gap-3">
                                                            {shelter.imageUrl && (
                                                                <div
                                                                    className="w-12 h-12 rounded border overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                                    onClick={() => setSelectedPreviewImage(shelter.imageUrl!)}
                                                                >
                                                                    <img src={shelter.imageUrl} alt={shelter.name} className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <h3 className="font-medium text-base">{shelter.name}</h3>
                                                                <p className="text-sm text-muted-foreground">{shelter.location}</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant={getStatusBadgeVariant(shelter.status)}>{shelter.status}</Badge>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground">Occupied</p>
                                                            <p className="font-medium">{occupied}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Available</p>
                                                            <p className="font-medium text-green-600">{shelter.availableCapacity}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Total</p>
                                                            <p className="font-medium">{shelter.capacity}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground mb-2">Occupancy</p>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={percentage} className="h-2 flex-1" />
                                                            <span className="text-xs text-muted-foreground">{percentage}%</span>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => handleManage(shelter)} className="w-full">
                                                        <Edit className="mr-2 h-4 w-4" /> Manage
                                                    </Button>
                                                </div>
                                            </Card>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Desktop Table Layout */}
                            <div className="hidden md:block">
                                <div className="w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[100px]">Shelter</TableHead>
                                                <TableHead className="min-w-[80px]">Status</TableHead>
                                                <TableHead className="text-right min-w-[60px]">Occupied</TableHead>
                                                <TableHead className="text-right min-w-[60px]">Available</TableHead>
                                                <TableHead className="text-right min-w-[60px]">Total</TableHead>
                                                <TableHead className="min-w-[100px]">Occupancy</TableHead>
                                                <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading || !shelters ? (
                                                Array.from({ length: 3 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell><Skeleton className="h-4 w-32 sm:w-40" /></TableCell>
                                                        <TableCell><Skeleton className="h-6 w-16 sm:w-20" /></TableCell>
                                                        <TableCell className="text-right"><Skeleton className="h-4 w-8 sm:w-10 ml-auto" /></TableCell>
                                                        <TableCell className="text-right"><Skeleton className="h-4 w-8 sm:w-10 ml-auto" /></TableCell>
                                                        <TableCell className="text-right"><Skeleton className="h-4 w-8 sm:w-10 ml-auto" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-20 sm:w-24" /></TableCell>
                                                        <TableCell className="text-right"><Skeleton className="h-8 w-16 sm:w-20 ml-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : shelters.map(shelter => {
                                                const occupied = shelter.capacity - shelter.availableCapacity;
                                                const percentage = shelter.capacity > 0 ? Math.round((occupied / shelter.capacity) * 100) : 0;
                                                return (
                                                    <TableRow key={shelter.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                {shelter.imageUrl && (
                                                                    <div
                                                                        className="w-10 h-10 rounded border overflow-hidden flex-shrink-0 hidden sm:block cursor-pointer hover:opacity-80 transition-opacity"
                                                                        onClick={() => setSelectedPreviewImage(shelter.imageUrl!)}
                                                                    >
                                                                        <img src={shelter.imageUrl} alt={shelter.name} className="w-full h-full object-cover" />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-medium text-sm sm:text-base">{shelter.name}</div>
                                                                    <div className="text-xs text-muted-foreground">{shelter.location}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell><Badge variant={getStatusBadgeVariant(shelter.status)} className="text-xs">{shelter.status}</Badge></TableCell>
                                                        <TableCell className="text-right font-medium text-sm sm:text-base">{occupied}</TableCell>
                                                        <TableCell className="text-right font-medium text-green-600 text-sm sm:text-base">{shelter.availableCapacity}</TableCell>
                                                        <TableCell className="text-right font-medium text-sm sm:text-base">{shelter.capacity}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Progress value={percentage} className="h-2 w-16 sm:w-20" />
                                                                <span className="text-xs text-muted-foreground">{percentage}%</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="outline" size="sm" onClick={() => handleManage(shelter)} className="text-xs sm:text-sm">
                                                                <Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Manage
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="operations" className="mt-6">
                    <Card className="max-w-full overflow-hidden">
                        <CardHeader className="p-3 sm:p-6">
                            <CardTitle className="text-lg sm:text-xl">Shelter Operations</CardTitle>
                            <CardDescription className="text-sm sm:text-base">
                                Monitor operational status, requests, and contact managers.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-2 sm:p-6">
                            {/* Mobile Card Layout */}
                            <div className="block md:hidden">
                                <div className="grid grid-cols-1 gap-4">
                                    {loading || !shelters ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <Card key={i} className="p-4">
                                                <Skeleton className="h-6 w-3/4 mb-2" />
                                                <Skeleton className="h-4 w-1/2 mb-2" />
                                                <Skeleton className="h-4 w-full mb-2" />
                                                <Skeleton className="h-8 w-24" />
                                            </Card>
                                        ))
                                    ) : shelters.map(shelter => {
                                        const trendInfo = getTrendInfo(shelter.trend);
                                        return (
                                            <Card key={shelter.id} className="p-4">
                                                <div className="space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        {shelter.imageUrl && (
                                                            <div
                                                                className="w-12 h-12 rounded border overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                                onClick={() => setSelectedPreviewImage(shelter.imageUrl!)}
                                                            >
                                                                <img src={shelter.imageUrl} alt={shelter.name} className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <h3 className="font-medium text-base">{shelter.name}</h3>
                                                            <p className="text-sm text-muted-foreground">{shelter.location}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground">Manager</p>
                                                            <p className="font-medium">{shelter.managerName}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Contact</p>
                                                            <p className="font-medium">{shelter.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground">Emergency Requests</p>
                                                            <p className="font-bold">{shelter.requests}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Occupancy Trend</p>
                                                            <div className="flex items-center gap-1">
                                                                {trendInfo.icon}
                                                                <span>{trendInfo.text}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Last Update</p>
                                                        <p className="text-sm">{formatTimestamp(shelter.lastUpdate)}</p>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button variant="outline" size="sm" asChild className="w-full">
                                                            <a href={`tel:${shelter.phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a>
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleManage(shelter)} className="w-full">
                                                            <Edit className="mr-2 h-4 w-4" /> Manage
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Desktop Table Layout */}
                            <div className="hidden md:block">
                                <div className="w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[100px]">Shelter</TableHead>
                                                <TableHead className="min-w-[80px]">Manager</TableHead>
                                                <TableHead className="min-w-[80px]">Contact</TableHead>
                                                <TableHead className="text-center min-w-[100px]">Emergency Requests</TableHead>
                                                <TableHead className="min-w-[100px]">Occupancy Trend</TableHead>
                                                <TableHead className="min-w-[80px]">Last Update</TableHead>
                                                <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading || !shelters ? (
                                                Array.from({ length: 3 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell><Skeleton className="h-4 w-24 sm:w-32" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-20 sm:w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-20 sm:w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-10 sm:w-12 mx-auto" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-16 sm:w-20" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-16 sm:w-20" /></TableCell>
                                                        <TableCell className="text-right"><Skeleton className="h-8 w-20 sm:w-24 ml-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : shelters.map(shelter => {
                                                const trendInfo = getTrendInfo(shelter.trend);
                                                return (
                                                    <TableRow key={shelter.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                {shelter.imageUrl && (
                                                                    <div
                                                                        className="w-10 h-10 rounded border overflow-hidden flex-shrink-0 hidden sm:block cursor-pointer hover:opacity-80 transition-opacity"
                                                                        onClick={() => setSelectedPreviewImage(shelter.imageUrl!)}
                                                                    >
                                                                        <img src={shelter.imageUrl} alt={shelter.name} className="w-full h-full object-cover" />
                                                                    </div>
                                                                )}
                                                                <div className="font-medium text-sm sm:text-base">{shelter.name}</div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm sm:text-base">{shelter.managerName}</TableCell>
                                                        <TableCell className="text-sm sm:text-base">{shelter.phone}</TableCell>
                                                        <TableCell className="text-center font-bold text-sm sm:text-base">{shelter.requests}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                {trendInfo.icon}
                                                                <span className="text-sm sm:text-base">{trendInfo.text}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm sm:text-base">{formatTimestamp(shelter.lastUpdate)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 justify-end">
                                                                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                                                                    <a href={`tel:${shelter.phone}`}><Phone className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Call</a>
                                                                </Button>
                                                                <Button variant="outline" size="sm" onClick={() => handleManage(shelter)} className="w-full sm:w-auto">
                                                                    <Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Manage
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Image Full-screen Light-box */}
            {selectedPreviewImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200"
                    onClick={() => setSelectedPreviewImage(null)}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/10 z-[110]"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPreviewImage(null);
                        }}
                    >
                        <X className="h-8 w-8" />
                    </Button>
                    <img
                        src={selectedPreviewImage}
                        alt="Shelter Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
