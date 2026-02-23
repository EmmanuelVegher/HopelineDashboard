"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { SosAlert } from '@/ai/schemas/sos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Play, Square, Activity, Route, Target, CheckCircle, XCircle, Pause, SkipBack, SkipForward, RotateCcw, History as HistoryIcon } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import InteractiveGoogleMap from '@/components/interactive-google-map';
// Location streaming removed to prevent browser crashes
// import { useLocationStreaming } from '@/hooks/useLocationStreaming';

interface MapTask {
  id: string;
  emergencyType: string;
  status: 'Active' | 'Investigating' | 'Responding' | 'In Transit' | 'False Alarm' | 'Resolved';
  assignedAt: Date;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  trackingData?: {
    coordinates?: Array<{ lat?: number, lng?: number, latitude?: number, longitude?: number, timestamp?: number }>;
    startTime?: string;
    endTime?: string;
    totalDistance?: number;
    averageSpeed?: number;
  };
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
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<MapTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<MapTask | null>(null);
  console.log("DriverMapPage: selectedTask:", selectedTask);
  const selectedTaskId = selectedTask?.id;
  const [mapView, setMapView] = useState<'all' | 'active' | 'resolved'>('all');
  const [driverLocation, setDriverLocation] = useState<DriverLocation | undefined>(undefined);
  const [navigationOrigin, setNavigationOrigin] = useState<[number, number] | null>(null);
  const [navigationRefreshKey, setNavigationRefreshKey] = useState(0);
  const [trackingStats, setTrackingStats] = useState<TrackingStats>({
    speed: 0,
    distanceTraveled: 0,
    timeElapsed: 0,
    startTime: null,
    lastPosition: null,
  });
  const [isTracking, setIsTracking] = useState(false);
  const [trackingType, setTrackingType] = useState<'none' | 'general' | 'task'>('none');

