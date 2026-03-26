
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return calculateDistance(lat1, lng1, lat2, lng2) * 1000;
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

  try {
    // 1. Handle Firebase Timestamp instances
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleString();
    }

    // 2. Handle object-like structures from raw Firestore data (onSnapshot)
    if (typeof timestamp === 'object' && timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }

    // 3. Handle object with toDate method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString();
    }

    // 4. Handle Date instances
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString();
    }

    // 5. Handle strings or numbers
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      
      // If native parsing works, use it
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }

      // Fallback: Manual parsing for DD/MM/YYYY which is common in some locales and fails native new Date()
      if (typeof timestamp === 'string' && timestamp.includes('/')) {
        const parts = timestamp.split('/');
        if (parts.length === 3) {
          // Assume DD/MM/YYYY
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1; // Month is 0-indexed
          const y = parseInt(parts[2], 10);
          const manualDate = new Date(y, m, d);
          if (!isNaN(manualDate.getTime())) {
            return manualDate.toLocaleString();
          }
        }
      }
    }

    return 'Invalid Date';
  } catch (error) {
    console.error("Date formatting error:", error, timestamp);
    return 'Invalid Date';
  }
};
