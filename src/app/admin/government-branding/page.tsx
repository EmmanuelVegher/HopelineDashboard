"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Edit, Shield, Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { NIGERIA_STATES } from "@/lib/nigeria-geography";
import { db, storage } from "@/lib/firebase";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";

interface GovernmentEntity {
    id: string;
    type: 'state' | 'federal';
    name: string;
    displayName: string;
    logoUrl: string;
    isConfigured: boolean;
}

export default function GovernmentBrandingPage() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [entities, setEntities] = useState<GovernmentEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEntity, setEditingEntity] = useState<GovernmentEntity | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState({
        displayName: '',
        logoUrl: ''
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const getVirtualId = useCallback((type: 'state' | 'federal', name: string) => {
        if (type === 'federal') return 'gov_federal_Nigeria';
        return `gov_state_${name.replace(/\s+/g, '_')}`;
    }, []);

    const fetchBrandingData = useCallback(async () => {
        setLoading(true);
        try {
            const orgsSnapshot = await getDocs(collection(db, "organizations"));
            const orgsData = orgsSnapshot.docs.reduce((acc, doc) => {
                acc[doc.id] = doc.data();
                return acc;
            }, {} as Record<string, any>);

            const allEntities: GovernmentEntity[] = [
                // Federal Government
                {
                    id: getVirtualId('federal', 'Nigeria'),
                    type: 'federal',
                    name: 'Nigeria',
                    displayName: orgsData[getVirtualId('federal', 'Nigeria')]?.name || 'Federal Government, Nigeria',
                    logoUrl: orgsData[getVirtualId('federal', 'Nigeria')]?.logoUrl || '',
                    isConfigured: !!orgsData[getVirtualId('federal', 'Nigeria')]
                },
                // States
                ...NIGERIA_STATES.map(state => ({
                    id: getVirtualId('state', state),
                    type: 'state' as const,
                    name: state,
                    displayName: orgsData[getVirtualId('state', state)]?.name || `${state} State Government`,
                    logoUrl: orgsData[getVirtualId('state', state)]?.logoUrl || '',
                    isConfigured: !!orgsData[getVirtualId('state', state)]
                }))
            ];

            setEntities(allEntities);
        } catch (error) {
            console.error("Error fetching branding data:", error);
            toast({
                title: "Error",
                description: "Failed to load government branding data.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [getVirtualId, toast]);

    useEffect(() => {
        fetchBrandingData();
    }, [fetchBrandingData]);

    const filteredEntities = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        return entities.filter(e =>
            e.name.toLowerCase().includes(lowerQuery) ||
            e.displayName.toLowerCase().includes(lowerQuery)
        );
    }, [entities, searchQuery]);

    const handleEdit = (entity: GovernmentEntity) => {
        setEditingEntity(entity);
        setEditForm({
            displayName: entity.displayName,
            logoUrl: entity.logoUrl
        });
        setLogoPreview(entity.logoUrl || null);
        setLogoFile(null);
        setUploadProgress(null);
        setIsDialogOpen(true);
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Basic validation
            if (file.size > 2 * 1024 * 1024) {
                toast({ title: "File too large", description: "Logo must be under 2MB", variant: "destructive" });
                return;
            }
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!editingEntity) return;
        setSaving(true);
        setUploadProgress(0);

        try {
            let finalLogoUrl = editForm.logoUrl;

            if (logoFile) {
                const storageRef = ref(storage, `organization-logos/${Date.now()}_${logoFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, logoFile);

                finalLogoUrl = await new Promise<string>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        (error) => reject(error),
                        async () => {
                            const url = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(url);
                        }
                    );
                });
            }

            await setDoc(doc(db, "organizations", editingEntity.id), {
                name: editForm.displayName.trim(),
                logoUrl: finalLogoUrl,
                type: editingEntity.type,
                entityName: editingEntity.name,
                updatedAt: new Date(),
                isGovernment: true
            }, { merge: true });

            toast({
                title: t("admin.governmentBranding.saveSuccess"),
                description: `Branding for ${editingEntity.name} has been updated.`,
            });

            setIsDialogOpen(false);
            fetchBrandingData();
        } catch (error) {
            console.error("Error saving branding:", error);
            toast({
                title: t("admin.governmentBranding.saveError"),
                description: "There was a problem saving the branding.",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading && entities.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("admin.governmentBranding.title")}</h1>
                    <p className="text-muted-foreground">{t("admin.governmentBranding.subtitle")}</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder={t("admin.governmentBranding.searchPlaceholder")}
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEntities.map((entity) => (
                    <Card key={entity.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <Badge variant={entity.type === 'federal' ? "default" : "secondary"}>
                                    {entity.type === 'federal' ? t("admin.governmentBranding.federalGovernment") : "State"}
                                </Badge>
                                {entity.isConfigured && (
                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Configured</span>
                                )}
                            </div>
                            <CardTitle className="text-lg mt-2">{entity.displayName}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border">
                                    {entity.logoUrl ? (
                                        <img src={entity.logoUrl} alt={entity.name} className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <Shield className="h-8 w-8 text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Entity: {entity.name}</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                        {entity.logoUrl ? "Custom logo uploaded" : "Using default logo"}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full" onClick={() => handleEdit(entity)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Branding
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t("admin.governmentBranding.editEntity")}</DialogTitle>
                        <DialogDescription>
                            Customize the name and logo for {editingEntity?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">{t("admin.governmentBranding.entityName")}</Label>
                            <Input
                                id="displayName"
                                value={editForm.displayName}
                                onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-4">
                            <Label>{t("admin.governmentBranding.entityLogo")}</Label>
                            <div className="flex items-center gap-6">
                                <Avatar className="w-24 h-24 rounded-lg border bg-gray-50">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <AvatarFallback className="rounded-lg">
                                            <Shield className="h-10 w-10 text-muted-foreground" />
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                <div className="space-y-2">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="h-9 w-[180px] text-xs"
                                        id="logo-upload"
                                    />
                                    <p className="text-[10px] text-muted-foreground">SVG, PNG, JPG (max 2MB)</p>
                                </div>
                            </div>
                            {uploadProgress !== null && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span>Uploading...</span>
                                        <span>{Math.round(uploadProgress)}%</span>
                                    </div>
                                    <Progress value={uploadProgress} className="h-1.5" />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                            {t("admin.cancel")}
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {t("admin.saveChanges")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'secondary' }) {
    return (
        <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
            variant === 'default' ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
        )}>
            {children}
        </span>
    );
}
