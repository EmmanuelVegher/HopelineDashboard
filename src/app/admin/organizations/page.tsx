"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    setDoc
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { useToast } from "@/hooks/use-toast";
import {
    Building2,
    Plus,
    Search,
    Filter,
    Edit,
    Trash2,
    Building,
    Globe,
    MapPin,
    ImagePlus,
    Loader2,
    ShieldCheck,
    X
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { NIGERIA_STATES } from "@/lib/nigeria-geography";
import { type Organization } from "@/lib/data";

const ORG_TYPES = [
    { value: 'standard', label: 'admin.organizations.standard' },
    { value: 'state', label: 'admin.organizations.stateGov' },
    { value: 'federal', label: 'admin.organizations.federalGov' },
] as const;

export default function OrganizationsPage() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { adminProfile } = useAdminData();

    // Access control check
    const role = adminProfile?.role?.toLowerCase() || '';
    const isAuthorized = role.includes('super') || role === 'admin' || role === 'federal government';

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");

    // Form/Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [formData, setFormData] = useState<Partial<Organization>>({
        name: "",
        logoUrl: "",
        type: "standard",
        isGovernment: false,
        states: [],
        entityName: ""
    });

    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isAuthorized) return;

        const q = query(collection(db, "organizations"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Organization[];
            setOrganizations(orgs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching organizations:", error);
            toast({
                title: t("common.error"),
                description: t("admin.organizations.fetchError"),
                variant: "destructive"
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthorized, t, toast]);

    const filteredOrgs = useMemo(() => {
        return organizations.filter(org => {
            const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (org.entityName || "").toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === "all" || org.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [organizations, searchQuery, typeFilter]);

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold">{t("assistance.errors.accessRestricted")}</h1>
                <p className="text-muted-foreground max-w-md mt-2">
                    {t("admin.trackDrivers.permission.desc")}
                </p>
            </div>
        );
    }

    const resetForm = () => {
        setFormData({
            name: "",
            logoUrl: "",
            type: "standard",
            isGovernment: false,
            states: [],
            entityName: ""
        });
        setImageFile(null);
        setImagePreview(null);
        setUploadProgress(null);
        setEditingOrg(null);
    };

    const handleEdit = (org: Organization) => {
        setEditingOrg(org);
        setFormData(org);
        setImagePreview(org.logoUrl);
        setIsDialogOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleState = (stateName: string) => {
        setFormData(prev => {
            const currentStates = prev.states || [];
            const newStates = currentStates.includes(stateName)
                ? currentStates.filter(s => s !== stateName)
                : [...currentStates, stateName];
            return { ...prev, states: newStates };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.type) {
            toast({ title: t("common.error"), description: t("auth.signup.validationError"), variant: "destructive" });
            return;
        }

        setSaving(true);
        let currentLogoUrl = formData.logoUrl || "";

        try {
            if (imageFile) {
                const storageRef = ref(storage, `organization-logos/${Date.now()}_${imageFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, imageFile);

                currentLogoUrl = await new Promise((resolve, reject) => {
                    uploadTask.on(
                        "state_changed",
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        (error) => reject(error),
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(downloadURL);
                        }
                    );
                });
            }

            // Construct clean data based on type to avoid 'undefined' field errors in Firestore
            const baseData = {
                name: formData.name,
                logoUrl: currentLogoUrl,
                type: formData.type,
                updatedAt: serverTimestamp(),
                isGovernment: formData.type === 'state' || formData.type === 'federal'
            };

            let finalData: any = { ...baseData };

            if (formData.type === 'standard') {
                finalData.states = formData.states || [];
                // standard orgs don't have entityName
            } else {
                finalData.entityName = formData.entityName;
                // gov orgs don't have states array
            }

            if (editingOrg) {
                const orgRef = doc(db, "organizations", editingOrg.id);
                await updateDoc(orgRef, finalData);
            } else {
                // Handle special IDs for government roles
                if (formData.type === 'federal') {
                    const federalId = 'gov_federal_Nigeria';
                    await setDoc(doc(db, "organizations", federalId), {
                        ...finalData,
                        entityName: "Nigeria", // Ensure it's set for federal
                        id: federalId
                    });
                } else if (formData.type === 'state' && formData.entityName) {
                    const stateId = `gov_state_${formData.entityName.replace(/\s+/g, '_')}`;
                    await setDoc(doc(db, "organizations", stateId), {
                        ...finalData,
                        id: stateId
                    });
                } else {
                    await addDoc(collection(db, "organizations"), finalData);
                }
            }

            toast({
                title: t("common.success"),
                description: t("admin.organizations.saveSuccess")
            });
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving organization:", error);
            toast({
                title: t("common.error"),
                description: t("admin.organizations.saveError"),
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("admin.organizations.deleteConfirm"))) return;

        try {
            await deleteDoc(doc(db, "organizations", id));
            toast({
                title: t("common.success"),
                description: t("admin.organizations.deleteSuccess")
            });
        } catch (error) {
            console.error("Error deleting organization:", error);
            toast({
                title: t("common.error"),
                description: t("admin.organizations.deleteError"),
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t("admin.organizations.title")}</h1>
                    <p className="text-muted-foreground">{t("admin.organizations.subtitle")}</p>
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="w-full md:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("admin.organizations.addOrganization")}
                </Button>
            </div>

            <Card className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t("common.search")}
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder={t("admin.organizations.filter")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t("admin.organizations.allTypes")}</SelectItem>
                                    {ORG_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>{t(type.label)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-40 w-full" />
                            ))}
                        </div>
                    ) : filteredOrgs.length === 0 ? (
                        <div className="text-center py-12">
                            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                            <p className="text-muted-foreground">{t("admin.organizations.noOrganizations")}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredOrgs.map((org) => (
                                <Card key={org.id} className="group overflow-hidden border-gray-100 hover:border-primary/50 transition-all hover:shadow-md">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-12 w-12 border">
                                                    <AvatarImage src={org.logoUrl} alt={org.name} />
                                                    <AvatarFallback><Building2 className="h-6 w-6" /></AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <CardTitle className="text-base line-clamp-1">{org.name}</CardTitle>
                                                    <Badge variant={org.type === 'standard' ? 'secondary' : 'default'} className="mt-1 text-[10px] h-4">
                                                        {t(`admin.organizations.${org.type}`)}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => handleEdit(org)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(org.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="space-y-2 text-xs text-muted-foreground">
                                            {org.type === 'standard' && (
                                                <div className="flex items-center gap-2">
                                                    <Globe className="h-3 w-3" />
                                                    <span>{org.states?.length || 0} States Covered</span>
                                                </div>
                                            )}
                                            {(org.type === 'state' || org.type === 'federal') && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-3 w-3" />
                                                    <span>{org.entityName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingOrg ? t("admin.organizations.editOrganization") : t("admin.organizations.addOrganization")}</DialogTitle>
                        <DialogDescription>
                            {t("admin.organizations.formDescription")}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>{t("admin.organizations.type")}</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(val: any) => setFormData(prev => ({
                                    ...prev,
                                    type: val,
                                    entityName: val === 'federal' ? 'Nigeria' : prev.entityName
                                }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t("admin.organizations.selectType")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {ORG_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>{t(type.label)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="orgName">{t("admin.organizations.orgName")}</Label>
                            <Input
                                id="orgName"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Red Cross Nigeria"
                                required
                            />
                        </div>

                        {formData.type === 'state' && (
                            <div className="space-y-2">
                                <Label>{t("admin.organizations.entityName")} (State)</Label>
                                <Select
                                    value={formData.entityName}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, entityName: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select State" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {NIGERIA_STATES.map(state => (
                                            <SelectItem key={state} value={state}>{state}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {formData.type === 'federal' && (
                            <div className="space-y-2">
                                <Label htmlFor="entityName">{t("admin.organizations.entityName")}</Label>
                                <Input id="entityName" value={formData.entityName || "Nigeria"} disabled />
                            </div>
                        )}

                        {formData.type === 'standard' && (
                            <div className="space-y-2">
                                <Label>{t("admin.organizations.coverageStates")}</Label>
                                <div className="flex flex-wrap gap-1 mb-2 min-h-[1.5rem] p-2 border rounded-md bg-muted/30">
                                    {(formData.states || []).length === 0 ? (
                                        <span className="text-xs text-muted-foreground">{t("admin.organizations.noStatesSelected")}</span>
                                    ) : (
                                        (formData.states || []).sort().map(s => (
                                            <Badge key={s} variant="secondary" className="gap-1 pr-1">
                                                {s}
                                                <X
                                                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                                                    onClick={() => toggleState(s)}
                                                />
                                            </Badge>
                                        ))
                                    )}
                                </div>
                                <ScrollArea className="h-[150px] border rounded-md p-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        {NIGERIA_STATES.map(state => (
                                            <div key={state} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`state-${state}`}
                                                    checked={(formData.states || []).includes(state)}
                                                    onCheckedChange={() => toggleState(state)}
                                                />
                                                <Label
                                                    htmlFor={`state-${state}`}
                                                    className="text-xs font-normal cursor-pointer"
                                                >
                                                    {state}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>{t("admin.organizations.logo")}</Label>
                            <div className="flex items-center gap-4">
                                <div className="h-20 w-20 rounded border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImagePlus className="h-8 w-8 text-muted-foreground opacity-50" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Input type="file" accept="image/*" onChange={handleImageChange} className="text-xs" />
                                    <p className="text-[10px] text-muted-foreground">PNG, JPG, SVG. Recommended 512x512px.</p>
                                </div>
                            </div>
                            {uploadProgress !== null && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <Label>{t("admin.organizations.logoUpload")}</Label>
                                        <span>{Math.round(uploadProgress)}%</span>
                                    </div>
                                    <Progress value={uploadProgress} className="h-1" />
                                </div>
                            )}
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t("admin.organizations.saveOrganization")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
