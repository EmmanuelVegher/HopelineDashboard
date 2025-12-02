import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet-routing-machine';
import { Driver } from '@/lib/data';
import { cn } from '@/lib/utils';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Type declarations for leaflet-routing-machine
declare module 'leaflet' {
  namespace routing {
    class Control extends L.Control {
      constructor(options?: any);
      setWaypoints(waypoints: L.LatLng[]): this;
      on(event: string, callback: (e: any) => void): this;
    }

    function control(options?: any): Control;
  }
}


// Custom marker icons based on status and GPS
const createMarkerIcon = (status: Driver['status'], gpsStatus?: Driver['gpsStatus'], isOffline?: boolean) => {
  let color = '#6b7280'; // gray for off duty
  let borderColor = 'white';
  let borderWidth = 2;

  // Determine base color by status
  switch (status) {
    case 'Available':
      color = '#10b981'; // green
      break;
    case 'En Route':
    case 'Assisting':
      color = '#3b82f6'; // blue
      break;
    case 'Emergency':
      color = '#ef4444'; // red
      break;
  }

  // Modify appearance based on GPS status
  if (isOffline || gpsStatus === 'lost') {
    borderColor = '#ef4444'; // red border for lost/offline
    borderWidth = 3;
  } else if (gpsStatus === 'weak') {
    borderColor = '#f59e0b'; // amber border for weak signal
    borderWidth = 3;
  } else if (gpsStatus === 'good') {
    borderColor = '#10b981'; // green border for good signal
    borderWidth = 2;
  }

  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: ${borderWidth}px solid ${borderColor}; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
    className: 'custom-marker-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// Component to handle map centering
function MapController({ selectedDriver }: { selectedDriver?: Driver }) {
  const map = useMap();

  useEffect(() => {
    if (selectedDriver && typeof selectedDriver.latitude === 'number' && typeof selectedDriver.longitude === 'number' && !isNaN(selectedDriver.latitude) && !isNaN(selectedDriver.longitude)) {
      map.setView([selectedDriver.latitude, selectedDriver.longitude], 15);
    }
  }, [selectedDriver, map]);

  return null;
}

// Component to handle routing
function RoutingController({
  enableRouting,
  currentPosition,
  destination,
  onRoutingError
}: {
  enableRouting: boolean;
  currentPosition?: [number, number];
  destination?: [number, number];
  onRoutingError?: (error: string) => void;
}) {
  const map = useMap();
  const [routingControl, setRoutingControl] = useState<L.routing.Control | null>(null);

  useEffect(() => {
    if (!enableRouting || !currentPosition || !destination) {
      // Remove existing routing control
      if (routingControl) {
        map.removeControl(routingControl);
        setRoutingControl(null);
      }
      return;
    }

    // If control exists, update waypoints instead of recreating
    if (routingControl) {
      try {
        routingControl.setWaypoints([
          L.latLng(currentPosition[0], currentPosition[1]),
          L.latLng(destination[0], destination[1])
        ]);
        return;
      } catch (error) {
        console.error('Error updating waypoints:', error);
        // Fall through to recreate control
      }
    }

    // Remove existing control if it exists
    if (routingControl) {
      map.removeControl(routingControl);
    }

    try {
      // Create new routing control
      const control = L.routing.control({
        waypoints: [
          L.latLng(currentPosition[0], currentPosition[1]),
          L.latLng(destination[0], destination[1])
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        createMarker: () => null, // Don't create default markers
        lineOptions: {
          styles: [{ color: '#3b82f6', weight: 6, opacity: 0.8 }]
        },
        show: false, // Hide the routing panel
        collapsible: false,
      }).addTo(map);

      setRoutingControl(control);

      // Handle routing events
      control.on('routingerror', (e) => {
        console.error('[DriverMap] Routing error:', e.error);
        onRoutingError?.(`Routing failed: ${e.error.message || 'Unknown error'}`);
      });

      control.on('routesfound', (e) => {
        console.log('[DriverMap] Route found:', e.routes[0]);
        // Route is automatically displayed
      });

    } catch (error) {
      console.error('Error creating routing control:', error);
      onRoutingError?.('Failed to initialize routing');
    }

    return () => {
      if (routingControl) {
        map.removeControl(routingControl);
      }
    };
  }, [enableRouting, currentPosition, destination, map, onRoutingError, routingControl]);

  return null;
}

interface LocationHistoryPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

interface DriverMapProps {
  drivers: Driver[];
  selectedDriver?: Driver;
  onDriverSelect?: (driver: Driver) => void;
  className?: string;
  // Routing props
  enableRouting?: boolean;
  currentPosition?: [number, number];
  destination?: [number, number];
  onRoutingError?: (error: string) => void;
  // Live tracking props
  showCurrentLocation?: boolean;
  currentLocationAccuracy?: number;
  // Movement trails
  showMovementTrails?: boolean;
  locationHistory?: { [driverId: string]: LocationHistoryPoint[] };
}

export default function DriverMap({
  drivers,
  selectedDriver,
  onDriverSelect,
  className = 'h-96 w-full',
  enableRouting = false,
  currentPosition,
  destination,
  onRoutingError,
  showCurrentLocation = false,
  currentLocationAccuracy,
  showMovementTrails = false,
  locationHistory = {}
}: DriverMapProps) {

  console.log('[DriverMap] Props received:', {
    driversCount: drivers.length,
    showCurrentLocation,
    currentPosition,
    enableRouting,
    destination,
    currentLocationAccuracy
  });

  // Default center (can be adjusted based on your location)
  const defaultCenter: [number, number] = [6.5244, 3.3792]; // Lagos, Nigeria

  const validDrivers = drivers.filter(driver =>
    typeof driver.latitude === 'number' &&
    typeof driver.longitude === 'number' &&
    !isNaN(driver.latitude) &&
    !isNaN(driver.longitude)
  );

  console.log('[DriverMap] Valid drivers count:', validDrivers.length);

  const handleMapReady = useCallback(() => {
    // Map is ready - callback for whenReady prop
  }, []);

  // Create route polylines
  const routePolylines = validDrivers
    .filter(driver =>
      driver.destinationLat !== undefined &&
      driver.destinationLng !== undefined &&
      (driver.status === 'En Route' || driver.status === 'Assisting')
    )
    .map((driver) => ({
      positions: [
        [driver.latitude, driver.longitude],
        [driver.destinationLat!, driver.destinationLng!]
      ] as [number, number][],
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7,
    }));

  // Create movement trail polylines
  const trailPolylines = showMovementTrails ? validDrivers
    .filter(driver => locationHistory[driver.id] && locationHistory[driver.id].length > 1)
    .map((driver) => ({
      positions: locationHistory[driver.id].map(point => [point.latitude, point.longitude] as [number, number]),
      color: driver.status === 'Available' ? '#10b981' :
             driver.status === 'Emergency' ? '#ef4444' :
             driver.status === 'En Route' || driver.status === 'Assisting' ? '#3b82f6' : '#6b7280',
      weight: 2,
      opacity: 0.6,
      dashArray: '5, 5', // Dashed line for trails
    })) : [];

  return (
    <div className={cn(className, "relative overflow-hidden")}>
      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        whenReady={handleMapReady}
        className="leaflet-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController selectedDriver={selectedDriver} />

        <RoutingController
          enableRouting={enableRouting}
          currentPosition={currentPosition}
          destination={destination}
          onRoutingError={onRoutingError}
        />

        {/* Current location marker */}
        {(() => {
          const shouldRenderCurrentLocation = showCurrentLocation && currentPosition;
          console.log('[DriverMap] Current location marker check:', {
            showCurrentLocation,
            hasCurrentPosition: !!currentPosition,
            currentPosition,
            shouldRender: shouldRenderCurrentLocation
          });
          return shouldRenderCurrentLocation && (
            <Marker
              position={currentPosition}
              icon={L.divIcon({
                html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(59, 130, 246, 0.5); position: relative;">
                          <div style="position: absolute; top: -8px; left: -8px; width: 32px; height: 32px; border: 2px solid #3b82f6; border-radius: 50%; opacity: 0.3;"></div>
                        </div>`,
                className: 'current-location-marker',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            >
              <Popup>
                <div style={{ padding: '8px', minWidth: '200px' }}>
                  <h3 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>Your Current Location</h3>
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                    <p><strong>Coordinates:</strong> {currentPosition[0].toFixed(6)}, {currentPosition[1].toFixed(6)}</p>
                    {currentLocationAccuracy && (
                      <p><strong>Accuracy:</strong> ±{Math.round(currentLocationAccuracy)} meters</p>
                    )}
                    <p><strong>Status:</strong>
                      <span style={{
                        marginLeft: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af'
                      }}>
                        Live Tracking
                      </span>
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })()}

        {validDrivers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.latitude, driver.longitude]}
            icon={createMarkerIcon(driver.status, driver.gpsStatus, driver.isOffline)}
            eventHandlers={{
              click: () => {
                onDriverSelect?.(driver);
              },
            }}
          >
            <Popup>
              <div style={{ padding: '8px', minWidth: '200px' }}>
                <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>{driver.name}</h3>
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                  <p><strong>Vehicle:</strong> {driver.vehicle}</p>
                  <p><strong>Status:</strong>
                    <span style={{
                      marginLeft: '4px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor:
                        driver.status === 'Available' ? '#d1fae5' :
                        driver.status === 'Emergency' ? '#fee2e2' :
                        driver.status === 'En Route' || driver.status === 'Assisting' ? '#dbeafe' :
                        '#f3f4f6',
                      color:
                        driver.status === 'Available' ? '#065f46' :
                        driver.status === 'Emergency' ? '#991b1b' :
                        driver.status === 'En Route' || driver.status === 'Assisting' ? '#1e40af' :
                        '#374151'
                    }}>
                      {driver.status}
                    </span>
                  </p>
                  <p><strong>Location:</strong> {driver.location}</p>
                  <p><strong>Task:</strong> {driver.task}</p>
                  <p><strong>Phone:</strong> {driver.phone}</p>
                  <p><strong>Last Update:</strong> {typeof driver.lastUpdate === 'string' ? driver.lastUpdate : new Date(driver.lastUpdate?.seconds * 1000 || Date.now()).toLocaleTimeString()}</p>
                  {driver.locationAccuracy && (
                    <p><strong>Accuracy:</strong> ±{Math.round(driver.locationAccuracy)} meters</p>
                  )}
                  {driver.trackingStatus && (
                    <p><strong>Tracking:</strong>
                      <span style={{
                        marginLeft: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor:
                          driver.trackingStatus === 'active' ? '#d1fae5' :
                          driver.trackingStatus === 'offline' ? '#fed7d7' :
                          driver.trackingStatus === 'error' ? '#fee2e2' :
                          '#f3f4f6',
                        color:
                          driver.trackingStatus === 'active' ? '#065f46' :
                          driver.trackingStatus === 'offline' ? '#9b2c2c' :
                          driver.trackingStatus === 'error' ? '#991b1b' :
                          '#374151'
                      }}>
                        {driver.trackingStatus}
                      </span>
                    </p>
                  )}
                  {driver.gpsStatus && (
                    <p><strong>GPS:</strong>
                      <span style={{
                        marginLeft: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor:
                          driver.gpsStatus === 'good' ? '#d1fae5' :
                          driver.gpsStatus === 'weak' ? '#fef3c7' :
                          driver.gpsStatus === 'lost' ? '#fee2e2' :
                          '#f3f4f6',
                        color:
                          driver.gpsStatus === 'good' ? '#065f46' :
                          driver.gpsStatus === 'weak' ? '#92400e' :
                          driver.gpsStatus === 'lost' ? '#991b1b' :
                          '#374151'
                      }}>
                        {driver.gpsStatus}
                      </span>
                      {driver.signalStrength !== undefined && (
                        <span style={{ marginLeft: '4px', fontSize: '11px', color: '#6b7280' }}>
                          ({driver.signalStrength}%)
                        </span>
                      )}
                    </p>
                  )}
                  {driver.isOffline && (
                    <p style={{ color: '#dc2626', fontSize: '12px', fontWeight: '500' }}>
                      ⚠️ Device appears offline
                    </p>
                  )}
                  {driver.vehicleImageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <img
                        src={driver.vehicleImageUrl}
                        alt={`Vehicle for ${driver.name}`}
                        style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render route polylines */}
        {routePolylines.map((polyline, index) => (
          <Polyline
            key={`route-${index}`}
            positions={polyline.positions}
            pathOptions={{
              color: polyline.color,
              weight: polyline.weight,
              opacity: polyline.opacity,
            }}
          />
        ))}

        {/* Render movement trail polylines */}
        {trailPolylines.map((polyline, index) => (
          <Polyline
            key={`trail-${index}`}
            positions={polyline.positions}
            pathOptions={{
              color: polyline.color,
              weight: polyline.weight,
              opacity: polyline.opacity,
              dashArray: polyline.dashArray,
            }}
          />
        ))}
      </MapContainer>

      {validDrivers.length === 0 && drivers.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-[1000]">
          <div className="bg-white p-4 rounded-lg shadow-lg text-center">
            <p className="text-muted-foreground">No driver coordinates available for mapping.</p>
            <p className="text-sm text-muted-foreground mt-1">Drivers without location data cannot be displayed on the map.</p>
          </div>
        </div>
      )}
    </div>
  );
}