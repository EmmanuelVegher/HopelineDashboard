"use client";

import { useEffect, useState } from 'react';
import { db, auth, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { User, Phone, Mail, Car, MapPin, ImagePlus, Trash2 } from 'lucide-react';
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
  image?: string;
  profileImage?: string;
}

export default function DriverProfilePage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<DriverProfile>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Helper: safely convert any Firestore field to a display string
            const toStr = (val: any): string => {
              if (val === null || val === undefined) return '';
              if (typeof val === 'string') return val;
              if (typeof val === 'number' || typeof val === 'boolean') return String(val);
              // Firestore GeoPoint has latitude/longitude properties
              if (typeof val === 'object' && 'latitude' in val && 'longitude' in val) {
                return `${val.latitude.toFixed(4)}, ${val.longitude.toFixed(4)}`;
              }
              // Firestore GeoPoint internal format (_lat, _long)
              if (typeof val === 'object' && '_lat' in val && '_long' in val) {
                return `${val._lat.toFixed(4)}, ${val._long.toFixed(4)}`;
              }
              // Firestore Timestamp has a toDate() method
              if (typeof val === 'object' && typeof val.toDate === 'function') {
                return val.toDate().toLocaleString();
              }
              return '';
            };

            const profileData: DriverProfile = {
              firstName: toStr(userData.firstName),
              lastName: toStr(userData.lastName),
              name: `${toStr(userData.firstName)} ${toStr(userData.lastName)}`.trim() || '',
              email: toStr(userData.email) || toStr(user.email),
              phone: userData.mobile ? String(userData.mobile) : '',
              vehicle: toStr(userData.vehicle) || `${toStr(userData.vehicleType)} ${toStr(userData.licenseNumber)}`.trim(),
              vehicleImageUrl: toStr(userData.vehicleImageUrl),
              location: toStr(userData.location),
              bio: toStr(userData.bio),
              role: toStr(userData.role),
              status: userData.status || 'Available',
              task: toStr(userData.task),
              selectedVehicleId: toStr(userData.selectedVehicleId),
              vehicleDetails: userData.vehicleDetails,
              image: toStr(userData.image) || toStr(userData.profileImage),
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

  // Ensure profile data is valid
  useEffect(() => {
    if (profile && (!profile.name || profile.name.trim() === '')) {
      console.warn('Profile name is empty, this might cause rendering issues');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!auth.currentUser || saving) return;

    setSaving(true);
    try {
      let imageUrl = formData.image || '';

      if (imageFile) {
        const storageRef = ref(storage, `driver-profiles/${Date.now()}_${imageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Upload failed:", error);
              toast({ title: "Image Upload Failed", description: "Could not upload profile image.", variant: "destructive" });
              setUploadProgress(null);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                imageUrl = downloadURL;
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          );
        });
      }

      const dataToSave = {
        ...formData,
        image: imageUrl,
        profileImage: imageUrl, // Also set profileImage for consistency
      };

      await updateDoc(doc(db, 'users', auth.currentUser.uid), dataToSave);

      // Update local state with proper data structure
      const updatedProfile: DriverProfile = {
        firstName: dataToSave.firstName || '',
        lastName: dataToSave.lastName || '',
        name: `${dataToSave.firstName || ''} ${dataToSave.lastName || ''}`.trim() || dataToSave.name || '',
        email: dataToSave.email || '',
        phone: dataToSave.phone || '',
        vehicle: dataToSave.vehicle || '',
        vehicleImageUrl: dataToSave.vehicleImageUrl || '',
        location: dataToSave.location || '',
        bio: dataToSave.bio || '',
        role: dataToSave.role || 'driver',
        status: dataToSave.status || 'Available',
        task: dataToSave.task || '',
        selectedVehicleId: dataToSave.selectedVehicleId || '',
        vehicleDetails: dataToSave.vehicleDetails,
        image: dataToSave.image || '',
        profileImage: dataToSave.profileImage || '',
      };

      // Validate required fields
      if (!updatedProfile.name || updatedProfile.name.trim() === '') {
        console.error('Profile name is empty after save, this will cause rendering issues');
        throw new Error('Profile name cannot be empty');
      }

      console.log('Updating profile state:', updatedProfile);
      setProfile(updatedProfile);
      setFormData(updatedProfile);

      // Close dialog and reset states
      setEditing(false);
      setImageFile(null);
      setImagePreview(null);
      setUploadProgress(null);

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
      setUploadProgress(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile || {});
    setEditing(false);
    setImageFile(null);
    setImagePreview(null);
    setUploadProgress(null);
    setSaving(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    console.log('Profile is null, showing not found message');
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  console.log('Rendering profile page with profile:', profile);

  try {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Driver Profile</h1>
          <Badge variant="outline">{profile.role}</Badge>
        </div>

        {/* Profile Image Display */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200">
                {profile.image ? (
                  <img
                    src={profile.image}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold">{profile.name}</h2>
                <p className="text-muted-foreground">{profile.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

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

              <div className="space-y-2">
                <Label>Profile Image</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted overflow-hidden">
                    {imagePreview || formData.image ? (
                      <img src={imagePreview || formData.image} alt="Profile preview" className="object-cover w-full h-full" />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Input id="profileImage" type="file" onChange={handleImageChange} accept="image/*" />
                    <p className="text-xs text-muted-foreground mt-1">Upload a new profile image.</p>
                    {(imagePreview || formData.image) && (
                      <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:text-red-600 mt-1" onClick={handleImageRemove}>
                        <Trash2 className="mr-1 h-4 w-4" /> Remove Image
                      </Button>
                    )}
                  </div>
                </div>
                {uploadProgress !== null && (
                  <div className="space-y-1">
                    <Label>Upload Progress</Label>
                    <Progress value={uploadProgress} />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  } catch (error) {
    console.error('Error rendering profile page:', error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">There was an error loading the profile page.</p>
          <p className="text-sm text-muted-foreground">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }
}