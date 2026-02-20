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
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Play, Square, Activity, Clock, Route, Target, AlertTriangle, CheckCircle, XCircle, Pause, SkipBack, SkipForward, RotateCcw, History as HistoryIcon } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import InteractiveGoogleMap from '@/components/interactive-google-map';
// Location streaming removed to prevent browser crashes
// import { useLocationStreaming } from '@/hooks/useLocationStreaming';

interface MapTask extends SosAlert {
  assignedAt: Date;
  trackingData?: {
    coordinates: Array<{ lat: number, lng: number, timestamp: number }>;
    startTime: string;
    endTime: string;
    totalDistance: number;
    averageSpeed: number;
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
  const [tripSelectionModalOpen, setTripSelectionModalOpen] = useState(false);
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
        updateDoc(userRef, {
          latitude: lat,
          longitude: lng,
          heading: currentPos.coords.heading || 0,
          speed: currentPos.coords.speed || 0,
          lastLocationUpdate: serverTimestamp(),
        }).catch(err => console.error("Error updating driver location:", err));
      }
    }
  }, [isTracking, geolocation.state.position, trackingStats.lastPosition, trackingStats.startTime, calculateDistance, userId]);

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

  const handleStartTracking = useCallback(async () => {
    try {
      console.log('[handleStartTracking] Starting location tracking...');
      console.log('[handleStartTracking] Current permission state:', geolocation.state.permission);
      console.log('[handleStartTracking] Selected task:', selectedTask);

      // Check if a task is selected
      if (!selectedTask) {
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
      console.log('[handleStartTracking] Starting geolocation tracking...');
      geolocation.startTracking({ trackingInterval: 30000 }); // 30 seconds

      // Initialize tracking
      setIsTracking(true);
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
        title: 'Live Tracking Started',
        description: 'Your location is now being tracked in real-time with navigation guidance.',
      });

      console.log('[handleStartTracking] Live tracking started successfully');
    } catch (error) {
      console.error('Error starting tracking:', error);
      toast({
        title: 'Tracking Failed',
        description: error instanceof Error ? error.message : 'Failed to start location tracking. Please check your browser settings.',
        variant: 'destructive',
      });
    }
  }, [geolocation, selectedTask, toast]);

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
    // Save tracking data to Firestore before stopping
    if (selectedTask && geolocation.state.trackingCoordinates.length > 0) {
      await saveTrackingDataToFirestore(selectedTask.id, geolocation.state.trackingCoordinates);
    }

    geolocation.stopTracking();
    setIsTracking(false);
    setFollowDriver(false);
    setTrackingStats(prev => ({
      ...prev,
      startTime: null,
    }));

    toast({
      title: 'Live Tracking Stopped',
      description: 'Location tracking has been stopped and data saved.',
    });
  }, [geolocation, selectedTask, saveTrackingDataToFirestore, toast]);

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
          setTripSelectionModalOpen(false);
          setReplayCoordinates(trackingData.coordinates); // Fix: Set replayCoordinates
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
          {/* Tracking Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Live Tracking
                {isTracking && (
                  <Badge variant="default" className="ml-auto">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                    Active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {!isTracking ? (
                  <Button
                    onClick={() => {
                      if (!selectedTask) {
                        toast({
                          title: 'Task Selection Required',
                          description: 'Please select a task from the dropdown above before starting live tracking.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      handleStartTracking();
                    }}
                    className="flex-1"
                    disabled={!geolocation.state.isSupported || geolocation.state.permission === 'denied' || !selectedTask}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {!selectedTask ? 'Select Task First' : geolocation.state.permission === 'denied' ? 'Location Blocked' : 'Start Live Tracking'}
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

              {/* Movement History Replay Controls */}
              {!isTracking && !selectedTask && (
                <Card className="border shadow-sm bg-purple-50/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-purple-600 flex items-center gap-2">
                      <HistoryIcon className="h-4 w-4" /> Movement History Replay
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold uppercase text-slate-500">From</Label>
                        <Input
                          type="datetime-local"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold uppercase text-slate-500">To</Label>
                        <Input
                          type="datetime-local"
                          value={historyEndDate}
                          onChange={(e) => setHistoryEndDate(e.target.value)}
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={fetchGeneralHistory}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase text-[10px] h-8 shadow-sm"
                      disabled={isFetchingGeneralHistory}
                    >
                      {isFetchingGeneralHistory ? (
                        <div className="flex items-center gap-1">
                          <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Fetching...
                        </div>
                      ) : "Load Replay"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!geolocation.state.isSupported && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  Geolocation is not supported in this browser.
                </div>
              )}

              {/* Follow Driver Toggle */}
              {isTracking && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Follow Driver</span>
                  <Button
                    variant={followDriver ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFollowDriver(!followDriver)}
                  >
                    {followDriver ? "On" : "Off"}
                  </Button>
                </div>
              )}

              {/* Permission Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Location Permission:</span>
                  <Badge variant={
                    geolocation.state.permission === 'granted' ? 'default' :
                      geolocation.state.permission === 'denied' ? 'destructive' :
                        geolocation.state.permission === 'prompt' ? 'secondary' : 'outline'
                  }>
                    {geolocation.state.permission === 'granted' ? 'Granted' :
                      geolocation.state.permission === 'denied' ? 'Denied' :
                        geolocation.state.permission === 'prompt' ? 'Prompt' : 'Unknown'}
                  </Badge>
                </div>

                {geolocation.state.permission === 'denied' && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    Location access is blocked. Click the lock icon in your browser's address bar and allow location access.
                  </div>
                )}

                {geolocation.state.position && (
                  <>
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
                  </>
                )}
              </div>

              {/* Location streaming removed to prevent browser crashes */}
              {/* {locationStreaming.state.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {locationStreaming.state.error}
                </div>
              )} */}
            </CardContent>
          </Card>

          {/* Tracking Statistics */}
          {isTracking && (
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
                <div className="flex items-center justify-between">
                  <span className="text-sm">Path Points</span>
                  <span className="font-semibold">{trackingPath.length}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Trip Playback Controls */}
          {isReplaying && selectedTripForReplay && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Trip Playback
                  <Badge variant="default" className="ml-auto">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-1"></div>
                    Replaying
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium">{selectedTripForReplay.emergencyType}</p>
                  <p className="text-muted-foreground text-xs">
                    {selectedTripForReplay.location.address || `${selectedTripForReplay.location.latitude.toFixed(4)}, ${selectedTripForReplay.location.longitude.toFixed(4)}`}
                  </p>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetPlayback}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => seekToPosition(Math.max(0, currentPlaybackTime - 5000))}
                    disabled={currentPlaybackTime === 0}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  {isPlaying ? (
                    <Button
                      size="sm"
                      onClick={pausePlayback}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={resumePlayback}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Play
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => seekToPosition(Math.min(playbackDuration, currentPlaybackTime + 5000))}
                    disabled={currentPlaybackTime >= playbackDuration}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <Slider
                    value={[currentPlaybackTime]}
                    max={playbackDuration}
                    step={100}
                    onValueChange={(value) => seekToPosition(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(currentPlaybackTime)}</span>
                    <span>{formatTime(playbackDuration)}</span>
                  </div>
                </div>

                {/* Speed Control */}
                <div className="space-y-2">
                  <Label className="text-sm">Playback Speed: {playbackSpeed}x</Label>
                  <Slider
                    value={[playbackSpeed]}
                    min={0.25}
                    max={4}
                    step={0.25}
                    onValueChange={(value) => changePlaybackSpeed(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.25x</span>
                    <span>4x</span>
                  </div>
                </div>

                {/* Timestamp and Speed Indicators */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Time
                    </span>
                    <span className="font-semibold text-sm">
                      {getCurrentTimestamp()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      Speed
                    </span>
                    <span className="font-semibold text-sm">{currentSpeed.toFixed(1)} km/h</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round((currentPlaybackTime / playbackDuration) * 100)}%</span>
                </div>
                <Progress value={(currentPlaybackTime / playbackDuration) * 100} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Enhanced Trip Statistics */}
          {isReplaying && selectedTripForReplay && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Trip Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Route className="h-4 w-4" />
                    Total Distance
                  </span>
                  <span className="font-semibold">{(tripStats.totalDistance / 1000).toFixed(2)} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Activity className="h-4 w-4" />
                    Avg Speed
                  </span>
                  <span className="font-semibold">{tripStats.averageSpeed.toFixed(1)} km/h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Activity className="h-4 w-4" />
                    Max Speed
                  </span>
                  <span className="font-semibold">{tripStats.maxSpeed.toFixed(1)} km/h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Data Points
                  </span>
                  <span className="font-semibold">{tripStats.duration}</span>
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Do NOT launch a separate navigation flow.
                          // Instead, refresh the embedded Google Maps Directions view on this page.
                          refreshEmbeddedNavigation();
                          document.getElementById('embedded-navigation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        disabled={!selectedTask}
                      >
                        <Navigation className="h-4 w-4 mr-1" />
                        Open In-app Navigation
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 bg-purple-600 hover:bg-purple-700 shadow-md transform transition-all active:scale-95"
                        onClick={async () => {
                          if (!selectedTask) {
                            toast({
                              title: 'No Task Selected',
                              description: 'Please select a task first.',
                              variant: 'destructive',
                            });
                            return;
                          }

                          if (isReplaying) {
                            toast({
                              title: 'Replay in Progress',
                              description: 'Please wait for the current replay to finish.',
                              variant: 'destructive',
                            });
                            return;
                          }

                          console.log('Starting playback for selected task:', selectedTask.id);
                          await startEnhancedReplay(selectedTask);
                        }}
                        disabled={isReplaying || !selectedTask}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Replay Trip
                      </Button>
                    </div>

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
                            // Start Trip - update status to In Transit and start tracking
                            updateTaskStatus(selectedTask.id, 'In Transit');
                            handleStartTracking();
                            toast({
                              title: 'Trip Started',
                              description: 'Live tracking and navigation have begun.',
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
