import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Google Maps API key - you'll need to add this to your environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface DriverLocation {
  latitude: number;
  longitude: number;
  vehicleColor?: string;
}

interface GoogleMapProps {
  drivers?: any[];
  selectedTask?: {
    location: {
      latitude: number;
      longitude: number;
    };
  } | null;
  currentPosition?: [number, number];
  destination?: [number, number];
  showCurrentLocation?: boolean;
  currentLocationAccuracy?: number;
  driverLocation?: DriverLocation;
  defaultCenter?: [number, number];
  onRoutingError?: (error: string) => void;
  className?: string;
}

export default function GoogleMap({
  drivers = [],
  selectedTask,
  currentPosition,
  destination,
  showCurrentLocation = false,
  currentLocationAccuracy,
  driverLocation,
  defaultCenter = [6.5244, 3.3792], // Lagos, Nigeria
  onRoutingError,
  className = 'h-96 w-full',
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize Google Maps using the new functional API
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
      setLoadError('Google Maps API key is not configured. Please add a valid VITE_GOOGLE_MAPS_API_KEY to your .env file.');
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
    };

    script.onerror = (error) => {
      console.error('Error loading Google Maps script:', error);
      setLoadError('Failed to load Google Maps. Please check your API key and network connection.');
    };

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
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    try {
      // Determine center point
      let center: google.maps.LatLngLiteral = {
        lat: defaultCenter[0],
        lng: defaultCenter[1]
      };

      // Use driver location as center if available
      if (driverLocation) {
        center = {
          lat: driverLocation.latitude,
          lng: driverLocation.longitude
        };
      }

      const mapOptions: google.maps.MapOptions = {
        center,
        zoom: 12,
        mapTypeControl: false,
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

    } catch (error) {
      console.error('Error initializing Google Map:', error);
      setLoadError('Failed to initialize map.');
    }
  }, [isLoaded, defaultCenter, driverLocation]);

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

    try {
      // Add driver location marker if available
      if (driverLocation && driverLocation.latitude !== 0 && driverLocation.longitude !== 0) {
        const driverMarker = new google.maps.Marker({
          position: {
            lat: driverLocation.latitude,
            lng: driverLocation.longitude
          },
          map: googleMapRef.current,
          icon: createCarIcon('#10b981'), // Green for driver
          title: 'Your Location',
        });

        // Add info window for driver marker
        const driverInfoWindow = new google.maps.InfoWindow({
          content: `<div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">Your Location</h3>
              <div style="font-size: 14px; line-height: 1.4;">
                <p><strong>Coordinates:</strong> ${driverLocation.latitude.toFixed(6)}, ${driverLocation.longitude.toFixed(6)}</p>
                <p><strong>Status:</strong> <span style="margin-left: 4px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #dbeafe; color: #1e40af;">Active Driver</span></p>
              </div>
            </div>`,
        });

        driverMarker.addListener('click', () => {
          driverInfoWindow.open(googleMapRef.current, driverMarker);
        });

        markersRef.current.push(driverMarker);
      }

      // Add destination marker if selected task exists
      if (selectedTask) {
        const destinationMarker = new google.maps.Marker({
          position: {
            lat: selectedTask.location.latitude,
            lng: selectedTask.location.longitude
          },
          map: googleMapRef.current,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/><circle cx="12" cy="9.5" r="3" fill="white"/></svg>`)}`,
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 32),
          },
          title: 'Emergency Location',
        });

        // Add info window for destination marker
        const destinationInfoWindow = new google.maps.InfoWindow({
          content: `<div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">Emergency Location</h3>
              <div style="font-size: 14px; line-height: 1.4;">
                <p><strong>Coordinates:</strong> ${selectedTask.location.latitude.toFixed(6)}, ${selectedTask.location.longitude.toFixed(6)}</p>
                <p><strong>Status:</strong> <span style="margin-left: 4px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #fee2e2; color: #991b1b;">Emergency</span></p>
              </div>
            </div>`,
        });

        destinationMarker.addListener('click', () => {
          destinationInfoWindow.open(googleMapRef.current, destinationMarker);
        });

        markersRef.current.push(destinationMarker);
      }

      // Add current location marker if enabled
      if (showCurrentLocation && currentPosition) {
        const currentLocationMarker = new google.maps.Marker({
          position: {
            lat: currentPosition[0],
            lng: currentPosition[1]
          },
          map: googleMapRef.current,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="#3b82f6"/><circle cx="12" cy="12" r="2" fill="white"/></svg>`)}`,
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12),
          },
          title: 'Current Location',
        });

        // Add accuracy circle if available
        if (currentLocationAccuracy) {
          new google.maps.Circle({
            strokeColor: '#3b82f6',
            strokeOpacity: 0.3,
            strokeWeight: 1,
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            map: googleMapRef.current,
            center: { lat: currentPosition[0], lng: currentPosition[1] },
            radius: currentLocationAccuracy,
          });
        }

        markersRef.current.push(currentLocationMarker);
      }

    } catch (error) {
      console.error('Error updating markers:', error);
    }
  }, [isLoaded, driverLocation, selectedTask, showCurrentLocation, currentPosition, currentLocationAccuracy, createCarIcon]);

  // Update routing
  useEffect(() => {
    if (!isLoaded || !directionsServiceRef.current || !directionsRendererRef.current) return;

    if (currentPosition && destination) {
      const request: google.maps.DirectionsRequest = {
        origin: { lat: currentPosition[0], lng: currentPosition[1] },
        destination: { lat: destination[0], lng: destination[1] },
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
          if (onRoutingError) {
            onRoutingError(`Unable to calculate route: ${status}`);
          }
        }
      });
    } else {
      // Clear directions if no route to show
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current.setMap(googleMapRef.current);
      }
    }
  }, [isLoaded, currentPosition, destination, onRoutingError]);

  // Center map on selected task or driver location
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    let center: google.maps.LatLngLiteral | null = null;

    if (selectedTask) {
      center = {
        lat: selectedTask.location.latitude,
        lng: selectedTask.location.longitude
      };
    } else if (driverLocation) {
      center = {
        lat: driverLocation.latitude,
        lng: driverLocation.longitude
      };
    }

    if (center) {
      googleMapRef.current.setCenter(center);
      googleMapRef.current.setZoom(15);
    }
  }, [isLoaded, selectedTask, driverLocation]);

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