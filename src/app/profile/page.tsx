"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { UserProfile } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, User, Mail, Phone, Calendar, MapPin, Shield, Edit, Save, X, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProfilePage() {
  const [user, authLoading] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState<number>(0);
  const [gender, setGender] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        setLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setProfile(profileData);
          setDisplayName(profileData.displayName || "");
          setFirstName(profileData.firstName || "");
          setLastName(profileData.lastName || "");
          setMobile(profileData.mobile || 0);
          setGender(profileData.gender || "");
          setImagePreview(profileData.image || null);
        }
        setLoading(false);
      } else if (!authLoading) {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, authLoading]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    let imageUrl = profile?.image || "";

    if (imageFile) {
      setIsUploading(true);
      const storageRef = ref(storage, `profile-pictures/${user.uid}`);
      try {
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
        setIsUploading(false);
      } catch (error) {
        toast({ title: "Image Upload Failed", variant: "destructive" });
        setIsSaving(false);
        setIsUploading(false);
        return;
      }
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      const updatedData: Partial<UserProfile> = {
        displayName,
        firstName,
        lastName,
        mobile,
        gender,
        image: imageUrl,
        profileCompleted: 1, // Mark profile as completed
      };

      await updateDoc(userDocRef, updatedData);
      toast({ title: "Profile Updated" });
      setProfile((prev) => prev ? ({ ...prev, ...updatedData }) as UserProfile : null);
    } catch (error) {
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="pb-6">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-5 w-64" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl">
            <CardContent className="p-8 text-center">
              <div className="bg-red-100 p-4 rounded-2xl w-fit mx-auto mb-4">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-lg font-medium text-slate-800 mb-2">Authentication Required</p>
              <p className="text-slate-600">You must be logged in to view your profile.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl shadow-lg mb-4 sm:mb-6">
            <User className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-purple-700 bg-clip-text text-transparent mb-3 sm:mb-4">
            My Profile
          </h1>
          <p className="text-slate-600 text-sm sm:text-base lg:text-lg">
            Manage your personal information and account settings
          </p>
        </div>

        {/* Main Profile Card */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl overflow-hidden">
          <CardHeader className="pb-6">
            <CardTitle className="text-lg sm:text-xl font-bold text-slate-800">Personal Information</CardTitle>
            <CardDescription className="text-sm sm:text-base text-slate-600">Update your details and profile picture</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 sm:space-y-8">
            {/* Profile Picture and Basic Info */}
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <div className="relative">
                <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-white shadow-lg">
                  <AvatarImage src={imagePreview || undefined} alt="Profile picture" />
                  <AvatarFallback className="text-lg sm:text-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                    {(displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button asChild size="icon" className="absolute bottom-0 right-0 rounded-full h-10 w-10 sm:h-12 sm:w-12 bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110">
                  <Label htmlFor="image-upload">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5"/>
                    <span className="sr-only">Upload image</span>
                  </Label>
                </Button>
                <Input id="image-upload" type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 mb-2">{displayName || 'No display name'}</h2>
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm sm:text-base">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 mb-3">
                  <Shield className="h-4 w-4" />
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {profile.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {new Date(profile.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label htmlFor="displayName" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Display Name
                </Label>
                <Input 
                  id="displayName" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  placeholder="Enter your display name"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="mobile" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-500" />
                  Mobile Number
                </Label>
                <Input 
                  id="mobile" 
                  type="tel" 
                  value={mobile || ""} 
                  onChange={(e) => setMobile(Number(e.target.value))}
                  className="h-12 border-2 border-slate-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20"
                  placeholder="Enter your mobile number"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="firstName" className="text-sm font-semibold text-slate-700">First Name</Label>
                <Input 
                  id="firstName" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-12 border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20"
                  placeholder="Enter your first name"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="lastName" className="text-sm font-semibold text-slate-700">Last Name</Label>
                <Input 
                  id="lastName" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-12 border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20"
                  placeholder="Enter your last name"
                />
              </div>
              
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="gender" className="text-sm font-semibold text-slate-700">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isUploading}
              className="w-full sm:w-auto h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading Image...
                </>
              ) : isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 hover:scale-105">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Account Status */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/50 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-2xl">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-800 mb-1">Profile Complete</h3>
                <p className="text-green-700 text-sm">Your profile is up to date and complete</p>
              </div>
              <Badge className="bg-green-100 text-green-800">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
