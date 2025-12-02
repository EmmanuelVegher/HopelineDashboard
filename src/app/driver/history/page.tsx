"use client";

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { SosAlert } from '@/ai/schemas/sos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, CheckCircle, Search, Filter } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';

interface CompletedTask extends SosAlert {
  completedAt: Date;
}

export default function DriverHistoryPage() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userId, setUserId] = useState<string | null>(null);

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
                    // TODO: Implement view details functionality
                    console.log('View task details:', task.id);
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
    </div>
  );
}