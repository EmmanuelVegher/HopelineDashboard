"use client";

import { useEffect, useState, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { SosAlert } from '@/ai/schemas/sos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { MapPin, Navigation, Play, Square, Activity, Clock, Route, Target } from 'lucide-react';
import DriverMap from '@/components/driver-map';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLocationStreaming } from '@/hooks/useLocationStreaming';

interface MapTask extends SosAlert {
  assignedAt: Date;
}

interface TrackingStats {
  speed: number;
  distanceTraveled: number;
  timeElapsed: number;
  startTime: Date | null;
  lastPosition: GeolocationPosition | null;
}

export default function DriverMapPage() {
  const [tasks, setTasks] = useState<MapTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<MapTask | null>(null);
  console.log("DriverMapPage: selectedTask:", selectedTask);
  const [mapView, setMapView] = useState<'all' | 'active' | 'resolved'>('all');
  const [trackingStats, setTrackingStats] = useState<TrackingStats>({
    speed: 0,
    distanceTraveled: 0,
    timeElapsed: 0,
    startTime: null,
    lastPosition: null,
  });
  const { toast } = useToast();

  // Initialize geolocation and location streaming hooks
  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000,
  });

  const locationStreaming = useLocationStreaming({
    userId: userId || '',
    batchInterval: 10000,
    minDistanceChange: 50,
  });

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

  // Update tracking statistics when position changes
  useEffect(() => {
    if (geolocation.state.position && locationStreaming.state.isStreaming) {
      const currentPos = geolocation.state.position;
      const lastPos = trackingStats.lastPosition;

      let newDistance = trackingStats.distanceTraveled;
      let newSpeed = 0;

      if (lastPos) {
        const distanceIncrement = calculateDistance(
          lastPos.coords.latitude,
          lastPos.coords.longitude,
          currentPos.coords.latitude,
          currentPos.coords.longitude
        );
        newDistance += distanceIncrement;

        // Calculate speed (m/s) if we have time difference
        const timeDiff = (currentPos.timestamp - lastPos.timestamp) / 1000; // seconds
        if (timeDiff > 0) {
          newSpeed = distanceIncrement / timeDiff;
        }
      }

      const timeElapsed = trackingStats.startTime
        ? (Date.now() - trackingStats.startTime.getTime()) / 1000
        : 0;

      setTrackingStats(prev => ({
        ...prev,
        speed: newSpeed,
        distanceTraveled: newDistance,
        timeElapsed,
        lastPosition: currentPos,
      }));
    }
  }, [geolocation.state.position, locationStreaming.state.isStreaming, trackingStats.lastPosition, trackingStats.startTime, calculateDistance]);

  // Handle start/stop tracking
  const handleStartTracking = useCallback(async () => {
    try {
      await locationStreaming.startStreaming();
      setTrackingStats(prev => ({
        ...prev,
        startTime: new Date(),
        speed: 0,
        distanceTraveled: 0,
        timeElapsed: 0,
        lastPosition: geolocation.state.position,
      }));
      toast({
        title: 'Tracking Started',
        description: 'Live location tracking is now active.',
      });
    } catch (error) {
      toast({
        title: 'Tracking Failed',
        description: 'Failed to start location tracking. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, [locationStreaming, geolocation.state.position, toast]);

  const handleStopTracking = useCallback(() => {
    locationStreaming.stopStreaming();
    setTrackingStats(prev => ({
      ...prev,
      startTime: null,
    }));
    toast({
      title: 'Tracking Stopped',
      description: 'Live location tracking has been stopped.',
    });
  }, [locationStreaming, toast]);

  // Calculate trip progress percentage
  const calculateTripProgress = useCallback(() => {
    if (!selectedTask || !geolocation.state.position || !trackingStats.startTime) {
      return 0;
    }

    const currentPos = geolocation.state.position;
    const destination = selectedTask.location;
    const startPos = trackingStats.lastPosition;

    if (!startPos) return 0;

    const totalDistance = calculateDistance(
      startPos.coords.latitude,
      startPos.coords.longitude,
      destination.latitude,
      destination.longitude
    );

    const remainingDistance = calculateDistance(
      currentPos.coords.latitude,
      currentPos.coords.longitude,
      destination.latitude,
      destination.longitude
    );

    if (totalDistance === 0) return 100;

    const progress = ((totalDistance - remainingDistance) / totalDistance) * 100;
    return Math.max(0, Math.min(100, progress));
  }, [selectedTask, geolocation.state.position, trackingStats.lastPosition, calculateDistance]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'sosAlerts'),
      where('assignedTeam.driverId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const mapTasks: MapTask[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SosAlert;
        mapTasks.push({
          ...data,
          id: doc.id,
          assignedAt: data.timestamp?.toDate() || new Date(),
        });
      });
      setTasks(mapTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const filteredTasks = tasks.filter(task => {
    switch (mapView) {
      case 'active':
        return task.status === 'Active' || task.status === 'Responding';
      case 'resolved':
        return task.status === 'Resolved';
      default:
        return true;
    }
  });


  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-red-500';
      case 'Responding':
        return 'bg-blue-500';
      case 'Resolved':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Driver Map</h1>
        <div className="flex items-center gap-4">
          <Select value={mapView} onValueChange={(value: 'all' | 'active' | 'resolved') => setMapView(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-sm">
            {filteredTasks.length} Task{filteredTasks.length !== 1 ? 's' : ''} Shown
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Live Map View
                {locationStreaming.state.isStreaming && (
                  <Badge variant="default" className="ml-auto">
                    <Activity className="h-3 w-3 mr-1" />
                    Tracking Active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DriverMap
                drivers={[]} // TODO: Add driver locations
                className="h-[500px] rounded-b-lg"
                enableRouting={!!selectedTask && locationStreaming.state.isStreaming}
                currentPosition={
                  geolocation.state.position
                    ? [geolocation.state.position.coords.latitude, geolocation.state.position.coords.longitude]
                    : undefined
                }
                destination={
                  selectedTask
                    ? [selectedTask.location.latitude, selectedTask.location.longitude]
                    : undefined
                }
                showCurrentLocation={locationStreaming.state.isStreaming}
                currentLocationAccuracy={geolocation.state.position?.coords.accuracy}
                onRoutingError={(error) => {
                  toast({
                    title: 'Routing Error',
                    description: error,
                    variant: 'destructive',
                  });
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Task Details Sidebar */}
        <div className="space-y-4">
          {/* Tracking Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Live Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {!locationStreaming.state.isStreaming ? (
                  <Button
                    onClick={handleStartTracking}
                    className="flex-1"
                    disabled={!userId}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Tracking
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopTracking}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Tracking
                  </Button>
                )}
              </div>

              {geolocation.state.position && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Location:</span>
                    <span className="font-mono text-xs">
                      {geolocation.state.position.coords.latitude.toFixed(4)},
                      {geolocation.state.position.coords.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Accuracy:</span>
                    <Badge variant={geolocation.state.position.coords.accuracy < 50 ? "default" : "secondary"}>
                      ±{Math.round(geolocation.state.position.coords.accuracy)}m
                    </Badge>
                  </div>
                </div>
              )}

              {locationStreaming.state.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {locationStreaming.state.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tracking Statistics */}
          {locationStreaming.state.isStreaming && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  Trip Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Activity className="h-4 w-4" />
                    Speed
                  </span>
                  <span className="font-semibold">{(trackingStats.speed * 3.6).toFixed(1)} km/h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Route className="h-4 w-4" />
                    Distance
                  </span>
                  <span className="font-semibold">{(trackingStats.distanceTraveled / 1000).toFixed(2)} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Time
                  </span>
                  <span className="font-semibold">
                    {Math.floor(trackingStats.timeElapsed / 60)}:{(trackingStats.timeElapsed % 60).toFixed(0).padStart(2, '0')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task Selection */}
          {filteredTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Select Task
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedTask?.id || ''}
                  onValueChange={(taskId) => {
                    const task = filteredTasks.find(t => t.id === taskId);
                    setSelectedTask(task || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a task to navigate to" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getTaskStatusColor(task.status)}`} />
                          <span className="truncate">{task.emergencyType}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Task Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTask ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getTaskStatusColor(selectedTask.status)}`} />
                    <Badge variant="outline">{selectedTask.status}</Badge>
                  </div>

                  <div>
                    <h3 className="font-semibold">{selectedTask.emergencyType}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedTask.location.address ||
                        `${selectedTask.location.latitude.toFixed(4)}, ${selectedTask.location.longitude.toFixed(4)}`}
                    </p>
                  </div>

                  {selectedTask.additionalInfo && (
                    <p className="text-sm text-muted-foreground">
                      {selectedTask.additionalInfo}
                    </p>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Assigned: {selectedTask.assignedAt.toLocaleString()}
                  </div>

                  {/* Trip Progress */}
                  {selectedTask && geolocation.state.position && locationStreaming.state.isStreaming && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Trip Progress</span>
                        <span className="text-xs text-muted-foreground">
                          {calculateDistance(
                            geolocation.state.position.coords.latitude,
                            geolocation.state.position.coords.longitude,
                            selectedTask.location.latitude,
                            selectedTask.location.longitude
                          ).toFixed(0)}m remaining
                        </span>
                      </div>
                      <Progress value={calculateTripProgress()} className="h-2" />
                      <div className="text-xs text-center text-muted-foreground">
                        {calculateTripProgress().toFixed(1)}% complete
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {selectedTask.status === 'Active' && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          // TODO: Navigate to tasks page or implement accept here
                          toast({
                            title: 'Navigate to Tasks',
                            description: 'Please go to the Tasks page to accept this task.',
                          });
                        }}
                      >
                        Accept Task
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement navigation
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition((position) => {
                            const url = `https://www.google.com/maps/dir/${position.coords.latitude},${position.coords.longitude}/${selectedTask.location.latitude},${selectedTask.location.longitude}`;
                            window.open(url, '_blank');
                          });
                        }
                      }}
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      Navigate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a task on the map to view details</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Active Tasks</span>
                <Badge variant="destructive">
                  {tasks.filter(t => t.status === 'Active' || t.status === 'Responding').length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Completed Today</span>
                <Badge variant="default">
                  {tasks.filter(t =>
                    t.status === 'Resolved' &&
                    t.assignedAt.toDateString() === new Date().toDateString()
                  ).length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Tasks</span>
                <Badge variant="outline">{tasks.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}