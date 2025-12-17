"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  Activity,
  Route,
  MapPin,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import GoogleMap from '@/components/google-map';
import { TripSelectionModal } from '@/components/trip-selection-modal';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SosAlert } from '@/ai/schemas/sos';

interface TripCoordinate {
  lat: number;
  lng: number;
  timestamp: number;
}

interface TripData extends SosAlert {
  trackingData: {
    coordinates: TripCoordinate[];
    startTime: string;
    endTime: string;
    totalDistance: number;
    averageSpeed: number;
  };
}

interface EnhancedTripReplayProps {
  className?: string;
}

export function EnhancedTripReplay({ className }: EnhancedTripReplayProps) {
  const [tripSelectionModalOpen, setTripSelectionModalOpen] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<TripData[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripData | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayIndex, setReplayIndex] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [tripStats, setTripStats] = useState({
    totalDistance: 0,
    averageSpeed: 0,
    duration: 0,
    maxSpeed: 0,
    minSpeed: 0,
  });

  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

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

  // Fetch available trips with tracking data
  const fetchAvailableTrips = useCallback(async () => {
    try {
      // This would typically fetch from an API or database
      // For now, we'll simulate with sample data
      const trips: TripData[] = [
        {
          id: 'trip-1',
          emergencyType: 'Medical Emergency',
          location: { latitude: 6.5244, longitude: 3.3792, address: 'Lagos, Nigeria' },
          timestamp: new Date('2024-12-17T10:00:00Z'),
          status: 'Resolved',
          assignedTeam: { driverId: 'driver-1', driverName: 'John Doe', vehicle: 'Ambulance A1' },
          trackingData: {
            coordinates: [
              { lat: 6.5244, lng: 3.3792, timestamp: Date.now() - 3600000 },
              { lat: 6.5250, lng: 3.3800, timestamp: Date.now() - 3300000 },
              { lat: 6.5260, lng: 3.3810, timestamp: Date.now() - 3000000 },
              { lat: 6.5270, lng: 3.3820, timestamp: Date.now() - 2700000 },
              { lat: 6.5280, lng: 3.3830, timestamp: Date.now() - 2400000 },
              { lat: 6.5290, lng: 3.3840, timestamp: Date.now() - 2100000 },
              { lat: 6.5300, lng: 3.3850, timestamp: Date.now() - 1800000 },
              { lat: 6.5310, lng: 3.3860, timestamp: Date.now() - 1500000 },
              { lat: 6.5320, lng: 3.3870, timestamp: Date.now() - 1200000 },
              { lat: 6.5330, lng: 3.3880, timestamp: Date.now() - 900000 },
              { lat: 6.5340, lng: 3.3890, timestamp: Date.now() - 600000 },
              { lat: 6.5350, lng: 3.3900, timestamp: Date.now() - 300000 },
              { lat: 6.5360, lng: 3.3910, timestamp: Date.now() },
            ],
            startTime: new Date(Date.now() - 3600000).toISOString(),
            endTime: new Date().toISOString(),
            totalDistance: 1500,
            averageSpeed: 25,
          }
        }
      ];

      setAvailableTrips(trips);
    } catch (error) {
      console.error('Error fetching available trips:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available trips.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Start trip replay
  const startTripReplay = useCallback(async (trip: TripData) => {
    try {
      setSelectedTrip(trip);
      setTripSelectionModalOpen(false);
      setIsReplaying(true);
      setIsPlaying(true);
      setReplayIndex(0);
      setCurrentPlaybackTime(0);

      const coordinates = trip.trackingData.coordinates;
      const duration = coordinates.length * 1000; // Assume 1 second per coordinate initially
      setPlaybackDuration(duration);

      // Calculate trip statistics
      let totalDistance = 0;
      let speeds: number[] = [];
      for (let i = 1; i < coordinates.length; i++) {
        const dist = calculateDistance(
          coordinates[i-1].lat, coordinates[i-1].lng,
          coordinates[i].lat, coordinates[i].lng
        );
        totalDistance += dist;

        const timeDiff = (coordinates[i].timestamp - coordinates[i-1].timestamp) / 1000;
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
        title: 'Trip Replay Started',
        description: `Replaying ${trip.emergencyType} trip`,
      });
    } catch (error) {
      console.error('Error starting trip replay:', error);
      toast({
        title: 'Replay Error',
        description: 'Failed to start trip replay.',
        variant: 'destructive',
      });
    }
  }, [calculateDistance, toast]);

  // Start playback animation
  const startPlayback = useCallback((coordinates: TripCoordinate[]) => {
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
            description: 'Trip replay has finished.',
          });
          return prev;
        }

        const nextIndex = prev + 1;
        setCurrentPlaybackTime(nextIndex * interval);

        // Calculate speed between current and next point
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

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Pause playback
  const pausePlayback = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Resume playback
  const resumePlayback = useCallback(() => {
    if (selectedTrip) {
      setIsPlaying(true);
      startPlayback(selectedTrip.trackingData.coordinates.slice(replayIndex));
    }
  }, [selectedTrip, replayIndex, startPlayback]);

  // Seek to position
  const seekToPosition = useCallback((position: number) => {
    if (selectedTrip) {
      const coordinates = selectedTrip.trackingData.coordinates;
      const totalCoordinates = coordinates.length;
      const newIndex = Math.floor((position / playbackDuration) * totalCoordinates);
      setReplayIndex(newIndex);
      setCurrentPlaybackTime(position);

      // Update speed display
      if (newIndex < totalCoordinates - 1) {
        const currentCoord = coordinates[newIndex];
        const nextCoord = coordinates[newIndex + 1];
        const distance = calculateDistance(
          currentCoord.lat, currentCoord.lng,
          nextCoord.lat, nextCoord.lng
        );
        const timeDiff = (nextCoord.timestamp - currentCoord.timestamp) / 1000;
        const speed = timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0;
        setCurrentSpeed(speed);
      }
    }
  }, [selectedTrip, playbackDuration, calculateDistance]);

  // Change playback speed
  const changePlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (isPlaying && selectedTrip) {
      // Restart playback with new speed
      pausePlayback();
      resumePlayback();
    }
  }, [isPlaying, selectedTrip, pausePlayback, resumePlayback]);

  // Reset playback
  const resetPlayback = useCallback(() => {
    stopPlayback();
    setReplayIndex(0);
    setCurrentPlaybackTime(0);
    setCurrentSpeed(0);
    setIsReplaying(false);
    setSelectedTrip(null);
  }, [stopPlayback]);

  // Format time display
  const formatTime = useCallback((milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Get current timestamp for display
  const getCurrentTimestamp = useCallback((): string => {
    if (!selectedTrip || replayIndex >= selectedTrip.trackingData.coordinates.length) {
      return '--:--:--';
    }
    const timestamp = selectedTrip.trackingData.coordinates[replayIndex].timestamp;
    return new Date(timestamp).toLocaleTimeString();
  }, [selectedTrip, replayIndex]);

  // Fetch trips when modal opens
  useEffect(() => {
    if (tripSelectionModalOpen) {
      fetchAvailableTrips();
    }
  }, [tripSelectionModalOpen, fetchAvailableTrips]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
      }
    };
  }, []);

  const replayPath = selectedTrip && isReplaying
    ? selectedTrip.trackingData.coordinates.slice(0, replayIndex + 1).map(coord => [coord.lat, coord.lng] as [number, number])
    : undefined;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl shadow-lg mb-4">
          <Route className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          Enhanced Trip Replay
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Visualize and analyze completed trip routes with detailed playback controls
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Trip Visualization
                {isReplaying && (
                  <Badge variant="default" className="ml-auto">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-1"></div>
                    Replaying
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <GoogleMap
                className="h-[500px] rounded-b-lg"
                isReplaying={isReplaying}
                replayPath={replayPath}
                defaultCenter={[6.5244, 3.3792]}
                onLocationError={(error) => {
                  toast({
                    title: 'Location Error',
                    description: error,
                    variant: 'destructive',
                  });
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Controls Sidebar */}
        <div className="space-y-4">
          {/* Trip Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Trip Selection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setTripSelectionModalOpen(true)}
                disabled={isReplaying}
                className="w-full"
              >
                {isReplaying ? (
                  <>
                    <Activity className="h-4 w-4 mr-2 animate-spin" />
                    Replaying...
                  </>
                ) : (
                  <>
                    <Route className="h-4 w-4 mr-2" />
                    Select Trip to Replay
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Playback Controls */}
          {isReplaying && selectedTrip && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Playback Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium">{selectedTrip.emergencyType}</p>
                  <p className="text-muted-foreground text-xs">
                    {selectedTrip.location.address || `${selectedTrip.location.latitude.toFixed(4)}, ${selectedTrip.location.longitude.toFixed(4)}`}
                  </p>
                </div>

                {/* Control Buttons */}
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

          {/* Trip Statistics */}
          {isReplaying && selectedTrip && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Trip Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1">
                    <Route className="h-4 w-4" />
                    Distance
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
                    Duration
                  </span>
                  <span className="font-semibold">{tripStats.duration} points</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Trip Selection Modal */}
      <TripSelectionModal
        open={tripSelectionModalOpen}
        onOpenChange={setTripSelectionModalOpen}
        availableTrips={availableTrips}
        onSelectTrip={startTripReplay}
        isReplaying={isReplaying}
      />
    </div>
  );
}