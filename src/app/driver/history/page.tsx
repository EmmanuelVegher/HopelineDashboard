"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { SosAlert } from '@/ai/schemas/sos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, CheckCircle, Search, Filter, Route, Activity, Navigation } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface CompletedTask extends SosAlert {
  completedAt: Date;
  trackingData?: {
    coordinates: Array<{lat: number, lng: number, timestamp: number}>;
    startTime: string;
    endTime: string;
    totalDistance: number;
    averageSpeed: number;
  };
}

export default function DriverHistoryPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<CompletedTask | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'logged in' : 'not logged in', user?.uid);
      if (user) {
        setUserId(user.uid);
        console.log('Set userId:', user.uid);
      } else {
        setUserId(null);
        setLoading(false);
        console.log('No user logged in, set loading false');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userId) {
      console.log('No userId, skipping query');
      return;
    }

     console.log('Setting up query for userId:', userId);
     const q = query(
       collection(db, 'sosAlerts'),
       where('assignedTeam.driverId', '==', userId),
       where('status', '==', 'Resolved'),
       orderBy('timestamp', 'desc')
     );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
       console.log('Query snapshot received, docs count:', querySnapshot.size);
       const completedTasks: CompletedTask[] = [];
       querySnapshot.forEach((doc) => {
         const data = doc.data() as SosAlert;
         completedTasks.push({
           ...data,
           id: doc.id,
           completedAt: data.timestamp?.toDate() || new Date(),
         });
       });
       console.log('Completed tasks:', completedTasks.length);
       setTasks(completedTasks);
       setFilteredTasks(completedTasks);
       setLoading(false);
     }, (error) => {
       console.error('Error in onSnapshot:', error);
       setLoading(false);
     });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    let filtered = tasks;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.emergencyType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.location.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.additionalInfo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status (though all should be Resolved, keeping for future extensibility)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    setFilteredTasks(filtered);
  }, [tasks, searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
        <h1 className="text-3xl font-bold">Task History</h1>
        <Badge variant="outline" className="text-sm">
          {tasks.length} Completed Task{tasks.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task History */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTasks.map((task) => (
          <Card key={task.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
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
                Completed {task.completedAt.toLocaleString()}
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedTask(task);
                    setDetailsModalOpen(true);
                  }}
                >
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {tasks.length === 0 ? 'No Completed Tasks' : 'No Matching Tasks'}
            </h3>
            <p className="text-muted-foreground">
              {tasks.length === 0
                ? 'You haven\'t completed any tasks yet. Your completed tasks will appear here.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Task Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Task Details
            </DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedTask.emergencyType}</h3>
                  <Badge className={getStatusColor(selectedTask.status)}>
                    {selectedTask.status}
                  </Badge>
                </div>

                <Separator />

                {/* Location */}
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTask.location.address ||
                       `${selectedTask.location.latitude.toFixed(6)}, ${selectedTask.location.longitude.toFixed(6)}`}
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                {selectedTask.additionalInfo && (
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 text-muted-foreground mt-0.5">📝</div>
                    <div>
                      <p className="font-medium">Additional Information</p>
                      <p className="text-sm text-muted-foreground">{selectedTask.additionalInfo}</p>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTask.timestamp?.toDate().toLocaleString() || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Completed</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTask.completedAt.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tracking Data Section */}
              {selectedTask.trackingData && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Trip Analytics
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <Route className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Distance Traveled</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedTask.trackingData.totalDistance / 1000).toFixed(2)} km
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Average Speed</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTask.trackingData.averageSpeed.toFixed(1)} km/h
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Trip Duration</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTask.trackingData.coordinates?.length || 0} data points
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Navigation className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Data Points</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTask.trackingData.coordinates?.length || 0} coordinates
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Trip Timeline */}
                    {selectedTask.trackingData.coordinates && selectedTask.trackingData.coordinates.length > 0 && (
                      <div className="mt-4">
                        <p className="font-medium mb-2">Trip Timeline</p>
                        <div className="bg-muted p-3 rounded-lg text-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span>Started: {new Date(selectedTask.trackingData.startTime).toLocaleString()}</span>
                            <span>Ended: {new Date(selectedTask.trackingData.endTime).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground">
                            Trip recorded with {selectedTask.trackingData.coordinates.length} location points
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDetailsModalOpen(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                {selectedTask.trackingData?.coordinates && selectedTask.trackingData.coordinates.length > 0 && (
                  <Button
                    variant="default"
                    onClick={() => {
                      // Navigate to driver map page with replay parameter
                      setDetailsModalOpen(false);
                      navigate(`/driver/map?replay=${selectedTask.id}`);
                    }}
                    className="flex-1"
                  >
                    <Route className="h-4 w-4 mr-2" />
                    View on Map
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}