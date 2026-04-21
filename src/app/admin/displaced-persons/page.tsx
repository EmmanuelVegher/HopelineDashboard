
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DisplacedPerson, type Shelter, type AdminUser, type MovementRecord, type BeneficiaryService } from "@/lib/data";
import { Users, User, Check, CheckCircle, Heart, AlertTriangle, RefreshCw, Search, Filter, Plane, MapPin, Clock, Send, Info, BedDouble, Plus, Edit, Download, Navigation, Globe, Locate, Loader2, Phone, MessageSquare, MessageCircle, Building2, TrendingUp, XCircle, Trash2 } from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import { NIGERIA_STATES, NIGERIA_STATE_BOUNDS } from "@/lib/nigeria-geography";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { collection, doc, writeBatch, runTransaction, addDoc, updateDoc, setDoc, deleteDoc, deleteField, getDocs, query, where, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
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
import { Separator } from "@/components/ui/separator";
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
        case 'Re-onboarded':
            return {
                badgeVariant: 'default' as const,
                cardClass: 'border-blue-200 bg-blue-50/50',
                icon: <RefreshCw className="h-4 w-4 text-blue-600" />,
                priority: t('admin.displacedPersons.priorityEnum.medium'),
                priorityColor: 'bg-blue-500',
                display: t('admin.displacedPersons.statusEnum.reonboarded')
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

const generateShortId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters
    let result = 'HP-';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const DEFAULT_SERVICES: BeneficiaryService[] = [
    { 
        id: 'shelter', category: 'relief', name: 'shelter', description: 'shelter', enabled: false,
        subServices: [
            { id: 'tents', enabled: false },
            { id: 'tarpaulins', enabled: false },
            { id: 'emergency_shelter_kits', enabled: false },
            { id: 'transitional_housing_support', enabled: false }
        ]
    },
    { 
        id: 'food', category: 'relief', name: 'food', description: 'food', enabled: false,
        subServices: [
            { id: 'food_rations', enabled: false },
            { id: 'hot_meals', enabled: false },
            { id: 'nutrition_support', enabled: false }
        ]
    },
    { 
        id: 'wash', category: 'relief', name: 'wash', description: 'wash', enabled: false,
        subServices: [
            { id: 'clean_water', enabled: false },
            { id: 'latrines', enabled: false },
            { id: 'hygiene_kits', enabled: false }
        ]
    },
    { 
        id: 'nfis', category: 'relief', name: 'nfis', description: 'nfis', enabled: false,
        subServices: [
            { id: 'blankets', enabled: false },
            { id: 'cooking_utensils', enabled: false },
            { id: 'solar_lamps', enabled: false }
        ]
    },
    { 
        id: 'protection', category: 'protection', name: 'protection', description: 'protection', enabled: false,
        subServices: [
            { id: 'physical_protection', enabled: false },
            { id: 'safe_spaces', enabled: false },
            { id: 'risk_reduction', enabled: false }
        ]
    },
    { 
        id: 'rfl', category: 'protection', name: 'rfl', description: 'rfl', enabled: false,
        subServices: [
            { id: 'family_tracing', enabled: false },
            { id: 'reunification_services', enabled: false }
        ]
    },
    { 
        id: 'legal', category: 'protection', name: 'legal', description: 'legal', enabled: false,
        subServices: [
            { id: 'legal_counseling', enabled: false },
            { id: 'documentation_support', enabled: false },
            { id: 'lost_id_replacement', enabled: false }
        ]
    },
    { 
        id: 'vulnerable', category: 'protection', name: 'vulnerable', description: 'vulnerable', enabled: false,
        subServices: [
            { id: 'child_protection', enabled: false },
            { id: 'elderly_assistance', enabled: false },
            { id: 'pwd_support', enabled: false }
        ]
    },
    { 
        id: 'healthcare', category: 'healthcare', name: 'healthcare', description: 'healthcare', enabled: false,
        subServices: [
            { id: 'mobile_clinics', enabled: false },
            { id: 'emergency_medical_supplies', enabled: false },
            { id: 'primary_healthcare', enabled: false }
        ]
    },
    { 
        id: 'mhpss', category: 'healthcare', name: 'mhpss', description: 'mhpss', enabled: false,
        subServices: [
            { id: 'trauma_counseling', enabled: false },
            { id: 'psychological_first_aid', enabled: false }
        ]
    },
    { 
        id: 'cash', category: 'cash', name: 'cash', description: 'cash', enabled: false,
        subServices: [
            { id: 'direct_cash_transfer', enabled: false },
            { id: 'essential_vouchers', enabled: false }
        ]
    },
    { 
        id: 'livelihood', category: 'cash', name: 'livelihood', description: 'livelihood', enabled: false,
        subServices: [
            { id: 'vocational_training', enabled: false },
            { id: 'agricultural_support', enabled: false },
            { id: 'microfinance', enabled: false }
        ]
    },
    { 
        id: 'cccm', category: 'cccm', name: 'cccm', description: 'cccm', enabled: false,
        subServices: [
            { id: 'camp_management', enabled: false },
            { id: 'site_coordination', enabled: false }
        ]
    },
    { 
        id: 'education', category: 'education', name: 'education', description: 'education', enabled: false,
        subServices: [
            { id: 'temporary_schools', enabled: false },
            { id: 'learning_materials', enabled: false }
        ]
    },
];

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
    isHouseholdHead: false,
    receivedAssistance: false,
    assistanceNeeded: [],
    registrationDate: new Date().toISOString().split('T')[0],
    gender: 'Other',

    services: DEFAULT_SERVICES,

    state: '',
    organizationId: '',
    organizationName: '',
    imageUrl: ''
};

function PersonForm({ person, existingPersons = [], onSave, onCancel, onSwitchToEdit }: { person?: DisplacedPerson | null, existingPersons?: DisplacedPerson[], onSave: () => void, onCancel: () => void, onSwitchToEdit?: (person: DisplacedPerson) => void }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<DisplacedPerson>>(initialPersonState);
    const [loading, setLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [nameSuggestions, setNameSuggestions] = useState<DisplacedPerson[]>([]);
    const [phoneDuplicate, setPhoneDuplicate] = useState<DisplacedPerson | null>(null);
    const [activeTab, setActiveTab] = useState('basic');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [globalUsers, setGlobalUsers] = useState<AdminUser[]>([]);
    const [searchingGlobal, setSearchingGlobal] = useState(false);
    const [activeBeneficiaryMap, setActiveBeneficiaryMap] = useState<Record<string, DisplacedPerson>>({});
    const [hasPhone, setHasPhone] = useState(true);
    const [householdSearch, setHouseholdSearch] = useState('');
    const [matchingHouseholds, setMatchingHouseholds] = useState<DisplacedPerson[]>([]);
    const [isSearchingHouseholds, setIsSearchingHouseholds] = useState(false);
    const { toast } = useToast();
    const { users, adminProfile, organizations } = useAdminData();
    const { getCurrentPosition } = useGeolocation();
    const isSuperAdmin = adminProfile?.role?.toLowerCase().includes('super');
    const isFederalGov = adminProfile?.role?.toLowerCase().includes('federal');
    const isStateGov = adminProfile?.role?.toLowerCase().includes('state');
    const isOrgAdmin = !!adminProfile?.organizationId && adminProfile?.organizationId !== 'all';
    const adminState = adminProfile?.state || '';
    
    const filteredOrgs = useMemo(() => {
        if (!organizations) return [];
        if (isSuperAdmin || isFederalGov) return organizations;
        if (isStateGov || isOrgAdmin) {
            return organizations.filter(o => o.state === adminState || o.states?.includes(adminState));
        }
        return organizations;
    }, [organizations, isSuperAdmin, isFederalGov, isStateGov, isOrgAdmin, adminState]);

    const isBasicValid = !!(
        formData.name?.trim() &&
        formData.currentLocation?.trim() &&
        formData.state?.trim() &&
        (hasPhone ? !!formData.phone?.trim() : true) &&
        formData.gender &&
        ((!hasPhone && !formData.isHouseholdHead) ? !!formData.householdHeadId : true)
    );

    const isAssessmentValid = !!(
        (hasPhone || formData.isHouseholdHead) ? (
            formData.stayingLocation &&
            formData.shelterCondition &&
            formData.displacementCause?.trim()
        ) : true
    );

    const isOrganizationValid = !!formData.organizationId;

    const isFormValid = isBasicValid && isAssessmentValid && isOrganizationValid && !phoneDuplicate;

    console.log("[DEBUG] PersonForm Render. Validity:", { isFormValid, isBasicValid, isAssessmentValid, isOrganizationValid, hasPhone, phoneDuplicate });
    console.log("[DEBUG] PersonForm Render. isFormValid:", isFormValid, "Missing:", {
        name: !formData.name?.trim(),
        phone: !formData.phone?.trim(),
        loc: !formData.currentLocation?.trim(),
        state: !formData.state?.trim(),
        gender: !formData.gender,
        staying: !formData.stayingLocation,
        cond: !formData.shelterCondition,
        cause: !formData.displacementCause?.trim(),
        org: !formData.organizationId
    });

    const nigerianStates = Object.keys(NIGERIA_STATE_BOUNDS).sort();
    const createAccounts = httpsCallable(functions, 'createDisplacedPersonAccounts');
    const sendOnboardingSMS = httpsCallable(functions, 'sendOnboardingSMS');

    const matchingUsers = useMemo(() => {
        const query = userSearch.toLowerCase();
        const local = users?.filter(u =>
            (u.displayName || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query) ||
            (u.mobile || u.phone || '').includes(query) ||
            (u.shortId || '').toLowerCase().includes(query)
        ) || [];

        // Combine with global results, avoiding duplicates
        const combined = [...local];
        globalUsers.forEach(gu => {
            if (!combined.some(u => u.id === gu.id)) {
                combined.push(gu);
            }
        });
        return combined.slice(0, 5);
    }, [userSearch, users, globalUsers]);

    useEffect(() => {
        if (userSearch.length <= 2) {
            setGlobalUsers([]);
            return;
        }

        const fetchAll = async () => {
            setSearchingGlobal(true);
            try {
                const { collection, getDocs, query, limit, where } = await import('firebase/firestore');
                // Increase limit to 1000 to cover more users since we filter locally.
                // For very large datasets, a Cloud Function with Algolia/Elasticsearch would be needed.
                const q = query(collection(db, 'users'), limit(1000));
                const snap = await getDocs(q);
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUser));
                const queryStr = userSearch.toLowerCase();
                const filtered = all.filter(u =>
                    (u.displayName || '').toLowerCase().includes(queryStr) ||
                    (u.email || '').toLowerCase().includes(queryStr) ||
                    (u.mobile || u.phone || '').includes(queryStr) ||
                    (u.shortId || '').toLowerCase().includes(queryStr)
                );
                setGlobalUsers(filtered);

                // Check for active beneficiary records for these users
                if (filtered.length > 0) {
                    const personRefs = collection(db, 'displacedPersons');
                    const userIds = filtered.map(u => u.id);
                    // Firestore 'in' query has 30 item limit, but we only have few matching anyway
                    const qPerson = query(personRefs, where('userId', 'in', userIds.slice(0, 30)));
                    const personSnap = await getDocs(qPerson);
                    const mapping: Record<string, DisplacedPerson> = {};
                    personSnap.docs.forEach(d => {
                        const data = d.data() as DisplacedPerson;
                        if (data.userId) mapping[data.userId] = { ...data, id: d.id };
                    });
                    setActiveBeneficiaryMap(prev => ({ ...prev, ...mapping }));
                }
            } catch (e) {
                console.error("Global fetch error:", e);
            } finally {
                setSearchingGlobal(false);
            }
        };

        const timer = setTimeout(fetchAll, 500);
        return () => clearTimeout(timer);
    }, [userSearch, isOrgAdmin]);

    const toggleService = (serviceId: string, enabled: boolean) => {
        setFormData(prev => ({
            ...prev,
            services: (prev.services || DEFAULT_SERVICES).map(s => 
                s.id === serviceId ? { ...s, enabled, updatedAt: new Date().toISOString() } : s
            )
        }));
    };

    const toggleSubService = (serviceId: string, subServiceId: string, enabled: boolean) => {
        setFormData(prev => ({
            ...prev,
            services: (prev.services || DEFAULT_SERVICES).map(s => 
                s.id === serviceId 
                ? { 
                    ...s, 
                    subServices: s.subServices?.map(sub => 
                        sub.id === subServiceId ? { ...sub, enabled } : sub
                    ),
                    updatedAt: new Date().toISOString() 
                  } 
                : s
            )
        }));
    };

    const updateServiceProvider = (serviceId: string, orgId: string, orgName: string) => {
        setFormData(prev => ({
            ...prev,
            services: (prev.services || DEFAULT_SERVICES).map(s => 
                s.id === serviceId ? { ...s, providerOrgId: orgId, providerOrgName: orgName, updatedAt: new Date().toISOString() } : s
            )
        }));
    };

    useEffect(() => {
        if (person) {
            setFormData({
                ...person,
                organizationId: isOrgAdmin ? (adminProfile?.organizationId || person.organizationId) : person.organizationId,
                organizationName: isOrgAdmin ? (organizations?.find(o => o.id === adminProfile?.organizationId)?.name || person.organizationName) : person.organizationName,
                services: person.services && person.services.length > 0 ? person.services : DEFAULT_SERVICES
            });
            setHasPhone(!!person.phone);
        } else {
            setFormData({
                ...initialPersonState,
                state: isSuperAdmin || isFederalGov ? '' : adminState,
                organizationId: isOrgAdmin ? (adminProfile?.organizationId || '') : '',
                organizationName: isOrgAdmin ? (organizations?.find(o => o.id === adminProfile?.organizationId)?.name || '') : ''
            });
            setHasPhone(true);
        }
        // Reset warnings/suggestions and search when mode changes
        setNameSuggestions([]);
        setPhoneDuplicate(null);
        setHouseholdSearch('');
        setMatchingHouseholds([]);
    }, [person, isSuperAdmin, isFederalGov, adminState, isOrgAdmin, adminProfile, organizations]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when field is changed
        if (formErrors[name]) {
            setFormErrors(prev => {
                const updated = { ...prev };
                delete updated[name];
                return updated;
            });
        }

        if (name === 'name' && value.length > 2) {
            const matches = existingPersons.filter(p =>
                p.name.toLowerCase().includes(value.toLowerCase()) && p.id !== person?.id
            ).slice(0, 5);
            setNameSuggestions(matches);
        } else if (name === 'name') {
            setNameSuggestions([]);
        }
    };

    // Debounced phone duplication check (both DisplacedPersons and Users)
    useEffect(() => {
        const val = formData.phone;
        
        // Immediately clear previous duplication flags when user starts typing a new value
        // or if value is too short. This makes the UI feel much more responsive.
        setPhoneDuplicate(null);

        if (!val || val.length < 5) {
            return;
        }

        const timer = setTimeout(async () => {
             // 1. Check local DisplacedPersons (normalized)
             const normalizedSearch = val.replace(/[^0-9]/g, '');
             const localDuplicate = existingPersons.find(p => {
                 if (!p.phone || p.id === person?.id) return false;
                 const normalizedPhone = p.phone.replace(/[^0-9]/g, '');
                 if (normalizedPhone.endsWith(normalizedSearch) || normalizedSearch.endsWith(normalizedPhone)) return true;
                 const pLast10 = normalizedPhone.slice(-10);
                 const sLast10 = normalizedSearch.slice(-10);
                 return pLast10 === sLast10 && sLast10.length >= 7;
             });

             if (localDuplicate) {
                 setPhoneDuplicate(localDuplicate);
                 return;
             }

             // 2. Check Users collection (exact and/or suffix match)
             try {
                const q = query(
                    collection(db, 'users'), 
                    where('mobile', '==', val), 
                    limit(1)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const foundUid = snap.docs[0].id;
                    // IMPORTANT: Skip if the found user is the CURRENT person's own account
                    if (foundUid === formData.userId || foundUid === person?.userId) {
                        setPhoneDuplicate(null);
                        return;
                    }

                    const u = snap.docs[0].data() as AdminUser;
                    setPhoneDuplicate({
                        id: foundUid,
                        name: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User Account',
                        currentLocation: u.state || 'Existing User Account',
                        isUserOnly: true
                    } as any);
                } else {
                    // Try another variation: if starts with 0, try +234
                    if (val.startsWith('0') && val.length === 11) {
                        const alt = '+234' + val.slice(1);
                        const q2 = query(collection(db, 'users'), where('mobile', '==', alt), limit(1));
                        const snap2 = await getDocs(q2);
                        if (!snap2.empty) {
                            const foundUid2 = snap2.docs[0].id;
                            // IMPORTANT: Skip if the found user is the CURRENT person's own account
                            if (foundUid2 === formData.userId || foundUid2 === person?.userId) {
                                setPhoneDuplicate(null);
                                return;
                            }

                            const u = snap2.docs[0].data() as AdminUser;
                            setPhoneDuplicate({
                                id: foundUid2,
                                name: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User Account',
                                currentLocation: u.state || 'Existing User Account',
                                isUserOnly: true
                            } as any);
                            return;
                        }
                    }
                    setPhoneDuplicate(null);
                }
             } catch (e) {
                 console.error("Phone check error:", e);
             }
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.phone, existingPersons, person?.id, formData.userId]);

    const searchHouseholds = async (val: string) => {
        setHouseholdSearch(val);
        if (val.length < 2) {
            setMatchingHouseholds([]);
            return;
        }
        setIsSearchingHouseholds(true);
        try {
            const q = query(
                collection(db, 'displacedPersons'),
                limit(1000)
            );
            // Client-side filtering because of Firestore limitations with multiple inequality/queries
            const snap = await getDocs(q);
            const searchVal = val.toLowerCase();
            const normalizedSearch = val.replace(/[^0-9]/g, '');
            
            const matches = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as DisplacedPerson))
                .filter(p => {
                    // Name match
                    if (p.name.toLowerCase().includes(searchVal)) return true;
                    
                    // UniqueId (shortId) match
                    if (p.shortId && p.shortId.toLowerCase().includes(searchVal)) return true;
                    
                    // Phone match with normalization
                    if (p.phone && normalizedSearch.length >= 3) {
                        const normalizedPhone = p.phone.replace(/[^0-9]/g, '');
                        // Match if one ends with the other (handles +234 vs 0)
                        if (normalizedPhone.endsWith(normalizedSearch) || normalizedSearch.endsWith(normalizedPhone)) return true;
                        // Also check last 10 digits specifically for Nigerian context
                        const pLast10 = normalizedPhone.slice(-10);
                        const sLast10 = normalizedSearch.slice(-10);
                        if (pLast10 === sLast10 && sLast10.length >= 7) return true;
                    }
                    
                    return false;
                });
            setMatchingHouseholds(matches);
        } catch (e) {
            console.error("Household search error:", e);
        } finally {
            setIsSearchingHouseholds(false);
        }
    };

    const handleUseExisting = () => {
        if (!phoneDuplicate) return;
        
        if ((phoneDuplicate as any).isUserOnly) {
            // It's a user account but not a displaced person yet
            setFormData(prev => ({ 
                ...prev, 
                userId: phoneDuplicate.id,
                // Link shortId if the user already has one
                shortId: (phoneDuplicate as any).shortId || prev.shortId
            }));
            setPhoneDuplicate(null);
            toast({ title: t('admin.displacedPersons.form.accountLinked') || "Account Linked", description: `${t('admin.displacedPersons.form.linkedToUser') || "Linked to existing user:"} ${phoneDuplicate.name}` });
        } else if (onSwitchToEdit) {
            // It's an existing displaced person
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
        // Clear error when field is changed
        if (formErrors[name]) {
            setFormErrors(prev => {
                const updated = { ...prev };
                delete updated[name];
                return updated;
            });
        }
    }

    const validateTab = (tab: string) => {
        const errors: Record<string, string> = {};
        if (tab === 'basic') {
            if (!formData.name?.trim()) errors.name = "Name is required";
            if (hasPhone && !formData.phone?.trim()) errors.phone = "Phone is required";
            if (!formData.currentLocation?.trim()) errors.currentLocation = "City/Village is required";
            if (!formData.state?.trim()) errors.state = "State is required";
            if (!formData.gender) errors.gender = "Gender is required";
            if (!hasPhone && !formData.isHouseholdHead && !formData.householdHeadId) {
                errors.householdHead = "Household Head link is required for beneficiaries without a phone";
            }
        } else if (tab === 'assessment') {
            if (hasPhone || formData.isHouseholdHead) {
                if (!formData.stayingLocation) errors.stayingLocation = "Staying location is required";
                if (!formData.shelterCondition) errors.shelterCondition = "Shelter condition is required";
                if (!formData.displacementCause?.trim()) errors.displacementCause = "Displacement cause is required";
            }
        } else if (tab === 'organization') {
            if (!formData.organizationId) errors.organizationId = "Organization is required";
        }
        
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

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
            const isIPLocation = position.coords.accuracy >= 1000;
            
            setFormData(prev => ({
                ...prev,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            }));
            
            toast({
                title: isIPLocation ? "Approximate Location" : "Location Captured",
                description: isIPLocation 
                    ? "Determined via IP (City-level). For better precision, enable Wi-Fi."
                    : `Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`,
                variant: isIPLocation ? "default" : "default"
            });
        } catch (error: any) {
            console.error("Location error:", error);
            let errorMessage = t('admin.displacedPersons.form.locationErrorDesc') || "Could not retrieve your current location. Please check permissions.";
            
            if (error.code === 1) { // PERMISSION_DENIED
                errorMessage = "Location access denied. Please enable location permissions in your browser settings.";
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                errorMessage = "Location unavailable. Please ensure Wi-Fi is enabled and your system allows location services.";
            } else if (error.code === 3) { // TIMEOUT
                errorMessage = "Location request timed out. Please try again or enter coordinates manually.";
            }

            toast({
                title: "Location Error",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setFetchingLocation(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("[DEBUG] handleSubmit called. isFormValid:", isFormValid, "hasPhone:", hasPhone);
        setLoading(true);

        try {
            // Generate shortId upfront if it's a new record and doesn't have one (e.g. from existing user)
            const generatedShortId = person?.shortId || formData.shortId || generateShortId();
            
            let dataToSave: any = {
                ...formData,
                shortId: generatedShortId,
                lastUpdate: new Date().toLocaleString()
            };

            // Remove any undefined fields to prevent Firebase errors
            Object.keys(dataToSave).forEach(key => {
                if (dataToSave[key] === undefined) {
                    delete dataToSave[key];
                }
            });

            // Force the target organization explicitly on save
            if (formData.organizationId) {
                dataToSave.organizationId = formData.organizationId;
                dataToSave.organizationName = organizations?.find(o => o.id === formData.organizationId)?.name || formData.organizationName;
            }

            // Maintain the `associatedOrgs` array to ensure historical access
            const currentOrgs = typeof person?.associatedOrgs === 'object' && Array.isArray(person?.associatedOrgs) ? (person?.associatedOrgs as string[]) : [];
            const serviceOrgIds = (formData.services || []).filter(s => s.enabled && s.providerOrgId).map(s => s.providerOrgId as string);
            const newAssocOrgs = Array.from(new Set([...currentOrgs, dataToSave.organizationId, adminProfile?.organizationId, ...serviceOrgIds].filter(Boolean)));
            
            // Allow the save to push the new explicit organization and history
            (dataToSave as any).associatedOrgs = newAssocOrgs;

            // If the user was previously Homebound (exited), and is now being saved (re-onboarded), reset their status
            // so they show up as an active beneficiary for the new organization.
            if (dataToSave.status === 'Homebound') {
                dataToSave.status = 'Re-onboarded';
            }

            // 1. Handle Account Creation / Linking (Only if hasPhone is true)
            if (hasPhone && !formData.userId && formData.phone?.trim() && formData.name?.trim()) {
                console.log("[DEBUG] No userId found. Attempting to create account...");
                try {
                    const result: any = await createAccounts({
                        users: [{
                            name: formData.name,
                            phone: formData.phone,
                            gender: formData.gender,
                            state: formData.state,
                            image: formData.imageUrl,
                            organizationId: formData.organizationId,
                            organizationName: formData.organizationName,
                            latitude: formData.latitude,
                            longitude: formData.longitude
                        }]
                    });
                    
                    const accountResult = result.data.results[0];
                    if (accountResult.uid) {
                        dataToSave = { ...dataToSave, userId: accountResult.uid };
                        
                        // Sync shortId to the newly created/found user document
                        console.log("[DEBUG] Syncing shortId to user:", accountResult.uid);
                        await updateDoc(doc(db, "users", accountResult.uid), {
                            shortId: generatedShortId
                        });

                        // Trigger Welcome SMS
                        try {
                            await sendOnboardingSMS({ 
                                phone: accountResult.mobile || formData.phone, 
                                uid: accountResult.uid,
                                shortId: generatedShortId,
                                mobileNumber: accountResult.mobileNumber,
                                isNewUser: accountResult.status === 'created',
                                authMethod: accountResult.authMethod
                            });
                        } catch (smsErr) {
                            console.error("[SMS] Failed to send welcome SMS:", smsErr);
                        }
                    }
                } catch (err) {
                    console.error("[DEBUG] Error in account creation flow:", err);
                }
            } else if (hasPhone && formData.userId && (!person?.userId || person.userId !== formData.userId)) {
                // Existing user linked from search - also sync shortId
                console.log("[DEBUG] Syncing shortId to existing user:", formData.userId);
                await updateDoc(doc(db, "users", formData.userId), {
                    shortId: generatedShortId
                });

                try {
                    await sendOnboardingSMS({ 
                        phone: formData.phone, 
                        uid: formData.userId,
                        shortId: generatedShortId,
                        isNewUser: false,
                        authMethod: 'existing details'
                    });
                } catch (smsErr) {
                    console.error("[SMS] Failed to send link SMS:", smsErr);
                }
            }

            // 2. Save the Displaced Person Record
            if (person?.id) {
                // If they changing organizations, or returning from homebound, add a movement logic
                if (person.organizationId !== dataToSave.organizationId || person.status === 'Homebound') {
                    const movement: MovementRecord = {
                        date: new Date().toLocaleString(),
                        action: 'Transfer / Re-onboard',
                        notes: `Re-onboarded to ${dataToSave.organizationName || dataToSave.organizationId}`,
                        performedBy: adminProfile?.firstName ? `${adminProfile.firstName} ${adminProfile.lastName || ''}` : t('admin.displacedPersons.logActivity.adminRole')
                    };
                    const existingMovements = Array.isArray(person.movements) ? person.movements : [];
                    (dataToSave as any).movements = [...existingMovements, movement];
                }

                const personRef = doc(db, "displacedPersons", person.id);
                await setDoc(personRef, dataToSave, { merge: true });
                toast({ title: "Success", description: "Person updated successfully." });
                
                // Also update user doc if linked
                if (dataToSave.userId) {
                    await updateDoc(doc(db, "users", dataToSave.userId), {
                        shortId: generatedShortId
                    });
                }
            } else {
                const regDateString = formData.registrationDate ? new Date(formData.registrationDate).toLocaleString() : new Date().toLocaleString();
                await addDoc(collection(db, "displacedPersons"), {
                    ...dataToSave,
                    movements: [{
                        date: regDateString,
                        action: 'Status Change',
                        notes: `Initial registration (ID: ${generatedShortId})`,
                        performedBy: adminProfile?.firstName ? `${adminProfile.firstName} ${adminProfile.lastName || ''}` : t('admin.displacedPersons.logActivity.adminRole')
                    }]
                });
                toast({ title: "Success", description: `Person added successfully with ID: ${generatedShortId}` });
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
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
                    <TabsTrigger value="basic" className="truncate relative">
                        {t('admin.displacedPersons.form.tabs.basic')}
                        {!isBasicValid && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full shadow-sm" />}
                    </TabsTrigger>
                    <TabsTrigger value="assessment" className="truncate relative">
                        {t('admin.displacedPersons.form.tabs.assessment')}
                        {!isAssessmentValid && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full shadow-sm" />}
                    </TabsTrigger>
                    <TabsTrigger value="needs" className="truncate relative">
                        {t('admin.displacedPersons.form.tabs.needs')}
                    </TabsTrigger>
                    <TabsTrigger value="organization" className="truncate relative">
                        {t('admin.displacedPersons.form.tabs.organization')}
                        {!isOrganizationValid && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full shadow-sm" />}
                    </TabsTrigger>
                    <TabsTrigger value="services" className="truncate relative">
                        {t('admin.displacedPersons.form.tabs.services') || "Services"}
                    </TabsTrigger>
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
                                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {searchingGlobal && (
                                        <div className="p-2 border-b flex items-center justify-center">
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        </div>
                                    )}
                                    {matchingUsers.map(u => {
                                        const activeRecord = activeBeneficiaryMap[u.id];
                                        const isAlreadyOnboarded = !!activeRecord && activeRecord.status !== 'Homebound' && activeRecord.status !== 'Resettled';

                                        return (
                                            <div
                                                key={u.id}
                                                className={cn(
                                                    "p-2 flex items-center justify-between gap-3 border-b last:border-0 hover:bg-slate-100 cursor-pointer"
                                                )}
                                                onClick={async () => {
                                                    // Query Firestore directly to find if this user already has an existing displaced person record anywhere
                                                    // This bypasses the existingPersons array which is filtered by the current admin's organization
                                                    try {
                                                        const q = query(collection(db, 'displacedPersons'), where('userId', '==', u.id));
                                                        const snap = await getDocs(q);
                                                        
                                                        if (!snap.empty && onSwitchToEdit) {
                                                            const existingPersonDoc = snap.docs[0];
                                                            const existingPersonRecord = { id: existingPersonDoc.id, ...existingPersonDoc.data() } as DisplacedPerson;
                                                            // If they have a record, load it entirely instead of creating a new one
                                                            onSwitchToEdit(existingPersonRecord);
                                                            setUserSearch('');
                                                            return;
                                                        }
                                                    } catch (err) {
                                                        console.error("Error fetching existing person record:", err);
                                                    }
                                                    
                                                    // Otherwise, just link them to this new record being created
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        userId: u.id, 
                                                        shortId: u.shortId || prev.shortId,
                                                        name: u.displayName || prev.name,
                                                        phone: u.mobile || u.phone || prev.phone,
                                                        state: u.state || prev.state,
                                                        imageUrl: u.image || prev.imageUrl || ''
                                                    }));
                                                    setUserSearch('');
                                                }}
                                            >
                                            <div className="flex gap-3 items-center min-w-0 flex-1">
                                                <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border">
                                                    {u.image ? (
                                                        <img src={u.image} alt={u.displayName} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <User className="h-full w-full p-2 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold truncate">{u.displayName}</p>
                                                        {u.shortId && <Badge variant="outline" className="text-[10px] px-1 h-4 bg-blue-50 text-blue-700 border-blue-200 font-mono">{u.shortId}</Badge>}
                                                    </div>
                                                    {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {t('admin.displacedPersons.form.phone')}: {u.mobile || u.phone || ''}
                                                    </p>
                                                    {(u.state || u.organizationId) && (
                                                        <p className="text-[10px] text-slate-400 truncate">
                                                            {u.state}{u.state && u.organizationId ? ' • ' : ''}{u.organizationId}
                                                        </p>
                                                    )}
                                                    {isAlreadyOnboarded && (
                                                        <div className="mt-1">
                                                            <Badge variant="destructive" className="text-[9px] px-1 h-3.5 bg-red-100 text-red-700 border-red-200">
                                                                {t('admin.displacedPersons.form.alreadyOnboarded')} {activeRecord.organizationName}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {formData.userId === u.id && <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                                        </div>
                                    )})}
                                </div>
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
                            <Label htmlFor="registrationDate">{t('admin.displacedPersons.form.registrationDate') || "Registration Date"}</Label>
                            <Input
                                id="registrationDate"
                                type="date"
                                value={formData.registrationDate || new Date().toISOString().split('T')[0]}
                                onChange={e => setFormData(prev => ({ ...prev, registrationDate: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">{t('admin.displacedPersons.form.fullName')} *</Label>
                            <Input
                                id="name"
                                value={formData.name || ''}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={t('admin.displacedPersons.form.fullNamePlaceholder')}
                                required
                                className={cn(formErrors.name && "border-red-500 focus-visible:ring-red-500")}
                            />
                            {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                            {nameSuggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                    <div className="p-2 text-xs font-semibold text-muted-foreground bg-slate-50 border-b">
                                        {t('admin.displacedPersons.form.potentialMatches')}
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
                            <div className="flex items-center justify-between">
                                <Label htmlFor="phone">{t('admin.displacedPersons.form.phone')} {hasPhone ? '*' : `(${t('common.optional') || 'Optional'})`}</Label>
                                <div className="flex items-center space-x-2">
                                    <Switch 
                                        id="hasPhone" 
                                        checked={hasPhone} 
                                        onCheckedChange={(checked) => {
                                            setHasPhone(checked);
                                            if (!checked) {
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    phone: ''
                                                }));
                                            }
                                        }} 
                                    />
                                    <Label htmlFor="hasPhone" className="text-[10px] font-normal cursor-pointer">
                                        {t('admin.displacedPersons.form.hasSmartphone') || "Has phone?"}
                                    </Label>
                                </div>
                            </div>
                            <Input
                                id="phone"
                                value={formData.phone || ''}
                                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder={hasPhone ? t('admin.displacedPersons.form.phonePlaceholder') : (t('admin.displacedPersons.form.noPhonePlaceholder') || "No phone available")}
                                required={hasPhone}
                                readOnly={!hasPhone}
                                className={cn(formErrors.phone && "border-red-500 focus-visible:ring-red-500", !hasPhone && "bg-slate-50 opacity-70")}
                            />
                            {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                            {phoneDuplicate && (
                                <Alert variant="destructive" className="mt-2 text-xs py-2">
                                    <AlertTriangle className="h-3 w-3" />
                                    <AlertTitle className="text-xs font-semibold">{t('admin.displacedPersons.form.duplicatePhone')}</AlertTitle>
                                    <AlertDescription className="mt-1">
                                        <p>
                                            {(phoneDuplicate as any).isUserOnly 
                                                ? (t('admin.displacedPersons.form.phoneUsedByAccount') || "This phone number is already registered to user account:") 
                                                : (t('admin.displacedPersons.form.matches') || "Matches beneficiary:")
                                            } <strong>{phoneDuplicate.name}</strong> ({phoneDuplicate.currentLocation}).
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                            <Button type="button" variant="secondary" size="sm" className="h-6 text-[10px]" onClick={handleUseExisting}>
                                                {(phoneDuplicate as any).isUserOnly 
                                                    ? (t('admin.displacedPersons.form.linkAccountBtn') || "Link Account") 
                                                    : (t('admin.displacedPersons.form.useExisting') || "Use Existing")
                                                }
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
                            <Input 
                                id="currentLocation" 
                                name="currentLocation"
                                value={formData.currentLocation || ''} 
                                onChange={handleChange} 
                                required 
                                className={cn(formErrors.currentLocation && "border-red-500 focus-visible:ring-red-500")}
                            />
                            {formErrors.currentLocation && <p className="text-red-500 text-xs mt-1">{formErrors.currentLocation}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="details">{t('admin.displacedPersons.form.otherDetails')}</Label>
                            <Input id="details" value={formData.details || ''} onChange={e => setFormData(prev => ({ ...prev, details: e.target.value }))} placeholder={t('admin.displacedPersons.form.detailsPlaceholder')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">{t('admin.displacedPersons.form.sex')} *</Label>
                            <Select value={formData.gender || ''} onValueChange={(v) => handleSelectChange('gender', v)}>
                                <SelectTrigger id="gender" className={cn(formErrors.gender && "border-red-500 focus-visible:ring-red-500")}>
                                    <SelectValue placeholder={t('admin.displacedPersons.form.selectGender')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">{t('admin.displacedPersons.form.options.male')}</SelectItem>
                                    <SelectItem value="Female">{t('admin.displacedPersons.form.options.female')}</SelectItem>
                                    <SelectItem value="Other">{t('admin.displacedPersons.form.options.other')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {formErrors.gender && <p className="text-red-500 text-xs mt-1">{formErrors.gender}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="state">{t('admin.displacedPersons.form.currentState')} *</Label>
                            <Select
                                value={formData.state || ''}
                                onValueChange={(v) => handleSelectChange('state', v)}
                                disabled={!isSuperAdmin && !!adminState}
                            >
                                <SelectTrigger id="state" className={cn(formErrors.state && "border-red-500 focus-visible:ring-red-500")}>
                                    <SelectValue placeholder={t('admin.displacedPersons.form.selectState')} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {isSuperAdmin ? (
                                        nigerianStates.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value={adminState}>{adminState}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {formErrors.state && <p className="text-red-500 text-xs mt-1">{formErrors.state}</p>}
                        </div>
                    </div>

                    {/* Household Head Link Section - MOVED TO BASIC TAB */}  <div className="space-y-3 p-4 border rounded-lg bg-orange-50/30 border-orange-100 mt-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-orange-900 font-semibold">{t('admin.displacedPersons.form.householdHead') || "Household Head Link"}</Label>
                            <div className="flex items-center space-x-2">
                                <Switch 
                                    id="isHead" 
                                    checked={formData.isHouseholdHead} 
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isHouseholdHead: checked }))} 
                                />
                                <Label htmlFor="isHead" className="text-xs">{t('admin.displacedPersons.form.setAsHead') || "Set as Head"}</Label>
                            </div>
                        </div>
                        
                        {!formData.isHouseholdHead && (
                            <div className="space-y-2 mt-2">
                                <p className="text-[10px] text-orange-700 italic">
                                    {t('admin.displacedPersons.form.headLinkDesc') || "Link this beneficiary to a Household Head (e.g., parent or guardian)."}
                                </p>
                                {formData.householdHeadId ? (
                                    <div className="flex items-center justify-between p-2 bg-white border rounded-md">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                                                <User className="h-4 w-4 text-orange-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <Label className="text-[10px] text-orange-700 uppercase mb-1 block">
                                                    {t('admin.displacedPersons.form.householdHeadName') || "Household Head Name"}
                                                </Label>
                                                <Input 
                                                    value={formData.householdHeadName || ''} 
                                                    readOnly 
                                                    className="h-8 text-sm focus-visible:ring-0 bg-orange-50/50 border-orange-100" 
                                                />
                                                <p className="text-[9px] text-muted-foreground mt-1">ID: {formData.householdHeadId}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 text-red-600 hover:text-red-700"
                                            onClick={() => setFormData(prev => ({ ...prev, householdHeadId: undefined, householdHeadName: undefined }))}
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {!hasPhone && !formData.isHouseholdHead && !formData.householdHeadId && (
                                            <p className="text-[10px] text-red-600 font-semibold mb-2 bg-red-50 p-1.5 rounded border border-red-100">
                                                {t('admin.displacedPersons.form.headRequired') || "Required: Since this person has no phone, you MUST link them to a head or set them as head."}
                                            </p>
                                        )}
                                        <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder={t('admin.displacedPersons.form.searchHouseholdHead') || "Search for household head by name or phone..."}
                                            className="pl-8 bg-white"
                                            value={householdSearch}
                                            onChange={(e) => searchHouseholds(e.target.value)}
                                        />
                                        {householdSearch && matchingHouseholds.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                                {matchingHouseholds.map(h => (
                                                    <div
                                                        key={h.id}
                                                        className="p-2 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0 flex justify-between items-center"
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, householdHeadId: h.id, householdHeadName: h.name }));
                                                            setHouseholdSearch('');
                                                            setMatchingHouseholds([]);
                                                        }}
                                                    >
                                                        <div>
                                                            <span className="font-medium">{h.name}</span>
                                                            <span className="text-[10px] text-muted-foreground ml-2">{h.phone || h.shortId}</span>
                                                        </div>
                                                        {h.assignedShelterId && (
                                                          <Badge variant="outline" className="font-mono text-[10px]">{h.shortId}</Badge>
                                                        )}
                                                        {h.householdHeadName && (
                                                            <div className="flex items-center gap-1.5 text-[11px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md w-fit mt-1">
                                                                <Users className="h-3 w-3" />
                                                                <span>{t('admin.displacedPersons.cardView.linkedTo') || "Linked to"}: {h.householdHeadName}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {isSearchingHouseholds && (
                                            <div className="absolute right-2.5 top-2.5">
                                                <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                                            </div>
                                        )}
                                    </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 mt-4 p-4 border rounded-lg bg-gray-50">
                        <Label>{t('admin.displacedPersons.form.locationImage')}</Label>
                        <div className="flex items-center gap-4">
                            <Input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="max-w-[250px]" disabled={uploadingImage} />
                            {uploadingImage && <span className="text-sm text-muted-foreground animate-pulse">{t('admin.displacedPersons.form.uploading')}</span>}
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
                            placeholder={t('admin.displacedPersons.form.manualImageUrlPlaceholder')}
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
                            <Input type="number" id="latitude" name="latitude" value={formData.latitude || ''} onChange={handleChange} placeholder={t('admin.displacedPersons.form.latPlaceholder')} step="any" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="longitude">{t('admin.displacedPersons.form.longitudeOptional')}</Label>
                            <Input type="number" id="longitude" name="longitude" value={formData.longitude || ''} onChange={handleChange} placeholder={t('admin.displacedPersons.form.lngPlaceholder')} step="any" />
                        </div>
                    </div>


                </TabsContent>

                <TabsContent value="assessment" className="space-y-4">

                    <Separator className="my-2" />
                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.form.stayingQuestion')} *</Label>
                        <Select value={formData.stayingLocation} onValueChange={(v) => handleSelectChange('stayingLocation', v)}>
                            <SelectTrigger className={cn(formErrors.stayingLocation && "border-red-500 focus-visible:ring-red-500")}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Host community">{t('admin.displacedPersons.form.options.hostCommunity')}</SelectItem>
                                <SelectItem value="IDP camp">{t('admin.displacedPersons.form.options.idpCamp')}</SelectItem>
                                <SelectItem value="Open space">{t('admin.displacedPersons.form.options.openSpace')}</SelectItem>
                                <SelectItem value="Abandoned structure">{t('admin.displacedPersons.form.options.abandonedStructure')}</SelectItem>
                                <SelectItem value="Others">{t('admin.displacedPersons.form.options.others')}</SelectItem>
                            </SelectContent>
                        </Select>
                        {formErrors.stayingLocation && <p className="text-red-500 text-xs mt-1">{formErrors.stayingLocation}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.form.shelterCondition')} *</Label>
                        <Select value={formData.shelterCondition} onValueChange={(v) => handleSelectChange('shelterCondition', v)}>
                            <SelectTrigger className={cn(formErrors.shelterCondition && "border-red-500 focus-visible:ring-red-500")}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Rented accommodation">{t('admin.displacedPersons.form.options.rented')}</SelectItem>
                                <SelectItem value="Own house (damaged but habitable)">{t('admin.displacedPersons.form.options.ownHouseDamaged')}</SelectItem>
                                <SelectItem value="Own house (safe and adequate)">{t('admin.displacedPersons.form.options.ownHouseSafe')}</SelectItem>
                                <SelectItem value="Staying with relatives or friends">{t('admin.displacedPersons.form.options.withRelatives')}</SelectItem>
                                <SelectItem value="Homeless / living in open areas">{t('admin.displacedPersons.form.options.homeless')}</SelectItem>
                                <SelectItem value="Makeshift or temporary shelter (tent, shack, uncompleted building)">{t('admin.displacedPersons.form.options.makeshift')}</SelectItem>
                                <SelectItem value="Camp shelter (formal IDP camp)">{t('admin.displacedPersons.form.options.campShelter')}</SelectItem>
                            </SelectContent>
                        </Select>
                        {formErrors.shelterCondition && <p className="text-red-500 text-xs mt-1">{formErrors.shelterCondition}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="displacementCause">{t('admin.displacedPersons.form.displacementCause')} *</Label>
                        <Textarea 
                            id="displacementCause" 
                            name="displacementCause" 
                            value={formData.displacementCause} 
                            onChange={handleChange} 
                            placeholder={t('admin.displacedPersons.form.displacementCausePlaceholder')} 
                            className={cn(formErrors.displacementCause && "border-red-500 focus-visible:ring-red-500")}
                        />
                        {formErrors.displacementCause && <p className="text-red-500 text-xs mt-1">{formErrors.displacementCause}</p>}
                    </div>

                    <div className="space-y-3">
                        <Label>{t('admin.displacedPersons.form.householdComposition')}</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">{t('admin.displacedPersons.form.total')}</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.total} readOnly className="bg-slate-100 font-bold" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">{t('admin.displacedPersons.form.adults')}</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.adults} onChange={(e) => handleCompositionChange('adults', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">{t('admin.displacedPersons.form.children')}</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.children} onChange={(e) => handleCompositionChange('children', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">{t('admin.displacedPersons.form.elderly')}</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.elderly} onChange={(e) => handleCompositionChange('elderly', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase">{t('admin.displacedPersons.form.pwds')}</Label>
                                <Input type="number" min="0" value={formData.householdComposition?.pwds} onChange={(e) => handleCompositionChange('pwds', e.target.value)} />
                            </div>
                        </div>
                    </div>

                </TabsContent>

                <TabsContent value="needs" className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label>{t('admin.displacedPersons.form.isSecure')}</Label>
                                <p className="text-[10px] text-muted-foreground">{t('admin.displacedPersons.form.isSecureDesc')}</p>
                            </div>
                            <Switch checked={formData.isShelterSafe} onCheckedChange={(checked) => handleSelectChange('isShelterSafe', checked as any)} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label>{t('admin.displacedPersons.form.receivedAssistance')}</Label>
                                <p className="text-[10px] text-muted-foreground">{t('admin.displacedPersons.form.receivedAssistanceDesc')}</p>
                            </div>
                            <Switch checked={formData.receivedAssistance} onCheckedChange={(checked) => handleSelectChange('receivedAssistance', checked as any)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.form.weatherIssues')}</Label>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                            {['Rain', 'Wind', 'Heat', 'Cold'].map(cond => (
                                <Button
                                    key={cond} type="button"
                                    variant={formData.weatherProtection?.includes(cond) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleWeatherToggle(cond)}
                                    className="h-8"
                                >
                                    {t(`admin.displacedPersons.form.options.${cond.toLowerCase()}`)}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.form.urgentProblem')}</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'leakage', label: 'admin.displacedPersons.form.options.leakage', value: 'Leakage' },
                                { id: 'overcrowding', label: 'admin.displacedPersons.form.options.overcrowding', value: 'Overcrowding' },
                                { id: 'lackOfPrivacy', label: 'admin.displacedPersons.form.options.lackOfPrivacy', value: 'Lack of privacy' },
                                { id: 'unsafeStructure', label: 'admin.displacedPersons.form.options.unsafeStructure', value: 'Unsafe structure' }
                            ].map(problem => (
                                <div key={problem.value} className="flex items-center space-x-2 p-2 border rounded hover:bg-slate-50">
                                    <Checkbox
                                        id={`problem-${problem.id}`}
                                        checked={formData.urgentShelterProblem?.includes(problem.value)}
                                        onCheckedChange={() => toggleMultiSelect('urgentShelterProblem', problem.value)}
                                    />
                                    <label htmlFor={`problem-${problem.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                        {t(problem.label)}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.form.assistanceMostNeeded')}</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'emergency', label: 'admin.displacedPersons.form.options.emergencyShelter', value: 'Emergency shelter' },
                                { id: 'repairs', label: 'admin.displacedPersons.form.options.repairs', value: 'Repairs' },
                                { id: 'relocation', label: 'admin.displacedPersons.form.options.relocation', value: 'Relocation' },
                                { id: 'transitional', label: 'admin.displacedPersons.form.options.transitionalShelter', value: 'Transitional shelter' },
                                { id: 'nfis', label: 'admin.displacedPersons.form.options.nfis', value: 'NFIs' }
                            ].map(need => (
                                <div key={need.value} className="flex items-center space-x-2 p-2 border rounded hover:bg-slate-50">
                                    <Checkbox
                                        id={`need-${need.id}`}
                                        checked={formData.assistanceNeeded?.includes(need.value)}
                                        onCheckedChange={() => toggleMultiSelect('assistanceNeeded', need.value)}
                                    />
                                    <label htmlFor={`need-${need.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                        {t(need.label)}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('admin.displacedPersons.form.adminStatus')}</Label>
                            <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Needs Assistance">{t('admin.displacedPersons.form.options.needsAssistance') || "Needs Assistance"}</SelectItem>
                                    <SelectItem value="Eligible for Shelter">{t('admin.displacedPersons.form.options.eligible') || "Eligible"}</SelectItem>
                                    <SelectItem value="Moving to Shelter">{t('admin.displacedPersons.form.options.enRoute')}</SelectItem>
                                    <SelectItem value="Emergency">{t('admin.displacedPersons.form.options.emergency') || "Emergency"}</SelectItem>
                                    <SelectItem value="Safe">{t('admin.displacedPersons.form.options.safeAssigned')}</SelectItem>
                                    <SelectItem value="Resettled">{t('admin.displacedPersons.statusEnum.resettled')}</SelectItem>
                                    <SelectItem value="Homebound">{t('admin.displacedPersons.statusEnum.homebound')}</SelectItem>
                                    <SelectItem value="Re-onboarded">{t('admin.displacedPersons.statusEnum.reonboarded')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('admin.displacedPersons.form.adminPriority')}</Label>
                            <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low Priority">{t('admin.displacedPersons.priorityEnum.low')}</SelectItem>
                                    <SelectItem value="Medium Priority">{t('admin.displacedPersons.priorityEnum.medium')}</SelectItem>
                                    <SelectItem value="High Priority">{t('admin.displacedPersons.priorityEnum.high')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </TabsContent>                <TabsContent value="services" className="space-y-4 py-4 min-h-[400px]">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold">
                            <Heart className="h-5 w-5 text-red-600" />
                            <h3>{t('admin.displacedPersons.form.beneficiaryServices') || "Beneficiary Services Offered"}</h3>
                        </div>
                        
                        <ScrollArea className="h-[450px] pr-4">
                            <div className="space-y-6">
                                {Object.entries(
                                    (formData.services || DEFAULT_SERVICES).reduce((acc, service) => {
                                        if (!acc[service.category]) acc[service.category] = [];
                                        acc[service.category].push(service);
                                        return acc;
                                    }, {} as Record<string, BeneficiaryService[]>)
                                ).map(([category, services]) => (
                                    <div key={category} className="space-y-3">
                                        <h4 className="text-sm font-bold text-slate-700 bg-slate-100 p-2 rounded">
                                            {t(`admin.displacedPersons.services.categories.${category}`)}
                                        </h4>
                                        <div className="grid gap-3">
                                            {services.map(service => (
                                                <div key={service.id} className="flex flex-col p-3 border rounded-lg bg-white shadow-sm gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <Label className="font-semibold cursor-pointer" htmlFor={`service-${service.id}`}>
                                                                    {t(`admin.displacedPersons.services.items.${service.id}.name`)}
                                                                </Label>
                                                                {service.enabled && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Active</Badge>}
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground mt-1">{t(`admin.displacedPersons.services.items.${service.id}.description`)}</p>
                                                        </div>
                                                        <Switch 
                                                            id={`service-${service.id}`}
                                                            checked={service.enabled}
                                                            onCheckedChange={(checked) => toggleService(service.id, checked)}
                                                        />
                                                    </div>
                                                    
                                                    {service.enabled && (
                                                        <div className="pt-2 border-t mt-1 space-y-3">
                                                            {service.subServices && service.subServices.length > 0 && (
                                                                <div className="space-y-2 mb-3">
                                                                    <Label className="text-[11px] font-semibold text-slate-700">{t('admin.displacedPersons.form.subServices') || "Specific Services Provided"}</Label>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                        {service.subServices.map(subService => (
                                                                            <div key={subService.id} className="flex items-center space-x-2 p-1.5 border rounded hover:bg-slate-50">
                                                                                <Checkbox 
                                                                                    id={`sub-${service.id}-${subService.id}`}
                                                                                    checked={subService.enabled}
                                                                                    onCheckedChange={(checked) => toggleSubService(service.id, subService.id, !!checked)}
                                                                                />
                                                                                <label 
                                                                                    htmlFor={`sub-${service.id}-${subService.id}`}
                                                                                    className="text-[11px] font-medium leading-none cursor-pointer"
                                                                                >
                                                                                    {t(`admin.displacedPersons.services.subItems.${service.id}.${subService.id}`) || subService.id.replace(/_/g, ' ')}
                                                                                </label>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="space-y-2">
                                                                <Label className="text-[11px] font-medium">{t('admin.displacedPersons.form.providingOrg') || "Providing Organization"}</Label>
                                                                <Select
                                                                    value={service.providerOrgId || formData.organizationId || ''}
                                                                    onValueChange={(val) => {
                                                                        const org = organizations?.find(o => o.id === val);
                                                                        updateServiceProvider(service.id, val, org?.name || '');
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-8 text-[11px]">
                                                                        <SelectValue placeholder={service.providerOrgName || formData.organizationName || t('admin.displacedPersons.form.chooseOrganization')} />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {filteredOrgs.map(o => (
                                                                            <SelectItem key={o.id} value={o.id} className="text-[11px]">{o.name}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </TabsContent>

                <TabsContent value="organization" className="space-y-4 py-4 min-h-[400px]">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            <h3>{t('admin.displacedPersons.form.selectOrganization')}</h3>
                        </div>

                        {(isSuperAdmin || isFederalGov) && (
                            <div className="space-y-2">
                                <Label htmlFor="orgState">{t('admin.displacedPersons.form.selectState')} *</Label>
                                <Select
                                    value={formData.state || ''}
                                    onValueChange={(v) => {
                                        setFormData(prev => ({ ...prev, state: v, organizationId: '', organizationName: '' }));
                                    }}
                                >
                                    <SelectTrigger id="orgState">
                                        <SelectValue placeholder={t('admin.displacedPersons.form.selectState')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {nigerianStates.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="org">{t('admin.displacedPersons.form.tabs.organization')} *</Label>
                            <Select
                                value={formData.organizationId || ''}
                                onValueChange={(v) => {
                                    const org = organizations?.find(o => o.id === v);
                                    handleSelectChange('organizationId', v);
                                    setFormData(prev => ({ ...prev, organizationName: org?.name || '' }));
                                }}
                                disabled={isOrgAdmin}
                            >
                                <SelectTrigger id="org" className={cn(formErrors.organizationId && "border-red-500 focus-visible:ring-red-500")}>
                                    <SelectValue placeholder={formData.organizationName || t('admin.displacedPersons.form.chooseOrganization')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {isOrgAdmin ? (
                                        <SelectItem value={formData.organizationId || ''}>{formData.organizationName}</SelectItem>
                                    ) : (
                                        organizations
                                            ?.filter(o => {
                                                if (isSuperAdmin || isFederalGov) return o.state === formData.state || o.states?.includes(formData.state || '');
                                                if (isStateGov) return o.state === adminState || o.states?.includes(adminState);
                                                return true;
                                            })
                                            .map(o => (
                                                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                                            ))
                                    )}
                                </SelectContent>
                            </Select>
                            {formErrors.organizationId && <p className="text-red-500 text-xs mt-1">{formErrors.organizationId}</p>}
                            {isOrgAdmin && <p className="text-xs text-muted-foreground">{t('admin.displacedPersons.form.orgReadOnly')}</p>}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-white flex justify-between items-center sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>{t('admin.displacedPersons.form.cancel')}</Button>
                
                {activeTab !== 'organization' && (
                    <Button 
                        type="button" 
                        variant="secondary"
                        onClick={() => {
                            if (validateTab(activeTab)) {
                                const tabs = ['basic', 'assessment', 'services', 'needs', 'organization'];
                                const currentIndex = tabs.indexOf(activeTab);
                                if (currentIndex < tabs.length - 1) {
                                    setActiveTab(tabs[currentIndex + 1]);
                                }
                            } else {
                                toast({ 
                                    title: "Required Fields", 
                                    description: "Please fill in all required fields marked in red.", 
                                    variant: "destructive" 
                                });
                            }
                        }}
                    >
                        {t('common.next') || "Next"}
                    </Button>
                )}

                <div className="flex flex-col items-end gap-1">
                    <Button type="submit" disabled={loading || !isFormValid}>
                        {loading ? t('admin.displacedPersons.form.saving') : (person ? t('admin.displacedPersons.form.save') : t('admin.displacedPersons.addBeneficiary'))}
                    </Button>
                    {!isFormValid && !loading && (
                        <p className="text-[9px] text-red-500 font-medium">
                            {!isBasicValid ? (t('admin.displacedPersons.form.missingBasic') || "Complete Basic Info") : 
                             !isAssessmentValid ? (t('admin.displacedPersons.form.missingAssessment') || "Check Assessment Tab") : 
                             !isOrganizationValid ? (t('admin.displacedPersons.form.missingOrg') || "Choose Organization Tab") : 
                             phoneDuplicate ? (t('admin.displacedPersons.form.duplicateWarning') || "Fix Duplicate Phone") : 
                             ""}
                        </p>
                    )}
                </div>
            </DialogFooter>
        </form >
    );
}

function AssignShelterDialog({ person, allShelters, isOpen, onOpenChange, onAssign, adminProfile, organizations }: { person: DisplacedPerson | null, allShelters: Shelter[], isOpen: boolean, onOpenChange: (open: boolean) => void, onAssign: () => void, adminProfile: any, organizations: any[] | null }) {
    const { t } = useTranslation();
    const [filteredShelters, setFilteredShelters] = useState<Shelter[]>([]);
    const [availableStates, setAvailableStates] = useState<string[]>([]);
    const [selectedState, setSelectedState] = useState('');
    const [selectedShelterId, setSelectedShelterId] = useState<string>('');
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');
    const [bedNumber, setBedNumber] = useState('');
    const [bedsToOccupy, setBedsToOccupy] = useState(1);
    const [householdHead, setHouseholdHead] = useState<DisplacedPerson | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [allocatedBeds, setAllocatedBeds] = useState<string[]>([]);
    const { toast } = useToast();

    const selectedShelter = useMemo(() => allShelters.find(s => s.id === selectedShelterId), [allShelters, selectedShelterId]);
    const selectedRoom = useMemo(() => selectedShelter?.rooms?.find(r => r.id === selectedRoomId), [selectedShelter, selectedRoomId]);

    useEffect(() => {
        if (isOpen && adminProfile) {
            // Role-based logic
            const role = adminProfile.role?.toLowerCase() || '';
            const isSuperAdmin = role.includes('super');
            const isFederalGov = role.includes('federal');
            const isStateGov = role.includes('state') && role.includes('government');
            const isOrgAdmin = role.includes('organization');

            if (isSuperAdmin || isFederalGov) {
                setAvailableStates(NIGERIA_STATES);
            } else if (isStateGov && adminProfile.state) {
                setAvailableStates([adminProfile.state]);
                setSelectedState(adminProfile.state);
            } else if (isOrgAdmin && adminProfile.organizationId) {
                // Get organization specific states from the organizations collection if available
                const orgDoc = organizations?.find(o => o.id === adminProfile.organizationId);
                let orgStates: string[] = [];
                
                if (orgDoc && orgDoc.states && Array.isArray(orgDoc.states)) {
                    orgStates = orgDoc.states;
                } else {
                    // Fallback to shelters if org doc doesn't have states array
                    orgStates = Array.from(new Set(allShelters
                        .filter(s => s.organizationId === adminProfile.organizationId)
                        .map(s => s.state)
                        .filter((s): s is string => !!s)
                    ));
                }
                setAvailableStates(orgStates.sort());
                if (orgStates.length === 1) {
                    setSelectedState(orgStates[0]);
                }
            } else {
                const states = Array.from(new Set(allShelters.map(s => s.state).filter((s): s is string => !!s)));
                setAvailableStates(states.sort());
                if (states.length === 1) setSelectedState(states[0]);
            }

            // Pre-select planned shelter if it exists
            if (person?.plannedShelterId) {
                const plannedShelter = allShelters.find(s => s.id === person.plannedShelterId);
                if (plannedShelter) {
                    setSelectedState(plannedShelter.state || '')                    // Setting ID directly after initial state selection
                    setTimeout(() => setSelectedShelterId(plannedShelter.id), 100);
                }
            }

            // Fetch household head details if linked
            if (person?.householdHeadId) {
                const fetchHead = async () => {
                    try {
                        const headSnap = await getDocs(query(collection(db, 'displacedPersons'), where('__name__', '==', person.householdHeadId)));
                        if (!headSnap.empty) {
                            const headData = { id: headSnap.docs[0].id, ...headSnap.docs[0].data() } as DisplacedPerson;
                            setHouseholdHead(headData);
                            
                            // If head is already assigned, pre-select their location
                            if (headData.assignedShelterId) {
                                const headShelter = allShelters.find(s => s.id === headData.assignedShelterId);
                                if (headShelter) {
                                    setSelectedState(headShelter.state || '');
                                    setTimeout(() => {
                                        setSelectedShelterId(headData.assignedShelterId!);
                                        if (headData.allocatedResources?.roomId) {
                                            setSelectedRoomId(headData.allocatedResources.roomId);
                                        }
                                    }, 200);
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Error fetching household head:", e);
                    }
                };
                fetchHead();
            }

            setBedsToOccupy(1);
        } else if (!isOpen) {
            setSelectedState('');
            setSelectedShelterId('');
            setSelectedRoomId('');
            setBedNumber('');
            setFilteredShelters([]);
            setAvailableStates([]);
        }
    }, [isOpen, adminProfile, allShelters, organizations]);

    useEffect(() => {
        if (selectedState) {
            const sheltersInState = (allShelters || [])
                .filter(s => s.state === selectedState || s.location.includes(selectedState))
                .sort((a, b) => b.availableCapacity - a.availableCapacity);
            setFilteredShelters(sheltersInState);
        } else {
            setFilteredShelters([]);
        }
        setSelectedShelterId('');
        setSelectedRoomId('');
    }, [selectedState, allShelters]);

    useEffect(() => {
        setSelectedRoomId('');
    }, [selectedShelterId]);

    useEffect(() => {
        setBedNumber('');
        setAllocatedBeds([]);
        if (!selectedRoomId || !selectedShelterId) return;
        // Fetch already-allocated beds for this room from displacedPersons
        const fetchAllocatedBeds = async () => {
            try {
                const q = query(
                    collection(db, 'displacedPersons'),
                    where('allocatedResources.roomId', '==', selectedRoomId),
                    where('assignedShelterId', '==', selectedShelterId)
                );
                const snap = await getDocs(q);
                const beds: string[] = [];
                snap.forEach(d => {
                    const bed = d.data()?.allocatedResources?.bedNumber;
                    // Exclude the current person being re-assigned
                    if (bed && d.id !== person?.id) beds.push(bed);
                });
                setAllocatedBeds(beds);
            } catch (e) {
                console.error('Failed to fetch allocated beds', e);
            }
        };
        fetchAllocatedBeds();
    }, [selectedRoomId, selectedShelterId, person?.id]);


    const handleSubmit = async () => {
        if (!person || !selectedShelterId || !selectedRoomId || !bedNumber) {
            toast({ title: "Error", description: "Please complete all fields.", variant: "destructive" });
            return;
        }
        setSubmitting(true);

        try {
            await runTransaction(db, async (transaction) => {
                const shelterRef = doc(db, "shelters", selectedShelterId);
                const personRef = doc(db, "displacedPersons", person.id);

                const shelterDoc = await transaction.get(shelterRef);
                if (!shelterDoc.exists()) throw "Shelter not found!";

                const data = shelterDoc.data();
                const totalToOccupy = Math.max(1, bedsToOccupy);
                if (data.availableCapacity < totalToOccupy) throw `Not enough capacity! Only ${data.availableCapacity} spots left.`;

                const updatedRooms = (data.rooms || []).map((r: any) => {
                    if (r.id === selectedRoomId) {
                        if (r.available < totalToOccupy) throw `Room ${r.name} only has ${r.available} spots left!`;
                        return { ...r, available: r.available - totalToOccupy };
                    }
                    return r;
                });

                transaction.update(shelterRef, {
                    availableCapacity: data.availableCapacity - totalToOccupy,
                    rooms: updatedRooms
                });

                const adminName = adminProfile?.firstName ? `${adminProfile.firstName} ${adminProfile.lastName || ''}` : "Administrator";

                const newMovement: MovementRecord = {
                    date: new Date().toLocaleString(),
                    action: 'Entry',
                    shelterId: selectedShelterId,
                    shelterName: data.name,
                    notes: `Assigned to Room: ${selectedRoom?.name}, Bed(s): ${bedNumber}${bedsToOccupy > 1 ? ` (+ ${bedsToOccupy - 1} family members)` : ''}`,
                    performedBy: adminName
                };

                transaction.update(personRef, {
                    status: 'Safe',
                    assignedShelterId: selectedShelterId,
                    allocatedResources: { 
                        bedNumber,
                        bedsOccupied: bedsToOccupy,
                        roomId: selectedRoomId,
                        roomName: selectedRoom?.name 
                    },
                    movements: [...(person.movements || []), newMovement],
                    needsOnboarding: deleteField(),
                    plannedShelterId: deleteField(),
                    activityLog: [...(person.activityLog || []), {
                        date: new Date().toLocaleString(),
                        action: `Assigned to Shelter: ${data.name}`,
                        performedBy: adminName,
                        notes: `Room: ${selectedRoom?.name}, Bed(s): ${bedNumber}${bedsToOccupy > 1 ? ` (+ ${bedsToOccupy - 1} additional beds)` : ''}`
                    }]
                });
            });

            toast({ title: "Success", description: `${person.name} has been assigned to ${selectedShelter?.name}.` });
            onAssign();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Assignment failed: ", error);
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
                    <DialogDescription>
                        {person.householdHeadName ? (
                            <span className="text-orange-600 font-medium flex items-center gap-1 mt-1">
                                <Users className="h-3 w-3" />
                                {t('admin.displacedPersons.assignShelter.linkedTo') || "Linked to Household Head"}: {person.householdHeadName}
                            </span>
                        ) : t('admin.displacedPersons.assignShelter.desc')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {householdHead?.assignedShelterId && (
                        <Alert className="bg-green-50 border-green-200 py-2">
                            <Info className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-xs text-green-800">
                                {t('admin.displacedPersons.assignShelter.headSuggestion', { 
                                    name: householdHead.name, 
                                    shelter: householdHead.organizationName || 'a shelter', 
                                    room: householdHead.allocatedResources?.roomName || 'Unknown' 
                                }) || `Household Head (${householdHead.name}) is at ${householdHead.organizationName || 'a shelter'}. Suggested room: ${householdHead.allocatedResources?.roomName || 'Unknown'}.`}
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="state">{t('admin.displacedPersons.assignShelter.filterState')}</Label>
                        <Select value={selectedState} onValueChange={setSelectedState}>
                            <SelectTrigger id="state" disabled={availableStates.length === 1}>
                                <SelectValue placeholder={t('admin.displacedPersons.assignShelter.chooseState')} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableStates.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="shelter">{t('admin.displacedPersons.assignShelter.selectShelter')}</Label>
                        <Select value={selectedShelterId} onValueChange={setSelectedShelterId} disabled={!selectedState}>
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

                    <div className="space-y-2">
                        <Label htmlFor="room">{t('admin.displacedPersons.assignShelter.selectRoom')}</Label>
                        <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={!selectedShelterId}>
                            <SelectTrigger id="room">
                                <SelectValue placeholder={!selectedShelterId ? t('admin.displacedPersons.assignShelter.selectShelterFirst') : t('admin.displacedPersons.assignShelter.chooseRoom')} />
                            </SelectTrigger>
                            <SelectContent>
                                {selectedShelter?.rooms?.map(r => (
                                    <SelectItem key={r.id} value={r.id} disabled={r.available === 0}>
                                        {r.name} ({r.available} {t('admin.displacedPersons.assignShelter.spotsAvailable')})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bed">{t('admin.displacedPersons.assignShelter.selectBed')}</Label>
                        <Select value={bedNumber} onValueChange={setBedNumber} disabled={!selectedRoomId}>
                            <SelectTrigger id="bed">
                                <SelectValue placeholder={!selectedRoomId ? t('admin.displacedPersons.assignShelter.selectRoomFirst') : t('admin.displacedPersons.assignShelter.chooseBed')} />
                            </SelectTrigger>
                            <SelectContent>
                                {selectedRoom && Array.from({ length: selectedRoom.capacity }).map((_, i) => {
                                    const bedLabel = `Bed ${i + 1}`;
                                    const isOccupied = allocatedBeds.includes(bedLabel);
                                    return (
                                        <SelectItem
                                            key={i}
                                            value={bedLabel}
                                            disabled={isOccupied}
                                            className={isOccupied ? 'opacity-40 line-through cursor-not-allowed' : ''}
                                        >
                                            {bedLabel}{isOccupied ? ' (Occupied)' : ''}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {(person.householdComposition?.total || 1) > 1 && (
                        <div className="space-y-3 p-3 border rounded-lg bg-blue-50/50">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="bedsToOccupy" className="text-blue-900 font-medium">
                                    {t('admin.displacedPersons.assignShelter.bedsToOccupy') || "Beds to Occupy"}
                                </Label>
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                                    {bedsToOccupy} {t('admin.displacedPersons.assignShelter.beds') || (bedsToOccupy === 1 ? "Bed" : "Beds")}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4">
                                <Input 
                                    type="range" 
                                    id="bedsToOccupy"
                                    min="1" 
                                    max={person.householdComposition?.total || 1} 
                                    value={bedsToOccupy} 
                                    onChange={(e) => setBedsToOccupy(parseInt(e.target.value))}
                                    className="flex-1"
                                />
                                <Input 
                                    type="number" 
                                    min="1" 
                                    max={person.householdComposition?.total || 1} 
                                    value={bedsToOccupy} 
                                    onChange={(e) => setBedsToOccupy(Math.min(person.householdComposition?.total || 1, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-16"
                                />
                            </div>
                            <p className="text-[10px] text-blue-700 italic">
                                * {t('admin.displacedPersons.assignShelter.householdHint') || `This beneficiary has a household size of ${person.householdComposition?.total}. Specify how many beds should be reserved.`}
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">{t('admin.displacedPersons.assignShelter.cancel')}</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !bedNumber} className="w-full sm:w-auto">
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
                                        <TableHead>{t('admin.displacedPersons.import.table.no')}</TableHead>
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
                                        <TableHead>{t('admin.displacedPersons.import.table.no')}</TableHead>
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

function ExitShelterDialog({ person, isOpen, onOpenChange, onExit, organizations, allShelters }: { 
    person: DisplacedPerson | null, 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    onExit: (p: DisplacedPerson, reason: string, destination: string, exitDate: string, targetOrgId?: string, targetShelterId?: string) => void,
    organizations: { id: string; name: string }[] | null,
    allShelters: Shelter[] | null
}) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('home');
    const [destination, setDestination] = useState('');
    const [targetOrgId, setTargetOrgId] = useState('');
    const [targetShelterId, setTargetShelterId] = useState('');
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);

    const isInvalidDate = useMemo(() => {
        if (!person?.registrationDate || !exitDate) return false;
        return exitDate < person.registrationDate;
    }, [person, exitDate]);

    const filteredShelters = useMemo(() => {
        if (!targetOrgId || !allShelters) return [];
        return allShelters.filter(s => s.organizationId === targetOrgId);
    }, [targetOrgId, allShelters]);

    const handleConfirm = () => {
        if (person) onExit(person, reason, destination, exitDate, targetOrgId, targetShelterId);
        onOpenChange(false);
    };

    useEffect(() => {
        if (!isOpen) {
            setReason('home');
            setDestination('');
            setTargetOrgId('');
            setTargetShelterId('');
            setExitDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('admin.displacedPersons.cardView.exitTitle')} {person?.name}</DialogTitle>
                    <DialogDescription>
                        {t('admin.displacedPersons.cardView.exitDesc')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.cardView.exitDate') || "Date of Exit"}</Label>
                        <Input 
                            type="date" 
                            value={exitDate} 
                            onChange={(e) => setExitDate(e.target.value)}
                            className={cn(isInvalidDate && "border-red-500 focus-visible:ring-red-500")}
                        />
                        {isInvalidDate && (
                            <p className="text-xs text-red-500">
                                {t('admin.displacedPersons.cardView.exitDateError') || `Exit date cannot be before registration date (${person?.registrationDate})`}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>{t('admin.displacedPersons.cardView.exitReason')}</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="home">{t('admin.displacedPersons.cardView.exitReasons.home')}</SelectItem>
                                <SelectItem value="transfer">{t('admin.displacedPersons.cardView.exitReasons.transfer')}</SelectItem>
                                <SelectItem value="other">{t('admin.displacedPersons.cardView.exitReasons.other')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {reason === 'transfer' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('admin.displacedPersons.cardView.selectTargetOrg')}</Label>
                                <Select value={targetOrgId} onValueChange={(v) => { setTargetOrgId(v); setTargetShelterId(''); }}>
                                    <SelectTrigger><SelectValue placeholder={t('admin.displacedPersons.form.chooseOrganization')} /></SelectTrigger>
                                    <SelectContent>
                                        {(organizations || []).map(org => (
                                            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.displacedPersons.cardView.selectTargetShelter')}</Label>
                                <Select value={targetShelterId} onValueChange={setTargetShelterId} disabled={!targetOrgId}>
                                    <SelectTrigger><SelectValue placeholder={t('admin.displacedPersons.assignShelter.chooseShelter')} /></SelectTrigger>
                                    <SelectContent>
                                        {filteredShelters.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.displacedPersons.cardView.destination')} ({t('admin.displacedPersons.form.otherDetails')})</Label>
                                <Input
                                    placeholder="e.g. Additional notes..."
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('admin.displacedPersons.form.cancel')}</Button>
                    <Button onClick={handleConfirm} disabled={isInvalidDate}>{t('admin.displacedPersons.cardView.exitShelter')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function DisplacedPersonsPage() {
    const { t } = useTranslation();
    const { persons: displacedPersons, shelters, loading, permissionError, fetchData, adminProfile, organizations } = useAdminData();
    const isSuperAdmin = adminProfile?.role?.toLowerCase().includes('super');
    const isFederalGov = adminProfile?.role?.toLowerCase().includes('federal');
    const isStateGov = adminProfile?.role?.toLowerCase().includes('state') && adminProfile?.role?.toLowerCase().includes('government');
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
    const createAccounts = httpsCallable(functions, 'createDisplacedPersonAccounts');
    const sendOnboardingSMS = httpsCallable(functions, 'sendOnboardingSMS');
    const [creationSummary, setCreationSummary] = useState<{ created: number, skipped: any[], errors: any[] } | null>(null);
    const [creatingAccounts, setCreatingAccounts] = useState(false);
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [orgFilter, setOrgFilter] = useState('all');
    const [shelterFilter, setShelterFilter] = useState('all');
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
        const isOrgAdmin = !!adminProfile?.organizationId && adminProfile?.organizationId !== 'all' && !isSuperAdmin && !isFederalGov;

        return displacedPersons.filter(person => {
            // Hide Homebound and Resettled from the default 'all' view to keep the active list clean
            const isInactive = person.status === 'Homebound' || person.status === 'Resettled';
            const hideInactive = statusFilter === 'all' && isInactive;
            if (hideInactive) return false;

            const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                person.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (person.shortId || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'all' || person.status.toLowerCase() === statusFilter.toLowerCase();
            
            // If org admin and filter is 'all', only show people currently in their org
            const matchesOrg = orgFilter === 'all' 
                ? (isOrgAdmin ? person.organizationId === adminProfile?.organizationId : true)
                : person.organizationId === orgFilter;
                
            const matchesShelter = shelterFilter === 'all' || person.assignedShelterId === shelterFilter || person.plannedShelterId === shelterFilter;

            return matchesSearch && matchesStatus && matchesOrg && matchesShelter;
        });
    }, [displacedPersons, searchQuery, statusFilter, orgFilter, shelterFilter, adminProfile, isSuperAdmin, isFederalGov]);

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
                    if (accountRes.status === 'created' || accountRes.status === 'skipped') {
                        if (accountRes.status === 'created') createdCount++;
                        if (accountRes.status === 'skipped') skipped.push({ name: person.name, phone: person.phone, reason: accountRes.reason });
                        
                        // Trigger Welcome SMS
                        console.log("[SMS-Batch] Triggering for:", person.phone);
                        sendOnboardingSMS({ 
                            phone: accountRes.mobile || person.phone, 
                            uid: accountRes.uid,
                            mobileNumber: accountRes.mobileNumber,
                            isNewUser: accountRes.status === 'created',
                            authMethod: accountRes.authMethod
                        }).catch(e => console.error("Batch SMS failed", e));

                        return { ...person, userId: accountRes.uid };
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
                    shortId: person.shortId || generateShortId(),
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
                            const updates: any = { 
                                userId: accountRes.uid, 
                                lastUpdate: new Date().toLocaleString() 
                            };
                            if (!person.shortId) updates.shortId = generateShortId();
                            
                            batchWrite.update(docRef, updates);
                            batchUpdatedCount++;

                            // Trigger SMS
                            console.log("[SMS-Link] Triggering for:", person.phone);
                            sendOnboardingSMS({ 
                                phone: accountRes.mobile || person.phone, 
                                uid: accountRes.uid,
                                mobileNumber: accountRes.mobileNumber,
                                isNewUser: accountRes.status === 'created',
                                authMethod: accountRes.authMethod
                            }).catch(e => console.error("Link SMS failed", e));

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

    const handleDelete = async (person: DisplacedPerson) => {
        if (window.confirm(`${t('admin.displacedPersons.actions.deleteConfirm') || "Are you sure you want to delete"} ${person.name}?`)) {
            try {
                if (person.assignedShelterId) {
                    await runTransaction(db, async (transaction) => {
                        const shelterRef = doc(db, "shelters", person.assignedShelterId!);
                        const shelterSnap = await transaction.get(shelterRef);
                        if (shelterSnap.exists()) {
                            const sData = shelterSnap.data();
                            const roomId = person.allocatedResources?.roomId;
                            const roomName = person.allocatedResources?.roomName;
                            let updatedRooms = sData.rooms || [];
                            if (roomId || roomName) {
                                updatedRooms = updatedRooms.map((r: any) => {
                                    if ((roomId && r.id === roomId) || (roomName && r.name === roomName)) {
                                        return { ...r, available: Math.min((r.available || 0) + 1, r.capacity || 999) };
                                    }
                                    return r;
                                });
                            }
                            transaction.update(shelterRef, {
                                availableCapacity: Math.min((sData.availableCapacity || 0) + 1, sData.capacity || 999),
                                rooms: updatedRooms
                            });
                        }
                        transaction.delete(doc(db, "displacedPersons", person.id));
                    });
                } else {
                    await deleteDoc(doc(db, "displacedPersons", person.id));
                }
                toast({
                    title: t('admin.displacedPersons.actions.deleted') || "Beneficiary Deleted",
                    description: `${person.name} has been removed from the system.`,
                });
                fetchData();
            } catch (error) {
                console.error("Delete error:", error);
                toast({
                    title: "Error",
                    description: t('admin.displacedPersons.actions.deleteError') || "Failed to delete beneficiary.",
                    variant: "destructive"
                });
            }
        }
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
            performedBy: t('admin.displacedPersons.logActivity.adminRole'),
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

    const handleOnboardSubmit = (p: DisplacedPerson) => {
        setSelectedPerson(p);
        setIsAssignDialogOpen(true);
    };

    const handleExitShelter = async (p: DisplacedPerson, reason: string, destination: string, exitDate: string, targetOrgId?: string, targetShelterId?: string) => {
        const isTransfer = reason === 'transfer';
        const newStatus = reason === 'home' ? 'Homebound' : isTransfer ? 'Moving to Shelter' : 'Needs Assistance';
        
        const targetOrg = targetOrgId ? organizations?.find(o => o.id === targetOrgId) : null;
        
        const movement: MovementRecord = {
            date: exitDate,
            action: isTransfer ? 'Transfer' : 'Exit',
            shelterId: p.assignedShelterId,
            notes: `Exit Reason: ${reason}. ${destination ? `Notes: ${destination}` : ''}`,
            performedBy: adminProfile?.firstName ? `${adminProfile.firstName} ${adminProfile.lastName || ''}` : "Administrator",
            destination: targetOrgId ? `Transfer to ${targetOrg?.name}` : destination
        };

        const updatedHistory = [...(p.movements || []), movement];

        try {
            await runTransaction(db, async (transaction) => {
                const personRef = doc(db, "displacedPersons", p.id);
                
                // 1. Manage Capacity if person was in a shelter
                const personDoc = await transaction.get(personRef);
                if (!personDoc.exists()) throw "Person record not found!";
                const personData = personDoc.data();
                
                if (personData.assignedShelterId) {
                    const shelterRef = doc(db, "shelters", personData.assignedShelterId);
                    const shelterDoc = await transaction.get(shelterRef);
                    
                    if (shelterDoc.exists()) {
                        const shelterData = shelterDoc.data();
                        const roomId = personData.allocatedResources?.roomId;
                        const roomName = personData.allocatedResources?.roomName;
                        
                        let updatedRooms = shelterData.rooms || [];
                        let roomUpdated = false;

                        if (roomId || roomName) {
                            updatedRooms = updatedRooms.map((r: any) => {
                                // Match by ID first, then fallback to Name
                                const isMatch = (roomId && r.id === roomId) || (roomName && r.name === roomName);
                                if (isMatch && !roomUpdated) {
                                    roomUpdated = true;
                                    // Ensure we don't exceed capacity
                                    const newAvailable = Math.min((r.available || 0) + 1, r.capacity || 999);
                                    return { ...r, available: newAvailable };
                                }
                                return r;
                            });
                        }
                        
                        transaction.update(shelterRef, {
                            availableCapacity: Math.min((shelterData.availableCapacity || 0) + 1, shelterData.capacity || 999),
                            rooms: updatedRooms
                        });
                    }
                }

                // 2. Update Person record
                const currentOrgs = typeof personData.associatedOrgs === 'object' && Array.isArray(personData.associatedOrgs) ? personData.associatedOrgs : [];
                const serviceOrgIds = (personData.services || []).filter((s: any) => s.enabled && s.providerOrgId).map((s: any) => s.providerOrgId as string);
                let newAssocOrgs = Array.from(new Set([...currentOrgs, personData.organizationId, adminProfile?.organizationId, ...serviceOrgIds].filter(Boolean)));
                
                const updateData: any = {
                    status: newStatus,
                    assignedShelterId: deleteField(),
                    allocatedResources: deleteField(),
                    movements: updatedHistory,
                    lastUpdate: new Date().toLocaleString()
                };

                if (isTransfer && targetOrgId) {
                    updateData.organizationId = targetOrgId;
                    updateData.organizationName = targetOrg?.name || '';
                    updateData.plannedShelterId = targetShelterId || '';
                    updateData.needsOnboarding = true;
                    newAssocOrgs = Array.from(new Set([...newAssocOrgs, targetOrgId].filter(Boolean)));
                }
                
                updateData.associatedOrgs = newAssocOrgs;
                
                transaction.update(personRef, updateData);
            });

            toast({ 
                title: isTransfer ? "Transfer Initiated" : "Exit Recorded", 
                description: isTransfer ? `Beneficiary transferred to ${targetOrg?.name}` : "Beneficiary has been exited from the shelter." 
            });
            fetchData();
        } catch (error) {
            console.error("Exit Transaction Error:", error);
            toast({ 
                title: "Error", 
                description: "Failed to record exit. Please try again.",
                variant: "destructive"
            });
        }
    };

    const handleUnlink = async (p: DisplacedPerson) => {
        if (!window.confirm(t('admin.displacedPersons.form.unlinkConfirm') || "Are you sure you want to unlink this beneficiary? They will be released from your organization and marked as Homebound.")) return;
        
        try {
            if (p.assignedShelterId) {
                await runTransaction(db, async (transaction) => {
                    const shelterRef = doc(db, "shelters", p.assignedShelterId!);
                    const shelterSnap = await transaction.get(shelterRef);
                    
                    if (shelterSnap.exists()) {
                        const sData = shelterSnap.data();
                        const roomId = p.allocatedResources?.roomId;
                        const roomName = p.allocatedResources?.roomName;
                        let updatedRooms = sData.rooms || [];
                        
                        if (roomId || roomName) {
                            updatedRooms = updatedRooms.map((r: any) => {
                                if ((roomId && r.id === roomId) || (roomName && r.name === roomName)) {
                                    return { ...r, available: Math.min((r.available || 0) + 1, r.capacity || 999) };
                                }
                                return r;
                            });
                        }
                        
                        transaction.update(shelterRef, {
                            availableCapacity: Math.min((sData.availableCapacity || 0) + 1, sData.capacity || 999),
                            rooms: updatedRooms
                        });
                    }

                    const personRef = doc(db, "displacedPersons", p.id);
                    const movement: MovementRecord = {
                        date: new Date().toLocaleString(),
                        action: 'Status Change',
                        notes: `Unlinked/Released from ${adminProfile?.organizationId}`,
                        performedBy: adminProfile?.firstName ? `${adminProfile.firstName} ${adminProfile.lastName || ''}` : t('admin.displacedPersons.logActivity.adminRole')
                    };
                    const updatedHistory = [...(p.movements || []), movement];
                    
                    transaction.update(personRef, {
                        status: 'Homebound',
                        organizationId: deleteField(),
                        organizationName: deleteField(),
                        assignedShelterId: deleteField(),
                        plannedShelterId: deleteField(),
                        allocatedResources: deleteField(),
                        movements: updatedHistory,
                        lastUpdate: new Date().toLocaleString()
                    });
                });
            } else {
                const personRef = doc(db, "displacedPersons", p.id);
                const movement: MovementRecord = {
                    date: new Date().toLocaleString(),
                    action: 'Status Change',
                    notes: `Unlinked/Released from ${adminProfile?.organizationId}`,
                    performedBy: adminProfile?.firstName ? `${adminProfile.firstName} ${adminProfile.lastName || ''}` : t('admin.displacedPersons.logActivity.adminRole')
                };
                const updatedHistory = [...(p.movements || []), movement];
                
                await updateDoc(personRef, {
                    status: 'Homebound',
                    organizationId: deleteField(),
                    organizationName: deleteField(),
                    assignedShelterId: deleteField(),
                    plannedShelterId: deleteField(),
                    allocatedResources: deleteField(),
                    movements: updatedHistory,
                    lastUpdate: new Date().toLocaleString()
                });
            }
            
            toast({ title: "Success", description: "Beneficiary unlinked successfully." });
            fetchData();
        } catch (error) {
            console.error("Error unlinking beneficiary:", error);
            toast({ title: "Error", description: "Could not unlink beneficiary.", variant: "destructive" });
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
        // Stats calculation - filtered by visibility rules for the current admin
    const activeSummaryPersons = useMemo(() => {
        if (!displacedPersons) return [];
        const isOrgAdmin = !!adminProfile?.organizationId && adminProfile?.organizationId !== 'all' && !isSuperAdmin && !isFederalGov;
        
        return displacedPersons.filter(p => {
            // Summary cards on the main page reflect the ACTIVE population (hide Homebound and Resettled)
            if (p.status === 'Homebound' || p.status === 'Resettled') return false;
            
            // If org admin, only count those currently in my org on the main dashboard
            if (isOrgAdmin && p.organizationId !== adminProfile?.organizationId) return false;
            
            return true;
        });
    }, [displacedPersons, adminProfile, isSuperAdmin, isFederalGov]);

    const totalTracked = activeSummaryPersons.length;
    const safeCount = activeSummaryPersons.filter(p => p.status === 'Safe').length;
    const eligibleCount = activeSummaryPersons.filter(p => p.status === 'Eligible for Shelter').length;
    const assistanceCount = activeSummaryPersons.filter(p => p.status === 'Needs Assistance' || p.status === 'Re-onboarded').length;
    const emergencyCount = activeSummaryPersons.filter(p => p.status === 'Emergency').length;

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
                adminProfile={adminProfile}
                organizations={organizations}
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
                                    <TableHead className="w-16">{t('admin.displacedPersons.import.table.no')}</TableHead>
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
                    <Button 
                        variant="outline" 
                        className="w-full sm:w-auto border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => navigate("/admin/displaced-persons/journey")}
                    >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        {t('admin.displacedPersons.journey.analyticsButton') || "Analytics & Journey"}
                    </Button>
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
                        <SelectItem value="re-onboarded">{t('admin.displacedPersons.statusEnum.reonboarded')}</SelectItem>
                    </SelectContent>
                </Select>

                {(isSuperAdmin || isFederalGov || isStateGov) && (
                    <>
                        <Select value={orgFilter} onValueChange={(val) => { setOrgFilter(val); setShelterFilter('all'); }}>
                            <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10">
                                <SelectValue placeholder="All Organizations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Organizations</SelectItem>
                                {organizations?.map(org => (
                                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={shelterFilter} onValueChange={setShelterFilter}>
                            <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10">
                                <SelectValue placeholder="All Shelters" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Shelters</SelectItem>
                                {shelters?.filter(s => orgFilter === 'all' || s.organizationId === orgFilter).map(shelter => (
                                    <SelectItem key={shelter.id} value={shelter.id}>{shelter.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </>
                )}

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
                        
                        const org = organizations?.find(o => o.id === person.organizationId);
                        const shelter = shelters?.find(s => s.id === (person.assignedShelterId || person.plannedShelterId));
                        
                        return (
                            <Card key={person.id} className={cn("transition-shadow hover:shadow-lg max-w-[90vw] sm:max-w-full overflow-hidden", statusInfo.cardClass)}>
                                <div className="flex h-full">
                                    {shelter?.imageUrl && (
                                        <div className="w-24 sm:w-32 flex-shrink-0 bg-slate-200 border-r relative group">
                                            <img src={shelter.imageUrl} alt={shelter.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                            <div className="absolute bottom-2 left-2 text-[8px] sm:text-[10px] text-white font-medium truncate w-[calc(100%-1rem)]">
                                                {shelter.name}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <CardContent className="p-2 sm:p-4 space-y-2 sm:space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    {org?.logoUrl && (
                                                        <div className="h-8 w-8 rounded bg-white shadow-sm border p-0.5 flex-shrink-0">
                                                            <img src={org.logoUrl} alt={org.name} className="h-full w-full object-contain" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold truncate">{person.name}</p>
                                                            {person.needsOnboarding && (
                                                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[9px] animate-pulse whitespace-nowrap">
                                                                    {t('admin.displacedPersons.cardView.incomingTransfer')}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{person.id} &middot; {person.details === 'Head of family' ? t('admin.displacedPersons.cardView.headOfFamily') : person.details}</p>
                                                        {person.shortId && <p className="text-[10px] font-bold text-slate-700">Unique ID: {person.shortId}</p>}
                                                        {org && <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">{org.name}</p>}
                                                        {person.householdHeadName && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md w-fit mt-1">
                                                                <Users className="h-3 w-3" />
                                                                <span>{t('admin.displacedPersons.cardView.linkedTo') || "Linked to"}: {person.householdHeadName}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge variant={statusInfo.badgeVariant} className="flex gap-1.5 items-center whitespace-nowrap">
                                                    {statusInfo.icon} {statusInfo.display}
                                                </Badge>
                                            </div>
                                            <div className="flex gap-2 pb-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50"
                                            onClick={() => handleCall(person.phone || '')}
                                            title={t('admin.displacedPersons.actions.call')}
                                            disabled={!person.phone}
                                        >
                                            <Phone className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50"
                                            onClick={() => handleSMS(person.phone || '')}
                                            title={t('admin.displacedPersons.actions.sms')}
                                            disabled={!person.phone}
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-green-200 text-green-600 hover:bg-green-50"
                                            onClick={() => handleWhatsApp(person.phone || '')}
                                            title={t('admin.displacedPersons.actions.whatsapp')}
                                            disabled={!person.phone}
                                        >
                                            <MessageCircle className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-orange-200 text-orange-600 hover:bg-orange-50"
                                            onClick={() => handleChat(person.userId)}
                                            title={t('admin.displacedPersons.actions.inAppChat')}
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full border-purple-200 text-purple-600 hover:bg-purple-50"
                                            onClick={() => handleNavigate(person)}
                                            title={t('admin.displacedPersons.actions.navigate')}
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
                                            {person.movements && person.movements.length > 0 ? (
                                                <ScrollArea className="max-h-32 mb-2">
                                                    <div className="space-y-3 pr-2 pt-1">
                                                        {(person.movements ?? []).slice().reverse().map((mv, idx) => (
                                                            <div key={idx} className="relative pl-3 border-l-2 border-slate-200 ml-1">
                                                                <div className={cn("absolute -left-[5px] top-1 h-2 w-2 rounded-full", mv.action === 'Entry' ? "bg-green-500" : mv.action === 'Exit' ? "bg-red-500" : "bg-blue-500")} />
                                                                <div className="flex flex-col">
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="font-semibold text-[10px] leading-tight text-slate-800">{mv.action} {mv.shelterName ? `@ ${mv.shelterName}` : ''}</span>
                                                                        <span className="text-[9px] text-slate-400 whitespace-nowrap ml-2">{mv.date.split(',')[0]}</span>
                                                                    </div>
                                                                    {mv.notes && <p className="text-[10px] text-slate-500 mt-0.5 leading-tight italic">{mv.notes}</p>}
                                                                    {mv.destination && <p className="text-[9px] text-blue-600 font-medium">→ {mv.destination}</p>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground italic mb-2">{t('admin.displacedPersons.cardView.noHistory')}</p>
                                            )}

                                            <div className="flex items-center justify-between pt-2 border-t">
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
                                        {person.isHouseholdHead && (
                                            <div className="mt-4 p-3 border rounded-lg bg-orange-50/20 border-orange-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> {t('admin.displacedPersons.cardView.householdMembers') || "Linked Household Members"}
                                                    </p>
                                                    <Badge variant="outline" className="text-[9px] bg-orange-100/50 text-orange-700 border-orange-200">
                                                        {t('common.members', { count: (displacedPersons?.filter(p => p.householdHeadId === person.id) || []).length })}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {(displacedPersons?.filter(p => p.householdHeadId === person.id) || []).length > 0 ? (
                                                        (displacedPersons?.filter(p => p.householdHeadId === person.id) || []).map(member => (
                                                            <div key={member.id} className="flex items-center justify-between text-[11px] p-1.5 bg-white rounded border border-orange-100">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">
                                                                        {member.name.charAt(0)}
                                                                    </div>
                                                                    <span className="font-medium">{member.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-muted-foreground italic">
                                                                        {member.assignedShelterId ? 
                                                                            (shelters?.find(s => s.id === member.assignedShelterId)?.name || "Assigned") : 
                                                                            (t('admin.displacedPersons.statusEnum.' + member.status.toLowerCase().replace(/ /g, '')) || member.status)
                                                                        }
                                                                    </span>
                                                                    <Badge className={cn("text-[8px] h-4 px-1", getStatusInfo(member.status, t).badgeVariant)}>
                                                                        {member.status}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-[10px] text-muted-foreground italic">{t('admin.displacedPersons.cardView.noMembersLinked') || "No members linked yet."}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
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
                                            <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleDelete(person)}>
                                                <Trash2 className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.cardView.delete') || "Delete"}
                                            </Button>
                                            {person.status === 'Safe' ? (
                                                <div className="flex gap-1">
                                                    <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50" onClick={() => { setSelectedPerson(person); setIsExitDialogOpen(true); }}>
                                                        <RefreshCw className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.cardView.exitShelter')}
                                                    </Button>
                                                </div>
                                            ) : (person.status as any) === 'Homebound' || (person.status as any) === 'Resettled' ? (
                                                <Button size="sm" variant="outline" className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => handleOnboardSubmit(person)}>
                                                    <RefreshCw className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.cardView.onboard')}
                                                </Button>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="bg-blue-600 hover:bg-blue-700 h-8"
                                                        onClick={() => handleOpenAssignDialog(person)}
                                                        disabled={(person.status as any) === 'Resettled' || (person.status as any) === 'Homebound'}
                                                    >
                                                        <BedDouble className="mr-2 h-3 w-3" /> {t('admin.displacedPersons.cardView.assignTransitSpace') || t('admin.displacedPersons.cardView.assignShelter')}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 border-red-200 text-red-700 hover:bg-red-50"
                                                        onClick={() => handleUnlink(person)}
                                                    >
                                                        <XCircle className="mr-1 h-3 w-3" /> {t('admin.displacedPersons.form.unlink')}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <Badge className={cn(getPriorityColor(person.priority), "font-semibold text-[10px] sm:text-xs")}>{displayPriority}</Badge>
                                    </div>
                                        </CardContent>
                                    </div>
                                </div>
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

            <ExitShelterDialog
                person={selectedPerson}
                isOpen={isExitDialogOpen}
                onOpenChange={setIsExitDialogOpen}
                onExit={handleExitShelter}
                organizations={organizations}
                allShelters={shelters}
            />
        </div>
    )
}
