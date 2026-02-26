"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  User,
  Camera,
  Save,
  Edit,
  MapPin,
  Globe,
  Clock,
  Shield,
  Award,
  MessageSquare,
  Phone,
  Star
} from "lucide-react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface SupportAgentProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  image?: string;
  bio: string;
  languages: string[];
  specializations: string[];
  experience: string;
  location: string;
  timezone: string;
  availability: 'online' | 'busy' | 'offline';
  rating: number;
  totalChats: number;
  totalCalls: number;
  responseTime: number;
  isOnline: boolean;
  lastActive: Date;
  certifications: string[];
  skills: string[];
}

export default function SupportAgentProfilePage() {
  const [profile, setProfile] = useState<SupportAgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<SupportAgentProfile>>({});
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const profileData: SupportAgentProfile = {
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || user.email || '',
          phone: userData.phone || '',
          image: userData.image || '',
          bio: userData.bio || '',
          languages: userData.languages || ['English'],
          specializations: userData.specializations || [],
          experience: userData.experience || '',
          location: userData.location || '',
          timezone: userData.timezone || 'Africa/Lagos',
          availability: userData.availability || 'online',
          rating: userData.rating || 0,
          totalChats: userData.totalChats || 0,
          totalCalls: userData.totalCalls || 0,
          responseTime: userData.responseTime || 0,
          isOnline: userData.isOnline || false,
          lastActive: userData.lastActive?.toDate() || new Date(),
          certifications: userData.certifications || [],
          skills: userData.skills || []
        };
        setProfile(profileData);
        setFormData(profileData);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({ title: t('common.error'), description: t('supportAgent.profile.failedToLoadProfile'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !auth.currentUser) return;

    try {
      const storageRef = ref(storage, `profile-images/${auth.currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, image: downloadURL }));
      toast({ title: t('common.success'), description: t('supportAgent.profile.profileImageUpdated') });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ title: t('common.error'), description: t('supportAgent.profile.failedToUploadImage'), variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        ...formData,
        updatedAt: new Date()
      });

      setProfile(prev => prev ? { ...prev, ...formData } : null);
      setEditing(false);
      toast({ title: t('common.success'), description: t('supportAgent.profile.profileUpdated') });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ title: t('common.error'), description: t('supportAgent.profile.failedToSaveProfile'), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile || {});
    setEditing(false);
  };

  const formatResponseTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="h-64 bg-slate-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-48 bg-slate-200 rounded"></div>
              <div className="h-48 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <User className="h-16 w-16 mx-auto mb-4 text-slate-400" />
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">{t('supportAgent.profile.profileNotFound')}</h2>
          <p className="text-muted-foreground">{t('supportAgent.profile.unableToLoadProfile')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-brand-indigo to-brand-purple rounded-2xl shadow-lg mb-4 sm:mb-6">
            <User className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-brand-indigo-text to-brand-purple-text bg-clip-text text-transparent mb-3 sm:mb-4">
            {t('supportAgent.profile.title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            {t('supportAgent.profile.subtitle')}
          </p>
        </div>

        {/* Profile Header */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Profile Image */}
              <div className="relative">
                <Avatar className="h-24 w-24 md:h-32 md:w-32">
                  <AvatarImage src={editing ? formData.image : profile.image} />
                  <AvatarFallback className="text-2xl md:text-3xl">
                    {profile.firstName[0]}{profile.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                {editing && (
                  <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {profile.firstName} {profile.lastName}
                </h2>
                <p className="text-muted-foreground mb-4">{profile.email}</p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-brand-yellow-text fill-current" />
                    <span className="font-medium">{profile.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span>{profile.totalChats} {t('supportAgent.profile.chats')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-brand-green-text" />
                    <span>{profile.totalCalls} {t('supportAgent.profile.calls')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-brand-purple-text" />
                    <span>{formatResponseTime(profile.responseTime)} {t('supportAgent.profile.avgResponse')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Badge variant={profile.isOnline ? "default" : "secondary"}>
                    {profile.isOnline ? t('supportAgent.dashboard.online') : t('supportAgent.dashboard.offline')}
                  </Badge>
                  <Badge variant="outline">
                    {t(`supportAgent.dashboard.${profile.availability}`)}
                  </Badge>
                </div>
              </div>

              {/* Edit Button */}
              <div className="flex gap-2">
                {!editing ? (
                  <Button onClick={() => setEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t('supportAgent.profile.editProfile')}
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? t('supportAgent.profile.saving') : t('common.save')}
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      {t('common.cancel')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('supportAgent.profile.personalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">{t('supportAgent.profile.firstName')}</Label>
                  {editing ? (
                    <Input
                      id="firstName"
                      value={formData.firstName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">{profile.firstName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">{t('supportAgent.profile.lastName')}</Label>
                  {editing ? (
                    <Input
                      id="lastName"
                      value={formData.lastName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">{profile.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="phone">{t('supportAgent.profile.phoneNumber')}</Label>
                {editing ? (
                  <PhoneInput
                    value={formData.phone || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">{profile.phone || t('supportAgent.profile.notProvided')}</p>
                )}
              </div>

              <div>
                <Label htmlFor="location">{t('supportAgent.profile.location')}</Label>
                {editing ? (
                  <Input
                    id="location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {profile.location || t('supportAgent.profile.notSpecified')}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="timezone">{t('supportAgent.profile.timezone')}</Label>
                {editing ? (
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Africa/Lagos">{t('supportAgent.profile.timezoneWAT')}</SelectItem>
                      <SelectItem value="Africa/Khartoum">{t('supportAgent.profile.timezoneCAT')}</SelectItem>
                      <SelectItem value="Africa/Nairobi">{t('supportAgent.profile.timezoneEAT')}</SelectItem>
                      <SelectItem value="UTC">{t('supportAgent.profile.timezoneUTC')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">{profile.timezone}</p>
                )}
              </div>

              <div>
                <Label htmlFor="bio">{t('supportAgent.profile.bio')}</Label>
                {editing ? (
                  <Textarea
                    id="bio"
                    value={formData.bio || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder={t('supportAgent.profile.bioPlaceholder')}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">{profile.bio || t('supportAgent.profile.noBioProvided')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('supportAgent.profile.professionalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('supportAgent.profile.languages')}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.languages.map((lang, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('supportAgent.profile.specializations')}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.specializations.length > 0 ? (
                    profile.specializations.map((spec, index) => (
                      <Badge key={index} variant="secondary">
                        {spec}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('supportAgent.profile.noSpecializations')}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>{t('supportAgent.profile.skills')}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.skills.length > 0 ? (
                    profile.skills.map((skill, index) => (
                      <Badge key={index} variant="outline">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('supportAgent.profile.noSkills')}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>{t('supportAgent.profile.certifications')}</Label>
                <div className="space-y-2 mt-1">
                  {profile.certifications.length > 0 ? (
                    profile.certifications.map((cert, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm">{cert}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('supportAgent.profile.noCertifications')}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <Label>{t('supportAgent.profile.experienceLevel')}</Label>
                <p className="text-sm text-muted-foreground mt-1">{profile.experience || t('supportAgent.profile.notSpecified')}</p>
              </div>

              <div>
                <Label>{t('supportAgent.profile.availabilityStatus')}</Label>
                {editing ? (
                  <Select
                    value={formData.availability}
                    onValueChange={(value: 'online' | 'busy' | 'offline') =>
                      setFormData(prev => ({ ...prev, availability: value }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">{t('supportAgent.profile.availabilityOnline')}</SelectItem>
                      <SelectItem value="busy">{t('supportAgent.profile.availabilityBusy')}</SelectItem>
                      <SelectItem value="offline">{t('supportAgent.profile.availabilityOffline')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant={profile.availability === 'online' ? 'default' : 'secondary'}
                    className="mt-1"
                  >
                    {t(`supportAgent.dashboard.${profile.availability}`)}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {t('supportAgent.profile.performanceStatistics')}
            </CardTitle>
            <CardDescription>{t('supportAgent.profile.performanceDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-1">{profile.totalChats}</div>
                <div className="text-sm text-muted-foreground">{t('supportAgent.profile.totalChats')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-green-text mb-1">{profile.totalCalls}</div>
                <div className="text-sm text-muted-foreground">{t('supportAgent.profile.totalCalls')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-yellow-text mb-1">{profile.rating.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">{t('supportAgent.profile.averageRating')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-purple-text mb-1">{formatResponseTime(profile.responseTime)}</div>
                <div className="text-sm text-muted-foreground">{t('supportAgent.profile.avgResponseTime')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}