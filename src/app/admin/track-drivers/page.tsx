
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Driver, type Vehicle } from "@/lib/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle as AlertDialogTitle } from "@/components/ui/alert";
import { Car, CheckCircle, Send as SendIcon, AlertTriangle, Search, Filter, MapPinned, Briefcase, Clock, Phone, MessageSquare, RefreshCw, Plus, Edit, ImagePlus, Trash2, Mail, Calendar, Target, Activity, Play, Pause, RotateCcw } from "lucide-react";
import { cn, calculateETA, formatTimestamp } from "@/lib/utils";
import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db, storage, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { NIGERIA_STATE_BOUNDS } from "@/lib/nigeria-geography";
import DriverMap from "@/components/driver-map";
import GPSTroubleshootingDialog from "@/components/gps-troubleshooting-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { type SosAlert, type Vehicle as SosVehicle } from "@/ai/schemas/sos";
import { useTranslation } from "react-i18next";


const getStatusStyles = (status: string) => {
    switch (status) {
        case 'En Route':
        case 'Assisting':
            return {
                badgeVariant: 'warning' as const,
                cardClass: 'border-yellow-200 bg-yellow-50/50',
                icon: <SendIcon className="h-4 w-4 text-yellow-600" />
            };
        case 'Emergency':
            return {
                badgeVariant: 'destructive' as const,
                cardClass: 'border-red-200 bg-red-50/50',
                icon: <AlertTriangle className="h-4 w-4 text-red-600" />
            };
        case 'Available':
            return {
                badgeVariant: 'success' as const,
                cardClass: '',
                icon: <CheckCircle className="h-4 w-4 text-green-600" />
            };
        case 'Off Duty':
        default:
            return {
                badgeVariant: 'secondary' as const,
                cardClass: '',
                icon: <Car className="h-4 w-4 text-gray-600" />
            };
    }
}

const initialDriverState: Partial<Driver & { role: string; email: string }> = {
    name: '',
    vehicle: '',
    phone: '',
    email: '',
    location: 'Base Station',
    status: 'Available',
    task: 'Awaiting Assignment',
    role: 'driver',
    lastUpdate: new Date().toLocaleTimeString(),
    vehicleImageUrl: '',
    state: '',
    password: '',
};