  // General History Playback State
  const [historyStartDate, setHistoryStartDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() - 3);
    return d.toISOString().slice(0, 16);
  });
  const [historyEndDate, setHistoryEndDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [isFetchingGeneralHistory, setIsFetchingGeneralHistory] = useState(false);
  const [trackingPath, setTrackingPath] = useState<[number, number][]>([]);
  const [followDriver, setFollowDriver] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [selectedTripForReplay, setSelectedTripForReplay] = useState<MapTask | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [replayCoordinates, setReplayCoordinates] = useState<any[]>([]);
  const [tripStats, setTripStats] = useState({
    totalDistance: 0,
    averageSpeed: 0,
    duration: 0,
    maxSpeed: 0,
    minSpeed: 0,
  });
  const [mapMode, setMapMode] = useState<'navigation' | 'tracking'>('navigation');
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const permissionCheckedRef = useRef(false);
  const lastLocationUpdateRef = useRef<number>(0);

  // Initialize geolocation and location streaming hooks
  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000,
  });

  // Check geolocation permission on mount (only once)
  useEffect(() => {
    if (permissionCheckedRef.current) return;

    const checkPermission = async () => {
      try {
        permissionCheckedRef.current = true;
        await geolocation.requestPermission();
      } catch (error) {
        console.warn('Error checking geolocation permission:', error);
      }
    };

    // Small delay to avoid blocking initial render
    const timer = setTimeout(checkPermission, 100);
    return () => clearTimeout(timer);
  }, []); // Remove geolocation dependency to prevent re-runs

  // Keep a stable navigation origin so the embedded Google Maps view doesn't constantly reload
  // as the driver's GPS updates during live tracking.
  useEffect(() => {
    if (!selectedTask) {
      setNavigationOrigin(null);
      return;
    }

    // If we already have an origin for this task, don't overwrite it automatically.
    if (navigationOrigin) return;

    if (geolocation.state.position) {
      setNavigationOrigin([
        geolocation.state.position.coords.latitude,
        geolocation.state.position.coords.longitude,
      ]);
      return;
    }

    if (driverLocation) {
      setNavigationOrigin([driverLocation.latitude, driverLocation.longitude]);
    }
  }, [selectedTask, navigationOrigin, geolocation.state.position, driverLocation]);

  const embeddedDirectionsUrl = useMemo(() => {
    if (!selectedTask || !navigationOrigin) return null;

    const origin = `${navigationOrigin[0]},${navigationOrigin[1]}`;
    const destination = `${selectedTask.location.latitude},${selectedTask.location.longitude}`;

    // Preferred: Maps Embed API (best compatibility + route rendering)
    // Requires Maps Embed API enabled for the key.
    const embedApiKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (embedApiKey) {
      const params = new URLSearchParams({
        key: embedApiKey,
        origin,
        destination,
        mode: 'driving',
      });
      return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
    }

    // Fallback: "output=embed" routes (does not require an API key).
    // Note: Feature set depends on Google; should render a route inside an iframe.
    const fallbackParams = new URLSearchParams({
      output: 'embed',
      saddr: origin,
      daddr: destination,
      dirflg: 'd', // driving
    });
    return `https://www.google.com/maps?${fallbackParams.toString()}`;
  }, [selectedTask, navigationOrigin]);

  const refreshEmbeddedNavigation = useCallback(() => {
    // Update the origin to the latest known driver position, then force a reload.
    if (geolocation.state.position) {
      setNavigationOrigin([
        geolocation.state.position.coords.latitude,
        geolocation.state.position.coords.longitude,
      ]);
    } else if (driverLocation) {
      setNavigationOrigin([driverLocation.latitude, driverLocation.longitude]);
    }
    setNavigationRefreshKey((k) => k + 1);
  }, [geolocation.state.position, driverLocation]);

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

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  // Format time display
  const formatTime = useCallback((milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Get current timestamp for display
  const getCurrentTimestamp = useCallback((): string => {
    const coordinates = selectedTripForReplay?.trackingData?.coordinates ?? [];
    if (coordinates.length === 0 || replayIndex >= coordinates.length) return '--:--:--';
    {
      const timestamp = coordinates[replayIndex]?.timestamp;
      if (!timestamp) return '--:--:--';
      return new Date(timestamp).toLocaleTimeString();
    }
  }, [selectedTripForReplay, replayIndex]);

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

  // Handle live tracking location updates
  useEffect(() => {
    if (isTracking && geolocation.state.position) {
      const currentPos = geolocation.state.position;
      const [lat, lng] = [currentPos.coords.latitude, currentPos.coords.longitude];

      // Add current position to tracking path
      setTrackingPath(prev => {
        const newPath = [...prev];
        // Only add if it's significantly different from the last point
        if (newPath.length === 0 ||
          calculateDistance(newPath[newPath.length - 1][0], newPath[newPath.length - 1][1], lat, lng) > 10) { // 10 meters minimum
          newPath.push([lat, lng]);
        }
        return newPath;
      });

      // Update tracking statistics
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

      // Update driver's location in Firestore (throttled to every 5 seconds)
      const now = Date.now();
      if (userId && (!lastLocationUpdateRef.current || now - lastLocationUpdateRef.current > 5000)) {
        lastLocationUpdateRef.current = now;
        const userRef = doc(db, 'users', userId);

        // Data to update in users collection
        const updateData: any = {
          latitude: lat,
          longitude: lng,
          heading: currentPos.coords.heading || 0,
          speed: currentPos.coords.speed || 0,
          lastLocationUpdate: serverTimestamp(),
          isTracking: true,
          trackingType: trackingType
        };

        if (trackingType === 'task' && selectedTask) {
          updateData.currentTaskId = selectedTask.id;
        } else {
          updateData.currentTaskId = null;
        }

        updateDoc(userRef, updateData).catch(err => console.error("Error updating driver location:", err));

        // If tracking task, also update the SOS alert document with current position
        if (trackingType === 'task' && selectedTask) {
          const sosRef = doc(db, 'sosAlerts', selectedTask.id);
          updateDoc(sosRef, {
            currentDriverLocation: {
              latitude: lat,
              longitude: lng,
              timestamp: serverTimestamp()
            }
          }).catch(err => console.error("Error updating SOS alert location:", err));
        }
      }
    } else if (!isTracking && userId) {
      // Clear tracking status in Firestore when not tracking
      const now = Date.now();
      if (!lastLocationUpdateRef.current || now - lastLocationUpdateRef.current > 10000) {
        lastLocationUpdateRef.current = now;
        const userRef = doc(db, 'users', userId);
        updateDoc(userRef, {
          isTracking: false,
          trackingType: 'none',
          currentTaskId: null
        }).catch(err => console.error("Error clearing driver tracking status:", err));
      }
    }
  }, [isTracking, trackingType, geolocation.state.position, trackingStats.lastPosition, trackingStats.startTime, calculateDistance, userId, selectedTask]);

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

  const handleStartTracking = useCallback(async (type: 'general' | 'task' = 'general') => {
    try {
      console.log(`[handleStartTracking] Starting ${type} tracking...`);
      console.log('[handleStartTracking] Current permission state:', geolocation.state.permission);

      if (type === 'task' && !selectedTask) {
        toast({
          title: 'No Task Selected',
          description: 'Please select a task from the dropdown before starting tracking.',
          variant: 'destructive',
        });
        return;
      }

      // Always request permission first to ensure we have the latest state
      const permission = await geolocation.requestPermission();
      console.log('[handleStartTracking] Permission result:', permission);

      if (permission !== 'granted') {
        // Provide specific guidance based on permission state
        let errorMessage = 'Location permission required for tracking.';
        if (permission === 'denied') {
          errorMessage += ' Please enable location access in your browser settings and refresh the page.';
        } else if (permission === 'prompt') {
          errorMessage += ' Please allow location access when prompted.';
        }
        throw new Error(errorMessage);
      }

      // Start tracking with 30-second coordinate storage
      console.log(`[handleStartTracking] Starting geolocation ${type} tracking...`);
      geolocation.startTracking({ trackingInterval: 30000 }); // 30 seconds

      // Initialize tracking
      setIsTracking(true);
      setTrackingType(type);
      setTrackingPath([]); // Clear previous path
      setFollowDriver(true); // Enable following by default

      setTrackingStats(prev => ({
        ...prev,
        startTime: new Date(),
        speed: 0,
        distanceTraveled: 0,
        timeElapsed: 0,
        lastPosition: geolocation.state.position,
      }));

      toast({
        title: `${type === 'task' ? 'Task' : 'General'} Trip Started`,
        description: `Your location is now being tracked for a ${type === 'task' ? 'task' : 'general'} trip.`,
      });

      // If it's a task trip, update task status
      if (type === 'task' && selectedTask) {
        updateTaskStatus(selectedTask.id, 'In Transit');
      }

      console.log(`[handleStartTracking] ${type} tracking started successfully`);
    } catch (error) {
      console.error('Error starting tracking:', error);
      toast({
        title: 'Tracking Failed',
        description: error instanceof Error ? error.message : 'Failed to start location tracking. Please check your browser settings.',
        variant: 'destructive',
      });
    }
  }, [geolocation, selectedTask, toast, updateTaskStatus]);

  const saveTrackingDataToFirestore = useCallback(async (taskId: string, coordinates: Array<{ lat: number, lng: number, timestamp: number }>) => {
    if (coordinates.length === 0) return;

    try {
      const trackingData = {
        taskId,
        driverId: userId,
        coordinates,
        startTime: trackingStats.startTime?.toISOString(),
        endTime: new Date().toISOString(),
        totalDistance: trackingStats.distanceTraveled,
        averageSpeed: trackingStats.speed,
        createdAt: serverTimestamp(),
      };

      // Save to sosAlerts collection under the specific task document
      await updateDoc(doc(db, 'sosAlerts', taskId), {
        trackingData,
        lastUpdated: serverTimestamp(),
      });

      console.log('[saveTrackingDataToFirestore] Tracking data saved:', trackingData);
    } catch (error) {
      console.error('Error saving tracking data:', error);
      toast({
        title: 'Data Save Error',
        description: 'Failed to save tracking data. Please check your connection.',
        variant: 'destructive',
      });
    }
  }, [userId, trackingStats, toast]);

  const handleStopTracking = useCallback(async () => {
    // If it's a task trip, save the final tracking coordinates to the SOS alert
    if (trackingType === 'task' && selectedTask && geolocation.state.trackingCoordinates.length > 0) {
      await saveTrackingDataToFirestore(selectedTask.id, geolocation.state.trackingCoordinates);
    }

    geolocation.stopTracking();
    setIsTracking(false);
    setTrackingType('none');
    setFollowDriver(false);
    setTrackingStats(prev => ({
      ...prev,
      startTime: null,
    }));

    toast({
      title: 'Trip Stopped',
      description: 'Location tracking has been stopped and data saved.',
    });
  }, [geolocation, selectedTask, trackingType, saveTrackingDataToFirestore, toast]);

  const handleLocationError = useCallback((error: string) => {
    console.error('Location error:', error);
    toast({
      title: 'Location Error',
      description: error,
      variant: 'destructive',
    });
  }, [toast]);

  const startEnhancedReplay = useCallback(async (task: MapTask) => {
    try {
      const taskDoc = await getDoc(doc(db, 'sosAlerts', task.id));
      if (taskDoc.exists()) {
        const taskData = taskDoc.data();
        const trackingData = taskData.trackingData;

        if (trackingData && trackingData.coordinates && trackingData.coordinates.length > 0) {
          setSelectedTripForReplay(task);
          setReplayCoordinates(trackingData.coordinates);
          setIsReplaying(true);
          setIsPlaying(true);
          setMapMode('tracking'); // Fix: Set map mode to tracking
          setFollowDriver(true); // Fix: Enable follow driver
          setReplayIndex(0);
          setCurrentPlaybackTime(0);

          const coordinates = trackingData.coordinates;
          const duration = coordinates.length * 1000; // Assume 1 second per coordinate initially
          setPlaybackDuration(duration);

          // Calculate enhanced trip statistics
          let totalDistance = 0;
          let speeds: number[] = [];
          for (let i = 1; i < coordinates.length; i++) {
            const dist = calculateDistance(
              coordinates[i - 1].lat, coordinates[i - 1].lng,
              coordinates[i].lat, coordinates[i].lng
            );
            totalDistance += dist;

            const timeDiff = (coordinates[i].timestamp - coordinates[i - 1].timestamp) / 1000;
            if (timeDiff > 0) {
              speeds.push((dist / timeDiff) * 3.6); // km/h
            }
          }

          const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
          const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
          const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;

          setTripStats({
            totalDistance,
            averageSpeed: avgSpeed,
            duration: coordinates.length,
            maxSpeed,
            minSpeed,
          });

          // Start playback
          startPlayback(coordinates);

          toast({
            title: 'Enhanced Trip Replay Started',
            description: `Replaying ${task.emergencyType} trip with advanced analytics`,
          });
        } else {
          toast({
            title: 'No Tracking Data',
            description: 'No tracking data available for this trip.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error starting enhanced replay:', error);
      toast({
        title: 'Replay Error',
        description: 'Failed to load tracking data for replay.',
        variant: 'destructive',
      });
    }
  }, [calculateDistance, toast]);

  // Handle replay parameter from URL
  useEffect(() => {
    const replayTaskId = searchParams.get('replay');
    if (replayTaskId && tasks.length > 0 && !isReplaying) {
      const taskToReplay = tasks.find(task => task.id === replayTaskId);
      if (taskToReplay) {
        console.log('Auto-starting replay for task:', replayTaskId);
        startEnhancedReplay(taskToReplay);
      }
    }
  }, [searchParams, tasks, isReplaying, startEnhancedReplay]);

  const startPlayback = useCallback((coordinates: any[]) => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
    }

    const interval = 1000 / playbackSpeed; // milliseconds per coordinate
    setPlaybackDuration(coordinates.length * interval);

    replayIntervalRef.current = setInterval(() => {
      setReplayIndex(prev => {
        if (prev >= coordinates.length - 1) {
          stopPlayback();
          toast({
            title: 'Replay Complete',
            description: 'History replay has finished.',
          });
          return prev;
        }

        const nextIndex = prev + 1;
        setCurrentPlaybackTime(nextIndex * interval);

        // Calculate speed between current and next point using timestamps
        if (nextIndex < coordinates.length - 1) {
          const currentCoord = coordinates[nextIndex];
          const nextCoord = coordinates[nextIndex + 1];
          const distance = calculateDistance(
            currentCoord.lat, currentCoord.lng,
            nextCoord.lat, nextCoord.lng
          );
          const timeDiff = (nextCoord.timestamp - currentCoord.timestamp) / 1000;
          const speed = timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0; // km/h
          setCurrentSpeed(speed);
        }

        return nextIndex;
      });
    }, interval);
  }, [playbackSpeed, calculateDistance, toast]);

  const stopPlayback = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const pausePlayback = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const resumePlayback = useCallback(() => {
    if (selectedTripForReplay) {
      // Fetch coordinates again and resume from current index
      getDoc(doc(db, 'sosAlerts', selectedTripForReplay.id)).then((taskDoc) => {
        if (taskDoc.exists()) {
          const taskData = taskDoc.data();
          const trackingData = taskData.trackingData;
          if (trackingData && trackingData.coordinates) {
            setIsPlaying(true);
            startPlayback(trackingData.coordinates.slice(replayIndex));
          }
        }
      });
    }
  }, [selectedTripForReplay, replayIndex, startPlayback]);

  const seekToPosition = useCallback((position: number) => {
    if (selectedTripForReplay) {
      getDoc(doc(db, 'sosAlerts', selectedTripForReplay.id)).then((taskDoc) => {
        if (taskDoc.exists()) {
          const taskData = taskDoc.data();
          const trackingData = taskData.trackingData;
          if (trackingData && trackingData.coordinates) {
            const totalCoordinates = trackingData.coordinates.length;
            const newIndex = Math.floor((position / playbackDuration) * totalCoordinates);
            setReplayIndex(newIndex);
            setCurrentPlaybackTime(position);

            // Update speed display using timestamps
            if (newIndex < totalCoordinates - 1) {
              const currentCoord = trackingData.coordinates[newIndex];
              const nextCoord = trackingData.coordinates[newIndex + 1];
              const distance = calculateDistance(
                currentCoord.lat, currentCoord.lng,
                nextCoord.lat, nextCoord.lng
              );
              const timeDiff = (nextCoord.timestamp - currentCoord.timestamp) / 1000;
              const speed = timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0;
              setCurrentSpeed(speed);
            }
          }
        }
      });
    }
  }, [selectedTripForReplay, playbackDuration, calculateDistance]);

  const changePlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (isPlaying && selectedTripForReplay) {
      // Restart playback with new speed
      pausePlayback();
      resumePlayback();
    }
  }, [isPlaying, selectedTripForReplay, pausePlayback, resumePlayback]);

  const resetPlayback = useCallback(() => {
    stopPlayback();
    setReplayIndex(0);
    setCurrentPlaybackTime(0);
    setCurrentSpeed(0);
    setTripStats({
      totalDistance: 0,
      averageSpeed: 0,
      duration: 0,
      maxSpeed: 0,
      minSpeed: 0,
    });
    setIsReplaying(false);
    setSelectedTripForReplay(null);
  }, [stopPlayback]);

  const fetchGeneralHistory = useCallback(async () => {
    if (!userId) {
      toast({ title: "Auth Required", description: "You must be logged in to fetch history.", variant: "destructive" });
      return;
    }

    setIsFetchingGeneralHistory(true);
    try {
      const start = new Date(historyStartDate);
      const end = new Date(historyEndDate);

      console.log(`DriverMapPage: Fetching history for driver ${userId} from ${start.toISOString()} to ${end.toISOString()}`);

      const q = query(
        collection(db, 'users', userId, 'locationHistory'),
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<=', Timestamp.fromDate(end)),
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          lat: data.latitude,
          lng: data.longitude,
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestampMs || Date.now()),
          displayTime: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString() : 'Unknown',
          sortTime: data.timestampMs || (data.timestamp?.toMillis?.()) || 0
        };
      });

      if (history.length === 0) {
        toast({ title: "No Data Found", description: "No location records found for the selected time range." });
        setIsFetchingGeneralHistory(false);
        return;
      }

      setReplayCoordinates(history);
      setReplayIndex(0);
      setPlaybackDuration(history.length * (1000 / playbackSpeed));
      setIsReplaying(true);
      setIsPlaying(true);
      setMapMode('tracking');
      setFollowDriver(true);
      startPlayback(history);

      setTripStats({
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        duration: history.length,
        minSpeed: 0
      });

      toast({ title: "History Loaded", description: `Found ${history.length} data points for replay.` });
    } catch (error) {
      console.error("Error fetching general history:", error);
      toast({ title: "Fetch Error", description: "Could not retrieve historical data.", variant: "destructive" });
    } finally {
      setIsFetchingGeneralHistory(false);
    }
  }, [userId, historyStartDate, historyEndDate, toast, setReplayCoordinates, setReplayIndex, setPlaybackDuration, setIsReplaying, setIsPlaying, setTripStats, startPlayback, playbackSpeed]);



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
        <h1 className="text-3xl font-bold">Driver's Task</h1>
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
        {/* Navigation (embedded Google Maps) */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Interactive Map
                {isTracking && mapMode === 'tracking' && (
                  <Badge variant="default" className="ml-auto">
                    <Activity className="h-3 w-3 mr-1" />
                    Live Tracking
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={mapMode} onValueChange={(value: 'navigation' | 'tracking') => setMapMode(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="navigation">Navigation</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                  </SelectContent>
                </Select>
                {selectedTask && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={refreshEmbeddedNavigation}
                      disabled={!embeddedDirectionsUrl}
                    >
                      Refresh Route
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={!embeddedDirectionsUrl}>
                          Expand
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl h-[85vh] p-0">
                        <DialogHeader className="p-4">
                          <DialogTitle>Navigation</DialogTitle>
                        </DialogHeader>
                        <div className="h-[calc(85vh-64px)] w-full">
                          <InteractiveGoogleMap
                            mode={mapMode}
                            driverLocation={
                              geolocation.state.position
                                ? {
                                  lat: geolocation.state.position.coords.latitude,
                                  lng: geolocation.state.position.coords.longitude,
                                }
                                : driverLocation
                                  ? {
                                    lat: driverLocation.latitude,
                                    lng: driverLocation.longitude,
                                  }
                                  : undefined
                            }
                            destination={
                              selectedTask
                                ? {
                                  lat: selectedTask.location.latitude,
                                  lng: selectedTask.location.longitude,
                                }
                                : undefined
                            }
                            trackingPath={trackingPath.map(([lat, lng]) => ({ lat, lng }))}
                            enableStreaming={isTracking && mapMode === 'tracking'}
                            onLocationUpdate={(location) => {
                              if (isTracking) {
                                setTrackingPath((prev) => {
                                  const newPath = [...prev];
                                  // Only add if it's significantly different from the last point
                                  if (
                                    newPath.length === 0 ||
                                    calculateDistance(newPath[newPath.length - 1][0], newPath[newPath.length - 1][1], location.lat, location.lng) > 10
                                  ) {
                                    newPath.push([location.lat, location.lng]);
                                  }
                                  return newPath;
                                });
                              }
                            }}
                            onError={handleLocationError}
                            className="h-full w-full"
                            followDriver={followDriver}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
              {selectedTask && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={refreshEmbeddedNavigation}
                    disabled={!embeddedDirectionsUrl}
                  >
                    Refresh Route
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" disabled={!embeddedDirectionsUrl}>
                        Expand
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl h-[85vh] p-0">
                      <DialogHeader className="p-4">
                        <DialogTitle>Navigation</DialogTitle>
                      </DialogHeader>
                      <div className="h-[calc(85vh-64px)] w-full">
                        {embeddedDirectionsUrl ? (
                          <iframe
                            key={`nav-modal-${selectedTaskId ?? 'no-task'}-${navigationRefreshKey}`}
                            title="Google Maps Navigation (Expanded)"
                            src={embeddedDirectionsUrl}
                            className="h-full w-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allow="geolocation; fullscreen"
                            allowFullScreen
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                            Unable to render embedded Google Maps navigation. Ensure `VITE_GOOGLE_MAPS_API_KEY` is set and Maps Embed API is enabled.
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <InteractiveGoogleMap
                mode={mapMode}
                driverLocation={
                  isReplaying && replayCoordinates[replayIndex]
                    ? { lat: replayCoordinates[replayIndex].lat, lng: replayCoordinates[replayIndex].lng }
                    : geolocation.state.position
                      ? { lat: geolocation.state.position.coords.latitude, lng: geolocation.state.position.coords.longitude }
                      : driverLocation
                        ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
                        : undefined
                }
                destination={selectedTask ? {
                  lat: selectedTask.location.latitude,
                  lng: selectedTask.location.longitude
                } : undefined}
                trackingPath={
                  isReplaying
                    ? replayCoordinates.slice(0, replayIndex + 1).map(c => ({ lat: c.lat, lng: c.lng }))
                    : trackingPath.map(([lat, lng]) => ({ lat, lng }))
                }
                enableStreaming={isTracking}
                onLocationUpdate={(loc) => {
                  if (isTracking && !isReplaying) {
                    setTrackingPath(prev => {
                      const newPath = [...prev, [loc.lat, loc.lng] as [number, number]];
                      return newPath;
                    });
                  }
                }}
                onError={handleLocationError}
                className="h-[500px] w-full rounded-b-lg"
                followDriver={followDriver}
              />
            </CardContent>
          </Card>
        </div>

        {/* Task Details Sidebar */}
        <div className="space-y-4">
          {/* General Trip Management Card */}
          <Card className="border-t-4 border-t-green-500 shadow-md">
            <CardHeader className="pb-3 text-center">
              <CardTitle className="text-lg font-bold flex items-center justify-center gap-2">
                <Route className="h-5 w-5 text-green-600" />
                General Trip Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                {trackingType !== 'task' && (
                  <>
                    {!isTracking ? (
                      <Button
                        onClick={() => handleStartTracking('general')}
                        className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold shadow-lg transform transition-all active:scale-95"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Start General Trip
                      </Button>
                    ) : (
                      <Button
                        onClick={handleStopTracking}
                        variant="destructive"
                        className="w-full h-12 text-lg font-bold shadow-lg animate-pulse"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        Stop General Trip
                      </Button>
                    )}
                  </>
                )}

                {trackingType === 'task' && (
                  <div className="p-3 bg-muted rounded-lg text-center text-sm text-muted-foreground italic border">
                    General tracking unavailable during active task trip.
                  </div>
                )}
              </div>

              {/* General History Replay Expandable Section */}
              {!isTracking && !isReplaying && (
                <div className="pt-2 border-t mt-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                    <HistoryIcon className="h-3 w-3" /> Historical Replay
                  </h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">From</Label>
                      <Input
                        type="datetime-local"
                        value={historyStartDate}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">To</Label>
                      <Input
                        type="datetime-local"
                        value={historyEndDate}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={fetchGeneralHistory}
                    variant="outline"
                    className="w-full border-green-200 hover:bg-green-50 text-green-700 font-bold text-xs h-9 uppercase tracking-wider"
                    disabled={isFetchingGeneralHistory}
                  >
                    {isFetchingGeneralHistory ? (
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin" />
                        Searching...
                      </div>
                    ) : "Load General History"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Task Card */}
          <Card className={`border-t-4 ${selectedTask ? 'border-t-red-500' : 'border-t-slate-300'} shadow-md transition-all`}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Target className={`h-5 w-5 ${selectedTask ? 'text-red-600' : 'text-slate-400'}`} />
                Active Task trip
              </CardTitle>
              {isTracking && trackingType === 'task' && (
                <Badge variant="destructive" className="animate-pulse">Tracking Active</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Task Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Select SOS Alert</Label>
                <Select
                  value={selectedTask?.id || ''}
                  onValueChange={(taskId) => {
                    const task = filteredTasks.find(t => t.id === taskId);
                    setSelectedTask(task || null);
                  }}
                  disabled={isTracking}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getTaskStatusColor(task.status)}`} />
                          <span className="truncate font-medium">{task.emergencyType}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {filteredTasks.length === 0 && (
                      <SelectItem value="none" disabled>No active tasks assigned</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTask ? (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Task Summary Info */}
                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-white text-red-700 border-red-200">
                        {selectedTask.status}
                      </Badge>
                      <span className="text-[10px] text-red-400 font-mono">ID: {selectedTask.id.slice(-6)}</span>
                    </div>
                    <h3 className="font-bold text-red-900">{selectedTask.emergencyType}</h3>
                    <p className="text-xs text-red-700 mt-1 line-clamp-2">
                      {selectedTask.location.address || "Fetching address..."}
                    </p>
                  </div>

                  {/* Task Trip Buttons */}
                  <div className="grid grid-cols-1 gap-2">
                    {trackingType === 'none' && (
                      <>
                        <Button
                          onClick={() => handleStartTracking('task')}
                          className="w-full bg-red-600 hover:bg-red-700 h-11 text-white font-bold shadow-md transform transition-all active:scale-95"
                          disabled={isTracking}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Task Trip
                        </Button>
                        {selectedTask.status !== 'Resolved' && selectedTask.status !== 'False Alarm' && (
                          <Button
                            variant="outline"
                            onClick={() => updateTaskStatus(selectedTask.id, 'Resolved')}
                            className="h-11 border-green-600 text-green-700 hover:bg-green-50 font-bold"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark as Resolved
                          </Button>
                        )}
                      </>
                    )}

                    {trackingType === 'task' && (
                      <Button
                        onClick={handleStopTracking}
                        variant="destructive"
                        className="w-full h-11 font-bold shadow-lg animate-pulse"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Task Trip
                      </Button>
                    )}

                    {trackingType === 'general' && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-[11px] text-yellow-700 text-center italic">
                        Stop General Trip to start Task Tracking
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-9"
                        onClick={refreshEmbeddedNavigation}
                      >
                        <Navigation className="h-3 w-3 mr-1" />
                        Navigate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-9 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                        onClick={() => startEnhancedReplay(selectedTask)}
                        disabled={isTracking || isReplaying}
                      >
                        <HistoryIcon className="h-3 w-3 mr-1" />
                        Replay Task
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center border-2 border-dashed rounded-lg bg-slate-50 border-slate-200">
                  <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium px-4">
                    Select a task from the dropdown above to manage its trip.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats & Playback Card (Dynamic) */}
          {(isTracking || isReplaying) && (
            <Card className="border-t-4 border-t-purple-500 shadow-xl animate-in zoom-in-95 duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isReplaying ? <RotateCcw className="h-4 w-4 text-purple-600" /> : <Activity className="h-4 w-4 text-blue-600" />}
                    {isReplaying ? 'Playback Control' : 'Trip Statistics'}
                  </span>
                  {isReplaying && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                      {playbackSpeed}x Speed
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isReplaying ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Slider
                        value={[currentPlaybackTime]}
                        max={playbackDuration}
                        step={100}
                        onValueChange={(value) => seekToPosition(value[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>{formatTime(currentPlaybackTime)}</span>
                        <span>{formatTime(playbackDuration)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={resetPlayback}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => seekToPosition(Math.max(0, currentPlaybackTime - 5000))}>
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      {isPlaying ? (
                        <Button size="icon" className="h-10 w-10 bg-purple-600 hover:bg-purple-700" onClick={pausePlayback}>
                          <Pause className="h-5 w-5" />
                        </Button>
                      ) : (
                        <Button size="icon" className="h-10 w-10 bg-purple-600 hover:bg-purple-700" onClick={resumePlayback}>
                          <Play className="h-5 w-5" />
                        </Button>
                      )}
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => seekToPosition(Math.min(playbackDuration, currentPlaybackTime + 5000))}>
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setIsReplaying(false)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-500">
                        <span>Playback Speed</span>
                        <span className="text-purple-600">{playbackSpeed}x</span>
                      </div>
                      <Slider
                        value={[playbackSpeed]}
                        min={0.5}
                        max={4}
                        step={0.5}
                        onValueChange={(val) => changePlaybackSpeed(val[0])}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded border text-center">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-slate-400 uppercase font-black">Speed</p>
                        <p className="text-sm font-bold">{currentSpeed.toFixed(1)} <span className="text-[10px] font-normal">km/h</span></p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-slate-400 uppercase font-black">Time</p>
                        <p className="text-sm font-bold">{getCurrentTimestamp()}</p>
                      </div>
                    </div>

                    {tripStats.totalDistance > 0 && (
                      <div className="pt-2 border-t space-y-2">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Trip Summary</p>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Avg Speed:</span>
                            <span className="font-bold">{tripStats.averageSpeed.toFixed(1)} km/h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Distance:</span>
                            <span className="font-bold">{(tripStats.totalDistance / 1000).toFixed(2)} km</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center p-2 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-[9px] text-blue-400 uppercase font-bold tracking-tight">Speed</span>
                      <span className="text-sm font-black text-blue-900">{(trackingStats.speed * 3.6).toFixed(1)}</span>
                      <span className="text-[8px] text-blue-400">km/h</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                      <span className="text-[9px] text-indigo-400 uppercase font-bold tracking-tight">Distance</span>
                      <span className="text-sm font-black text-indigo-900">{(trackingStats.distanceTraveled / 1000).toFixed(2)}</span>
                      <span className="text-[8px] text-indigo-400">km</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Duration</span>
                      <span className="text-sm font-black text-slate-900">
                        {Math.floor(trackingStats.timeElapsed / 60)}:{(trackingStats.timeElapsed % 60).toFixed(0).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] text-slate-400">min</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Location Status Badge */}
          <div className="px-1 text-center">
            <Badge variant="outline" className={`text-[10px] py-0.5 w-full flex justify-center gap-2 ${geolocation.state.permission === 'granted' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${geolocation.state.permission === 'granted' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              GPS Status: {geolocation.state.permission === 'granted' ? 'High Precision' : 'Permission Required'}
            </Badge>
          </div>

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
                          {task.status !== 'Resolved' && task.status !== 'False Alarm' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              onClick={() => updateTaskStatus(task.id, 'Resolved')}
                            >
                              Mark as Resolved
                            </Button>
                          )}
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
