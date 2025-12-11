
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAdminData } from "@/contexts/AdminDataProvider";
import DisplacedPersonSurvey from "@/components/displaced-person-survey";
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
        default:
            return {
                badgeVariant: 'default' as const,
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
    const [isSurveyOpen, setIsSurveyOpen] = useState(false);
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

    const handleOpenBeneficiaryForm = () => {
        setSelectedPerson(null); // No specific person selected for new registration
        setIsSurveyOpen(true);
    }

    const handleSurveyComplete = () => {
        setIsSurveyOpen(false);
        setSelectedPerson(null);
        fetchData(); // Refresh the list to show newly eligible persons
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

            <DisplacedPersonSurvey
                person={selectedPerson}
                isOpen={isSurveyOpen}
                onOpenChange={setIsSurveyOpen}
                onComplete={handleSurveyComplete}
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

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExcelPreviewOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmExcelImport}
                            disabled={excelImportData.length === 0 || importingExcel}
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

            <div className="flex justify-between items-center">
                 <div>
                    <h1 className="text-3xl font-bold">Displaced Persons Monitoring</h1>
                    <p className="text-muted-foreground">Real-time tracking and assistance coordination for displaced individuals</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")}/>Refresh</Button>
                    <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4"/>Add Person</Button>
                    <Button onClick={handleOpenBeneficiaryForm} variant="default" className="bg-green-600 hover:bg-green-700">
                        <Plus className="mr-2 h-4 w-4"/>Beneficiary Registration Form
                    </Button>
                    <div className="relative">
                        <Input
                            id="excel-import-main"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleExcelImport}
                            disabled={importingExcel}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline" disabled={importingExcel} className="pointer-events-none">
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

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                        <BedDouble className="h-6 w-6 text-blue-500" />
                        <div>
                            <p className="text-sm text-muted-foreground">Eligible for Shelter</p>
                            {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{eligibleCount}</p>}
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
                        <SelectItem value="eligible">Eligible for Shelter</SelectItem>
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
