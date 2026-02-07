import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
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

export const useSituationData = () => {
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);

        const sheltersQuery = query(collection(db, 'shelters'));
        const personsQuery = query(collection(db, 'displacedPersons'));
        const alertsQuery = query(collection(db, 'sosAlerts'));

        const unsubscribeShelters = onSnapshot(sheltersQuery, (shelterSnap) => {
            const shelters = shelterSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shelter));

            const unsubscribePersons = onSnapshot(personsQuery, (personSnap) => {
                const persons = personSnap.docs.map(d => ({ id: d.id, ...d.data() } as DisplacedPerson));

                const unsubscribeAlerts = onSnapshot(alertsQuery, (alertSnap) => {
                    const alerts = alertSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const activeAlertsCount = alerts.filter((a: any) => a.status === 'Active' || a.status === 'transmitting').length;

                    // --- Processing Data ---

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

                    // Add alerts to activity
                    alerts.forEach((alert: any) => {
                        const isCritical = alert.status === 'Active' || alert.type === 'Critical';

                        // Normalize coordinates (handle lat/lng, latitude/longitude, or GeoPoint)
                        let lat = alert.location?.latitude || alert.location?.lat || alert.location?._lat;
                        let lng = alert.location?.longitude || alert.location?.lng || alert.location?.long || alert.location?._long;

                        // Log for debugging
                        if (alert.status === 'Active') {
                            console.log(`[SOS Debug] Alert ${alert.id}:`, { original: alert.location, normalized: { lat, lng } });
                        }

                        allActivity.push({
                            id: alert.id,
                            type: 'alert',
                            title: isCritical ? 'Critical SOS Alert' : 'Emergency Signal',
                            description: alert.details || `Alert signal received from ${alert.userType || 'Unknown Source'}`,
                            location: alert.location?.address || 'Unknown Location',
                            coordinates: (lat && lng) ? { latitude: lat, longitude: lng } : undefined,
                            time: 'Just now',
                            severity: isCritical ? 'critical' : 'warning',
                            timestamp: alert.createdAt || new Date()
                        });
                    });

                    // Sort by timestamp desc
                    allActivity.sort((a, b) => {
                        const timeA = a.timestamp?.seconds ? new Date(a.timestamp.seconds * 1000).getTime() : new Date().getTime();
                        const timeB = b.timestamp?.seconds ? new Date(b.timestamp.seconds * 1000).getTime() : new Date().getTime();
                        return timeB - timeA;
                    });

                    setRecentActivity(allActivity.slice(0, 20));

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
                        let foundState = Object.keys(STATE_COORDINATES).find(state => s.location?.includes(state));
                        if (!foundState) foundState = 'Abuja';

                        if (stateMap[foundState]) {
                            stateMap[foundState].shelterCount++;
                            stateMap[foundState].totalCapacity += s.capacity || 0;
                            stateMap[foundState].occupiedCapacity += ((s.capacity || 0) - (s.availableCapacity || 0));
                        }
                    });

                    // Distribute Persons
                    persons.forEach(p => {
                        let foundState = Object.keys(STATE_COORDINATES).find(state => p.currentLocation?.includes(state));
                        if (!foundState) foundState = 'Abuja';

                        if (stateMap[foundState]) {
                            stateMap[foundState].displacedCount++;
                        }
                    });

                    // Distribute Alerts to States for Risk Calculation
                    alerts.forEach((a: any) => {
                        let foundState = Object.keys(STATE_COORDINATES).find(state => a.location?.address?.includes(state));
                        if (foundState && stateMap[foundState]) {
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
                });

                return () => unsubscribeAlerts();
            });
            return () => unsubscribePersons();
        });

        return () => {
            unsubscribeShelters();
        };
    }, []);

    return { kpis, stateData, recentActivity, activeAlerts: recentActivity.filter(a => a.type === 'alert'), loading };
};
