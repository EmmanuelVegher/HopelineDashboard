"use client";

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { User, Phone, Mail, Car, MapPin } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { type Vehicle } from '@/lib/data';

interface DriverProfile {
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  vehicleImageUrl?: string;
  location: string;
  bio: string;
  role: string;
  status: 'Available' | 'En Route' | 'Assisting' | 'Emergency' | 'Off Duty';
  task: string;
  selectedVehicleId?: string;
  vehicleDetails?: Vehicle;
}

export default function DriverProfilePage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<DriverProfile>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const profileData: DriverProfile = {
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
              name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || '',
              email: userData.email || user.email || '',
              phone: userData.mobile ? String(userData.mobile) : '',
              vehicle: userData.vehicle || `${userData.vehicleType || ''} ${userData.licenseNumber || ''}`.trim() || '',
              vehicleImageUrl: userData.vehicleImageUrl || '',
              location: userData.location || '',
              bio: userData.bio || '',
              role: userData.role || '',
              status: userData.status || 'Available',
              task: userData.task || '',
              selectedVehicleId: userData.selectedVehicleId || '',
              vehicleDetails: userData.vehicleDetails,
            };
            setProfile(profileData);
            setFormData(profileData);
          }
        } catch (error) {
          console.error('Error loading profile:', error);
          toast({
            title: 'Error',
            description: 'Failed to load profile data.',
            variant: 'destructive',
          });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);


  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
        const vehiclesData = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
        setVehicles(vehiclesData);
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      }
    };

    fetchVehicles();
  }, []);

  useEffect(() => {
    if (profile?.vehicleDetails) {
      setSelectedVehicle(profile.vehicleDetails as Vehicle);
    } else {
      setSelectedVehicle(null);
    }
  }, [profile?.vehicleDetails]);

  const handleSave = async () => {
    if (!auth.currentUser) return;

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), formData);
      setProfile(formData as DriverProfile);
      setEditing(false);
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setFormData(profile || {});
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Driver Profile</h1>
        <Badge variant="outline">{profile.role}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <p className="text-sm font-medium">{profile.name}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <p className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {profile.email}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <p className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {profile.phone}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle ID / License Plate</Label>
              <p className="text-sm font-medium flex items-center gap-2">
                <Car className="h-4 w-4" />
                {profile.vehicle}
              </p>
            </div>



            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <p className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {profile.location}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Current Status</Label>
              <Badge variant="outline">{profile.status}</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task">Current Task</Label>
              <p className="text-sm font-medium">{profile.task || 'No current task'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <p className="text-sm text-muted-foreground">{profile.bio || 'No bio provided.'}</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={() => {
              setFormData(profile);
              setEditing(true);
            }}>Edit Profile</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Assigned Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedVehicle ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedVehicle.imageUrl && (
                  <div className="w-full h-auto rounded-lg border overflow-hidden">
                    <img src={selectedVehicle.imageUrl} alt={`${selectedVehicle.make} ${selectedVehicle.model}`} className="object-contain w-full h-full" />
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedVehicle.make} {selectedVehicle.model}</h3>
                    <p className="text-sm text-muted-foreground">Year: {selectedVehicle.year}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">License Plate:</span> {selectedVehicle.licensePlate}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {selectedVehicle.type}
                    </div>
                    <div>
                      <span className="font-medium">Capacity:</span> {selectedVehicle.capacity} passengers
                    </div>
                    <div>
                      <span className="font-medium">Color:</span> {selectedVehicle.color || 'Not specified'}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> <Badge variant="outline">{selectedVehicle.status}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Fuel Type:</span> {selectedVehicle.fuelType || 'Not specified'}
                    </div>
                    {selectedVehicle.mileage && (
                      <div>
                        <span className="font-medium">Mileage:</span> {selectedVehicle.mileage} miles
                      </div>
                    )}
                    {selectedVehicle.lastMaintenance && (
                      <div>
                        <span className="font-medium">Last Maintenance:</span> {selectedVehicle.lastMaintenance}
                      </div>
                    )}
                  </div>
                  {selectedVehicle.notes && (
                    <div>
                      <span className="font-medium">Notes:</span> {selectedVehicle.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No vehicle assigned</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName || ''}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value, name: `${e.target.value} ${formData.lastName || ''}`.trim() })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName || ''}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value, name: `${formData.firstName || ''} ${e.target.value}`.trim() })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-vehicle">Vehicle ID / License Plate</Label>
                <Input
                  id="edit-vehicle"
                  value={formData.vehicle || ''}
                  onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-selectedVehicle">Assigned Vehicle</Label>
                <Select
                  value={formData.selectedVehicleId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, selectedVehicleId: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger id="edit-selectedVehicle">
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No vehicle selected</SelectItem>
                    {vehicles.map(vehicle => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} ({vehicle.year}) - {vehicle.licensePlate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assigned Vehicle Image</Label>
                {selectedVehicle?.imageUrl ? (
                  <div className="w-24 h-24 rounded-md border overflow-hidden">
                    <img src={selectedVehicle.imageUrl} alt={`${selectedVehicle.make} ${selectedVehicle.model}`} className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No vehicle assigned or no image available</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Current Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: DriverProfile['status']) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="En Route">En Route</SelectItem>
                    <SelectItem value="Assisting">Assisting</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                    <SelectItem value="Off Duty">Off Duty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-task">Current Task</Label>
                <Input
                  id="edit-task"
                  value={formData.task || ''}
                  onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}