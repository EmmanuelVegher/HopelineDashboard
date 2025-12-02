
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DisplacedPerson, type Shelter } from "@/lib/data";
import { Users, CheckCircle, Heart, AlertTriangle, RefreshCw, Search, Filter, Plane, MapPin, Clock, Phone, Send, Info, BedDouble, Plus, Edit } from "lucide-react";
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
import { useAdminData } from "@/contexts/AdminDataProvider";

const getStatusInfo = (status: string) => {
    switch (status) {
        case 'Moving to Shelter':
            return {
                badgeVariant: 'warning',
                cardClass: 'border-yellow-200 bg-yellow-50/50',
                icon: <Plane className="h-4 w-4 text-yellow-600" />,
                priority: 'Medium Priority',
                priorityColor: 'bg-yellow-500'
            };
        case 'Needs Assistance':
            return {
                badgeVariant: 'warning',
                cardClass: 'border-orange-200 bg-orange-50/50',
                icon: <Heart className="h-4 w-4 text-orange-600" />,
                 priority: 'Medium Priority',
                priorityColor: 'bg-orange-500'
            };
        case 'Emergency':
            return {
                badgeVariant: 'destructive',
                cardClass: 'border-red-200 bg-red-50/50',
                icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
                priority: 'High Priority',
                priorityColor: 'bg-red-600'
            };
        case 'Safe':
        default:
            return {
                badgeVariant: 'success',
                cardClass: '',
                icon: <CheckCircle className="h-4 w-4 text-green-600" />,
                priority: 'Low Priority',
                priorityColor: 'bg-green-500'
            };
    }
};

const getPriorityColor = (priority: string) => {
    switch(priority) {
        case 'High Priority': return 'bg-red-600 text-white';
        case 'Medium Priority': return 'bg-yellow-500 text-white';
        case 'Low Priority': return 'bg-green-500 text-white';
        default: return 'bg-gray-500 text-white';
    }
}

const initialPersonState: Partial<DisplacedPerson> = {
    name: '',
    details: '',
    status: 'Needs Assistance',
    currentLocation: '',
    destination: '',
    vulnerabilities: [],
    medicalNeeds: [],
    assistanceRequested: '',
    priority: 'Medium Priority',
    lastUpdate: new Date().toLocaleString(),
};

function PersonForm({ person, onSave, onCancel }: { person?: DisplacedPerson | null, onSave: () => void, onCancel: () => void }) {
    const [formData, setFormData] = useState<Partial<DisplacedPerson>>(initialPersonState);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (person) {
            setFormData(person);
        } else {
            setFormData(initialPersonState);
        }
    }, [person]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
                // Update existing person
                const personRef = doc(db, "displacedPersons", person.id);
                await updateDoc(personRef, dataToSave);
                toast({ title: "Success", description: "Person updated successfully." });
            } else {
                // Create new person
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
         <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="details">Identifying Details</Label>
                    <Input id="details" name="details" value={formData.details} onChange={handleChange} placeholder="e.g., Age 45, Male" />
                </div>
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="status">Current Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                        <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Needs Assistance">Needs Assistance</SelectItem>
                            <SelectItem value="Moving to Shelter">Moving to Shelter</SelectItem>
                            <SelectItem value="Emergency">Emergency</SelectItem>
                            <SelectItem value="Safe">Safe</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="priority">Priority Level</Label>
                    <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
                        <SelectTrigger id="priority"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Low Priority">Low Priority</SelectItem>
                            <SelectItem value="Medium Priority">Medium Priority</SelectItem>
                            <SelectItem value="High Priority">High Priority</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="currentLocation">Current Location</Label>
                <Input id="currentLocation" name="currentLocation" value={formData.currentLocation} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="destination">Destination (Optional)</Label>
                <Input id="destination" name="destination" value={formData.destination} onChange={handleChange} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="vulnerabilities">Vulnerabilities (comma-separated)</Label>
                <Input id="vulnerabilities" name="vulnerabilities" value={formData.vulnerabilities?.join(', ')} onChange={handleArrayChange} placeholder="e.g., Elderly, Child, Pregnant" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="medicalNeeds">Medical Needs (comma-separated)</Label>
                <Input id="medicalNeeds" name="medicalNeeds" value={formData.medicalNeeds?.join(', ')} onChange={handleArrayChange} placeholder="e.g., Insulin, Asthma Inhaler" />
            </div>

             <div className="space-y-2">
                <Label htmlFor="assistanceRequested">Assistance Requested</Label>
                <Textarea id="assistanceRequested" name="assistanceRequested" value={formData.assistanceRequested} onChange={handleChange} placeholder="Describe the specific help needed..."/>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Record'}</Button>
            </DialogFooter>
        </form>
    );
}

