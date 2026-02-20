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
    loading: boolean;
    permissionError: boolean;
    adminProfile: { role: string; state?: string; firstName?: string; lastName?: string; image?: string } | null;
    activeAlerts: SosAlert[] | null;
    isAudioUnlocked: boolean;
    unlockAudio: () => void;
    clearAlert: (alertId: string) => void;
    markSosAsSeen: (alertId: string) => Promise<void>;
    fetchData: () => void;
    fetchLocationHistoryRange: (driverId: string, startDate: Date, endDate: Date) => Promise<any[]>;
    exportData: (dataType: 'alerts' | 'persons' | 'shelters' | 'drivers' | 'vehicles' | 'users' | 'ussd') => void;
    locationHistory: Record<string, any[]>; // Dictionary of driverId -> history array
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

export function AdminDataProvider({ children, profile }: { children: ReactNode, profile: { role: string; state?: string; firstName?: string; lastName?: string; image?: string } | null }) {
    const [alerts, setAlerts] = useState<SosAlert[] | null>(null);
    const [persons, setPersons] = useState<DisplacedPerson[] | null>(null);
    const [shelters, setShelters] = useState<Shelter[] | null>(null);
    const [drivers, setDrivers] = useState<Driver[] | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
    const [users, setUsers] = useState<AdminUser[] | null>(null);
    const [ussdCodes, setUssdCodes] = useState<UssdCode[] | null>(null);
    const [activeAlerts, setActiveAlerts] = useState<SosAlert[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [permissionError, setPermissionError] = useState(false);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const [locationHistory, setLocationHistory] = useState<Record<string, any[]>>({});
    const { toast } = useToast();

    // Siren audio setup - using a more robust siren sound
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
        // Request browser notification permissions
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }

        if (!profile) return;

        // ... rest of existing listener setup ...

        setLoading(true);
        setPermissionError(false);
        console.log("AdminDataProvider: Setting up listeners for role:", profile.role);

        const role = profile.role?.trim() || '';
        const isSuperAdmin = role.toLowerCase().includes('super');
        const isStateAdmin = (role === 'Admin' || role === 'admin' || role === 'support agent') && profile.state;
        const adminState = profile.state || '';

        // Helper to handle coordinate/address filtering
        const filterAlerts = (items: any[]) => {
            if (!isStateAdmin || isSuperAdmin) return items;
            return items.filter(alert => {
                const lat = alert.location?.latitude || 0;
                const lng = alert.location?.longitude || 0;
                const address = (alert.location?.address || '');
                return isPointInState(lat, lng, adminState) || isAddressInState(address, adminState);
            });
        };


        // 1. Listen for SOS Alerts
        const qAlerts = query(collection(db, "sosAlerts"), orderBy("timestamp", "desc"), limit(200));
        const unsubAlerts = onSnapshot(qAlerts, (snap) => {
            const raw = snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp
                } as SosAlert;
            });

            // Deduplicate by ID
            const seen = new Set();
            const deduped = raw.filter(a => {
                if (seen.has(a.id)) return false;
                seen.add(a.id);
                return true;
            });

            const filtered = filterAlerts(deduped);

            // Check for new unread alerts to trigger siren
            const unread = filtered.filter(a => {
                const isUnread = !a.readByAdmin && (isSuperAdmin ? !a.readBySuperAdmin : true);
                return a.status === 'Active' && isUnread;
            });

            if (unread.length > 0) {
                if (isAudioUnlocked && siren && siren.paused) {
                    siren.play().catch(e => console.error("Siren play failed:", e));
                }

                // Active alerts Ref for comparison
                const isNewAlert = unread.some(a => !activeAlertsRef.current?.find(existing => existing.id === a.id));

                if (isNewAlert) {
                    unread.forEach(a => {
                        const isSpecificNew = !activeAlertsRef.current?.find(existing => existing.id === a.id);
                        if (isSpecificNew && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                            new Notification("🚨 CRITICAL SOS ALERT", {
                                body: `Type: ${a.emergencyType || 'Unknown'}\nLocation: ${a.location?.address || 'Geolocation'}`,
                                icon: "/hopeline_red.png",
                                tag: a.id,
                                requireInteraction: true
                            });

                            toast({
                                title: "CRITICAL ALERT",
                                description: `${a.emergencyType} reported at ${a.location?.address || 'Geolocation'}`,
                                variant: "destructive"
                            });
                        }
                    });
                }

                activeAlertsRef.current = unread;
                setActiveAlerts(unread);
            } else {
                activeAlertsRef.current = null;
                setActiveAlerts(null);
                if (siren) {
                    siren.pause();
                    siren.currentTime = 0;
                }
            }

            alertsRef.current = filtered;
            setAlerts(filtered);
            setLoading(false);
        }, (err) => {
            console.error("SOS Alerts Listener Error:", err);
            if (err.code === 'permission-denied') setPermissionError(true);
        });

        // 2. Displaced Persons
        const qPersons = isSuperAdmin ? collection(db, "displacedPersons") :
            (isStateAdmin ? query(collection(db, "displacedPersons"), where("state", "==", adminState)) : collection(db, "displacedPersons"));
        const unsubPersons = onSnapshot(qPersons, (snap) => {
            setPersons(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    lastUpdate: data.lastUpdate
                } as DisplacedPerson;
            }));
        }, (err) => {
            console.error("Displaced Persons Listener Error:", err);
        });

        // 3. Shelters
        const qShelters = isSuperAdmin ? collection(db, "shelters") :
            (isStateAdmin ? query(collection(db, "shelters"), where("state", "==", adminState)) : collection(db, "shelters"));
        const unsubShelters = onSnapshot(qShelters, (snap) => {
            setShelters(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    lastUpdate: data.lastUpdate
                } as Shelter;
            }));
        }, (err) => {
            console.error("Shelters Listener Error:", err);
        });

        // 4. Drivers
        const qDrivers = query(collection(db, "users"), where("role", "in", ["driver", "pilot", "responder", "rider"]),
            ...(isSuperAdmin ? [] : (isStateAdmin ? [where("state", "==", adminState)] : [])));
        const unsubDrivers = onSnapshot(qDrivers, (snap) => {
            setDrivers(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    lastUpdate: data.lastUpdate
                } as Driver;
            }));
        }, (err) => {
            console.error("Drivers (Users) Listener Error:", err);
        });

        // 5. Vehicles
        const qVehicles = isSuperAdmin ? collection(db, "vehicles") :
            (isStateAdmin ? query(collection(db, "vehicles"), where("state", "==", adminState)) : collection(db, "vehicles"));
        const unsubVehicles = onSnapshot(qVehicles, (snap) => {
            setVehicles(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                } as Vehicle;
            }));
        }, (err) => {
            console.error("Vehicles Listener Error:", err);
        });

        // 6. Users
        const qUsers = query(collection(db, "users"),
            ...(isSuperAdmin ? [] : (isStateAdmin ? [where("state", "==", adminState)] : [])));
        const unsubUsers = onSnapshot(qUsers, (snap) => {
            setUsers(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt
                } as AdminUser;
            }));
        }, (err) => {
            console.error("Users Listener Error:", err);
        });

        // 7. USSD Codes
        const qUssd = isSuperAdmin ? collection(db, "ussdCodes") :
            (isStateAdmin ? query(collection(db, "ussdCodes"), where("state", "==", adminState)) : collection(db, "ussdCodes"));
        const unsubUssd = onSnapshot(qUssd, (snap) => {
            setUssdCodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UssdCode)));
        }, (err) => {
            console.error("USSD Codes Listener Error:", err);
        });

        // 8. Fetch Location History
        console.log("AdminDataProvider: Setting up location history collection group listener");
        const qHistory = query(collectionGroup(db, 'locationHistory'),
            orderBy('timestamp', 'desc'),
            limit(1000));

        const unsubHistory = onSnapshot(qHistory, (snapshot) => {
            const newHistory: Record<string, any[]> = {};
            snapshot.docs.forEach(doc => {
                const driverId = doc.ref.parent.parent?.id;
                if (!driverId) return;

                if (!newHistory[driverId]) {
                    newHistory[driverId] = [];
                }

                if (newHistory[driverId].length < 100) {
                    const data = doc.data();
                    if (data.latitude && data.longitude) {
                        newHistory[driverId].push({
                            ...data,
                            id: doc.id,
                            timestamp: data.timestamp,
                            sortTime: data.timestampMs || (data.timestamp?.toMillis?.()) || (data.timestamp?.seconds * 1000) || 0
                        });
                    }
                }
            });

            Object.keys(newHistory).forEach(key => {
                newHistory[key].sort((a, b) => a.sortTime - b.sortTime);
            });

            setLocationHistory(newHistory);
        }, (err) => {
            console.error("Location History Listener Error:", err);
            if (err.message?.includes('index')) {
                toast({
                    title: "Optimization Required",
                    description: "Moving trails require a Firestore index. Check logs for the creation link.",
                    variant: "default"
                });
            }
        });

        return () => {
            unsubAlerts();
            unsubPersons();
            unsubShelters();
            unsubDrivers();
            unsubVehicles();
            unsubUsers();
            unsubUssd();
            unsubHistory();
        };
    }, [profile, isAudioUnlocked, siren]); // Added isAudioUnlocked to re-trigger play if unlocked while alerts active

    const unlockAudio = useCallback(() => {
        if (siren) {
            // Play a silent or very short sound to unlock
            siren.play().then(() => {
                siren.pause();
                siren.currentTime = 0;
                setIsAudioUnlocked(true);
                console.log("Audio unlocked successfully");
            }).catch(e => {
                console.error("Audio unlock failed:", e);
            });
        } else {
            setIsAudioUnlocked(true);
        }
    }, [siren]);

    const markSosAsSeen = useCallback(async (alertId: string) => {
        if (!profile) return;
        const role = profile.role?.toLowerCase() || '';
        const isSuperAdmin = role.includes('super');

        try {
            const { doc, updateDoc } = await import('firebase/firestore');
            const alertRef = doc(db, "sosAlerts", alertId);
            await updateDoc(alertRef, {
                [isSuperAdmin ? 'readBySuperAdmin' : 'readByAdmin']: true
            });
            console.log(`SOS Alert ${alertId} marked as seen for ${isSuperAdmin ? 'SuperAdmin' : 'Admin'}`);
        } catch (error) {
            console.error("Error marking SOS as seen:", error);
        }
    }, [profile]);

    const clearAlert = useCallback((alertId: string) => {
        setActiveAlerts(prev => prev ? prev.filter(a => a.id !== alertId) : null);
        markSosAsSeen(alertId);
    }, [markSosAsSeen]);

    // Keep fetchData for manual refreshes if needed, though onSnapshot handles most cases
    const fetchData = useCallback(async () => {
        // This is now largely handled by onSnapshot, but we can keep it as a no-op or trigger a reload
        console.log("Manual refresh triggered");
    }, []);

    const exportData = (dataType: 'alerts' | 'persons' | 'shelters' | 'drivers' | 'vehicles' | 'users' | 'ussd') => {
        const dataMap = {
            alerts: { data: alerts, filename: 'sos_alerts_report.csv' },
            persons: { data: persons, filename: 'displaced_persons_report.csv' },
            shelters: { data: shelters, filename: 'shelters_report.csv' },
            drivers: { data: drivers, filename: 'drivers_report.csv' },
            vehicles: { data: vehicles, filename: 'vehicles_report.csv' },
            users: { data: users, filename: 'users_report.csv' },
            ussd: { data: ussdCodes, filename: 'ussd_codes_report.csv' },
        };

        const { data, filename } = dataMap[dataType];
        if (!data || data.length === 0) {
            toast({ title: "No Data", description: `There is no data to export for ${dataType}.` });
            return;
        }

        // Normalize nested data for CSV export
        const normalizedData = data.map(item => {
            const flatItem: { [key: string]: any } = {};
            for (const key in item) {
                // @ts-ignore
                const value = item[key];
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // For Firestore Timestamps
                    if ('toDate' in value && typeof value.toDate === 'function') {
                        flatItem[key] = value.toDate().toISOString();
                    } else {
                        // For other objects like location
                        Object.entries(value).forEach(([subKey, subValue]) => {
                            flatItem[`${key}_${subKey} `] = subValue;
                        });
                    }
                } else if (Array.isArray(value)) {
                    flatItem[key] = value.join('; '); // Join arrays into a string
                }
                else {
                    flatItem[key] = value;
                }
            }
            return flatItem;
        });

        exportToCsv(normalizedData, filename);
        toast({ title: "Export Started", description: `The ${filename} file is being downloaded.` });
    };

    const fetchLocationHistoryRange = async (driverId: string, startDate: Date, endDate: Date) => {
        try {
            console.log(`AdminDataProvider: Fetching history for driver ${driverId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
            const q = query(
                collection(db, 'users', driverId, 'locationHistory'),
                where('timestamp', '>=', Timestamp.fromDate(startDate)),
                where('timestamp', '<=', Timestamp.fromDate(endDate)),
                orderBy('timestamp', 'asc')
            );

            const snapshot = await getDocs(q);
            const history = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    timestamp: data.timestamp,
                    sortTime: data.timestampMs || (data.timestamp?.toMillis?.()) || 0
                };
            });

            console.log(`AdminDataProvider: Fetched ${history.length} history points for simulation`);
            return history;
        } catch (error) {
            console.error("Error fetching location history range:", error);
            toast({
                title: "Fetch Error",
                description: "Could not retrieve historical data for the selected range.",
                variant: "destructive"
            });
            return [];
        }
    };

    const value = {
        alerts,
        persons,
        shelters,
        drivers,
        vehicles,
        users,
        ussdCodes,
        loading,
        permissionError,
        adminProfile: profile,
        activeAlerts,
        isAudioUnlocked,
        unlockAudio,
        clearAlert,
        markSosAsSeen,
        fetchData,
        fetchLocationHistoryRange,
        exportData,
        locationHistory
    };

    return (
        <AdminDataContext.Provider value={value}>
            {children}
        </AdminDataContext.Provider>
    );
}

export function useAdminData() {
    const context = useContext(AdminDataContext);
    if (context === undefined) {
        throw new Error('useAdminData must be used within a AdminDataProvider');
    }
    return context;
}
