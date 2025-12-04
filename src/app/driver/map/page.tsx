"use client";

import { useEffect, useState, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { SosAlert } from '@/ai/schemas/sos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { MapPin, Navigation, Play, Square, Activity, Clock, Route, Target, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import GoogleMap from '@/components/google-map';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
// Location streaming removed to prevent browser crashes
// import { useLocationStreaming } from '@/hooks/useLocationStreaming';

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

interface DriverLocation {
  latitude: number;
  longitude: number;
  vehicleColor?: string;
}

export default function DriverMapPage() {
  const [tasks, setTasks] = useState<MapTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<MapTask | null>(null);
  console.log("DriverMapPage: selectedTask:", selectedTask);
  const [mapView, setMapView] = useState<'all' | 'active' | 'resolved'>('all');
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
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

  // Location streaming removed to prevent browser crashes
  // const locationStreaming = useLocationStreaming({
  //   userId: userId || '',
  //   batchInterval: 10000,
  //   minDistanceChange: 50,
  // });

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

  // Location streaming removed to prevent browser crashes
  // Update tracking statistics when position changes
  // useEffect(() => {
  //   if (geolocation.state.position && locationStreaming.state.isStreaming) {
  //     const currentPos = geolocation.state.position;
  //     const lastPos = trackingStats.lastPosition;

  //     let newDistance = trackingStats.distanceTraveled;
  //     let newSpeed = 0;

  //     if (lastPos) {
  //       const distanceIncrement = calculateDistance(
  //         lastPos.coords.latitude,
  //         lastPos.coords.longitude,
  //         currentPos.coords.latitude,
  //         currentPos.coords.longitude
  //       );
  //       newDistance += distanceIncrement;

  //       // Calculate speed (m/s) if we have time difference
  //       const timeDiff = (currentPos.timestamp - lastPos.timestamp) / 1000; // seconds
  //       if (timeDiff > 0) {
  //         newSpeed = distanceIncrement / timeDiff;
  //       }
  //     }

  //     const timeElapsed = trackingStats.startTime
  //       ? (Date.now() - trackingStats.startTime.getTime()) / 1000
  //       : 0;

  //     setTrackingStats(prev => ({
  //       ...prev,
  //       speed: newSpeed,
  //       distanceTraveled: newDistance,
  //       timeElapsed,
  //       lastPosition: currentPos,
  //     }));
  //   }
  // }, [geolocation.state.position, locationStreaming.state.isStreaming, trackingStats.lastPosition, trackingStats.startTime, calculateDistance]);

  // Location streaming removed to prevent browser crashes
  // Handle start/stop tracking
  // const handleStartTracking = useCallback(async () => {
  //   try {
  //     await locationStreaming.startStreaming();
  //     setTrackingStats(prev => ({
  //       ...prev,
  //       startTime: new Date(),
  //       speed: 0,
  //       distanceTraveled: 0,
  //       timeElapsed: 0,
  //       lastPosition: geolocation.state.position,
  //     }));
  //     toast({
  //       title: 'Tracking Started',
  //       description: 'Live location tracking is now active.',
  //     });
  //   } catch (error) {
  //     toast({
  //       title: 'Tracking Failed',
  //       description: 'Failed to start location tracking. Please check permissions.',
  //       variant: 'destructive',
  //     });
  //   }
  // }, [locationStreaming, geolocation.state.position, toast]);

  // const handleStopTracking = useCallback(() => {
  //   locationStreaming.stopStreaming();
  //   setTrackingStats(prev => ({
  //     ...prev,
  //     startTime: null,
  //   }));
  //   toast({
  //     title: 'Tracking Stopped',
  //     description: 'Live location tracking has been stopped.',
  //   });
  // }, [locationStreaming, toast]);

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

  // Fetch driver's location from users collection
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        if (userData.latitude && userData.longitude &&
            userData.latitude !== 0 && userData.longitude !== 0) {
          setDriverLocation({
            latitude: userData.latitude,
            longitude: userData.longitude,
            vehicleColor: userData.vehicleDetails?.color || 'White with blue and orange humanitarian markings'
          });
        }
      }
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'Responding':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'In Transit':
        return <MapPin className="h-4 w-4 text-orange-500" />;
      case 'Resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-red-100 text-red-800';
      case 'Responding':
        return 'bg-blue-100 text-blue-800';
      case 'In Transit':
        return 'bg-orange-100 text-orange-800';
      case 'Resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const acceptTask = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'sosAlerts', taskId);
      await updateDoc(taskRef, {
        status: 'Responding',
      });
      toast({
        title: 'Task Accepted',
        description: 'You have accepted the SOS task.',
      });
    } catch (error) {
      console.error('Error accepting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: 'Resolved' | 'In Transit' | 'Responding') => {
    try {
      const taskRef = doc(db, 'sosAlerts', taskId);
      await updateDoc(taskRef, {
        status: newStatus,
      });
      toast({
        title: 'Status Updated',
        description: `Task status updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status. Please try again.',
        variant: 'destructive',
      });
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
        <h1 className="text-3xl font-bold">Pilot's Task</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
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
            {tasks.filter(t => t.status === 'Active' || t.status === 'Responding').length > 0 && (
              <div className="relative">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {tasks.filter(t => t.status === 'Active' || t.status === 'Responding').length}
                  </span>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
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
                {/* Location streaming removed to prevent browser crashes */}
                {/* {locationStreaming.state.isStreaming && (
                  <Badge variant="default" className="ml-auto">
                    <Activity className="h-3 w-3 mr-1" />
                    Tracking Active
                  </Badge>
                )} */}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <GoogleMap
                drivers={[]} // TODO: Add driver locations
                className="h-[500px] rounded-b-lg"
                selectedTask={selectedTask}
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
                showCurrentLocation={true}
                currentLocationAccuracy={geolocation.state.position?.coords.accuracy}
                driverLocation={driverLocation}
                defaultCenter={
                  driverLocation
                    ? [driverLocation.latitude, driverLocation.longitude]
                    : undefined
                }
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
                {/* Location streaming removed to prevent browser crashes */}
                <Button
                  disabled
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Tracking Disabled
                </Button>
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

              {/* Location streaming removed to prevent browser crashes */}
              {/* {locationStreaming.state.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {locationStreaming.state.error}
                </div>
              )} */}
            </CardContent>
          </Card>

          {/* Location streaming removed to prevent browser crashes */}
          {/* Tracking Statistics */}
          {/* {locationStreaming.state.isStreaming && (
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
          )} */}

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

                  {/* Location streaming removed to prevent browser crashes */}
                  {/* Trip Progress */}
                  {/* {selectedTask && geolocation.state.position && locationStreaming.state.isStreaming && (
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
                  )} */}

                  <div className="flex flex-col gap-2 pt-2">
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

                    {selectedTask.status === 'Active' && (
                      <Button
                        size="sm"
                        className="w-full"
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

                    {selectedTask.status === 'Responding' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            // Start Trip - update status to In Transit
                            updateTaskStatus(selectedTask.id, 'In Transit');
                            toast({
                              title: 'Trip Started',
                              description: 'Task is now in progress.',
                            });
                          }}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start Trip
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            // Mark as Resolved - update status to Resolved
                            updateTaskStatus(selectedTask.id, 'Resolved');
                            setSelectedTask(null); // Clear selection after resolving
                            toast({
                              title: 'Task Resolved',
                              description: 'Task has been marked as resolved.',
                            });
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark as Resolved
                        </Button>
                      </div>
                    )}
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

          {/* SOS Alert Cards - Commented out as per requirements */}
          {/* <div className="space-y-4">
            <h3 className="text-lg font-semibold">SOS Alerts</h3>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        SOS Alert
                      </CardTitle>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{task.emergencyType}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.location.address || `${task.location.latitude.toFixed(4)}, ${task.location.longitude.toFixed(4)}`}
                        </p>
                      </div>
                    </div>

                    {task.additionalInfo && (
                      <p className="text-xs text-muted-foreground">
                        {task.additionalInfo}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {task.assignedAt.toLocaleString()}
                    </div>

                    <div className="flex gap-2 pt-2">
                      {task.status === 'Active' && (
                        <Button
                          size="sm"
                          className="flex-1 text-xs"
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
                      {task.status === 'Responding' && (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => {
                              // Simplified start trip - just update status
                              updateTaskStatus(task.id, 'In Transit');
                              setTrackingTaskId(task.id);
                              toast({
                                title: 'Trip Started',
                                description: 'Task is now in progress.',
                              });
                            }}
                          >
                            Start Trip
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                            onClick={() => updateTaskStatus(task.id, 'Resolved')}
                          >
                            Mark as Resolved
                          </Button>
                        </>
                      )}
                      {task.status === 'In Transit' && (
                        <>
                          <div className="flex-1 text-xs text-green-600 flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            Trip In Progress
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs"
                            onClick={() => {
                              updateTaskStatus(task.id, 'Responding');
                              setTrackingTaskId(null);
                              toast({
                                title: 'Trip Stopped',
                                description: 'Task has been stopped.',
                              });
                            }}
                          >
                            Stop Trip
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <h4 className="text-sm font-medium mb-1">No Active Tasks</h4>
                  <p className="text-xs text-muted-foreground">
                    You have no assigned SOS alerts at the moment.
                  </p>
                </CardContent>
              </Card>
            )}
          </div> */}

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