"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
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
import { useTranslation } from 'react-i18next';

interface CompletedTask extends SosAlert {
  completedAt: Date;
  trackingData?: {
    coordinates: Array<{ lat: number, lng: number, timestamp: number }>;
    startTime: string;
    endTime: string;
    totalDistance: number;
    averageSpeed: number;
  };
}

export default function DriverHistoryPage() {
  const { t } = useTranslation();
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
          trackingData: data.trackingData ? {
            coordinates: (data.trackingData.coordinates || []).map((c: any) => ({
              lat: c.lat ?? c.latitude ?? 0,
              lng: c.lng ?? c.longitude ?? 0,
              timestamp: c.timestamp ?? 0
            })),
            startTime: data.trackingData.startTime || new Date().toISOString(),
            endTime: data.trackingData.endTime || new Date().toISOString(),
            totalDistance: (data.trackingData as any).totalDistance || 0,
            averageSpeed: (data.trackingData as any).averageSpeed || 0
          } : undefined
        } as any);
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
        <h1 className="text-3xl font-bold">{t('driver.history.title')}</h1>
        <Badge variant="outline" className="text-sm">
          {tasks.length} {tasks.length === 1 ? t('driver.history.completedTasks') : t('driver.history.completedTasksPlural')}
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
                  placeholder={t('driver.history.searchTasks')}
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
                  <SelectValue placeholder={t('driver.history.filterByStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('driver.history.allStatus')}</SelectItem>
                  <SelectItem value="Resolved">{t('driver.history.resolvedStatus')}</SelectItem>
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
                  {t('driver.history.sosAlert')}
                </CardTitle>
                <Badge className={getStatusColor(task.status)}>
                  {task.status === 'Resolved' ? t('driver.history.resolvedStatus') : task.status}
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
                {t('driver.history.completed')} {task.completedAt.toLocaleString()}
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
                  {t('driver.history.viewDetails')}
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
              {tasks.length === 0 ? t('driver.history.noCompletedTasks') : t('driver.history.noMatchingTasks')}
            </h3>
            <p className="text-muted-foreground">
              {tasks.length === 0
                ? t('driver.history.noCompletedDesc')
                : t('driver.history.noMatchingDesc')
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
              {t('driver.history.taskDetails')}
            </DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedTask.emergencyType}</h3>
                  <Badge className={getStatusColor(selectedTask.status)}>
                    {selectedTask.status === 'Resolved' ? t('driver.history.resolvedStatus') : selectedTask.status}
                  </Badge>
                </div>

                <Separator />

                {/* Location */}
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{t('driver.history.location')}</p>
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
                      <p className="font-medium">{t('driver.history.additionalInfo')}</p>
                      <p className="text-sm text-muted-foreground">{selectedTask.additionalInfo}</p>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{t('driver.history.created')}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTask.timestamp?.toDate().toLocaleString() || t('driver.history.unknown')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">{t('driver.history.completed')}</p>
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
                      {t('driver.history.tripAnalytics')}
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <Route className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{t('driver.history.distanceTraveled')}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedTask.trackingData.totalDistance / 1000).toFixed(2)} km
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{t('driver.history.averageSpeed')}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTask.trackingData.averageSpeed.toFixed(1)} km/h
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{t('driver.history.tripDuration')}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTask.trackingData.coordinates?.length || 0} {t('driver.history.dataPoints')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Navigation className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{t('driver.history.dataPoints')}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedTask.trackingData.coordinates?.length || 0} {t('driver.history.coordinates')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Trip Timeline */}
                    {selectedTask.trackingData.coordinates && selectedTask.trackingData.coordinates.length > 0 && (
                      <div className="mt-4">
                        <p className="font-medium mb-2">{t('driver.history.tripTimeline')}</p>
                        <div className="bg-muted p-3 rounded-lg text-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span>{t('driver.history.started')} {new Date(selectedTask.trackingData.startTime).toLocaleString()}</span>
                            <span>{t('driver.history.ended')} {new Date(selectedTask.trackingData.endTime).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground">
                            {t('driver.history.tripRecorded', { count: selectedTask.trackingData.coordinates.length })}
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
                  {t('driver.history.close')}
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
                    {t('driver.history.viewOnMap')}
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