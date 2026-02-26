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
  // Live tracking props
  isTracking?: boolean;
  trackingPath?: [number, number][];
  navigationLine?: [number, number][];
  isReplaying?: boolean;
  replayPath?: [number, number][];
  followDriver?: boolean;
  onLocationError?: (error: string) => void;
  className?: string;
  mapTypeId?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{
    id: string;
    position: { lat: number; lng: number };
    title?: string;
    icon?: string;
    type?: string;
    data?: any;
  }>;
  onMarkerClick?: (marker: any) => void;
  showUserLocation?: boolean;
  showRouting?: boolean;
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
  // Live tracking props
  isTracking = false,
  trackingPath = [],
  navigationLine = [],
  isReplaying = false,
  replayPath = [],
  followDriver = false,
  onLocationError,
  className = 'h-96 w-full',
  mapTypeId = 'roadmap',
  center: propCenter,
  zoom: propZoom = 12,
  markers = [],
  onMarkerClick,
  showUserLocation = false,
  showRouting = false,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const trackingMarkerRef = useRef<google.maps.Marker | null>(null);
  const trackingPathRef = useRef<google.maps.Polyline | null>(null);
  const navigationLineRef = useRef<google.maps.Polyline | null>(null);
  const replayPathRef = useRef<google.maps.Polyline | null>(null);
  const replayMarkerRef = useRef<google.maps.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [currentTrackingPosition, setCurrentTrackingPosition] = useState<[number, number] | null>(null);

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
      setBillingError(null);
    };

    script.onerror = (error) => {
      console.error('Error loading Google Maps script:', error);
      setLoadError('Failed to load Google Maps. Please check your API key and network connection.');
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
        setBillingError('Google Maps billing is not enabled for this API key. Please enable billing in your Google Cloud Console and ensure the Maps API is activated.');
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

      if (propCenter) {
        center = propCenter;
      } else if (driverLocation) {
        center = {
          lat: driverLocation.latitude,
          lng: driverLocation.longitude
        };
      }

      const mapOptions: google.maps.MapOptions = {
        center,
        zoom: propZoom,
        mapTypeId: mapTypeId as any,
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

    } catch (error: any) {
      console.error('Error initializing Google Map:', error);

      // Check for billing-related errors
      if (error?.message?.includes('BillingNotEnabledMapError') ||
        error?.message?.includes('billing') ||
        error?.message?.includes('This API project is not authorized to use this API') ||
        error?.message?.includes('Geocoding API') ||
        error?.message?.includes('Maps API')) {
        setBillingError('Google Maps billing is not enabled for this API key. Please enable billing in your Google Cloud Console and ensure the Maps API is activated.');
        setLoadError(null);
      } else {
        setLoadError('Failed to initialize map.');
        setBillingError(null);
      }
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

      if (markers && markers.length > 0) {
        markers.forEach(markerData => {
          const customMarker = new google.maps.Marker({
            position: markerData.position,
            map: googleMapRef.current,
            title: markerData.title,
          });

          if (markerData.icon) {
            customMarker.setIcon({
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="14">${markerData.icon}</text></svg>`)}`,
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 16),
            });
          }

          if (onMarkerClick) {
            customMarker.addListener('click', () => {
              onMarkerClick(markerData);
            });
          }

          markersRef.current.push(customMarker);
        });
      }

    } catch (error: any) {
      console.error('Error updating markers:', error);

      // Check for billing-related errors during marker operations
      if (error?.message?.includes('BillingNotEnabledMapError') ||
        error?.message?.includes('billing') ||
        error?.message?.includes('This API project is not authorized to use this API')) {
        setBillingError('Google Maps billing is not enabled for this API key. Please enable billing in your Google Cloud Console and ensure the Maps API is activated.');
        setLoadError(null);
        setIsLoaded(false);
      }
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

          // Provide more helpful error messages
          let errorMessage = 'Unable to calculate route';
          let showFallbackLine = false;

          switch (status) {
            case 'REQUEST_DENIED':
              errorMessage = 'Directions API not enabled. Please enable the Directions API in Google Cloud Console for your API key.';
              showFallbackLine = true; // Show straight line as fallback
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
          if (showFallbackLine && currentPosition && destination) {
            const fallbackLine = new google.maps.Polyline({
              path: [
                { lat: currentPosition[0], lng: currentPosition[1] },
                { lat: destination[0], lng: destination[1] }
              ],
              geodesic: true,
              strokeColor: '#6b7280', // Gray fallback line
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

          if (onRoutingError) {
            onRoutingError(errorMessage);
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

  // Handle live tracking marker
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    if (isTracking && currentPosition) {
      const [lat, lng] = currentPosition;

      // Create or update tracking marker
      if (!trackingMarkerRef.current) {
        trackingMarkerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map: googleMapRef.current,
          icon: createCarIcon('#f59e0b'), // Orange for tracking
          title: 'Live Tracking',
          zIndex: 1000, // Ensure it appears on top
        });

        // Add info window for tracking marker
        const trackingInfoWindow = new google.maps.InfoWindow({
          content: `<div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">🚗 Live Tracking Active</h3>
              <div style="font-size: 14px; line-height: 1.4;">
                <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                <p><strong>Status:</strong> <span style="margin-left: 4px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #fef3c7; color: #92400e;">In Transit</span></p>
                <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">📍 Real-time location updates</p>
              </div>
            </div>`,
        });

        trackingMarkerRef.current.addListener('click', () => {
          trackingInfoWindow.open(googleMapRef.current, trackingMarkerRef.current);
        });
      } else {
        // Animate marker to new position
        const newPosition = new google.maps.LatLng(lat, lng);
        trackingMarkerRef.current.setPosition(newPosition);
      }

      setCurrentTrackingPosition(currentPosition);

      // Follow driver if enabled
      if (followDriver && googleMapRef.current) {
        googleMapRef.current.panTo({ lat, lng });
      }
    } else {
      // Remove tracking marker when not tracking
      if (trackingMarkerRef.current) {
        trackingMarkerRef.current.setMap(null);
        trackingMarkerRef.current = null;
      }
      setCurrentTrackingPosition(null);
    }
  }, [isLoaded, isTracking, currentPosition, followDriver, createCarIcon]);

  // Handle tracking path visualization
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    if (isTracking && trackingPath.length > 1) {
      // Create or update tracking path
      const pathCoordinates = trackingPath.map(([lat, lng]) => ({ lat, lng }));

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
      // Remove tracking path when not tracking or insufficient points
      if (trackingPathRef.current) {
        trackingPathRef.current.setMap(null);
        trackingPathRef.current = null;
      }
    }
  }, [isLoaded, isTracking, trackingPath]);

  // Handle navigation line visualization
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    if (navigationLine.length === 2) {
      // Create navigation line from current position to destination
      const lineCoordinates = navigationLine.map(([lat, lng]) => ({ lat, lng }));

      if (!navigationLineRef.current) {
        navigationLineRef.current = new google.maps.Polyline({
          path: lineCoordinates,
          geodesic: true,
          strokeColor: '#10b981', // Green navigation line
          strokeOpacity: 0.8,
          strokeWeight: 3,
          icons: [{
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 0.8,
              scale: 2
            },
            offset: '0',
            repeat: '15px'
          }],
          map: googleMapRef.current,
        });
      } else {
        navigationLineRef.current.setPath(lineCoordinates);
      }
    } else {
      // Remove navigation line when not needed
      if (navigationLineRef.current) {
        navigationLineRef.current.setMap(null);
        navigationLineRef.current = null;
      }
    }
  }, [isLoaded, navigationLine]);

  // Handle replay path visualization and car animation
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    if (isReplaying && replayPath.length > 0) {
      // Create or update replay path
      const pathCoordinates = replayPath.map(([lat, lng]) => ({ lat, lng }));

      if (!replayPathRef.current) {
        replayPathRef.current = new google.maps.Polyline({
          path: pathCoordinates,
          geodesic: true,
          strokeColor: '#8b5cf6', // Purple replay path
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map: googleMapRef.current,
        });
      } else {
        replayPathRef.current.setPath(pathCoordinates);
      }

      // Animate car marker along the path with smooth transitions
      const currentPoint = pathCoordinates[pathCoordinates.length - 1];

      if (!replayMarkerRef.current) {
        replayMarkerRef.current = new google.maps.Marker({
          position: currentPoint,
          map: googleMapRef.current,
          icon: createCarIcon('#8b5cf6'), // Purple for replay
          title: 'Trip Replay Car',
          zIndex: 1000,
        });

        // Add info window for replay marker
        const replayInfoWindow = new google.maps.InfoWindow({
          content: `<div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">🚗 Trip Replay</h3>
              <div style="font-size: 14px; line-height: 1.4;">
                <p><strong>Coordinates:</strong> ${currentPoint.lat.toFixed(6)}, ${currentPoint.lng.toFixed(6)}</p>
                <p><strong>Status:</strong> <span style="margin-left: 4px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #e9d5ff; color: #6b21a8;">Replaying Trip</span></p>
                <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">🎬 Animated trip playback</p>
              </div>
            </div>`,
        });

        replayMarkerRef.current.addListener('click', () => {
          replayInfoWindow.open(googleMapRef.current, replayMarkerRef.current);
        });
      } else {
        // Smooth animation: calculate bearing for car rotation
        const prevPoint = pathCoordinates.length > 1 ? pathCoordinates[pathCoordinates.length - 2] : currentPoint;

        // Calculate bearing (direction) for car rotation
        const bearing = google.maps.geometry.spherical.computeHeading(
          new google.maps.LatLng(prevPoint.lat, prevPoint.lng),
          new google.maps.LatLng(currentPoint.lat, currentPoint.lng)
        );

        // Create rotated car icon
        const rotatedIcon = {
          ...createCarIcon('#8b5cf6'),
          rotation: bearing,
        };

        // Update marker position and rotation
        replayMarkerRef.current.setPosition(currentPoint);
        replayMarkerRef.current.setIcon(rotatedIcon);

        // Update info window content
        const infoWindow = replayMarkerRef.current.get('infoWindow');
        if (infoWindow) {
          infoWindow.setContent(`<div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">🚗 Trip Replay</h3>
              <div style="font-size: 14px; line-height: 1.4;">
                <p><strong>Coordinates:</strong> ${currentPoint.lat.toFixed(6)}, ${currentPoint.lng.toFixed(6)}</p>
                <p><strong>Status:</strong> <span style="margin-left: 4px; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #e9d5ff; color: #6b21a8;">Replaying Trip</span></p>
                <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">🎬 Animated trip playback</p>
              </div>
            </div>`);
        }
      }

      // Auto-follow the car during replay with smooth camera movement
      if (googleMapRef.current && currentPoint) {
        googleMapRef.current.panTo(currentPoint);
      }
    } else {
      // Remove replay path and marker when not replaying
      if (replayPathRef.current) {
        replayPathRef.current.setMap(null);
        replayPathRef.current = null;
      }
      if (replayMarkerRef.current) {
        replayMarkerRef.current.setMap(null);
        replayMarkerRef.current = null;
      }
    }
  }, [isLoaded, isReplaying, replayPath, createCarIcon]);

  // Center map on selected task or driver location
  useEffect(() => {
    if (!isLoaded || !googleMapRef.current) return;

    let centerPos: google.maps.LatLngLiteral | null = null;
    let newZoom: number | null = null;

    if (propCenter) {
      centerPos = propCenter;
      newZoom = propZoom;
    } else if (selectedTask) {
      centerPos = {
        lat: selectedTask.location.latitude,
        lng: selectedTask.location.longitude
      };
    } else if (driverLocation) {
      centerPos = {
        lat: driverLocation.latitude,
        lng: driverLocation.longitude
      };
    }

    if (centerPos && !followDriver) { // Don't center if following driver
      googleMapRef.current.panTo(centerPos);
      if (newZoom !== null) {
        googleMapRef.current.setZoom(newZoom);
      } else {
        googleMapRef.current.setZoom(15);
      }
    }
  }, [isLoaded, selectedTask, driverLocation, followDriver, propCenter, propZoom]);

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