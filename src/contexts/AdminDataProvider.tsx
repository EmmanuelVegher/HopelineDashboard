"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, where, limit, collectionGroup, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { type SosAlert } from '@/ai/schemas/sos';
import { type DisplacedPerson, type Shelter, type Driver, type UssdCode, type AdminUser, type Vehicle } from '@/lib/data';
import { exportToCsv } from '@/lib/export-csv';
import { isPointInState, isAddressInState } from '@/lib/nigeria-geography';


interface AdminDataContextType {
    alerts: SosAlert[] | null;
    persons: DisplacedPerson[] | null;
    shelters: Shelter[] | null;
    drivers: Driver[] | null;
    vehicles: Vehicle[] | null;
    users: AdminUser[] | null;
    ussdCodes: UssdCode[] | null;
    organizations: { id: string; name: string; state?: string; states?: string[] }[] | null;
    loading: boolean;
    permissionError: boolean;
    adminProfile: { role: string; state?: string; firstName?: string; lastName?: string; image?: string; organizationId?: string } | null;
    activeAlerts: SosAlert[] | null;
    isAudioUnlocked: boolean;
    unlockAudio: () => void;
    clearAlert: (alertId: string) => void;
    markSosAsSeen: (alertId: string) => Promise<void>;
    fetchData: () => void;
    fetchLocationHistoryRange: (driverId: string, startDate: Date, endDate: Date) => Promise<any[]>;
    exportData: (dataType: 'alerts' | 'persons' | 'shelters' | 'drivers' | 'vehicles' | 'users' | 'ussd') => void;
    locationHistory: Record<string, any[]>;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

export interface AdminProfile {
    role: string;
    state?: string;
    firstName?: string;
    lastName?: string;
    image?: string;
    organizationId?: string;
}

export function AdminDataProvider({ children, profile }: { children: ReactNode, profile: AdminProfile | null }) {
    const [alerts, setAlerts] = useState<SosAlert[] | null>(null);
    const [persons, setPersons] = useState<DisplacedPerson[] | null>(null);
    const [shelters, setShelters] = useState<Shelter[] | null>(null);
    const [drivers, setDrivers] = useState<Driver[] | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
    const [users, setUsers] = useState<AdminUser[] | null>(null);
    const [ussdCodes, setUssdCodes] = useState<UssdCode[] | null>(null);
    const [organizations, setOrganizations] = useState<{ id: string; name: string; state?: string; states?: string[] }[] | null>(null);
    const [activeAlerts, setActiveAlerts] = useState<SosAlert[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [permissionError, setPermissionError] = useState(false);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const [locationHistory, setLocationHistory] = useState<Record<string, any[]>>({});
    const { toast } = useToast();

    const [siren] = useState<HTMLAudioElement | null>(() => {
        if (typeof Audio !== 'undefined') {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
            audio.loop = true;
            return audio;
        }
        return null;
    });

    const alertsRef = useRef<SosAlert[] | null>(null);
    const activeAlertsRef = useRef<SosAlert[] | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }

        if (!profile) return;

        setLoading(true);
        setPermissionError(false);

        const role = profile.role?.trim().toLowerCase() || '';
        const isSuperAdmin = role.includes('super');
        const isFederalGov = role.includes('federal');
        const isStateGov = role.includes('state') && role.includes('government');
        const isOrgAdmin = !!profile.organizationId && profile.organizationId !== 'all';
        const isGlobal = isSuperAdmin || isFederalGov;
        const adminState = profile.state || '';
        const orgId = profile.organizationId;

        const filterAlerts = (items: any[], activeStates: string[]) => {
            if (isGlobal) return items;
            return items.filter(alert => {
                const lat = alert.location?.latitude || 0;
                const lng = alert.location?.longitude || 0;
                const address = (alert.location?.address || '');

                if (isStateGov && adminState) {
                    return isPointInState(lat, lng, adminState) || isAddressInState(address, adminState);
                }
                if (isOrgAdmin && activeStates.length > 0) {
                    return activeStates.some(state => isPointInState(lat, lng, state) || isAddressInState(address, state));
                }
                if (adminState) {
                    return isPointInState(lat, lng, adminState) || isAddressInState(address, adminState);
                }
                return true;
            });
        };

        let unsubscribers: (() => void)[] = [];

        async function initListeners() {
            let activeOrgStates: string[] = [];
            if (isOrgAdmin && orgId) {
                try {
                    const sQuery = query(collection(db, "shelters"), where("organizationId", "==", orgId));
                    const sSnap = await getDocs(sQuery);
                    activeOrgStates = Array.from(new Set(sSnap.docs.map(doc => doc.data().state).filter(Boolean))) as string[];
                } catch (e) {
                    console.error("Org States Error:", e);
                }
            }

            const qAlerts = query(collection(db, "sosAlerts"), orderBy("timestamp", "desc"), limit(200));
            const unsubAlerts = onSnapshot(qAlerts, (snap) => {
                const raw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SosAlert));
                const seen = new Set();
                const deduped = raw.filter(a => {
                    if (seen.has(a.id)) return false;
                    seen.add(a.id);
                    return true;
                });

                const filtered = filterAlerts(deduped, activeOrgStates);
                const unread = filtered.filter(a => {
                    const isUnread = !a.readByAdmin && (isSuperAdmin ? !a.readBySuperAdmin : true);
                    return a.status === 'Active' && isUnread;
                });

                if (unread.length > 0) {
                    if (isAudioUnlocked && siren && siren.paused) {
                        siren.play().catch(() => { });
                    }
                    if (unread.some(a => !activeAlertsRef.current?.find(ex => ex.id === a.id))) {
                        unread.forEach(a => {
                            if (!activeAlertsRef.current?.find(ex => ex.id === a.id) && typeof window !== 'undefined' && Notification.permission === 'granted') {
                                new Notification("🚨 SOS ALERT", { body: `${a.emergencyType}: ${a.location?.address || 'Location'}`, icon: "/hopeline_red.png" });
                                toast({ title: "SOS ALERT", description: a.location?.address || 'New alert', variant: "destructive" });
                            }
                        });
                    }
                    setActiveAlerts(unread);
                    activeAlertsRef.current = unread;
                } else {
                    setActiveAlerts(null);
                    activeAlertsRef.current = null;
                    if (siren) { siren.pause(); siren.currentTime = 0; }
                }
                setAlerts(filtered);
                alertsRef.current = filtered;
                setLoading(false);
            }, (err) => {
                if (err.code === 'permission-denied') setPermissionError(true);
            });
            unsubscribers.push(unsubAlerts);

