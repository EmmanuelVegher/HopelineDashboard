
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Driver, type Vehicle } from "@/lib/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle as AlertDialogTitle } from "@/components/ui/alert";
import { Car, CheckCircle, Send as SendIcon, AlertTriangle, Search, Filter, MapPinned, Briefcase, Clock, Phone, MessageSquare, RefreshCw, Plus, Edit, ImagePlus, Trash2, Mail } from "lucide-react";
import { cn, calculateETA } from "@/lib/utils";
import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import DriverMap from "@/components/driver-map";
import GPSTroubleshootingDialog from "@/components/gps-troubleshooting-dialog";


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
};

function DriverForm({ driver, onSave, onCancel }: { driver?: Driver | null, onSave: () => void, onCancel: () => void }) {
    const [formData, setFormData] = useState<Partial<Driver & { role: string; email: string }>>(initialDriverState);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    useEffect(() => {
        if (driver) {
            setFormData(driver);
            if (driver.vehicleImageUrl) {
                setImagePreview(driver.vehicleImageUrl);
            } else {
                 setImagePreview(null);
            }
        } else {
            setFormData(initialDriverState);
            setImagePreview(null);
        }
         // Clean up blob URL
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
        }
    }, [driver, imagePreview]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleStatusChange = (value: Driver['status']) => {
        setFormData(prev => ({...prev, status: value}));
    }

    const handleRoleChange = (value: string) => {
        setFormData(prev => ({...prev, role: value}));
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
        setFormData(prev => ({...prev, vehicleImageUrl: ''}));
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
                        toast({ title: "Image Upload Failed", description: "Could not upload vehicle image.", variant: "destructive" });
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
            const dataToSave: Partial<Driver & { role: string; email: string }> = {
                ...formData,
                vehicleImageUrl: imageUrl,
                lastUpdate: new Date().toLocaleTimeString()
            };

            if (driver?.id) {
                // Update existing user
                const userRef = doc(db, "users", driver.id);
                await updateDoc(userRef, dataToSave);
                toast({ title: "Success", description: "Team member updated successfully." });
            } else {
                // Create new user
                await addDoc(collection(db, "users"), dataToSave);
                toast({ title: "Success", description: "Team member added successfully." });
            }
            onSave();
        } catch (error) {
            console.error("Error saving team member: ", error);
            toast({ title: "Error", description: "Could not save team member. Check Firestore permissions.", variant: "destructive" });
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" name="phone" type="tel" value={formData.phone || ''} onChange={handleChange} required />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={handleRoleChange}>
                        <SelectTrigger id="role">
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="driver">Driver</SelectItem>
                            <SelectItem value="pilot">Pilot</SelectItem>
                            <SelectItem value="responder">Responder</SelectItem>
                            <SelectItem value="rider">Rider</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle ID / License Plate</Label>
                <Input id="vehicle" name="vehicle" value={formData.vehicle || ''} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
                <Label>Vehicle Image</Label>
                <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted overflow-hidden">
                        {imagePreview ? (
                            <img src={imagePreview} alt="Vehicle preview" className="object-cover w-full h-full" />
                        ) : (
                            <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1">
                        <Input id="vehicleImageUrl" type="file" onChange={handleImageChange} accept="image/*" />
                        <p className="text-xs text-muted-foreground mt-1">Upload a photo of the vehicle.</p>
                        {imagePreview && (
                            <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:text-red-600 mt-1" onClick={handleImageRemove}>
                                <Trash2 className="mr-1 h-4 w-4" /> Remove Image
                            </Button>
                        )}
                    </div>
                </div>
                 {uploadProgress !== null && (
                    <div className="space-y-1">
                        <Label>Upload Progress</Label>
                        <Progress value={uploadProgress} />
                    </div>
                )}
            </div>

             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="location">Current Location</Label>
                    <Input id="location" name="location" value={formData.location || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={handleStatusChange}>
                        <SelectTrigger id="status">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Available">Available</SelectItem>
                            <SelectItem value="En Route">En Route</SelectItem>
                            <SelectItem value="Assisting">Assisting</SelectItem>
                            <SelectItem value="Emergency">Emergency</SelectItem>
                            <SelectItem value="Off Duty">Off Duty</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="task">Current Task</Label>
                <Input id="task" name="task" value={formData.task || ''} onChange={handleChange} />
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Team Member'}</Button>
            </DialogFooter>
        </form>
    );
}

function ContactDialog({ driver, isOpen, onOpenChange }: { driver: Driver | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    if (!driver) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="z-[1000]">
                <DialogHeader>
                    <DialogTitle>Contact {driver.name}</DialogTitle>
                    <DialogDescription>
                        Choose your preferred method to contact the driver.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button asChild className="h-20 flex-col gap-2">
                        <a href={`tel:${driver.phone}`}>
                            <Phone className="h-6 w-6" />
                            <span>Call</span>
                        </a>
                    </Button>
                    <Button asChild className="h-20 flex-col gap-2">
                        <a href={`sms:${driver.phone}`}>
                            <MessageSquare className="h-6 w-6" />
                            <span>SMS</span>
                        </a>
                    </Button>
                    <Button asChild className="h-20 flex-col gap-2">
                        <a href={`mailto:driver-placeholder@hopeline.com?subject=Message for ${driver.name}`}>
                            <Mail className="h-6 w-6" />
                            <span>Email</span>
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

            toast({ title: "Success", description: `Vehicle ${selectedVehicle.licensePlate} assigned to ${driver.name} successfully.` });
            onAssign();
            onOpenChange(false);
        } catch (error) {
            console.error("Error assigning vehicle: ", error);
            toast({ title: "Error", description: "Could not assign vehicle. Please try again.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="z-[1000]">
                <DialogHeader>
                    <DialogTitle>Assign Vehicle to {driver?.name}</DialogTitle>
                    <DialogDescription>
                        Select a vehicle to assign to this driver. Only available vehicles are shown.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="vehicle-select">Select Vehicle</Label>
                        <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                            <SelectTrigger id="vehicle-select">
                                <SelectValue placeholder="Choose a vehicle..." />
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
                            <h4 className="font-medium mb-2">Vehicle Details</h4>
                            {(() => {
                                const vehicle = vehicles.find(v => v.id === selectedVehicleId);
                                return vehicle ? (
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>Make: {vehicle.make}</div>
                                        <div>Model: {vehicle.model}</div>
                                        <div>Year: {vehicle.year}</div>
                                        <div>Type: {vehicle.type}</div>
                                        <div>Capacity: {vehicle.capacity}</div>
                                        <div>Status: {vehicle.status}</div>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleAssign} disabled={loading || !selectedVehicleId}>
                        {loading ? 'Assigning...' : 'Assign Vehicle'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function TrackDriversPage() {
    const { toast } = useToast();
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [isAssignVehicleOpen, setIsAssignVehicleOpen] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [trackedDriver, setTrackedDriver] = useState<Driver | undefined>(undefined);
    const [trackingStatusFilter, setTrackingStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isGPSTroubleshootingOpen, setIsGPSTroubleshootingOpen] = useState(false);
    const [gpsIssueDriver, setGpsIssueDriver] = useState<Driver | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'users'), where('role', 'in', ['driver', 'pilot', 'responder', 'rider']));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const driverData = snapshot.docs.map(doc => {
                const data = doc.data();

                // Helper function to convert Firestore Timestamp to string
                const formatTimestamp = (timestamp: any) => {
                    if (!timestamp) return '';
                    if (typeof timestamp === 'string') return timestamp;
                    if (timestamp.toDate) {
                        return timestamp.toDate().toLocaleTimeString();
                    }
                    if (timestamp.seconds && timestamp.nanoseconds) {
                        // It's a Firestore Timestamp
                        return new Date(timestamp.seconds * 1000).toLocaleTimeString();
                    }
                    return String(timestamp);
                };

                return {
                    id: doc.id,
                    name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || data.displayName,
                    vehicle: data.vehicle || '',
                    phone: data.phone || data.mobile || '',
                    location: data.location || '',
                    status: data.status || 'Available',
                    task: data.task || '',
                    lastUpdate: formatTimestamp(data.lastUpdate),
                    latitude: data.latitude || 0,
                    longitude: data.longitude || 0,
                    locationAccuracy: data.locationAccuracy,
                    locationTimestamp: data.locationTimestamp,
                    trackingStatus: data.trackingStatus,
                    gpsStatus: data.gpsStatus,
                    signalStrength: data.signalStrength,
                    isOffline: data.isOffline,
                    destinationLat: data.destinationLat,
                    destinationLng: data.destinationLng,
                    vehicleImageUrl: data.vehicleImageUrl,
                    email: data.email || '',
                    role: data.role,
                    vehicleDetails: data.vehicleDetails,
                } as Driver & { role: string; vehicleDetails?: any };
            });
            setDrivers(driverData);
            setLoading(false);
            setPermissionError(null);
        }, (err) => {
            console.error('Error fetching field team:', err);
            setPermissionError(err.message);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
            const vehicleData = snapshot.docs.map(doc => {
                const data = doc.data();

                // Helper function to convert Firestore Timestamp to string
                const formatTimestamp = (timestamp: any) => {
                    if (!timestamp) return '';
                    if (typeof timestamp === 'string') return timestamp;
                    if (timestamp.toDate) {
                        return timestamp.toDate().toISOString();
                    }
                    if (timestamp.seconds && timestamp.nanoseconds) {
                        // It's a Firestore Timestamp
                        return new Date(timestamp.seconds * 1000).toISOString();
                    }
                    return String(timestamp);
                };

                // Convert any timestamp fields in vehicle data
                const processedData = { ...data };
                if (processedData.updatedAt) {
                    processedData.updatedAt = formatTimestamp(processedData.updatedAt);
                }

                return {
                    id: doc.id,
                    ...processedData
                } as Vehicle;
            });
            setVehicles(vehicleData);
        }, (err) => {
            console.error('Error fetching vehicles:', err);
        });
        return unsubscribe;
    }, []);

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
                title: "GPS Issues Detected",
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

    const totalDrivers = drivers?.length || 0;
    const availableDrivers = drivers?.filter(d => d.status === 'Available').length || 0;
    const activeDrivers = drivers?.filter(d => d.status === 'En Route' || d.status === 'Assisting').length || 0;
    const emergencyDrivers = drivers?.filter(d => d.status === 'Emergency').length || 0;

    return (
        <div className="space-y-6">
             <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); else setIsFormOpen(true);}}>
                 <DialogContent className="sm:max-w-xl z-[1000]">
                     <DialogHeader>
                         <DialogTitle>{selectedDriver ? "Edit Team Member Details" : "Add New Team Member"}</DialogTitle>
                          <DialogDescription>
                              {selectedDriver ? "Update the information for this team member." : "Fill in the details for the new team member."}
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

            <div>
                <h1 className="text-3xl font-bold">Field Team Management</h1>
                <p className="text-muted-foreground">Real-time tracking and management of field response teams</p>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-grow">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <Car className="h-6 w-6 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Total Team Members</p>
                                {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{totalDrivers}</p>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">Available</p>
                                {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{availableDrivers}</p>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <SendIcon className="h-6 w-6 text-orange-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">Active</p>
                                {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{activeDrivers}</p>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                            <div>
                                <p className="text-sm text-muted-foreground">Emergency</p>
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
                        placeholder="Search team members by name, vehicle ID, or status..."
                        className="pl-10 h-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={trackingStatusFilter} onValueChange={setTrackingStatusFilter}>
                    <SelectTrigger className="w-48">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Filter by tracking status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Tracking Status</SelectItem>
                        <SelectItem value="active">Active Tracking</SelectItem>
                        <SelectItem value="inactive">Inactive Tracking</SelectItem>
                        <SelectItem value="error">Tracking Error</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Label htmlFor="driver-select">Select Team Member to Track:</Label>
                    <Select value={trackedDriver?.id || ""} onValueChange={(value) => {
                        const driver = filteredDrivers.find(d => d.id === value);
                        setTrackedDriver(driver || undefined);
                    }}>
                        <SelectTrigger id="driver-select" className="w-64">
                            <SelectValue placeholder="Choose a team member..." />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredDrivers.map(driver => (
                                <SelectItem key={driver.id} value={driver.id}>
                                    {driver.name} - {driver.vehicle}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle>Team Locations Map</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="relative w-full h-96 md:h-[500px] lg:h-[600px]">
                            <DriverMap
                                drivers={filteredDrivers}
                                selectedDriver={trackedDriver}
                                onDriverSelect={setTrackedDriver}
                                className="absolute inset-0 w-full h-full"
                                showMovementTrails={true}
                                locationHistory={{}} // TODO: Implement location history fetching
                            />
                        </div>
                    </CardContent>
                </Card>

                {trackedDriver && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Tracking Information: {trackedDriver.name} ({(trackedDriver as any).role || 'Team Member'})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge variant={getStatusStyles(trackedDriver.status).badgeVariant} className="flex gap-1.5 items-center capitalize">
                                        {getStatusStyles(trackedDriver.status).icon}
                                        {trackedDriver.status}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Current Location</p>
                                    <p className="font-medium">{trackedDriver.location}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Current Task</p>
                                    <p className="font-medium">{trackedDriver.task}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Last Update</p>
                                    <p className="font-medium">{trackedDriver.lastUpdate}</p>
                                </div>
                            </div>
                            {(trackedDriver.status === 'En Route' || trackedDriver.status === 'Assisting') && trackedDriver.destinationLat && trackedDriver.destinationLng && typeof trackedDriver.latitude === 'number' && typeof trackedDriver.longitude === 'number' && !isNaN(trackedDriver.latitude) && !isNaN(trackedDriver.longitude) && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Estimated Arrival Time</p>
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
                    <AlertDialogTitle>Permission Denied</AlertDialogTitle>
                    <AlertDescription>
                        You do not have permission to view driver data. Please check your Firestore security rules to allow read access to the &apos;drivers&apos; collection for administrators.
                    </AlertDescription>
                </Alert>
            )}

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
                                            alt={`Vehicle for ${driver.name}`}
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
                                                            `Vehicle ${driver.vehicle}`
                                                    ) : 'No vehicle assigned'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-3 text-sm pl-2 border-l-2 ml-6">
                                            <div className="flex items-start gap-3">
                                                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">Contact</p>
                                                    <p className="text-muted-foreground">{driver.phone}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <MapPinned className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">Current Location</p>
                                                    <p className="text-muted-foreground">{driver.location}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">Current Task</p>
                                                    <p className={cn("text-muted-foreground", driver.status === "Emergency" && "text-red-600 font-medium")}>{driver.task}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">Last update</p>
                                                    <p className="text-muted-foreground">{driver.lastUpdate}</p>
                                                    {driver.locationAccuracy && (
                                                        <p className="text-xs text-muted-foreground">Accuracy: ±{Math.round(driver.locationAccuracy)}m</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                                            <Button size="sm" onClick={() => handleTrack(driver)}><MapPinned className="mr-2 h-4 w-4"/>Track</Button>
                                            <Button size="sm" variant="outline" onClick={() => handleContact(driver)}><MessageSquare className="mr-2 h-4 w-4"/>Contact</Button>
                                            {(driver.gpsStatus === 'lost' || driver.trackingStatus === 'offline' || driver.isOffline) && (
                                                <Button size="sm" variant="outline" onClick={() => handleGPSTroubleshooting(driver)} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                                                    <AlertTriangle className="mr-2 h-4 w-4"/>GPS Help
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => handleAssignVehicle(driver)}><Car className="mr-2 h-4 w-4"/>Assign Vehicle</Button>
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(driver)}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : !permissionError ? (
                     <p className="text-muted-foreground col-span-full text-center py-10">No team members found in the database. Click "Add New Team Member" to get started.</p>
                ) : null }
            </div>

        </div>
    );
}
