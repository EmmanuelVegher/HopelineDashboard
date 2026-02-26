
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DisplacedPerson, type Shelter } from "@/lib/data";
import { Users, User, Check, CheckCircle, Heart, AlertTriangle, RefreshCw, Search, Filter, Plane, MapPin, Clock, Send, Info, BedDouble, Plus, Edit, Download, Navigation, Globe, Locate, Loader2, Phone, MessageSquare, MessageCircle } from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import { NIGERIA_STATE_BOUNDS } from "@/lib/nigeria-geography";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { collection, doc, writeBatch, runTransaction, addDoc, updateDoc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "@/lib/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from 'xlsx';

const getStatusInfo = (status: string, t: any) => {
    switch (status) {
        case 'Eligible for Shelter':
            return {
                badgeVariant: 'default' as const,
                cardClass: 'border-blue-200 bg-blue-50/50',
                icon: <CheckCircle className="h-4 w-4 text-blue-600" />,
                priority: t('admin.displacedPersons.priorityEnum.medium'),
                priorityColor: 'bg-blue-500',
                display: t('admin.displacedPersons.statusEnum.eligibleForShelter')
            };
        case 'Moving to Shelter':
            return {
                badgeVariant: 'secondary' as const,
                cardClass: 'border-yellow-200 bg-yellow-50/50',
                icon: <Plane className="h-4 w-4 text-yellow-600" />,
                priority: t('admin.displacedPersons.priorityEnum.medium'),
                priorityColor: 'bg-yellow-500',
                display: t('admin.displacedPersons.statusEnum.movingToShelter')
            };
        case 'Needs Assistance':
            return {
                badgeVariant: 'secondary' as const,
                cardClass: 'border-orange-200 bg-orange-50/50',
                icon: <Heart className="h-4 w-4 text-orange-600" />,
                priority: t('admin.displacedPersons.priorityEnum.medium'),
                priorityColor: 'bg-orange-500',
                display: t('admin.displacedPersons.statusEnum.needsAssistance')
            };
        case 'Emergency':
            return {
                badgeVariant: 'destructive' as const,
                cardClass: 'border-red-200 bg-red-50/50',
                icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
                priority: t('admin.displacedPersons.priorityEnum.high'),
                priorityColor: 'bg-red-600',
                display: t('admin.displacedPersons.statusEnum.emergency')
            };
        case 'Safe':
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-green-200 bg-green-50/20',
                icon: <CheckCircle className="h-4 w-4 text-green-600" />,
                priority: t('admin.displacedPersons.priorityEnum.low'),
                priorityColor: 'bg-green-500',
                display: t('admin.displacedPersons.statusEnum.safeAssigned')
            };
        case 'Resettled':
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-green-300 bg-green-100/30',
                icon: <CheckCircle className="h-4 w-4 text-green-700" />,
                priority: t('admin.displacedPersons.priorityEnum.low'),
                priorityColor: 'bg-green-600',
                display: t('admin.displacedPersons.statusEnum.resettled')
            };
        case 'Homebound':
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-slate-300 bg-slate-100',
                icon: <RefreshCw className="h-4 w-4 text-slate-600" />,
                priority: t('admin.displacedPersons.priorityEnum.low'),
                priorityColor: 'bg-slate-500',
                display: t('admin.displacedPersons.statusEnum.homebound')
            };
        default:
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-gray-200',
                icon: <Search className="h-4 w-4 text-gray-500" />,
                priority: t('admin.displacedPersons.priorityEnum.low'),
                priorityColor: 'bg-gray-500',
                display: status
            };
    }
};

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'High Priority': return 'bg-red-600 text-white';
        case 'Medium Priority': return 'bg-yellow-500 text-white';
        case 'Low Priority': return 'bg-green-500 text-white';
        default: return 'bg-gray-500 text-white';
    }
}

const initialPersonState: Partial<DisplacedPerson> = {
    name: '',
    phone: '',
    details: '',
    status: 'Needs Assistance',
    currentLocation: '',
    destination: '',
    vulnerabilities: [],
    medicalNeeds: [],
    assistanceRequested: '',
    priority: 'Medium Priority',
    lastUpdate: new Date().toLocaleString(),
    // New fields
    householdLocationType: 'Host community',
    shelterCondition: '',
    displacementCause: '',
    stayingLocation: 'Host community',
    householdComposition: {
        total: 1,
        adults: 1,
        children: 0,
        elderly: 0,
        pwds: 0
    },
    isShelterSafe: true,
    weatherProtection: [],
    urgentShelterProblem: [],
    receivedAssistance: false,
    assistanceNeeded: [],
    gender: 'Other',
    state: ''
};

