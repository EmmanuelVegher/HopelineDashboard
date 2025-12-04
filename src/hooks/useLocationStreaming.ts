import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGeolocation, GeolocationState } from './useGeolocation';
import { useNetworkStatus } from './useNetworkStatus';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  trackingStatus: 'active' | 'inactive' | 'error' | 'offline';
  lastUpdate: Date;
  gpsStatus?: 'good' | 'weak' | 'lost' | 'unknown';
  signalStrength?: number;
  isOffline?: boolean;
}

export type TrackingStatus = 'active' | 'inactive' | 'error' | 'offline';

export interface LocationStreamingOptions {
  userId: string;
  batchInterval?: number; // milliseconds
  minDistanceChange?: number; // meters
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface UseLocationStreamingReturn {
  state: Omit<GeolocationState, 'error'> & {
    isStreaming: boolean;
    lastUpdate: Date | null;
    error: string | null;
    cachedLocation?: LocationData;
  };
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  updateTrackingStatus: (status: TrackingStatus) => void;
  getCachedLocation: () => LocationData | null;
}

const DEFAULT_BATCH_INTERVAL = 10000; // 10 seconds
const DEFAULT_MIN_DISTANCE_CHANGE = 50; // 50 meters

export function useLocationStreaming(options: LocationStreamingOptions): UseLocationStreamingReturn {
  const {
    userId,
    batchInterval = DEFAULT_BATCH_INTERVAL,
    minDistanceChange = DEFAULT_MIN_DISTANCE_CHANGE,
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 300000,
  } = options;

  console.log('[useLocationStreaming] Hook initialized with options:', { userId, batchInterval, minDistanceChange, enableHighAccuracy, timeout, maximumAge });

  const geolocation = useGeolocation({
    enableHighAccuracy,
    timeout,
    maximumAge,
  });

  const networkStatus = useNetworkStatus();

  const [isStreaming, setIsStreaming] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('inactive');
  const [cachedLocation, setCachedLocation] = useState<LocationData | null>(null);

  console.log('[useLocationStreaming] Initial state:', { isStreaming, trackingStatus, streamingError });

  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<GeolocationPosition | null>(null);
  const pendingUpdateRef = useRef<Partial<LocationData> | null>(null);
  const reconnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRecreationCountRef = useRef(0);
  const currentGpsStatusRef = useRef(geolocation.state.gpsStatus);
  const currentSignalStrengthRef = useRef(geolocation.state.signalStrength);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }, []);

  // Batch update function with offline handling
  const batchUpdateLocation = useCallback(async (locationData: Partial<LocationData>) => {
    if (!userId) {
      console.log('[useLocationStreaming] No userId, skipping update');
      return;
    }

    // If offline, cache the update for when connection is restored
    if (!networkStatus.isOnline) {
      console.log('[useLocationStreaming] Offline: caching location update for later sync');
      // Store pending updates in localStorage
      try {
        const pendingUpdates = JSON.parse(localStorage.getItem(`pending_updates_${userId}`) || '[]');
        pendingUpdates.push({
          ...locationData,
          timestamp: Date.now(),
        });
        localStorage.setItem(`pending_updates_${userId}`, JSON.stringify(pendingUpdates));
        console.log(`[useLocationStreaming] Cached ${pendingUpdates.length} pending updates`);
      } catch (error) {
        console.warn('[useLocationStreaming] Failed to cache pending update:', error);
      }
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const updateData: any = {
        ...locationData,
        lastUpdate: serverTimestamp(),
      };

      // Remove null values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null) {
          delete updateData[key];
        }
      });

      console.log('[useLocationStreaming] Updating location in database:', updateData);
      await updateDoc(userRef, updateData);
      setLastUpdate(new Date());
      setStreamingError(null);
      console.log('[useLocationStreaming] Location updated successfully');

      // Try to sync any pending updates
      try {
        const pendingUpdates = JSON.parse(localStorage.getItem(`pending_updates_${userId}`) || '[]');
        if (pendingUpdates.length > 0) {
          console.log(`[useLocationStreaming] Syncing ${pendingUpdates.length} pending updates`);
          for (const update of pendingUpdates) {
            const syncData = { ...update };
            delete syncData.timestamp;
            await updateDoc(userRef, {
              ...syncData,
              lastUpdate: serverTimestamp(),
            });
          }
          localStorage.removeItem(`pending_updates_${userId}`);
          console.log('[useLocationStreaming] Pending updates synced successfully');
        }
      } catch (syncError) {
        console.warn('[useLocationStreaming] Failed to sync pending updates:', syncError);
      }
    } catch (error) {
      console.error('[useLocationStreaming] Error updating location:', error);
      setStreamingError('Failed to update location in database. Will retry when online.');
    }
  }, [userId, networkStatus.isOnline]);

  // Cache location for offline use
  const cacheLocation = useCallback((locationData: LocationData) => {
    setCachedLocation(locationData);
    // Also store in localStorage for persistence across sessions
    try {
      localStorage.setItem(`cached_location_${userId}`, JSON.stringify(locationData));
    } catch (error) {
      console.warn('Failed to cache location in localStorage:', error);
    }
  }, [userId]);

  // Get cached location
  const getCachedLocation = useCallback((): LocationData | null => {
    if (cachedLocation) return cachedLocation;

    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(`cached_location_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCachedLocation(parsed);
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load cached location from localStorage:', error);
    }

    return null;
  }, [cachedLocation, userId]);

  // Attempt automatic reconnection
  const attemptReconnection = useCallback(async () => {
    if (!isStreaming) return;

    try {
      console.log('Attempting GPS reconnection...');
      const permission = await geolocation.requestPermission();
      if (permission === 'granted') {
        geolocation.startWatching();
        setTrackingStatus('active');
        setStreamingError(null);
        console.log('GPS reconnection successful');
      } else {
        // Retry after delay
        reconnectionTimeoutRef.current = setTimeout(attemptReconnection, 30000); // 30 seconds
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
      reconnectionTimeoutRef.current = setTimeout(attemptReconnection, 30000);
    }
  }, [isStreaming, geolocation]);

  // Process location update with batching
  const processLocationUpdate = useCallback((position: GeolocationPosition) => {
    console.log('[useLocationStreaming] Processing location update:', {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      isStreaming,
      trackingStatus
    });

    const currentLocation: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      trackingStatus,
      lastUpdate: new Date(),
      gpsStatus: currentGpsStatusRef.current,
      signalStrength: currentSignalStrengthRef.current,
      isOffline: false,
    };

    // Cache the location
    cacheLocation(currentLocation);

    // Check if location changed significantly
    const shouldUpdateImmediately = !lastLocationRef.current ||
      calculateDistance(
        lastLocationRef.current.coords.latitude,
        lastLocationRef.current.coords.longitude,
        position.coords.latitude,
        position.coords.longitude
      ) >= minDistanceChange;

    console.log('[useLocationStreaming] Location change check:', {
      hasLastLocation: !!lastLocationRef.current,
      distance: lastLocationRef.current ? calculateDistance(
        lastLocationRef.current.coords.latitude,
        lastLocationRef.current.coords.longitude,
        position.coords.latitude,
        position.coords.longitude
      ) : null,
      minDistanceChange,
      shouldUpdateImmediately
    });

    if (shouldUpdateImmediately) {
      // Update immediately for significant location changes
      console.log('[useLocationStreaming] Updating location immediately');
      batchUpdateLocation(currentLocation);
      lastLocationRef.current = position;
      pendingUpdateRef.current = null;

      // Clear any pending batch update
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
    } else {
      // Batch the update
      console.log('[useLocationStreaming] Batching location update');
      pendingUpdateRef.current = currentLocation;

      if (!batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(() => {
          if (pendingUpdateRef.current) {
            console.log('[useLocationStreaming] Executing batched location update');
            batchUpdateLocation(pendingUpdateRef.current);
            lastLocationRef.current = position;
            pendingUpdateRef.current = null;
          }
          batchTimeoutRef.current = null;
        }, batchInterval);
      }
    }
  }, [trackingStatus, minDistanceChange, batchInterval, batchUpdateLocation, calculateDistance, isStreaming]);

  // Handle geolocation position updates
  useEffect(() => {
    console.log('[useLocationStreaming] Position update useEffect triggered:', {
      isStreaming,
      hasPosition: !!geolocation.state.position,
      trackingStatus,
      positionCoords: geolocation.state.position ? {
        lat: geolocation.state.position.coords.latitude,
        lng: geolocation.state.position.coords.longitude,
        accuracy: geolocation.state.position.coords.accuracy
      } : null
    });

    if (isStreaming && geolocation.state.position && trackingStatus === 'active') {
      console.log('[useLocationStreaming] Calling processLocationUpdate');
      processLocationUpdate(geolocation.state.position);
    } else {
      console.log('[useLocationStreaming] Skipping processLocationUpdate - conditions not met');
    }
  }, [isStreaming, geolocation.state.position, trackingStatus, processLocationUpdate]);

  // Handle geolocation errors and GPS status changes
  useEffect(() => {
    if (geolocation.state.error && isStreaming) {
      let errorMessage = 'Location tracking error occurred';
      let newStatus: TrackingStatus = 'error';

      if (geolocation.state.error.code === 1) {
        errorMessage = 'Location permission denied. Please enable location access.';
      } else if (geolocation.state.error.code === 2) {
        errorMessage = 'Location information is unavailable. Please check your GPS.';
      } else if (geolocation.state.error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      }

      setStreamingError(errorMessage);
      setTrackingStatus(newStatus);

      // Update database with error status
      batchUpdateLocation({
        trackingStatus: newStatus,
        lastUpdate: new Date(),
        gpsStatus: geolocation.state.gpsStatus,
        signalStrength: geolocation.state.signalStrength,
        isOffline: geolocation.state.isOffline,
      });

      // Attempt reconnection for certain errors
      if (geolocation.state.error.code === 2 || geolocation.state.error.code === 3) {
        if (!reconnectionTimeoutRef.current) {
          reconnectionTimeoutRef.current = setTimeout(attemptReconnection, 10000); // 10 seconds
        }
      }
    }
  }, [geolocation.state.error, geolocation.state.gpsStatus, geolocation.state.signalStrength, geolocation.state.isOffline, isStreaming, batchUpdateLocation, attemptReconnection]);

  // Handle GPS status and network changes
  useEffect(() => {
    console.log('[useLocationStreaming] GPS/Network status useEffect triggered:', {
      isStreaming,
      gpsStatus: geolocation.state.gpsStatus,
      isOffline: geolocation.state.isOffline,
      signalStrength: geolocation.state.signalStrength,
      networkIsOnline: networkStatus.isOnline,
      currentTrackingStatus: trackingStatus
    });

    if (isStreaming) {
      const isDeviceOffline = !networkStatus.isOnline || geolocation.state.isOffline;
      const hasGPSIssues = geolocation.state.gpsStatus === 'lost';

      console.log('[useLocationStreaming] GPS/Network status check:', {
        isOnline: networkStatus.isOnline,
        isDeviceOffline,
        gpsStatus: geolocation.state.gpsStatus,
        hasGPSIssues,
        currentTrackingStatus: trackingStatus
      });

      if (isDeviceOffline || hasGPSIssues) {
        console.log('[useLocationStreaming] Setting offline status:', isDeviceOffline ? 'network offline' : 'GPS lost');
        setTrackingStatus('offline');
        setStreamingError(isDeviceOffline ?
          'Device is offline. Location tracking will resume when connection is restored.' :
          'GPS signal lost. Using cached location data.'
        );

        // Update database with offline status
        const cached = getCachedLocation();
        if (cached) {
          console.log('[useLocationStreaming] Updating database with offline status');
          batchUpdateLocation({
            ...cached,
            trackingStatus: 'offline',
            gpsStatus: geolocation.state.gpsStatus,
            signalStrength: geolocation.state.signalStrength,
            isOffline: true,
            lastUpdate: new Date(),
          });
        }
      } else if (geolocation.state.gpsStatus === 'weak') {
        console.log('[useLocationStreaming] Weak GPS signal detected');
        setStreamingError('Weak GPS signal detected. Location accuracy may be reduced.');
        if (trackingStatus === 'offline') {
          setTrackingStatus('active');
        }
      } else if (geolocation.state.gpsStatus === 'good' && trackingStatus === 'offline') {
        console.log('[useLocationStreaming] GPS signal restored, resuming active tracking');
        setTrackingStatus('active');
        setStreamingError(null);
      }
    }
  }, [geolocation.state.gpsStatus, geolocation.state.isOffline, geolocation.state.signalStrength, networkStatus.isOnline, isStreaming, trackingStatus, batchUpdateLocation, getCachedLocation]);

  // Handle permission changes
  useEffect(() => {
    if (geolocation.state.permission === 'denied' && isStreaming) {
      setStreamingError('Location permission denied');
      setTrackingStatus('error');
      batchUpdateLocation({
        trackingStatus: 'error',
        lastUpdate: new Date(),
      });
    } else if (geolocation.state.permission === 'granted' && trackingStatus === 'error') {
      setStreamingError(null);
      setTrackingStatus('active');
    }
  }, [geolocation.state.permission, isStreaming, trackingStatus, batchUpdateLocation]);

  const startStreaming = useCallback(async () => {
    console.log('[useLocationStreaming] startStreaming called. Current state:', {
      isStreaming,
      trackingStatus,
      permission: geolocation.state.permission,
      hasPosition: !!geolocation.state.position
    });

    try {
      // Request permission if not granted
      if (geolocation.state.permission !== 'granted') {
        console.log('[useLocationStreaming] Requesting permission...');
        const permission = await geolocation.requestPermission();
        console.log('[useLocationStreaming] Permission result:', permission);
        if (permission !== 'granted') {
          throw new Error('Location permission required for streaming');
        }
      }

      // Start watching location
      console.log('[useLocationStreaming] Starting geolocation watching...');
      geolocation.startWatching();
      console.log('[useLocationStreaming] Setting streaming state to active');
      setIsStreaming(true);
      setTrackingStatus('active');
      setStreamingError(null);

      console.log('[useLocationStreaming] Location streaming started successfully');
    } catch (error) {
      console.error('[useLocationStreaming] Failed to start location streaming:', error);
      setStreamingError('Failed to start location streaming');
      setTrackingStatus('error');
    }
  }, [geolocation, isStreaming, trackingStatus]);

  const stopStreaming = useCallback(() => {
    geolocation.stopWatching();
    setIsStreaming(false);
    setTrackingStatus('inactive');

    // Clear any pending updates
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Clear reconnection timeout
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }

    // Final update with inactive status
    if (lastLocationRef.current) {
      batchUpdateLocation({
        latitude: lastLocationRef.current.coords.latitude,
        longitude: lastLocationRef.current.coords.longitude,
        accuracy: lastLocationRef.current.coords.accuracy,
        timestamp: lastLocationRef.current.timestamp,
        trackingStatus: 'inactive',
        lastUpdate: new Date(),
        gpsStatus: geolocation.state.gpsStatus,
        signalStrength: geolocation.state.signalStrength,
        isOffline: geolocation.state.isOffline,
      });
    }

    console.log('Location streaming stopped');
  }, [geolocation, batchUpdateLocation]);

  const updateTrackingStatus = useCallback((status: TrackingStatus) => {
    setTrackingStatus(status);
    if (status === 'inactive') {
      stopStreaming();
    }
  }, [stopStreaming]);

  // Update refs for current GPS status
  useEffect(() => {
    currentGpsStatusRef.current = geolocation.state.gpsStatus;
    currentSignalStrengthRef.current = geolocation.state.signalStrength;
  }, [geolocation.state.gpsStatus, geolocation.state.signalStrength]);

  // Initialize cached location on mount - only when needed
  // Removed automatic initialization to prevent blocking page loads
  // Cached location will be loaded when getCachedLocation() is explicitly called

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (reconnectionTimeoutRef.current) {
        clearTimeout(reconnectionTimeoutRef.current);
      }
    };
  }, []);

  return useMemo(() => ({
    state: {
      ...geolocation.state,
      isStreaming,
      lastUpdate,
      error: streamingError || (geolocation.state.error ? geolocation.state.error.message : null),
      cachedLocation: cachedLocation || undefined,
    },
    startStreaming,
    stopStreaming,
    updateTrackingStatus,
    getCachedLocation,
  }), [
    geolocation.state,
    isStreaming,
    lastUpdate,
    streamingError,
    cachedLocation,
    startStreaming,
    stopStreaming,
    updateTrackingStatus,
    getCachedLocation,
  ]);
}