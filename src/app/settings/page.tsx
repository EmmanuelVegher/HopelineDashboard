"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { UserProfile } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Languages, Bell, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const languages = [
  "English",
  "Hausa",
  "Igbo",
  "Yoruba",
  "Tiv",
  "Kanuri",
  "Nigerian Pidgin"
];

export default function SettingsPage() {
  const [user, authLoading] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [language, setLanguage] = useState("");
  const [pushNotifications, setPushNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
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
          setLanguage(profileData.language || "English");
          const profileDataAny = profileData as any;
          setPushNotifications(profileDataAny.pushNotifications ?? false);
          setEmailNotifications(profileDataAny.emailNotifications ?? true);
        }
        setLoading(false);
      } else if (!authLoading) {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, authLoading]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        language,
        pushNotifications,
        emailNotifications
      });
      toast({ title: t('settings.toasts.settingsSaved'), description: t('settings.toasts.settingsSavedDesc') });
    } catch (error) {
      toast({ title: t('settings.toasts.updateFailed'), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!user || !profile) {
    return (
      <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-2xl">
        <CardContent className="p-6 text-center">
          <p>{t('settings.authRequired')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-slate-800 dark:text-slate-200">{t('settings.title')}</CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-300">{t('settings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Languages className="h-6 w-6 text-primary mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('settings.languageTitle')}</h3>
              <p className="text-muted-foreground text-sm">{t('settings.languageDesc')}</p>
            </div>
          </div>
          <div className="pl-10">
            <Label htmlFor="language" className="sr-only">{t('settings.languageTitle')}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language" className="w-full md:w-1/2">
                <SelectValue placeholder={t('settings.languagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {languages.map(lang => (
                  <SelectItem key={lang} value={lang}>{t(`settings.languageOptions.${lang}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Bell className="h-6 w-6 text-primary mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('settings.notificationsTitle')}</h3>
              <p className="text-muted-foreground text-sm">{t('settings.notificationsDesc')}</p>
            </div>
          </div>
          <div className="pl-10 space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="push-notifications" className="font-normal">
                {t('settings.pushNotifications')}
              </Label>
              <Switch
                id="push-notifications"
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="email-notifications" className="font-normal">
                {t('settings.emailNotifications')}
              </Label>
              <Switch
                id="email-notifications"
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-4 border-t pt-6">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? t('settings.buttons.saving') : t('settings.buttons.saveChanges')}
        </Button>

        <div className="sm:ml-auto">
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => navigate("/delete-account")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("deleteAccount.title")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
