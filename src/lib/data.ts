
export type Shelter = {
    id: string;
    name: string;
    location: string;
    capacity: number;
    availableCapacity: number;
    organization: string;
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
      // Location streaming data
      locationAccuracy?: number;
      locationTimestamp?: number;
      trackingStatus?: 'active' | 'inactive' | 'error' | 'offline';
      gpsStatus?: 'good' | 'weak' | 'lost' | 'unknown';
      signalStrength?: number;
      isOffline?: boolean;
   };
  
  export type DisplacedPerson = {
      id: string;
      name: string;
      details: string;
      userId?: string;
      status: 'Moving to Shelter' | 'Needs Assistance' | 'Emergency' | 'Safe';
      currentLocation: string;
      destination?: string;
      vulnerabilities: string[];
      medicalNeeds?: string[];
      assistanceRequested: string;
      lastUpdate: string;
      priority: 'Low Priority' | 'Medium Priority' | 'High Priority';
      assignedShelterId?: string;
      allocatedResources?: {
          bedNumber?: string;
          mattress?: boolean;
          foodPack?: boolean;
          hygieneKit?: boolean;
      }
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
      mobile: number;
      profileCompleted: number;
      language?: string;
      // Location streaming data
      latitude?: number;
      longitude?: number;
      locationAccuracy?: number;
      locationTimestamp?: number;
      trackingStatus?: 'active' | 'inactive' | 'error';
      lastUpdate?: any; // Firestore timestamp
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
      profileCompleted: number;
      language?: string;
      createdAt?: any;
      isOnline?: boolean;
      uid?: string;
  };
  
  export type UssdCode = {
      id: string;
      name: string;
      code: string;
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
      notes?: string;
      createdAt: string;
      updatedAt: string;
  };


  // Dummy data has been removed. Data will be fetched from Firestore.
  export const shelters: Shelter[] = [];
  export const drivers: Driver[] = [];
  export const displacedPersons: DisplacedPerson[] = [];
  export const vehicles: Vehicle[] = [];
  