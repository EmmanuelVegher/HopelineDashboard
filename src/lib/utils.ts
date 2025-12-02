
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate estimated arrival time in minutes
export function calculateETA(currentLat: number, currentLng: number, destinationLat: number, destinationLng: number, speedKmh: number = 30): string {
  const distance = calculateDistance(currentLat, currentLng, destinationLat, destinationLng);
  const timeHours = distance / speedKmh;
  const timeMinutes = Math.round(timeHours * 60);

  if (timeMinutes < 1) {
    return 'Less than 1 minute';
  } else if (timeMinutes === 1) {
    return '1 minute';
  } else if (timeMinutes < 60) {
    return `${timeMinutes} minutes`;
  } else {
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }
}


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    // Firebase Timestamps can be either on the server (Timestamp) or client (Date object after fetch)
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate().toLocaleString();
    }
    // Handle the object-like structure from onSnapshot
    if (typeof timestamp === 'object' && timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    if (timestamp.toDate && typeof timestamp.toDate === 'function') { // Check if it's a Firestore Timestamp-like object
        return timestamp.toDate().toLocaleString();
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString();
        }
    }
    return 'Invalid Date';
};
