"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Settings,
  Bell,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Globe,
  Shield,
  Clock,
  MessageSquare,
  Phone,
  MapPin,
  Save,
  RotateCcw
} from "lucide-react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useTranslationContext } from "@/contexts/TranslationProvider";
import { useTheme } from "@/contexts/ThemeProvider";

interface SupportAgentSettings {
  // Notifications
  notifications: {
    newChats: boolean;
    newCalls: boolean;
    emergencyAlerts: boolean;
    systemUpdates: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  };

  // Appearance
  theme: 'light' | 'dark' | 'system';
  language: string;

  // Privacy & Security
  profileVisibility: 'public' | 'agents_only' | 'private';
  showOnlineStatus: boolean;
  allowDirectMessages: boolean;

  // Work Preferences
  availability: 'online' | 'busy' | 'offline';
  maxConcurrentChats: number;
  autoAcceptChats: boolean;
  workingHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };

  // Communication
  defaultLanguage: string;
  autoTranslate: boolean;
  voiceCallSettings: {
    microphoneEnabled: boolean;
    speakerEnabled: boolean;
    noiseCancellation: boolean;
  };

  // Location Services
  locationSharing: boolean;
  locationAccuracy: 'high' | 'medium' | 'low';
}

export default function SupportAgentSettingsPage() {
  const [settings, setSettings] = useState<SupportAgentSettings | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { changeLanguage, currentLanguage } = useTranslationContext();
  const { theme: providerTheme, setTheme } = useTheme();

  // Sync selectedLanguage with TranslationProvider's currentLanguage
  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const defaultSettings: SupportAgentSettings = {
          notifications: {
            newChats: true,
            newCalls: true,
            emergencyAlerts: true,
            systemUpdates: true,
            soundEnabled: true,
            vibrationEnabled: true
          },
          theme: 'system',
          language: 'en',
          profileVisibility: 'agents_only',
          showOnlineStatus: true,
          allowDirectMessages: true,
          availability: 'online',
          maxConcurrentChats: 3,
          autoAcceptChats: false,
          workingHours: {
            enabled: false,
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'Africa/Lagos'
          },
          defaultLanguage: 'English',
          autoTranslate: true,
          voiceCallSettings: {
            microphoneEnabled: true,
            speakerEnabled: true,
            noiseCancellation: true
          },
          locationSharing: true,
          locationAccuracy: 'high'
        };

        // Merge with existing user settings
        const userSettings = userData.settings || {};
        const mergedSettings = { ...defaultSettings, ...userSettings };

        setSettings(mergedSettings);
        setSelectedLanguage(mergedSettings.language);
        setTheme(mergedSettings.theme);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser || !settings) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        settings: settings,
        updatedAt: new Date()
      });

      toast({ title: "Success", description: "Settings saved successfully" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadSettings();
    toast({ title: "Settings Reset", description: "Settings have been reset to defaults" });
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      if (!prev) return prev;

      const keys = path.split('.');
      const updated = { ...prev };

      let current: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      return updated;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen gradient-bg p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <Settings className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">{t('supportAgent.settings.settingsNotAvailable')}</h2>
          <p className="text-muted-foreground">{t('supportAgent.settings.unableToLoadSettings')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-brand-indigo to-brand-purple rounded-2xl shadow-lg mb-4 sm:mb-6">
            <Settings className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-brand-indigo-text to-brand-purple-text bg-clip-text text-transparent mb-3 sm:mb-4">
            {t('supportAgent.settings.title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            {t('supportAgent.settings.subtitle')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('supportAgent.settings.resetDefaults')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? t('supportAgent.settings.saving') : t('supportAgent.settings.saveSettings')}
          </Button>
        </div>

        {/* Settings Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notifications */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('supportAgent.settings.notifications.title')}
              </CardTitle>
              <CardDescription>{t('supportAgent.settings.notifications.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.notifications.newChats')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.notifications.newChatsDesc')}</p>
                </div>
                <Switch
                  checked={settings.notifications.newChats}
                  onCheckedChange={(checked) => updateSetting('notifications.newChats', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.notifications.voiceCalls')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.notifications.voiceCallsDesc')}</p>
                </div>
                <Switch
                  checked={settings.notifications.newCalls}
                  onCheckedChange={(checked) => updateSetting('notifications.newCalls', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.notifications.emergencyAlerts')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.notifications.emergencyAlertsDesc')}</p>
                </div>
                <Switch
                  checked={settings.notifications.emergencyAlerts}
                  onCheckedChange={(checked) => updateSetting('notifications.emergencyAlerts', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.notifications.soundNotifications')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.notifications.soundNotificationsDesc')}</p>
                </div>
                <Switch
                  checked={settings.notifications.soundEnabled}
                  onCheckedChange={(checked) => updateSetting('notifications.soundEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.notifications.vibration')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.notifications.vibrationDesc')}</p>
                </div>
                <Switch
                  checked={settings.notifications.vibrationEnabled}
                  onCheckedChange={(checked) => updateSetting('notifications.vibrationEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                {t('supportAgent.settings.appearance.title')}
              </CardTitle>
              <CardDescription>{t('supportAgent.settings.appearance.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('supportAgent.settings.appearance.theme')}</Label>
                <Select
                  value={settings.theme}
                  onValueChange={(value) => {
                    console.log('Settings: Theme select changed to:', value);
                    if (!['light', 'dark', 'system'].includes(value)) {
                      console.log('Settings: Invalid theme selected:', value);
                      toast({ title: "Error", description: "Invalid theme selected", variant: "destructive" });
                      return;
                    }
                    console.log('Settings: Setting theme via provider:', value);
                    setTheme(value as 'light' | 'dark' | 'system');
                    updateSetting('theme', value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('supportAgent.settings.appearance.interfaceLanguage')}</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={async (value) => {
                    setSelectedLanguage(value);
                    // Update the setting immediately
                    updateSetting('language', value);
                    // Then change the language
                    await changeLanguage(value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="ha">Hausa</SelectItem>
                    <SelectItem value="yo">Yoruba</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Work Preferences */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('supportAgent.settings.workPreferences.title')}
              </CardTitle>
              <CardDescription>{t('supportAgent.settings.workPreferences.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('supportAgent.settings.workPreferences.availabilityStatus')}</Label>
                <Select
                  value={settings.availability}
                  onValueChange={(value: 'online' | 'busy' | 'offline') => updateSetting('availability', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <Badge variant="default" className="mr-2">{t('supportAgent.dashboard.online')}</Badge>
                      {t('supportAgent.settings.workPreferences.availableForNewRequests')}
                    </SelectItem>
                    <SelectItem value="busy">
                      <Badge variant="secondary" className="mr-2">{t('supportAgent.dashboard.busy')}</Badge>
                      {t('supportAgent.settings.workPreferences.limitedAvailability')}
                    </SelectItem>
                    <SelectItem value="offline">
                      <Badge variant="outline" className="mr-2">{t('supportAgent.dashboard.offline')}</Badge>
                      {t('supportAgent.settings.workPreferences.notAvailable')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('supportAgent.settings.workPreferences.maxConcurrentChats')}: {settings.maxConcurrentChats}</Label>
                <Slider
                  value={[settings.maxConcurrentChats]}
                  onValueChange={([value]) => updateSetting('maxConcurrentChats', value)}
                  max={10}
                  min={1}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.workPreferences.autoAcceptChats')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.workPreferences.autoAcceptChatsDesc')}</p>
                </div>
                <Switch
                  checked={settings.autoAcceptChats}
                  onCheckedChange={(checked) => updateSetting('autoAcceptChats', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.workPreferences.workingHours')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.workPreferences.workingHoursDesc')}</p>
                </div>
                <Switch
                  checked={settings.workingHours.enabled}
                  onCheckedChange={(checked) => updateSetting('workingHours.enabled', checked)}
                />
              </div>

              {settings.workingHours.enabled && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-border">
                  <div>
                    <Label>{t('supportAgent.settings.workPreferences.startTime')}</Label>
                    <input
                      type="time"
                      value={settings.workingHours.startTime}
                      onChange={(e) => updateSetting('workingHours.startTime', e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div>
                    <Label>{t('supportAgent.settings.workPreferences.endTime')}</Label>
                    <input
                      type="time"
                      value={settings.workingHours.endTime}
                      onChange={(e) => updateSetting('workingHours.endTime', e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-input bg-background text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communication Settings */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('supportAgent.settings.communication.title')}
              </CardTitle>
              <CardDescription>{t('supportAgent.settings.communication.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('supportAgent.settings.communication.defaultSupportLanguage')}</Label>
                <Select
                  value={settings.defaultLanguage}
                  onValueChange={(value) => updateSetting('defaultLanguage', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="Arabic">Arabic</SelectItem>
                    <SelectItem value="Hausa">Hausa</SelectItem>
                    <SelectItem value="Yoruba">Yoruba</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.communication.autoTranslate')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.communication.autoTranslateDesc')}</p>
                </div>
                <Switch
                  checked={settings.autoTranslate}
                  onCheckedChange={(checked) => updateSetting('autoTranslate', checked)}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>{t('supportAgent.settings.communication.voiceCallSettings')}</Label>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">{t('supportAgent.settings.communication.microphone')}</Label>
                  </div>
                  <Switch
                    checked={settings.voiceCallSettings.microphoneEnabled}
                    onCheckedChange={(checked) => updateSetting('voiceCallSettings.microphoneEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">{t('supportAgent.settings.communication.speaker')}</Label>
                  </div>
                  <Switch
                    checked={settings.voiceCallSettings.speakerEnabled}
                    onCheckedChange={(checked) => updateSetting('voiceCallSettings.speakerEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">{t('supportAgent.settings.communication.noiseCancellation')}</Label>
                  </div>
                  <Switch
                    checked={settings.voiceCallSettings.noiseCancellation}
                    onCheckedChange={(checked) => updateSetting('voiceCallSettings.noiseCancellation', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('supportAgent.settings.privacySecurity.title')}
              </CardTitle>
              <CardDescription>{t('supportAgent.settings.privacySecurity.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('supportAgent.settings.privacySecurity.profileVisibility')}</Label>
                <Select
                  value={settings.profileVisibility}
                  onValueChange={(value: 'public' | 'agents_only' | 'private') => updateSetting('profileVisibility', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t('supportAgent.settings.privacySecurity.public')}</SelectItem>
                    <SelectItem value="agents_only">{t('supportAgent.settings.privacySecurity.agentsOnly')}</SelectItem>
                    <SelectItem value="private">{t('supportAgent.settings.privacySecurity.private')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.privacySecurity.showOnlineStatus')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.privacySecurity.showOnlineStatusDesc')}</p>
                </div>
                <Switch
                  checked={settings.showOnlineStatus}
                  onCheckedChange={(checked) => updateSetting('showOnlineStatus', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.privacySecurity.allowDirectMessages')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.privacySecurity.allowDirectMessagesDesc')}</p>
                </div>
                <Switch
                  checked={settings.allowDirectMessages}
                  onCheckedChange={(checked) => updateSetting('allowDirectMessages', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Location Services */}
          <Card className="bg-card backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('supportAgent.settings.locationServices.title')}
              </CardTitle>
              <CardDescription>{t('supportAgent.settings.locationServices.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('supportAgent.settings.locationServices.locationSharing')}</Label>
                  <p className="text-sm text-muted-foreground">{t('supportAgent.settings.locationServices.locationSharingDesc')}</p>
                </div>
                <Switch
                  checked={settings.locationSharing}
                  onCheckedChange={(checked) => updateSetting('locationSharing', checked)}
                />
              </div>

              <div>
                <Label>{t('supportAgent.settings.locationServices.locationAccuracy')}</Label>
                <Select
                  value={settings.locationAccuracy}
                  onValueChange={(value: 'high' | 'medium' | 'low') => updateSetting('locationAccuracy', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{t('supportAgent.settings.locationServices.highAccuracy')}</SelectItem>
                    <SelectItem value="medium">{t('supportAgent.settings.locationServices.mediumAccuracy')}</SelectItem>
                    <SelectItem value="low">{t('supportAgent.settings.locationServices.lowAccuracy')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}