function DriverForm({ driver, onSave, onCancel }: { driver?: Driver | null, onSave: () => void, onCancel: () => void }) {
    const [formData, setFormData] = useState<Partial<Driver & { role: string; email: string; password?: string; state?: string }>>(initialDriverState);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { t } = useTranslation();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Role-based logic
    const { adminProfile } = useAdminData();
    const adminRole = adminProfile?.role?.toLowerCase() || '';
    const isSuperAdmin = adminRole.includes('super');
    const adminState = adminProfile?.state || '';
    const states = Object.keys(NIGERIA_STATE_BOUNDS).sort();

    useEffect(() => {
        if (driver) {
            setFormData(driver);
            if (driver.vehicleImageUrl) {
                setImagePreview(driver.vehicleImageUrl);
            } else {
                setImagePreview(null);
            }
        } else {
            setFormData({
                ...initialDriverState,
                state: isSuperAdmin ? '' : adminState
            });
            setImagePreview(null);
        }
        // Clean up blob URL
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
        }
    }, [driver, isSuperAdmin, adminState]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleStatusChange = (value: Driver['status']) => {
        setFormData(prev => ({ ...prev, status: value }));
    }

    const handleRoleChange = (value: string) => {
        setFormData(prev => ({ ...prev, role: value }));
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
        }
    };

    const handleImageRemove = () => {
        setImageFile(null);
        setImagePreview(null);
        setFormData(prev => ({ ...prev, vehicleImageUrl: '' }));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let imageUrl = formData.vehicleImageUrl || '';

        if (imageFile) {
            const storageRef = ref(storage, `driver-vehicles/${Date.now()}_${imageFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, imageFile);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    },
                    (error) => {
                        console.error("Upload failed:", error);
                        toast({ title: t("admin.trackDrivers.toasts.imageUploadFailed"), description: t("admin.trackDrivers.toasts.imageUploadFailedDesc"), variant: "destructive" });
                        setLoading(false);
                        reject(error);
                    },
                    async () => {
                        try {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            imageUrl = downloadURL;
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
            });
        }


        try {
            const dataToSave: Partial<Driver & { role: string; email: string; state?: string }> = {
                ...formData,
                vehicleImageUrl: imageUrl,
                lastUpdate: new Date().toLocaleTimeString()
            };

            if (driver?.id) {
                // Update existing user via Firestore directly (Auth update not handled here for simplicity)
                const userRef = doc(db, "users", driver.id);
                // Remove password from update if it exists
                const { password, ...updateData } = dataToSave as any;
                await updateDoc(userRef, updateData);
                toast({ title: t("admin.trackDrivers.toasts.success"), description: t("admin.trackDrivers.toasts.teamMemberUpdated") });
                onSave();
            } else {
                // Create new user via Cloud Function
                if (!formData.password || formData.password.length < 6) {
                    toast({ title: t("admin.trackDrivers.toasts.validationError"), description: t("admin.trackDrivers.toasts.passwordMinLength"), variant: "destructive" });
                    setLoading(false);
                    return;
                }

                // Call Cloud Function
                const createTeamMember = httpsCallable(functions, 'createTeamMember');
                await createTeamMember({
                    email: formData.email,
                    password: formData.password,
                    phone: formData.phone,
                    name: formData.name,
                    role: formData.role,
                    state: formData.state,
                    vehicleId: formData.vehicle, // Using vehicle field as ID/Plate for now
                    vehicleImageUrl: imageUrl
                });

                toast({ title: t("admin.trackDrivers.toasts.success"), description: t("admin.trackDrivers.toasts.accountCreated") });
                onSave();
            }
        } catch (error: any) {
            console.error("Error saving team member: ", error);
            const msg = error.message || "Unknown error occurred.";
            toast({ title: t("admin.trackDrivers.toasts.creationFailed"), description: msg, variant: "destructive" });
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">{t("admin.trackDrivers.form.name")}</Label>
                    <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">{t("admin.trackDrivers.form.phoneNumber")}</Label>
                    <Input id="phone" name="phone" type="tel" value={formData.phone || ''} onChange={handleChange} required />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="email">{t("admin.trackDrivers.form.email")}</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required disabled={!!driver} />
                </div>
                {!driver && (
                    <div className="space-y-2">
                        <Label htmlFor="password">{t("admin.trackDrivers.form.password")}</Label>
                        <Input id="password" name="password" type="password" value={formData.password || ''} onChange={handleChange} required />
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="role">{t("admin.trackDrivers.form.role")}</Label>
                    <Select value={formData.role} onValueChange={handleRoleChange}>
                        <SelectTrigger id="role">
                            <SelectValue placeholder={t("admin.trackDrivers.form.selectRole")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="driver">{t("admin.trackDrivers.form.driver")}</SelectItem>
                            <SelectItem value="pilot">{t("admin.trackDrivers.form.pilot")}</SelectItem>
                            <SelectItem value="responder">{t("admin.trackDrivers.form.responder")}</SelectItem>
                            <SelectItem value="rider">{t("admin.trackDrivers.form.rider")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="state">{t("admin.trackDrivers.form.assignedState")}</Label>
                <Select
                    value={formData.state}
                    onValueChange={(value) => handleSelectChange('state', value)}
                    disabled={!isSuperAdmin}
                >
                    <SelectTrigger id="state">
                        <SelectValue placeholder={t("admin.trackDrivers.form.selectState")} />
                    </SelectTrigger>
                    <SelectContent>
                        {isSuperAdmin ? (
                            states.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))
                        ) : (
                            <SelectItem value={adminState}>{adminState}</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                {!isSuperAdmin && (
                    <p className="text-[10px] text-muted-foreground">{t("admin.trackDrivers.form.adminRestricted")}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="vehicle">{t("admin.trackDrivers.form.vehicleId")}</Label>
                <Input id="vehicle" name="vehicle" value={formData.vehicle || ''} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
                <Label>{t("admin.trackDrivers.form.vehicleImage")}</Label>
                <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted overflow-hidden">
                        {imagePreview ? (
                            <img src={imagePreview} alt={t("admin.trackDrivers.form.vehiclePreview")} className="object-cover w-full h-full" />
                        ) : (
                            <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1">
                        <Input id="vehicleImageUrl" type="file" onChange={handleImageChange} accept="image/*" />
                        <p className="text-xs text-muted-foreground mt-1">{t("admin.trackDrivers.form.uploadPhoto")}</p>
                        {imagePreview && (
                            <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:text-red-600 mt-1" onClick={handleImageRemove}>
                                <Trash2 className="mr-1 h-4 w-4" /> {t("admin.trackDrivers.form.removeImage")}
                            </Button>
                        )}
                    </div>
                </div>
                {uploadProgress !== null && (
                    <div className="space-y-1">
                        <Label>{t("admin.trackDrivers.form.uploadProgress")}</Label>
                        <Progress value={uploadProgress} />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="location">{t("admin.trackDrivers.form.currentLocation")}</Label>
                    <Input id="location" name="location" value={formData.location || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="status">{t("admin.trackDrivers.form.status")}</Label>
                    <Select value={formData.status} onValueChange={handleStatusChange}>
                        <SelectTrigger id="status">
                            <SelectValue placeholder={t("admin.trackDrivers.form.selectStatus")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Available">{t("admin.trackDrivers.form.statusAvailable")}</SelectItem>
                            <SelectItem value="En Route">{t("admin.trackDrivers.form.statusEnRoute")}</SelectItem>
                            <SelectItem value="Assisting">{t("admin.trackDrivers.form.statusAssisting")}</SelectItem>
                            <SelectItem value="Emergency">{t("admin.trackDrivers.form.statusEmergency")}</SelectItem>
                            <SelectItem value="Off Duty">{t("admin.trackDrivers.form.statusOffDuty")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="task">{t("admin.trackDrivers.form.currentTask")}</Label>
                <Input id="task" name="task" value={formData.task || ''} onChange={handleChange} />
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>{t("admin.trackDrivers.form.cancel")}</Button>
                <Button type="submit" disabled={loading}>{loading ? t("admin.trackDrivers.form.saving") : t("admin.trackDrivers.form.saveTeamMember")}</Button>
            </DialogFooter>
        </form >
    );
}

function ContactDialog({ driver, isOpen, onOpenChange }: { driver: Driver | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { t } = useTranslation();
    if (!driver) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="z-[1000]">
                <DialogHeader>
                    <DialogTitle>{t("admin.trackDrivers.contact.title")} {driver.name}</DialogTitle>
                    <DialogDescription>
                        {t("admin.trackDrivers.contact.dialogDesc")}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button asChild className="h-20 flex-col gap-2">
                        <a href={`tel:${driver.phone}`}>
                            <Phone className="h-6 w-6" />
                            <span>{t("admin.trackDrivers.contact.call")}</span>
                        </a>
                    </Button>
                    <Button asChild className="h-20 flex-col gap-2">
                        <a href={`sms:${driver.phone}`}>
                            <MessageSquare className="h-6 w-6" />
                            <span>{t("admin.trackDrivers.contact.sms")}</span>
                        </a>
                    </Button>
                    <Button asChild className="h-20 flex-col gap-2">
                        <a href={`mailto:driver-placeholder@hopeline.com?subject=Message for ${driver.name}`}>
                            <Mail className="h-6 w-6" />
                            <span>{t("admin.trackDrivers.contact.email")}</span>
                        </a>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AssignVehicleDialog({ driver, vehicles, isOpen, onOpenChange, onAssign }: {
    driver: Driver | null,
    vehicles: Vehicle[],
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    onAssign: () => void
}) {
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        if (driver) {
            // Find current assigned vehicle
            const currentVehicle = vehicles.find(v => v.licensePlate === driver.vehicle);
            setSelectedVehicleId(currentVehicle?.id || '');
        }
    }, [driver, vehicles]);

    const availableVehicles = vehicles.filter(v => v.status === 'Available' || v.licensePlate === driver?.vehicle);

    const handleAssign = async () => {
        if (!driver || !selectedVehicleId) return;

        setLoading(true);
        try {
            const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
            if (!selectedVehicle) return;

            // Update driver document with vehicle details
            const driverRef = doc(db, "users", driver.id);
            const vehicleDetails: any = {
                id: selectedVehicle.id,
                make: selectedVehicle.make,
                model: selectedVehicle.model,
                year: selectedVehicle.year,
                type: selectedVehicle.type,
                capacity: selectedVehicle.capacity,
            };
            if (selectedVehicle.color !== undefined) vehicleDetails.color = selectedVehicle.color;
            if (selectedVehicle.fuelType !== undefined) vehicleDetails.fuelType = selectedVehicle.fuelType;
            if (selectedVehicle.mileage !== undefined) vehicleDetails.mileage = selectedVehicle.mileage;
            if (selectedVehicle.imageUrl !== undefined) vehicleDetails.imageUrl = selectedVehicle.imageUrl;
            if (selectedVehicle.thumbnailUrl !== undefined) vehicleDetails.thumbnailUrl = selectedVehicle.thumbnailUrl;
            await updateDoc(driverRef, {
                vehicle: selectedVehicle.licensePlate,
                vehicleDetails,
                lastUpdate: new Date().toLocaleTimeString()
            });

            // Update vehicle status to 'In Use' if not already
            if (selectedVehicle.status !== 'In Use') {
                const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
                await updateDoc(vehicleRef, {
                    status: 'In Use',
                    assignedDriverId: driver.id,
                    assignedDriverName: driver.name,
                    updatedAt: new Date().toISOString()
                });
            }

            // If driver had a previous vehicle, update its status
            if (driver.vehicle && driver.vehicle !== selectedVehicle.licensePlate) {
                const previousVehicle = vehicles.find(v => v.licensePlate === driver.vehicle);
                if (previousVehicle && previousVehicle.status === 'In Use') {
                    const prevVehicleRef = doc(db, "vehicles", previousVehicle.id);
                    await updateDoc(prevVehicleRef, {
                        status: 'Available',
                        assignedDriverId: null,
                        assignedDriverName: null,
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            toast({ title: t("admin.trackDrivers.toasts.success"), description: `${selectedVehicle.licensePlate} → ${driver.name} ✓` });
            onAssign();
            onOpenChange(false);
        } catch (error) {
            console.error("Error assigning vehicle: ", error);
            toast({ title: t("admin.trackDrivers.toasts.error"), description: t("admin.trackDrivers.toasts.vehicleAssignFailed"), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="z-[1000]">
                <DialogHeader>
                    <DialogTitle>{t("admin.trackDrivers.assignVehicle.title")} {driver?.name}</DialogTitle>
                    <DialogDescription>
                        {t("admin.trackDrivers.assignVehicle.desc")}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="vehicle-select">{t("admin.trackDrivers.assignVehicle.selectVehicle")}</Label>
                        <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                            <SelectTrigger id="vehicle-select">
                                <SelectValue placeholder={t("admin.trackDrivers.assignVehicle.choosePlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableVehicles.map(vehicle => (
                                    <SelectItem key={vehicle.id} value={vehicle.id}>
                                        {vehicle.licensePlate} - {vehicle.make} {vehicle.model} ({vehicle.year})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedVehicleId && (
                        <div className="p-4 bg-muted rounded-lg">
                            <h4 className="font-medium mb-2">{t("admin.trackDrivers.assignVehicle.vehicleDetails")}</h4>
                            {(() => {
                                const vehicle = vehicles.find(v => v.id === selectedVehicleId);
                                return vehicle ? (
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>{t("admin.trackDrivers.assignVehicle.make")}: {vehicle.make}</div>
                                        <div>{t("admin.trackDrivers.assignVehicle.model")}: {vehicle.model}</div>
                                        <div>{t("admin.trackDrivers.assignVehicle.year")}: {vehicle.year}</div>
                                        <div>{t("admin.trackDrivers.assignVehicle.type")}: {vehicle.type}</div>
                                        <div>{t("admin.trackDrivers.assignVehicle.capacity")}: {vehicle.capacity}</div>
                                        <div>{t("admin.trackDrivers.assignVehicle.statusLabel")}: {vehicle.status}</div>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("admin.trackDrivers.assignVehicle.cancel")}</Button>
                    <Button type="button" onClick={handleAssign} disabled={loading || !selectedVehicleId}>
                        {loading ? t("admin.trackDrivers.assignVehicle.assigning") : t("admin.trackDrivers.assignVehicle.assignVehicleBtn")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function TrackDriversPage() {
    const { toast } = useToast();
    const { t } = useTranslation();
    const {
        drivers: contextDrivers,
        vehicles: contextVehicles,
        alerts: contextAlerts,
        loading: contextLoading,
        locationHistory,
        fetchLocationHistoryRange
    } = useAdminData();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [isAssignVehicleOpen, setIsAssignVehicleOpen] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [trackedDriverId, setTrackedDriverId] = useState<string | undefined>(undefined);
    const [trackingStatusFilter, setTrackingStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isGPSTroubleshootingOpen, setIsGPSTroubleshootingOpen] = useState(false);
    const [gpsIssueDriver, setGpsIssueDriver] = useState<Driver | null>(null);

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
    const [playbackSpeed, setPlaybackSpeed] = useState(2); // Increased default speed for better visibility
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [isEcoMode, setIsEcoMode] = useState(true); // Default to Eco-Mode for cost-efficiency

    const drivers = contextDrivers || [];
    const vehicles = contextVehicles || [];
    const alerts = contextAlerts || [];
    const loading = contextLoading;
    const permissionError = null; // Managed by provider

    // Derived state for the currently tracked driver to ensure real-time coordinates are used
    const trackedDriver = drivers.find(d => d.id === trackedDriverId);

    const totalDrivers = drivers?.length || 0;
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
        if (!trackedDriver) {
            toast({ title: t("admin.trackDrivers.toasts.noDriverSelected"), description: t("admin.trackDrivers.toasts.noDriverSelectedDesc"), variant: "destructive" });
            return;
        }

        setIsFetchingHistory(true);
        const start = new Date(startDate);
        const end = new Date(endDate);

        const history = await fetchLocationHistoryRange(trackedDriver.id, start, end);
        setPlaybackData(history);
        setPlaybackIndex(0);
        setIsPlaybackMode(true);
        setIsPlaying(true); // Automatically start playback
        setIsFetchingHistory(false);

        if (history.length === 0) {
            toast({ title: t("admin.trackDrivers.toasts.noDataFound"), description: t("admin.trackDrivers.toasts.noDataFoundDesc") });
        } else {
            toast({ title: t("admin.trackDrivers.toasts.historyLoaded"), description: `${history.length} data points` });
        }
    };

    const handleSimulateTaskRoute = async (alert: any) => {
        if (!alert.assignedTeam?.driverId) {
            toast({ title: t("admin.trackDrivers.toasts.incompleteData"), description: t("admin.trackDrivers.toasts.incompleteDataDesc"), variant: "destructive" });
            return;
        }

        const driver = drivers?.find(d => d.id === alert.assignedTeam!.driverId);
        if (!driver) {
            toast({ title: t("admin.trackDrivers.toasts.driverNotFound"), description: t("admin.trackDrivers.toasts.driverNotFoundDesc"), variant: "destructive" });
            return;
        }

        setTrackedDriverId(driver.id);

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

        setIsFetchingHistory(true);
        setStartDate(start.toISOString().slice(0, 16));
        setEndDate(end.toISOString().slice(0, 16));

        let history = [];

        // --- MISSION JUMP PROTECTION ---
        setPlaybackIndex(0);

        // Prioritize session-specific trackingData
        if (alert.trackingData?.coordinates && Array.isArray(alert.trackingData.coordinates) && alert.trackingData.coordinates.length > 0) {
            console.log(`[Admin] Using session-specific trackingData for playback: ${alert.trackingData.coordinates.length} points`);
            const raw = alert.trackingData.coordinates
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

            // --- PROTOCOL: Coordinate Normalization ---
            const seen = new Set();
            history = raw.filter((p: any) => {
                const key = `${p.latitude},${p.longitude},${p.timestamp}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

        } else {
            console.log(`[Admin] No trackingData found in SOS, falling back to locationHistory query`);
            const raw = await fetchLocationHistoryRange(driver.id, start, end);

            // --- PROTOCOL: Coordinate Normalization ---
            const seen = new Set();
            history = raw.filter((p: any) => {
                const key = `${p.latitude},${p.longitude},${p.timestamp}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        // Add the SOS location itself as the first point if we have valid coordinates
        if (alert.location?.latitude && alert.location?.longitude) {
            const sosPoint = {
                latitude: alert.location.latitude,
                longitude: alert.location.longitude,
                timestamp: start.getTime(),
                sortTime: start.getTime(),
                isOrigin: true
            };
            history = [sosPoint, ...history];
        }

        setPlaybackData(history);
        setPlaybackIndex(0);
        setIsPlaybackMode(true);
        setIsPlaying(true);
        setIsFetchingHistory(false);

        if (history.length === 0) {
            toast({ title: t("admin.trackDrivers.toasts.noDataFound"), description: t("admin.trackDrivers.toasts.noMissionData"), variant: "destructive" });
        } else {
            toast({ title: t("admin.trackDrivers.toasts.tacticalReplayReady"), description: `${history.length} signals` });
        }
    };

    const handleTogglePlayback = () => {
        if (playbackData.length === 0) {
            handleFetchHistory();
        } else {
            setIsPlaying(!isPlaying);
        }
    };

    // Monitor GPS issues and show notifications
    useEffect(() => {
        const driversWithGPSIssues = drivers.filter(driver =>
            driver.gpsStatus === 'lost' ||
            driver.trackingStatus === 'offline' ||
            driver.isOffline
        );

        if (driversWithGPSIssues.length > 0) {
            const driverNames = driversWithGPSIssues.map(d => d.name).join(', ');
            toast({
                title: t("admin.trackDrivers.toasts.gpsIssuesDetected"),
                description: `${driversWithGPSIssues.length} driver(s) have GPS connectivity issues: ${driverNames}`,
                variant: "destructive",
                duration: 8000,
            });
        }
    }, [drivers, toast]);

    const handleAddNew = () => {
        setSelectedDriver(null);
        setIsFormOpen(true);
    };

    const handleEdit = (driver: Driver) => {
        setSelectedDriver(driver);
        setIsFormOpen(true);
    };

    const handleContact = (driver: Driver) => {
        setSelectedDriver(driver);
        setIsContactOpen(true);
    };

    const handleAssignVehicle = (driver: Driver) => {
        setSelectedDriver(driver);
        setIsAssignVehicleOpen(true);
    };

    const handleSave = () => {
        setIsFormOpen(false);
        setSelectedDriver(null);
        // No need to fetch, real-time updates
    }

    const handleCancel = () => {
        setIsFormOpen(false);
        setSelectedDriver(null);
    }

    const handleTrack = (driver: Driver) => {
        if (driver.latitude && driver.longitude && driver.latitude !== 0 && driver.longitude !== 0) {
            const googleMapsUrl = `https://www.google.com/maps/@${driver.latitude},${driver.longitude},15z`;
            window.open(googleMapsUrl, "_blank");
        } else {
            // Fallback to search if no coordinates
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(driver.location)}`;
            window.open(googleMapsUrl, "_blank");
        }
    };

    const handleGPSTroubleshooting = (driver: Driver) => {
        setGpsIssueDriver(driver);
        setIsGPSTroubleshootingOpen(true);
    };

    // Filter drivers based on search and tracking status
    const filteredDrivers = drivers.filter(driver => {
        const matchesSearch = searchQuery === '' ||
            driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            driver.vehicle.toLowerCase().includes(searchQuery.toLowerCase()) ||
            driver.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
            driver.location.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesTracking = trackingStatusFilter === 'all' ||
            driver.trackingStatus === trackingStatusFilter;

        return matchesSearch && matchesTracking;
    });

    const availableDrivers = drivers?.filter(d => d.status === 'Available').length || 0;
    const activeDrivers = drivers?.filter(d => d.status === 'En Route' || d.status === 'Assisting').length || 0;
    const emergencyDrivers = drivers?.filter(d => d.status === 'Emergency').length || 0;

    return (
        <div className="space-y-6">
            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); else setIsFormOpen(true); }}>
                <DialogContent className="sm:max-w-xl z-[1000]">
                    <DialogHeader>
                        <DialogTitle>{selectedDriver ? t("admin.trackDrivers.dialog.editTitle") : t("admin.trackDrivers.dialog.addTitle")}</DialogTitle>
                        <DialogDescription>
                            {selectedDriver ? t("admin.trackDrivers.dialog.editDesc") : t("admin.trackDrivers.dialog.addDesc")}
                        </DialogDescription>
                    </DialogHeader>
                    <DriverForm driver={selectedDriver} onSave={handleSave} onCancel={handleCancel} />
                </DialogContent>
            </Dialog>
            <ContactDialog driver={selectedDriver} isOpen={isContactOpen} onOpenChange={setIsContactOpen} />
            <AssignVehicleDialog
                driver={selectedDriver}
                vehicles={vehicles}
                isOpen={isAssignVehicleOpen}
                onOpenChange={setIsAssignVehicleOpen}
                onAssign={() => {
                    setIsAssignVehicleOpen(false);
                    setSelectedDriver(null);
                }}
            />
            <GPSTroubleshootingDialog
                isOpen={isGPSTroubleshootingOpen}
                onOpenChange={setIsGPSTroubleshootingOpen}
                gpsStatus={gpsIssueDriver?.gpsStatus}
                isOffline={gpsIssueDriver?.isOffline}
                signalStrength={gpsIssueDriver?.signalStrength}
            />

            <div className="flex justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{t("admin.trackDrivers.title")}</h1>
                    <p className="text-muted-foreground">{t("admin.trackDrivers.subtitle")}</p>
                </div>
                <Button onClick={handleAddNew}>
                    <Plus className="mr-2 h-4 w-4" /> {t("admin.trackDrivers.addTeamMember")}
                </Button>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-grow">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <Car className="h-6 w-6 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.stats.totalTeamMembers")}</p>
                                {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{totalDrivers}</p>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.stats.available")}</p>
                                {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{availableDrivers}</p>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <SendIcon className="h-6 w-6 text-orange-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.stats.active")}</p>
                                {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{activeDrivers}</p>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.stats.emergency")}</p>
                                {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{emergencyDrivers}</p>}
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>

            <div className="flex gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder={t("admin.trackDrivers.search.placeholder")}
                        className="pl-10 h-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={trackingStatusFilter} onValueChange={setTrackingStatusFilter}>
                    <SelectTrigger className="w-48">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder={t("admin.trackDrivers.search.filterPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t("admin.trackDrivers.search.allTracking")}</SelectItem>
                        <SelectItem value="active">{t("admin.trackDrivers.search.activeTracking")}</SelectItem>
                        <SelectItem value="inactive">{t("admin.trackDrivers.search.inactiveTracking")}</SelectItem>
                        <SelectItem value="error">{t("admin.trackDrivers.search.trackingError")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 relative z-50 bg-white p-4 rounded-xl border border-blue-50 shadow-sm">
                    <div className="flex items-center gap-2 min-w-max">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{t("admin.trackDrivers.step1")}</Badge>
                        <Label htmlFor="driver-select" className="font-bold text-slate-700">{t("admin.trackDrivers.selectAsset")}</Label>
                    </div>
                    <Select value={trackedDriverId || "all"} onValueChange={(value) => {
                        if (value === "all") {
                            setTrackedDriverId(undefined);
                        } else {
                            setTrackedDriverId(value);
                        }
                    }}>
                        <SelectTrigger id="driver-select" className="flex-1 bg-white border-blue-100 h-11">
                            <SelectValue placeholder={t("admin.trackDrivers.choosePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent className="z-[1001] max-h-[300px]">
                            <SelectItem value="all" className="font-semibold text-blue-600">{t("admin.trackDrivers.trackEntireFleet")}</SelectItem>
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

                {trackedDriverId && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Left Side: General History & Missions */}
                        <div className="space-y-6">
                            {/* Date/Time Filter Side */}
                            <Card className="border shadow-sm overflow-hidden bg-slate-50/50">
                                <CardHeader className="py-3 px-4 bg-slate-100/50 border-b border-slate-200">
                                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-500" /> {t("admin.trackDrivers.playback.manualWindow")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("admin.trackDrivers.playback.startWindow")}</Label>
                                            <Input
                                                type="datetime-local"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="bg-white border-slate-200 h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("admin.trackDrivers.playback.endWindow")}</Label>
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
                                                {t("admin.trackDrivers.playback.fetching")}
                                            </div>
                                        ) : t("admin.trackDrivers.playback.loadTimeframe")}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Mission Specific Section */}
                            <Card className="border shadow-sm overflow-hidden border-blue-100">
                                <CardHeader className="py-3 px-4 bg-blue-50/50 border-b border-blue-100">
                                    <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                                        <Target className="h-4 w-4" /> {t("admin.trackDrivers.playback.missionPlayback")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[200px]">
                                        <div className="divide-y divide-slate-100">
                                            {alerts?.filter(a => a.assignedTeam?.driverId === trackedDriverId).length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-sm italic">
                                                    {t("admin.trackDrivers.playback.noMissions")}
                                                </div>
                                            ) : (
                                                alerts?.filter(a => a.assignedTeam?.driverId === trackedDriverId)
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
                                                                <p className="text-[10px] text-slate-400 truncate">{mission.location.address || t("admin.trackDrivers.playback.unknownLocation")}</p>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 px-2 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white"
                                                                onClick={() => handleSimulateTaskRoute(mission)}
                                                                disabled={isFetchingHistory}
                                                            >
                                                                {isFetchingHistory ? "..." : t("admin.trackDrivers.playback.replay")}
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
                                                <Activity className="h-4 w-4" /> {t("admin.trackDrivers.playback.tacticalPlayback")}
                                            </CardTitle>
                                            <Badge className="bg-emerald-600 text-white font-black text-[9px]">
                                                {playbackIndex + 1} / {playbackData.length} {t("admin.trackDrivers.playback.signals")}
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
                                                {isPlaying ? <><Pause className="h-4 w-4 mr-2 text-emerald-400" /> {t("admin.trackDrivers.playback.pauseIntel")}</> : <><Play className="h-4 w-4 mr-2" /> {t("admin.trackDrivers.playback.resumeSignal")}</>}
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100 shadow-sm mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2 rounded-lg", isEcoMode ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                                                    <RotateCcw className={cn("h-4 w-4", isEcoMode && "text-emerald-500")} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("admin.trackDrivers.playback.routingMode")}</p>
                                                    <p className={cn("text-xs font-bold", isEcoMode ? "text-emerald-600" : "text-blue-600")}>
                                                        {isEcoMode ? t("admin.trackDrivers.playback.ecoMode") : t("admin.trackDrivers.playback.highPrecision")}
                                                    </p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={isEcoMode}
                                                onCheckedChange={setIsEcoMode}
                                            />
                                        </div>

                                        <div className="space-y-4 bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    <span>{t("admin.trackDrivers.playback.timelineIntel")}</span>
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
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{t("admin.trackDrivers.playback.warpSpeed")} <span className="text-emerald-600">{playbackSpeed}x</span></div>
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
                                                    <div className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest opacity-70">{t("admin.trackDrivers.playback.signalTimestamp")}</div>
                                                    <div className="text-sm font-black tabular-nums text-white">
                                                        {(() => {
                                                            const ts = playbackData[playbackIndex]?.timestamp;
                                                            if (!ts) return '--:--:--';
                                                            if (typeof ts === 'object' && ts.toDate) return ts.toDate().toLocaleTimeString();
                                                            if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleTimeString();
                                                            return new Date(ts).toLocaleTimeString();
                                                        })()}
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
                                        <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">{t("admin.trackDrivers.playback.awaitingSelection")}</p>
                                        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">{t("admin.trackDrivers.playback.awaitingDesc")}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner group">
                    <DriverMap
                        drivers={isPlaybackMode ? [] : (trackedDriverId ? [trackedDriver!] : drivers || [])}
                        selectedDriver={trackedDriver}
                        onDriverSelect={(d) => setTrackedDriverId(d.id)}
                        className="h-[500px] w-full z-0 relative transition-all duration-700"
                        showMovementTrails={!isPlaybackMode}
                        locationHistory={locationHistory}
                        playbackPoint={isPlaybackMode ? playbackData[playbackIndex] : undefined}
                        playbackTrail={isPlaybackMode ? playbackData.slice(0, playbackIndex + 1) : undefined}
                        fullMissionTrail={isPlaybackMode ? playbackData : undefined}
                        useRoadsForPlayback={true} // Base road snapping enabled
                        useEcoMode={isEcoMode} // Pass Eco-Mode state
                        enableRouting={!isPlaybackMode && isEcoMode} // Use EcoMode logic for general routing if desired
                    />
                </div>

                {trackedDriver && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("admin.trackDrivers.tracking.trackingInfo")} {trackedDriver.name} ({(trackedDriver as any).role || t("admin.trackDrivers.tracking.teamMember")})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.form.status")}</p>
                                    <Badge variant={getStatusStyles(trackedDriver.status).badgeVariant} className="flex gap-1.5 items-center capitalize">
                                        {getStatusStyles(trackedDriver.status).icon}
                                        {trackedDriver.status}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.tracking.currentLocation")}</p>
                                    <p className="font-medium">{typeof trackedDriver.location === 'string' ? trackedDriver.location : (trackedDriver.location as any)?._lat ? `${(trackedDriver.location as any)._lat}, ${(trackedDriver.location as any)._long}` : 'Unknown'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.tracking.currentTask")}</p>
                                    <p className="font-medium">{typeof trackedDriver.task === 'string' ? trackedDriver.task : trackedDriver.task ? JSON.stringify(trackedDriver.task) : 'None'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.tracking.lastUpdate")}</p>
                                    <p className="font-medium">{formatTimestamp(trackedDriver.lastUpdate)}</p>
                                </div>
                            </div>
                            {(trackedDriver.status === 'En Route' || trackedDriver.status === 'Assisting') && trackedDriver.destinationLat && trackedDriver.destinationLng && typeof trackedDriver.latitude === 'number' && typeof trackedDriver.longitude === 'number' && !isNaN(trackedDriver.latitude) && !isNaN(trackedDriver.longitude) && (
                                <div>
                                    <p className="text-sm text-muted-foreground">{t("admin.trackDrivers.tracking.estimatedArrival")}</p>
                                    <p className="font-medium text-blue-600">
                                        {calculateETA(trackedDriver.latitude, trackedDriver.longitude, trackedDriver.destinationLat, trackedDriver.destinationLng)}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {permissionError && (
                <Alert variant="destructive">
                    <AlertDialogTitle>{t("admin.trackDrivers.permission.denied")}</AlertDialogTitle>
                    <AlertDescription>
                        {t("admin.trackDrivers.permission.desc")}
                    </AlertDescription>
                </Alert>
            )
            }

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading || !drivers ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i}><CardContent className="p-4"><Skeleton className="h-80 w-full" /></CardContent></Card>
                    ))
                ) : filteredDrivers.length > 0 ? (
                    filteredDrivers.map(driver => {
                        const { badgeVariant, cardClass, icon } = getStatusStyles(driver.status);
                        return (
                            <Card key={driver.id} className={cn("transition-shadow hover:shadow-md", cardClass)}>
                                <CardContent className="p-0">
                                    <div className="relative aspect-video w-full">
                                        <img
                                            src={driver.vehicleDetails?.imageUrl || driver.vehicleImageUrl || 'https://placehold.co/600x400.png'}
                                            alt={`${t("admin.trackDrivers.card.vehicleFor")} ${driver.name}`}
                                            className="object-cover rounded-t-lg w-full h-full"
                                        />
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-12 w-12">
                                                <AvatarFallback>{driver.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-bold text-lg">{driver.name}</p>
                                                <div className="flex gap-2">
                                                    <Badge variant={badgeVariant} className="flex gap-1.5 items-center capitalize">
                                                        {icon}
                                                        {driver.status}
                                                    </Badge>
                                                    {driver.trackingStatus && (
                                                        <Badge
                                                            variant={driver.trackingStatus === 'active' ? 'default' : driver.trackingStatus === 'offline' ? 'destructive' : driver.trackingStatus === 'error' ? 'destructive' : 'secondary'}
                                                            className="text-xs"
                                                        >
                                                            {driver.trackingStatus === 'active' ? 'Live' : driver.trackingStatus === 'offline' ? 'Offline' : driver.trackingStatus === 'inactive' ? 'Inactive' : 'Error'}
                                                        </Badge>
                                                    )}
                                                    {driver.gpsStatus && (
                                                        <Badge
                                                            variant={driver.gpsStatus === 'good' ? 'default' : driver.gpsStatus === 'weak' ? 'secondary' : 'destructive'}
                                                            className="text-xs ml-1"
                                                        >
                                                            GPS: {driver.gpsStatus}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {driver.vehicle ? (
                                                        driver.vehicleDetails ?
                                                            `${driver.vehicleDetails.make} ${driver.vehicleDetails.model} (${driver.vehicle})` :
                                                            `${t("admin.trackDrivers.card.vehicle")} ${driver.vehicle}`
                                                    ) : t("admin.trackDrivers.card.noVehicle")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-3 text-sm pl-2 border-l-2 ml-6">
                                            <div className="flex items-start gap-3">
                                                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{t("admin.trackDrivers.contact.title")}</p>
                                                    <p className="text-muted-foreground">{driver.phone}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <MapPinned className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{t("admin.trackDrivers.tracking.currentLocation")}</p>
                                                    <p className="text-muted-foreground">{typeof driver.location === 'string' ? driver.location : (driver.location as any)?._lat ? `${(driver.location as any)._lat}, ${(driver.location as any)._long}` : 'Unknown'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{t("admin.trackDrivers.tracking.currentTask")}</p>
                                                    <p className={cn("text-muted-foreground", driver.status === "Emergency" && "text-red-600 font-medium")}>{typeof driver.task === 'string' ? driver.task : driver.task ? JSON.stringify(driver.task) : 'None'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{t("admin.trackDrivers.tracking.lastUpdate")}</p>
                                                    <p className="text-muted-foreground">{formatTimestamp(driver.lastUpdate)}</p>
                                                    {driver.locationAccuracy && (
                                                        <p className="text-xs text-muted-foreground">{t("admin.trackDrivers.tracking.accuracy")}: ±{Math.round(driver.locationAccuracy)}m</p>
                                                    )}
                                                </div>
                                            </div>
                                            {driver.state && (
                                                <div className="flex items-start gap-3">
                                                    <MapPinned className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                    <div>
                                                        <p className="font-medium">{t("admin.trackDrivers.tracking.assignedState")}</p>
                                                        <p className="text-muted-foreground">{driver.state}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                                            <Button size="sm" onClick={() => handleTrack(driver)}><MapPinned className="mr-2 h-4 w-4" />{t("admin.trackDrivers.card.track")}</Button>
                                            <Button size="sm" variant="outline" onClick={() => handleContact(driver)}><MessageSquare className="mr-2 h-4 w-4" />{t("admin.trackDrivers.card.contact")}</Button>
                                            {(driver.gpsStatus === 'lost' || driver.trackingStatus === 'offline' || driver.isOffline) && (
                                                <Button size="sm" variant="outline" onClick={() => handleGPSTroubleshooting(driver)} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                                                    <AlertTriangle className="mr-2 h-4 w-4" />{t("admin.trackDrivers.card.gpsHelp")}
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => handleAssignVehicle(driver)}><Car className="mr-2 h-4 w-4" />{t("admin.trackDrivers.card.assignVehicle")}</Button>
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(driver)}><Edit className="mr-2 h-4 w-4" />{t("admin.trackDrivers.card.edit")}</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : !permissionError ? (
                    <p className="text-muted-foreground col-span-full text-center py-10">{t("admin.trackDrivers.noTeamMembers")}</p>
                ) : null}
            </div>
        </div>
    );
}
