
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { type SosAlert } from '@/ai/schemas/sos';
import { type DisplacedPerson, type Shelter, type Driver, type UssdCode, type AdminUser, type Vehicle } from '@/lib/data';
import { exportToCsv } from '@/lib/export-csv';

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
    fetchData: () => void;
    exportData: (dataType: 'alerts' | 'persons' | 'shelters' | 'drivers' | 'vehicles' | 'users' | 'ussd') => void;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<SosAlert[] | null>(null);
  const [persons, setPersons] = useState<DisplacedPerson[] | null>(null);
  const [shelters, setShelters] = useState<Shelter[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [ussdCodes, setUssdCodes] = useState<UssdCode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPermissionError(false);
    console.log("AdminDataProvider: Starting fetchData, current user:", auth.currentUser ? auth.currentUser.uid : 'null');
    try {
        const [alertsSnap, personsSnap, sheltersSnap, driversSnap, vehiclesSnap, usersSnap, ussdSnap] = await Promise.all([
            getDocs(query(collection(db, "sosAlerts"), orderBy("timestamp", "desc"))),
            getDocs(collection(db, "displacedPersons")),
            getDocs(collection(db, "shelters")),
            getDocs(collection(db, "drivers")),
            getDocs(collection(db, "vehicles")),
            getDocs(collection(db, "users")),
            getDocs(collection(db, "ussdCodes"))
        ]);

        setAlerts(alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SosAlert)));
        setPersons(personsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DisplacedPerson)));
        setShelters(sheltersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shelter)));
        setDrivers(driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
        setVehicles(vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminUser)));
        setUssdCodes(ussdSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UssdCode)));

    } catch (error: any) {
        console.error("AdminDataProvider: Error fetching data:", error);
        console.error("AdminDataProvider: Error code:", error.code);
        console.error("AdminDataProvider: Error message:", error.message);
        console.error("AdminDataProvider: Current user at error:", auth.currentUser ? auth.currentUser.uid : 'null');
        if (error.code === 'permission-denied') {
            console.error("Firestore permission denied. Please check your security rules.");
            setPermissionError(true);
            toast({
                title: "Permission Denied",
                description: "You do not have permission to view all administrative data.",
                variant: "destructive"
            });
        } else {
            console.error("Error fetching admin data:", error);
            toast({ title: "Error", description: "Could not load all administrative data.", variant: "destructive" });
        }
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        toast({ title: "No Data", description: `There is no data to export for ${dataType}.`});
        return;
    }
    
    // Normalize nested data for CSV export
    const normalizedData = data.map(item => {
        const flatItem: {[key: string]: any} = {};
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
                        flatItem[`${key}_${subKey}`] = subValue;
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


  return (
    <AdminDataContext.Provider value={{ alerts, persons, shelters, drivers, vehicles, users, ussdCodes, loading, permissionError, fetchData, exportData }}>
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
