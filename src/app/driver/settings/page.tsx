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
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
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
                language: i18n.language || 'en',
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
            title: t('driver.settings.loadError'),
            description: t('driver.settings.loadError'),
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

    // If language is updated, also update i18n instance
    if (category === 'preferences' && key === 'language') {
      i18n.changeLanguage(value);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser || !settings) return;

    setSaving(true);
    try {
      const language = settings.preferences.language;
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        notifications: settings.notifications,
        preferences: settings.preferences,
        privacy: settings.privacy,
        language: language, // Sync root level
        settings: {
          language: language // Sync settings level
        }
      });
      toast({
        title: t('driver.settings.settingsSaved'),
        description: t('driver.settings.settingsSavedDesc'),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: t('common.error'),
        description: t('driver.settings.saveError'),
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
        <p className="text-muted-foreground">{t('driver.settings.settingsNotAvailable')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('driver.settings.title')}</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('driver.settings.saving') : t('driver.settings.saveChanges')}
        </Button>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('driver.settings.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('driver.settings.sosAlerts')}</Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.sosAlertsDesc')}</p>
            </div>
            <Switch
              checked={settings.notifications.sosAlerts}
              onCheckedChange={(checked) => updateSetting('notifications', 'sosAlerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('driver.settings.taskUpdates')}</Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.taskUpdatesDesc')}</p>
            </div>
            <Switch
              checked={settings.notifications.taskUpdates}
              onCheckedChange={(checked) => updateSetting('notifications', 'taskUpdates', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('driver.settings.weatherAlerts')}</Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.weatherAlertsDesc')}</p>
            </div>
            <Switch
              checked={settings.notifications.weatherAlerts}
              onCheckedChange={(checked) => updateSetting('notifications', 'weatherAlerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('driver.settings.systemUpdates')}</Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.systemUpdatesDesc')}</p>
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
            {t('driver.settings.preferences')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('driver.settings.theme')}</Label>
              <Select
                value={settings.preferences.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') => updateSetting('preferences', 'theme', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('driver.settings.themeLight')}</SelectItem>
                  <SelectItem value="dark">{t('driver.settings.themeDark')}</SelectItem>
                  <SelectItem value="system">{t('driver.settings.themeSystem')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('driver.settings.language')}</Label>
              <Select
                value={settings.preferences.language}
                onValueChange={(value) => updateSetting('preferences', 'language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ha">Hausa</SelectItem>
                  <SelectItem value="ig">Igbo</SelectItem>
                  <SelectItem value="yo">Yoruba</SelectItem>
                  <SelectItem value="pcm">Nigerian Pidgin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                {t('driver.settings.soundNotifications')}
              </Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.soundNotificationsDesc')}</p>
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
                {t('driver.settings.autoAcceptTasks')}
              </Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.autoAcceptTasksDesc')}</p>
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
            {t('driver.settings.privacyLocation')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('driver.settings.shareLocation')}</Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.shareLocationDesc')}</p>
            </div>
            <Switch
              checked={settings.privacy.shareLocation}
              onCheckedChange={(checked) => updateSetting('privacy', 'shareLocation', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('driver.settings.showOnlineStatus')}</Label>
              <p className="text-sm text-muted-foreground">{t('driver.settings.showOnlineStatusDesc')}</p>
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