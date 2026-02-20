import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { isPointInState, isAddressInState } from '@/lib/nigeria-geography';
import { db } from '@/lib/firebase';
import { Shelter, DisplacedPerson } from '@/lib/data';

// Define the shape of our aggregated state data
export interface StateData {
    name: string;
    displacedCount: number;
    shelterCount: number;
    totalCapacity: number;
    occupiedCapacity: number;
    criticalAlerts: number;
    coordinates: { x: number; y: number }; // Approximate SVG coordinates
    riskLevel: 'high' | 'medium' | 'low';
}

// Global KPIs shape
export interface SituationKPIs {
    totalDisplaced: number;
    occupancyRate: number;
    activeAlerts: number;
    availableCapacity: number;
    trendDisplaced: number; // Mock trend for now
    trendOccupancy: number;
}

// Recent Activity Feed Item
export interface ActivityItem {
    id: string;
    type: 'alert' | 'displacement' | 'capacity';
    title: string;
    description: string;
    location: string;
    coordinates?: { latitude: number; longitude: number };
    time: string;
    severity: 'critical' | 'warning' | 'info';
    timestamp: any; // for sorting
    status?: string;
}

// Approximate coordinates for key/representative states on our high-fidelity map
// These map to the SVG coordinate space (0-800 width, 0-650 height)
const STATE_COORDINATES: Record<string, { x: number; y: number }> = {
    // North West
    'Sokoto': { x: 173, y: 74 },
    'Kebbi': { x: 130, y: 140 },
    'Zamfara': { x: 215, y: 118 },
    'Katsina': { x: 326, y: 105 },
    'Kano': { x: 363, y: 147 },
    'Jigawa': { x: 415, y: 121 },
    'Kaduna': { x: 296, y: 229 },

    // North East
    'Yobe': { x: 521, y: 120 },
    'Borno': { x: 650, y: 127 },
    'Bauchi': { x: 447, y: 182 },
    'Gombe': { x: 531, y: 216 },
    'Adamawa': { x: 612, y: 295 },
    'Taraba': { x: 488, y: 366 },

    // North Central
    'Niger': { x: 173, y: 259 },
    'Kwara': { x: 112, y: 303 },
    'Kogi': { x: 245, y: 392 },
    'Abuja': { x: 280, y: 314 }, // FCT
    'Nasarawa': { x: 348, y: 334 },
    'Plateau': { x: 429, y: 285 },
    'Benue': { x: 374, y: 413 },

    // South West
    'Oyo': { x: 59, y: 362 },
    'Osun': { x: 117, y: 398 },
    'Ekiti': { x: 167, y: 389 },
    'Ondo': { x: 157, y: 443 },
    'Ogun': { x: 60, y: 422 },
    'Lagos': { x: 54, y: 460 },

    // South East
    'Enugu': { x: 292, y: 461 },
    'Ebonyi': { x: 329, y: 478 },
    'Anambra': { x: 268, y: 478 },
    'Abia': { x: 303, y: 529 },
    'Imo': { x: 269, y: 521 },

    // South South
    'Edo': { x: 197, y: 452 },
    'Delta': { x: 199, y: 507 },
    'Bayelsa': { x: 239, y: 574 },
    'Rivers': { x: 270, y: 558 },
    'Akwa Ibom': { x: 297, y: 563 },
    'Cross River': { x: 372, y: 506 },
};

