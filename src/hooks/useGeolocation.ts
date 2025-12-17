import { useState, useEffect, useCallback, useRef } from 'react';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'default';
export type GPSStatus = 'good' | 'weak' | 'lost' | 'unknown';

export interface GeolocationState {
  permission: PermissionState;
  position: GeolocationPosition | null;
  error: GeolocationPositionError | null;
  isWatching: boolean;
  isSupported: boolean;
  gpsStatus: GPSStatus;
  lastKnownPosition: GeolocationPosition | null;
  signalStrength: number; // 0-100, where 100 is excellent
  isOffline: boolean;
  lastSignalCheck: Date | null;
  trackingCoordinates: Array<{lat: number, lng: number, timestamp: number}>; // Stored coordinates during tracking
  isTracking: boolean; // Separate from isWatching for navigation tracking
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  signalCheckInterval?: number; // milliseconds to check signal strength
  weakSignalThreshold?: number; // accuracy in meters considered weak
  lostSignalThreshold?: number; // accuracy in meters considered lost
  offlineTimeout?: number; // milliseconds without position update to consider offline
  trackingInterval?: number; // milliseconds between coordinate storage during tracking
}

export interface UseGeolocationReturn {
  state: GeolocationState;
  requestPermission: () => Promise<PermissionState>;
  getCurrentPosition: (options?: UseGeolocationOptions) => Promise<GeolocationPosition>;
  startWatching: (options?: UseGeolocationOptions) => void;
  stopWatching: () => void;
  startTracking: (options?: UseGeolocationOptions) => void;
  stopTracking: () => void;
  clearTrackingData: () => void;
  clearError: () => void;
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000, // 5 minutes
  signalCheckInterval: 30000, // 30 seconds
  weakSignalThreshold: 100, // 100 meters accuracy considered weak
  lostSignalThreshold: 500, // 500 meters accuracy considered lost
  offlineTimeout: 120000, // 2 minutes without update considered offline
};

