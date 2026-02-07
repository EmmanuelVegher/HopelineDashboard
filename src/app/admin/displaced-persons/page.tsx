
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DisplacedPerson, type Shelter } from "@/lib/data";
import { Users, User, Check, CheckCircle, Heart, AlertTriangle, RefreshCw, Search, Filter, Plane, MapPin, Clock, Phone, Send, Info, BedDouble, Plus, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { collection, doc, writeBatch, runTransaction, addDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from 'xlsx';

const getStatusInfo = (status: string) => {
    switch (status) {
        case 'Eligible for Shelter':
            return {
                badgeVariant: 'default' as const,
                cardClass: 'border-blue-200 bg-blue-50/50',
                icon: <CheckCircle className="h-4 w-4 text-blue-600" />,
                priority: 'Medium Priority',
                priorityColor: 'bg-blue-500'
            };
        case 'Moving to Shelter':
            return {
                badgeVariant: 'secondary' as const,
                cardClass: 'border-yellow-200 bg-yellow-50/50',
                icon: <Plane className="h-4 w-4 text-yellow-600" />,
                priority: 'Medium Priority',
                priorityColor: 'bg-yellow-500'
            };
        case 'Needs Assistance':
            return {
                badgeVariant: 'secondary' as const,
                cardClass: 'border-orange-200 bg-orange-50/50',
                icon: <Heart className="h-4 w-4 text-orange-600" />,
                priority: 'Medium Priority',
                priorityColor: 'bg-orange-500'
            };
        case 'Emergency':
            return {
                badgeVariant: 'destructive' as const,
                cardClass: 'border-red-200 bg-red-50/50',
                icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
                priority: 'High Priority',
                priorityColor: 'bg-red-600'
            };
        case 'Safe':
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-green-200 bg-green-50/20',
                icon: <CheckCircle className="h-4 w-4 text-green-600" />,
                priority: 'Low Priority',
                priorityColor: 'bg-green-500'
            };
        case 'Resettled':
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-green-300 bg-green-100/30',
                icon: <CheckCircle className="h-4 w-4 text-green-700" />,
                priority: 'Low Priority',
                priorityColor: 'bg-green-600'
            };
        case 'Homebound':
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-slate-300 bg-slate-100',
                icon: <RefreshCw className="h-4 w-4 text-slate-600" />,
                priority: 'Low Priority',
                priorityColor: 'bg-slate-500'
            };
        default:
            return {
                badgeVariant: 'outline' as const,
                cardClass: 'border-gray-200',
                icon: <Search className="h-4 w-4 text-gray-500" />,
                priority: 'Low Priority',
                priorityColor: 'bg-gray-500'
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
    shelterCondition: 'Partially damaged',
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
    urgentShelterProblem: 'Leakage',
    receivedAssistance: false,
    assistanceNeeded: 'Emergency shelter'
};

function PersonForm({ person, existingPersons = [], onSave, onCancel, onSwitchToEdit }: { person?: DisplacedPerson | null, existingPersons?: DisplacedPerson[], onSave: () => void, onCancel: () => void, onSwitchToEdit?: (person: DisplacedPerson) => void }) {
    const [formData, setFormData] = useState<Partial<DisplacedPerson>>(initialPersonState);
    const [loading, setLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [nameSuggestions, setNameSuggestions] = useState<DisplacedPerson[]>([]);
    const [phoneDuplicate, setPhoneDuplicate] = useState<DisplacedPerson | null>(null);
    const { toast } = useToast();
    const { users } = useAdminData();

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
            setFormData(initialPersonState);
        }
        // Reset warnings/suggestions when mode changes
        setNameSuggestions([]);
        setPhoneDuplicate(null);
    }, [person]);

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
        setFormData(prev => ({
            ...prev,
            householdComposition: {
                ...(prev.householdComposition || initialPersonState.householdComposition!),
                [field]: numValue
            }
        }));
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

    const handleArrayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.split(',').map(item => item.trim()) }));
    }

    const handleSelectChange = (name: keyof DisplacedPerson, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const dataToSave = {
            ...formData,
            lastUpdate: new Date().toLocaleString()
        };

        try {
            if (person?.id) {
                const personRef = doc(db, "displacedPersons", person.id);
                await updateDoc(personRef, dataToSave);
                toast({ title: "Success", description: "Person updated successfully." });
            } else {
                await addDoc(collection(db, "displacedPersons"), dataToSave);
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
            <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="assessment">Assessment</TabsTrigger>
                    <TabsTrigger value="needs">shelter Needs</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="name">Full Name of Household Head</Label>
                            <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="As per valid ID" autoComplete="off" />
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
                            <Label htmlFor="phone">Phone Number / Contact</Label>
                            <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required placeholder="Beneficiary or focal person" />
                            {phoneDuplicate && (
                                <Alert variant="destructive" className="mt-2 text-xs py-2">
                                    <AlertTriangle className="h-3 w-3" />
                                    <AlertTitle className="text-xs font-semibold">Duplicate Phone Number</AlertTitle>
                                    <AlertDescription className="mt-1">
                                        <p>This number matches <strong>{phoneDuplicate.name}</strong> ({phoneDuplicate.currentLocation}).</p>
                                        <div className="flex gap-2 mt-2">
                                            <Button type="button" variant="secondary" size="sm" className="h-6 text-[10px]" onClick={handleUseExisting}>
                                                Use Existing Record
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] bg-red-50 border-red-200 text-red-700 hover:bg-red-100" onClick={() => setPhoneDuplicate(null)}>
                                                Flag & Continue
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentLocation">Current City/Village</Label>
                            <Input id="currentLocation" name="currentLocation" value={formData.currentLocation} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="details">Other Identifying Details</Label>
                            <Input id="details" name="details" value={formData.details} onChange={handleChange} placeholder="e.g., Age 45, Male" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Current Location Type</Label>
                        <RadioGroup
                            value={formData.householdLocationType}
                            onValueChange={(v) => handleSelectChange('householdLocationType', v)}
                            className="flex flex-wrap gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Host community" id="loc-host" />
                                <Label htmlFor="loc-host">Host community</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="IDP camp" id="loc-idp" />
                                <Label htmlFor="loc-idp">IDP camp</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Refugee" id="loc-refugee" />
                                <Label htmlFor="loc-refugee">Refugee</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <h3 className="font-semibold text-sm">Link User Account</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Link this record to an existing app user to share status updates.</p>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Contact email or name..."
                                className="pl-9 h-9"
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
                            <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-100">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-blue-600" />
                                    <p className="text-xs font-medium">Linked to: {users?.find(u => u.id === formData.userId)?.displayName}</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleSelectChange('userId', '')}
                                >
                                    Unlink
                                </Button>
                            </div>
                        )}
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
                                <SelectItem value="Destroyed">Destroyed</SelectItem>
                                <SelectItem value="Partially damaged">Partially damaged</SelectItem>
                                <SelectItem value="Overcrowded">Overcrowded</SelectItem>
                                <SelectItem value="No shelter">No shelter</SelectItem>
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
                                <Input type="number" min="1" value={formData.householdComposition?.total} onChange={(e) => handleCompositionChange('total', e.target.value)} />
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
                        <Label>Most Urgent Shelter Problem</Label>
                        <Select value={formData.urgentShelterProblem} onValueChange={(v) => handleSelectChange('urgentShelterProblem', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Leakage">Leakage</SelectItem>
                                <SelectItem value="Overcrowding">Overcrowding</SelectItem>
                                <SelectItem value="Lack of privacy">Lack of privacy</SelectItem>
                                <SelectItem value="Unsafe structure">Unsafe structure</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Assistance Needed Most Urgently</Label>
                        <Select value={formData.assistanceNeeded} onValueChange={(v) => handleSelectChange('assistanceNeeded', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Emergency shelter">Emergency shelter</SelectItem>
                                <SelectItem value="Repairs">Repairs</SelectItem>
                                <SelectItem value="Relocation">Relocation</SelectItem>
                                <SelectItem value="Transitional shelter">Transitional shelter</SelectItem>
                                <SelectItem value="NFIs">NFIs (Non-Food Items)</SelectItem>
                            </SelectContent>
                        </Select>
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
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Person Record'}</Button>
            </DialogFooter>
        </form >
    );
}

function AssignShelterDialog({ person, allShelters, isOpen, onOpenChange, onAssign }: { person: DisplacedPerson | null, allShelters: Shelter[], isOpen: boolean, onOpenChange: (open: boolean) => void, onAssign: () => void }) {
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
                    <DialogTitle>Assign Transit Space for {person.name}</DialogTitle>
                    <DialogDescription>Allocate a transit space for the individual. Amenities like bedding and food are provided by external partners.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="state">Filter by State</Label>
                        <Select value={selectedState} onValueChange={setSelectedState}>
                            <SelectTrigger id="state">
                                <SelectValue placeholder="Choose a state" />
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
                        <Label htmlFor="shelter">Select Shelter</Label>
                        <Select value={selectedShelter} onValueChange={setSelectedShelter} disabled={!selectedState}>
                            <SelectTrigger id="shelter">
                                <SelectValue placeholder={!selectedState ? "Please select a state first" : "Choose a shelter"} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredShelters.map(s => (
                                    <SelectItem key={s.id} value={s.id} disabled={s.availableCapacity === 0}>
                                        {s.name} ({s.availableCapacity} spots available)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedShelter && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="bed-number">Room / Space Number</Label>
                                <Input id="bed-number" value={bedNumber} onChange={e => setBedNumber(e.target.value)} placeholder="e.g., Room 101 or Space B-12" />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !selectedShelter} className="w-full sm:w-auto">
                        {submitting ? 'Assigning...' : 'Confirm Assignment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LogActivityDialog({ person, isOpen, onOpenChange, onLog }: { person: DisplacedPerson | null, isOpen: boolean, onOpenChange: (open: boolean) => void, onLog: (action: string, notes: string) => void }) {
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
                    <DialogTitle>Log Activity for {person.name}</DialogTitle>
                    <DialogDescription>Add a record of assistance or movement for this individual.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Type of Activity</Label>
                        <Select value={action} onValueChange={setAction}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Food Pack Delivered">Food Pack Delivered</SelectItem>
                                <SelectItem value="Medical Checkup">Medical Checkup</SelectItem>
                                <SelectItem value="Clothing/NFIs Provided">Clothing/NFIs Provided</SelectItem>
                                <SelectItem value="Counseling Session">Counseling Session</SelectItem>
                                <SelectItem value="Communication with Family">Communication with Family</SelectItem>
                                <SelectItem value="Protection Screening">Protection Screening</SelectItem>
                                <SelectItem value="General Assistance">General Assistance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Notes / Details (Optional)</Label>
                        <Textarea
                            placeholder="Enter specific details about the assistance provided..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !action}>
                        {submitting ? 'Logging...' : 'Log Activity'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function DisplacedPersonsPage() {
    const { persons: displacedPersons, shelters, loading, permissionError, fetchData } = useAdminData();
    const [selectedPerson, setSelectedPerson] = useState<DisplacedPerson | null>(null);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
    const [excelImportData, setExcelImportData] = useState<any[]>([]);
    const [excelImportErrors, setExcelImportErrors] = useState<string[]>([]);
    const [importingExcel, setImportingExcel] = useState(false);
    const { toast } = useToast();

    const handleOpenAssignDialog = (person: DisplacedPerson) => {
        setSelectedPerson(person);
        setIsAssignDialogOpen(true);
    };

    const handleAssignmentComplete = () => {
        setIsAssignDialogOpen(false);
        setSelectedPerson(null);
        fetchData(); // Refresh the list
    }


    const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportingExcel(true);
        setExcelImportErrors([]);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                toast({ title: "Import Failed", description: "No data found in the Excel file.", variant: "destructive" });
                return;
            }

            // Process and validate the data
            const processedData: any[] = [];
            const errors: string[] = [];

            jsonData.forEach((row: any, index: number) => {
                try {
                    // Map Excel columns to survey fields
                    const mappedData = {
                        enumerator_name: row['Enumerator\'s Name'] || row['Enumerators Name'] || '',
                        consent: true, // Assume consent for imported data - can be reviewed in preview
                        state_of_origin: row['State of origin'] || '',
                        lga: row['LGA'] || '',
                        wards: row['Wards'] || '',
                        community: row['Community'] || '',
                        name_of_head_of_household: row['Name of Head of Household'] || '',
                        name_of_spouse: row['Name of spouse'] || '',
                        household_head_gender: row['Household Head Gender'] || '',
                        age: parseInt(row['Age']) || 0,
                        residency_status: row['Residency Status'] || '',
                        phone_number: row['Phone number'] || '',
                        marital_status: row['Marital Status'] || '',
                        household_size: parseInt(row['Household Size']) || 1,
                        hh_size_score: row['hh_size_score'] || 1,
                        shelter_type: row['What type of shelter is your household currently living in?'] || '',
                        displacement_duration: row['How long has your household been displaced from your original home?'] || '',
                        affected_by_floods: (row['Was your household affected by recent floods?'] || '').toLowerCase() === 'yes',
                        flood_impacts: [],
                        flood_prone_area: (row['Do you currently live in a flood-prone area?'] || '').toLowerCase() === 'yes',
                        access_to_water_and_toilet: (row['Does your household have regular access to clean drinking water and a functional toilet or latrine?'] || '').toLowerCase() === 'yes',
                        regular_income: (row['Does your household have a regular source of income?'] || '').toLowerCase() === 'yes',
                        food_frequency: row['How often does your household have enough food to eat?'] || '',
                        basic_needs_frequency: row['How often is your household able to meet other basic needs such as clothing, transportation, and cooking fuel?'] || '',
                        rcsi_relied_on_less_preferred: parseInt(row['Rely on less preferred and less expensive foods?']) || 0,
                        rcsi_borrowed_food: parseInt(row['Borrow food or rely on help from a friend or relative?']) || 0,
                        rcsi_limited_portion_size: parseInt(row['Limit portion size at mealtimes?']) || 0,
                        rcsi_restricted_adults: parseInt(row['Restrict consumption by adults so that small children can eat?']) || 0,
                        rcsi_reduced_meals: parseInt(row['Reduce the number of meals eaten in a day?']) || 0,
                        access_to_farmland: (row['Does your household have access to farmland or fishing grounds?'] || '').toLowerCase() === 'yes',
                        monthly_income: parseInt(row['What is your Household\'s Approximate monthly income (₦)']) || 0,
                        regular_savings: (row['Do you currently save money regularly?'] || '').toLowerCase() === 'yes',
                        interested_in_silc: (row['Are you interested in joining a SILC (Savings and Internal Lending Community)?'] || '').toLowerCase() === 'yes',
                        financial_training: (row['Have you received any financial literacy or business training before?'] || '').toLowerCase() === 'yes',
                        willing_to_attend_training: (row['Would you be willing to attend vocational or financial training to improve your livelihood?'] || '').toLowerCase() === 'yes',
                        school_age_children_attend: (row['Do the school-age children in your household currently attend school?'] || '').toLowerCase() === 'yes',
                        reported_gbv: (row['Are there reported cases of gender-based violence (GBV) in your household or community?'] || '').toLowerCase() === 'yes',
                        gbv_services_available: (row['Are GBV response or support services available in your area?'] || '').toLowerCase() === 'yes, services are available and accessible',
                        experienced_insecurity: (row['Have you or your household experienced any insecurity or violence in the past 6 months?'] || '').toLowerCase() === 'yes',
                        feel_safe: (row['Do you feel safe in your community?'] || '').toLowerCase() === 'yes, i feel safe',
                        access_to_health_facility: (row['Do you have access to a health facility or healthcare provider nearby?'] || '').toLowerCase() === 'yes',
                        chronic_illness: (row['Does any member of your household have a chronic illness or disability?'] || '').toLowerCase() === 'yes',
                        received_psychosocial_support: (row['Have you or any member of your household received psychosocial or counselling support in the past 12 months?'] || '').toLowerCase() === 'yes',
                        willing_participate_awareness: (row['Would you be willing to participate in community awareness or prevention groups (e.g. GBV or peacebuilding)?'] || '').toLowerCase() === 'yes',
                        main_energy_source: row['What is your household\'s main source of energy for cooking?'] || '',
                        aware_clean_cooking: (row['Are you aware of energy-efficient or clean cooking methods (e.g., improved cookstoves, LPG)?'] || '').toLowerCase() === 'yes',
                        disaster_training: (row['Have you ever received training on disaster preparedness, environmental safety, or flood control?'] || '').toLowerCase() === 'yes',
                        willing_participate_environmental: (row['Would you be willing to participate in environmental safety or flood prevention activities in your community?'] || '').toLowerCase() === 'yes',
                        flood_risks: (row['Are there flood risks in your area?'] || '').toLowerCase() === 'yes, high risk',
                        prefer_self_collection: (row['If you are selected for assistance, do you prefer to come yourself?'] || '').toLowerCase() === 'yes',
                        survey_date: row['Date'] || new Date().toISOString().split('T')[0],
                        device_id: row['deviceid'] || '',
                        submission_time: row['_submission_time'] || new Date().toISOString(),
                        rowIndex: index + 1 // For tracking original row
                    };

                    // Validate required fields
                    if (!mappedData.name_of_head_of_household) {
                        errors.push(`Row ${index + 1}: Missing head of household name`);
                    }

                    processedData.push(mappedData);
                } catch (error) {
                    errors.push(`Row ${index + 1}: Error processing data - ${error}`);
                }
            });

            if (errors.length > 0) {
                setExcelImportErrors(errors);
            }

            if (processedData.length > 0) {
                setExcelImportData(processedData);
                setIsExcelPreviewOpen(true);
                toast({ title: "Import Successful", description: `Parsed ${processedData.length} records. ${errors.length > 0 ? `${errors.length} errors found.` : ''}` });
            } else {
                toast({ title: "Import Failed", description: "No valid data could be parsed from the file.", variant: "destructive" });
            }

        } catch (error) {
            console.error('Error importing Excel:', error);
            toast({ title: "Import Failed", description: "Failed to read the Excel file. Please check the file format.", variant: "destructive" });
        } finally {
            setImportingExcel(false);
            // Reset file input
            event.target.value = '';
        }
    };

    const handleRemoveExcelRow = (index: number) => {
        setExcelImportData(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirmExcelImport = async () => {
        if (excelImportData.length === 0) return;

        setImportingExcel(true);
        try {
            const batch = writeBatch(db);
            let successCount = 0;
            let errorCount = 0;

            for (const row of excelImportData) {
                try {
                    // Create displaced person record
                    const personData = {
                        name: row.name_of_head_of_household,
                        phone: row.phone_number,
                        details: `${row.age} years old, ${row.household_head_gender}`,
                        status: 'Eligible for Shelter',
                        currentLocation: `${row.community}, ${row.lga}, ${row.state_of_origin}`,
                        destination: '',
                        vulnerabilities: [],
                        medicalNeeds: [],
                        assistanceRequested: 'Imported from Excel survey',
                        priority: row.rcsi_category === 'High coping' ? 'High Priority' :
                            row.rcsi_category === 'Medium coping' ? 'Medium Priority' : 'Low Priority',
                        lastUpdate: new Date().toLocaleString()
                    };

                    const personRef = doc(collection(db, 'displacedPersons'));
                    batch.set(personRef, personData);

                    // Create survey record
                    const surveyRef = doc(collection(db, 'displacedPersonSurveys'));
                    batch.set(surveyRef, {
                        ...row,
                        personId: personRef.id,
                        submittedAt: new Date(),
                        enumeratorId: 'excel-import'
                    });

                    successCount++;
                } catch (error) {
                    console.error('Error adding row to batch:', error);
                    errorCount++;
                }
            }

            await batch.commit();

            toast({
                title: "Import Completed",
                description: `Successfully imported ${successCount} records. ${errorCount > 0 ? `${errorCount} failed.` : ''}`
            });

            setIsExcelPreviewOpen(false);
            setExcelImportData([]);
            setExcelImportErrors([]);
            fetchData(); // Refresh the list

        } catch (error) {
            console.error('Error importing to Firestore:', error);
            toast({ title: "Import Failed", description: "Failed to save data to database.", variant: "destructive" });
        } finally {
            setImportingExcel(false);
        }
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

    const handleContact = (person: DisplacedPerson) => {
        toast({
            title: "Contacting Person",
            description: `Opening email client to contact ${person.name}.`,
        });
        window.location.href = `mailto:?subject=Message for ${person.name}&body=We are from the response team. Please reply to this message.`;
    };

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

    const handleTrack = (location: string) => {
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
        window.open(googleMapsUrl, "_blank");
    }

    const totalTracked = displacedPersons?.length || 0;
    const safeCount = displacedPersons?.filter(p => p.status === 'Safe').length || 0;
    const eligibleCount = displacedPersons?.filter(p => p.status === 'Eligible for Shelter').length || 0;
    const assistanceCount = displacedPersons?.filter(p => p.status === 'Needs Assistance').length || 0;
    const emergencyCount = displacedPersons?.filter(p => p.status === 'Emergency').length || 0;

    return (
        <div className="space-y-6">
            <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); else setIsFormOpen(true); }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{selectedPerson ? "Edit Person Details" : "Add New Displaced Person"}</DialogTitle>
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


            <Dialog open={isExcelPreviewOpen} onOpenChange={setIsExcelPreviewOpen}>
                <DialogContent className="max-w-7xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Excel Import Preview</DialogTitle>
                        <DialogDescription>
                            Review the imported data before confirming the bulk import to the database.
                            {excelImportErrors.length > 0 && (
                                <span className="text-red-600 block mt-2">
                                    {excelImportErrors.length} errors found. Please review and fix before importing.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {excelImportErrors.length > 0 && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <h4 className="font-semibold text-red-800 mb-2">Import Errors:</h4>
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
                                    <TableHead>Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Age</TableHead>
                                    <TableHead>Gender</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Household Size</TableHead>
                                    <TableHead>Consent</TableHead>
                                    <TableHead className="w-24">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {excelImportData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{row.rowIndex}</TableCell>
                                        <TableCell className="font-medium">{row.name_of_head_of_household}</TableCell>
                                        <TableCell>{row.phone_number}</TableCell>
                                        <TableCell>{row.age}</TableCell>
                                        <TableCell>{row.household_head_gender}</TableCell>
                                        <TableCell>{`${row.community}, ${row.lga}`}</TableCell>
                                        <TableCell>{row.household_size}</TableCell>
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
                                                Remove
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsExcelPreviewOpen(false)} className="w-full sm:w-auto">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmExcelImport}
                            disabled={excelImportData.length === 0 || importingExcel}
                            className="w-full sm:w-auto"
                        >
                            {importingExcel ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Import {excelImportData.length} Records
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Displaced Persons Monitoring</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Real-time tracking and assistance coordination for displaced individuals</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto"><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh</Button>
                    <Button onClick={handleAddNew} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Add Person</Button>
                    <div className="relative">
                        <Input
                            id="excel-import-main"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleExcelImport}
                            disabled={importingExcel}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline" disabled={importingExcel} className="pointer-events-none w-full sm:w-auto">
                            {importingExcel ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Import Excel Data
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-1 sm:gap-4">
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Total Tracked</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{totalTracked}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Safe</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{safeCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <BedDouble className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Eligible for Shelter</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{eligibleCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Need Assistance</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{assistanceCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card className="max-w-[90vw] sm:max-w-full">
                    <CardContent className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Emergency</p>
                            {loading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10 mt-1" /> : <p className="text-xl sm:text-2xl font-bold">{emergencyCount}</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input placeholder="Search by name or ID..." className="pl-10 h-9 sm:h-10" />
                </div>
                <Select>
                    <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="safe">Safe</SelectItem>
                        <SelectItem value="eligible">Eligible for Shelter</SelectItem>
                        <SelectItem value="moving">Moving to Shelter</SelectItem>
                        <SelectItem value="assistance">Needs Assistance</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="resettled">Resettled</SelectItem>
                        <SelectItem value="homebound">Homebound</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" className="h-9 sm:h-10 w-full sm:w-auto"><Filter className="mr-2 h-4 w-4" />More Filters</Button>
            </div>

            {permissionError && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view this data. Please check your Firestore security rules to allow read access to the &apos;displacedPersons&apos; collection for administrators.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {loading || !displacedPersons ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="max-w-[90vw] sm:max-w-full"><CardContent className="p-2 sm:p-4"><Skeleton className="h-64 sm:h-80 w-full" /></CardContent></Card>
                    ))
                ) : displacedPersons.length > 0 ? (
                    displacedPersons.map(person => {
                        const statusInfo = getStatusInfo(person.status);
                        return (
                            <Card key={person.id} className={cn("transition-shadow hover:shadow-lg max-w-[90vw] sm:max-w-full", statusInfo.cardClass)}>
                                <CardContent className="p-2 sm:p-4 space-y-2 sm:space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold">{person.name}</p>
                                            <p className="text-xs text-muted-foreground">{person.id} &middot; {person.details}</p>
                                        </div>
                                        <Badge variant={statusInfo.badgeVariant} className="flex gap-1.5 items-center">
                                            {statusInfo.icon} {person.status}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm pl-2 border-l-2 ml-2">
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Current Location</p>
                                                <p>{person.currentLocation}</p>
                                            </div>
                                        </div>
                                        {person.destination && (
                                            <div className="flex items-start gap-2 sm:gap-3">
                                                <Send className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-xs text-muted-foreground">Destination</p>
                                                    <p>{person.destination}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <Info className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Vulnerabilities</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {person.vulnerabilities.map(v => <Badge key={v} variant="secondary" className="font-normal text-xs">{v}</Badge>)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                                            <div className="flex items-center justify-between">
                                                <p className="font-semibold text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> Activity History
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
                                                    <Plus className="h-3 w-3 mr-1" /> Log Activity
                                                </Button>
                                            </div>
                                            {person.activityLog && person.activityLog.length > 0 ? (
                                                <ScrollArea className="max-h-24">
                                                    <div className="space-y-3 pr-2 pt-1">
                                                        {person.activityLog.slice().reverse().map((log, idx) => (
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
                                                <p className="text-[10px] text-muted-foreground italic">No activities logged yet.</p>
                                            )}
                                        </div>
                                        {person.medicalNeeds && person.medicalNeeds.length > 0 && (
                                            <div className="flex items-start gap-2 sm:gap-3">
                                                <Heart className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-xs text-muted-foreground">Medical Needs</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {person.medicalNeeds.map(m => <Badge key={m} variant="destructive" className="bg-red-50 text-red-700 font-normal text-xs">{m}</Badge>)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Assistance Requested</p>
                                                <div className="p-2 bg-yellow-100/50 rounded-md text-yellow-800 mt-1 text-xs">{person.assistanceRequested}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Last update</p>
                                                <p>{person.lastUpdate}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 sm:pt-4 border-t gap-2">
                                        <div className="flex flex-wrap gap-1 sm:gap-2">
                                            <Button size="sm" onClick={() => handleTrack(person.currentLocation)} className="h-8">Track</Button>
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(person)} className="h-8"><Edit className="mr-1 h-3 w-3" /> Edit</Button>
                                            {person.status === 'Safe' ? (
                                                <div className="flex gap-1">
                                                    <Button size="sm" variant="outline" className="h-8 border-green-200 text-green-700 hover:bg-green-50" onClick={() => handleUpdateStatus(person.id, 'Resettled')}>
                                                        Resettle
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => handleUpdateStatus(person.id, 'Homebound')}>
                                                        Homebound
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="bg-blue-600 hover:bg-blue-700 h-8"
                                                    onClick={() => handleOpenAssignDialog(person)}
                                                    disabled={person.status === 'Safe' || person.status === 'Resettled' || person.status === 'Homebound'}
                                                >
                                                    <BedDouble className="mr-2 h-3 w-3" /> Assign Shelter
                                                </Button>
                                            )}
                                        </div>
                                        <Badge className={cn(getPriorityColor(person.priority), "font-semibold text-[10px] sm:text-xs")}>{person.priority}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : !permissionError ? (
                    <div className="col-span-2 text-center py-16">
                        <h3 className="text-xl font-semibold">No displaced persons found</h3>
                        <p className="text-muted-foreground mt-2">Click the "Add Person" button to register a new individual in need of assistance.</p>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
