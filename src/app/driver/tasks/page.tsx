"use client";

import { useEffect, useState } from 'react';
import { db, auth, messaging } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { SosAlert } from '@/ai/schemas/sos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import DriverMap from '@/components/driver-map';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLocationStreaming } from '@/hooks/useLocationStreaming';

interface AssignedTask extends SosAlert {
  assignedAt: Date;
}

export default function DriverTasksPage() {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [trackingTaskId, setTrackingTaskId] = useState<string | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [destination, setDestination] = useState<[number, number] | undefined>(undefined);
  const { toast } = useToast();
  const geolocation = useGeolocation();
  const locationStreaming = useLocationStreaming({
    userId: userId || '',
    batchInterval: 10000, // 10 seconds
    minDistanceChange: 50, // 50 meters
  });

  console.log("DriverTasksPage: Component mounted");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log("DriverTasksPage: Auth state changed, user:", user ? user.uid : null);
      if (user) {
        setUserId(user.uid);
        // Start geolocation watching for map display
        geolocation.startWatching();
      } else {
        setUserId(null);
        geolocation.stopWatching();
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [geolocation]);

  useEffect(() => {
    if (!userId) return;

    console.log("DriverTasksPage: Setting up tasks listener for userId:", userId);

    const q = query(
      collection(db, 'sosAlerts'),
      where('assignedTeam.driverId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log("DriverTasksPage: Received tasks snapshot, count:", querySnapshot.size);
      const assignedTasks: AssignedTask[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SosAlert;
        assignedTasks.push({
          ...data,
          id: doc.id,
          assignedAt: data.timestamp?.toDate() || new Date(),
        });
      });
      console.log("DriverTasksPage: Processed tasks:", assignedTasks.length);
      setTasks(assignedTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Update driver location when tracking using the new streaming hook
  useEffect(() => {
    if (trackingTaskId && userId) {
      locationStreaming.startStreaming();
    } else {
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
          // TODO: Send token to server to associate with user
        }
      } catch (error) {
        console.error('Error getting FCM token:', error);
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

  const startTrip = async (taskId: string) => {
    try {
      // Find the task and set destination
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setDestination([task.location.latitude, task.location.longitude]);
      }

      // Start location streaming (handles permission internally)
      await locationStreaming.startStreaming();

      // Update task status to In Transit
      await updateTaskStatus(taskId, 'In Transit');

      // Set tracking task
      setTrackingTaskId(taskId);

      toast({
        title: 'Trip Started',
        description: 'Live location tracking and navigation have begun.',
      });
    } catch (error) {
      console.error('Error starting trip:', error);
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
        <h1 className="text-3xl font-bold">Driver Tasks</h1>
        <Badge variant="outline" className="text-sm">
          {tasks.length} Active Task{tasks.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Map Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Live Map</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const driverMapProps = {
              drivers: [], // TODO: Add driver locations
              className: "h-96",
              enableRouting: !!trackingTaskId,
              currentPosition: geolocation.state.position ? [geolocation.state.position.coords.latitude, geolocation.state.position.coords.longitude] : undefined,
              destination: destination,
              onRoutingError: handleRoutingError,
              showCurrentLocation: true, // Enable current location marker
            };
            console.log("DriverTasksPage: DriverMap props:", driverMapProps);
            return <DriverMap {...driverMapProps} />;
          })()}
          {routingError && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800">Navigation Fallback</h4>
              <p className="text-sm text-yellow-700 mt-1">
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