export const useSituationData = (filterState?: string) => {
    const [stateData, setStateData] = useState<StateData[]>([]);
    const [kpis, setKpis] = useState<SituationKPIs>({
        totalDisplaced: 0,
        occupancyRate: 0,
        activeAlerts: 0,
        availableCapacity: 0,
        trendDisplaced: 120,
        trendOccupancy: 5
    });
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [allAlerts, setAllAlerts] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);

        const sheltersQuery = filterState
            ? query(collection(db, 'shelters'), where('state', '==', filterState))
            : query(collection(db, 'shelters'));
        const personsQuery = filterState
            ? query(collection(db, 'displacedPersons'), where('state', '==', filterState))
            : query(collection(db, 'displacedPersons'));
        const alertsQuery = query(collection(db, 'sosAlerts'), orderBy('timestamp', 'desc'), limit(1000));

        const unsubscribeShelters = onSnapshot(sheltersQuery, (shelterSnap) => {
            const rawShelters = shelterSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shelter));
            processData(rawShelters, null, null);
        });

        const unsubscribePersons = onSnapshot(personsQuery, (personSnap) => {
            const rawPersons = personSnap.docs.map(d => ({ id: d.id, ...d.data() } as DisplacedPerson));
            processData(null, rawPersons, null);
        });

        const unsubscribeAlerts = onSnapshot(alertsQuery, (alertSnap) => {
            const rawAlerts = alertSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            processData(null, null, rawAlerts);
        });

        // Use local variables to build latest state and avoid stale closures in processing
        let latestShelters: Shelter[] = [];
        let latestPersons: DisplacedPerson[] = [];
        let latestAlerts: any[] = [];

        const processData = (s: Shelter[] | null, p: DisplacedPerson[] | null, a: any[] | null) => {
            if (s) latestShelters = s;
            if (p) latestPersons = p;
            if (a) latestAlerts = a;

            // Wait for initial load of all three? Or just process what we have?
            // To match original behavior we can start once alerts fire (the core anchor)
            if (latestAlerts.length === 0 && !a) return;

            const shelters = latestShelters;
            const persons = latestPersons;
            const rawAlerts = latestAlerts;

            // Filter alerts if state-bound
            const alerts = filterState
                ? rawAlerts.filter((a: any) => {
                    const lat = a.location?.latitude || a.location?.lat || a.location?._lat || 0;
                    const lng = a.location?.longitude || a.location?.lng || a.location?.long || a.location?._long || 0;
                    const address = (a.location?.address || '');
                    return isPointInState(lat, lng, filterState) || isAddressInState(address, filterState);
                })
                : rawAlerts;

            const activeAlertsCount = alerts.filter((a: any) => a.status === 'Active' || a.status === 'transmitting').length;

            // 1. Calculate Global KPIs
            const totalDisplaced = persons.length;
            const totalCapacity = shelters.reduce((sum, s) => sum + (s.capacity || 0), 0);
            const totalOccupied = shelters.reduce((sum, s) => sum + ((s.capacity || 0) - (s.availableCapacity || 0)), 0);
            const occupancyRate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
            const availableCapacity = totalCapacity - totalOccupied;

            setKpis({
                totalDisplaced,
                occupancyRate,
                activeAlerts: activeAlertsCount,
                availableCapacity,
                trendDisplaced: persons.length > 50 ? 12 : 0,
                trendOccupancy: 2
            });

            // 2. Process Recent Activity
            const allActivity: ActivityItem[] = [];

            // Use a Set to dedup by ID and a Map for content-based deduping (location signature + time window)
            const alertIds = new Set();
            const alertSignatures = new Map(); // signature -> timestamp

            alerts.forEach((alert: any) => {
                if (alertIds.has(alert.id)) return;
                alertIds.add(alert.id);

                // Content-based signature to handle "ghost" duplicates with different IDs
                const address = alert.location?.address || (alert.location?.latitude + ',' + alert.location?.longitude);
                const signature = `${address}|${alert.emergencyType || ''}`.toLowerCase();
                const alertTime = alert.timestamp?.seconds ? alert.timestamp.seconds * 1000 :
                    (alert.timestamp instanceof Date ? alert.timestamp.getTime() : new Date().getTime());

                // If we've seen this exact location/type within the last 5 seconds, ignore it
                if (alertSignatures.has(signature)) {
                    const lastTime = alertSignatures.get(signature);
                    if (Math.abs(alertTime - lastTime) < 5000) return;
                }
                alertSignatures.set(signature, alertTime);

                const isCritical = alert.status === 'Active' || alert.type === 'Critical';
                let lat = alert.location?.latitude || alert.location?.lat || alert.location?._lat;
                let lng = alert.location?.longitude || alert.location?.lng || alert.location?.long || alert.location?._long;

                const timestamp = alert.timestamp || alert.createdAt || new Date();
                const date = timestamp?.seconds ? new Date(timestamp.seconds * 1000) :
                    (timestamp instanceof Date ? timestamp : new Date());

                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                allActivity.push({
                    id: alert.id,
                    type: 'alert',
                    title: isCritical ? 'Critical SOS Alert' : 'Emergency Signal',
                    description: alert.details || alert.additionalInfo || `Alert signal received from ${alert.userType || 'Unknown Source'}`,
                    location: alert.location?.address || 'Unknown Location',
                    coordinates: (lat && lng) ? { latitude: lat, longitude: lng } : undefined,
                    time: `${dateStr} ${timeStr}`,
                    severity: isCritical ? 'critical' : 'warning',
                    timestamp: timestamp,
                    status: alert.status
                });
            });

            // Sort by timestamp desc
            allActivity.sort((a, b) => {
                const timeA = a.timestamp?.seconds ? new Date(a.timestamp.seconds * 1000).getTime() :
                    (a.timestamp instanceof Date ? a.timestamp.getTime() : new Date().getTime());
                const timeB = b.timestamp?.seconds ? new Date(b.timestamp.seconds * 1000).getTime() :
                    (b.timestamp instanceof Date ? b.timestamp.getTime() : new Date().getTime());
                return timeB - timeA;
            });

            setRecentActivity(allActivity.slice(0, 20));
            setAllAlerts(allActivity.filter(a => a.type === 'alert'));

            // 3. Aggregate by State
            const stateMap: Record<string, StateData> = {};

            // Initialize map with known coordinates
            Object.entries(STATE_COORDINATES).forEach(([state, coords]) => {
                stateMap[state] = {
                    name: state,
                    displacedCount: 0,
                    shelterCount: 0,
                    totalCapacity: 0,
                    occupiedCapacity: 0,
                    criticalAlerts: 0,
                    coordinates: coords,
                    riskLevel: 'low'
                };
            });

            // Distribute Shelters
            shelters.forEach(s => {
                const address = s.location || '';
                let foundState = Object.keys(STATE_COORDINATES).find(stateName => isAddressInState(address, stateName));
                if (isAddressInState(address, 'Abuja')) foundState = 'Abuja';
                if (!foundState) foundState = 'Abuja';

                if (stateMap[foundState]) {
                    stateMap[foundState].shelterCount++;
                    stateMap[foundState].totalCapacity += s.capacity || 0;
                    stateMap[foundState].occupiedCapacity += ((s.capacity || 0) - (s.availableCapacity || 0));
                }
            });

            // Distribute Persons
            persons.forEach(p => {
                const address = p.currentLocation || '';
                let foundState = Object.keys(STATE_COORDINATES).find(stateName => isAddressInState(address, stateName));
                if (isAddressInState(address, 'Abuja')) foundState = 'Abuja';
                if (!foundState) foundState = 'Abuja';

                if (stateMap[foundState]) {
                    stateMap[foundState].displacedCount++;
                }
            });

            // Distribute Alerts to States for Risk Calculation
            // Use a local set for this specific aggregation run
            const aggregationIds = new Set();
            const aggregationSignatures = new Set();

            alerts.forEach((a: any) => {
                if (aggregationIds.has(a.id)) return;
                aggregationIds.add(a.id);

                const signature = `${a.location?.address || (a.location?.latitude + ',' + a.location?.longitude)}|${a.emergencyType || ''}`.toLowerCase();
                if (aggregationSignatures.has(signature)) return;
                aggregationSignatures.add(signature);

                const lat = a.location?.latitude || a.location?.lat || a.location?._lat || 0;
                const lng = a.location?.longitude || a.location?.lng || a.location?.long || a.location?._long || 0;
                const address = (a.location?.address || '');

                let foundState = Object.keys(STATE_COORDINATES).find(stateName => isAddressInState(address, stateName));
                if (!foundState) {
                    foundState = Object.keys(STATE_COORDINATES).find(stateName => isPointInState(lat, lng, stateName));
                }
                if (isPointInState(lat, lng, 'Abuja') || isAddressInState(address, 'Abuja')) {
                    foundState = 'Abuja';
                }

                if (foundState && stateMap[foundState] && (a.status === 'Active' || a.status === 'transmitting')) {
                    stateMap[foundState].criticalAlerts++;
                }
            });

            // Calculate Risk Levels
            Object.values(stateMap).forEach(state => {
                const occRate = state.totalCapacity > 0 ? (state.occupiedCapacity / state.totalCapacity) : 0;
                if (occRate > 0.8 || state.displacedCount > 100 || state.criticalAlerts > 0) {
                    state.riskLevel = 'high';
                } else if (occRate > 0.5 || state.displacedCount > 50) {
                    state.riskLevel = 'medium';
                } else {
                    state.riskLevel = 'low';
                }
            });

            setStateData(Object.values(stateMap));
            setLoading(false);
        };

        return () => {
            unsubscribeShelters();
            unsubscribePersons();
            unsubscribeAlerts();
        };
    }, [filterState]);

    return { kpis, stateData, recentActivity, allAlerts, loading };
};
