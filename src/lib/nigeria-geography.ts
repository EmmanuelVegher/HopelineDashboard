
/**
 * Approximate bounding boxes for Nigerian states and FCT.
 * Used for coordinate-based filtering of SOS alerts.
 */

export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

export const NIGERIA_STATE_BOUNDS: Record<string, BoundingBox> = {
    "Abia": { minLat: 4.67, maxLat: 6.02, minLng: 7.0, maxLng: 8.01 },
    "Adamawa": { minLat: 7.45, maxLat: 11.02, minLng: 11.13, maxLng: 14.15 },
    "Akwa Ibom": { minLat: 4.33, maxLat: 5.55, minLng: 7.3, maxLng: 8.35 },
    "Anambra": { minLat: 5.42, maxLat: 6.8, minLng: 6.6, maxLng: 7.37 },
    "Bauchi": { minLat: 9.38, maxLat: 13.0, minLng: 8.2, maxLng: 12.0 },
    "Bayelsa": { minLat: 4.15, maxLat: 5.38, minLng: 5.37, maxLng: 6.75 },
    "Benue": { minLat: 6.38, maxLat: 8.2, minLng: 7.76, maxLng: 10.0 },
    "Borno": { minLat: 10.15, maxLat: 13.88, minLng: 11.52, maxLng: 14.85 },
    "Cross River": { minLat: 4.45, maxLat: 7.02, minLng: 7.8, maxLng: 9.68 },
    "Delta": { minLat: 4.88, maxLat: 6.5, minLng: 5.0, maxLng: 6.75 },
    "Ebonyi": { minLat: 5.67, maxLat: 6.75, minLng: 7.5, maxLng: 8.5 },
    "Edo": { minLat: 5.75, maxLat: 7.6, minLng: 4.9, maxLng: 6.75 },
    "Ekiti": { minLat: 7.25, maxLat: 8.1, minLng: 4.7, maxLng: 5.75 },
    "Enugu": { minLat: 5.88, maxLat: 7.12, minLng: 6.8, maxLng: 7.75 },
    "Abuja": { minLat: 7.9, maxLat: 9.45, minLng: 6.4, maxLng: 7.85 }, // FCT
    "Gombe": { minLat: 9.25, maxLat: 11.45, minLng: 10.15, maxLng: 11.75 },
    "Imo": { minLat: 5.15, maxLat: 6.0, minLng: 6.6, maxLng: 7.5 },
    "Jigawa": { minLat: 11.0, maxLat: 13.15, minLng: 8.0, maxLng: 11.0 },
    "Kaduna": { minLat: 9.0, maxLat: 11.5, minLng: 6.1, maxLng: 9.0 },
    "Kano": { minLat: 10.5, maxLat: 12.5, minLng: 7.6, maxLng: 9.5 },
    "Katsina": { minLat: 11.1, maxLat: 13.3, minLng: 6.8, maxLng: 8.9 },
    "Kebbi": { minLat: 10.1, maxLat: 13.25, minLng: 3.5, maxLng: 6.1 },
    "Kogi": { minLat: 6.55, maxLat: 8.75, minLng: 5.3, maxLng: 7.9 },
    "Kwara": { minLat: 8.0, maxLat: 10.1, minLng: 2.7, maxLng: 6.1 },
    "Lagos": { minLat: 6.3, maxLat: 6.75, minLng: 3.0, maxLng: 4.5 },
    "Nasarawa": { minLat: 7.7, maxLat: 9.5, minLng: 6.8, maxLng: 9.5 },
    "Niger": { minLat: 8.15, maxLat: 11.4, minLng: 3.5, maxLng: 7.6 },
    "Ogun": { minLat: 6.2, maxLat: 7.9, minLng: 2.7, maxLng: 4.9 },
    "Ondo": { minLat: 5.75, maxLat: 8.5, minLng: 4.3, maxLng: 6.1 },
    "Osun": { minLat: 7.0, maxLat: 8.15, minLng: 4.0, maxLng: 5.1 },
    "Oyo": { minLat: 7.05, maxLat: 9.2, minLng: 2.6, maxLng: 4.6 },
    "Plateau": { minLat: 8.35, maxLat: 10.65, minLng: 8.5, maxLng: 10.65 },
    "Rivers": { minLat: 4.3, maxLat: 5.75, minLng: 6.35, maxLng: 7.6 },
    "Sokoto": { minLat: 11.5, maxLat: 13.9, minLng: 3.5, maxLng: 7.1 },
    "Taraba": { minLat: 6.4, maxLat: 9.5, minLng: 9.0, maxLng: 12.0 },
    "Yobe": { minLat: 11.0, maxLat: 13.5, minLng: 9.6, maxLng: 13.5 },
    "Zamfara": { minLat: 10.7, maxLat: 13.15, minLng: 5.1, maxLng: 7.1 }
};

export const NIGERIA_STATES = Object.keys(NIGERIA_STATE_BOUNDS).sort();

/**
 * Checks if a coordinate point is within a state's bounding box.
 */
export const isPointInState = (lat: number, lng: number, stateName: string): boolean => {
    if (!stateName) return false;

    // Normalize state name (handle FCT/Abuja mapping)
    let normalized = stateName;
    const lowerName = stateName.toLowerCase();
    if (lowerName.includes('abuja') || lowerName.includes('fct') || lowerName.includes('federal capital')) {
        normalized = 'Abuja';
    }

    const bounds = NIGERIA_STATE_BOUNDS[normalized];
    if (!bounds) return false;

    return (lat >= bounds.minLat && lat <= bounds.maxLat &&
        lng >= bounds.minLng && lng <= bounds.maxLng);
};

/**
 * Checks if an address string belongs to a state, handling common aliases.
 */
export const isAddressInState = (address: string, stateName: string): boolean => {
    if (!address || !stateName) return false;

    const lowerAddress = address.toLowerCase();
    const lowerState = stateName.toLowerCase();

    // Handle Abuja/FCT specifically
    if (lowerState.includes('abuja') || lowerState.includes('fct') || lowerState.includes('federal capital')) {
        return lowerAddress.includes('abuja') ||
            lowerAddress.includes('fct') ||
            lowerAddress.includes('federal capital');
    }

    // Use word boundaries to prevent substring matches (e.g., "Nigeria" matching "Niger")
    const regex = new RegExp(`\\b${lowerState}\\b`, 'i');
    return regex.test(lowerAddress);
};