            const buildQuery = (collectionName: string, baseConstraints: any[] = []) => {
                if (isGlobal) return query(collection(db, collectionName), ...baseConstraints);
                const constraints = [...baseConstraints];
                if (isStateGov && adminState) return query(collection(db, collectionName), ...constraints, where("state", "==", adminState));
                if (isOrgAdmin && orgId) constraints.push(where("organizationId", "==", orgId));
                if (adminState) constraints.push(where("state", "==", adminState));
                return query(collection(db, collectionName), ...constraints);
            };

            unsubscribers.push(onSnapshot(buildQuery("displacedPersons"), (snap) => {
                setPersons(snap.docs.map(d => ({ id: d.id, ...d.data() } as DisplacedPerson)));
            }));
            unsubscribers.push(onSnapshot(buildQuery("shelters"), (snap) => {
                setShelters(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shelter)));
            }));
            unsubscribers.push(onSnapshot(buildQuery("users", [where("role", "in", ["driver", "pilot", "responder", "rider"])]), (snap) => {
                setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver)));
            }));
            unsubscribers.push(onSnapshot(buildQuery("vehicles"), (snap) => {
                setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
            }));
            unsubscribers.push(onSnapshot(buildQuery("users"), (snap) => {
                setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUser)));
            }));

            // Organizations listener with role-based filtering
            unsubscribers.push(onSnapshot(collection(db, "organizations"), (snap) => {
                let orgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; name: string; state?: string; states?: string[] }));

                if (isGlobal) {
                    // Show all
                } else if (isStateGov && adminState) {
                    orgs = orgs.filter(o => {
                        const cleanState = adminState.replace(/ State$/i, '').trim();
                        const orgStateLower = (o.state || '').toLowerCase();
                        const adminStateLower = adminState.toLowerCase();
                        const cleanStateLower = cleanState.toLowerCase();
                        // Include if explicitly matches state, 'All', ID matches state, OR included in org's coverage states array
                        return orgStateLower === adminStateLower ||
                            orgStateLower === cleanStateLower ||
                            orgStateLower === 'all' ||
                            o.id.toLowerCase().includes(cleanStateLower.replace(/\s+/g, '_')) ||
                            (o.states && Array.isArray(o.states) && o.states.map(s => s.toLowerCase()).some(s => s === adminStateLower || s === cleanStateLower));
                    });
                } else if (isOrgAdmin && orgId) {
                    orgs = orgs.filter(o => o.id === orgId);
                } else if (adminState) {
                    const cleanState = adminState.replace(/ State$/i, '').trim();
                    const adminStateLower = adminState.toLowerCase();
                    const cleanStateLower = cleanState.toLowerCase();
                    orgs = orgs.filter(o => {
                        const orgStateLower = (o.state || '').toLowerCase();
                        return orgStateLower === adminStateLower ||
                            orgStateLower === cleanStateLower ||
                            orgStateLower === 'all' ||
                            o.id.toLowerCase().includes(cleanStateLower.replace(/\s+/g, '_')) ||
                            (o.states && Array.isArray(o.states) && o.states.map(s => s.toLowerCase()).some(s => s === adminStateLower || s === cleanStateLower));
                    });
                }

                setOrganizations(orgs);
            }));

            // USSD Codes listener with jurisdictional filtering
            let qUssd;
            if (isGlobal) {
                qUssd = query(collection(db, "ussdCodes"));
            } else if (isStateGov && adminState) {
                qUssd = query(collection(db, "ussdCodes"), where("state", "in", [adminState, "All"]));
            } else if (isOrgAdmin && activeOrgStates.length > 0) {
                // If they have many states, this might hit Firestore "in" limits (max 30 usually, but older was 10)
                // Nigeria has 36 states. Let's use it up to the limit and filter more if needed, 
                // but usually orgs aren't in all 36.
                const statesToFilter = [...activeOrgStates.slice(0, 29), "All"];
                qUssd = query(collection(db, "ussdCodes"), where("state", "in", statesToFilter));
            } else if (adminState) {
                qUssd = query(collection(db, "ussdCodes"), where("state", "in", [adminState, "All"]));
            } else {
                qUssd = query(collection(db, "ussdCodes"), where("state", "==", "All"));
            }

            unsubscribers.push(onSnapshot(qUssd, (snap) => {
                const codes = snap.docs.map(d => ({ id: d.id, ...d.data() } as UssdCode));

                // Final client-side filter for Org Admins in more than 29 states (rare but possible)
                if (isOrgAdmin && activeOrgStates.length > 29) {
                    setUssdCodes(codes.filter(c => c.state === 'All' || activeOrgStates.includes(c.state || '')));
                } else {
                    setUssdCodes(codes);
                }
            }));

            const qHistory = query(collectionGroup(db, 'locationHistory'), orderBy('timestamp', 'desc'), limit(1000));
            unsubscribers.push(onSnapshot(qHistory, (snap) => {
                const hist: Record<string, any[]> = {};
                snap.docs.forEach(doc => {
                    const driverId = doc.ref.parent.parent?.id;
                    if (!driverId) return;
                    if (!hist[driverId]) hist[driverId] = [];
                    if (hist[driverId].length < 100) {
                        const data = doc.data();
                        if (data.latitude && data.longitude) {
                            hist[driverId].push({ ...data, id: doc.id, sortTime: data.timestampMs || (data.timestamp?.toMillis?.()) || (data.timestamp?.seconds * 1000) || 0 });
                        }
                    }
                });
                Object.keys(hist).forEach(k => hist[k].sort((a, b) => a.sortTime - b.sortTime));
                setLocationHistory(hist);
            }));
        }

        initListeners();

        return () => {
            unsubscribers.forEach(u => u());
        };
    }, [profile, isAudioUnlocked, siren, toast]);

    const unlockAudio = useCallback(() => {
        if (siren) {
            siren.play().then(() => { siren.pause(); siren.currentTime = 0; setIsAudioUnlocked(true); }).catch(() => setIsAudioUnlocked(true));
        } else setIsAudioUnlocked(true);
    }, [siren]);

    const markSosAsSeen = useCallback(async (alertId: string) => {
        if (!profile) return;
        const isSuperAdmin = profile.role?.toLowerCase().includes('super');
        try {
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, "sosAlerts", alertId), { [isSuperAdmin ? 'readBySuperAdmin' : 'readByAdmin']: true });
        } catch (e) {
            console.error("MarkSeen Error:", e);
        }
    }, [profile]);

    const clearAlert = useCallback((id: string) => {
        setActiveAlerts(p => p ? p.filter(a => a.id !== id) : null);
        markSosAsSeen(id);
    }, [markSosAsSeen]);

    const exportData = (type: string) => {
        const dataMap: any = { alerts, persons, shelters, drivers, vehicles, users, ussd: ussdCodes };
        const data = dataMap[type];
        if (!data || data.length === 0) return toast({ title: "No Data" });
        const normalized = data.map((item: any) => {
            const flat: any = {};
            for (const key in item) {
                const val = item[key];
                if (val && typeof val === 'object' && !Array.isArray(val) && 'toDate' in val) flat[key] = val.toDate().toISOString();
                else if (Array.isArray(val)) flat[key] = val.join('; ');
                else flat[key] = val;
            }
            return flat;
        });
        exportToCsv(normalized, `${type}_report.csv`);
    };

    const fetchLocationHistoryRange = async (driverId: string, start: Date, end: Date) => {
        try {
            const q = query(collection(db, 'users', driverId, 'locationHistory'), where('timestamp', '>=', Timestamp.fromDate(start)), where('timestamp', '<=', Timestamp.fromDate(end)), orderBy('timestamp', 'asc'));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ ...d.data(), id: d.id, sortTime: d.data().timestampMs || d.data().timestamp?.toMillis?.() || 0 }));
        } catch (e) {
            console.error("HistoryRange Error:", e);
            return [];
        }
    };

    return (
        <AdminDataContext.Provider value={{
            alerts, persons, shelters, drivers, vehicles, users, ussdCodes, organizations,
            loading, permissionError, adminProfile: profile, activeAlerts,
            isAudioUnlocked, unlockAudio, clearAlert, markSosAsSeen,
            fetchData: () => { }, fetchLocationHistoryRange, exportData: exportData as any, locationHistory
        }}>
            {children}
        </AdminDataContext.Provider>
    );
}

export function useAdminData() {
    const context = useContext(AdminDataContext);
    if (context === undefined) throw new Error('useAdminData error');
    return context;
}
