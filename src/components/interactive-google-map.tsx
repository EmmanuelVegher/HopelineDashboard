import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLocationStreaming } from '@/hooks/useLocationStreaming';

// Google Maps API key - from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface LatLng {
  lat: number;
  lng: number;
}

interface InteractiveGoogleMapProps {
  mode: 'navigation' | 'tracking';
  driverLocation?: LatLng;
  destination?: LatLng;
  trackingPath?: LatLng[];
  geofences?: LatLng[][];
  className?: string;
  onError?: (error: string) => void;
  enableStreaming?: boolean;
  onLocationUpdate?: (location: LatLng) => void;
  followDriver?: boolean;
  kmlUrls?: string[];
  focusedGeofenceIndex?: number;
}

export default function InteractiveGoogleMap({
  mode,
  driverLocation,
  destination,
  trackingPath = [],
  geofences = [],
  className = 'h-96 w-full',
  onError,
  enableStreaming = false,
  onLocationUpdate,
  followDriver = true,
  kmlUrls = [],
  focusedGeofenceIndex,
}: InteractiveGoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const trackingPathRef = useRef<google.maps.Polyline | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const geofencePolygonsRef = useRef<google.maps.Polygon[]>([]);
  const kmlLayersRef = useRef<google.maps.KmlLayer[]>([]);
  const hasInitialCenteredRef = useRef(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Location streaming hook
  const locationStreaming = useLocationStreaming(
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
      updateInterval: 1000, // Update every second
    },
    (location) => {
      // Callback for position updates
      const latLng: LatLng = { lat: location.lat, lng: location.lng };
      onLocationUpdate?.(latLng);
    },
    (error) => {
      // Handle streaming errors
      console.error('Location streaming error:', error);
      onError?.(error);
    }
  );

  // Handle location streaming
  useEffect(() => {
    if (enableStreaming && isLoaded) {
      console.log('Starting location streaming for map updates');
      locationStreaming.startStreaming();
    } else if (!enableStreaming && locationStreaming.isStreaming) {
      console.log('Stopping location streaming');
      locationStreaming.stopStreaming();
    }

    return () => {
      if (locationStreaming.isStreaming) {
        locationStreaming.stopStreaming();
      }
    };
  }, [enableStreaming, isLoaded, locationStreaming]);

  // Initialize Google Maps using the functional API
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
      const error = 'Google Maps API key is not configured. Please add a valid VITE_GOOGLE_MAPS_API_KEY to your .env file.';
      setLoadError(error);
      onError?.(error);
      return;
    }

    // Check if Google Maps is already loaded
    if ((window as any).google && (window as any).google.maps) {
      setIsLoaded(true);
      setLoadError(null);
      return;
    }

    // Load the Google Maps script dynamically
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry,routes&v=weekly`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('Google Maps script loaded successfully');
      setIsLoaded(true);
      setLoadError(null);
      setBillingError(null);
    };

    script.onerror = (error) => {
      console.error('Error loading Google Maps script:', error);
      const errorMsg = 'Failed to load Google Maps. Please check your API key and network connection.';
      setLoadError(errorMsg);
      onError?.(errorMsg);
      setBillingError(null);
    };

    // Add global error handler for Google Maps billing errors
    const handleGoogleMapsError = (event: ErrorEvent) => {
      if (event.error && (
        event.error.message?.includes('BillingNotEnabledMapError') ||
        event.error.message?.includes('billing') ||
        event.error.message?.includes('This API project is not authorized to use this API')
      )) {
        console.error('Google Maps billing error detected:', event.error);
        const errorMsg = 'Google Maps billing is not enabled for this API key. Please enable billing in your Google Cloud Console and ensure the Maps API is activated.';
        setBillingError(errorMsg);
        onError?.(errorMsg);
        setLoadError(null);
        setIsLoaded(false);
      }
    };

    window.addEventListener('error', handleGoogleMapsError);

    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (!existingScript) {
      console.log('Loading Google Maps script...');
      document.head.appendChild(script);
    } else {
      console.log('Google Maps script already exists, waiting for load...');
      // Script already exists, wait for it to load
      if ((window as any).google && (window as any).google.maps) {
        setIsLoaded(true);
      }
    }

    return () => {
      // Don't remove the script as it might be used elsewhere
      window.removeEventListener('error', handleGoogleMapsError);
    };
  }, [onError]);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || googleMapRef.current) return;

    try {
      // Determine center point
      let center: google.maps.LatLngLiteral = {
        lat: 6.5244, // Lagos, Nigeria
        lng: 3.3792
      };

      // Use streaming location or provided driver location as center if available
      const currentDriverLocation = enableStreaming && locationStreaming.currentLocation
        ? { lat: locationStreaming.currentLocation.lat, lng: locationStreaming.currentLocation.lng }
        : driverLocation;

      if (currentDriverLocation) {
        center = {
          lat: currentDriverLocation.lat,
          lng: currentDriverLocation.lng
        };
      } else if (destination) {
        center = {
          lat: destination.lat,
          lng: destination.lng
        };
      }

      const mapOptions: google.maps.MapOptions = {
        center,
        zoom: 12,
        mapTypeId: mode === 'tracking' ? 'satellite' : 'roadmap',
        mapTypeControl: true, // Allow user to switch back if they want
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      };

      googleMapRef.current = new google.maps.Map(mapRef.current, mapOptions);

      // Initialize directions service and renderer
      directionsServiceRef.current = new google.maps.DirectionsService();
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: googleMapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 6,
          strokeOpacity: 0.8,
        }
      });

    } catch (error: any) {
      console.error('Error initializing Google Map:', error);

      // Check for billing-related errors
      if (error?.message?.includes('BillingNotEnabledMapError') ||
        error?.message?.includes('billing') ||
        error?.message?.includes('This API project is not authorized to use this API') ||
        error?.message?.includes('Geocoding API') ||
        error?.message?.includes('Maps API')) {
        const errorMsg = 'Google Maps billing is not enabled for this API key. Please enable billing in your Google Cloud Console and ensure the Maps API is activated.';
        setBillingError(errorMsg);
        onError?.(errorMsg);
        setLoadError(null);
      } else {
        const errorMsg = 'Failed to initialize map.';
        setLoadError(errorMsg);
        onError?.(errorMsg);
        setBillingError(null);
      }
    }
  }, [isLoaded, driverLocation, destination, onError]);

  // Create car marker icon
  const createCarIcon = useCallback((color: string = '#10b981') => {
    const svg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 11l1.5-4.5h11L18 11v8a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H8v1a1 1 0 01-1 1H6a1 1 0 01-1-1v-8z" fill="${color}" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="6.5" cy="16.5" r="1.5" fill="white"/>
      <circle cx="17.5" cy="16.5" r="1.5" fill="white"/>
      <path d="M8.5 11h7l-1-3h-5l-1 3z" fill="${color}" stroke="white" stroke-width="0.5"/>
    </svg>`;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(32, 32),
      anchor: new google.maps.Point(16, 16),
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Determine current driver location (streaming or provided)
    const currentDriverLocation = enableStreaming && locationStreaming.currentLocation
      ? { lat: locationStreaming.currentLocation.lat, lng: locationStreaming.currentLocation.lng }
      : driverLocation;

    try {
      // Add driver location marker if available
      if (currentDriverLocation && currentDriverLocation.lat !== 0 && currentDriverLocation.lng !== 0) {
        if (!driverMarkerRef.current) {
          driverMarkerRef.current = new google.maps.Marker({
            position: {
              lat: currentDriverLocation.lat,
              lng: currentDriverLocation.lng
            },
            map: googleMapRef.current,
            icon: createCarIcon('#10b981'), // Green for driver
            title: 'Driver Location',
          });

          // Add info window for driver marker
          const driverInfoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 8px; min-width: 200px;">
                <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">🚗 Driver Location</h3>
                <div style="font-size: 14px; line-height: 1.4;">
                  <p><strong>Coordinates:</strong> ${currentDriverLocation.lat.toFixed(6)}, ${currentDriverLocation.lng.toFixed(6)}</p>
                  <p><strong>Status:</strong> <span style="margin-left: 4px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #dbeafe; color: #1e40af;">Active</span></p>
                </div>
              </div>`,
          });

          driverMarkerRef.current.addListener('click', () => {
            driverInfoWindow.open(googleMapRef.current, driverMarkerRef.current);
          });
        } else {
          // Update position
          driverMarkerRef.current.setPosition({
            lat: currentDriverLocation.lat,
            lng: currentDriverLocation.lng
          });
          driverMarkerRef.current.setMap(googleMapRef.current);
        }

        markersRef.current.push(driverMarkerRef.current);
      }

      // Add destination marker if available
      if (destination && destination.lat !== 0 && destination.lng !== 0) {
        if (!destinationMarkerRef.current) {
          destinationMarkerRef.current = new google.maps.Marker({
            position: {
              lat: destination.lat,
              lng: destination.lng
            },
            map: googleMapRef.current,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/><circle cx="12" cy="9.5" r="3" fill="white"/></svg>`)}`,
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 32),
            },
            title: 'Destination',
          });

          // Add info window for destination marker
          const destinationInfoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 8px; min-width: 200px;">
                <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">🎯 Destination</h3>
                <div style="font-size: 14px; line-height: 1.4;">
                  <p><strong>Coordinates:</strong> ${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}</p>
                  <p><strong>Status:</strong> <span style="margin-left: 4px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #fee2e2; color: #991b1b;">Target</span></p>
                </div>
              </div>`,
          });

          destinationMarkerRef.current.addListener('click', () => {
            destinationInfoWindow.open(googleMapRef.current, destinationMarkerRef.current);
          });
        } else {
          // Update position
          destinationMarkerRef.current.setPosition({
            lat: destination.lat,
            lng: destination.lng
          });
          destinationMarkerRef.current.setMap(googleMapRef.current);
        }

        markersRef.current.push(destinationMarkerRef.current);
      }

    } catch (error: any) {
      console.error('Error updating markers:', error);

      // Check for billing-related errors during marker operations
      if (error?.message?.includes('BillingNotEnabledMapError') ||
        error?.message?.includes('billing') ||
        error?.message?.includes('This API project is not authorized to use this API')) {
        const errorMsg = 'Google Maps billing is not enabled for this API key. Please enable billing in your Google Cloud Console and ensure the Maps API is activated.';
        setBillingError(errorMsg);
        onError?.(errorMsg);
        setLoadError(null);
        setIsLoaded(false);
      }
    }
  }, [isLoaded, driverLocation, destination, createCarIcon, onError, enableStreaming, locationStreaming.currentLocation]);

  // Handle navigation mode - show directions
  useEffect(() => {
    if (!isLoaded || !directionsServiceRef.current || !directionsRendererRef.current || mode !== 'navigation') return;

    const currentDriverLocation = enableStreaming && locationStreaming.currentLocation
      ? { lat: locationStreaming.currentLocation.lat, lng: locationStreaming.currentLocation.lng }
      : driverLocation;

    if (currentDriverLocation && destination) {
      const request: google.maps.DirectionsRequest = {
        origin: { lat: currentDriverLocation.lat, lng: currentDriverLocation.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      };

      directionsServiceRef.current.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRendererRef.current?.setDirections(result);
        } else {
          console.error('Directions request failed:', status);
          // Clear directions by setting map to null and back
          if (directionsRendererRef.current) {
            directionsRendererRef.current.setMap(null);
            directionsRendererRef.current.setMap(googleMapRef.current);
          }

          // Provide more helpful error messages
          let errorMessage = 'Unable to calculate route';
          let showFallbackLine = false;

          switch (status) {
            case 'REQUEST_DENIED':
              errorMessage = 'Directions API not enabled. Please enable the Directions API in Google Cloud Console for your API key.';
              showFallbackLine = true;
              break;
            case 'OVER_QUERY_LIMIT':
              errorMessage = 'Too many routing requests. Please try again later.';
              showFallbackLine = true;
              break;
            case 'NOT_FOUND':
              errorMessage = 'Route not found between these locations.';
              showFallbackLine = true;
              break;
            case 'ZERO_RESULTS':
              errorMessage = 'No driving route available between these points.';
              showFallbackLine = true;
              break;
            default:
              errorMessage = `Unable to calculate route: ${status}`;
              showFallbackLine = true;
          }

          // Show fallback straight line for routing errors
          if (showFallbackLine && currentDriverLocation && destination) {
            const fallbackLine = new google.maps.Polyline({
              path: [
                { lat: currentDriverLocation.lat, lng: currentDriverLocation.lng },
                { lat: destination.lat, lng: destination.lng }
              ],
              geodesic: true,
              strokeColor: '#6b7280',
              strokeOpacity: 0.6,
              strokeWeight: 3,
              icons: [{
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 0.6,
                  scale: 4
                },
                offset: '0',
                repeat: '20px'
              }],
              map: googleMapRef.current,
            });

            // Store fallback line for cleanup
            if (!directionsRendererRef.current) {
              directionsRendererRef.current = {
                setMap: (map: google.maps.Map | null) => {
                  fallbackLine.setMap(map);
                },
              } as any;
            }
          }

          onError?.(errorMessage);
        }
      });
    } else {
      // Clear directions if no route to show
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current.setMap(googleMapRef.current);
      }
    }
  }, [isLoaded, mode, driverLocation, destination, onError, enableStreaming, locationStreaming.currentLocation]);

  // Handle tracking mode - show path
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    if (trackingPath.length > 1) {
      // Create or update tracking path
      const pathCoordinates = trackingPath.map(({ lat, lng }) => ({ lat, lng }));

      if (!trackingPathRef.current) {
        trackingPathRef.current = new google.maps.Polyline({
          path: pathCoordinates,
          geodesic: true,
          strokeColor: '#f59e0b', // Orange path
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map: googleMapRef.current,
        });
      } else {
        trackingPathRef.current.setPath(pathCoordinates);
      }
    } else {
      // Remove tracking path when insufficient points
      if (trackingPathRef.current) {
        trackingPathRef.current.setMap(null);
        trackingPathRef.current = null;
      }
    }
  }, [isLoaded, mode, trackingPath]);

  // Handle geofences - show polygons
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    // Clear existing polygons
    geofencePolygonsRef.current.forEach(p => p.setMap(null));
    geofencePolygonsRef.current = [];

    if (geofences && geofences.length > 0) {
      geofences.forEach((paths) => {
        if (paths.length > 2) {
          const polygon = new google.maps.Polygon({
            paths: paths,
            strokeColor: '#f87171', // red-400
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#f87171',
            fillOpacity: 0.35,
            map: googleMapRef.current,
          });
          geofencePolygonsRef.current.push(polygon);
        }
      });
    }
  }, [isLoaded, geofences]);

  // Handle KML layers
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    // Clear existing layers
    kmlLayersRef.current.forEach(layer => layer.setMap(null));
    kmlLayersRef.current = [];

    if (kmlUrls && kmlUrls.length > 0) {
      kmlUrls.forEach(url => {
        if (url) {
          const kmlLayer = new google.maps.KmlLayer({
            url: url,
            suppressInfoWindows: false,
            preserveViewport: true,
            map: googleMapRef.current,
          });

          // Log status changes for debugging
          kmlLayer.addListener('status_changed', () => {
            console.log(`KML Layer [${url}] status:`, kmlLayer.getStatus());
            if (kmlLayer.getStatus() !== 'OK') {
              onError?.(`KML Error: ${kmlLayer.getStatus()} for URL: ${url}`);
            }
          });

          kmlLayersRef.current.push(kmlLayer);
        }
      });
    }
  }, [isLoaded, kmlUrls]);

  // Fit bounds to first geofence on initial load
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current || hasInitialCenteredRef.current) return;

    let bounds: google.maps.LatLngBounds | null = null;

    if (geofences && geofences.length > 0 && geofences[0].length > 0) {
      bounds = new google.maps.LatLngBounds();
      geofences[0].forEach(point => bounds?.extend(point));
    }

    if (bounds) {
      googleMapRef.current.fitBounds(bounds);
      hasInitialCenteredRef.current = true;
    }
  }, [isLoaded, geofences]);

  // Focus on a specific geofence when focusedGeofenceIndex changes
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;
    if (focusedGeofenceIndex === undefined || focusedGeofenceIndex === null) return;
    const target = geofences?.[focusedGeofenceIndex];
    if (!target || target.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    target.forEach(point => bounds.extend(point));
    googleMapRef.current.fitBounds(bounds, 80); // 80px padding
  }, [isLoaded, focusedGeofenceIndex, geofences]);

  // Center map on locations
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    const currentDriverLocation = enableStreaming && locationStreaming.currentLocation
      ? { lat: locationStreaming.currentLocation.lat, lng: locationStreaming.currentLocation.lng }
      : driverLocation;

    let center: google.maps.LatLngLiteral | null = null;

    if (mode === 'navigation' && currentDriverLocation) {
      center = {
        lat: currentDriverLocation.lat,
        lng: currentDriverLocation.lng
      };
    } else if (mode === 'tracking' && currentDriverLocation) {
      center = {
        lat: currentDriverLocation.lat,
        lng: currentDriverLocation.lng
      };
    } else if (destination) {
      center = {
        lat: destination.lat,
        lng: destination.lng
      };
    }

    if (center) {
      const shouldCenter = followDriver || !hasInitialCenteredRef.current;

      if (shouldCenter) {
        googleMapRef.current.setCenter(center);
        if (!hasInitialCenteredRef.current) {
          googleMapRef.current.setZoom(15);
          hasInitialCenteredRef.current = true;
        }
      }
    }
  }, [isLoaded, mode, driverLocation, destination, enableStreaming, locationStreaming.currentLocation, followDriver]);

  if (billingError) {
    return (
      <div className={cn(className, "flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200")}>
        <div className="text-center p-6 max-w-md">
          <div className="text-orange-500 text-3xl mb-4">💳</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Google Maps Billing Required</h3>
          <p className="text-sm text-gray-600 mb-4">{billingError}</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">How to fix this:</h4>
            <ol className="text-xs text-blue-700 text-left space-y-1">
              <li>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">Google Cloud Console</a></li>
              <li>2. Enable billing for your project</li>
              <li>3. Enable the Maps JavaScript API</li>
              <li>4. Check your API key restrictions</li>
            </ol>
          </div>
          <p className="text-xs text-gray-500">
            The map functionality will be restored once billing is properly configured.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn(className, "flex items-center justify-center bg-gray-100 rounded-lg")}>
        <div className="text-center p-4">
          <div className="text-red-500 text-lg mb-2">⚠️</div>
          <p className="text-sm text-gray-600">{loadError}</p>
          <p className="text-xs text-gray-500 mt-2">
            To use Google Maps, add your API key to the environment variables.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={cn(className, "flex items-center justify-center bg-gray-100 rounded-lg")}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(className, "relative overflow-hidden rounded-lg")}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}