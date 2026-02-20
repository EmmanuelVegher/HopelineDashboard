"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Vehicle } from "@/lib/data";
import { Truck, CheckCircle, Wrench, AlertTriangle, RefreshCw, Search, Filter, Plus, Edit, Trash2, Download, Car, Bus, Ambulance, Bike, Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, doc, writeBatch, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, storage, auth } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { Checkbox } from "@/components/ui/checkbox";
import { NIGERIA_STATE_BOUNDS } from "@/lib/nigeria-geography";

const getStatusInfo = (status: string) => {
    switch (status) {
        case 'In Use':
            return {
                badgeVariant: 'default' as const,
                cardClass: 'border-blue-200 bg-blue-50/50',
                icon: <Car className="h-4 w-4 text-blue-600" />,
            };
        case 'Maintenance':
            return {
                badgeVariant: 'secondary' as const,
                cardClass: 'border-yellow-200 bg-yellow-50/50',
                icon: <Wrench className="h-4 w-4 text-yellow-600" />,
            };
        case 'Out of Service':
            return {
                badgeVariant: 'destructive' as const,
                cardClass: 'border-red-200 bg-red-50/50',
                icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
            };
        case 'Available':
        default:
            return {
                badgeVariant: 'default' as const,
                cardClass: '',
                icon: <CheckCircle className="h-4 w-4 text-green-600" />,
            };
    }
};

const getVehicleIcon = (type: string) => {
    switch (type) {
        case 'Truck': return <Truck className="h-5 w-5" />;
        case 'Bus': return <Bus className="h-5 w-5" />;
        case 'Ambulance': return <Ambulance className="h-5 w-5" />;
        case 'Motorcycle': return <Bike className="h-5 w-5" />;
        default: return <Car className="h-5 w-5" />;
    }
};

