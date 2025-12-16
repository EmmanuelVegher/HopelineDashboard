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
import { Loader2, Languages, Bell } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
      toast({ title: "Settings Saved", description: "Your preferences have been updated." });
    } catch (error) {
      toast({ title: "Failed to update settings", variant: "destructive" });
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
          <p>You must be logged in to view your settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-slate-800 dark:text-slate-200">Settings</CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-300">Manage your application preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
            <div className="flex items-start gap-4">
                <Languages className="h-6 w-6 text-primary mt-1" />
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Language</h3>
                    <p className="text-muted-foreground text-sm">Choose the language for application text and chat translation.</p>
                </div>
            </div>
            <div className="pl-10">
                <Label htmlFor="language" className="sr-only">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language" className="w-full md:w-1/2">
                        <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                        {languages.map(lang => (
                              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-start gap-4">
                <Bell className="h-6 w-6 text-primary mt-1" />
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Notifications</h3>
                    <p className="text-muted-foreground text-sm">Manage how you receive notifications.</p>
                </div>
            </div>
            <div className="pl-10 space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="push-notifications" className="font-normal">
                        Push Notifications
                    </Label>
                    <Switch
                      id="push-notifications"
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                    />
                </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor="email-notifications" className="font-normal">
                        Email Notifications
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
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