function PersonForm({ person, existingPersons = [], onSave, onCancel, onSwitchToEdit }: { person?: DisplacedPerson | null, existingPersons?: DisplacedPerson[], onSave: () => void, onCancel: () => void, onSwitchToEdit?: (person: DisplacedPerson) => void }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<DisplacedPerson>>(initialPersonState);
    const [loading, setLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [nameSuggestions, setNameSuggestions] = useState<DisplacedPerson[]>([]);
    const [phoneDuplicate, setPhoneDuplicate] = useState<DisplacedPerson | null>(null);
    const [activeTab, setActiveTab] = useState('basic');
    const { toast } = useToast();
    const { users, adminProfile } = useAdminData();
    const { getCurrentPosition } = useGeolocation();
    const isSuperAdmin = adminProfile?.role?.toLowerCase().includes('super');
    const adminState = adminProfile?.state || '';

    const isFormValid = !!(
        formData.name?.trim() &&
        formData.phone?.trim() &&
        formData.currentLocation?.trim() &&
        formData.state?.trim() &&
        formData.gender &&
        formData.stayingLocation &&
        formData.shelterCondition &&
        formData.displacementCause?.trim()
    );

    const nigerianStates = Object.keys(NIGERIA_STATE_BOUNDS).sort();
    const functions = getFunctions();
    const createAccounts = httpsCallable(functions, 'createDisplacedPersonAccounts');

    const matchingUsers = userSearch.length > 1
        ? users?.filter(u =>
            u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.email?.toLowerCase().includes(userSearch.toLowerCase())
        ).slice(0, 5) || []
        : [];

    useEffect(() => {
        if (person) {
            setFormData(person);
        } else {
            setFormData({
                ...initialPersonState,
                state: isSuperAdmin ? '' : adminState
            });
        }
        // Reset warnings/suggestions when mode changes
        setNameSuggestions([]);
        setPhoneDuplicate(null);
    }, [person, isSuperAdmin, adminState]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'name' && value.length > 2) {
            const matches = existingPersons.filter(p =>
                p.name.toLowerCase().includes(value.toLowerCase()) && p.id !== person?.id
            ).slice(0, 5);
            setNameSuggestions(matches);
        } else if (name === 'name') {
            setNameSuggestions([]);
        }

        if (name === 'phone' && value.length > 5) {
            const duplicate = existingPersons.find(p =>
                p.phone === value && p.id !== person?.id
            );
            setPhoneDuplicate(duplicate || null);
        } else if (name === 'phone') {
            setPhoneDuplicate(null);
        }
    };

    const handleUseExisting = () => {
        if (phoneDuplicate && onSwitchToEdit) {
            onSwitchToEdit(phoneDuplicate);
        }
    };

    const handleCompositionChange = (field: keyof NonNullable<DisplacedPerson['householdComposition']>, value: string) => {
        const numValue = parseInt(value) || 0;
        setFormData(prev => {
            const current = prev.householdComposition || initialPersonState.householdComposition!;
            const next = { ...current, [field]: numValue };

            // Auto-calculate total if changing components
            if (field !== 'total') {
                next.total = (next.adults || 0) + (next.children || 0) + (next.elderly || 0) + (next.pwds || 0);
            }

            return { ...prev, householdComposition: next };
        });
    };

    const handleWeatherToggle = (condition: string) => {
        setFormData(prev => {
            const current = prev.weatherProtection || [];
            if (current.includes(condition)) {
                return { ...prev, weatherProtection: current.filter(c => c !== condition) };
            } else {
                return { ...prev, weatherProtection: [...current, condition] };
            }
        });
    };

    const toggleMultiSelect = (field: keyof DisplacedPerson, value: string) => {
        setFormData(prev => {
            const current = (prev[field] as string[]) || [];
            if (current.includes(value)) {
                return { ...prev, [field]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [field]: [...current, value] };
            }
        });
    };



    const handleSelectChange = (name: keyof DisplacedPerson, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const [uploadingImage, setUploadingImage] = useState(false);

    // ... rest of state ...

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setUploadingImage(true);
        try {
            const storage = getStorage();
            const storageRef = ref(storage, `displaced-persons/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
            toast({ title: "Image Uploaded", description: "Image uploaded successfully." });
        } catch (error) {
            console.error("Upload error:", error);
            toast({ title: "Upload Failed", description: "Could not upload image.", variant: "destructive" });
        } finally {
            setUploadingImage(false);
        }
    };

    const [fetchingLocation, setFetchingLocation] = useState(false);

    const handleGetLocation = async () => {
        setFetchingLocation(true);
        try {
            const position = await getCurrentPosition();
            setFormData(prev => ({
                ...prev,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            }));
            toast({
                title: "Location Captured",
                description: `Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`
            });
        } catch (error: any) {
            console.error("Location error:", error);
            toast({
                title: "Location Error",
                description: "Could not retrieve your current location. Please check permissions.",
                variant: "destructive"
            });
        } finally {
            setFetchingLocation(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let dataToSave = {
                ...formData,
                lastUpdate: new Date().toLocaleString()
            };

            // Auto-create account if new person and phone exists
            if (!person?.id && formData.phone?.trim() && formData.name?.trim()) {
                try {
                    const result: any = await createAccounts({
                        users: [{
                            name: formData.name,
                            phone: formData.phone,
                            gender: formData.gender,
                            state: formData.state,
                            image: formData.imageUrl,
                            latitude: formData.latitude,
                            longitude: formData.longitude
                        }]
                    });
                    const accountResult = result.data.results[0];
                    if (accountResult.status === 'created' || (accountResult.status === 'skipped' && accountResult.reason === 'Account already exists')) {
                        // Attempt to link if created or already exists
                        if (accountResult.uid) {
                            dataToSave = { ...dataToSave, userId: accountResult.uid };
                            toast({ title: "Account Created", description: `User account created/linked for ${formData.phone}` });
                        } else {
                            toast({ title: "Account Note", description: `Account for ${formData.phone} already exists or could not be linked automatically.` });
                        }
                    } else if (accountResult.status === 'error') {
                        toast({ title: "Account Creation Failed", description: accountResult.reason, variant: 'destructive' });
                    }
                } catch (err) {
                    console.error("Failed to create account helper:", err);
                }
            }


            if (person?.id) {
                const personRef = doc(db, "displacedPersons", person.id);
                await setDoc(personRef, {
                    ...dataToSave,
                    lastUpdate: new Date().toLocaleString()
                }, { merge: true });
                toast({ title: "Success", description: "Person updated successfully." });
            } else {
                await addDoc(collection(db, "displacedPersons"), {
                    ...dataToSave,
                    lastUpdate: new Date().toLocaleString()
                });
                toast({ title: "Success", description: "Person added successfully." });
            }
            onSave();
        } catch (error) {
            console.error("Error saving person: ", error);
            toast({ title: "Error", description: "Could not save person details.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }



    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-4">
            <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">{t('admin.displacedPersons.form.tabs.basic')}</TabsTrigger>
                    <TabsTrigger value="assessment">{t('admin.displacedPersons.form.tabs.assessment')}</TabsTrigger>
                    <TabsTrigger value="needs">{t('admin.displacedPersons.form.tabs.needs')}</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg mb-4 space-y-3">
                        <h3 className="font-medium text-blue-900 flex justify-between items-center">
                            {t('admin.displacedPersons.form.linkAccount')}
                            {formData.userId && (
                                <Badge variant="default" className="bg-blue-600">
                                    {t('admin.displacedPersons.form.linkedTo')} {formData.userId}
                                </Badge>
                            )}
                        </h3>
                        <p className="text-sm text-blue-700">
                            {t('admin.displacedPersons.form.linkAccountDesc')}
                        </p>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                placeholder={t('admin.displacedPersons.form.searchContact')}
                                className="pl-8 bg-white"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                            />
                            {userSearch && matchingUsers.length > 0 && (
                                <ScrollArea className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40">
                                    {matchingUsers.map(u => (
                                        <div
                                            key={u.id}
                                            className="p-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, userId: u.id, name: u.displayName || prev.name }));
                                                setUserSearch('');
                                            }}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{u.displayName}</p>
                                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                            </div>
                                            {formData.userId === u.id && <Check className="h-4 w-4 text-green-600" />}
                                        </div>
                                    ))}
                                </ScrollArea>
                            )}
                        </div>
                        {formData.userId && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setFormData(prev => ({ ...prev, userId: undefined }))}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                                {t('admin.displacedPersons.form.unlink')}
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">{t('admin.displacedPersons.form.fullName')} *</Label>
                            <Input
                                id="name"
                                value={formData.name || ''}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={t('admin.displacedPersons.form.fullNamePlaceholder')}
                                required
                            />
                            {nameSuggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                    <div className="p-2 text-xs font-semibold text-muted-foreground bg-slate-50 border-b">
                                        Potential Matches Found:
                                    </div>
                                    {nameSuggestions.map(s => (
                                        <div
                                            key={s.id}
                                            className="p-2 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0"
                                            onClick={() => {
                                                if (onSwitchToEdit) onSwitchToEdit(s);
                                            }}
                                        >
                                            <span className="font-medium">{s.name}</span>
                                            <span className="text-xs text-muted-foreground ml-2">({s.currentLocation})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">{t('admin.displacedPersons.form.phone')} *</Label>
                            <Input
                                id="phone"
                                value={formData.phone || ''}
                                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder={t('admin.displacedPersons.form.phonePlaceholder')}
                                required
                            />
                            {phoneDuplicate && (
                                <Alert variant="destructive" className="mt-2 text-xs py-2">
                                    <AlertTriangle className="h-3 w-3" />
                                    <AlertTitle className="text-xs font-semibold">{t('admin.displacedPersons.form.duplicatePhone')}</AlertTitle>
                                    <AlertDescription className="mt-1">
                                        <p>{t('admin.displacedPersons.form.matches')} <strong>{phoneDuplicate.name}</strong> ({phoneDuplicate.currentLocation}).</p>
                                        <div className="flex gap-2 mt-2">
                                            <Button type="button" variant="secondary" size="sm" className="h-6 text-[10px]" onClick={handleUseExisting}>
                                                {t('admin.displacedPersons.form.useExisting')}
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] bg-red-50 border-red-200 text-red-700 hover:bg-red-100" onClick={() => setPhoneDuplicate(null)}>
                                                {t('admin.displacedPersons.form.flagContinue')}
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currentLocation">{t('admin.displacedPersons.form.cityVillage')} *</Label>
                            <Input id="currentLocation" value={formData.currentLocation || ''} onChange={e => setFormData(prev => ({ ...prev, currentLocation: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="details">{t('admin.displacedPersons.form.otherDetails')}</Label>
                            <Input id="details" value={formData.details || ''} onChange={e => setFormData(prev => ({ ...prev, details: e.target.value }))} placeholder="e.g., Age 45..." />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">{t('admin.displacedPersons.form.sex')} *</Label>
                            <Select value={formData.gender || ''} onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v }))}>
                                <SelectTrigger id="gender">
                                    <SelectValue placeholder={t('admin.displacedPersons.form.selectGender')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="state">{t('admin.displacedPersons.form.currentState')} *</Label>
                            <Select
                                value={formData.state || ''}
                                onValueChange={(v) => setFormData(prev => ({ ...prev, state: v }))}
                                disabled={!isSuperAdmin && !!adminState}
                            >
                                <SelectTrigger id="state">
                                    <SelectValue placeholder={t('admin.displacedPersons.form.selectState')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {isSuperAdmin ? (
                                        nigerianStates.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value={adminState}>{adminState}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2 mt-4 p-4 border rounded-lg bg-gray-50">
                        <Label>{t('admin.displacedPersons.form.locationImage')}</Label>
                        <div className="flex items-center gap-4">
                            <Input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="max-w-[250px]" disabled={uploadingImage} />
                            {uploadingImage && <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span>}
                            {formData.imageUrl && !uploadingImage && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.form.imageUploaded')}
                                </Badge>
                            )}
                        </div>
                        <Input
                            id="image"
                            name="imageUrl"
                            value={formData.imageUrl || ''}
                            onChange={handleChange}
                            placeholder="Or enter URL manually https://..."
                            className="mt-2"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between h-5">
                                <Label htmlFor="latitude">{t('admin.displacedPersons.form.latitudeOptional')}</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] gap-1 px-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                                    onClick={handleGetLocation}
                                    disabled={fetchingLocation}
                                >
                                    {fetchingLocation ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Locate className="h-3 w-3" />
                                    )}
                                    {fetchingLocation ? t('admin.displacedPersons.form.fetching') : t('admin.displacedPersons.form.getCurrentLocation')}
                                </Button>
                            </div>
                            <Input type="number" id="latitude" name="latitude" value={formData.latitude || ''} onChange={handleChange} placeholder="e.g. 11.8333" step="any" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="longitude">{t('admin.displacedPersons.form.longitudeOptional')}</Label>
                            <Input type="number" id="longitude" name="longitude" value={formData.longitude || ''} onChange={handleChange} placeholder="e.g. 13.1500" step="any" />
                        </div>
                    </div>


                </TabsContent>

                <TabsContent value="assessment" className="space-y-4">
                    <div className="space-y-2">
                        <Label>Where is your household currently staying?</Label>
                        <Select value={formData.stayingLocation} onValueChange={(v) => handleSelectChange('stayingLocation', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Host community">Host community</SelectItem>
                                <SelectItem value="IDP camp">IDP camp</SelectItem>
                                <SelectItem value="Open space">Open space</SelectItem>
                                <SelectItem value="Abandoned structure">Abandoned structure</SelectItem>
                                <SelectItem value="Others">Others</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Current Shelter Condition</Label>
                        <Select value={formData.shelterCondition} onValueChange={(v) => handleSelectChange('shelterCondition', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Rented accommodation">Rented accommodation</SelectItem>
                                <SelectItem value="Own house (damaged but habitable)">Own house (damaged but habitable)</SelectItem>
                                <SelectItem value="Own house (safe and adequate)">Own house (safe and adequate)</SelectItem>
                                <SelectItem value="Staying with relatives or friends">Staying with relatives or friends</SelectItem>
                                <SelectItem value="Homeless / living in open areas">Homeless / living in open areas</SelectItem>
                                <SelectItem value="Makeshift or temporary shelter (tent, shack, uncompleted building)">Makeshift or temporary shelter (tent, shack, uncompleted building)</SelectItem>
                                <SelectItem value="Camp shelter (formal IDP camp)">Camp shelter (formal IDP camp)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="displacementCause">What caused the damage/displacement?</Label>
                        <Textarea id="displacementCause" name="displacementCause" value={formData.displacementCause} onChange={handleChange} placeholder="e.g. Flooding, Conflict..." />
                    </div>

                    <div className="space-y-3">
                        <Label>Household Composition (Disaggregate)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">Total</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.total} readOnly className="bg-slate-100 font-bold" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">Adults</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.adults} onChange={(e) => handleCompositionChange('adults', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">Children</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.children} onChange={(e) => handleCompositionChange('children', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">Elderly</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.elderly} onChange={(e) => handleCompositionChange('elderly', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">PWDs</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.pwds} onChange={(e) => handleCompositionChange('pwds', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="needs" className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label>Is shelter safe/secure?</Label>
                                <p className="text-[10px] text-muted-foreground">Is the structure secure?</p>
                            </div>
                            <Switch checked={formData.isShelterSafe} onCheckedChange={(checked) => handleSelectChange('isShelterSafe', checked as any)} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label>Received assistance?</Label>
                                <p className="text-[10px] text-muted-foreground">Previous shelter aid?</p>
                            </div>
                            <Switch checked={formData.receivedAssistance} onCheckedChange={(checked) => handleSelectChange('receivedAssistance', checked as any)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Weather Protection Issues (Select all that apply)</Label>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                            {['Rain', 'Wind', 'Heat', 'Cold'].map(cond => (
                                <Button
                                    key={cond} type="button"
                                    variant={formData.weatherProtection?.includes(cond) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleWeatherToggle(cond)}
                                    className="h-8"
                                >
                                    {cond}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Most Urgent Shelter Problem (Select all that apply)</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Leakage', 'Overcrowding', 'Lack of privacy', 'Unsafe structure'].map(problem => (
                                <div key={problem} className="flex items-center space-x-2 p-2 border rounded hover:bg-slate-50">
                                    <Checkbox
                                        id={`problem-${problem}`}
                                        checked={formData.urgentShelterProblem?.includes(problem)}
                                        onCheckedChange={() => toggleMultiSelect('urgentShelterProblem', problem)}
                                    />
                                    <label htmlFor={`problem-${problem}`} className="text-sm font-medium leading-none cursor-pointer">
                                        {problem}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Assistance Needed Most Urgently (Select all that apply)</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Emergency shelter', 'Repairs', 'Relocation', 'Transitional shelter', 'NFIs'].map(need => (
                                <div key={need} className="flex items-center space-x-2 p-2 border rounded hover:bg-slate-50">
                                    <Checkbox
                                        id={`need-${need}`}
                                        checked={formData.assistanceNeeded?.includes(need)}
                                        onCheckedChange={() => toggleMultiSelect('assistanceNeeded', need)}
                                    />
                                    <label htmlFor={`need-${need}`} className="text-sm font-medium leading-none cursor-pointer">
                                        {need}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Admin Status</Label>
                            <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Needs Assistance">Needs Assistance</SelectItem>
                                    <SelectItem value="Eligible for Shelter">Eligible</SelectItem>
                                    <SelectItem value="Moving to Shelter">En Route</SelectItem>
                                    <SelectItem value="Emergency">Emergency</SelectItem>
                                    <SelectItem value="Safe">Safe / Assigned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Admin Priority</Label>
                            <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low Priority">Low</SelectItem>
                                    <SelectItem value="Medium Priority">Medium</SelectItem>
                                    <SelectItem value="High Priority">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-white">
                <Button type="button" variant="outline" onClick={onCancel}>{t('admin.displacedPersons.form.cancel')}</Button>
                <Button type="submit" disabled={loading || !isFormValid}>{loading ? t('admin.displacedPersons.form.saving') : t('admin.displacedPersons.form.save')}</Button>
            </DialogFooter>
        </form >
    );
}

function AssignShelterDialog({ person, allShelters, isOpen, onOpenChange, onAssign }: { person: DisplacedPerson | null, allShelters: Shelter[], isOpen: boolean, onOpenChange: (open: boolean) => void, onAssign: () => void }) {
    const { t } = useTranslation();
    const [filteredShelters, setFilteredShelters] = useState<Shelter[]>([]);
    const [availableStates, setAvailableStates] = useState<string[]>([]);
    const [selectedState, setSelectedState] = useState('');
    const [selectedShelter, setSelectedShelter] = useState<string>('');
    const [bedNumber, setBedNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && allShelters.length > 0) {
            const states = [...new Set(allShelters.map(s => {
                const parts = s.location?.split(',').map(p => p.trim());
                return parts?.length > 1 ? parts[1] : parts?.[0]; // Get state, or city if no state
            }).filter(Boolean as any))];
            setAvailableStates(states.sort());
        } else if (!isOpen) {
            // Reset state when dialog closes
            setSelectedState('');
            setSelectedShelter('');
            setFilteredShelters([]);
            setAvailableStates([]);
        }
    }, [isOpen, allShelters]);

    useEffect(() => {
        if (selectedState) {
            const sheltersInState = (allShelters || [])
                .filter(s => s.location.includes(selectedState))
                .sort((a, b) => b.availableCapacity - a.availableCapacity);
            setFilteredShelters(sheltersInState);
        } else {
            setFilteredShelters([]);
        }
        // Reset selected shelter when state changes
        setSelectedShelter('');
    }, [selectedState, allShelters]);


    const handleSubmit = async () => {
        if (!person || !selectedShelter) {
            toast({ title: "Error", description: "Please select a shelter.", variant: "destructive" });
            return;
        }
        setSubmitting(true);

        try {
            await runTransaction(db, async (transaction) => {
                const shelterRef = doc(db, "shelters", selectedShelter);
                const personRef = doc(db, "displacedPersons", person.id);

                const shelterDoc = await transaction.get(shelterRef);
                if (!shelterDoc.exists()) {
                    throw "Shelter document not found!";
                }
                if (shelterDoc.data().availableCapacity < 1) {
                    throw "Selected shelter has no available capacity.";
                }

                transaction.update(shelterRef, {
                    availableCapacity: shelterDoc.data().availableCapacity - 1
                });

                transaction.update(personRef, {
                    status: 'Safe',
                    assignedShelterId: selectedShelter,
                    allocatedResources: { bedNumber },
                    activityLog: [...(person.activityLog || []), {
                        date: new Date().toLocaleString(),
                        action: `Assigned to Shelter: ${shelterDoc.data().name}`,
                        performedBy: "Administrator",
                        notes: bedNumber ? `Space/Bed: ${bedNumber}` : undefined
                    }]
                });
            });

            toast({ title: "Success", description: `${person.name} has been assigned to a shelter.` });
            onAssign();
        } catch (error: any) {
            console.error("Assignment transaction failed: ", error);
            toast({ title: "Assignment Failed", description: error.toString(), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (!person) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin.displacedPersons.assignShelter.title')} {person.name}</DialogTitle>
                    <DialogDescription>{t('admin.displacedPersons.assignShelter.desc')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="state">{t('admin.displacedPersons.assignShelter.filterState')}</Label>
                        <Select value={selectedState} onValueChange={setSelectedState}>
                            <SelectTrigger id="state">
                                <SelectValue placeholder={t('admin.displacedPersons.assignShelter.chooseState')} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableStates.map(s => (
                                    <SelectItem key={s} value={s}>
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="shelter">{t('admin.displacedPersons.assignShelter.selectShelter')}</Label>
                        <Select value={selectedShelter} onValueChange={setSelectedShelter} disabled={!selectedState}>
                            <SelectTrigger id="shelter">
                                <SelectValue placeholder={!selectedState ? t('admin.displacedPersons.assignShelter.chooseState') : t('admin.displacedPersons.assignShelter.chooseShelter')} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredShelters.map(s => (
                                    <SelectItem key={s.id} value={s.id} disabled={s.availableCapacity === 0}>
                                        {s.name} ({s.availableCapacity} {t('admin.displacedPersons.assignShelter.spotsAvailable')})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedShelter && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="bed-number">{t('admin.displacedPersons.assignShelter.roomNumber')}</Label>
                                <Input id="bed-number" value={bedNumber} onChange={e => setBedNumber(e.target.value)} placeholder={t('admin.displacedPersons.assignShelter.roomPlaceholder')} />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">{t('admin.displacedPersons.assignShelter.cancel')}</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !selectedShelter} className="w-full sm:w-auto">
                        {submitting ? t('admin.displacedPersons.assignShelter.assigning') : t('admin.displacedPersons.assignShelter.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LogActivityDialog({ person, isOpen, onOpenChange, onLog }: { person: DisplacedPerson | null, isOpen: boolean, onOpenChange: (open: boolean) => void, onLog: (personId: string, action: string, notes?: string) => void }) {
    const { t } = useTranslation();
    const [action, setAction] = useState('General Assistance');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!action) return;
        setSubmitting(true);
        try {
            await onLog(person!.id, action, notes);
            setNotes('');
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    }

    if (!person) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('admin.displacedPersons.logActivity.title')} {person.name}</DialogTitle>
                    <DialogDescription>{t('admin.displacedPersons.logActivity.desc')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.logActivity.type')}</Label>
                        <Select value={action} onValueChange={setAction}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Food Pack Delivered">{t('admin.displacedPersons.logActivity.types.food')}</SelectItem>
                                <SelectItem value="Medical Checkup">{t('admin.displacedPersons.logActivity.types.medical')}</SelectItem>
                                <SelectItem value="Clothing/NFIs Provided">{t('admin.displacedPersons.logActivity.types.clothing')}</SelectItem>
                                <SelectItem value="Counseling Session">{t('admin.displacedPersons.logActivity.types.counseling')}</SelectItem>
                                <SelectItem value="Communication with Family">{t('admin.displacedPersons.logActivity.types.communication')}</SelectItem>
                                <SelectItem value="Protection Screening">{t('admin.displacedPersons.logActivity.types.protection')}</SelectItem>
                                <SelectItem value="General Assistance">{t('admin.displacedPersons.logActivity.types.general')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.logActivity.notes')}</Label>
                        <Textarea
                            placeholder={t('admin.displacedPersons.logActivity.notesPlaceholder')}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('admin.displacedPersons.logActivity.cancel')}</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !action}>
                        {submitting ? t('admin.displacedPersons.logActivity.logging') : t('admin.displacedPersons.logActivity.log')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AccountCreationSummaryDialog({ summary, onClose }: { summary: { created: number, skipped: any[], errors: any[] } | null, onClose: () => void }) {
    const { t } = useTranslation();
    if (!summary) return null;

    return (
        <Dialog open={!!summary} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('admin.displacedPersons.import.summaryTitle')}</DialogTitle>
                    <DialogDescription>
                        {t('admin.displacedPersons.import.summaryDesc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4 py-4">
                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-bold text-green-700">{summary.created}</span>
                            <span className="text-xs text-green-600 font-medium">{t('admin.displacedPersons.import.accountsCreated')}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-50 border-yellow-200">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-bold text-yellow-700">{summary.skipped.length}</span>
                            <span className="text-xs text-yellow-600 font-medium">{t('admin.displacedPersons.import.skipped')}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-bold text-red-700">{summary.errors.length}</span>
                            <span className="text-xs text-red-600 font-medium">{t('admin.displacedPersons.import.errors')}</span>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[200px]">
                    {summary.skipped.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Info className="h-4 w-4 text-yellow-600" />
                                {t('admin.displacedPersons.import.skippedAccounts')}
                            </h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No.</TableHead>
                                        <TableHead>{t('admin.displacedPersons.import.table.name')}</TableHead>
                                        <TableHead>{t('admin.displacedPersons.import.table.phone')}</TableHead>
                                        <TableHead>{t('admin.displacedPersons.import.reason')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.skipped.map((item, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="text-xs">{i + 1}</TableCell>
                                            <TableCell className="text-xs font-medium">{item.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.phone}</TableCell>
                                            <TableCell className="text-xs text-yellow-600">{item.reason}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {summary.errors.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                {t('admin.displacedPersons.import.failedAccounts')}
                            </h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No.</TableHead>
                                        <TableHead>{t('admin.displacedPersons.import.table.name')}</TableHead>
                                        <TableHead>{t('admin.displacedPersons.import.table.phone')}</TableHead>
                                        <TableHead>{t('admin.displacedPersons.import.reason')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {summary.errors.map((item, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="text-xs">{i + 1}</TableCell>
                                            <TableCell className="text-xs font-medium">{item.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.phone}</TableCell>
                                            <TableCell className="text-xs text-red-600">{item.reason}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>{t('admin.displacedPersons.import.close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function DisplacedPersonsPage() {
    const { t } = useTranslation();
    const { persons: displacedPersons, shelters, loading, permissionError, fetchData, adminProfile } = useAdminData();
    const isSuperAdmin = adminProfile?.role?.toLowerCase().includes('super');
    const [selectedPerson, setSelectedPerson] = useState<DisplacedPerson | null>(null);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
    const [excelImportData, setExcelImportData] = useState<any[]>([]);
    const [excelImportErrors, setExcelImportErrors] = useState<string[]>([]);
    const [skippedPhonesCount, setSkippedPhonesCount] = useState(0);
    const [importingExcel, setImportingExcel] = useState(false);
    const [isImportInstructionsOpen, setIsImportInstructionsOpen] = useState(false);
    const { toast } = useToast();
    const functions = getFunctions();
    const createAccounts = httpsCallable(functions, 'createDisplacedPersonAccounts');
    const [creationSummary, setCreationSummary] = useState<{ created: number, skipped: any[], errors: any[] } | null>(null);
    const [creatingAccounts, setCreatingAccounts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const navigate = useNavigate();

    const handleCall = (phone: string) => window.open(`tel:${phone}`, '_self');
    const handleSMS = (phone: string) => window.open(`sms:${phone}`, '_self');
    const handleWhatsApp = (phone: string) => {
        const clean = phone.replace(/\D/g, '');
        const waPhone = clean.startsWith('0') ? '234' + clean.substring(1) : clean;
        window.open(`https://wa.me/${waPhone}`, '_blank');
    };
    const handleChat = (userId?: string) => {
        if (!userId) {
            toast({ title: "No linked account", description: "This beneficiary doesn't have a linked user account for in-app chat.", variant: "destructive" });
            return;
        }
        navigate(`/admin/chats?userId=${userId}`);
    };

    const filteredPersons = useMemo(() => {
        if (!displacedPersons) return [];
        return displacedPersons.filter(person => {
            const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                person.id.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'all' || person.status.toLowerCase() === statusFilter.toLowerCase();

            return matchesSearch && matchesStatus;
        });
    }, [displacedPersons, searchQuery, statusFilter]);

    const EXPECTED_IMPORT_HEADERS = {
        'Full Name of Household Head': 'name',
        'Phone Number': 'phone',
        'Current City/Village': 'currentLocation',
        'Other Identifying Details': 'details',
        'Current Location Type': 'householdLocationType',
        'Staying Location': 'stayingLocation',
        'Shelter Condition': 'shelterCondition',
        'Displacement Cause': 'displacementCause',
        'Total Household Size': 'total',
        'Adults': 'adults',
        'Children': 'children',
        'Elderly': 'elderly',
        'PWDs': 'pwds',
        'Is Shelter Safe': 'isShelterSafe',
        'Received Assistance': 'receivedAssistance',
        'Weather Protection Issues': 'weatherProtection',
        'Most Urgent Shelter Problem': 'urgentShelterProblem',
        'Assistance Needed Most Urgently': 'assistanceNeeded',
        'Status': 'status',
        'Priority': 'priority',
        'Gender': 'gender',
        'State': 'state',
        'Profile Image URL': 'image',
        'Latitude': 'latitude',
        'Longitude': 'longitude'
    };

    const handleDownloadTemplate = () => {
        const headers = Object.keys(EXPECTED_IMPORT_HEADERS);
        const sampleRow: any = {};

        // Populate sample row based on headers
        headers.forEach(header => {
            switch (header) {
                case 'Full Name of Household Head': sampleRow[header] = 'John Doe'; break;
                case 'Phone Number': sampleRow[header] = '08012345678'; break;
                case 'Gender': sampleRow[header] = 'Male'; break;
                case 'State': sampleRow[header] = 'Borno'; break;
                case 'Profile Image URL': sampleRow[header] = 'https://example.com/image.jpg'; break;
                case 'Latitude': sampleRow[header] = '11.8333'; break;
                case 'Longitude': sampleRow[header] = '13.1500'; break;
                case 'Current City/Village': sampleRow[header] = 'Maiduguri'; break;
                case 'Other Identifying Details': sampleRow[header] = 'Head of family'; break;
                case 'Current Location Type': sampleRow[header] = 'Host community'; break;
                case 'Staying Location': sampleRow[header] = 'Host community'; break;
                case 'Shelter Condition': sampleRow[header] = 'Partially damaged'; break;
                case 'Displacement Cause': sampleRow[header] = 'Flooding'; break;
                case 'Total Household Size': sampleRow[header] = 5; break;
                case 'Adults': sampleRow[header] = 2; break;
                case 'Children': sampleRow[header] = 3; break;
                case 'Elderly': sampleRow[header] = 0; break;
                case 'PWDs': sampleRow[header] = 0; break;
                case 'Is Shelter Safe': sampleRow[header] = 'No'; break;
                case 'Received Assistance': sampleRow[header] = 'No'; break;
                case 'Weather Protection Issues': sampleRow[header] = 'Rain, Wind'; break;
                case 'Most Urgent Shelter Problem': sampleRow[header] = 'Leakage'; break;
                case 'Assistance Needed Most Urgently': sampleRow[header] = 'Emergency shelter'; break;
                case 'Status': sampleRow[header] = 'Needs Assistance'; break;
                case 'Priority': sampleRow[header] = 'High Priority'; break;
                default: sampleRow[header] = '';
            }
        });

        const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Hopeline_Import_Template.xlsx");
    };

    const handleOpenAssignDialog = (person: DisplacedPerson) => {
        setSelectedPerson(person);
        setIsAssignDialogOpen(true);
    };





    const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(sheet, {
                    raw: true,
                    header: 1, // Get array of arrays to check headers first
                    defval: ''
                });

                if (rawData.length === 0) {
                    toast({ title: "Error", description: "The file appears to be empty.", variant: "destructive" });
                    return;
                }

                const fileHeaders = rawData[0] as string[];
                const expectedHeaders = Object.keys(EXPECTED_IMPORT_HEADERS);

                // Basic validation: Check if required headers are present
                const missingHeaders = expectedHeaders.filter(h => !fileHeaders.includes(h));
                if (missingHeaders.length > 5) { // Allow some flexibility, but if too many match fail
                    console.error("Missing headers:", missingHeaders);
                    // Fallback to simple mapping if headers don't match, or show error
                }

                // Parse properly now using header: 0 to get object with keys
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                const processedData: any[] = [];
                const parsingErrors: string[] = [];
                let missingPhones = 0;

                jsonData.forEach((row: any, index: number) => {
                    // Map row using EXPECTED_IMPORT_HEADERS
                    let mappedData: any = {
                        id: doc(collection(db, "displacedPersons")).id, // Generate ID client-side for keying
                        lastUpdate: new Date().toLocaleString(),
                        rowIndex: index + 2 // 1-based, +1 for header
                    };

                    // Map fields
                    Object.entries(EXPECTED_IMPORT_HEADERS).forEach(([header, field]) => {
                        let value = row[header];

                        // Specific type conversions
                        if (field === 'householdComposition') {
                            // This is complex, flat structure in Excel -> object in model
                        } else if (['total', 'adults', 'children', 'elderly', 'pwds'].includes(field)) {
                            // Handle under householdComposition
                            if (!mappedData.householdComposition) mappedData.householdComposition = { ...initialPersonState.householdComposition };
                            mappedData.householdComposition[field] = parseInt(value) || 0;
                        } else if (['weatherProtection', 'urgentShelterProblem', 'assistanceNeeded'].includes(field)) {
                            mappedData[field] = typeof value === 'string' ? value.split(',').map(s => s.trim()) : [];
                        } else if (field === 'isShelterSafe' || field === 'receivedAssistance') {
                            mappedData[field] = value === 'Yes' || value === true || value === 'TRUE';
                        } else {
                            if (value !== undefined) mappedData[field] = value;
                        }
                    });

                    // Fill defaults if missing
                    mappedData = { ...initialPersonState, ...mappedData };

                    // Validate required fields
                    if (!mappedData.phone) {
                        missingPhones++;
                        // parsingErrors.push(`Row ${index + 2}: Missing Phone Number.`); // Don't push to errors if we just want a count shown separately?
                        // Requirement: "show the number that would be skipped and not imported because of lack of phone number"
                        // I'll skip pushing to `processedData` if phone is missing.
                    } else if (!mappedData.name) {
                        parsingErrors.push(`Row ${index + 2}: Missing Name.`);
                    } else {
                        processedData.push(mappedData);
                    }
                });

                setExcelImportData(processedData);
                setExcelImportErrors(parsingErrors);
                setSkippedPhonesCount(missingPhones);
                setIsExcelPreviewOpen(true);
                setIsImportInstructionsOpen(false); // Close instructions

            } catch (error) {
                console.error("Error reading Excel file:", error);
                toast({ title: "Error", description: "Failed to parse Excel file.", variant: "destructive" });
            }
        };

        reader.readAsBinaryString(file);
        // Reset input
        event.target.value = '';
    };

    const handleConfirmExcelImport = async () => {
        setImportingExcel(true);
        try {
            // 1. Extract users to create accounts for
            const usersToCreate = excelImportData.map(p => ({
                name: p.name,
                phone: p.phone,
                gender: p.gender,
                state: p.state,
                image: p.image,
                latitude: p.latitude,
                longitude: p.longitude
            })).filter(u => u.name && u.phone);

            // 2. Call Cloud Function to batch create accounts
            let accountResults: any[] = [];
            try {
                const result: any = await createAccounts({ users: usersToCreate });
                accountResults = result.data.results;
            } catch (err) {
                console.error("Failed to batch create accounts:", err);
                toast({ title: "Warning", description: "Failed to create user accounts. Proceeding with data import.", variant: "destructive" });
            }

            // 3. Process results and map UIDs to data
            let createdCount = 0;
            const skipped: any[] = [];
            const errors: any[] = [];

            const processedData = excelImportData.map(person => {
                const accountRes = accountResults.find(r => r.phone === person.phone);
                if (accountRes) {
                    if (accountRes.status === 'created') {
                        createdCount++;
                        return { ...person, userId: accountRes.uid };
                    } else if (accountRes.status === 'skipped') {
                        skipped.push({ name: person.name, phone: person.phone, reason: accountRes.reason });
                    } else {
                        errors.push({ name: person.name, phone: person.phone, reason: accountRes.reason });
                    }
                }
                return person;
            });

            if (skipped.length > 0) {
                setCreationSummary({ created: createdCount, skipped, errors });
            } else if (createdCount > 0) {
                toast({ title: "Accounts Created", description: `Successfully created ${createdCount} user accounts.` });
            }

            // 4. Save to Firestore
            const batch = writeBatch(db);
            processedData.forEach((person) => {
                const docRef = doc(collection(db, "displacedPersons"));
                // Clean up helper fields before saving
                const { rowIndex, ...dataToSave } = person;
                batch.set(docRef, {
                    ...dataToSave,
                    lastUpdate: new Date().toLocaleString()
                });
            });

            await batch.commit();
            toast({ title: "Success", description: `${excelImportData.length} records imported successfully.` });

            // Cleanup
            setIsExcelPreviewOpen(false);
            setExcelImportData([]);
            setImportingExcel(false);

            // Refresh data (if necessary, though useAdminData might auto-update via listeners)
            fetchData();

        } catch (error) {
            console.error("Error importing data: ", error);
            toast({ title: "Error", description: "Failed to import data.", variant: "destructive" });
            setImportingExcel(false);
        }
    };

    const handleRemoveExcelRow = (index: number) => {
        setExcelImportData(prev => prev.filter((_, i) => i !== index));
    };

    const handleBulkCreateAccounts = async () => {
        const withoutAccounts = displacedPersons?.filter(p => !p.userId && p.phone) || [];
        if (withoutAccounts.length === 0) {
            toast({ title: "No missing accounts", description: "All displaced persons already have associated accounts." });
            return;
        }

        setCreatingAccounts(true);
        try {
            // 1. Extract users to create accounts for
            const usersToCreate = withoutAccounts
                .map(p => ({
                    name: p.name,
                    phone: p.phone,
                    gender: p.gender,
                    state: p.state,
                    image: p.imageUrl,
                    latitude: p.latitude,
                    longitude: p.longitude
                }))
                .filter(u => u.name && u.phone);

            // 2. Process in batches to avoid timeouts
            const BATCH_SIZE = 50;
            const batches = [];
            for (let i = 0; i < usersToCreate.length; i += BATCH_SIZE) {
                batches.push(usersToCreate.slice(i, i + BATCH_SIZE));
            }

            let totalCreated = 0;
            const allSkipped: any[] = [];
            const allErrors: any[] = [];

            for (let i = 0; i < batches.length; i++) {
                const batchUsers = batches[i];
                try {
                    // Call Cloud Function for this batch
                    const result: any = await createAccounts({ users: batchUsers });
                    const accountResults = result.data.results;

                    // Update Firestore for this batch
                    const batchWrite = writeBatch(db);
                    let batchUpdatedCount = 0;

                    batchUsers.forEach(user => {
                        const person = withoutAccounts.find(p => p.phone === user.phone);
                        if (!person) return;

                        const accountRes = accountResults.find((r: any) => r.phone === user.phone);
                        if (accountRes && (accountRes.status === 'created' || accountRes.status === 'skipped') && accountRes.uid) {
                            const docRef = doc(db, "displacedPersons", person.id);
                            batchWrite.update(docRef, { userId: accountRes.uid, lastUpdate: new Date().toLocaleString() });
                            batchUpdatedCount++;
                            if (accountRes.status === 'created') totalCreated++;
                            if (accountRes.status === 'skipped') {
                                allSkipped.push({ name: person.name, phone: person.phone, reason: accountRes.reason });
                            }
                        } else if (accountRes?.status === 'error') {
                            allErrors.push({ name: person.name, phone: person.phone, reason: accountRes.reason });
                        }
                    });

                    if (batchUpdatedCount > 0) {
                        await batchWrite.commit();
                    }

                    // Optional: Update progress or toast here if needed
                    console.log(`Processed batch ${i + 1}/${batches.length}`);

                } catch (batchError) {
                    console.error(`Error processing batch ${i + 1}:`, batchError);
                    toast({ title: "Batch Error", description: `Failed to process batch ${i + 1}. Continuing...`, variant: "destructive" });
                }
            }

            if (totalCreated > 0) {
                toast({ title: "Accounts Updated", description: `Successfully linked/created ${totalCreated} user accounts.` });
                fetchData();
            }

            if (allSkipped.length > 0 || allErrors.length > 0) {
                setCreationSummary({ created: totalCreated, skipped: allSkipped, errors: allErrors });
            }

        } catch (error) {
            console.error("Bulk account creation error:", error);
            toast({ title: "Error", description: "Failed to create missing accounts.", variant: "destructive" });
        } finally {
            setCreatingAccounts(false);
        }
    };

    const handleAssignmentComplete = () => {
        setIsAssignDialogOpen(false);
        setSelectedPerson(null);
        fetchData();
    };

    const handleAddNew = () => {
        setSelectedPerson(null);
        setIsFormOpen(true);
    };

    const handleEdit = (person: DisplacedPerson) => {
        setSelectedPerson(person);
        setIsFormOpen(true);
    };

    const handleSave = () => {
        setIsFormOpen(false);
        setSelectedPerson(null);
        fetchData();
    }

    const handleCancel = () => {
        setIsFormOpen(false);
        setSelectedPerson(null);
    }



    const handleLogActivity = async (personId: string, action: string, notes?: string) => {
        const person = displacedPersons?.find(p => p.id === personId);
        if (!person) return;

        const newActivity = {
            date: new Date().toLocaleString(),
            action,
            performedBy: "Administrator",
            notes
        };

        const updatedLog = [...(person.activityLog || []), newActivity];

        try {
            await updateDoc(doc(db, "displacedPersons", personId), {
                activityLog: updatedLog,
                lastUpdate: new Date().toLocaleString()
            });
            toast({ title: "Activity Logged", description: action });
            fetchData();
        } catch (error) {
            console.error("Error logging activity:", error);
            toast({ title: "Error", description: "Failed to log activity", variant: "destructive" });
        }
    };

    const handleUpdateStatus = async (personId: string, newStatus: DisplacedPerson['status']) => {
        const person = displacedPersons?.find(p => p.id === personId);
        if (!person) return;

        const newActivity = {
            date: new Date().toLocaleString(),
            action: `Status changed to ${newStatus}`,
            performedBy: "Administrator"
        };

        const updatedLog = [...(person.activityLog || []), newActivity];

        try {
            await updateDoc(doc(db, "displacedPersons", personId), {
                status: newStatus,
                activityLog: updatedLog,
                lastUpdate: new Date().toLocaleString()
            });
            toast({ title: "Status Updated", description: `Person marked as ${newStatus}` });
            fetchData();
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleNavigate = (person: DisplacedPerson) => {
        if (person.latitude && person.longitude) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${person.latitude},${person.longitude}`, "_blank");
        } else {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(person.currentLocation)}`, "_blank");
        }
    }

    const handleSatellite = (person: DisplacedPerson) => {
        let googleMapsUrl;
        if (person.latitude && person.longitude) {
            // t=k forces satellite view, z=20 is high zoom
            googleMapsUrl = `https://www.google.com/maps?q=${person.latitude},${person.longitude}&t=k&z=20`;
        } else {
            googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(person.currentLocation)}&t=k&z=20`;
        }
        window.open(googleMapsUrl, "_blank");
    }

    const totalTracked = displacedPersons?.length || 0;
    const safeCount = displacedPersons?.filter(p => p.status === 'Safe').length || 0;
    const eligibleCount = displacedPersons?.filter(p => p.status === 'Eligible for Shelter').length || 0;
    const assistanceCount = displacedPersons?.filter(p => p.status === 'Needs Assistance').length || 0;
    const emergencyCount = displacedPersons?.filter(p => p.status === 'Emergency').length || 0;

    return (
        <div className="space-y-6">
            <AccountCreationSummaryDialog
                summary={creationSummary}
                onClose={() => setCreationSummary(null)}
            />
            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); else setIsFormOpen(true); }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{selectedPerson ? "Edit Person Details" : "Add New Beneficiary"}</DialogTitle>
                        <DialogDescription>
                            {selectedPerson ? "Update the information for this individual." : "Fill in the details for the new person."}
                        </DialogDescription>
                    </DialogHeader>
                    <PersonForm
                        person={selectedPerson}
                        existingPersons={displacedPersons || []}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        onSwitchToEdit={handleEdit}
                    />
                </DialogContent>
            </Dialog>
            <AssignShelterDialog
                person={selectedPerson}
                allShelters={shelters || []}
                isOpen={isAssignDialogOpen}
                onOpenChange={(isOpen) => { if (!isOpen) setSelectedPerson(null); setIsAssignDialogOpen(isOpen); }}
                onAssign={handleAssignmentComplete}
            />
            <LogActivityDialog
                person={selectedPerson}
                isOpen={isLogDialogOpen}
                onOpenChange={(isOpen) => { if (!isOpen) setSelectedPerson(null); setIsLogDialogOpen(isOpen); }}
                onLog={handleLogActivity}
            />

            <Dialog open={isImportInstructionsOpen} onOpenChange={setIsImportInstructionsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('admin.displacedPersons.import.title')}</DialogTitle>
                        <DialogDescription>
                            {t('admin.displacedPersons.import.desc')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-4 p-4 bg-slate-50 border rounded-lg max-h-[40vh] overflow-y-auto">
                        <h4 className="font-semibold text-sm mb-2">{t('admin.displacedPersons.import.requiredHeaders')}</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.keys(EXPECTED_IMPORT_HEADERS).map(header => (
                                <div key={header} className="p-1 bg-white border rounded px-2">
                                    {header}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 border-t pt-4">
                            <Label htmlFor="file-upload" className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                {t('admin.displacedPersons.import.selectFile')}
                            </Label>
                            <Input
                                id="file-upload"
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={handleExcelImport}
                                disabled={importingExcel}
                            />
                            {importingExcel && <span className="text-sm text-muted-foreground animate-pulse">{t('admin.displacedPersons.import.processing')}</span>}
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                        <Button variant="secondary" onClick={handleDownloadTemplate} className="w-full sm:w-auto">
                            <Download className="mr-2 h-4 w-4" /> {t('admin.displacedPersons.import.downloadTemplate')}
                        </Button>
                        <Button variant="outline" onClick={() => setIsImportInstructionsOpen(false)} className="w-full sm:w-auto">{t('admin.displacedPersons.import.cancel')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <Dialog open={isExcelPreviewOpen} onOpenChange={setIsExcelPreviewOpen}>
                <DialogContent className="max-w-7xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{t('admin.displacedPersons.import.previewTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('admin.displacedPersons.import.previewDesc')}
                            {skippedPhonesCount > 0 && (
                                <span className="text-yellow-600 block mt-2 font-medium">
                                    ⚠️ {skippedPhonesCount} {t('admin.displacedPersons.import.skippedDesc')}
                                </span>
                            )}
                            {excelImportErrors.length > 0 && (
                                <span className="text-red-600 block mt-2">
                                    {excelImportErrors.length} {t('admin.displacedPersons.import.errorsFound')}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {excelImportErrors.length > 0 && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <h4 className="font-semibold text-red-800 mb-2">{t('admin.displacedPersons.import.importErrors')}</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                                {excelImportErrors.map((error, index) => (
                                    <li key={index}>• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">#</TableHead>
                                    <TableHead>{t('admin.displacedPersons.import.table.name')}</TableHead>
                                    <TableHead>{t('admin.displacedPersons.import.table.phone')}</TableHead>
                                    <TableHead>{t('admin.displacedPersons.import.table.details')}</TableHead>
                                    <TableHead>{t('admin.displacedPersons.import.table.locType')}</TableHead>
                                    <TableHead>{t('admin.displacedPersons.import.table.location')}</TableHead>
                                    <TableHead>{t('admin.displacedPersons.import.table.totalHh')}</TableHead>
                                    <TableHead>{t('admin.displacedPersons.import.table.valid')}</TableHead>
                                    <TableHead className="w-24">{t('admin.displacedPersons.import.table.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {excelImportData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{row.rowIndex}</TableCell>
                                        <TableCell className="font-medium">{row.name}</TableCell>
                                        <TableCell>{row.phone}</TableCell>
                                        <TableCell>{row.details}</TableCell>
                                        <TableCell>{row.householdLocationType}</TableCell>
                                        <TableCell>{row.currentLocation}</TableCell>
                                        <TableCell>{row.householdComposition?.total}</TableCell>
                                        <TableCell>
                                            <span className="text-green-600">
                                                ✓
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveExcelRow(index)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                {t('admin.displacedPersons.import.table.remove')}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => { setIsExcelPreviewOpen(false); setExcelImportData([]); }} className="w-full sm:w-auto">
                            {t('admin.displacedPersons.import.cancel')}
                        </Button>
                        <Button
                            onClick={handleConfirmExcelImport}
                            disabled={excelImportData.length === 0 || importingExcel}
                            className="w-full sm:w-auto"
                        >
                            {importingExcel ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    {t('admin.displacedPersons.import.importing')}
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    {t('admin.displacedPersons.import.confirmImport')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">{t('admin.displacedPersons.title')}</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">{t('admin.displacedPersons.subtitle')}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto"><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />{t('admin.displacedPersons.refresh')}</Button>
                    <Button onClick={handleAddNew} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />{t('admin.displacedPersons.addBeneficiary')}</Button>
                    <div className="relative">
                        <Button
                            variant="outline"
                            onClick={() => setIsImportInstructionsOpen(true)}
                            className="w-full sm:w-auto"
                        >
                            <Send className="mr-2 h-4 w-4" />
                            {t('admin.displacedPersons.importExcel')}
                        </Button>
                    </div>
                    {displacedPersons?.some(p => !p.userId && p.phone) && isSuperAdmin && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 w-full sm:w-auto"
                            onClick={handleBulkCreateAccounts}
                            disabled={creatingAccounts || displacedPersons.filter(p => !p.userId && p.phone).length === 0}
                        >
                            {creatingAccounts ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                            {t('admin.displacedPersons.createMissingAccounts')} ({displacedPersons.filter(p => !p.userId && p.phone).length})
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-1 sm:gap-4">
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">{t('admin.displacedPersons.stats.totalTracked')}</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{totalTracked}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">{t('admin.displacedPersons.stats.safe')}</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{safeCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <BedDouble className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">{t('admin.displacedPersons.stats.eligible')}</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{eligibleCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">{t('admin.displacedPersons.stats.needAssistance')}</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{assistanceCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">{t('admin.displacedPersons.stats.emergency')}</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{emergencyCount}</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                        placeholder={t('admin.displacedPersons.searchPlaceholder')}
                        className="pl-10 h-9 sm:h-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10">
                        <SelectValue placeholder={t('admin.displacedPersons.cardView.allStatuses')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t('admin.displacedPersons.cardView.allStatuses')}</SelectItem>
                        <SelectItem value="safe">{t('admin.displacedPersons.statusEnum.safe')}</SelectItem>
                        <SelectItem value="eligible for shelter">{t('admin.displacedPersons.statusEnum.eligibleForShelter')}</SelectItem>
                        <SelectItem value="moving to shelter">{t('admin.displacedPersons.statusEnum.movingToShelter')}</SelectItem>
                        <SelectItem value="needs assistance">{t('admin.displacedPersons.statusEnum.needsAssistance')}</SelectItem>
                        <SelectItem value="emergency">{t('admin.displacedPersons.statusEnum.emergency')}</SelectItem>
                        <SelectItem value="resettled">{t('admin.displacedPersons.statusEnum.resettled')}</SelectItem>
                        <SelectItem value="homebound">{t('admin.displacedPersons.statusEnum.homebound')}</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" className="h-9 sm:h-10 w-full sm:w-auto"><Filter className="mr-2 h-4 w-4" />{t('admin.displacedPersons.cardView.moreFilters')}</Button>
            </div>

            {permissionError && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('admin.displacedPersons.cardView.permissionDenied')}</AlertTitle>
                    <AlertDescription>
                        {t('admin.displacedPersons.cardView.permissionDeniedDesc')}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {loading || !displacedPersons ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="max-w-[90vw] sm:max-w-full"><CardContent className="p-2 sm:p-4"><Skeleton className="h-64 sm:h-80 w-full" /></CardContent></Card>
                    ))
                ) : filteredPersons.length > 0 ? (
                    filteredPersons.map(person => {
                        const statusInfo = getStatusInfo(person.status, t);
                        const displayPriority = person.priority === 'High Priority' ? t('admin.displacedPersons.priorityEnum.high') : person.priority === 'Medium Priority' ? t('admin.displacedPersons.priorityEnum.medium') : person.priority === 'Low Priority' ? t('admin.displacedPersons.priorityEnum.low') : person.priority;
                        return (
                            <Card key={person.id} className={cn("transition-shadow hover:shadow-lg max-w-[90vw] sm:max-w-full", statusInfo.cardClass)}>
                                <CardContent className="p-2 sm:p-4 space-y-2 sm:space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold">{person.name}</p>
                                            <p className="text-xs text-muted-foreground">{person.id} &middot; {person.details === 'Head of family' ? t('admin.displacedPersons.cardView.headOfFamily') : person.details}</p>
                                        </div>
                                        <Badge variant={statusInfo.badgeVariant} className="flex gap-1.5 items-center">
                                            {statusInfo.icon} {statusInfo.display}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-2 pb-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50"
                                            onClick={() => handleCall(person.phone || '')}
                                            title="Call"
                                            disabled={!person.phone}
                                        >
                                            <Phone className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50"
                                            onClick={() => handleSMS(person.phone || '')}
                                            title="SMS"
                                            disabled={!person.phone}
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-green-200 text-green-600 hover:bg-green-50"
                                            onClick={() => handleWhatsApp(person.phone || '')}
                                            title="WhatsApp"
                                            disabled={!person.phone}
                                        >
                                            <MessageCircle className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-orange-200 text-orange-600 hover:bg-orange-50"
                                            onClick={() => handleChat(person.userId)}
                                            title="In-App Chat"
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-purple-200 text-purple-600 hover:bg-purple-50"
                                            onClick={() => handleNavigate(person)}
                                            title="Navigate"
                                        >
                                            <Navigation className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm pl-2 border-l-2 ml-2">
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">{t('admin.displacedPersons.cardView.currentLocation')}</p>
                                                <p>{person.currentLocation}</p>
                                            </div>
                                        </div>
                                        {person.destination && (
                                            <div className="flex items-start gap-2 sm:gap-3">
                                                <Send className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-xs text-muted-foreground">{t('admin.displacedPersons.cardView.destination')}</p>
                                                    <p>{person.destination}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <Info className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">{t('admin.displacedPersons.cardView.vulnerabilities')}</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {(person.vulnerabilities ?? []).map(v => <Badge key={v} variant="secondary" className="font-normal text-xs">{v}</Badge>)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                                            <div className="flex items-center justify-between">
                                                <p className="font-semibold text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> {t('admin.displacedPersons.cardView.activityHistory')}
                                                </p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => {
                                                        setSelectedPerson(person);
                                                        setIsLogDialogOpen(true);
                                                    }}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" /> {t('admin.displacedPersons.cardView.logActivity')}
                                                </Button>
                                            </div>
                                            {person.activityLog && person.activityLog.length > 0 ? (
                                                <ScrollArea className="max-h-24">
                                                    <div className="space-y-3 pr-2 pt-1">
                                                        {(person.activityLog ?? []).slice().reverse().map((log, idx) => (
                                                            <div key={idx} className="relative pl-3 border-l-2 border-slate-200 ml-1">
                                                                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-500" />
                                                                <div className="flex flex-col">
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="font-semibold text-[10px] leading-tight text-slate-800">{log.action}</span>
                                                                        <span className="text-[9px] text-slate-400 whitespace-nowrap ml-2">{log.date.split(',')[0]}</span>
                                                                    </div>
                                                                    {log.notes && <p className="text-[10px] text-slate-500 mt-0.5 leading-tight italic">{log.notes}</p>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground italic">{t('admin.displacedPersons.cardView.noActivitiesLogged')}</p>
                                            )}
                                        </div>
                                        {person.medicalNeeds && person.medicalNeeds.length > 0 && (
                                            <div className="flex items-start gap-2 sm:gap-3">
                                                <Heart className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-xs text-muted-foreground">{t('admin.displacedPersons.cardView.medicalNeeds')}</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(person.medicalNeeds ?? []).map(m => <Badge key={m} variant="destructive" className="bg-red-50 text-red-700 font-normal text-xs">{m}</Badge>)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">{t('admin.displacedPersons.cardView.assistanceRequested')}</p>
                                                <div className="p-2 bg-yellow-100/50 rounded-md text-yellow-800 mt-1 text-xs">{person.assistanceRequested}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">{t('admin.displacedPersons.cardView.lastUpdate')}</p>
                                                <p>{formatTimestamp(person.lastUpdate)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 sm:pt-4 border-t gap-2">
                                        <div className="flex flex-wrap gap-1 sm:gap-2">
                                            <Button size="sm" onClick={() => handleNavigate(person)} className="h-8 bg-blue-600 hover:bg-blue-700 text-white border-none">
                                                <Navigation className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.cardView.navigate')}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleSatellite(person)} className="h-8">
                                                <Globe className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.cardView.satellite')}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(person)} className="h-8"><Edit className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.cardView.edit')}</Button>
                                            {person.status === 'Safe' ? (
                                                <div className="flex gap-1">
                                                    <Button size="sm" variant="outline" className="h-8 border-green-200 text-green-700 hover:bg-green-50" onClick={() => handleUpdateStatus(person.id, 'Resettled')}>
                                                        {t('admin.displacedPersons.cardView.resettle')}
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => handleUpdateStatus(person.id, 'Homebound')}>
                                                        {t('admin.displacedPersons.cardView.homebound')}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="bg-blue-600 hover:bg-blue-700 h-8"
                                                    onClick={() => handleOpenAssignDialog(person)}
                                                    disabled={person.status === 'Resettled' || person.status === 'Homebound'}
                                                >
                                                    <BedDouble className="mr-2 h-3 w-3" /> {t('admin.displacedPersons.cardView.assignShelter')}
                                                </Button>
                                            )}
                                        </div>
                                        <Badge className={cn(getPriorityColor(person.priority), "font-semibold text-[10px] sm:text-xs")}>{displayPriority}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : !permissionError ? (
                    <div className="col-span-2 text-center py-16">
                        <h3 className="text-xl font-semibold">{t('admin.displacedPersons.cardView.noPersonsFound')}</h3>
                        <p className="text-muted-foreground mt-2">{t('admin.displacedPersons.cardView.addPersonPrompt')}</p>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