const initialVehicleState: Partial<Vehicle> = {
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    status: 'Available',
    type: 'Car',
    capacity: 4,
    fuelType: 'Petrol',
    color: '',
    notes: '',
    state: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

function VehicleForm({ vehicle, onSave, onCancel }: { vehicle?: Vehicle | null, onSave: () => void, onCancel: () => void }) {
    const [formData, setFormData] = useState<Partial<Vehicle>>(initialVehicleState);
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();
    const { adminProfile } = useAdminData();
    const role = adminProfile?.role?.toLowerCase() || '';
    const isSuperAdmin = role.includes('super');
    const adminState = adminProfile?.state || '';
    const states = Object.keys(NIGERIA_STATE_BOUNDS).sort();

    useEffect(() => {
        if (vehicle) {
            setFormData(vehicle);
            setImagePreview(vehicle.imageUrl || null);
        } else {
            setFormData({
                ...initialVehicleState,
                state: isSuperAdmin ? '' : adminState
            });
            setImagePreview(null);
        }
        setImageFile(null);
        setUploadProgress(0);
        setUploading(false);
    }, [vehicle, isSuperAdmin, adminState]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'year' || name === 'capacity' || name === 'mileage' ? Number(value) : value }));
    };

    const handleSelectChange = (name: keyof Vehicle, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast({ title: "Error", description: "Image size must be less than 5MB.", variant: "destructive" });
                return;
            }
            if (!file.type.startsWith('image/')) {
                toast({ title: "Error", description: "Please select a valid image file.", variant: "destructive" });
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleImageRemove = () => {
        setImageFile(null);
        setImagePreview(null);
        setFormData(prev => ({ ...prev, imageUrl: undefined, thumbnailUrl: undefined }));
    };

    const uploadImage = async (file: File): Promise<string> => {
        console.log('Auth state before upload:', auth.currentUser);
        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name}`;
            const storageRef = ref(storage, `vehicles/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                }
            );
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setUploading(true);

        try {
            let imageUrl = formData.imageUrl;

            // Upload new image if selected
            if (imageFile) {
                imageUrl = await uploadImage(imageFile);
            }

            const dataToSave = {
                ...formData,
                imageUrl,
                updatedAt: new Date().toISOString()
            };

            if (vehicle?.id) {
                // Update existing vehicle
                const vehicleRef = doc(db, "vehicles", vehicle.id);
                await updateDoc(vehicleRef, dataToSave);
                toast({ title: "Success", description: "Vehicle updated successfully." });
            } else {
                // Create new vehicle
                await addDoc(collection(db, "vehicles"), dataToSave);
                toast({ title: "Success", description: "Vehicle added successfully." });
            }
            onSave();
        } catch (error) {
            console.error("Error saving vehicle: ", error);
            toast({ title: "Error", description: "Could not save vehicle details.", variant: "destructive" });
        } finally {
            setLoading(false);
            setUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto pr-2 sm:pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="make">Make</Label>
                    <Input id="make" name="make" value={formData.make} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" value={formData.model} onChange={handleChange} required />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" name="year" type="number" value={formData.year} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="licensePlate">License Plate</Label>
                    <Input id="licensePlate" name="licensePlate" value={formData.licensePlate} onChange={handleChange} required />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                        <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Available">Available</SelectItem>
                            <SelectItem value="In Use">In Use</SelectItem>
                            <SelectItem value="Maintenance">Maintenance</SelectItem>
                            <SelectItem value="Out of Service">Out of Service</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(value) => handleSelectChange('type', value)}>
                        <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Car">Car</SelectItem>
                            <SelectItem value="Truck">Truck</SelectItem>
                            <SelectItem value="Bus">Bus</SelectItem>
                            <SelectItem value="Ambulance">Ambulance</SelectItem>
                            <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" value={formData.capacity} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fuelType">Fuel Type</Label>
                    <Select value={formData.fuelType} onValueChange={(value) => handleSelectChange('fuelType', value)}>
                        <SelectTrigger id="fuelType"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Petrol">Petrol</SelectItem>
                            <SelectItem value="Diesel">Diesel</SelectItem>
                            <SelectItem value="Electric">Electric</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input id="color" name="color" value={formData.color} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="mileage">Mileage (km)</Label>
                    <Input id="mileage" name="mileage" type="number" value={formData.mileage} onChange={handleChange} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="state">Assigned State</Label>
                <Select
                    value={formData.state}
                    onValueChange={(value) => handleSelectChange('state', value)}
                    disabled={!isSuperAdmin}
                >
                    <SelectTrigger id="state">
                        <SelectValue placeholder="Select a state" />
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
                    <p className="text-[10px] text-muted-foreground">Admin: Restricted to your assigned state.</p>
                )}
            </div>
            <div className="space-y-2">
                <Label>Vehicle Image</Label>
                <div className="space-y-4">
                    {imagePreview ? (
                        <div className="relative">
                            <img
                                src={imagePreview}
                                alt="Vehicle preview"
                                className="w-full h-48 object-cover rounded-lg border"
                            />
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={handleImageRemove}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div
                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                            onClick={() => document.getElementById('image-upload')?.click()}
                        >
                            <Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                            <p className="mt-2 text-xs sm:text-sm text-gray-600">
                                Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                        </div>
                    )}
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                    />
                    {uploading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Uploading...</span>
                                <span>{Math.round(uploadProgress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes..." />
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">{loading ? 'Saving...' : 'Save Vehicle'}</Button>
            </DialogFooter>
        </form>
    );
}

export default function VehicleManagementPage() {
    const { vehicles, loading, permissionError, fetchData, exportData } = useAdminData();
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(12); // 12 vehicles per page
    const { toast } = useToast();

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter, typeFilter]);

    const filteredVehicles = useMemo(() => {
        if (!vehicles) return [];
        return vehicles.filter(vehicle => {
            const matchesSearch = !debouncedSearchTerm ||
                vehicle.make.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                vehicle.model.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                vehicle.licensePlate.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
            const matchesType = typeFilter === 'all' || vehicle.type === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [vehicles, debouncedSearchTerm, statusFilter, typeFilter]);

    const paginatedVehicles = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredVehicles.slice(startIndex, startIndex + pageSize);
    }, [filteredVehicles, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredVehicles.length / pageSize);

    const handleAddNew = () => {
        setSelectedVehicle(null);
        setIsFormOpen(true);
    };

    const handleEdit = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        setIsFormOpen(true);
    };

    const handleSave = () => {
        setIsFormOpen(false);
        setSelectedVehicle(null);
        fetchData();
    };

    const handleCancel = () => {
        setIsFormOpen(false);
        setSelectedVehicle(null);
    };

    const handleDelete = async (vehicle: Vehicle) => {
        if (!confirm(`Are you sure you want to delete ${vehicle.make} ${vehicle.model}?`)) return;

        try {
            await deleteDoc(doc(db, "vehicles", vehicle.id));
            toast({ title: "Success", description: "Vehicle deleted successfully." });
            fetchData();
        } catch (error) {
            console.error("Error deleting vehicle: ", error);
            toast({ title: "Error", description: "Could not delete vehicle.", variant: "destructive" });
        }
    };

    const handleBulkDelete = async () => {
        if (selectedVehicles.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedVehicles.size} vehicles?`)) return;

        try {
            const batch = writeBatch(db);
            selectedVehicles.forEach(id => {
                batch.delete(doc(db, "vehicles", id));
            });
            await batch.commit();
            toast({ title: "Success", description: `${selectedVehicles.size} vehicles deleted successfully.` });
            setSelectedVehicles(new Set());
            fetchData();
        } catch (error) {
            console.error("Error deleting vehicles: ", error);
            toast({ title: "Error", description: "Could not delete vehicles.", variant: "destructive" });
        }
    };

    const handleSelectVehicle = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedVehicles);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedVehicles(newSelected);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedVehicles(new Set(filteredVehicles.map(v => v.id)));
        } else {
            setSelectedVehicles(new Set());
        }
    };

    const totalVehicles = vehicles?.length || 0;
    const availableCount = vehicles?.filter(v => v.status === 'Available').length || 0;
    const inUseCount = vehicles?.filter(v => v.status === 'In Use').length || 0;
    const maintenanceCount = vehicles?.filter(v => v.status === 'Maintenance').length || 0;

    return (
        <div className="space-y-6">
            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); else setIsFormOpen(true); }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedVehicle ? "Edit Vehicle Details" : "Add New Vehicle"}</DialogTitle>
                        <DialogDescription>
                            {selectedVehicle ? "Update the vehicle information." : "Fill in the vehicle details."}
                        </DialogDescription>
                    </DialogHeader>
                    <VehicleForm vehicle={selectedVehicle} onSave={handleSave} onCancel={handleCancel} />
                </DialogContent>
            </Dialog>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Vehicle Management</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Manage and track all vehicles in the fleet</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto"><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh</Button>
                    <Button variant="outline" onClick={() => exportData('vehicles')} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
                    <Button onClick={handleAddNew} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Add Vehicle</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-1 sm:gap-4">
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Total Vehicles</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{totalVehicles}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Available</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{availableCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <Car className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">In Use</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{inUseCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Maintenance</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{maintenanceCount}</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search by make, model, or license plate..."
                        className="pl-10 h-9 sm:h-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] h-9 sm:h-10">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="In Use">In Use</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Out of Service">Out of Service</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] h-9 sm:h-10">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Car">Car</SelectItem>
                        <SelectItem value="Truck">Truck</SelectItem>
                        <SelectItem value="Bus">Bus</SelectItem>
                        <SelectItem value="Ambulance">Ambulance</SelectItem>
                        <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                </Select>
                {selectedVehicles.size > 0 && (
                    <Button variant="destructive" onClick={handleBulkDelete} className="w-full sm:w-auto">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete ({selectedVehicles.size})
                    </Button>
                )}
            </div>

            {permissionError && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view vehicle data. Please check your Firestore security rules.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {loading || !vehicles ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="max-w-[90vw] sm:max-w-full"><CardContent className="p-2 sm:p-4"><Skeleton className="h-48 sm:h-64 w-full" /></CardContent></Card>
                    ))
                ) : paginatedVehicles.length > 0 ? (
                    paginatedVehicles.map(vehicle => {
                        const statusInfo = getStatusInfo(vehicle.status);
                        return (
                            <Card key={vehicle.id} className={cn("transition-shadow hover:shadow-lg max-w-[90vw] sm:max-w-full", statusInfo.cardClass)}>
                                <CardContent className="p-2 sm:p-4 space-y-2 sm:space-y-4">
                                    {vehicle.imageUrl && (
                                        <div className="relative">
                                            <img
                                                src={vehicle.imageUrl}
                                                alt={`${vehicle.make} ${vehicle.model}`}
                                                className="w-full h-32 object-cover rounded-lg"
                                            />
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                checked={selectedVehicles.has(vehicle.id)}
                                                onCheckedChange={(checked) => handleSelectVehicle(vehicle.id, !!checked)}
                                            />
                                            <div>
                                                <p className="font-bold">{vehicle.make} {vehicle.model}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {vehicle.year} &middot; {vehicle.licensePlate}
                                                    {vehicle.state && (
                                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-bold uppercase text-[9px] tracking-tight">
                                                            {vehicle.state}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant={statusInfo.badgeVariant} className="flex gap-1.5 items-center">
                                            {statusInfo.icon} {vehicle.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        {getVehicleIcon(vehicle.type)}
                                        <span className="text-xs sm:text-sm">{vehicle.type}</span>
                                    </div>
                                    <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Capacity:</span>
                                            <span>{vehicle.capacity} passengers</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Fuel:</span>
                                            <span>{vehicle.fuelType}</span>
                                        </div>
                                        {vehicle.color && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Color:</span>
                                                <span>{vehicle.color}</span>
                                            </div>
                                        )}
                                        {vehicle.mileage && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Mileage:</span>
                                                <span>{vehicle.mileage.toLocaleString()} km</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 sm:pt-4 border-t gap-2">
                                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                            <Button size="sm" onClick={() => handleEdit(vehicle)} className="w-full sm:w-auto"><Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Edit</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(vehicle)} className="w-full sm:w-auto"><Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Delete</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : !permissionError ? (
                    <div className="col-span-full text-center py-16">
                        <h3 className="text-xl font-semibold">No vehicles found</h3>
                        <p className="text-muted-foreground mt-2">Click the "Add Vehicle" button to register a new vehicle.</p>
                    </div>
                ) : null}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    )
}