"use client";

import { useEffect, useState, useCallback } from 'react';
import { db, auth, messaging } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { SosAlert } from '@/ai/schemas/sos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, AlertTriangle, CheckCircle, XCircle, Navigation, Play, Square } from 'lucide-react';
import DriverMap from '@/components/driver-map';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLocationStreaming } from '@/hooks/useLocationStreaming';

interface AssignedTask extends SosAlert {
  assignedAt: Date;
}

export default function DriverPage() {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [trackingTaskId, setTrackingTaskId] = useState<string | null>(null);
  const [destination, setDestination] = useState<[number, number] | undefined>(undefined);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const { toast } = useToast();

  // Geolocation hooks
  const geolocation = useGeolocation();
  const locationStreaming = useLocationStreaming({
    userId: userId || '',
    batchInterval: 10000, // 10 seconds
    minDistanceChange: 50, // 50 meters
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

  // Calculate estimated time of arrival (simple estimation based on average speed)
  const calculateETA = useCallback((distance: number, averageSpeedKmh: number = 30): number => {
    // Convert distance to km and calculate time in minutes
    const distanceKm = distance / 1000;
    const timeHours = distanceKm / averageSpeedKmh;
    return Math.round(timeHours * 60); // Return minutes
  }, []);

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
      const assignedTasks: AssignedTask[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SosAlert;
        assignedTasks.push({
          ...data,
          id: doc.id,
          assignedAt: data.timestamp?.toDate() || new Date(),
        });
      });
      setTasks(assignedTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Push notification setup
  useEffect(() => {
    if (!userId) return;

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          });
          console.log('FCM token:', token);

          // Send FCM token to server to associate with user
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            fcmToken: token,
            lastTokenUpdate: new Date()
          });

          toast({
            title: 'Notifications Enabled',
            description: 'You will receive push notifications for new tasks.',
          });
        }
      } catch (error) {
        console.error('Error getting FCM token:', error);
        toast({
          title: 'Notification Setup Failed',
          description: 'Could not enable push notifications. Please try again.',
          variant: 'destructive',
        });
      }
    };

    requestPermission();

    // Listen for messages
    const unsubscribeMessage = onMessage(messaging, (payload) => {
      console.log('Message received:', payload);
      toast({
        title: payload.notification?.title || 'New Notification',
        description: payload.notification?.body,
      });
    });

    return () => unsubscribeMessage();
  }, [userId, toast]);

  // Update driver location when tracking using the new streaming hook
  useEffect(() => {
    console.log('[DriverPage] Location streaming useEffect triggered:', {
      trackingTaskId,
      userId,
      hasLocationStreaming: !!locationStreaming
    });

    if (trackingTaskId && userId) {
      console.log('[DriverPage] Starting location streaming via useEffect');
      locationStreaming.startStreaming();
    } else {
      console.log('[DriverPage] Stopping location streaming via useEffect');
      locationStreaming.stopStreaming();
    }
  }, [trackingTaskId, userId, locationStreaming]);

  // Location streaming error handling
  useEffect(() => {
    if (locationStreaming.state.error && trackingTaskId) {
      toast({
        title: 'Location Error',
        description: locationStreaming.state.error,
        variant: 'destructive',
      });
      // Stop tracking on error
      locationStreaming.stopStreaming();
      setTrackingTaskId(null);
      // Update status back to Responding
      updateTaskStatus(trackingTaskId, 'Responding');
    }
  }, [locationStreaming.state.error, trackingTaskId, toast, locationStreaming]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'Responding':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'In Transit':
        return <Navigation className="h-4 w-4 text-orange-500" />;
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

  const updateTaskStatus = async (taskId: string, newStatus: 'Resolved' | 'Responding' | 'In Transit') => {
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

  const startTrip = async (taskId: string) => {
    console.log('[DriverPage] startTrip called with taskId:', taskId);
    try {
      // Find the task and set destination
      const task = tasks.find(t => t.id === taskId);
      console.log('[DriverPage] Found task:', task ? { id: task.id, status: task.status } : 'null');
      if (task) {
        setDestination([task.location.latitude, task.location.longitude]);
        console.log('[DriverPage] Set destination:', [task.location.latitude, task.location.longitude]);
      }

      // Start location streaming (handles permission internally)
      console.log('[DriverPage] Calling locationStreaming.startStreaming()');
      await locationStreaming.startStreaming();
      console.log('[DriverPage] locationStreaming.startStreaming() completed');

      // Update task status to In Transit
      console.log('[DriverPage] Updating task status to In Transit');
      await updateTaskStatus(taskId, 'In Transit');

      // Set tracking task
      console.log('[DriverPage] Setting trackingTaskId to:', taskId);
      setTrackingTaskId(taskId);

      toast({
        title: 'Trip Started',
        description: 'Live location tracking and navigation have begun.',
      });
      console.log('[DriverPage] Trip started successfully');
    } catch (error) {
      console.error('[DriverPage] Error starting trip:', error);
      toast({
        title: 'Error',
        description: 'Failed to start trip. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const stopTrip = async (taskId: string) => {
    try {
      // Stop location streaming
      locationStreaming.stopStreaming();

      // Update task status back to Responding
      await updateTaskStatus(taskId, 'Responding');

      // Clear tracking task
      setTrackingTaskId(null);

      // Clear destination and routing error
      setDestination(undefined);
      setRoutingError(null);

      toast({
        title: 'Trip Stopped',
        description: 'Location tracking has been stopped.',
      });
    } catch (error) {
      console.error('Error stopping trip:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop trip. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRoutingError = (error: string) => {
    setRoutingError(error);
    toast({
      title: 'Routing Error',
      description: error,
      variant: 'destructive',
    });
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
        <h1 className="text-3xl font-bold">Driver Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          {tasks.length} Active Task{tasks.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Map Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Live Map & Tracking
          </CardTitle>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={locationStreaming.state.isStreaming ? "default" : "secondary"} className="text-xs">
                {locationStreaming.state.isStreaming ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                    Live Tracking Active
                  </>
                ) : (
                  'Tracking Inactive'
                )}
              </Badge>
              {trackingTaskId && (
                <Badge variant="outline" className="text-xs">
                  In Transit
                </Badge>
              )}
            </div>
            {locationStreaming.state.lastUpdate && (
              <p className="text-xs text-muted-foreground">
                Last update: {locationStreaming.state.lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DriverMap
            drivers={[]} // We'll show current driver location separately
            className="h-96"
            enableRouting={!!trackingTaskId}
            currentPosition={geolocation.state.position ? [geolocation.state.position.coords.latitude, geolocation.state.position.coords.longitude] : undefined}
            destination={destination}
            onRoutingError={handleRoutingError}
          />

          {/* Current Location Display */}
          {geolocation.state.position && (
            <div className="p-4 bg-blue-50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-800">Current Location</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-blue-600">
                    Lat: {geolocation.state.position.coords.latitude.toFixed(6)}
                  </p>
                  <p className="text-blue-600">
                    Lng: {geolocation.state.position.coords.longitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-blue-600">
                    Accuracy: ±{Math.round(geolocation.state.position.coords.accuracy)}m
                  </p>
                  {geolocation.state.position.coords.speed !== null && (
                    <p className="text-blue-600">
                      Speed: {Math.round(geolocation.state.position.coords.speed * 3.6)} km/h
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Trip Information */}
          {trackingTaskId && destination && geolocation.state.position && (
            <div className="p-4 bg-green-50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-800">Trip Information</p>
              </div>
              <div className="space-y-2 text-xs">
                {(() => {
                  const distance = calculateDistance(
                    geolocation.state.position.coords.latitude,
                    geolocation.state.position.coords.longitude,
                    destination[0],
                    destination[1]
                  );
                  const eta = calculateETA(distance);

                  return (
                    <>
                      <p className="text-green-700">
                        Distance to destination: {Math.round(distance)} meters ({(distance / 1000).toFixed(1)} km)
                      </p>
                      <p className="text-green-700">
                        Estimated time: {eta} minutes (at 30 km/h average)
                      </p>
                      <p className="text-green-700">
                        Destination: {destination[0].toFixed(4)}, {destination[1].toFixed(4)}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Routing Error */}
          {routingError && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 text-sm">Navigation Fallback</h4>
              <p className="text-xs text-yellow-700 mt-1">
                Routing service unavailable. Use GPS coordinates for navigation:
                {trackingTaskId && (() => {
                  const task = tasks.find(t => t.id === trackingTaskId);
                  return task ? ` ${task.location.latitude.toFixed(4)}, ${task.location.longitude.toFixed(4)}` : '';
                })()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Tasks */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
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
                  <p className="font-medium">{task.emergencyType}</p>
                  <p className="text-sm text-muted-foreground">
                    {task.location.address || `${task.location.latitude.toFixed(4)}, ${task.location.longitude.toFixed(4)}`}
                  </p>
                </div>
              </div>

              {task.additionalInfo && (
                <p className="text-sm text-muted-foreground">
                  {task.additionalInfo}
                </p>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {task.assignedAt.toLocaleString()}
              </div>

              <div className="flex gap-2 pt-2">
                {task.status === 'Active' && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => acceptTask(task.id)}
                  >
                    Accept Task
                  </Button>
                )}
                {task.status === 'Responding' && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => startTrip(task.id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start Trip
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => updateTaskStatus(task.id, 'Resolved')}
                    >
                      Mark as Resolved
                    </Button>
                  </>
                )}
                {task.status === 'In Transit' && (
                  <>
                    <div className="flex-1 text-sm text-green-600 flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      {locationStreaming.state.isStreaming ? 'Live Tracking Active' : 'Tracking Starting...'}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => stopTrip(task.id)}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop Trip
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Active Tasks</h3>
            <p className="text-muted-foreground">
              You have no assigned SOS alerts at the moment. You'll be notified when new tasks are assigned.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}