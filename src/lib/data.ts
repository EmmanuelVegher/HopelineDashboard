
export type Shelter = {
    id: string;
    name: string;
    location: string;
    capacity: number;
    availableCapacity: number;
    organization: string;
    organizationId?: string;
    facilities: string[];
    security: string;
    latitude: number;
    longitude: number;
    rating?: number;
    ratingCount?: number;
    timeAway?: string;
    distance?: string;
    securityLevel?: 'High Security' | 'Medium Security' | 'Low Security';
    status: 'Operational' | 'Full' | 'Emergency Only';
    requests: number;
    managerId?: string;
    managerName: string;
    trend: 'Increasing' | 'Decreasing' | 'Stable';
    lastUpdate: string;
    imageUrl?: string;
    phone: string;
    geofence?: { lat: number, lng: number }[];
    droneVideoUrl?: string;
    photoGallery?: string[];
    state?: string;
    kmlUrl?: string;
    rooms?: {
        id: string;
        name: string;
        capacity: number;
        available: number;
    }[];
};

export type Driver = {
    id: string;
    name: string;
    vehicle: string;
    status: 'Available' | 'En Route' | 'Assisting' | 'Emergency' | 'Off Duty';
    location: string;
    task: string;
    lastUpdate: string;
    phone: string;
    latitude: number;
    longitude: number;
    destinationLat?: number;
    destinationLng?: number;
    vehicleImageUrl?: string;
    email: string;
    vehicleDetails?: any;
    state?: string;
    // Location streaming data
    locationAccuracy?: number;
    locationTimestamp?: number;
    trackingStatus?: 'active' | 'inactive' | 'error' | 'offline';
    gpsStatus?: 'good' | 'weak' | 'lost' | 'unknown';
    signalStrength?: number;
    isOffline?: boolean;
    organizationId?: string;
    organizationName?: string;
};

export type MovementRecord = {
    date: string;
    action: 'Entry' | 'Exit' | 'Transfer' | 'Status Change' | 'Transfer / Re-onboard';
    shelterId?: string;
    shelterName?: string;
    notes?: string;
    performedBy: string;
    destination?: string;
};

export type BeneficiarySubService = {
    id: string;
    enabled: boolean;
};

export type BeneficiaryService = {
    id: string;
    category: string;
    name: string;
    description: string;
    enabled: boolean;
    providerOrgId?: string;
    providerOrgName?: string;
    subServices?: BeneficiarySubService[];
    updatedAt?: string;
};

export type DisplacedPerson = {
    id: string;
    name: string;
    phone?: string;
    details: string;
    userId?: string;
    status: 'Needs Assistance' | 'Moving to Shelter' | 'Emergency' | 'Eligible for Shelter' | 'Safe' | 'Resettled' | 'Homebound' | 'Re-onboarded';
    currentLocation: string;
    destination?: string;
    vulnerabilities: string[];
    medicalNeeds?: string[];
    assistanceRequested: string;
    lastUpdate: string;
    registrationDate?: string;
    priority: 'Low Priority' | 'Medium Priority' | 'High Priority';
    assignedShelterId?: string;
    organizationId?: string;
    organizationName?: string;
    plannedShelterId?: string;
    needsOnboarding?: boolean;
    movements?: MovementRecord[];
    allocatedResources?: {
        bedNumber?: string;
        bedsOccupied?: number;
        roomId?: string;
        roomName?: string;
        mattress?: boolean;
        foodPack?: boolean;
        hygieneKit?: boolean;
    };
    // New Shelter Assessment Fields
    householdLocationType?: 'Host community' | 'IDP camp' | 'Refugee';
    shelterCondition?: 'Rented accommodation' | 'Own house (damaged but habitable)' | 'Own house (safe and adequate)' | 'Staying with relatives or friends' | 'Homeless / living in open areas' | 'Makeshift or temporary shelter (tent, shack, uncompleted building)' | 'Camp shelter (formal IDP camp)' | string;
    displacementCause?: string;
    stayingLocation?: 'Host community' | 'IDP camp' | 'Open space' | 'Abandoned structure' | 'Others';
    householdComposition?: {
        total: number;
        adults: number;
        children: number;
        elderly: number;
        pwds: number;
    };
    isShelterSafe?: boolean;
    weatherProtection?: string[]; // Rain, Wind, Heat, Cold
    urgentShelterProblem?: string[]; // Leakage, Overcrowding, Lack of privacy, Unsafe structure
    receivedAssistance?: boolean;
    assistanceNeeded?: string[]; // Emergency shelter, Repairs, Relocation, Transitional shelter, NFIs;

    services?: BeneficiaryService[];

    surveyCompleted?: boolean;
    surveyId?: string;
    activityLog?: {
        date: string;
        action: string;
        performedBy: string;
        notes?: string;
    }[];
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    gender?: string;
    state?: string;
    shortId?: string;
    associatedOrgs?: string[];
    householdHeadId?: string;
    householdHeadName?: string;
    isHouseholdHead?: boolean;
}

export type UserProfile = {
    id: string;
    uid: string;
    email: string | null;
    role: 'user' | 'admin' | 'support agent' | 'driver' | 'pilot' | 'responder' | 'rider';
    createdAt?: Date;
    isOnline?: boolean;
    displayName: string;
    firstName: string;
    lastName: string;
    image: string;
    gender: string;
    mobile: string;
    profileCompleted: number;
    language?: string;
    state?: string;
    accountStatus?: string;
    availability?: 'online' | 'offline' | 'away' | string;
    location?: string;
    // Location streaming data
    latitude?: number;
    longitude?: number;
    locationAccuracy?: number;
    locationTimestamp?: number;
    trackingStatus?: 'active' | 'inactive' | 'error';
    lastUpdate?: any; // Firestore timestamp
    organizationId?: string;
    shortId?: string;
};

export type AdminUser = {
    id: string;
    email: string;
    role: string;
    accountStatus?: string;
    displayName: string;
    firstName: string;
    lastName: string;
    image: string;
    gender: string;
    mobile: string;
    phone?: string;
    profileCompleted: number;
    language?: string;
    createdAt?: any;
    isOnline?: boolean;
    uid?: string;
    state?: string;
    organizationId?: string;
    shortId?: string;
};

export type UssdCode = {
    id: string;
    name: string;
    code: string;
    state?: string;
};

export type Organization = {
    id: string;
    name: string;
    logoUrl: string;
    type: 'standard' | 'state' | 'federal';
    isGovernment: boolean;
    states?: string[];
    entityName?: string;
    updatedAt: any;
};

export type Vehicle = {
    id: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    status: 'Available' | 'In Use' | 'Maintenance' | 'Out of Service';
    type: 'Car' | 'Truck' | 'Ambulance' | 'Bus' | 'Motorcycle' | 'Other';
    capacity: number;
    imageUrl?: string;
    thumbnailUrl?: string;
    assignedDriverId?: string;
    assignedDriverName?: string;
    lastMaintenance?: string;
    nextMaintenance?: string;
    mileage?: number;
    fuelType?: string;
    color?: string;
    state?: string;
    organizationId?: string;
    organizationName?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
};


// Dummy data has been removed. Data will be fetched from Firestore.
export const shelters: Shelter[] = [];
export const drivers: Driver[] = [];
export const displacedPersons: DisplacedPerson[] = [];
export const vehicles: Vehicle[] = [];
