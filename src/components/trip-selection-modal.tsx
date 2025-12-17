"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Route } from 'lucide-react';
import { SosAlert } from '@/ai/schemas/sos';

interface MapTask extends SosAlert {
  assignedAt: Date;
  trackingData?: {
    coordinates: Array<{lat: number, lng: number, timestamp: number}>;
    startTime: string;
    endTime: string;
    totalDistance: number;
    averageSpeed: number;
  };
}

interface TripSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTrips: MapTask[];
  onSelectTrip: (trip: MapTask) => void;
  isReplaying?: boolean;
}

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

export function TripSelectionModal({
  open,
  onOpenChange,
  availableTrips,
  onSelectTrip,
  isReplaying = false,
}: TripSelectionModalProps) {
  console.log('TripSelectionModal render:', { open, availableTrips: availableTrips.length, isReplaying });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl z-50">
        <DialogHeader>
          <DialogTitle>Select Trip to Replay</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {availableTrips.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => onSelectTrip(trip)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getTaskStatusColor(trip.status)}`} />
                    <div>
                      <p className="font-medium">{trip.emergencyType}</p>
                      <p className="text-sm text-muted-foreground">
                        {trip.location.address || `${trip.location.latitude.toFixed(4)}, ${trip.location.longitude.toFixed(4)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trip.assignedAt.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" disabled={isReplaying}>
                    Replay
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Route className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No trips with tracking data available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}