function AssignShelterDialog({ person, allShelters, isOpen, onOpenChange, onAssign }: { person: DisplacedPerson | null, allShelters: Shelter[], isOpen: boolean, onOpenChange: (open: boolean) => void, onAssign: () => void }) {
    const [filteredShelters, setFilteredShelters] = useState<Shelter[]>([]);
    const [availableStates, setAvailableStates] = useState<string[]>([]);
    const [selectedState, setSelectedState] = useState('');
    const [selectedShelter, setSelectedShelter] = useState<string>('');
    const [bedNumber, setBedNumber] = useState('');
    const [mattress, setMattress] = useState(false);
    const [foodPack, setFoodPack] = useState(false);
    const [hygieneKit, setHygieneKit] = useState(false);
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
                .sort((a,b) => b.availableCapacity - a.availableCapacity);
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
                    allocatedResources: { bedNumber, mattress, foodPack, hygieneKit }
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
                    <DialogTitle>Assign Shelter for {person.name}</DialogTitle>
                    <DialogDescription>Allocate a shelter and necessary resources for the individual.</DialogDescription>
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
                                <Label htmlFor="bed-number">Bed / Space Number</Label>
                                <Input id="bed-number" value={bedNumber} onChange={e => setBedNumber(e.target.value)} placeholder="e.g., B-12" />
                            </div>
                            <div className="space-y-2">
                                <Label>Allocate Resources</Label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="mattress" checked={mattress} onCheckedChange={checked => setMattress(!!checked)} />
                                        <label htmlFor="mattress" className="text-sm font-medium">Mattress</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="food-pack" checked={foodPack} onCheckedChange={checked => setFoodPack(!!checked)} />
                                        <label htmlFor="food-pack" className="text-sm font-medium">Food Pack</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="hygiene-kit" checked={hygieneKit} onCheckedChange={checked => setHygieneKit(!!checked)} />
                                        <label htmlFor="hygiene-kit" className="text-sm font-medium">Hygiene Kit</label>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !selectedShelter}>
                        {submitting ? 'Assigning...' : 'Confirm Assignment'}
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
    const [isFormOpen, setIsFormOpen] = useState(false);
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

    const handleTrack = (location: string) => {
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
        window.open(googleMapsUrl, "_blank");
    }

    const totalTracked = displacedPersons?.length || 0;
    const safeCount = displacedPersons?.filter(p => p.status === 'Safe').length || 0;
    const assistanceCount = displacedPersons?.filter(p => p.status === 'Needs Assistance').length || 0;
    const emergencyCount = displacedPersons?.filter(p => p.status === 'Emergency').length || 0;

    return (
        <div className="space-y-6">
             <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); else setIsFormOpen(true);}}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{selectedPerson ? "Edit Person Details" : "Add New Displaced Person"}</DialogTitle>
                        <DialogDescription>
                            {selectedPerson ? "Update the information for this individual." : "Fill in the details for the new person."}
                        </DialogDescription>
                    </DialogHeader>
                    <PersonForm person={selectedPerson} onSave={handleSave} onCancel={handleCancel} />
                </DialogContent>
            </Dialog>
            <AssignShelterDialog 
                person={selectedPerson}
                allShelters={shelters || []} 
                isOpen={isAssignDialogOpen} 
                onOpenChange={(isOpen) => { if(!isOpen) setSelectedPerson(null); setIsAssignDialogOpen(isOpen);}} 
                onAssign={handleAssignmentComplete}
            />

            <div className="flex justify-between items-center">
                 <div>
                    <h1 className="text-3xl font-bold">Displaced Persons Monitoring</h1>
                    <p className="text-muted-foreground">Real-time tracking and assistance coordination for displaced individuals</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")}/>Refresh</Button>
                    <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4"/>Add Person</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <Users className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Total Tracked</p>
                            {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{totalTracked}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <CheckCircle className="h-6 w-6 text-green-500" />
                        <div>
                            <p className="text-sm text-muted-foreground">Safe</p>
                             {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{safeCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <Heart className="h-6 w-6 text-orange-500" />
                        <div>
                            <p className="text-sm text-muted-foreground">Need Assistance</p>
                            {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{assistanceCount}</p>}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                        <div>
                            <p className="text-sm text-muted-foreground">Emergency</p>
                            {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{emergencyCount}</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

             <div className="flex gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search by name or ID..." className="pl-10 h-10" />
                </div>
                <Select>
                    <SelectTrigger className="w-[180px] h-10">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="safe">Safe</SelectItem>
                        <SelectItem value="moving">Moving to Shelter</SelectItem>
                        <SelectItem value="assistance">Needs Assistance</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" className="h-10"><Filter className="mr-2 h-4 w-4" />More Filters</Button>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {loading || !displacedPersons ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}><CardContent className="p-4"><Skeleton className="h-80 w-full" /></CardContent></Card>
                    ))
                ) : displacedPersons.length > 0 ? (
                    displacedPersons.map(person => {
                        const statusInfo = getStatusInfo(person.status);
                        return (
                            <Card key={person.id} className={cn("transition-shadow hover:shadow-lg", statusInfo.cardClass)}>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold">{person.name}</p>
                                            <p className="text-xs text-muted-foreground">{person.id} &middot; {person.details}</p>
                                        </div>
                                        <Badge variant={statusInfo.badgeVariant} className="flex gap-1.5 items-center">
                                            {statusInfo.icon} {person.status}
                                        </Badge>
                                    </div>
                                    <div className="space-y-3 text-sm pl-2 border-l-2 ml-2">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Current Location</p>
                                                <p>{person.currentLocation}</p>
                                            </div>
                                        </div>
                                        {person.destination && (
                                            <div className="flex items-start gap-3">
                                                <Send className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-xs text-muted-foreground">Destination</p>
                                                    <p>{person.destination}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-3">
                                            <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Vulnerabilities</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {person.vulnerabilities.map(v => <Badge key={v} variant="secondary" className="font-normal">{v}</Badge>)}
                                                </div>
                                            </div>
                                        </div>
                                        {person.medicalNeeds && person.medicalNeeds.length > 0 && (
                                            <div className="flex items-start gap-3">
                                                <Heart className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-xs text-muted-foreground">Medical Needs</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {person.medicalNeeds.map(m => <Badge key={m} variant="destructive" className="bg-red-50 text-red-700 font-normal">{m}</Badge>)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                         <div className="flex items-start gap-3">
                                            <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Assistance Requested</p>
                                                <div className="p-2 bg-yellow-100/50 rounded-md text-yellow-800 mt-1">{person.assistanceRequested}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-xs text-muted-foreground">Last update</p>
                                                <p>{person.lastUpdate}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t">
                                         <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleTrack(person.currentLocation)}>Track</Button>
                                            <Button size="sm" variant="outline" onClick={() => handleContact(person)}>Contact</Button>
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(person)}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                                            <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleOpenAssignDialog(person)} disabled={person.status === 'Safe'}>
                                                <BedDouble className="mr-2 h-4 w-4"/>
                                                Assign Shelter
                                            </Button>
                                         </div>
                                         <Badge className={cn(getPriorityColor(person.priority), "font-semibold")}>{person.priority}</Badge>
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
                ) : null }
            </div>
        </div>
    )
}
