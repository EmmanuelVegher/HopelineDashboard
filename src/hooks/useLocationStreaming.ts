import { useState, useEffect, useCallback, useRef } from 'react';

export interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
  speed?: number | null;
  heading?: number | null;
}

export interface LocationStreamingOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  updateInterval?: number; // Minimum time between updates in ms
  maxRetries?: number;
  retryDelay?: number;
}

export interface LocationStreamingState {
  currentLocation: LocationData | null;
  isStreaming: boolean;
  error: string | null;
  permissionStatus: PermissionState;
  watchId: number | null;
}

export interface UseLocationStreamingReturn extends LocationStreamingState {
  startStreaming: () => void;
  stopStreaming: () => void;
  requestPermission: () => Promise<PermissionState>;
  updateOptions: (options: Partial<LocationStreamingOptions>) => void;
}

const DEFAULT_OPTIONS: Required<LocationStreamingOptions> = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 30000,
  updateInterval: 1000, // 1 second minimum between updates
  maxRetries: 3,
  retryDelay: 2000,
};

export function useLocationStreaming(
  options: LocationStreamingOptions = {},
  onPositionUpdate?: (location: LocationData) => void,
  onError?: (error: string) => void
): UseLocationStreamingReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<LocationStreamingState>({
    currentLocation: null,
    isStreaming: false,
    error: null,
    permissionStatus: 'prompt',
    watchId: null,
  });

  const lastUpdateRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef<Required<LocationStreamingOptions>>(mergedOptions);

  // Update options
  const updateOptions = useCallback((newOptions: Partial<LocationStreamingOptions>) => {
    optionsRef.current = { ...optionsRef.current, ...newOptions };
  }, []);

  // Check permission status
  const checkPermission = useCallback(async (): Promise<PermissionState> => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setState(prev => ({ ...prev, permissionStatus: result.state }));
        return result.state;
      } catch (error) {
        console.warn('Permission query not supported:', error);
        setState(prev => ({ ...prev, permissionStatus: 'prompt' }));
        return 'prompt';
      }
    }
    return 'prompt';
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by this browser';
        setState(prev => ({ ...prev, error, permissionStatus: 'denied' }));
        onError?.(error);
        resolve('denied');
        return;
      }

      // Try to get current position to trigger permission request
      navigator.geolocation.getCurrentPosition(
        () => {
          checkPermission().then(resolve);
        },
        (error) => {
          let permissionStatus: PermissionState = 'denied';
          let errorMessage = 'Unknown location error';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              permissionStatus = 'denied';
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              permissionStatus = 'prompt';
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              permissionStatus = 'prompt';
              errorMessage = 'Location request timed out';
              break;
          }

          setState(prev => ({ ...prev, error: errorMessage, permissionStatus }));
          onError?.(errorMessage);
          resolve(permissionStatus);
        },
        {
          enableHighAccuracy: optionsRef.current.enableHighAccuracy,
          timeout: optionsRef.current.timeout,
          maximumAge: optionsRef.current.maximumAge,
        }
      );
    });
  }, [checkPermission, onError]);

  // Handle position update
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Throttle updates to prevent excessive calls
    if (timeSinceLastUpdate < optionsRef.current.updateInterval) {
      return;
    }

    const locationData: LocationData = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      speed: position.coords.speed,
      heading: position.coords.heading,
    };

    setState(prev => ({
      ...prev,
      currentLocation: locationData,
      error: null,
    }));

    lastUpdateRef.current = now;
    retryCountRef.current = 0; // Reset retry count on successful update

    onPositionUpdate?.(locationData);
  }, [onPositionUpdate]);

  // Handle geolocation error
  const handleGeolocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Unknown location error';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied';
        setState(prev => ({ ...prev, permissionStatus: 'denied' }));
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }

    setState(prev => ({ ...prev, error: errorMessage }));

    // Implement retry logic for temporary errors
    if (error.code !== error.PERMISSION_DENIED && retryCountRef.current < optionsRef.current.maxRetries) {
      retryCountRef.current += 1;
      console.warn(`Location error (attempt ${retryCountRef.current}/${optionsRef.current.maxRetries}):`, errorMessage);

      retryTimeoutRef.current = setTimeout(() => {
        if (state.isStreaming && state.watchId) {
          // The watchPosition should automatically retry, but we can log it
          console.log('Retrying location streaming...');
        }
      }, optionsRef.current.retryDelay);
    } else {
      onError?.(errorMessage);
    }
  }, [state.isStreaming, state.watchId, onError]);

  // Start streaming
  const startStreaming = useCallback(async () => {
    if (!navigator.geolocation) {
      const error = 'Geolocation is not supported by this browser';
      setState(prev => ({ ...prev, error, isStreaming: false }));
      onError?.(error);
      return;
    }

    // Check permission first
    const permission = await checkPermission();
    if (permission === 'denied') {
      const error = 'Location permission denied';
      setState(prev => ({ ...prev, error, isStreaming: false }));
      onError?.(error);
      return;
    }

    try {
      const watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handleGeolocationError,
        {
          enableHighAccuracy: optionsRef.current.enableHighAccuracy,
          timeout: optionsRef.current.timeout,
          maximumAge: optionsRef.current.maximumAge,
        }
      );

      setState(prev => ({
        ...prev,
        isStreaming: true,
        error: null,
        watchId,
      }));

      console.log('Location streaming started with watchId:', watchId);
    } catch (error) {
      const errorMessage = 'Failed to start location streaming';
      setState(prev => ({ ...prev, error: errorMessage, isStreaming: false }));
      onError?.(errorMessage);
    }
  }, [checkPermission, handlePositionUpdate, handleGeolocationError, onError]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
      console.log('Location streaming stopped, watchId:', state.watchId);
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isStreaming: false,
      watchId: null,
      error: null,
    }));

    retryCountRef.current = 0;
  }, [state.watchId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options };
  }, [options]);

  return {
    ...state,
    startStreaming,
    stopStreaming,
    requestPermission,
    updateOptions,
  };
}