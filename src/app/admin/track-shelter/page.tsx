
"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type Shelter } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Shield, AlertTriangle, RefreshCw, Plus, MapPin, User, Clock, TrendingUp, TrendingDown, Minus, Phone, Edit, Building2, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InteractiveGoogleMap from "@/components/interactive-google-map";
import { Video } from "lucide-react";
import { useTranslation } from "react-i18next";


const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Operational': return 'success';
        case 'Full': return 'destructive';
        case 'Emergency Only': return 'warning';
        default: return 'secondary';
    }
}

const getTrendInfo = (trend?: string, t?: any) => {
    switch (trend) {
        case 'Increasing': return { icon: <TrendingUp className="h-4 w-4 text-red-500" />, text: t ? t('admin.trackShelter.trend.increasing') : 'Increasing' };
        case 'Decreasing': return { icon: <TrendingDown className="h-4 w-4 text-green-500" />, text: t ? t('admin.trackShelter.trend.decreasing') : 'Decreasing' };
        case 'Stable':
        default: return { icon: <Minus className="h-4 w-4 text-gray-500" />, text: t ? t('admin.trackShelter.trend.stable') : 'Stable' };
    }
}

const getStatusInfo = (status: string, t?: any) => {
    switch (status) {
        case 'Operational': return t ? t('admin.trackShelter.status.operational') : 'Operational';
        case 'Full': return t ? t('admin.trackShelter.status.full') : 'Full';
        case 'Emergency Only': return t ? t('admin.trackShelter.status.emergencyOnly') : 'Emergency Only';
        default: return status;
    }
}

const getCardBorderColor = (status: string) => {
    switch (status) {
        case 'Full': return 'border-red-200 bg-red-50/50';
        case 'Emergency Only': return 'border-yellow-200 bg-yellow-50/50';
        default: return '';
    }
}

const NIGERIAN_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo",
    "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
    "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
    "Sokoto", "Taraba", "Yobe", "Zamfara", "Federal Capital Territory"
];

