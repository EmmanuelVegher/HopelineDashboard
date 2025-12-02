"use client";

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, Moon, Volume2, MapPin, Car } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';

interface DriverSettings {
  notifications: {
    sosAlerts: boolean;
    taskUpdates: boolean;
    weatherAlerts: boolean;
    systemUpdates: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    soundEnabled: boolean;
    autoAcceptTasks: boolean;
  };
  privacy: {
    shareLocation: boolean;
    showOnlineStatus: boolean;
  };
}

export default function DriverSettingsPage() {
  const [settings, setSettings] = useState<DriverSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const settingsData: DriverSettings = {
              notifications: userData.notifications || {
                sosAlerts: true,
                taskUpdates: true,
                weatherAlerts: true,
                systemUpdates: false,
              },
              preferences: userData.preferences || {
                theme: 'system',
                language: 'en',
                soundEnabled: true,
                autoAcceptTasks: false,
              },
              privacy: userData.privacy || {
                shareLocation: true,
                showOnlineStatus: true,
              },
            };
            setSettings(settingsData);
          }
        } catch (error) {
          console.error('Error loading settings:', error);
          toast({
            title: 'Error',
            description: 'Failed to load settings.',
            variant: 'destructive',
          });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const updateSetting = (category: keyof DriverSettings, key: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    });
  };

  const handleSave = async () => {
    if (!auth.currentUser || !settings) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        notifications: settings.notifications,
        preferences: settings.preferences,
        privacy: settings.privacy,
      });
      toast({
        title: 'Settings Saved',
        description: 'Your settings have been successfully updated.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Settings not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Driver Settings</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>SOS Alerts</Label>
              <p className="text-sm text-muted-foreground">Receive notifications for emergency alerts</p>
            </div>
            <Switch
              checked={settings.notifications.sosAlerts}
              onCheckedChange={(checked) => updateSetting('notifications', 'sosAlerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Task Updates</Label>
              <p className="text-sm text-muted-foreground">Get notified about task status changes</p>
            </div>
            <Switch
              checked={settings.notifications.taskUpdates}
              onCheckedChange={(checked) => updateSetting('notifications', 'taskUpdates', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weather Alerts</Label>
              <p className="text-sm text-muted-foreground">Receive weather-related notifications</p>
            </div>
            <Switch
              checked={settings.notifications.weatherAlerts}
              onCheckedChange={(checked) => updateSetting('notifications', 'weatherAlerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>System Updates</Label>
              <p className="text-sm text-muted-foreground">Get notified about app updates and maintenance</p>
            </div>
            <Switch
              checked={settings.notifications.systemUpdates}
              onCheckedChange={(checked) => updateSetting('notifications', 'systemUpdates', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={settings.preferences.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') => updateSetting('preferences', 'theme', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={settings.preferences.language}
                onValueChange={(value) => updateSetting('preferences', 'language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Sound Notifications
              </Label>
              <p className="text-sm text-muted-foreground">Play sound for notifications</p>
            </div>
            <Switch
              checked={settings.preferences.soundEnabled}
              onCheckedChange={(checked) => updateSetting('preferences', 'soundEnabled', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Auto-Accept Tasks
              </Label>
              <p className="text-sm text-muted-foreground">Automatically accept assigned tasks</p>
            </div>
            <Switch
              checked={settings.preferences.autoAcceptTasks}
              onCheckedChange={(checked) => updateSetting('preferences', 'autoAcceptTasks', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Privacy & Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Share Location</Label>
              <p className="text-sm text-muted-foreground">Allow location sharing for task assignments</p>
            </div>
            <Switch
              checked={settings.privacy.shareLocation}
              onCheckedChange={(checked) => updateSetting('privacy', 'shareLocation', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Online Status</Label>
              <p className="text-sm text-muted-foreground">Let others see when you're online</p>
            </div>
            <Switch
              checked={settings.privacy.showOnlineStatus}
              onCheckedChange={(checked) => updateSetting('privacy', 'showOnlineStatus', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}