export function useGeolocation(initialOptions?: UseGeolocationOptions): UseGeolocationReturn {
  const options = { ...defaultOptions, ...initialOptions };
  const watchIdRef = useRef<number | null>(null);
  const signalCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionTimeRef = useRef<number>(Date.now());

  // Calculate GPS status based on accuracy and other factors
  const calculateGPSStatus = useCallback((position: GeolocationPosition | null, error: GeolocationPositionError | null): GPSStatus => {
    if (error) {
      if (error.code === 2) return 'lost'; // POSITION_UNAVAILABLE
      if (error.code === 3) return 'lost'; // TIMEOUT
      return 'unknown';
    }

    if (!position) return 'unknown';

    const accuracy = position.coords.accuracy;
    if (accuracy <= options.weakSignalThreshold!) return 'good';
    if (accuracy <= options.lostSignalThreshold!) return 'weak';
    return 'lost';
  }, [options.weakSignalThreshold, options.lostSignalThreshold]);

  // Calculate signal strength as a percentage (0-100)
  const calculateSignalStrength = useCallback((position: GeolocationPosition | null, error: GeolocationPositionError | null): number => {
    if (error || !position) return 0;

    const accuracy = position.coords.accuracy;
    const maxAccuracy = options.lostSignalThreshold!;

    // Signal strength decreases as accuracy increases
    const strength = Math.max(0, Math.min(100, 100 - (accuracy / maxAccuracy) * 100));
    return Math.round(strength);
  }, [options.lostSignalThreshold]);

  // Check if we're offline (no position updates for too long)
  const checkOfflineStatus = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastPosition = now - lastPositionTimeRef.current;
    return timeSinceLastPosition > options.offlineTimeout!;
  }, [options.offlineTimeout]);

  // Update GPS status and related state
  const updateGPSStatus = useCallback(() => {
    setState(prev => {
      const gpsStatus = calculateGPSStatus(prev.position, prev.error);
      const signalStrength = calculateSignalStrength(prev.position, prev.error);
      const isOffline = checkOfflineStatus();

      return {
        ...prev,
        gpsStatus,
        signalStrength,
        isOffline,
        lastSignalCheck: new Date(),
        lastKnownPosition: prev.position || prev.lastKnownPosition,
      };
    });
  }, [calculateGPSStatus, calculateSignalStrength, checkOfflineStatus]);

  const [state, setState] = useState<GeolocationState>({
    permission: 'default',
    position: null,
    error: null,
    isWatching: false,
    isSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    gpsStatus: 'unknown',
    lastKnownPosition: null,
    signalStrength: 0,
    isOffline: false,
    lastSignalCheck: null,
    trackingCoordinates: [],
    isTracking: false,
  });

  const updatePermission = useCallback(async (): Promise<PermissionState> => {
    if (!state.isSupported) return 'default';

    try {
      // Check if Permissions API is supported
      if ('permissions' in navigator) {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        const permission = permissionStatus.state as PermissionState;

        setState(prev => ({ ...prev, permission }));
        return permission;
      } else {
        // Fallback: try to get position to determine permission
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setState(prev => ({ ...prev, permission: 'granted' }));
              resolve('granted');
            },
            (error) => {
              if (error.code === error.PERMISSION_DENIED) {
                setState(prev => ({ ...prev, permission: 'denied' }));
                resolve('denied');
              } else {
                setState(prev => ({ ...prev, permission: 'prompt' }));
                resolve('prompt');
              }
            },
            { timeout: 1000 }
          );
        });
      }
    } catch (error) {
      console.warn('Error checking geolocation permission:', error);
      return 'default';
    }
  }, [state.isSupported]);

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!state.isSupported) {
      console.log('[useGeolocation] Geolocation not supported');
      return 'default';
    }

    console.log('[useGeolocation] Requesting permission...');

    // Request permission by attempting to get current position
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('[useGeolocation] Permission granted, position:', position.coords);
          setState(prev => ({
            ...prev,
            permission: 'granted',
            position,
            error: null
          }));
          resolve('granted');
        },
        (error) => {
          const permission: PermissionState = error.code === error.PERMISSION_DENIED ? 'denied' : 'prompt';
          console.log('[useGeolocation] Permission error:', error.code, error.message, '-> permission:', permission);
          setState(prev => ({
            ...prev,
            permission,
            error
          }));
          resolve(permission);
        },
        options
      );
    });
  }, [state.isSupported, options]);

  const getCurrentPosition = useCallback((overrideOptions?: UseGeolocationOptions): Promise<GeolocationPosition> => {
    const opts = { ...options, ...overrideOptions };

    return new Promise((resolve, reject) => {
      if (!state.isSupported) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          lastPositionTimeRef.current = Date.now();
          setState(prev => ({
            ...prev,
            position,
            error: null
          }));
          updateGPSStatus();
          resolve(position);
        },
        (error) => {
          setState(prev => ({
            ...prev,
            error
          }));
          updateGPSStatus();
          reject(error);
        },
        opts
      );
    });
  }, [state.isSupported, options]);

  const startWatching = useCallback((overrideOptions?: UseGeolocationOptions) => {
    const opts = { ...options, ...overrideOptions };

    console.log('[useGeolocation] startWatching called with options:', opts);

    if (!state.isSupported) {
      console.log('[useGeolocation] Geolocation not supported');
      setState(prev => ({
        ...prev,
        error: { code: 0, message: 'Geolocation is not supported', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }
      }));
      return;
    }

    if (watchIdRef.current !== null) {
      console.log('[useGeolocation] Clearing existing watch:', watchIdRef.current);
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    console.log('[useGeolocation] Starting watchPosition...');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        console.log('[useGeolocation] Position received:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        lastPositionTimeRef.current = Date.now();
        setState(prev => ({
          ...prev,
          position,
          error: null,
          isWatching: true
        }));
        updateGPSStatus();
      },
      (error) => {
        console.error('[useGeolocation] Position error:', {
          code: error.code,
          message: error.message,
          isWatching: watchIdRef.current !== null
        });
        setState(prev => ({
          ...prev,
          error,
          isWatching: false
        }));
        updateGPSStatus();
      },
      opts
    );

    console.log('[useGeolocation] Watch started with ID:', watchIdRef.current);
    setState(prev => ({ ...prev, isWatching: true }));

    // Start periodic signal strength checking
    if (signalCheckIntervalRef.current) {
      clearInterval(signalCheckIntervalRef.current);
    }
    signalCheckIntervalRef.current = setInterval(() => {
      console.log('[useGeolocation] Periodic GPS status update');
      updateGPSStatus();
    }, options.signalCheckInterval);
  }, [state.isSupported, options]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (signalCheckIntervalRef.current) {
      clearInterval(signalCheckIntervalRef.current);
      signalCheckIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isWatching: false }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const startTracking = useCallback((overrideOptions?: UseGeolocationOptions) => {
    const opts = { ...options, ...overrideOptions };
    const trackingInterval = opts.trackingInterval || 30000; // Default 30 seconds

    console.log('[useGeolocation] startTracking called with interval:', trackingInterval);

    if (!state.isSupported) {
      console.log('[useGeolocation] Geolocation not supported');
      setState(prev => ({
        ...prev,
        error: { code: 0, message: 'Geolocation is not supported', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }
      }));
      return;
    }

    // Start watching for position updates
    startWatching(opts);

    // Clear existing tracking data
    setState(prev => ({ ...prev, trackingCoordinates: [], isTracking: true }));

    // Set up periodic coordinate storage
    const trackingIntervalId = setInterval(() => {
      if (state.position) {
        const coord = {
          lat: state.position.coords.latitude,
          lng: state.position.coords.longitude,
          timestamp: Date.now()
        };

        setState(prev => ({
          ...prev,
          trackingCoordinates: [...prev.trackingCoordinates, coord]
        }));

        console.log('[useGeolocation] Stored tracking coordinate:', coord);
      }
    }, trackingInterval);

    // Store the interval ID for cleanup
    (window as any).__trackingIntervalId = trackingIntervalId;

  }, [state.isSupported, state.position, options, startWatching]);

  const stopTracking = useCallback(() => {
    console.log('[useGeolocation] stopTracking called');

    // Clear the tracking interval
    if ((window as any).__trackingIntervalId) {
      clearInterval((window as any).__trackingIntervalId);
      delete (window as any).__trackingIntervalId;
    }

    // Stop watching
    stopWatching();

    // Mark tracking as stopped
    setState(prev => ({ ...prev, isTracking: false }));

  }, [stopWatching]);

  const clearTrackingData = useCallback(() => {
    setState(prev => ({ ...prev, trackingCoordinates: [] }));
  }, []);

  // Permission will be checked when startWatching() or requestPermission() is called
  // Or can be checked manually by calling updatePermission()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (signalCheckIntervalRef.current) {
        clearInterval(signalCheckIntervalRef.current);
      }
      // Clear tracking interval
      if ((window as any).__trackingIntervalId) {
        clearInterval((window as any).__trackingIntervalId);
      }
    };
  }, []);

  return {
    state,
    requestPermission,
    getCurrentPosition,
    startWatching,
    stopWatching,
    startTracking,
    stopTracking,
    clearTrackingData,
    clearError,
  };
}