function ShelterForm({ shelter, onSave, onCancel }: { shelter?: Shelter | null, onSave: () => void, onCancel: () => void }) {
    const { t } = useTranslation();
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
        geofence: [{ lat: 0, lng: 0 }, { lat: 0, lng: 0 }, { lat: 0, lng: 0 }, { lat: 0, lng: 0 }],
        droneVideoUrl: '',
        photoGallery: [],
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

    const handleGeofenceChange = (index: number, field: 'lat' | 'lng', value: string) => {
        const newGeofence = [...(formData.geofence || [{ lat: 0, lng: 0 }, { lat: 0, lng: 0 }, { lat: 0, lng: 0 }, { lat: 0, lng: 0 }])];
        newGeofence[index] = { ...newGeofence[index], [field]: parseFloat(value) || 0 };
        setFormData(prev => ({ ...prev, geofence: newGeofence }));
    };

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
            toast({ title: t('admin.trackShelter.form.imageUploaded') });
        } catch (error) {
            console.error("Upload error:", error);
            toast({ title: t('admin.trackShelter.form.uploadFailed'), variant: "destructive" });
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
                toast({ title: t('admin.trackShelter.form.updated') });
            } else {
                // Create new shelter
                await addDoc(collection(db, "shelters"), formData);
                toast({ title: t('admin.trackShelter.form.created') });
            }
            onSave();
        } catch (error) {
            console.error("Error saving shelter: ", error);
            toast({ title: "Error", description: t('admin.trackShelter.form.saveError'), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto pr-2 sm:pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">{t('admin.trackShelter.form.shelterName')}</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="organization">{t('admin.trackShelter.form.organization')}</Label>
                    <Input id="organization" name="organization" value={formData.organization} onChange={handleChange} />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="location">{t('admin.trackShelter.form.location')}</Label>
                    <Input id="location" name="location" value={formData.location} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="state">{t('admin.trackShelter.form.state')}</Label>
                    <Select
                        value={formData.state}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
                    >
                        <SelectTrigger id="state">
                            <SelectValue placeholder={t('admin.trackShelter.form.selectState')} />
                        </SelectTrigger>
                        <SelectContent>
                            {NIGERIAN_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                    {state}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="capacity">{t('admin.trackShelter.form.totalCapacity')}</Label>
                    <Input id="capacity" name="capacity" type="number" value={formData.capacity} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="availableCapacity">{t('admin.trackShelter.form.availableCapacity')}</Label>
                    <Input id="availableCapacity" name="availableCapacity" type="number" value={formData.availableCapacity} onChange={handleChange} />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="requests">{t('admin.trackShelter.form.emergencyRequests')}</Label>
                    <Input id="requests" name="requests" type="number" value={formData.requests} onChange={handleChange} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="facilities">{t('admin.trackShelter.form.facilities')}</Label>
                <Input id="facilities" name="facilities" value={formData.facilities?.join(', ')} onChange={handleFacilitiesChange} placeholder={t('admin.trackShelter.form.facilitiesPlaceholder')} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="security">{t('admin.trackShelter.form.security')}</Label>
                <Textarea id="security" name="security" value={formData.security} onChange={handleChange} placeholder={t('admin.trackShelter.form.securityPlaceholder')} className="min-h-[80px] sm:min-h-[100px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="managerName">{t('admin.trackShelter.form.managerName')}</Label>
                    <Input id="managerName" name="managerName" value={formData.managerName} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">{t('admin.trackShelter.form.phone')}</Label>
                    <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} />
                </div>
            </div>
            <div className="space-y-2">
                <Label>{t('admin.trackShelter.form.image')}</Label>
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
                            <span className="text-[10px]">{t('admin.trackShelter.form.noImage')}</span>
                        </div>
                    )}
                    <div className="flex-grow space-y-2">
                        <Label htmlFor="shelter-image" className="cursor-pointer">
                            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                                {uploadingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {uploadingImage ? t('admin.trackShelter.form.uploading') : formData.imageUrl ? t('admin.trackShelter.form.changeImage') : t('admin.trackShelter.form.uploadImage')}
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

            <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">Geofence (4 Corner Points)</h3>
                <div className="grid grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2 p-3 border rounded-lg bg-slate-50">
                            <Label className="text-xs font-semibold">Corner {i + 1}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Latitude</Label>
                                    <Input
                                        placeholder="Lat"
                                        type="number"
                                        step="any"
                                        value={formData.geofence?.[i]?.lat || 0}
                                        onChange={(e) => handleGeofenceChange(i, 'lat', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Longitude</Label>
                                    <Input
                                        placeholder="Lng"
                                        type="number"
                                        step="any"
                                        value={formData.geofence?.[i]?.lng || 0}
                                        onChange={(e) => handleGeofenceChange(i, 'lng', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="space-y-2 mt-4 p-3 border rounded-lg bg-blue-50/50">
                    <Label htmlFor="kmlUrl" className="text-sm font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        Google My Maps KML Integration
                    </Label>
                    <Input
                        id="kmlUrl"
                        name="kmlUrl"
                        value={formData.kmlUrl || ''}
                        onChange={handleChange}
                        placeholder="e.g. https://www.google.com/maps/d/u/0/kml?mid=..."
                        className="bg-white"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        To use a Google My Map, make it public and use the KML export link.
                        Example format: <code>.../kml?mid=[MAP_ID]&forcekml=1</code>
                    </p>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">Media Assets</h3>
                <div className="space-y-2">
                    <Label htmlFor="droneVideoUrl">Drone Video URL</Label>
                    <Input
                        id="droneVideoUrl"
                        name="droneVideoUrl"
                        value={formData.droneVideoUrl || ''}
                        onChange={handleChange}
                        placeholder="e.g. https://storage.googleapis.com/videos/drone-view.mp4"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="photoGallery">Photo Gallery (comma-separated URLs)</Label>
                    <Textarea
                        id="photoGallery"
                        name="photoGallery"
                        value={formData.photoGallery?.join(', ') || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, photoGallery: e.target.value.split(',').map(p => p.trim()).filter(Boolean) }))}
                        placeholder="url1, url2, url3"
                        className="min-h-[80px]"
                    />
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
    const { t } = useTranslation();
    const { shelters, loading, permissionError, fetchData } = useAdminData();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactShelter, setContactShelter] = useState<Shelter | null>(null);
    const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
    const navigate = useNavigate();
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
                        <DialogTitle>{selectedShelter ? t('admin.trackShelter.dialogs.manageShelter') : t('admin.trackShelter.dialogs.addShelter')}</DialogTitle>
                        <DialogDescription>
                            {selectedShelter ? t('admin.trackShelter.dialogs.manageDesc') : t('admin.trackShelter.dialogs.addDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <ShelterForm shelter={selectedShelter} onSave={handleSave} onCancel={handleCancel} />
                </DialogContent>
            </Dialog>

            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('admin.trackShelter.dialogs.contactManager')}</DialogTitle>
                        <DialogDescription>
                            {t('admin.trackShelter.dialogs.contactDesc')}
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
                                        <p className="text-sm text-muted-foreground">{t('admin.trackShelter.contact.shelterManager')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                    <Phone className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">{contactShelter.phone}</p>
                                        <p className="text-sm text-muted-foreground">{t('admin.trackShelter.contact.contactNumber')}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button asChild className="w-full sm:flex-1">
                                    <a href={`tel:${contactShelter.phone}`}>
                                        <Phone className="mr-2 h-4 w-4" />
                                        {t('admin.trackShelter.contact.callNow')}
                                    </a>
                                </Button>
                                <Button variant="outline" onClick={() => setContactDialogOpen(false)} className="w-full sm:w-auto">
                                    {t('admin.trackShelter.contact.close')}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">{t('admin.trackShelter.title')}</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">{t('admin.trackShelter.subtitle')}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto"><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />{t('admin.trackShelter.refreshData')}</Button>
                    <Button onClick={handleAddNew} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />{t('admin.trackShelter.addNewShelter')}</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-6">
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">{t('admin.trackShelter.cards.totalCapacity')}</CardTitle>
                        <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{totalCapacity}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{totalOccupied} {t('admin.trackShelter.cards.occupied')}</p>}
                    </CardContent>
                </Card>
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">{t('admin.trackShelter.cards.availableSpaces')}</CardTitle>
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{availableSpaces}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{totalCapacity > 0 ? `${Math.round((availableSpaces / totalCapacity) * 100)}%` : '0%'} {t('admin.trackShelter.cards.available')}</p>}
                    </CardContent>
                </Card>
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">{t('admin.trackShelter.cards.activeShelters')}</CardTitle>
                        <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{activeShelters}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{t('admin.trackShelter.cards.ofTotal', { total: shelters?.length || 0 })}</p>}
                    </CardContent>
                </Card>
                <Card className="max-w-[40vw] sm:max-w-full overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium">{t('admin.trackShelter.cards.emergencyRequests')}</CardTitle>
                        <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        {loading ? <Skeleton className="h-6 sm:h-8 w-1/2" /> : <div className="text-xl sm:text-3xl font-bold">{emergencyRequests}</div>}
                        {loading ? <Skeleton className="h-3 sm:h-4 w-1/3 mt-1" /> : <p className="text-xs text-muted-foreground">{t('admin.trackShelter.cards.pendingResponse')}</p>}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview">
                <TabsList className="w-full overflow-x-auto justify-start h-auto p-1 bg-muted/50">
                    <TabsTrigger value="overview" className="px-4 py-2">{t('admin.trackShelter.tabs.overview')}</TabsTrigger>
                    <TabsTrigger value="map" className="px-4 py-2">{t('admin.trackShelter.tabs.map')}</TabsTrigger>
                    <TabsTrigger value="capacity" className="px-4 py-2">
                        <span className="sm:hidden text-center">{t('admin.trackShelter.tabs.capacityMobile')}</span>
                        <span className="hidden sm:inline">{t('admin.trackShelter.tabs.capacity')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="media" className="px-4 py-2">{t('admin.trackShelter.tabs.media')}</TabsTrigger>
                    <TabsTrigger value="operations" className="px-4 py-2 truncate">{t('admin.trackShelter.tabs.operations')}</TabsTrigger>
                </TabsList>
                <TabsContent value="map" className="mt-6">
                    <Card className="overflow-hidden border-0 shadow-lg">
                        <CardHeader className="bg-slate-900 text-white p-4">
                            <div className="flex justify-between items-center text-white">
                                <div>
                                    <CardTitle className="text-xl">{t('admin.trackShelter.map.title')}</CardTitle>
                                    <p className="text-slate-400 text-sm">{t('admin.trackShelter.map.desc')}</p>
                                </div>
                                <div className="flex gap-4 text-sm mt-auto">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-400 opacity-50 border border-red-500 rounded-sm"></div>
                                        <span>{t('admin.trackShelter.map.perimeter')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <span>{t('admin.trackShelter.map.operational')}</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 relative">
                            <InteractiveGoogleMap
                                mode="tracking"
                                className="h-[600px] w-full"
                                geofences={shelters?.map(s => s.geofence).filter(Boolean) as any}
                                kmlUrls={shelters?.map(s => s.kmlUrl).filter(Boolean) as string[]}
                            />
                            {/* Overlay info box */}
                            <div className="absolute top-4 right-4 z-10 space-y-2 pointer-events-none">
                                {shelters?.map(s => (
                                    <div key={s.id} className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border text-[10px] w-48 pointer-events-auto">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold truncate pr-2">{s.name}</span>
                                            <Badge variant={getStatusBadgeVariant(s.status)} className="scale-75 origin-right">{getStatusInfo(s.status, t)}</Badge>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>{t('admin.trackShelter.map.occupancy')}</span>
                                            <span className="font-medium text-slate-900">{Math.round(((s.capacity - s.availableCapacity) / s.capacity) * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 h-1 rounded-full mt-1">
                                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${((s.capacity - s.availableCapacity) / s.capacity) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="overview" className="mt-6">
                    {permissionError && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDialogTitle>{t('admin.trackShelter.overview.permissionDenied')}</AlertDialogTitle>
                            <AlertDesc>
                                {t('admin.trackShelter.overview.permissionDeniedDesc')}
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
                                const trendInfo = getTrendInfo(shelter.trend, t);
                                return (
                                    <Card key={shelter.id} className={cn("shadow-sm hover:shadow-md transition-shadow max-w-[50vw] sm:max-w-full overflow-hidden", getCardBorderColor(shelter.status))}>
                                        <CardHeader className="p-2 sm:p-6">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                                <div>
                                                    <CardTitle className="text-base sm:text-lg">{shelter.name}</CardTitle>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">{shelter.organization}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-1 sm:gap-2">
                                                    <Badge variant={getStatusBadgeVariant(shelter.status)} className="text-xs">{getStatusInfo(shelter.status, t)}</Badge>
                                                    <Badge variant="secondary" className="text-xs">{shelter.requests} {t('admin.trackShelter.overview.requests')}</Badge>
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
                                                        <img
                                                            src={shelter.imageUrl}
                                                            alt={shelter.name}
                                                            className="w-full h-full object-cover"
                                                            crossOrigin="anonymous"
                                                        />
                                                    </div>
                                                )}
                                                <div className={cn("flex-1 text-center sm:text-left space-y-1", !shelter.imageUrl && "text-center")}>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">{t('admin.trackShelter.overview.totalCapacity')}</p>
                                                    <p className="text-xl sm:text-2xl font-bold">{shelter.capacity}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Progress value={capacityPercentage} className="h-1 sm:h-2" />
                                                <div className="flex justify-between text-xs sm:text-sm font-medium">
                                                    <p>{currentOccupancy} {t('admin.trackShelter.overview.occupied')}</p>
                                                    <p className="text-green-600">{shelter.availableCapacity} {t('admin.trackShelter.overview.available')}</p>
                                                </div>
                                            </div>
                                            <div className="text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-2 pt-2 sm:pt-4 border-t">
                                                <div className="flex items-center gap-1 sm:gap-2"><MapPin className="h-3 w-3 sm:h-4 sm:w-4" /> {shelter.location}</div>
                                                <div className="flex items-center gap-1 sm:gap-2"><User className="h-3 w-3 sm:h-4 sm:w-4" /> {t('admin.trackShelter.overview.manager')} {shelter.managerName}</div>
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
                                                <Button size="sm" className="w-full sm:flex-1" onClick={() => handleViewDetails(shelter)}>{t('admin.trackShelter.overview.viewDetails')}</Button>
                                                <Button size="sm" variant="outline" className="w-full sm:flex-1" onClick={() => handleContact(shelter)}><Phone className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />{t('admin.trackShelter.overview.contact')}</Button>
                                                <Button size="sm" variant="outline" className="w-full sm:flex-1" onClick={() => handleManage(shelter)}><Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />{t('admin.trackShelter.overview.manage')}</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        ) : !permissionError ? (
                            <p className="text-muted-foreground col-span-2 text-center">{t('admin.trackShelter.overview.noShelters')}</p>
                        ) : null}
                    </div>
                </TabsContent>
                <TabsContent value="media" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {shelters?.filter(s => s.droneVideoUrl || (s.photoGallery && s.photoGallery.length > 0)).map(shelter => (
                            <Card key={shelter.id} className="overflow-hidden flex flex-col">
                                <CardHeader className="p-4 bg-slate-50 border-b">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="text-lg">{shelter.name}</CardTitle>
                                            <CardDescription>{shelter.organization}</CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            {shelter.droneVideoUrl && <Badge variant="secondary" className="gap-1"><Video className="h-3 w-3" /> {t('admin.trackShelter.media.droneView')}</Badge>}
                                            {shelter.photoGallery && <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" /> {shelter.photoGallery.length} {t('admin.trackShelter.media.photos')}</Badge>}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4 flex-grow">
                                    {/* Drone Video Section */}
                                    {shelter.droneVideoUrl && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold flex items-center gap-2"><Video className="h-4 w-4" /> {t('admin.trackShelter.media.droneFootage')}</h4>
                                            <div className="aspect-video bg-black rounded-lg overflow-hidden border">
                                                {/* Simple Video Player Placeholder - in production this would be a real player */}
                                                <div className="w-full h-full flex flex-col items-center justify-center text-white/50 space-y-2 bg-slate-900">
                                                    {shelter.droneVideoUrl.includes('youtube.com') || shelter.droneVideoUrl.includes('youtu.be') ? (
                                                        <div className="text-center p-4">
                                                            <p className="text-xs mb-2">{t('admin.trackShelter.media.youtubeStream')}</p>
                                                            <Button size="sm" variant="outline" className="text-white border-white/20 hover:bg-white/10" asChild>
                                                                <a href={shelter.droneVideoUrl} target="_blank" rel="noopener noreferrer">{t('admin.trackShelter.media.openYoutube')}</a>
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <video
                                                            src={shelter.droneVideoUrl}
                                                            controls
                                                            className="w-full h-full object-cover"
                                                            poster={shelter.imageUrl}
                                                        >
                                                            {t('admin.trackShelter.media.videoNotSupported')}
                                                        </video>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Photo Gallery Section */}
                                    {shelter.photoGallery && shelter.photoGallery.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> {t('admin.trackShelter.media.infrastructurePhotos')}</h4>
                                            <div className="grid grid-cols-3 gap-2">
                                                {shelter.photoGallery.map((url, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="aspect-square rounded-md overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => setSelectedPreviewImage(url)}
                                                    >
                                                        <img src={url} alt={`Shelter asset ${idx + 1}`} className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(!shelter.droneVideoUrl && (!shelter.photoGallery || shelter.photoGallery.length === 0)) && (
                                        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                                            <Building2 className="h-8 w-8 mb-2 opacity-20" />
                                            <p className="text-sm font-medium">{t('admin.trackShelter.media.noMedia')}</p>
                                            <Button variant="link" size="sm" onClick={() => handleManage(shelter)}>{t('admin.trackShelter.media.addMedia')}</Button>
                                        </div>
                                    )}
                                </CardContent>
                                <div className="p-3 bg-slate-50 border-t mt-auto flex justify-between items-center text-xs text-muted-foreground">
                                    <span>{t('admin.trackShelter.media.lastInspection')} {shelter.lastUpdate}</span>
                                    <Button size="sm" variant="ghost" className="h-8 text-blue-600" onClick={() => handleViewDetails(shelter)}>{t('admin.trackShelter.media.fullReport')}</Button>
                                </div>
                            </Card>
                        ))}

                        {shelters?.filter(s => s.droneVideoUrl || (s.photoGallery && s.photoGallery.length > 0)).length === 0 && (
                            <Card className="col-span-full py-12 flex flex-col items-center justify-center border-dashed">
                                <Video className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                <h3 className="text-lg font-semibold">{t('admin.trackShelter.media.noAssets')}</h3>
                                <p className="text-muted-foreground max-w-sm text-center mt-2">
                                    {t('admin.trackShelter.media.noAssetsDesc')}
                                </p>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="capacity" className="mt-6">
                    <Card className="max-w-4xl overflow-hidden">
                        <CardHeader className="p-3 sm:p-6">
                            <CardTitle className="text-lg sm:text-xl">{t('admin.trackShelter.capacity.title')}</CardTitle>
                            <CardDescription className="text-sm sm:text-base">{t('admin.trackShelter.capacity.desc')}</CardDescription>
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
                                                            <p className="text-muted-foreground">{t('admin.trackShelter.capacity.occupied')}</p>
                                                            <p className="font-medium">{occupied}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">{t('admin.trackShelter.capacity.available')}</p>
                                                            <p className="font-medium text-green-600">{shelter.availableCapacity}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">{t('admin.trackShelter.capacity.total')}</p>
                                                            <p className="font-medium">{shelter.capacity}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground mb-2">{t('admin.trackShelter.capacity.occupancy')}</p>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={percentage} className="h-2 flex-1" />
                                                            <span className="text-xs text-muted-foreground">{percentage}%</span>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => handleManage(shelter)} className="w-full">
                                                        <Edit className="mr-2 h-4 w-4" /> {t('admin.trackShelter.capacity.manage')}
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
                                                <TableHead className="min-w-[100px]">{t('admin.trackShelter.capacity.table.shelter')}</TableHead>
                                                <TableHead className="min-w-[80px]">{t('admin.trackShelter.capacity.table.status')}</TableHead>
                                                <TableHead className="text-right min-w-[60px]">{t('admin.trackShelter.capacity.table.occupied')}</TableHead>
                                                <TableHead className="text-right min-w-[60px]">{t('admin.trackShelter.capacity.table.available')}</TableHead>
                                                <TableHead className="text-right min-w-[60px]">{t('admin.trackShelter.capacity.table.total')}</TableHead>
                                                <TableHead className="min-w-[100px]">{t('admin.trackShelter.capacity.table.occupancy')}</TableHead>
                                                <TableHead className="text-right min-w-[80px]">{t('admin.trackShelter.capacity.table.actions')}</TableHead>
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
                                                                <Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> {t('admin.trackShelter.capacity.manage')}
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
                            <CardTitle className="text-lg sm:text-xl">{t('admin.trackShelter.operations.title')}</CardTitle>
                            <CardDescription className="text-sm sm:text-base">
                                {t('admin.trackShelter.operations.desc')}
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
                                                            <p className="text-muted-foreground">{t('admin.trackShelter.operations.manager')}</p>
                                                            <p className="font-medium">{shelter.managerName}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">{t('admin.trackShelter.operations.contact')}</p>
                                                            <p className="font-medium">{shelter.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground">{t('admin.trackShelter.operations.emergencyRequests')}</p>
                                                            <p className="font-bold">{shelter.requests}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">{t('admin.trackShelter.operations.occupancyTrend')}</p>
                                                            <div className="flex items-center gap-1">
                                                                {trendInfo.icon}
                                                                <span>{trendInfo.text}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">{t('admin.trackShelter.operations.lastUpdate')}</p>
                                                        <p className="text-sm">{formatTimestamp(shelter.lastUpdate)}</p>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button variant="outline" size="sm" asChild className="w-full">
                                                            <a href={`tel:${shelter.phone}`}><Phone className="mr-2 h-4 w-4" /> {t('admin.trackShelter.operations.call')}</a>
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleManage(shelter)} className="w-full">
                                                            <Edit className="mr-2 h-4 w-4" /> {t('admin.trackShelter.operations.manage')}
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
                                                <TableHead className="min-w-[100px]">{t('admin.trackShelter.operations.table.shelter')}</TableHead>
                                                <TableHead className="min-w-[80px]">{t('admin.trackShelter.operations.table.manager')}</TableHead>
                                                <TableHead className="min-w-[80px]">{t('admin.trackShelter.operations.table.contact')}</TableHead>
                                                <TableHead className="text-center min-w-[100px]">{t('admin.trackShelter.operations.table.requests')}</TableHead>
                                                <TableHead className="min-w-[100px]">{t('admin.trackShelter.operations.table.trend')}</TableHead>
                                                <TableHead className="min-w-[80px]">{t('admin.trackShelter.operations.table.lastUpdate')}</TableHead>
                                                <TableHead className="text-right min-w-[120px]">{t('admin.trackShelter.operations.table.actions')}</TableHead>
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
                                                                    <a href={`tel:${shelter.phone}`}><Phone className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> {t('admin.trackShelter.operations.call')}</a>
                                                                </Button>
                                                                <Button variant="outline" size="sm" onClick={() => handleManage(shelter)} className="w-full sm:w-auto">
                                                                    <Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> {t('admin.trackShelter.operations.manage')}
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
